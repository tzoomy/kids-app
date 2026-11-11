import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function extractRigData() {
  const rigsTsPath = path.join(repoRoot, 'src/assets/art/rigs.ts');
  const src = fs.readFileSync(rigsTsPath, 'utf8');

  // Strip TypeScript interface declarations and type annotations
  const jsCode = src
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\n\}/g, '')
    .replace(/export\s+const\s+ANIMAL_RIGS\s*:\s*[^=]+=/g, 'const ANIMAL_RIGS =')
    .replace(/export\s+const\s+ANIMAL_ART_KINDS\s*:\s*[^=]+=/g, 'const ANIMAL_ART_KINDS =');

  const fn = new Function(`${jsCode}\nreturn { ANIMAL_RIGS, ANIMAL_ART_KINDS };`);
  return fn();
}

async function main() {
  const data = extractRigData();
  const jsonPath = path.join(__dirname, 'rigs.json');
  const jsDataPath = path.join(__dirname, 'rigs-data.js');
  fs.writeFileSync(jsonPath, JSON.stringify(data, null, 2) + '\n', 'utf8');
  fs.writeFileSync(
    jsDataPath,
    `window.__RIGS_DATA__ = ${JSON.stringify(data, null, 2)};\n`,
    'utf8'
  );

  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const batches = [
    { file: 'animals.png', kinds: 'bear,rabbit,cat' },
    { file: 'animals-2.png', kinds: 'dog,panda,lion' },
  ];

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({
      viewport: { width: 1360, height: 1320 },
      deviceScaleFactor: 1,
    });
    const baseHtmlUrl = pathToFileURL(path.join(__dirname, 'index.html')).href;
    for (const batch of batches) {
      const outPath = path.join(shotsDir, batch.file);
      await page.goto(`${baseHtmlUrl}?kinds=${batch.kinds}`, { waitUntil: 'load' });
      await page.waitForFunction(() => window.__PREVIEW_READY__ === true);
      await page.waitForFunction(() => {
        const imgs = Array.from(document.querySelectorAll('img'));
        return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
      });
      await page.screenshot({ path: outPath, fullPage: true });
      console.log(`Saved screenshot to ${outPath}`);
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

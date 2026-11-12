import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

function extractChefRig() {
  const rigsTsPath = path.join(repoRoot, 'src/assets/art/rigs.ts');
  const src = fs.readFileSync(rigsTsPath, 'utf8');
  const start = src.indexOf('export const CHARACTER_RIGS');
  if (start < 0) throw new Error('CHARACTER_RIGS not found');
  const jsCode = src
    .slice(start)
    .replace(/export\s+interface\s+\w+\s*\{[\s\S]*?\n\}/g, '')
    .replace(/export\s+const\s+CHARACTER_RIGS\s*:\s*[^=]+=/g, 'const CHARACTER_RIGS =')
    .replace(/export\s+const\s+CHARACTER_ART_KINDS\s*:\s*[^=]+=/g, 'const CHARACTER_ART_KINDS =');
  const fn = new Function(`${jsCode}\nreturn { CHARACTER_RIGS, CHARACTER_ART_KINDS };`);
  return fn();
}

async function shot(page, htmlFile, outPath, viewport) {
  await page.setViewportSize(viewport);
  const url = pathToFileURL(path.join(__dirname, htmlFile)).href;
  await page.goto(url, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__PREVIEW_READY__ === true, null, { timeout: 15000 });
  await page.waitForFunction(() => {
    const imgs = Array.from(document.querySelectorAll('img'));
    return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
  });
  await page.screenshot({ path: outPath, fullPage: true });
  console.log(`Saved screenshot to ${outPath}`);
}

async function main() {
  const data = extractChefRig();
  fs.writeFileSync(path.join(__dirname, 'chef-rigs-data.js'), `window.__CHEF_RIGS_DATA__ = ${JSON.stringify(data, null, 2)};\n`, 'utf8');

  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const extraDir = '/workspace/gemini-expert/screens';
  fs.mkdirSync(extraDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const outPath = path.join(shotsDir, 'orchestra-preview.png');
    await shot(page, 'orchestra.html', outPath, { width: 1320, height: 1100 });
    fs.copyFileSync(outPath, path.join(extraDir, 'orchestra-preview.png'));
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

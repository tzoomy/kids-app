import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath, pathToFileURL } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);

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
  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const extraDir = '/workspace/gemini-expert/screens';
  fs.mkdirSync(extraDir, { recursive: true });

  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const jobs = [
      { file: 'sorting.html', name: 'sorting-preview.png', viewport: { width: 1320, height: 1400 } },
      { file: 'suitcase.html', name: 'suitcase-preview.png', viewport: { width: 1320, height: 1400 } },
    ];
    for (const job of jobs) {
      const outPath = path.join(shotsDir, job.name);
      await shot(page, job.file, outPath, job.viewport);
      fs.copyFileSync(outPath, path.join(extraDir, job.name));
    }
  } finally {
    await browser.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

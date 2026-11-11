import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const ROOT = path.resolve(__dirname, '../..');

const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.json': 'application/json',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const file = path.normalize(path.join(ROOT, urlPath));
    if (!file.startsWith(ROOT)) { res.writeHead(403); res.end(); return; }
    const target = fs.existsSync(file) && fs.statSync(file).isDirectory() ? path.join(file, 'index.html') : file;
    if (!fs.existsSync(target) || !fs.statSync(target).isFile()) { res.writeHead(404); res.end('not found'); return; }
    const ext = path.extname(target).toLowerCase();
    res.writeHead(200, { 'Content-Type': MIME[ext] || 'application/octet-stream' });
    fs.createReadStream(target).pipe(res);
  });
  return new Promise((resolve) => {
    server.listen(0, '127.0.0.1', () => resolve(server));
  });
}

async function shot(page, base, htmlFile, outPath, viewport) {
  await page.setViewportSize(viewport);
  await page.goto(`${base}/tools/art-preview/${htmlFile}`, { waitUntil: 'load' });
  await page.waitForFunction(() => window.__PREVIEW_READY__ === true, null, { timeout: 20000 });
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

  const server = await startServer();
  const { port } = server.address();
  const base = `http://127.0.0.1:${port}`;
  const browser = await chromium.launch();
  try {
    const page = await browser.newPage({ deviceScaleFactor: 1 });
    const jobs = [
      { file: 'puppet.html', name: 'puppet-preview.png', viewport: { width: 1320, height: 1600 } },
      { file: 'coloring.html', name: 'coloring-preview.png', viewport: { width: 1320, height: 1800 } },
    ];
    for (const job of jobs) {
      const outPath = path.join(shotsDir, job.name);
      await shot(page, base, job.file, outPath, job.viewport);
      fs.copyFileSync(outPath, path.join(extraDir, job.name));
    }
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

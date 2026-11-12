import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');
const PORT = 4188;
const MIME = {
  '.html': 'text/html; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.jpg': 'image/jpeg',
  '.json': 'application/json',
};

function startServer() {
  const server = http.createServer((req, res) => {
    const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
    const rel = urlPath === '/' ? '/tools/art-preview/language-house-picker.html' : urlPath;
    const file = path.normalize(path.join(repoRoot, rel));
    if (!file.startsWith(repoRoot + path.sep) && file !== repoRoot) {
      res.writeHead(403);
      res.end('forbidden');
      return;
    }
    fs.readFile(file, (err, data) => {
      if (err) {
        res.writeHead(err.code === 'ENOENT' ? 404 : 500);
        res.end(err.code === 'ENOENT' ? 'not found' : 'error');
        return;
      }
      res.writeHead(200, { 'Content-Type': MIME[path.extname(file)] || 'application/octet-stream' });
      res.end(data);
    });
  });
  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(PORT, '127.0.0.1', () => resolve(server));
  });
}

async function shot(browser, viewport, outPath) {
  // Fresh page at the target size — do not resize a landscape canvas.
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  try {
    await page.goto(`http://127.0.0.1:${PORT}/tools/art-preview/language-house-picker.html`, {
      waitUntil: 'load',
    });
    await page.waitForFunction(() => window.__PREVIEW_READY__ === true, null, { timeout: 15000 });
    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    });
    await page.screenshot({ path: outPath, fullPage: false });
    console.log(`Saved screenshot to ${outPath}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const extraDir = '/workspace/gemini-expert/screens';
  fs.mkdirSync(extraDir, { recursive: true });

  const server = await startServer();
  const browser = await chromium.launch();
  try {
    const landscape = path.join(shotsDir, 'language-house-picker-landscape.png');
    const portrait = path.join(shotsDir, 'language-house-picker-portrait.png');
    await shot(browser, { width: 1280, height: 800 }, landscape);
    await shot(browser, { width: 800, height: 1280 }, portrait);
    fs.copyFileSync(landscape, path.join(extraDir, 'language-house-picker-landscape.png'));
    fs.copyFileSync(portrait, path.join(extraDir, 'language-house-picker-portrait.png'));
  } finally {
    await browser.close();
    server.close();
    try {
      server.closeAllConnections?.();
    } catch {
      // ignore
    }
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

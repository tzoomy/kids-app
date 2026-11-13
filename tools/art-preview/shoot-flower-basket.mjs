import fs from 'node:fs';
import http from 'node:http';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

const MIME_TYPES = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml; charset=utf-8',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function startStaticServer(rootDir) {
  return new Promise((resolve, reject) => {
    const server = http.createServer((req, res) => {
      const urlPath = decodeURIComponent((req.url || '/').split('?')[0]);
      const relPath = urlPath.replace(/^\/+/, '');
      const filePath = path.resolve(rootDir, relPath);
      if (!filePath.startsWith(rootDir)) {
        res.writeHead(403);
        res.end('Forbidden');
        return;
      }
      if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
        res.writeHead(404);
        res.end('Not found');
        return;
      }
      const ext = path.extname(filePath).toLowerCase();
      res.writeHead(200, { 'Content-Type': MIME_TYPES[ext] || 'application/octet-stream' });
      fs.createReadStream(filePath).pipe(res);
    });
    server.on('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

async function shootOrientation(browser, url, outPath, viewport) {
  const page = await browser.newPage({
    viewport,
    deviceScaleFactor: 1,
  });
  try {
    await page.goto(url, { waitUntil: 'load' });
    await page.waitForFunction(() => window.__PREVIEW_READY__ === true, null, { timeout: 15000 });
    await page.waitForFunction(() => {
      const imgs = Array.from(document.querySelectorAll('img'));
      return imgs.length > 0 && imgs.every((img) => img.complete && img.naturalWidth > 0);
    });
    await page.screenshot({ path: outPath });
    console.log(`Saved screenshot to ${outPath}`);
  } finally {
    await page.close();
  }
}

async function main() {
  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const screensDir = '/workspace/gemini-expert/screens';
  fs.mkdirSync(screensDir, { recursive: true });

  const { server, port } = await startStaticServer(repoRoot);
  const url = `http://127.0.0.1:${port}/tools/art-preview/flower-basket.html`;

  const browser = await chromium.launch();
  try {
    const landscapePath = path.join(shotsDir, 'flower-basket-landscape.png');
    await shootOrientation(browser, url, landscapePath, { width: 1280, height: 800 });
    fs.copyFileSync(landscapePath, path.join(screensDir, 'flower-basket-landscape.png'));

    const portraitPath = path.join(shotsDir, 'flower-basket-portrait.png');
    await shootOrientation(browser, url, portraitPath, { width: 800, height: 1280 });
    fs.copyFileSync(portraitPath, path.join(screensDir, 'flower-basket-portrait.png'));
  } finally {
    await browser.close();
    server.close();
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

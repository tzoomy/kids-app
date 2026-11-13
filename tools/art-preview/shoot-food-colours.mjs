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
  '.svg': 'image/svg+xml',
  '.js': 'text/javascript; charset=utf-8',
  '.mjs': 'text/javascript; charset=utf-8',
  '.css': 'text/css; charset=utf-8',
  '.json': 'application/json; charset=utf-8',
  '.png': 'image/png',
};

function startStaticServer(rootDir) {
  const server = http.createServer((req, res) => {
    const reqUrl = new URL(req.url ?? '/', 'http://127.0.0.1');
    const safePath = path.normalize(decodeURIComponent(reqUrl.pathname)).replace(/^(\.\.(\/|\\|$))+/, '');
    const filePath = path.join(rootDir, safePath);

    if (!filePath.startsWith(rootDir) || !fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
      res.writeHead(404, { 'Content-Type': 'text/plain; charset=utf-8' });
      res.end('Not found');
      return;
    }

    const ext = path.extname(filePath).toLowerCase();
    const contentType = MIME_TYPES[ext] ?? 'application/octet-stream';
    res.writeHead(200, { 'Content-Type': contentType });
    fs.createReadStream(filePath).pipe(res);
  });

  return new Promise((resolve, reject) => {
    server.once('error', reject);
    server.listen(0, '127.0.0.1', () => {
      const address = server.address();
      resolve({ server, port: address.port });
    });
  });
}

async function main() {
  const shotsDir = path.join(__dirname, 'shots');
  const externalScreensDir = '/workspace/gemini-expert/screens';
  fs.mkdirSync(shotsDir, { recursive: true });
  fs.mkdirSync(externalScreensDir, { recursive: true });

  const { server, port } = await startStaticServer(repoRoot);
  const previewUrl = `http://127.0.0.1:${port}/tools/art-preview/food-colours.html`;

  const targets = [
    {
      name: 'landscape',
      width: 1280,
      height: 800,
      file: 'food-colours-landscape.png',
    },
    {
      name: 'portrait',
      width: 800,
      height: 1280,
      file: 'food-colours-portrait.png',
    },
  ];

  const browser = await chromium.launch();
  try {
    for (const target of targets) {
      const page = await browser.newPage({
        viewport: { width: target.width, height: target.height },
        deviceScaleFactor: 1,
      });
      try {
        await page.goto(previewUrl, { waitUntil: 'load' });
        await page.waitForFunction(() => window.__PREVIEW_READY__ === true);
        await page.waitForFunction(() => {
          const imgs = Array.from(document.querySelectorAll('img'));
          return imgs.length === 12 && imgs.every((img) => img.complete && img.naturalWidth > 0);
        });

        const shotPath = path.join(shotsDir, target.file);
        await page.screenshot({ path: shotPath, fullPage: false });

        const copyPath = path.join(externalScreensDir, target.file);
        fs.copyFileSync(shotPath, copyPath);
        console.log(`Saved ${target.name} screenshot to ${shotPath} and ${copyPath}`);
      } finally {
        await page.close();
      }
    }
  } finally {
    await browser.close();
    await new Promise((resolve) => server.close(resolve));
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = path.join(__dirname, 'shots');
const screensDir = '/workspace/gemini-expert/screens';

fs.mkdirSync(shotsDir, { recursive: true });
fs.mkdirSync(screensDir, { recursive: true });

const mimeTypes = {
  '.html': 'text/html; charset=utf-8',
  '.svg': 'image/svg+xml',
  '.png': 'image/png',
  '.css': 'text/css',
  '.js': 'text/javascript',
};

const server = http.createServer((req, res) => {
  const urlPath = (req.url || '/').split('?')[0];
  let filePath;
  if (
    urlPath === '/' ||
    urlPath === '/language-house-picker.html' ||
    urlPath === '/tools/art-preview/language-house-picker.html'
  ) {
    filePath = path.join(__dirname, 'language-house-picker.html');
  } else if (urlPath.startsWith('/art/')) {
    filePath = path.join(repoRoot, 'public', urlPath);
  } else {
    filePath = path.join(repoRoot, urlPath);
  }

  if (!fs.existsSync(filePath) || fs.statSync(filePath).isDirectory()) {
    res.writeHead(404);
    res.end('Not found: ' + urlPath);
    return;
  }

  const ext = path.extname(filePath);
  res.writeHead(200, { 'Content-Type': mimeTypes[ext] || 'application/octet-stream' });
  fs.createReadStream(filePath).pipe(res);
});

await new Promise((resolve) => server.listen(0, '127.0.0.1', resolve));
const { port } = server.address();
const pageUrl = `http://127.0.0.1:${port}/tools/art-preview/language-house-picker.html`;

const targets = [
  {
    name: 'language-house-picker-landscape.png',
    viewport: { width: 1280, height: 800 },
  },
  {
    name: 'language-house-picker-portrait.png',
    viewport: { width: 800, height: 1280 },
  },
];

const browser = await chromium.launch();

for (const target of targets) {
  const context = await browser.newContext({
    viewport: target.viewport,
    deviceScaleFactor: 1,
  });
  const page = await context.newPage();
  await page.goto(pageUrl, { waitUntil: 'networkidle' });
  await page.waitForFunction(() => window.__PREVIEW_READY__ === true);

  const shotPath = path.join(shotsDir, target.name);
  await page.screenshot({ path: shotPath });
  fs.copyFileSync(shotPath, path.join(screensDir, target.name));

  await context.close();
}

await browser.close();
server.close();
console.log('Saved Language House picker screenshots to', shotsDir, 'and', screensDir);

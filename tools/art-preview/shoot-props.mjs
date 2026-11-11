import { chromium } from '@playwright/test';
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = path.join(__dirname, 'shots');
fs.mkdirSync(shotsDir, { recursive: true });

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
  if (urlPath === '/' || urlPath === '/props.html') {
    filePath = path.join(__dirname, 'props.html');
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
const baseUrl = `http://127.0.0.1:${port}/props.html`;

const browser = await chromium.launch();
const page = await browser.newPage({ viewport: { width: 1400, height: 1400 }, deviceScaleFactor: 1 });
await page.goto(baseUrl, { waitUntil: 'networkidle' });

await page.locator('#shot-landscape').screenshot({ path: path.join(shotsDir, 'props-landscape.png') });
await page.locator('#shot-portrait').screenshot({ path: path.join(shotsDir, 'props-portrait.png') });
await page.locator('#shot-foods').screenshot({ path: path.join(shotsDir, 'foods.png') });

await browser.close();
server.close();
console.log('Saved screenshots to', shotsDir);

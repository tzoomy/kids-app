// Wardrobe accessory contact sheet: every character with every accessory (src/content/wardrobe).
//   node tools/art-preview/shoot-wardrobe.mjs
// Serves the repo root over HTTP and writes tools/art-preview/shots/wardrobe-sheet.png,
// plus one large shot per character (wardrobe-<kind>.png) for close inspection.
import http from 'node:http';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = path.join(__dirname, 'shots');
const TYPES = { '.html': 'text/html', '.js': 'text/javascript', '.json': 'application/json', '.svg': 'image/svg+xml' };

function serve() {
  const server = http.createServer((req, res) => {
    const file = path.join(repoRoot, decodeURIComponent(new URL(req.url, 'http://x').pathname));
    if (!file.startsWith(repoRoot) || !fs.existsSync(file) || fs.statSync(file).isDirectory()) {
      res.writeHead(404).end();
      return;
    }
    res.writeHead(200, { 'content-type': TYPES[path.extname(file)] ?? 'application/octet-stream' });
    fs.createReadStream(file).pipe(res);
  });
  return new Promise((resolve) => server.listen(0, '127.0.0.1', () => resolve(server)));
}

async function shoot(browser, url, file, viewport) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(url);
  await page.waitForFunction(() => window.__WARDROBE_READY__ === true, null, { timeout: 20000 });
  await page.screenshot({ path: path.join(shotsDir, file), fullPage: true });
  console.log(`Saved ${path.join(shotsDir, file)}`);
  await page.close();
}

const server = await serve();
const base = `http://127.0.0.1:${server.address().port}/tools/art-preview/wardrobe.html`;
fs.mkdirSync(shotsDir, { recursive: true });
const browser = await chromium.launch();
try {
  await shoot(browser, base, 'wardrobe-sheet.png', { width: 1700, height: 900 });
  const kinds = (process.argv[2] ?? '').split(',').filter(Boolean);
  for (const kind of kinds) await shoot(browser, `${base}?chars=${kind}&big=1`, `wardrobe-${kind}.png`, { width: 3800, height: 520 });
} finally {
  await browser.close();
  server.close();
}

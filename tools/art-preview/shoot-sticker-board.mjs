// In-game Sticker Board shots (docs/specs/sticker-board.md) at native 1280x800 and 800x1280,
// each orientation in a fresh page. Run after `npm run build`:
//   node tools/art-preview/shoot-sticker-board.mjs
// Writes tools/art-preview/shots/sticker-board-<state>-<orientation>.png. Uses goToScreen (preview only).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = path.join(__dirname, 'shots');
const port = Number(process.env.PREVIEW_PORT ?? 4183);
const base = `http://127.0.0.1:${port}/kids-app/`;

async function waitFor(url, timeoutMs = 30000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      if ((await fetch(url)).ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not start: ${url}`);
}

const info = (page) => page.evaluate(() => window.__testHooks__.getStickerBoardInfo());

async function openBoard(browser, viewport, profile) {
  const page = await browser.newPage({ viewport, deviceScaleFactor: 1 });
  await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
  await page.evaluate(() => window.__testHooks__?.seedTimeEarningEnabled?.(false));
  await page.locator(`[data-testid="${profile}"]`).click();
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 20000 });
  await page.evaluate(() => window.__testHooks__.goToScreen('stickers'));
  await page.waitForFunction(() => window.__testHooks__.getStickerBoardInfo?.() !== null, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  return page;
}

async function tap(page, testId) {
  await page.locator(`[data-testid="${testId}"]`).click();
}

async function drawLine(page, r, x0, y0, x1, y1) {
  await page.mouse.move(r.x + r.width * x0, r.y + r.height * y0);
  await page.mouse.down();
  for (let i = 1; i <= 10; i++) {
    await page.mouse.move(r.x + r.width * (x0 + ((x1 - x0) * i) / 10), r.y + r.height * (y0 + ((y1 - y0) * i) / 10));
  }
  await page.mouse.up();
}

async function main() {
  fs.mkdirSync(shotsDir, { recursive: true });
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { cwd: repoRoot, stdio: 'pipe' });
  try {
    await waitFor(base);
    const browser = await chromium.launch();
    try {
      for (const [orientation, viewport] of [['landscape', { width: 1280, height: 800 }], ['portrait', { width: 800, height: 1280 }]]) {
        const shot = async (page, name) => {
          const file = path.join(shotsDir, `sticker-board-${name}-${orientation}.png`);
          await page.screenshot({ path: file });
          console.log(`Saved ${file}`);
        };
        // Age 5: start with a request, then play (stickers + drawing), then the album.
        let page = await openBoard(browser, viewport, 'profile-b');
        await shot(page, 'age5-start');
        await tap(page, 'sticker-tray-rocket');
        await tap(page, 'sticker-tray-planet');
        const r = (await info(page)).boardRect;
        await drawLine(page, r, 0.15, 0.95, 0.45, 0.93);
        await page.waitForTimeout(1800);
        await shot(page, 'age5-play');
        await tap(page, 'sticker-save');
        await tap(page, 'sticker-album');
        await page.waitForTimeout(400);
        await shot(page, 'age5-album');
        await page.close();
        // Age 2: jungle, two stickers and a drawing.
        page = await openBoard(browser, viewport, 'profile-a');
        await tap(page, 'sticker-bg-jungle');
        await tap(page, 'sticker-tray-palm-tree');
        await tap(page, 'sticker-tray-banana');
        const r2 = (await info(page)).boardRect;
        await drawLine(page, r2, 0.2, 0.9, 0.6, 0.85);
        await page.waitForTimeout(900);
        await shot(page, 'age2-play');
        await page.close();
      }
    } finally {
      await browser.close();
    }
  } finally {
    preview.kill('SIGKILL');
  }
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

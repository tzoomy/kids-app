// Magic Magnet preview (not a test): the scene at start and after the magnet touched an object, both orientations, both profiles.
// Usage: npm run build && node tools/art-preview/shoot-magic-magnet.mjs
// Writes tools/art-preview/shots/magic-magnet-<profile>-{start,touch}-{landscape,portrait}.png (not committed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = path.join(__dirname, 'shots');
const port = Number(process.env.PREVIEW_PORT ?? 4179);

async function waitFor(url, timeoutMs = 20000) {
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

const info = (page) => page.evaluate(() => window.__testHooks__.getMagnetInfo());

async function dragTipsTo(page, i, x, y) {
  const sx = i.magnet.x + i.magnet.width / 2;
  const sy = i.magnet.y + i.magnet.height / 2;
  await page.mouse.move(sx, sy);
  await page.mouse.down();
  await page.mouse.move(x - (i.tips.x - sx), y - (i.tips.y - sy), { steps: 12 });
  await page.mouse.up();
}

async function shoot(browser, base, profile, name, width, height) {
  // A fresh page per orientation: Phaser picks its base size at load.
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
  await page.locator(`[data-testid="${profile}"]`).click();
  await page.waitForFunction(() => window.__testHooks__?.getActiveScenes().includes('MapScene'), null, { timeout: 20000 });
  await page.waitForTimeout(1800); // building pop-in
  const hit = await page.evaluate(() => window.__testHooks__.getBuildingHit('science-world'));
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.locator('[data-testid="game-picker-magic-magnet"]').click();
  await page.waitForFunction(() => window.__testHooks__?.getMagnetInfo()?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shotsDir, `magic-magnet-${profile}-start-${name}.png`) });
  let i = await info(page);
  if (i.phase === 'predicting') {
    const target = i.objects.find((o) => o.id === i.target);
    const b = target.metal ? i.buttons.sticks : i.buttons.notSticks;
    await page.mouse.click(b.x + b.width / 2, b.y + b.height / 2);
    await page.waitForFunction(() => window.__testHooks__.getMagnetInfo()?.phase === 'testing', null, { timeout: 10000 });
    i = await info(page);
  }
  const obj = i.phase === 'testing' ? i.objects.find((o) => o.id === i.target) : i.objects.find((o) => o.metal);
  await dragTipsTo(page, i, obj.rect.x + obj.rect.width / 2, obj.rect.y + obj.rect.height / 2);
  await page.waitForTimeout(900);
  await page.screenshot({ path: path.join(shotsDir, `magic-magnet-${profile}-touch-${name}.png`) });
  await page.close();
}

async function main() {
  fs.mkdirSync(shotsDir, { recursive: true });
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { cwd: repoRoot, stdio: 'ignore', detached: true });
  const base = `http://127.0.0.1:${port}/kids-app/`;
  try {
    await waitFor(base);
    const browser = await chromium.launch();
    try {
      for (const profile of ['profile-a', 'profile-b']) {
        await shoot(browser, base, profile, 'landscape', 1280, 800);
        await shoot(browser, base, profile, 'portrait', 800, 1280);
      }
    } finally {
      await browser.close();
    }
  } finally {
    // Kill the whole process group: npx -> vite.
    try {
      process.kill(-preview.pid, 'SIGKILL');
    } catch {
      preview.kill('SIGKILL');
    }
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

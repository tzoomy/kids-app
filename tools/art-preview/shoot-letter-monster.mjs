// Letter Monster preview (not a test): the picker, the scene at start and after one feed, both profiles and orientations.
// Usage: npm run build && node tools/art-preview/shoot-letter-monster.mjs
// Writes tools/art-preview/shots/letter-monster-*.png (never commit them).
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

async function shoot(browser, base, profile, name, width, height) {
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
  await page.locator(`[data-testid="${profile}"]`).click();
  await page.waitForFunction(() => window.__testHooks__?.getActiveScenes().includes('MapScene'), null, { timeout: 20000 });
  await page.waitForTimeout(1800);
  const hit = await page.evaluate(() => window.__testHooks__.getBuildingHit('language-house'));
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.locator('[data-testid="game-picker-letter-monster"]').waitFor({ state: 'visible' });
  await page.waitForTimeout(400);
  if (profile === 'profile-a') await page.screenshot({ path: path.join(shotsDir, `letter-monster-picker-${name}.png`) });
  await page.locator('[data-testid="game-picker-letter-monster"]').click();
  await page.waitForFunction(() => window.__testHooks__?.getLetterMonsterInfo()?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(600);
  await page.screenshot({ path: path.join(shotsDir, `letter-monster-${profile}-start-${name}.png`) });
  const info = await page.evaluate(() => window.__testHooks__.getLetterMonsterInfo());
  const r = info.foods[info.matchId];
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shotsDir, `letter-monster-${profile}-feed-${name}.png`) });
  await page.close();
}

async function main() {
  fs.mkdirSync(shotsDir, { recursive: true });
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], { cwd: repoRoot, stdio: 'pipe' });
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
    preview.kill('SIGKILL');
  }
}

main().catch((e) => {
  console.error(e);
  process.exit(1);
});

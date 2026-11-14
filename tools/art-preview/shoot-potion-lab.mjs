// Potion Lab preview (not a test): the scene at start and right after a mix, both orientations, both profiles.
// Usage: npm run build && node tools/art-preview/shoot-potion-lab.mjs
// Writes tools/art-preview/shots/potion-lab-<profile>-{start,mix}-{landscape,portrait}.png (not committed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = path.join(__dirname, 'shots');
const port = Number(process.env.PREVIEW_PORT ?? 4178);

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
  // A fresh page per orientation: Phaser picks its base size at load.
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
  await page.locator(`[data-testid="${profile}"]`).click();
  await page.waitForFunction(() => window.__testHooks__?.getActiveScenes().includes('MapScene'), null, { timeout: 20000 });
  await page.waitForTimeout(1800); // building pop-in
  const hit = await page.evaluate(() => window.__testHooks__.getBuildingHit('science-world'));
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.locator('[data-testid="game-picker-potion-lab"]').click();
  await page.waitForFunction(() => window.__testHooks__?.getPotionInfo()?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  await page.screenshot({ path: path.join(shotsDir, `potion-lab-${profile}-start-${name}.png`) });
  const info = await page.evaluate(() => window.__testHooks__.getPotionInfo());
  for (const c of ['red', 'blue']) {
    const r = info.pots[c];
    await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
    await page.waitForTimeout(700);
  }
  await page.waitForTimeout(500);
  await page.screenshot({ path: path.join(shotsDir, `potion-lab-${profile}-mix-${name}.png`) });
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

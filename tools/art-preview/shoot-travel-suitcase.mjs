// Travel Suitcase preview (not a test): the scene at start and after one move, both orientations, both profiles.
// Usage: npm run build && node tools/art-preview/shoot-travel-suitcase.mjs
// Writes tools/art-preview/shots/travel-suitcase-<profile>-{start,move}-{landscape,portrait}.png (not committed).
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');
const shotsDir = process.env.SHOTS_DIR ?? path.join(__dirname, 'shots');
const port = Number(process.env.PREVIEW_PORT ?? 4182);

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

const info = (page) => page.evaluate(() => window.__testHooks__.getSuitcaseInfo());

async function tapCentre(page, r) {
  await page.mouse.click(r.x + r.width / 2, r.y + r.height / 2);
}

async function shoot(browser, base, profile, name, width, height, level) {
  // A fresh page per orientation: Phaser picks its base size at load.
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
  await page.locator(`[data-testid="${profile}"]`).click();
  await page.waitForFunction(() => window.__testHooks__?.getActiveScenes().includes('MapScene'), null, { timeout: 20000 });
  await page.waitForTimeout(1800); // building pop-in
  if (level) await page.evaluate((l) => window.__testHooks__.seedSuitcaseLevel(l), level);
  const hit = await page.evaluate(() => window.__testHooks__.getBuildingHit('language-house'));
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await page.locator('[data-testid="game-picker-travel-suitcase"]').waitFor();
  await page.screenshot({ path: path.join(shotsDir, `travel-suitcase-picker-${name}.png`) });
  await page.locator('[data-testid="game-picker-travel-suitcase"]').click();
  await page.waitForFunction(() => window.__testHooks__?.getSuitcaseInfo()?.ready === true, null, { timeout: 20000 });
  await page.waitForTimeout(800);
  const tag = `${profile}${level ? `-L${level}` : ''}`;
  await page.screenshot({ path: path.join(shotsDir, `travel-suitcase-${tag}-start-${name}.png`) });
  const i = await info(page);
  const rightId = i.rightIds[0];
  const rightChoice = i.choices.find((c) => c.id === rightId && !c.packed);
  await tapCentre(page, rightChoice.rect);
  await page.waitForTimeout(700);
  await page.screenshot({ path: path.join(shotsDir, `travel-suitcase-${tag}-move-${name}.png`) });
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
      for (const [profile, level] of [['profile-a', 0], ['profile-b', 0], ['profile-b', 5]]) {
        await shoot(browser, base, profile, 'landscape', 1280, 800, level);
        await shoot(browser, base, profile, 'portrait', 800, 1280, level);
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

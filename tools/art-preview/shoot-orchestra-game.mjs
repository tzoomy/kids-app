import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { chromium } from '@playwright/test';
import { spawn } from 'node:child_process';

const __filename = fileURLToPath(import.meta.url);
const __dirname = path.dirname(__filename);
const repoRoot = path.resolve(__dirname, '../..');

async function waitFor(url, timeoutMs = 20000) {
  const start = Date.now();
  while (Date.now() - start < timeoutMs) {
    try {
      const res = await fetch(url);
      if (res.ok) return;
    } catch {
      // not up yet
    }
    await new Promise((r) => setTimeout(r, 250));
  }
  throw new Error(`Server did not start: ${url}`);
}

async function main() {
  const shotsDir = path.join(__dirname, 'shots');
  fs.mkdirSync(shotsDir, { recursive: true });
  const extraDir = '/workspace/gemini-expert/screens';
  fs.mkdirSync(extraDir, { recursive: true });

  const port = 4177;
  const preview = spawn('npx', ['vite', 'preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'], {
    cwd: repoRoot,
    stdio: 'pipe',
  });
  const base = `http://127.0.0.1:${port}/kids-app/`;
  try {
    await waitFor(base);
    const browser = await chromium.launch();
    try {
      const page = await browser.newPage({ viewport: { width: 1280, height: 800 }, deviceScaleFactor: 1 });
      await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
      await page.locator('[data-testid="profile-a"]').click();
      await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 20000 });
      await page.evaluate(() => {
        window.__testHooks__.goToScreen('orchestra');
      });
      await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 20000 });
      // Wait until the kitchen trial exists (listen or echo). Don't require ready — TTS may be slow.
      await page.waitForFunction(() => {
        const info = window.__testHooks__.getOrchestraInfo?.();
        return info !== null;
      }, null, { timeout: 15000 });
      await page.waitForTimeout(1200);
      const gamePath = path.join(shotsDir, 'orchestra-game-landscape.png');
      await page.screenshot({ path: gamePath, fullPage: false });
      fs.copyFileSync(gamePath, path.join(extraDir, 'orchestra-game-landscape.png'));
      console.log(`Saved screenshot to ${gamePath}`);

      // Open a fresh page at 800x1280 so Phaser pickBaseSize() uses the portrait canvas.
      const portraitPage = await browser.newPage({ viewport: { width: 800, height: 1280 }, deviceScaleFactor: 1 });
      await portraitPage.goto(`${base}?e2e=1`, { waitUntil: 'load' });
      await portraitPage.locator('[data-testid="profile-a"]').click();
      await portraitPage.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 20000 });
      await portraitPage.evaluate(() => window.__testHooks__.goToScreen('orchestra'));
      await portraitPage.waitForFunction(() => window.__GAME_READY__ === true && window.__testHooks__.getOrchestraInfo?.() !== null, null, { timeout: 20000 });
      await portraitPage.waitForTimeout(1200);
      const portraitPath = path.join(shotsDir, 'orchestra-game-portrait.png');
      await portraitPage.screenshot({ path: portraitPath, fullPage: false });
      fs.copyFileSync(portraitPath, path.join(extraDir, 'orchestra-game-portrait.png'));
      console.log(`Saved screenshot to ${portraitPath}`);
      await portraitPage.close();
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

/**
 * Capture the in-game journey frames that used to be taken inside
 * tests/e2e/journey.spec.ts, and write them to docs/screenshots/.
 *
 * Not part of CI or any committed Playwright spec. Run after a build:
 *   node tools/art-preview/shoot-in-game.mjs
 *
 * Options:
 *   --out <dir>   output directory (default: docs/screenshots)
 *   --port <n>    vite preview port (default: 4316, or $SHOOT_PORT)
 *
 * Frames (matching the old journey spec):
 *   profiles, map, restaurant start — 1280×800 and 800×1280
 *   bubbles, parent — 1280×800 only
 *
 * The fuller ready-for-merge set in docs/PROCESS.md (age-2 vs age-5 starts,
 * correct-feedback, hint/retry, per game) is not produced here yet.
 */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { spawn } from 'node:child_process';
import { chromium } from '@playwright/test';

const __dirname = path.dirname(fileURLToPath(import.meta.url));
const repoRoot = path.resolve(__dirname, '../..');

function argValue(flag, fallback) {
  const idx = process.argv.indexOf(flag);
  if (idx >= 0 && process.argv[idx + 1]) return process.argv[idx + 1];
  return fallback;
}

const outDir = path.resolve(argValue('--out', path.join(repoRoot, 'docs/screenshots')));
const port = Number(argValue('--port', process.env.SHOOT_PORT || '4316'));

async function waitFor(url, timeoutMs = 60_000) {
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

async function waitForGameReady(page) {
  await page.waitForFunction(() => window.__GAME_READY__ === true, null, { timeout: 20_000 });
}

async function seedTimeEarningEnabled(page, enabled) {
  await page.waitForFunction(() => window.__testHooks__?.seedTimeEarningEnabled !== undefined);
  await page.evaluate((value) => window.__testHooks__.seedTimeEarningEnabled(value), enabled);
  await page.reload({ waitUntil: 'load' });
}

async function goToScreen(page, screen) {
  await page.evaluate((s) => window.__testHooks__.goToScreen(s), screen);
  await waitForGameReady(page);
}

async function shootViewport(browser, { width, height }, shots) {
  const sizeTag = `${width}x${height}`;
  const page = await browser.newPage({ viewport: { width, height }, deviceScaleFactor: 1 });
  const base = `http://127.0.0.1:${port}/kids-app/`;
  try {
    await page.goto(`${base}?e2e=1`, { waitUntil: 'load' });
    await seedTimeEarningEnabled(page, true);
    await page.locator('[data-testid="profile-a"]').waitFor();
    if (shots.includes('profiles')) {
      await page.screenshot({ path: path.join(outDir, `profiles-${sizeTag}.png`) });
      console.log(`Saved profiles-${sizeTag}.png`);
    }

    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);
    await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
    if (shots.includes('map')) {
      await page.screenshot({ path: path.join(outDir, `map-${sizeTag}.png`) });
      console.log(`Saved map-${sizeTag}.png`);
    }

    await goToScreen(page, 'restaurant');
    await page.waitForFunction(() => {
      const info = window.__testHooks__.getRoundInfo?.();
      return info !== null && info.ready;
    }, null, { timeout: 20_000 });
    if (shots.includes('restaurant')) {
      await page.screenshot({ path: path.join(outDir, `restaurant-${sizeTag}.png`) });
      console.log(`Saved restaurant-${sizeTag}.png`);
    }

    if (shots.includes('bubbles') || shots.includes('parent')) {
      await page.evaluate((sec) => window.__testHooks__.seedBalanceSec(sec), 120);
      await goToScreen(page, 'bubbles');
      await page.waitForFunction(() => window.__testHooks__.getActiveScenes().includes('BubblesScene'));
      if (shots.includes('bubbles')) {
        await page.waitForTimeout(2500);
        await page.screenshot({ path: path.join(outDir, `bubbles-${sizeTag}.png`) });
        console.log(`Saved bubbles-${sizeTag}.png`);
      }

      if (shots.includes('parent')) {
        await goToScreen(page, 'map');
        await page.locator('[data-testid="parent-gate-btn"]').click();
        await page.locator('[data-testid="parent-exit-btn"]').waitFor();
        await page.screenshot({ path: path.join(outDir, `parent-${sizeTag}.png`) });
        console.log(`Saved parent-${sizeTag}.png`);
      }
    }
  } finally {
    await page.close();
  }
}

async function main() {
  fs.mkdirSync(outDir, { recursive: true });
  const distIndex = path.join(repoRoot, 'dist', 'index.html');
  if (!fs.existsSync(distIndex)) {
    console.log('No dist/ build found; running npm run build…');
    const build = spawn('npm', ['run', 'build'], { cwd: repoRoot, stdio: 'inherit' });
    const buildCode = await new Promise((resolve) => build.on('close', resolve));
    if (buildCode !== 0) throw new Error(`npm run build exited ${buildCode}`);
  }

  const viteBin = path.join(repoRoot, 'node_modules', '.bin', 'vite');
  // Own process group so the preview (and any children) can be killed without
  // leaving a listener on the port, which happens if we only kill an npx wrapper.
  const preview = spawn(
    viteBin,
    ['preview', '--port', String(port), '--host', '127.0.0.1', '--strictPort'],
    { cwd: repoRoot, stdio: 'pipe', detached: true },
  );
  const stopPreview = () => {
    if (!preview.pid) return;
    try {
      process.kill(-preview.pid, 'SIGKILL');
    } catch {
      try {
        preview.kill('SIGKILL');
      } catch {
        // already gone
      }
    }
  };
  const base = `http://127.0.0.1:${port}/kids-app/`;
  try {
    await waitFor(base);
    const browser = await chromium.launch();
    try {
      // Fresh page per size so Phaser FIT uses the native canvas, not a letterboxed resize.
      await shootViewport(browser, { width: 1280, height: 800 }, [
        'profiles',
        'map',
        'restaurant',
        'bubbles',
        'parent',
      ]);
      await shootViewport(browser, { width: 800, height: 1280 }, ['profiles', 'map', 'restaurant']);
    } finally {
      await browser.close();
    }
  } finally {
    stopPreview();
  }
  console.log('Wrote in-game screenshots to', outDir);
}

main().catch((err) => {
  console.error(err);
  process.exit(1);
});

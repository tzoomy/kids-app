import { test, expect, type Page } from '@playwright/test';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

const dirname = path.dirname(fileURLToPath(import.meta.url));
const screenshotsDir = path.resolve(dirname, '../../docs/screenshots');

async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __GAME_READY__?: boolean }).__GAME_READY__ === true, {
    timeout: 15000,
  });
}

type Screen = 'map' | 'restaurant' | 'bubbles';

async function goToScreen(page: Page, screen: Screen): Promise<void> {
  await page.evaluate((s: Screen) => {
    (window as unknown as { __testHooks__: { goToScreen: (s: Screen) => void } }).__testHooks__.goToScreen(s);
  }, screen);
  await waitForGameReady(page);
}

test.describe('kids-app journey', () => {
  test('profile select -> map -> restaurant -> bubbles -> parent gate', async ({ page }, testInfo) => {
    const sizeTag = `${testInfo.project.use.viewport?.width}x${testInfo.project.use.viewport?.height}`;

    await page.goto('/?e2e=1');

    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    if (sizeTag === '1280x800' || sizeTag === '800x1280') {
      await page.screenshot({ path: path.join(screenshotsDir, `profiles-${sizeTag}.png`) });
    }
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);

    await page.waitForTimeout(300); // let idle-motion tweens settle for a stable screenshot
    await page.screenshot({ path: path.join(screenshotsDir, `map-${sizeTag}.png`) });

    await goToScreen(page, 'restaurant');
    await page.waitForTimeout(500);
    await page.screenshot({ path: path.join(screenshotsDir, `restaurant-${sizeTag}.png`) });

    await page.evaluate((sec) => {
      (window as unknown as { __testHooks__: { seedBalanceSec: (s: number) => void } }).__testHooks__.seedBalanceSec(sec);
    }, 120);
    await goToScreen(page, 'bubbles');
    await page.waitForTimeout(2500); // let a few bubbles rise into view for a representative screenshot
    if (sizeTag === '1280x800') {
      await page.screenshot({ path: path.join(screenshotsDir, `bubbles-${sizeTag}.png`) });
    }

    await goToScreen(page, 'map');
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.locator('[data-testid="parent-exit-btn"]')).toBeVisible();
    if (sizeTag === '1280x800') {
      await page.screenshot({ path: path.join(screenshotsDir, `parent-${sizeTag}.png`) });
    }
  });

  test('wrong choices in the restaurant never reduce the leisure balance', async ({ page }) => {
    await page.goto('/?e2e=1');
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);

    await page.evaluate((sec) => {
      (window as unknown as { __testHooks__: { seedBalanceSec: (s: number) => void } }).__testHooks__.seedBalanceSec(sec);
    }, 42);
    await goToScreen(page, 'restaurant');
    await page.waitForTimeout(400);

    const before = await page.locator('[data-testid="leisure-balance"]').innerText();
    expect(before).toMatch(/0:4[2-9]|0:5\d/); // 0:42 or a second or two of earning

    const canvas = page.locator('canvas');
    const box = await canvas.boundingBox();
    expect(box).not.toBeNull();
    // Tap near the left plate (y ≈ 0.64) — a miss must never reduce the balance.
    if (box) {
      for (let i = 0; i < 3; i++) {
        await page.mouse.click(box.x + box.width * 0.28, box.y + box.height * 0.64);
        await page.waitForTimeout(200);
      }
    }

    const after = await page.locator('[data-testid="leisure-balance"]').innerText();
    const parse = (s: string) => {
      const m = s.match(/(\d+):(\d+)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
    };
    expect(parse(after)).toBeGreaterThanOrEqual(parse(before));
  });

  test('parent multiplication gate is shown when e2e bypass is off', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.getByText('אזור הורים')).toBeVisible();
    await expect(page.getByText(/כמה זה/)).toBeVisible();
    await page.getByRole('button', { name: 'ביטול' }).click();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
  });

  test('shell stays available after going offline', async ({ page, context }) => {
    await page.goto('/?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    // Give the production service worker a chance to take control, then reload so
    // the page is served from cache before we cut the network.
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // ignore — preview environments without a SW still have HTTP cache
      }
    });
    await page.reload();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible({ timeout: 15_000 });
    await context.setOffline(false);
  });
});

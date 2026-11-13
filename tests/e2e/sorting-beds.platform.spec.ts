// Sorting Beds Pass 1, TDD step 1: offline and parent-gate acceptance tests (AC-12, AC-13).
// AC-12 enters the game by real taps while the network is cut. AC-13 deliberately runs WITHOUT ?e2e=1.
import { test, expect, type TestInfo } from '@playwright/test';
import { enterWorldByTap, placeCurrentCorrectly, placedCount, waitForSortingReady } from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

test.describe('sorting beds: platform', () => {
  test('[AC-12] @single-orientation works offline: after the cache is warm the game still opens and plays', async ({ page, context }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await page.goto('/?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    // Let the production service worker take control, then reload so the page is served from cache.
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // preview environments without a service worker still have the HTTP cache
      }
    });
    await page.reload();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible({ timeout: 15_000 });

    // Still offline: real taps from the profile to the Number Garden building open the game, and it plays.
    await enterWorldByTap(page, 'profile-a', 'number-garden');
    const info = await waitForSortingReady(page);
    expect(info.beds.length).toBeGreaterThanOrEqual(2);
    await placeCurrentCorrectly(page);
    const next = await waitForSortingReady(page);
    expect(placedCount(next)).toBe(1);
    await context.setOffline(false);
  });

  test('[AC-13] @single-orientation the parent area stays gated without the e2e bypass', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await page.goto('/'); // no ?e2e=1: no test hooks, no gate bypass
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __testHooks__?: unknown }).__testHooks__)).toBeUndefined();

    await page.locator('[data-testid="parent-gate-btn"]').click();
    // The multiplication gate (a number input) is shown; the settings screen is not reachable without answering it.
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('[data-testid="parent-exit-btn"]')).toHaveCount(0);
  });
});

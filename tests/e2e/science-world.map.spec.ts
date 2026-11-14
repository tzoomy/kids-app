import { test, expect } from '@playwright/test';
import {
  getActiveScenes,
  getBuildingHit,
  getStableBox,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  waitForSpokenLine,
} from './helpers/journey';

// Science World map area (separate map area: pending Maor decision, docs/PENDING-DECISIONS.md).
// Both Playwright projects (1280x800 and 800x1280) run every test, so both orientations are covered.
// Real taps only; hooks just read state. No screenshots in committed specs (use tools/art-preview locally).

const MIN_TAP = 64;

test.describe('science world map area', () => {
  test('the Science World building is on the map, open, and inside the viewport', async ({ page }) => {
    await page.goto('./?e2e=1');
    await page.locator('[data-testid="profile-a"]').click();
    await waitForScene(page, 'MapScene');
    await expect.poll(async () => (await getBuildingHit(page, 'science-world'))?.width ?? 0).toBeGreaterThan(MIN_TAP);
    const hit = (await getBuildingHit(page, 'science-world'))!;
    const vp = page.viewportSize()!;
    expect(hit.height).toBeGreaterThanOrEqual(MIN_TAP);
    expect(hit.x).toBeGreaterThanOrEqual(0);
    expect(hit.y).toBeGreaterThanOrEqual(0);
    expect(hit.x + hit.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(hit.y + hit.height).toBeLessThanOrEqual(vp.height + 0.5);
  });

  test('real tap opens the Science World picker with its gentle coming-soon state, and close returns to the map', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');

    const empty = page.locator('[data-testid="game-picker-empty"]');
    await empty.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(empty).toHaveText('הניסויים בדרך! נבקר כאן בקרוב.');
    await expect(page.getByText('עולם המדע').first()).toBeVisible();
    // No game cards yet; the area never fails or locks, it just says "soon".
    await expect(page.locator('[data-testid^="game-picker-"].picker-card')).toHaveCount(0);
    await waitForSpokenLine(page, (l) => l.lineId === 'he.map.comingSoon');

    // Regression: a press on the card must not reach a map building underneath (Number Garden in portrait).
    await tapTestId(page, 'game-picker-empty');
    await page.waitForTimeout(600);
    expect(await getActiveScenes(page)).toEqual(['MapScene']);
    await expect(empty).toBeVisible();

    const close = await getStableBox(page, 'game-picker-close');
    expect(close.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(close.height).toBeGreaterThanOrEqual(MIN_TAP);
    await tapTestId(page, 'game-picker-close');
    await expect(empty).toBeHidden();
    expect(await getActiveScenes(page)).toContain('MapScene');
  });
});

import { test, expect } from '@playwright/test';
import {
  getActiveScenes,
  getBuildingHit,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
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

  // Station trail entry rule (docs/specs/station-trail.md AC-10, pending Maor decision): Science World has one game
  // (Potion Lab), so its building enters the game directly. There is no picker and no empty "coming soon" card.
  // The empty picker for a world with no game is covered at unit level (tests/unit/station-trail.entry.test.ts).
  test('real tap on the Science World building enters Potion Lab directly: no picker, no empty card', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await waitForScene(page, 'PotionScene');
    // Regression: nothing else is tapped through to the map under the building (portrait: another building sits below it).
    await page.waitForTimeout(600);
    expect(await getActiveScenes(page)).toEqual(['PotionScene']);
    await expect(page.locator('[data-testid="game-picker-potion-lab"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="game-picker-empty"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="game-picker-close"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="station-trail"]')).toHaveCount(0);
  });

  test('leaving Potion Lab returns to the map', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await waitForScene(page, 'PotionScene');
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('PotionScene');
  });
});

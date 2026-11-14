import { test, expect } from '@playwright/test';
import {
  getActiveScenes,
  getBuildingHit,
  getStableBox,
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

  test('real tap opens the Science World picker with Potion Lab and Sink or Float cards (no empty card), and close returns to the map', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');

    const potion = page.locator('[data-testid="game-picker-potion-lab"]');
    const sink = page.locator('[data-testid="game-picker-sink-or-float"]');
    await potion.waitFor({ state: 'visible', timeout: 10_000 });
    await sink.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="game-picker-empty"]')).toHaveCount(0);
    await expect(page.getByText('עולם המדע').first()).toBeVisible();
    await expect(potion).toContainText('מעבדת השיקויים');
    await expect(sink).toContainText('צף או שוקע?');

    for (const testId of ['game-picker-potion-lab', 'game-picker-sink-or-float'] as const) {
      const cardBox = await getStableBox(page, testId);
      expect(cardBox.width).toBeGreaterThanOrEqual(MIN_TAP);
      expect(cardBox.height).toBeGreaterThanOrEqual(MIN_TAP);
    }

    const close = await getStableBox(page, 'game-picker-close');
    expect(close.width).toBeGreaterThanOrEqual(MIN_TAP);
    expect(close.height).toBeGreaterThanOrEqual(MIN_TAP);
    await tapTestId(page, 'game-picker-close');
    await expect(potion).toBeHidden();
    await expect(sink).toBeHidden();
    expect(await getActiveScenes(page)).toContain('MapScene');
  });

  test('real tap on the Potion Lab card opens PotionScene', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-potion-lab');
    await waitForScene(page, 'PotionScene');
    // Regression: the press on the card must not also tap the map building under it (Number Garden in portrait).
    await page.waitForTimeout(600);
    expect(await getActiveScenes(page)).toEqual(['PotionScene']);
    await expect(page.locator('[data-testid="game-picker-potion-lab"]')).toHaveCount(0);
  });

  test('real tap on the Sink or Float card opens SinkFloatScene', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-sink-or-float');
    await waitForScene(page, 'SinkFloatScene');
    // Regression: the press on the card must not also tap the map building under it (Number Garden in portrait).
    await page.waitForTimeout(600);
    expect(await getActiveScenes(page)).toEqual(['SinkFloatScene']);
    await expect(page.locator('[data-testid="game-picker-sink-or-float"]')).toHaveCount(0);
  });
});

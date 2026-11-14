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
// After Sink or Float and Magic Magnet landed, Science World has 3 games, so the station trail opens (AC-10).

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

  test('real tap opens the Science World trail with Potion Lab, Sink or Float and Magic Magnet cards (no empty card), and close returns to the map', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');

    const potion = page.locator('[data-testid="game-picker-potion-lab"]');
    const sink = page.locator('[data-testid="game-picker-sink-or-float"]');
    const magnet = page.locator('[data-testid="game-picker-magic-magnet"]');
    await potion.waitFor({ state: 'visible', timeout: 10_000 });
    await sink.waitFor({ state: 'visible', timeout: 10_000 });
    await magnet.waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    await expect(page.locator('[data-testid="station-trail"] .picker-card')).toHaveCount(3);
    await expect(page.locator('[data-testid="game-picker-empty"]')).toHaveCount(0);
    await expect(page.getByText('עולם המדע').first()).toBeVisible();
    await expect(potion).toContainText('מעבדת השיקויים');
    await expect(sink).toContainText('צף או שוקע?');
    await expect(magnet).toContainText('המגנט הקסום');

    for (const testId of ['game-picker-potion-lab', 'game-picker-sink-or-float', 'game-picker-magic-magnet', 'game-picker-close'] as const) {
      const box = await getStableBox(page, testId);
      expect(box.width, `${testId} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height, `${testId} height`).toBeGreaterThanOrEqual(MIN_TAP);
    }

    await tapTestId(page, 'game-picker-close');
    await expect(potion).toBeHidden();
    await expect(sink).toBeHidden();
    await expect(magnet).toBeHidden();
    expect(await getActiveScenes(page)).toContain('MapScene');
  });

  test('real tap on the Potion Lab card opens PotionScene', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-potion-lab');
    await waitForScene(page, 'PotionScene');
    // Regression: nothing else is tapped through to the map under the building (portrait: another building sits below it).
    await page.waitForTimeout(600);
    expect(await getActiveScenes(page)).toEqual(['PotionScene']);
    await expect(page.locator('[data-testid="game-picker-potion-lab"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="game-picker-empty"]')).toHaveCount(0);
  });

  test('leaving Potion Lab returns to the map', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-potion-lab');
    await waitForScene(page, 'PotionScene');
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('PotionScene');
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

  test('real tap on the Magic Magnet card opens MagnetScene', async ({ page }) => {
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-magic-magnet');
    await waitForScene(page, 'MagnetScene');
    // Regression: the press on the card must not also tap the map building under it (Number Garden in portrait).
    await page.waitForTimeout(600);
    expect(await getActiveScenes(page)).toEqual(['MagnetScene']);
    await expect(page.locator('[data-testid="game-picker-magic-magnet"]')).toHaveCount(0);
  });
});

import { test, expect, type Page } from '@playwright/test';
import {
  clickGame,
  enterWorldByTap,
  getActiveScenes,
  getOrchestraInfo,
  getStableBox,
  tapTestId,
  tapWorldBuilding,
  waitForOrchestraEcho,
  waitForScene,
  type PageRect,
} from './helpers/journey';

// Language House game picker (spec: kitchen-orchestra AC-16..AC-19, journey AC-01).
// Both Playwright projects (1280x800 and 800x1280) run every test in this file, so each AC is checked in both orientations.

const MIN_TAP = 64;
const CARD_IDS = ['game-picker-animal-restaurant', 'game-picker-kitchen-orchestra'] as const;

function expectKnownViewport(page: Page): { landscape: boolean } {
  const vp = page.viewportSize();
  expect(vp).not.toBeNull();
  const { width, height } = vp!;
  expect([`${width}x${height}`]).toEqual([expect.stringMatching(/^(1280x800|800x1280)$/)]);
  return { landscape: width > height };
}

async function openPicker(page: Page): Promise<void> {
  await tapWorldBuilding(page, 'profile-a', 'language-house');
  await page.locator('[data-testid="game-picker-animal-restaurant"]').waitFor({ state: 'visible', timeout: 10_000 });
}

test.describe('language house game picker', () => {
  test('[AC-16] real tap on the Language House building opens the picker with two big cards and a close button', async ({ page }) => {
    const { landscape } = expectKnownViewport(page);
    await openPicker(page);

    const vp = page.viewportSize()!;
    const boxes: Record<string, PageRect> = {};
    for (const id of [...CARD_IDS, 'game-picker-close']) {
      const box = await getStableBox(page, id);
      boxes[id] = box;
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.x, `${id} inside viewport (left)`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${id} inside viewport (top)`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} inside viewport (right)`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box.y + box.height, `${id} inside viewport (bottom)`).toBeLessThanOrEqual(vp.height + 0.5);
    }

    // The picker is RTL DOM chrome; the restaurant card comes first: right in landscape, top in portrait.
    const rtl = await page.locator('[data-testid="game-picker-animal-restaurant"]').evaluate((el) => el.closest('[dir="rtl"]') !== null);
    expect(rtl).toBe(true);
    const restaurant = boxes['game-picker-animal-restaurant'];
    const orchestra = boxes['game-picker-kitchen-orchestra'];
    if (landscape) expect(restaurant.x).toBeGreaterThan(orchestra.x);
    else expect(restaurant.y).toBeLessThan(orchestra.y);

    // Cards do not overlap each other or the close button.
    const overlaps = (a: PageRect, b: PageRect) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    expect(overlaps(restaurant, orchestra)).toBe(false);
    expect(overlaps(restaurant, boxes['game-picker-close'])).toBe(false);
    expect(overlaps(orchestra, boxes['game-picker-close'])).toBe(false);

    // No game was opened by the building tap.
    const scenes = await getActiveScenes(page);
    expect(scenes).not.toContain('RestaurantScene');
    expect(scenes).not.toContain('OrchestraScene');
  });

  test('[AC-17] real tap on the restaurant card opens Animal Restaurant', async ({ page }) => {
    expectKnownViewport(page);
    await openPicker(page);
    await tapTestId(page, 'game-picker-animal-restaurant');
    await waitForScene(page, 'RestaurantScene');
    const scenes = await getActiveScenes(page);
    expect(scenes).not.toContain('OrchestraScene');
    await expect(page.locator('[data-testid="game-picker-animal-restaurant"]')).toHaveCount(0);
  });

  test('[AC-18] real tap on the orchestra card opens Kitchen Orchestra', async ({ page }) => {
    expectKnownViewport(page);
    await openPicker(page);
    await tapTestId(page, 'game-picker-kitchen-orchestra');
    await waitForScene(page, 'OrchestraScene');
    const scenes = await getActiveScenes(page);
    expect(scenes).not.toContain('RestaurantScene');
    await expect(page.locator('[data-testid="game-picker-kitchen-orchestra"]')).toHaveCount(0);
    await expect.poll(async () => (await getOrchestraInfo(page)) !== null, { timeout: 15_000 }).toBe(true);
  });

  test('[AC-19] real tap on close returns to the map without opening a game', async ({ page }) => {
    expectKnownViewport(page);
    await openPicker(page);
    await tapTestId(page, 'game-picker-close');
    await expect(page.locator('[data-testid="game-picker-close"]')).toHaveCount(0);
    await waitForScene(page, 'MapScene');
    const scenes = await getActiveScenes(page);
    expect(scenes).not.toContain('RestaurantScene');
    expect(scenes).not.toContain('OrchestraScene');
  });
});

test.describe('kitchen orchestra: map journey', () => {
  test('[AC-01] real-tap journey: profile -> Language House -> picker -> Kitchen Orchestra -> one 3-trial round -> back to the map', async ({ page }) => {
    test.setTimeout(90_000);
    await enterWorldByTap(page, 'profile-a', 'language-house', 'kitchen-orchestra');
    expect(await getActiveScenes(page)).toContain('OrchestraScene');
    expect(await getActiveScenes(page)).not.toContain('MapScene');

    for (let trial = 1; trial <= 3; trial++) {
      await expect(page.locator('[data-testid="star-count"]')).toHaveText(new RegExp(`⭐ ${trial - 1}$`));
      const info = await waitForOrchestraEcho(page);
      expect(info.sequence.length).toBeGreaterThan(0);
      for (const id of info.sequence) {
        const center = info.instrumentCenters.find((c) => c.id === id);
        expect(center, `utensil ${id} on stage`).toBeDefined();
        await clickGame(page, center!.x, center!.y); // real click on the utensil
      }
      await expect(page.locator('[data-testid="star-count"]')).toHaveText(new RegExp(`⭐ ${trial}$`), { timeout: 10_000 });
    }

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('OrchestraScene');
  });
});

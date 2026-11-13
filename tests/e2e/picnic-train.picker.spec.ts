// Picnic Train Pass 1, TDD step 1: the Number Garden game picker (AC-16), in both orientations.
// The building tap opens a picker with a Sorting Beds card and a Picnic Train card; both are real taps.
import { test, expect, type Page } from '@playwright/test';
import { getActiveScenes, getStableBox, tapTestId, tapWorldBuilding, waitForScene, type PageRect } from './helpers/journey';

const MIN_TAP = 64;
const CARD_IDS = ['game-picker-sorting-beds', 'game-picker-picnic-train'] as const;

async function openPicker(page: Page): Promise<void> {
  await tapWorldBuilding(page, 'profile-a', 'number-garden');
  await page.locator('[data-testid="game-picker-sorting-beds"]').waitFor({ state: 'visible', timeout: 10_000 });
}

const overlaps = (a: PageRect, b: PageRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

test.describe('number garden game picker', () => {
  test('[AC-16] the Number Garden building opens a picker with two big cards and a close button, inside the screen and RTL', async ({ page }) => {
    await openPicker(page);
    const vp = page.viewportSize()!;
    const landscape = vp.width > vp.height;
    const boxes: Record<string, PageRect> = {};
    for (const id of [...CARD_IDS, 'game-picker-close']) {
      const box = await getStableBox(page, id);
      boxes[id] = box;
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.x, `${id} left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${id} top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
    }
    const rtl = await page.locator('[data-testid="game-picker-sorting-beds"]').evaluate((el) => el.closest('[dir="rtl"]') !== null);
    expect(rtl).toBe(true);
    // Sorting Beds comes first: right in landscape, top in portrait (RTL order).
    const sorting = boxes['game-picker-sorting-beds'];
    const picnic = boxes['game-picker-picnic-train'];
    if (landscape) expect(sorting.x).toBeGreaterThan(picnic.x);
    else expect(sorting.y).toBeLessThan(picnic.y);
    expect(overlaps(sorting, picnic)).toBe(false);
    expect(overlaps(sorting, boxes['game-picker-close'])).toBe(false);
    expect(overlaps(picnic, boxes['game-picker-close'])).toBe(false);
    // The picker titles itself with the Number Garden name, not the Language House one.
    await expect(page.locator('.picker-title')).toHaveText('גן המספרים');
  });

  test('[AC-16] the close button returns to the map without starting a game', async ({ page }) => {
    await openPicker(page);
    await tapTestId(page, 'game-picker-close');
    await expect(page.locator('[data-testid="game-picker-sorting-beds"]')).toHaveCount(0);
    expect(await getActiveScenes(page)).toContain('MapScene');
    expect(await getActiveScenes(page)).not.toContain('SortingScene');
    expect(await getActiveScenes(page)).not.toContain('PicnicScene');
  });

  test('[AC-16] the Sorting Beds card opens Sorting Beds', async ({ page }) => {
    await openPicker(page);
    await tapTestId(page, 'game-picker-sorting-beds');
    await waitForScene(page, 'SortingScene');
    expect(await getActiveScenes(page)).not.toContain('PicnicScene');
  });

  test('[AC-16] the Picnic Train card opens Picnic Train', async ({ page }) => {
    await openPicker(page);
    await tapTestId(page, 'game-picker-picnic-train');
    await waitForScene(page, 'PicnicScene');
    expect(await getActiveScenes(page)).not.toContain('SortingScene');
  });
});

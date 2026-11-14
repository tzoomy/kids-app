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
import { stationsForWorld } from './helpers/worldStations';

// Language House game picker (spec: kitchen-orchestra AC-16..AC-19, journey AC-01).
// Both Playwright projects (1280x800 and 800x1280) run every test in this file, so each AC is checked in both orientations.

const MIN_TAP = 64;
const CARD_IDS = stationsForWorld('language-house').map((g) => g.testId);
const IMG_CARD_IDS = CARD_IDS.filter((id) => id === 'game-picker-animal-restaurant' || id === 'game-picker-kitchen-orchestra');

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
  test('[AC-16] real tap on the Language House building opens the picker with big cards and a close button', async ({ page }) => {
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

    // The picker is RTL DOM chrome; the restaurant card comes first: right-to-left in landscape, top-to-bottom in portrait.
    const rtl = await page.locator('[data-testid="game-picker-animal-restaurant"]').evaluate((el) => el.closest('[dir="rtl"]') !== null);
    expect(rtl).toBe(true);
    const restaurant = boxes['game-picker-animal-restaurant'];
    if (landscape) {
      for (let i = 0; i < CARD_IDS.length - 1; i++) {
        expect(boxes[CARD_IDS[i]].x, `${CARD_IDS[i]} should sit to the right of ${CARD_IDS[i + 1]}`).toBeGreaterThan(boxes[CARD_IDS[i + 1]].x);
      }
    } else {
      for (let i = 0; i < CARD_IDS.length - 1; i++) {
        expect(boxes[CARD_IDS[i]].y, `${CARD_IDS[i]} should sit above ${CARD_IDS[i + 1]}`).toBeLessThan(boxes[CARD_IDS[i + 1]].y);
      }
    }

    // Cards do not overlap each other or the close button.
    const overlaps = (a: PageRect, b: PageRect) =>
      a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
    const allItems = [...CARD_IDS, 'game-picker-close'] as const;
    for (let i = 0; i < allItems.length; i++) {
      for (let j = i + 1; j < allItems.length; j++) {
        expect(overlaps(boxes[allItems[i]], boxes[allItems[j]]), `${allItems[i]} overlaps ${allItems[j]}`).toBe(false);
      }
    }

    // Each card (the whole button) is exactly 4:5, like the 640x800 art, and the art fills it: no letterbox gaps.
    const BORDER = 6;
    for (const id of CARD_IDS) {
      const card = boxes[id];
      expect(Math.abs(card.width / card.height - 0.8), `${id} aspect ${card.width}x${card.height}`).toBeLessThanOrEqual(0.02);
      const art = page.locator(`[data-testid="${id}"] .picker-card-art`);
      const artBox = (await art.boundingBox())!;
      const parts: Array<readonly [string, PageRect]> = [['art box', artBox]];
      if ((IMG_CARD_IDS as readonly string[]).includes(id)) {
        const imgBox = (await page.locator(`[data-testid="${id}"] .picker-card-art img`).boundingBox())!;
        parts.push(['img', imgBox]);
      }
      for (const [name, inner] of parts) {
        const tol = BORDER + 2;
        expect(Math.abs(inner.x - card.x), `${id} ${name} left gap`).toBeLessThanOrEqual(tol);
        expect(Math.abs(inner.y - card.y), `${id} ${name} top gap`).toBeLessThanOrEqual(tol);
        expect(Math.abs(card.x + card.width - (inner.x + inner.width)), `${id} ${name} right gap`).toBeLessThanOrEqual(tol);
        expect(Math.abs(card.y + card.height - (inner.y + inner.height)), `${id} ${name} bottom gap`).toBeLessThanOrEqual(tol);
      }
    }
    // All cards have the same size.
    for (const id of CARD_IDS.slice(1)) {
      expect(Math.abs(restaurant.width - boxes[id].width), `${id} width matches restaurant`).toBeLessThanOrEqual(1);
      expect(Math.abs(restaurant.height - boxes[id].height), `${id} height matches restaurant`).toBeLessThanOrEqual(1);
    }

    // No game was opened by the building tap.
    const scenes = await getActiveScenes(page);
    expect(scenes).not.toContain('RestaurantScene');
    expect(scenes).not.toContain('OrchestraScene');
    expect(scenes).not.toContain('LetterMonsterScene');
    expect(scenes).not.toContain('SuitcaseScene');
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
  test('[AC-01] the game opens only from the Language House building: no other building opens it or the picker', async ({ page }) => {
    test.setTimeout(90_000);
    // Real taps on every other building, each from a fresh map. Art Studio is locked (toast only).
    // Number Garden and Nature Lab open their own station-trail pickers (2 games each), and Leisure Corner opens its picker
    // only when the leisure balance is above 0, so those three may leave the map; whatever they do, they must never open
    // Kitchen Orchestra, Animal Restaurant or the picker.
    for (const worldId of ['art-studio', 'number-garden', 'nature-lab', 'leisure-corner']) {
      await tapWorldBuilding(page, 'profile-a', worldId);
      await page.waitForTimeout(1500); // let any (wrongly) triggered scene transition finish
      const scenes = await getActiveScenes(page);
      expect(scenes, `${worldId} must not open Kitchen Orchestra`).not.toContain('OrchestraScene');
      expect(scenes, `${worldId} must not open Animal Restaurant`).not.toContain('RestaurantScene');
      await expect(page.locator('[data-testid="game-picker-kitchen-orchestra"]'), `${worldId} must not open the picker`).toHaveCount(0);
      if (worldId === 'art-studio') expect(scenes, `${worldId} stays on the map`).toContain('MapScene');
    }

    // Only the Language House building opens the picker, and only its card opens the game.
    await tapWorldBuilding(page, 'profile-a', 'language-house');
    await page.locator('[data-testid="game-picker-kitchen-orchestra"]').waitFor({ state: 'visible', timeout: 10_000 });
    expect(await getActiveScenes(page)).not.toContain('OrchestraScene');
    await tapTestId(page, 'game-picker-kitchen-orchestra');
    await waitForScene(page, 'OrchestraScene');
  });

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

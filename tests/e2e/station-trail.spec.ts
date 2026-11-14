import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  getActiveScenes,
  getStableBox,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  type PageRect,
  type ProfileTestId,
} from './helpers/journey';
import { PICKER_CLOSE_TEST_ID } from '../../src/ui/picker/pickerModel';
import { stationsForWorld } from './helpers/worldStations';

// Station trail (spec: docs/specs/station-trail.md). Every test enters through the real map building with real taps.
// Hooks only SEED persisted adaptive state (seedRestaurantLevel) or READ state (getActiveScenes, getBuildingHit); no goToScreen.
// profile-a is the age-2 track (restaurant start level 4); profile-b is the age-5 track (restaurant start level 5).
// Seeding restaurant level 8 puts both tracks above their start level, which the spec counts as a completed game.

const LANDSCAPE = 'landscape-1280x800';
const MIN_TAP = 64;
const RESTAURANT = 'game-picker-animal-restaurant';
const ORCHESTRA = 'game-picker-kitchen-orchestra';
const SORTING = 'game-picker-sorting-beds';
const BALLOON = 'game-picker-balloon-pop';
const HIDING = 'game-picker-who-is-hiding';
const SEED = 'game-picker-seed-to-flower';
const HABITAT = 'game-picker-who-lives-here';
const POTION = 'game-picker-potion-lab';
const SINK = 'game-picker-sink-or-float';
const MAGNET = 'game-picker-magic-magnet';
const CLOSE = PICKER_CLOSE_TEST_ID;
const LANGUAGE_HOUSE_STATIONS = stationsForWorld('language-house');
const LANGUAGE_HOUSE_CARD_IDS = LANGUAGE_HOUSE_STATIONS.map((g) => g.testId);

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

/** Seed-only hook, called on the map before the building tap. */
function seedRestaurantCompleted(page: Page): () => Promise<void> {
  return async () => {
    await page.evaluate(() => {
      (window as unknown as { __testHooks__: { seedRestaurantLevel: (l: number) => void } }).__testHooks__.seedRestaurantLevel(8);
    });
  };
}

async function openLanguageHouse(page: Page, profile: ProfileTestId, seed = false): Promise<void> {
  await tapWorldBuilding(page, profile, 'language-house', seed ? { beforeEnter: seedRestaurantCompleted(page) } : undefined);
  await page.locator(`[data-testid="${RESTAURANT}"]`).waitFor({ state: 'visible', timeout: 10_000 });
}

const stars = (page: Page) => page.locator('[data-testid^="station-star-"]');
const pulses = (page: Page) => page.locator('[data-testid^="station-pulse-"]');

test.describe('station trail inside a world', () => {
  test('[AC-01] journey: profile → Language House → trail → a NON-suggested station → its game → exit to the map', async ({ page }) => {
    await openLanguageHouse(page, 'profile-b');
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    // Fresh profile: the first station (restaurant) is suggested, so the orchestra is the non-suggested one.
    await expect(page.locator(`[data-testid="${RESTAURANT}"]`)).toHaveAttribute('data-suggested', 'true');
    await expect(page.locator(`[data-testid="${ORCHESTRA}"]`)).toHaveAttribute('data-suggested', 'false');

    await tapTestId(page, ORCHESTRA);
    await waitForScene(page, 'OrchestraScene');
    expect(await getActiveScenes(page)).toContain('OrchestraScene');

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
  });

  test('[AC-03] a completed game shows its star, other stations and a fresh profile show none @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openLanguageHouse(page, 'profile-b');
    await expect(stars(page)).toHaveCount(0);

    await openLanguageHouse(page, 'profile-b', true);
    await expect(page.locator('[data-testid="station-star-animal-restaurant"]')).toBeVisible();
    await expect(page.locator('[data-testid="station-star-kitchen-orchestra"]')).toHaveCount(0);
    await expect(stars(page)).toHaveCount(1);
  });

  test('[AC-06] exactly one station pulses and it follows the seeded progress @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openLanguageHouse(page, 'profile-b');
    await expect(pulses(page)).toHaveCount(1);
    await expect(page.locator('[data-testid="station-pulse-animal-restaurant"]')).toBeVisible();

    await openLanguageHouse(page, 'profile-b', true);
    await expect(pulses(page)).toHaveCount(1);
    await expect(page.locator('[data-testid="station-pulse-kitchen-orchestra"]')).toBeVisible();
    await expect(page.locator(`[data-testid="${ORCHESTRA}"]`)).toHaveAttribute('data-suggested', 'true');
  });

  test('[AC-08] no locks: every station is enabled and a completed station opens its game @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openLanguageHouse(page, 'profile-b', true);
    for (const id of LANGUAGE_HOUSE_CARD_IDS) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeEnabled();
    }
    await tapTestId(page, RESTAURANT);
    await waitForScene(page, 'RestaurantScene');
  });

  test('[AC-11] Number Garden opens a 2-station trail, and Nature Lab and Science World each open a 3-station trail (one-game direct entry is covered by the AC-10 unit test) @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await tapWorldBuilding(page, 'profile-b', 'number-garden');
    await page.locator(`[data-testid="${SORTING}"]`).waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    await expect(page.locator('[data-testid="station-trail"] .picker-card')).toHaveCount(2);
    await expect(page.locator(`[data-testid="${BALLOON}"]`)).toBeVisible();
    // Fresh profile: the first station is the suggested one, and the picker is the trail (not a plain list).
    await expect(page.locator(`[data-testid="${SORTING}"]`)).toHaveAttribute('data-suggested', 'true');
    expect(await getActiveScenes(page)).toEqual(['MapScene']);
    await tapTestId(page, BALLOON);
    await waitForScene(page, 'BalloonScene');

    await tapWorldBuilding(page, 'profile-b', 'nature-lab');
    await page.locator(`[data-testid="${HIDING}"]`).waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    await expect(page.locator('[data-testid="station-trail"] .picker-card')).toHaveCount(3);
    await expect(page.locator(`[data-testid="${SEED}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${HABITAT}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${HIDING}"]`)).toHaveAttribute('data-suggested', 'true');
    await expect(page.locator(`[data-testid="${HABITAT}"]`)).toHaveAttribute('data-suggested', 'false');
    expect(await getActiveScenes(page)).toEqual(['MapScene']);
    await tapTestId(page, HABITAT);
    await waitForScene(page, 'HabitatScene');

    await tapWorldBuilding(page, 'profile-b', 'science-world');
    await page.locator(`[data-testid="${POTION}"]`).waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    await expect(page.locator('[data-testid="station-trail"] .picker-card')).toHaveCount(3);
    await expect(page.locator(`[data-testid="${SINK}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${MAGNET}"]`)).toBeVisible();
    await expect(page.locator(`[data-testid="${POTION}"]`)).toHaveAttribute('data-suggested', 'true');
    expect(await getActiveScenes(page)).toEqual(['MapScene']);
    await tapTestId(page, MAGNET);
    await waitForScene(page, 'MagnetScene');
  });

  test('[AC-13] both profiles see the trail; progress seeded for the age-2 profile does not show for the age-5 profile @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openLanguageHouse(page, 'profile-a', true);
    await expect(page.locator('[data-testid="station-star-animal-restaurant"]')).toBeVisible();
    await expect(page.locator(`[data-testid="${ORCHESTRA}"]`)).toHaveAttribute('data-suggested', 'true');

    // Same browser storage, other profile: nothing seeded for it, so no star and the first station is suggested.
    await openLanguageHouse(page, 'profile-b');
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    await expect(stars(page)).toHaveCount(0);
    await expect(page.locator(`[data-testid="${RESTAURANT}"]`)).toHaveAttribute('data-suggested', 'true');
  });

  test('[AC-14] smoke: every Language House station (from the registry) and the close button are at least 64 px, inside the viewport and do not overlap, in both orientations', async ({ page }) => {
    await openLanguageHouse(page, 'profile-a');
    const vp = page.viewportSize()!;
    await expect(page.locator('[data-testid="station-trail"]')).toBeVisible();
    expect(LANGUAGE_HOUSE_CARD_IDS.length, 'Language House trail has four stations after Travel Suitcase').toBe(4);
    await expect(page.locator('[data-testid="station-trail"] .picker-card')).toHaveCount(LANGUAGE_HOUSE_CARD_IDS.length);
    for (const id of LANGUAGE_HOUSE_CARD_IDS) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
    const ids = [...LANGUAGE_HOUSE_CARD_IDS, CLOSE];
    const boxes: PageRect[] = [];
    for (const id of ids) {
      const box = await getStableBox(page, id);
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.x, `${id} left`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${id} top`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} right`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box.y + box.height, `${id} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
      boxes.push(box);
    }
    for (let i = 0; i < boxes.length; i++) {
      for (let j = i + 1; j < boxes.length; j++) {
        const a = boxes[i];
        const b = boxes[j];
        const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
        expect(overlap, `${ids[i]} overlaps ${ids[j]}`).toBe(false);
      }
    }
  });

  test('[AC-15] labels name the state; the pulse animates normally and stops under reduced motion @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openLanguageHouse(page, 'profile-b', true);
    await expect(page.locator(`[data-testid="${RESTAURANT}"]`)).toHaveAttribute('aria-label', /הושלם/);
    await expect(page.locator(`[data-testid="${ORCHESTRA}"]`)).toHaveAttribute('aria-label', /מומלץ/);
    const animationName = () =>
      page.locator('[data-testid="station-pulse-kitchen-orchestra"]').evaluate((el) => getComputedStyle(el).animationName);
    expect(await animationName()).not.toBe('none');

    await page.emulateMedia({ reducedMotion: 'reduce' });
    await expect(page.locator('[data-testid="station-pulse-kitchen-orchestra"]')).toBeVisible();
    expect(await animationName()).toBe('none');
  });

  test('[AC-16] the Leisure Corner picker is unchanged: no trail, star or pulse @single-orientation', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await tapWorldBuilding(page, 'profile-b', 'leisure-corner', { timeEarningEnabled: false });
    await page.locator('[data-testid="game-picker-bubbles"]').waitFor({ state: 'visible', timeout: 10_000 });
    await expect(page.locator('[data-testid="station-trail"]')).toHaveCount(0);
    await expect(stars(page)).toHaveCount(0);
    await expect(pulses(page)).toHaveCount(0);
  });
});

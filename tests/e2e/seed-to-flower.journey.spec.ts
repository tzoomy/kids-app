// Seed to Flower (docs/specs/seed-to-flower.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  enterWorldByTap,
  getSeedFlowerInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  seedSeedFlowerLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  waitForSeedFlowerReady,
  type SeedFlowerInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterSeedFlower(page: Page, profile: 'profile-a' | 'profile-b', level?: number): Promise<SeedFlowerInfo> {
  await enterWorldByTap(page, profile, 'nature-lab', 'seed-to-flower', {
    beforeEnter: level === undefined ? undefined : () => seedSeedFlowerLevel(page, level),
  });
  return waitForSeedFlowerReady(page);
}

/** Polls until the plant state satisfies `check`. */
async function waitForPlant(page: Page, check: (info: SeedFlowerInfo) => boolean, what: string, timeout = 10_000): Promise<SeedFlowerInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getSeedFlowerInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Taps the tool the plant needs next (water, then sun in ordered mode; water in free mode) and waits for the result. */
async function growOneStep(page: Page): Promise<SeedFlowerInfo> {
  let info = await waitForSeedFlowerReady(page);
  const startIndex = info.stageIndex;
  if (info.mode === 'water-then-sun') {
    if (!info.watered) {
      await tapRect(page, info.water);
      info = await waitForPlant(page, (i) => i.watered, 'water was not accepted');
    }
    await tapRect(page, info.sun);
  } else {
    await tapRect(page, info.water);
  }
  return waitForPlant(page, (i) => i.stageIndex > startIndex || i.plantsBloomed > info.plantsBloomed, 'the plant did not grow');
}

test.describe('seed to flower', () => {
  test('[AC-01] [AC-10] full real-tap journey: Nature Lab picker → grow a flower → back to the map; the picker still opens Who\'s Hiding?', async ({ page }) => {
    test.setTimeout(90_000);
    await tapWorldBuilding(page, 'profile-b', 'nature-lab');
    await tapTestId(page, 'game-picker-seed-to-flower');
    await waitForScene(page, 'SeedFlowerScene');
    const info = await waitForSeedFlowerReady(page);
    for (const rect of [info.water, info.sun]) {
      expect(rect.width).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.height).toBeGreaterThanOrEqual(MIN_HIT_PX);
    }
    const starsBefore = await readStarCount(page);
    let state = info;
    for (let i = 0; i < 10 && state.plantsBloomed === 0 && !state.bloomed; i++) {
      state = await growOneStep(page);
    }
    expect(state.bloomed || state.plantsBloomed > 0).toBe(true);
    await expect.poll(() => readStarCount(page)).toBe(starsBefore + 1);

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');

    await tapWorldBuilding(page, 'profile-b', 'nature-lab');
    await tapTestId(page, 'game-picker-who-is-hiding');
    await waitForScene(page, 'HidingScene');
  });

  test('[AC-03] @single-orientation age 2 free touch: the sun first grows the plant, one stage per tap', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSeedFlower(page, 'profile-a');
    expect(info.level).toBe(2);
    expect(info.mode).toBe('free');
    expect(info.stage).toBe('seed');
    await tapRect(page, info.sun);
    const after = await waitForPlant(page, (i) => i.stageIndex === 1, 'sun did not grow the plant');
    expect(after.stage).toBe('sprout');
    expect(after.lastEvent).toBe('grew');
  });

  test('[AC-04] [AC-08] @single-orientation age 5 order: sun before water nudges without growing or costing anything; water then sun grows and names the stage', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSeedFlower(page, 'profile-b', 4);
    expect(info.level).toBe(4);
    expect(info.mode).toBe('water-then-sun');
    const stars = await readStarCount(page);
    const balance = await readBalanceSec(page);
    const spokenBefore = (await getSpokenLines(page)).length;

    await tapRect(page, info.sun);
    const nudged = await waitForPlant(page, (i) => i.lastEvent === 'needs-water', 'no needs-water nudge');
    expect(nudged.stageIndex).toBe(0);
    await expect
      .poll(async () => (await getSpokenLines(page, spokenBefore)).some((l) => l.lineId === 'seed.needWater.he' && l.lang === 'he'))
      .toBe(true);
    expect(await readStarCount(page)).toBe(stars);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance);

    await tapRect(page, info.water);
    await waitForPlant(page, (i) => i.watered && i.lastEvent === 'watered', 'water not accepted');
    await tapRect(page, info.sun);
    const grown = await waitForPlant(page, (i) => i.stageIndex === 1, 'water then sun did not grow the plant');
    // The seed is named when the plant starts on a naming level (review fix on #65).
    await expect
      .poll(async () => (await getSpokenLines(page)).some((l) => l.lineId === `seed.stage.seed.${grown.language}` && l.lang === grown.language))
      .toBe(true);
    expect(grown.stage).toBe('sprout');
    const lang = grown.language;
    await expect
      .poll(async () => (await getSpokenLines(page, spokenBefore)).some((l) => l.lineId === `seed.stage.sprout.${lang}` && l.lang === lang))
      .toBe(true);
  });

  test('[AC-09] @single-orientation a bloom adds one star and a new seed starts', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterSeedFlower(page, 'profile-a');
    const stars = await readStarCount(page);
    let state = await growOneStep(page);
    while (!state.bloomed && state.plantsBloomed === 0) state = await growOneStep(page);
    await expect.poll(() => readStarCount(page)).toBe(stars + 1);
    const next = await waitForPlant(page, (i) => i.plantsBloomed === 1 && i.stage === 'seed' && i.ready, 'no new seed after the bloom', 15_000);
    expect(next.stageIndex).toBe(0);
  });

  test('[AC-03] @single-orientation regression (#65 review): rapid free-mode taps never leave a tween on a destroyed plant', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    const info = await enterSeedFlower(page, 'profile-a');
    // Three taps well inside the 380 ms growth tween: each new stage replaces a plant that is still growing.
    for (let i = 0; i < 3; i++) await tapRect(page, i % 2 === 0 ? info.water : info.sun);
    await waitForPlant(page, (i) => i.bloomed || i.plantsBloomed > 0, 'rapid taps did not reach the flower');
    await waitForPlant(page, (i) => i.plantsBloomed === 1 && i.ready, 'no new seed after the rapid bloom', 15_000);
    expect(errors).toEqual([]);
  });
});

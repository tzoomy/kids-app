// Magic Magnet (docs/specs/magic-magnet.md), Pass 1. Real taps and drags only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  dragMagnetTo,
  enterWorldByTap,
  getActiveScenes,
  getBuildingHit,
  getMagnetInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  seedMagnetLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForMagnetReady,
  waitForScene,
  waitForSpokenLine,
  type MagnetInfo,
  type PageRect,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterMagicMagnet(page: Page, profile: 'profile-a' | 'profile-b', level?: number): Promise<MagnetInfo> {
  await enterWorldByTap(page, profile, 'science-world', 'magic-magnet', {
    beforeEnter: level === undefined ? undefined : () => seedMagnetLevel(page, level),
  });
  return waitForMagnetReady(page);
}

/** Polls until Magic Magnet state satisfies `check`. */
async function waitForMagnet(
  page: Page,
  check: (info: MagnetInfo) => boolean,
  what: string,
  timeout = 10_000,
): Promise<MagnetInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getMagnetInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Re-enters Magic Magnet from an already-open MapScene without reloading the page. */
async function reenterMagicMagnetFromMap(page: Page): Promise<MagnetInfo> {
  await waitForScene(page, 'MapScene');
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  const deadline = Date.now() + 15_000;
  for (;;) {
    const current = await getBuildingHit(page, 'science-world');
    const settled =
      current !== null && previous !== null && current.width > 0 && Math.abs(current.width - previous.width) < 0.5;
    previous = current;
    rect = current;
    if (settled) break;
    if (Date.now() > deadline) throw new Error('Science World building hit rectangle never settled');
    await page.waitForTimeout(100);
  }
  const fresh = (await getBuildingHit(page, 'science-world')) ?? rect;
  if (!fresh) throw new Error('Science World building has no hit rectangle');
  await page.mouse.click(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  await tapTestId(page, 'game-picker-magic-magnet');
  await waitForScene(page, 'MagnetScene');
  return waitForMagnetReady(page);
}

function assertTargetsOnScreen(page: Page, info: MagnetInfo): void {
  const vp = page.viewportSize()!;
  const targets = [
    info.magnet,
    ...info.objects.map((o) => o.rect),
    ...(info.buttons ? [info.buttons.sticks, info.buttons.notSticks] : []),
  ];
  for (const rect of targets) {
    expect(rect.width).toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(rect.height).toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(rect.x).toBeGreaterThanOrEqual(0);
    expect(rect.y).toBeGreaterThanOrEqual(0);
    expect(rect.x + rect.width).toBeLessThanOrEqual(vp.width + 0.5);
    expect(rect.y + rect.height).toBeLessThanOrEqual(vp.height + 0.5);
  }
}

test.describe('magic magnet', () => {
  test('[AC-01] full real-input journey: profile -> Science World -> picker card -> drag magnet onto metal object -> back to the map', async ({ page }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-magic-magnet');
    await waitForScene(page, 'MagnetScene');
    const info = await waitForMagnetReady(page);

    const metal = info.objects.find((o) => o.metal);
    expect(metal).toBeDefined();
    await dragMagnetTo(page, info, metal!.rect.x + metal!.rect.width / 2, metal!.rect.y + metal!.rect.height / 2);
    await waitForMagnet(
      page,
      (i) => i.objects.some((o) => o.id === metal!.id && o.stuck),
      'metal object did not stick to magnet',
    );

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('MagnetScene');
  });

  test('[AC-04] free mode intro (age 2): plays magnet.intro.free.he on enter and again after re-entering from the map', async ({ page }) => {
    test.setTimeout(60_000);
    const info = await enterMagicMagnet(page, 'profile-a');
    expect(info.mode).toBe('free');

    const intro = await waitForSpokenLine(page, (l) => l.lineId === 'magnet.intro.free.he' && l.lang === 'he');
    expect((await getSpokenLines(page)).filter((l) => l.lineId === 'magnet.intro.free.he')).toHaveLength(1);

    const afterFirstVisit = (await getSpokenLines(page)).at(-1)?.index ?? intro.index;
    await tapTestId(page, 'hud-back');
    await reenterMagicMagnetFromMap(page);
    await waitForSpokenLine(
      page,
      (l) => l.lineId === 'magnet.intro.free.he' && l.lang === 'he',
      10_000,
      afterFirstVisit + 1,
    );
    expect((await getSpokenLines(page)).filter((l) => l.lineId === 'magnet.intro.free.he')).toHaveLength(2);
  });

  test('[AC-05] predict mode intro (age 5, L2): plays magnet.intro.predict.he and the first target ask lines in order before any touch', async ({ page }) => {
    const info = await enterMagicMagnet(page, 'profile-b', 2);
    expect(info.mode).toBe('predict');
    expect(info.phase).toBe('predicting');
    expect(info.target).not.toBeNull();
    const targetId = info.target!;

    const intro = await waitForSpokenLine(page, (l) => l.lineId === 'magnet.intro.predict.he' && l.lang === 'he');
    const ask = await waitForSpokenLine(
      page,
      (l) => l.lineId === `magnet.ask.${targetId}.he` && l.lang === 'he',
      10_000,
      intro.index + 1,
    );
    const word = await waitForSpokenLine(
      page,
      (l) => l.lineId === `magnet.word.${targetId}.${info.language}` && l.lang === info.language,
      10_000,
      ask.index + 1,
    );
    expect(intro.index).toBeLessThan(ask.index);
    expect(ask.index).toBeLessThan(word.index);
  });

  test('[AC-04] @single-orientation free mode (age 2): every touched object is named in Hebrew and the learning language with sticks/notSticks', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterMagicMagnet(page, 'profile-a');
    expect(info.level).toBe(1);
    expect(info.mode).toBe('free');

    const nonMetal = info.objects.find((o) => !o.metal)!;
    const metal = info.objects.find((o) => o.metal)!;

    const beforeNonMetal = (await getSpokenLines(page)).length;
    await dragMagnetTo(
      page,
      info,
      nonMetal.rect.x + nonMetal.rect.width / 2,
      nonMetal.rect.y + nonMetal.rect.height / 2,
    );
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, beforeNonMetal);
          return (
            lines.some((l) => l.lineId === `magnet.react.${nonMetal.id}.he` && l.lang === 'he') &&
            lines.some((l) => l.lineId === `magnet.word.${nonMetal.id}.${info.language}` && l.lang === info.language) &&
            lines.some((l) => l.lineId === `magnet.notSticks.${info.language}` && l.lang === info.language)
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const fresh = await waitForMagnetReady(page);
    const beforeMetal = (await getSpokenLines(page)).length;
    const freshMetal = fresh.objects.find((o) => o.id === metal.id)!;
    await dragMagnetTo(
      page,
      fresh,
      freshMetal.rect.x + freshMetal.rect.width / 2,
      freshMetal.rect.y + freshMetal.rect.height / 2,
    );
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, beforeMetal);
          return (
            lines.some((l) => l.lineId === `magnet.react.${metal.id}.he` && l.lang === 'he') &&
            lines.some((l) => l.lineId === `magnet.word.${metal.id}.${fresh.language}` && l.lang === fresh.language) &&
            lines.some((l) => l.lineId === `magnet.sticks.${fresh.language}` && l.lang === fresh.language)
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('[AC-05] @single-orientation predict mode (age 5): right and wrong predictions are both named and praised, never drop stars or balance, and give a star after the round', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    let info = await enterMagicMagnet(page, 'profile-b', 2);
    expect(info.level).toBe(2);
    expect(info.mode).toBe('predict');
    expect(info.phase).toBe('predicting');
    expect(info.buttons).not.toBeNull();

    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);
    const totalObjects = info.objects.length;

    for (let step = 0; step < totalObjects; step++) {
      const targetId = info.target!;
      const targetObj = info.objects.find((o) => o.id === targetId)!;
      // Step 0: right prediction; Step 1: wrong prediction; remaining: right predictions.
      const predictSticks = step === 1 ? !targetObj.metal : targetObj.metal;
      const btnRect = predictSticks ? info.buttons!.sticks : info.buttons!.notSticks;
      await tapRect(page, btnRect);

      const testingInfo = await waitForMagnet(
        page,
        (i) => i.phase === 'testing' && i.ready && i.target === targetId,
        `step ${step} did not enter testing phase`,
      );
      const spokenBefore = (await getSpokenLines(page)).length;
      const targetInTest = testingInfo.objects.find((o) => o.id === targetId)!;
      await dragMagnetTo(
        page,
        testingInfo,
        targetInTest.rect.x + targetInTest.rect.width / 2,
        targetInTest.rect.y + targetInTest.rect.height / 2,
      );

      const expectedFeedbackLine = step === 1 ? 'magnet.surprise.he' : 'magnet.right.he';
      await expect
        .poll(
          async () => {
            const lines = await getSpokenLines(page, spokenBefore);
            return (
              lines.some((l) => l.lineId === `magnet.react.${targetId}.he` && l.lang === 'he') &&
              lines.some((l) => l.lineId === expectedFeedbackLine && l.lang === 'he')
            );
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      expect(await readStarCount(page)).toBeGreaterThanOrEqual(starsBefore);
      expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

      if (step < totalObjects - 1) {
        info = await waitForMagnet(
          page,
          (i) => i.phase === 'predicting' && i.ready && i.target !== null && i.target !== targetId,
          `step ${step} did not advance to next prediction`,
          15_000,
        );
      }
    }

    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(starsBefore + 1);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);
  });

  test('[AC-08] @single-orientation tapping an object glides the magnet there and touches it', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterMagicMagnet(page, 'profile-a');
    const metal = info.objects.find((o) => o.metal)!;

    await tapRect(page, metal.rect);
    await waitForMagnet(
      page,
      (i) => i.objects.some((o) => o.id === metal.id && o.stuck),
      'tapping metal object did not glide magnet and stick it',
    );
  });

  test('[AC-09] magnet, object and prediction-button targets are at least 64 CSS px and on screen in both orientations', async ({ page }) => {
    const info = await enterMagicMagnet(page, 'profile-b', 2);
    expect(info.phase).toBe('predicting');
    expect(info.buttons).not.toBeNull();
    assertTargetsOnScreen(page, info);
  });

  test('[AC-09] level 3 (5 objects): magnet, object and prediction-button targets are at least 64 CSS px and on screen in both orientations', async ({ page }) => {
    const info = await enterMagicMagnet(page, 'profile-b', 3);
    expect(info.level).toBe(3);
    expect(info.phase).toBe('predicting');
    expect(info.objects).toHaveLength(5);
    expect(info.buttons).not.toBeNull();
    assertTargetsOnScreen(page, info);
  });
});

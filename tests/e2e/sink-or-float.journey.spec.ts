// Sink or Float (docs/specs/sink-or-float.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import { OBJECT_FLOATS } from '../../src/games/sinkFloat/sinkFloatMachine';
import {
  enterWorldByTap,
  getActiveScenes,
  getBuildingHit,
  getSinkFloatInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  seedSinkFloatLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  waitForSinkFloatReady,
  waitForSpokenLine,
  type PageRect,
  type SinkFloatInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterSinkFloat(
  page: Page,
  profile: 'profile-a' | 'profile-b',
  level?: number,
): Promise<SinkFloatInfo> {
  await enterWorldByTap(page, profile, 'science-world', 'sink-or-float', {
    beforeEnter: level === undefined ? undefined : () => seedSinkFloatLevel(page, level),
  });
  return waitForSinkFloatReady(page);
}

/** Polls until Sink or Float state satisfies `check`. */
async function waitForSinkFloat(
  page: Page,
  check: (info: SinkFloatInfo) => boolean,
  what: string,
  timeout = 12_000,
): Promise<SinkFloatInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getSinkFloatInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Taps a building on an already-active MapScene once its pop-in hit rectangle has settled. */
async function tapMapBuilding(page: Page, worldId: string): Promise<void> {
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  await expect
    .poll(
      async () => {
        const current = await getBuildingHit(page, worldId);
        const settled =
          current !== null && previous !== null && current.width > 0 && Math.abs(current.width - previous.width) < 0.5;
        previous = current;
        rect = current;
        return settled;
      },
      { timeout: 15_000, intervals: [100] },
    )
    .toBe(true);
  const fresh = (await getBuildingHit(page, worldId)) ?? rect;
  if (!fresh) throw new Error(`building "${worldId}" has no hit rectangle`);
  await tapRect(page, fresh);
}

test.describe('sink or float', () => {
  test('[AC-01] full real-tap journey: profile -> Science World -> picker card -> drop one object -> back to the map', async ({
    page,
  }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await tapTestId(page, 'game-picker-sink-or-float');
    await waitForScene(page, 'SinkFloatScene');
    const info = await waitForSinkFloatReady(page);

    const firstId = info.offered[0];
    const rect = info.objects[firstId];
    expect(rect).toBeDefined();
    await tapRect(page, rect!);

    await waitForSinkFloat(
      page,
      (i) => i.phase === 'watching' || i.lastOutcome !== null,
      'dropped object did not enter watching phase',
    );
    await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'choosing' && i.selected === null,
      'object did not settle back to choosing',
      15_000,
    );

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('SinkFloatScene');
  });

  test('[AC-04] @single-orientation free mode (age 2): speaks the free-mode intro line on entry and once more after re-entry from the map', async ({
    page,
  }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterSinkFloat(page, 'profile-a');
    expect(info.level).toBe(1);
    expect(info.mode).toBe('free');

    await waitForSpokenLine(page, (l) => l.lineId === 'sinkFloat.intro.free.he' && l.lang === 'he');
    const firstVisitLines = await getSpokenLines(page);
    expect(firstVisitLines.filter((l) => l.lineId === 'sinkFloat.intro.free.he')).toHaveLength(1);

    const spokenBeforeReentry = firstVisitLines.length;
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');

    await tapMapBuilding(page, 'science-world');
    await tapTestId(page, 'game-picker-sink-or-float');
    await waitForScene(page, 'SinkFloatScene');
    await waitForSinkFloatReady(page);

    await waitForSpokenLine(
      page,
      (l) => l.lineId === 'sinkFloat.intro.free.he' && l.lang === 'he',
      10_000,
      spokenBeforeReentry,
    );
    const reentryLines = await getSpokenLines(page, spokenBeforeReentry);
    expect(reentryLines.filter((l) => l.lineId === 'sinkFloat.intro.free.he')).toHaveLength(1);
  });

  test('[AC-05] @single-orientation predict mode (age 5): speaks the predict-mode intro line on entry before any tap', async ({
    page,
  }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSinkFloat(page, 'profile-b', 2);
    expect(info.level).toBe(2);
    expect(info.mode).toBe('predict');
    expect(info.phase).toBe('choosing');

    await waitForSpokenLine(page, (l) => l.lineId === 'sinkFloat.intro.predict.he' && l.lang === 'he');
    const lines = await getSpokenLines(page);
    expect(lines.filter((l) => l.lineId === 'sinkFloat.intro.predict.he')).toHaveLength(1);
    expect(lines.some((l) => l.lineId === 'sinkFloat.ask.he')).toBe(false);
  });

  test('[AC-04] @single-orientation free mode (age 2): each drop names the outcome in Hebrew and in the learning language', async ({
    page,
  }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSinkFloat(page, 'profile-a');
    expect(info.level).toBe(1);
    expect(info.mode).toBe('free');

    const id = info.offered[0];
    const expectedOutcome = OBJECT_FLOATS[id] ? 'floats' : 'sinks';
    const spokenBefore = (await getSpokenLines(page)).length;

    await tapRect(page, info.objects[id]!);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBefore);
          const hasHe = lines.some((l) => l.lineId === `sinkFloat.result.${id}.he` && l.lang === 'he');
          const hasLearn = lines.some(
            (l) => l.lineId === `sinkFloat.result.${expectedOutcome}.${info.language}` && l.lang === info.language,
          );
          return hasHe && hasLearn;
        },
        { timeout: 12_000 },
      )
      .toBe(true);

    await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'choosing' && i.lastOutcome === expectedOutcome,
      'free drop did not settle',
      15_000,
    );
  });

  test('[AC-05] @single-orientation predict mode (age 5): a right and a wrong prediction both reveal and name the real outcome; a wrong one never reduces stars or the balance', async ({
    page,
  }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterSinkFloat(page, 'profile-b', 2);
    expect(info.level).toBe(2);
    expect(info.mode).toBe('predict');

    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);

    // 1. Wrong prediction
    const id1 = info.offered[0];
    const real1 = OBJECT_FLOATS[id1] ? 'floats' : 'sinks';
    const wrongGuess = real1 === 'floats' ? 'sinks' : 'floats';
    const spoken1 = (await getSpokenLines(page)).length;

    await tapRect(page, info.objects[id1]!);
    const predicting1 = await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'predicting' && i.selected === id1,
      'object tap did not enter predicting phase',
    );
    await tapRect(page, predicting1.buttons[wrongGuess]);

    const afterWrong = await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'choosing' && i.lastCorrect === false && i.lastOutcome === real1,
      'wrong prediction did not reveal and settle',
      15_000,
    );
    expect(await readStarCount(page)).toBeGreaterThanOrEqual(starsBefore);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spoken1);
          return (
            lines.some((l) => l.lineId === 'sinkFloat.letsSee.he' && l.lang === 'he') &&
            lines.some((l) => l.lineId === `sinkFloat.result.${id1}.he` && l.lang === 'he') &&
            lines.some(
              (l) => l.lineId === `sinkFloat.result.${real1}.${predicting1.language}` && l.lang === predicting1.language,
            )
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    // 2. Right prediction
    const id2 = afterWrong.offered[0];
    const real2 = OBJECT_FLOATS[id2] ? 'floats' : 'sinks';
    const spoken2 = (await getSpokenLines(page)).length;

    await tapRect(page, afterWrong.objects[id2]!);
    const predicting2 = await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'predicting' && i.selected === id2,
      'second object tap did not enter predicting phase',
    );
    await tapRect(page, predicting2.buttons[real2]);

    await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'choosing' && i.lastCorrect === true && i.lastOutcome === real2,
      'right prediction did not reveal and settle',
      15_000,
    );

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spoken2);
          return (
            lines.some((l) => l.lineId === `sinkFloat.result.${id2}.he` && l.lang === 'he') &&
            lines.some(
              (l) => l.lineId === `sinkFloat.result.${real2}.${predicting2.language}` && l.lang === predicting2.language,
            )
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('[AC-05] @single-orientation regression: taps before the pop-in finishes are ignored', async ({
    page,
  }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterWorldByTap(page, 'profile-b', 'science-world', 'sink-or-float', {
      beforeEnter: () => seedSinkFloatLevel(page, 2),
    });

    // Wait briefly so object 0 has scaled above 0 (so an unguarded tap would hit it) while
    // the staggered pop-in (~580 ms) is still in progress and ready remains false.
    await page.waitForTimeout(180);
    const beforeTap = await getSinkFloatInfo(page);
    expect(beforeTap).not.toBeNull();
    // On a very slow runner the pop-in can finish before this point; the early tap would then
    // prove nothing, so skip instead of failing or passing vacuously.
    test.skip(beforeTap!.ready, 'pop-in already finished before the early tap (slow runner)');

    const targetId = beforeTap!.offered[0];
    await tapRect(page, beforeTap!.objects[targetId]!);

    const afterEarlyTap = await getSinkFloatInfo(page);
    expect(afterEarlyTap).not.toBeNull();
    expect(afterEarlyTap!.phase).toBe('choosing');
    expect(afterEarlyTap!.selected).toBeNull();

    const readyInfo = await waitForSinkFloatReady(page);
    expect(readyInfo.phase).toBe('choosing');
    await tapRect(page, readyInfo.objects[targetId]!);

    await waitForSinkFloat(
      page,
      (i) => i.phase === 'predicting' && i.selected === targetId,
      'object tap after pop-in did not enter predicting phase',
    );
  });

  test('[AC-05] @single-orientation regression: prediction buttons accept a tap right after choosing', async ({
    page,
  }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSinkFloat(page, 'profile-b', 2);
    const targetId = info.offered[0];
    const guess = OBJECT_FLOATS[targetId] ? 'floats' : 'sinks';
    const objRect = info.objects[targetId]!;
    const btnRect = info.buttons[guess];

    await tapRect(page, objRect);
    // Tap the prediction button immediately with no polling in between: the buttons pulse
    // in place rather than popping in from scale 0, so a fast tap must land.
    await tapRect(page, btnRect);

    await waitForSinkFloat(
      page,
      (i) => i.phase === 'watching' || i.lastOutcome !== null,
      'immediate prediction tap after choosing did not register',
    );
    await waitForSinkFloat(
      page,
      (i) => i.ready && i.phase === 'choosing' && i.lastOutcome === guess && i.lastCorrect === true,
      'immediate prediction did not reveal and settle',
      15_000,
    );
  });

  test('[AC-08] object and prediction-button tap targets and the tank layout area are at least 64 CSS px in both orientations', async ({
    page,
  }) => {
    const info = await enterSinkFloat(page, 'profile-b', 2);
    const vp = page.viewportSize()!;
    const targets = [
      info.tank,
      ...info.offered.map((id) => info.objects[id]!),
      info.buttons.floats,
      info.buttons.sinks,
    ];
    for (const rect of targets) {
      expect(rect.width).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.height).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(vp.height + 0.5);
    }
  });
});

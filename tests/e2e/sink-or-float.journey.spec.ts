// Sink or Float (docs/specs/sink-or-float.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import { OBJECT_FLOATS } from '../../src/games/sinkFloat/sinkFloatMachine';
import {
  enterWorldByTap,
  getActiveScenes,
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

  test('[AC-08] object, tank and prediction-button tap targets are at least 64 CSS px in both orientations', async ({
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

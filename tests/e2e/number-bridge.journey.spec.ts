// Number Bridge (docs/specs/number-bridge.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getBuildingHit,
  getNumberBridgeInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  seedNumberBridgeLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForNumberBridgeReady,
  waitForScene,
  type NumberBridgeInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterNumberBridge(
  page: Page,
  profile: 'profile-a' | 'profile-b',
  level?: number,
): Promise<NumberBridgeInfo> {
  await enterWorldByTap(page, profile, 'number-garden', 'number-bridge', {
    beforeEnter: level === undefined ? undefined : () => seedNumberBridgeLevel(page, level),
  });
  return waitForNumberBridgeReady(page);
}

/** Polls until Number Bridge state satisfies `check`. */
async function waitForBridge(
  page: Page,
  check: (info: NumberBridgeInfo) => boolean,
  what: string,
  timeout = 10_000,
): Promise<NumberBridgeInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getNumberBridgeInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

async function waitForBuildingStable(page: Page, worldId: string): Promise<void> {
  let prevWidth: number | null = null;
  await expect
    .poll(
      async () => {
        const hit = await getBuildingHit(page, worldId);
        const settled = hit !== null && prevWidth !== null && hit.width > 0 && Math.abs(hit.width - prevWidth) < 0.5;
        prevWidth = hit?.width ?? null;
        return settled;
      },
      { timeout: 10_000 },
    )
    .toBe(true);
}

function expectInsideMinTap(rect: { x: number; y: number; width: number; height: number }, vp: { width: number; height: number }): void {
  expect(rect.width).toBeGreaterThanOrEqual(MIN_HIT_PX);
  expect(rect.height).toBeGreaterThanOrEqual(MIN_HIT_PX);
  expect(rect.x).toBeGreaterThanOrEqual(0);
  expect(rect.y).toBeGreaterThanOrEqual(0);
  expect(rect.x + rect.width).toBeLessThanOrEqual(vp.width + 0.5);
  expect(rect.y + rect.height).toBeLessThanOrEqual(vp.height + 0.5);
}

test.describe('number bridge', () => {
  test('[AC-01] full real-tap journey: profile -> Number Garden picker -> Number Bridge -> cross a bridge -> back to map, and picker still opens Sorting Beds', async ({ page }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'number-garden');
    await tapTestId(page, 'game-picker-number-bridge');
    await waitForScene(page, 'NumberBridgeScene');
    let info = await waitForNumberBridgeReady(page);
    const starsBefore = await readStarCount(page);

    expect(info.pile).not.toBeNull();
    while (info.stars === starsBefore) {
      const remainingBefore = info.gaps.length;
      await tapRect(page, info.pile!);
      info = await waitForBridge(
        page,
        (i) => i.ready && (i.stars > starsBefore || i.gaps.length < remainingBefore),
        'pile tap did not advance the bridge',
        15_000,
      );
    }
    expect(info.stars).toBe(starsBefore + 1);

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('NumberBridgeScene');

    // Return to Number Garden picker and verify Sorting Beds still opens.
    await waitForBuildingStable(page, 'number-garden');
    const gardenHit = await getBuildingHit(page, 'number-garden');
    expect(gardenHit).not.toBeNull();
    await tapRect(page, gardenHit!);
    await tapTestId(page, 'game-picker-sorting-beds');
    await waitForScene(page, 'SortingScene');
  });

  test('[AC-04] @single-orientation one-more mode (age 2): filling gaps says One more!, then crossing counts each stone and celebrates in Hebrew', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    let info = await enterNumberBridge(page, 'profile-a', 2);
    expect(info.level).toBe(2);
    expect(info.mode).toBe('one-more');
    expect(info.gaps).toHaveLength(2);
    expect(info.pile).not.toBeNull();

    const seq = [...info.sequence];
    const lang = info.language;
    const starsBefore = await readStarCount(page);
    const spokenBefore = (await getSpokenLines(page)).length;

    await tapRect(page, info.pile!);
    info = await waitForBridge(page, (i) => i.ready && i.gaps.length === 1, 'first pile tap did not place gap 1');
    await tapRect(page, info.pile!);

    await expect.poll(() => readStarCount(page), { timeout: 15_000 }).toBe(starsBefore + 1);
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBefore);
          const hasOneMore = lines.some((l) => l.lineId === `bridge.oneMore.${lang}` && l.lang === lang);
          const hasAllNumbers = seq.every((n) =>
            lines.some((l) => l.lineId === `bridge.number.${n}.${lang}` && l.lang === lang),
          );
          const hasCrossed = lines.some((l) => l.lineId === 'bridge.crossed.he' && l.lang === 'he');
          return hasOneMore && hasAllNumbers && hasCrossed;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await waitForBridge(page, (i) => i.ready && i.stars === starsBefore + 1, 'next bridge did not start after crossing', 15_000);
  });

  test('[AC-05] @single-orientation missing mode (age 5): wrong stone keeps gap, counts up aloud, never lowers stars or balance; right stone earns a star', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterNumberBridge(page, 'profile-b', 3);
    expect(info.level).toBe(3);
    expect(info.mode).toBe('missing');
    expect(info.answer).not.toBeNull();
    expect(info.choices).toHaveLength(3);

    const wrong = info.choices.find((c) => c !== info.answer)!;
    const expectedPrefix = info.sequence.slice(0, info.gaps[0]);
    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);
    const spokenBefore = (await getSpokenLines(page)).length;

    await tapRect(page, info.choiceRects[String(wrong)]);
    const afterMiss = await waitForBridge(
      page,
      (i) => i.ready && i.tries === 1 && i.lastEvent === 'not-this-one',
      'wrong choice did not wobble and recover',
      15_000,
    );
    expect(afterMiss.gaps).toEqual(info.gaps);
    expect(afterMiss.answer).toBe(info.answer);
    expect(await readStarCount(page)).toBe(starsBefore);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBefore);
          const hasNotThis = lines.some((l) => l.lineId === 'bridge.notThis.he' && l.lang === 'he');
          const hasPrefix = expectedPrefix.every((n) =>
            lines.some((l) => l.lineId === `bridge.number.${n}.${info.language}` && l.lang === info.language),
          );
          return hasNotThis && hasPrefix;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await tapRect(page, afterMiss.choiceRects[String(info.answer!)]);
    await expect.poll(() => readStarCount(page), { timeout: 15_000 }).toBe(starsBefore + 1);
    const next = await waitForBridge(
      page,
      (i) => i.ready && i.stars === starsBefore + 1 && i.tries === 0,
      'next bridge did not appear after completing missing stone',
      15_000,
    );
    expect(next.stars).toBe(starsBefore + 1);
  });

  test('[AC-08] pile, gaps and choice stones meet the 64 CSS px tap target floor inside the viewport in both orientations', async ({ page }) => {
    test.setTimeout(60_000);
    const vp = page.viewportSize()!;

    const oneMoreInfo = await enterNumberBridge(page, 'profile-a', 1);
    expect(oneMoreInfo.pile).not.toBeNull();
    expect(oneMoreInfo.gapRects.length).toBeGreaterThanOrEqual(1);
    for (const rect of [oneMoreInfo.pile!, ...oneMoreInfo.gapRects]) {
      expectInsideMinTap(rect, vp);
    }

    const missingInfo = await enterNumberBridge(page, 'profile-b', 3);
    const choiceRects = Object.values(missingInfo.choiceRects);
    expect(choiceRects).toHaveLength(3);
    expect(missingInfo.gapRects.length).toBeGreaterThanOrEqual(1);
    for (const rect of [...choiceRects, ...missingInfo.gapRects]) {
      expectInsideMinTap(rect, vp);
    }
  });
});

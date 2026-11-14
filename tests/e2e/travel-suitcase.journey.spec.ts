// Travel Suitcase (docs/specs/travel-suitcase.md), Pass 1. Real taps and drags only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  dragRectTo,
  enterWorldByTap,
  getActiveScenes,
  getSpokenLines,
  getSuitcaseInfo,
  readBalanceSec,
  readStarCount,
  seedLanguageSetting,
  seedSuitcaseLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  waitForSuitcaseReady,
  type SuitcaseInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterSuitcase(
  page: Page,
  profile: 'profile-a' | 'profile-b',
  level?: number,
): Promise<SuitcaseInfo> {
  await enterWorldByTap(page, profile, 'language-house', 'travel-suitcase', {
    beforeEnter: level === undefined ? undefined : () => seedSuitcaseLevel(page, level),
  });
  return waitForSuitcaseReady(page);
}

/** Polls until Travel Suitcase state satisfies `check`. */
async function waitForSuitcase(
  page: Page,
  check: (info: SuitcaseInfo) => boolean,
  what: string,
  timeout = 10_000,
): Promise<SuitcaseInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getSuitcaseInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

test.describe('travel suitcase', () => {
  test('[AC-01] full real-tap journey: profile -> Language House -> picker card -> pack asked-for item -> back to map', async ({ page }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'language-house');
    await tapTestId(page, 'game-picker-travel-suitcase');
    await waitForScene(page, 'SuitcaseScene');
    const info = await waitForSuitcaseReady(page);

    expect(info.request).toBe('noun');
    const rightId = info.rightIds[0];
    const targetChoice = info.choices.find((c) => c.id === rightId && !c.packed);
    expect(targetChoice).toBeDefined();

    await tapRect(page, targetChoice!.rect);
    await waitForSuitcase(
      page,
      (i) => i.lastEvent === 'packed' || i.packedCount >= 1 || i.requestIndex >= 1,
      'tapping asked-for item did not pack it',
    );

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('SuitcaseScene');
  });

  test('[AC-02] @single-orientation noun request: tapping another item names it and keeps request without dropping stars or balance; tapping right item packs it', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSuitcase(page, 'profile-a');
    expect(info.request).toBe('noun');

    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);
    const rightId = info.rightIds[0];
    const otherChoice = info.choices.find((c) => !info.rightIds.includes(c.id) && !c.packed)!;
    const rightChoice = info.choices.find((c) => c.id === rightId && !c.packed)!;

    const spokenBeforeOther = (await getSpokenLines(page)).length;
    await tapRect(page, otherChoice.rect);
    await waitForSuitcase(
      page,
      (i) => i.lastEvent === 'other',
      'tapping another item did not emit other event',
    );

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeOther);
          return lines.some((l) => l.lineId === `suitcase.other.${otherChoice.id}.${info.language}` && l.lang === info.language);
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const afterOther = await getSuitcaseInfo(page);
    expect(afterOther?.rightIds).toEqual(info.rightIds);
    expect(afterOther?.requestIndex).toBe(info.requestIndex);
    expect(afterOther?.packedCount).toBe(0);
    expect(await readStarCount(page)).toBeGreaterThanOrEqual(starsBefore);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    const spokenBeforeRight = (await getSpokenLines(page)).length;
    await tapRect(page, rightChoice.rect);
    await waitForSuitcase(
      page,
      (i) => i.lastEvent === 'packed' || i.packedCount >= 1 || i.requestIndex >= 1,
      'tapping right item did not pack it',
    );
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeRight);
          return lines.some((l) => l.lineId === `suitcase.name.${rightId}.${info.language}` && l.lang === info.language);
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('[AC-03] @single-orientation two-item request (L3): both targets can be packed in reverse order', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    let info = await enterSuitcase(page, 'profile-b', 3);
    expect(info.level).toBe(3);
    expect(info.request).toBe('two');
    expect(info.rightIds).toHaveLength(2);

    const [secondTarget, firstTarget] = info.rightIds;
    const firstChoice = info.choices.find((c) => c.id === firstTarget && !c.packed)!;
    await tapRect(page, firstChoice.rect);
    await waitForSuitcase(
      page,
      (i) => i.packedCount === 1 && i.rightIds.length === 1 && i.rightIds[0] === secondTarget,
      'packing second target first did not leave only the first target',
    );

    info = (await getSuitcaseInfo(page))!;
    const secondChoice = info.choices.find((c) => c.id === secondTarget && !c.packed)!;
    await tapRect(page, secondChoice.rect);
    await waitForSuitcase(
      page,
      (i) => i.packedCount >= 2 || i.requestIndex === 1,
      'packing remaining target did not complete the two-item request',
    );
  });

  test('[AC-05] @single-orientation completing a full case of 3 requests awards one star', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    let info = await enterSuitcase(page, 'profile-a');
    expect(info.requestsPerCase).toBe(3);
    const starsBefore = await readStarCount(page);

    for (let r = 0; r < info.requestsPerCase; r++) {
      info = await waitForSuitcaseReady(page);
      expect(info.requestIndex).toBe(r);
      const targetId = info.rightIds[0];
      const choice = info.choices.find((c) => c.id === targetId && !c.packed)!;
      await tapRect(page, choice.rect);

      if (r < info.requestsPerCase - 1) {
        await waitForSuitcase(
          page,
          (i) => i.requestIndex === r + 1 && i.ready,
          `case did not advance to request ${r + 1}`,
          15_000,
        );
      }
    }

    await expect.poll(() => readStarCount(page), { timeout: 15_000 }).toBe(starsBefore + 1);
  });

  test('[AC-07] @single-orientation French setting speaks suitcase.req line in French and intro in Hebrew', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterWorldByTap(page, 'profile-a', 'language-house', 'travel-suitcase', {
      beforeEnter: () => seedLanguageSetting(page, 'fr'),
    });
    const info = await waitForSuitcaseReady(page);
    expect(info.language).toBe('fr');
    expect(info.skillKey.endsWith('.fr')).toBe(true);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page);
          return (
            lines.some((l) => l.lineId === 'suitcase.intro.he' && l.lang === 'he') &&
            lines.some((l) => l.lineId.startsWith('suitcase.req.') && l.lang === 'fr')
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('[AC-09] @single-orientation dragging a right item onto the case packs it (age 5, L4)', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterSuitcase(page, 'profile-b', 4);
    expect(info.level).toBe(4);
    expect(info.request).toBe('attribute');
    expect(info.caseRect).not.toBeNull();

    const rightId = info.rightIds[0];
    const rightChoice = info.choices.find((c) => c.id === rightId && !c.packed)!;
    await dragRectTo(page, rightChoice.rect, info.caseRect!);
    await waitForSuitcase(
      page,
      (i) => i.lastEvent === 'packed' || i.packedCount >= 1 || i.requestIndex >= 1,
      'dragging right item onto case did not pack it',
    );
  });

  test('[AC-10] choice and case targets are at least 64 CSS px and inside viewport in both orientations', async ({ page }) => {
    test.setTimeout(60_000);
    const vp = page.viewportSize()!;
    const checkRect = (rect: { x: number; y: number; width: number; height: number }, label: string) => {
      expect(rect.width, `${label} width`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.height, `${label} height`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.x, `${label} left`).toBeGreaterThanOrEqual(0);
      expect(rect.y, `${label} top`).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width, `${label} right`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(rect.y + rect.height, `${label} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
    };

    const l1 = await enterSuitcase(page, 'profile-a');
    expect(l1.caseRect).not.toBeNull();
    checkRect(l1.caseRect!, 'L1 case');
    expect(l1.choices).toHaveLength(2);
    for (const c of l1.choices) {
      checkRect(c.rect, `L1 choice ${c.id}`);
    }

    const l5 = await enterSuitcase(page, 'profile-b', 5);
    expect(l5.level).toBe(5);
    expect(l5.caseRect).not.toBeNull();
    checkRect(l5.caseRect!, 'L5 case');
    expect(l5.choices).toHaveLength(4);
    for (const c of l5.choices) {
      checkRect(c.rect, `L5 choice ${c.id}`);
    }
  });
});

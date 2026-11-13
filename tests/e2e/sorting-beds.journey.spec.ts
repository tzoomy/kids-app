// Sorting Beds Pass 1, TDD step 1: real-tap acceptance tests (docs/specs/sorting-beds.md, docs/PROCESS.md section 4).
// Every test enters through enterWorldByTap (profile -> map -> Number Garden building) and taps hit rectangles read from
// getSortingInfo with real pointer clicks. Hooks only seed (level, balance) or read state. No goToScreen.
// profile-a is the age-2 track (starts at L2, idle hint after 6 s); profile-b is the age-5 track (starts at L5, no idle hint).
// These tests FAIL against the step-1 stub scene (getSortingInfo() is null) and go green with the real SortingScene.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getSortingInfo,
  getSpokenLineCount,
  getSpokenLines,
  placeCurrentCorrectly,
  placedCount,
  readBalanceSec,
  readStarCount,
  readStoredSkill,
  seedBalanceSec,
  seedLanguageSetting,
  seedSortingLevel,
  tapBed,
  tapRect,
  waitForScene,
  waitForSortingReady,
  waitForSpokenLine,
  wrongBedId,
  type PageRect,
  type ProfileTestId,
  type ReadySortingInfo,
  type SortingInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enter(
  page: Page,
  profile: ProfileTestId,
  seed: { level?: number; balanceSec?: number; lang?: 'en' | 'fr' | 'both' } = {},
): Promise<void> {
  await enterWorldByTap(page, profile, 'number-garden', {
    beforeEnter: async (mapPage) => {
      if (seed.lang !== undefined) await seedLanguageSetting(mapPage, seed.lang);
      if (seed.level !== undefined) await seedSortingLevel(mapPage, seed.level);
      if (seed.balanceSec !== undefined) await seedBalanceSec(mapPage, seed.balanceSec);
    },
  });
}

/** One round is 3 placements (trialsPerRound), each a real tap on the matching bed. */
async function placeRound(page: Page): Promise<void> {
  for (let i = 0; i < 3; i++) await placeCurrentCorrectly(page);
}

const centerY = (r: PageRect): number => r.y + r.height / 2;

/** Round-start rule line for a rule (spec voice table). */
function ruleLineId(rule: SortingInfo['rule']): string {
  return rule === 'size+color' ? 'sorting.rule.two-attr.he' : `sorting.rule.${rule}.he`;
}

/** Spoken learning tokens after a correct placement, in order (spec voice table; shape rounds speak none).
 * After the L8 switch (size x shape), Pass 1 speaks only the size token (team-lead decision 2026-11-13). */
function wordLineIds(rule: SortingInfo['rule'], item: ReadySortingInfo['currentItem'], lang: string): string[] {
  const size = `sorting.word.${item.size === 'large' ? 'big' : 'small'}.${lang}`;
  const color = `sorting.word.${item.color}.${lang}`;
  if (rule === 'color') return [color];
  if (rule === 'size' || rule === 'size+shape') return [size];
  if (rule === 'size+color') return [size, color];
  return [];
}

/** Taps a wrong bed for real, waits until the try is counted, then waits out the 400 ms lock. */
async function wrongTapAndSettle(page: Page, info: ReadySortingInfo, expectedTries: number): Promise<void> {
  await tapBed(page, wrongBedId(info));
  await expect.poll(async () => (await getSortingInfo(page))?.currentItem?.tries, { timeout: 5_000 }).toBe(expectedTries);
  await page.waitForTimeout(500);
}

test.describe('sorting beds: map journey', () => {
  test('[AC-01] real-tap journey: profile -> Number Garden building -> Sorting Beds -> one round -> back to the map', async ({ page }) => {
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-a', 'number-garden', {
      beforeEnter: async (mapPage) => {
        // Still on the map: the game only starts from this world's building.
        expect(await getActiveScenes(mapPage)).toContain('MapScene');
        expect(await getActiveScenes(mapPage)).not.toContain('SortingScene');
      },
    });
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('SortingScene');
    expect(scenes).not.toContain('MapScene');

    const first = await waitForSortingReady(page);
    expect(first.beds.length).toBeGreaterThanOrEqual(2);
    expect(await readStarCount(page)).toBe(0);

    await placeRound(page);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(1);

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('SortingScene');
  });

  test('[AC-11] smoke: playable at the current viewport, with tap targets of at least 64 CSS px inside the screen', async ({ page }) => {
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const info = await waitForSortingReady(page);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('no viewport');

    const targets: Array<[string, PageRect]> = [...info.beds.map((b): [string, PageRect] => [b.id, b.hit]), ['flower', info.currentItem.hit]];
    for (const [name, hit] of targets) {
      expect(hit.width, `${name} width`).toBeGreaterThanOrEqual(64);
      expect(hit.height, `${name} height`).toBeGreaterThanOrEqual(64);
      expect(hit.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(hit.y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(hit.x + hit.width, `${name} right`).toBeLessThanOrEqual(viewport.width);
      expect(hit.y + hit.height, `${name} bottom`).toBeLessThanOrEqual(viewport.height);
    }

    // Playable: one real tap on the matching bed plants the flower and the next one comes up.
    await placeCurrentCorrectly(page);
    const next = await waitForSortingReady(page);
    expect(placedCount(next)).toBe(1);
  });
});

test.describe('sorting beds: placing flowers', () => {
  test('[AC-02] @single-orientation a correct placement plays the positive line and the next flower comes up', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const before = await waitForSortingReady(page);
    const lines0 = await getSpokenLineCount(page);
    const stars0 = await readStarCount(page);

    const target = before.beds.find((b) => b.id === before.currentItem.targetBedId);
    if (!target) throw new Error('no target bed');
    await tapRect(page, target.hit);

    // The flower leaves the basket and is planted in the matching bed.
    await expect
      .poll(async () => {
        const info = await getSortingInfo(page);
        return info ? (info.beds.find((b) => b.id === target.id)?.count ?? -1) : -1;
      }, { timeout: 8_000 })
      .toBe(1);
    await waitForSpokenLine(page, (l) => l.lineId === 'sorting.correct.he' && l.lang === 'he', 8_000, lines0);

    // The round advances: the next flower pops into the basket, fresh.
    const next = await waitForSortingReady(page);
    expect(placedCount(next)).toBe(1);
    expect(next.currentItem.tries).toBe(0);
    expect(next.currentItem.hinted).toBe(false);
    expect(await readStarCount(page)).toBe(stars0); // one flower of three: no star yet
  });

  test('[AC-03] @single-orientation a wrong bed gives the hint, keeps the flower, and never reduces the leisure balance', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a', { balanceSec: 300 });
    const before = await waitForSortingReady(page);
    const balance0 = await readBalanceSec(page);
    expect(balance0).toBeGreaterThanOrEqual(300);
    const lines0 = await getSpokenLineCount(page);

    await tapBed(page, wrongBedId(before));
    await waitForSpokenLine(page, (l) => l.lineId === 'sorting.wrong.hint.he' && l.lang === 'he', 8_000, lines0);

    const after = await getSortingInfo(page);
    expect(after?.currentItem?.id).toBe(before.currentItem.id);
    expect(after?.currentItem?.tries).toBe(1);
    expect(after ? placedCount(after) : -1).toBe(0);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance0);
    await page.waitForTimeout(2_000);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance0);
  });

  test('[AC-16] @single-orientation a wrong bed keeps the flower available and records at most one miss per trial', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const before = await waitForSortingReady(page);
    const lang = before.lang;

    await wrongTapAndSettle(page, before, 1);
    let info = await waitForSortingReady(page);
    expect(info.currentItem.id).toBe(before.currentItem.id);
    expect(info.currentItem.targetBedId).toBe(before.currentItem.targetBedId);
    expect(placedCount(info)).toBe(0);
    expect((await readStoredSkill(page, 'profile-a', lang))?.recent).toEqual(['miss']);

    await wrongTapAndSettle(page, info, 2); // a second wrong tap is a second try but not a second miss
    info = await waitForSortingReady(page);
    expect(info.currentItem.id).toBe(before.currentItem.id);
    expect((await readStoredSkill(page, 'profile-a', lang))?.recent).toEqual(['miss']);

    await placeCurrentCorrectly(page); // the final correct placement records nothing more
    expect((await readStoredSkill(page, 'profile-a', lang))?.recent).toEqual(['miss']);
  });

  test('[AC-25] @single-orientation a second bed tap within 400 ms of a wrong tap is ignored; a later tap still counts', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const before = await waitForSortingReady(page);
    const wrong = before.beds.find((b) => b.id === wrongBedId(before));
    const target = before.beds.find((b) => b.id === before.currentItem.targetBedId);
    if (!wrong || !target) throw new Error('beds missing');
    const lines0 = await getSpokenLineCount(page);

    // Wrong tap, then the matching bed straight away (well inside 400 ms): the second tap is swallowed.
    await tapRect(page, wrong.hit);
    await tapRect(page, target.hit);
    await page.waitForTimeout(200);

    const during = await getSortingInfo(page);
    expect(during?.currentItem?.id).toBe(before.currentItem.id);
    expect(during?.currentItem?.tries).toBe(1);
    expect(during ? placedCount(during) : -1).toBe(0);
    const hints = (await getSpokenLines(page, lines0)).filter((l) => l.lineId === 'sorting.wrong.hint.he');
    expect(hints).toHaveLength(1);

    // After the lock a tap counts again.
    await page.waitForTimeout(500);
    await waitForSortingReady(page);
    await tapRect(page, wrong.hit);
    await expect.poll(async () => (await getSortingInfo(page))?.currentItem?.tries, { timeout: 5_000 }).toBe(2);
  });

  test('[AC-20] @single-orientation one flower in the basket, one tap on a bed places it, one placement is one trial, a round is 3', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a');
    const first = await waitForSortingReady(page);
    const lang = first.lang;

    // Exactly one current flower, in a central basket below the beds.
    const flowerY = centerY(first.currentItem.hit);
    for (const bed of first.beds) expect(flowerY).toBeGreaterThan(centerY(bed.hit));
    expect(first.beds.reduce((sum, bed) => sum + bed.capacity, 0)).toBe(3);

    // A wrong tap does not bring the next flower; the same one stays.
    await wrongTapAndSettle(page, first, 1);
    const stay = await waitForSortingReady(page);
    expect(stay.currentItem.id).toBe(first.currentItem.id);
    expect(placedCount(stay)).toBe(0);

    // No select step: a single real tap on the matching bed places the flower (the flower itself is never tapped).
    await placeCurrentCorrectly(page);
    const second = await waitForSortingReady(page);
    expect(placedCount(second)).toBe(1);
    expect(second.currentItem.tries).toBe(0);
    // The wrong tap recorded the trial (a miss); its correct placement recorded nothing more.
    expect((await readStoredSkill(page, 'profile-a', lang))?.recent).toEqual(['miss']);

    await placeCurrentCorrectly(page);
    expect((await readStoredSkill(page, 'profile-a', lang))?.recent).toEqual(['miss', 'clean']);
    await placeCurrentCorrectly(page);
    expect((await readStoredSkill(page, 'profile-a', lang))?.recent).toEqual(['miss', 'clean', 'clean']);

    // 3 placements end the round: one star, then a fresh round with 3 flowers and empty beds.
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(1);
    const nextRound = await waitForSortingReady(page, 15_000);
    expect(placedCount(nextRound)).toBe(0);
    expect(nextRound.beds.reduce((sum, bed) => sum + bed.capacity, 0)).toBe(3);
  });

  test('[AC-17] @single-orientation a bed blooms when it is full and finishing the round awards a star', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a');
    let sawFullBed = false;

    for (let placement = 1; placement <= 3; placement++) {
      await placeCurrentCorrectly(page);
      if (placement === 3) break;
      const info = await waitForSortingReady(page);
      for (const bed of info.beds) {
        const full = bed.capacity > 0 && bed.count === bed.capacity;
        if (full) sawFullBed = true;
        // A bed blooms exactly when it holds as many flowers as belong to it.
        await expect
          .poll(async () => (await getSortingInfo(page))?.beds.find((b) => b.id === bed.id)?.bloomed, { timeout: 5_000 })
          .toBe(full);
      }
    }
    // With 3 flowers over at least 2 beds, some bed is full before the last placement.
    expect(sawFullBed).toBe(true);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(1);
  });
});

test.describe('sorting beds: levels', () => {
  test('[AC-05] @single-orientation e2e+seed one real-tap level change: 3 clean placements at L1 lift the next round to L2', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    // Pin the language: only the skill of the language that was played rises, and 'both' picks the next round's language at random.
    await enter(page, 'profile-a', { level: 1, lang: 'en' });
    const first = await waitForSortingReady(page);
    expect(first.level).toBe(1);
    expect(first.lang).toBe('en');

    await placeCurrentCorrectly(page);
    await placeCurrentCorrectly(page);
    expect((await getSortingInfo(page))?.level).toBe(1); // age 2 changes level between rounds only
    await placeCurrentCorrectly(page);

    await expect.poll(async () => (await getSortingInfo(page))?.level, { timeout: 20_000 }).toBe(2);
    expect((await readStoredSkill(page, 'profile-a', 'en'))?.level).toBe(2);
  });

  test('[AC-06] @single-orientation e2e+seed L6 plays with 4 size x colour conjunction beds and symbol plaques', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-b', { level: 6 });
    const info = await waitForSortingReady(page);
    expect(info.level).toBe(6);
    expect(info.rule).toBe('size+color');
    expect(info.beds).toHaveLength(4);
    for (const bed of info.beds) {
      expect(bed.label).toBe('symbol');
      expect(Object.keys(bed.accepts).sort()).toEqual(['color', 'size']);
    }
    expect(info.beds.reduce((sum, bed) => sum + bed.capacity, 0)).toBe(3);
    await placeRound(page);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(1);
  });

  test('[AC-06] @single-orientation e2e+seed L7 plays with blank plaques and an example flower in every bed', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-b', { level: 7 });
    const info = await waitForSortingReady(page);
    expect(info.level).toBe(7);
    expect(info.rule).toBe('size+color');
    expect(info.beds).toHaveLength(4);
    for (const bed of info.beds) {
      expect(bed.label).toBe('none');
      expect(bed.example).not.toBeNull();
      expect(bed.count).toBe(0); // the example does not count
    }
    await placeRound(page);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(1);
  });

  test('[AC-18] @single-orientation e2e+seed L8 switches the rule to size x shape after the first placement', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-b', { level: 8 });
    const before = await waitForSortingReady(page);
    expect(before.level).toBe(8);
    expect(before.rule).toBe('size+color');
    expect(before.ruleSwitched).toBe(false);
    for (const bed of before.beds) expect(Object.keys(bed.accepts).sort()).toEqual(['color', 'size']);

    await placeCurrentCorrectly(page); // the first placement

    await expect.poll(async () => (await getSortingInfo(page))?.ruleSwitched, { timeout: 10_000 }).toBe(true);
    const after = await waitForSortingReady(page);
    expect(after.rule).toBe('size+shape');
    expect(after.beds).toHaveLength(4);
    for (const bed of after.beds) {
      expect(Object.keys(bed.accepts).sort()).toEqual(['shape', 'size']);
      expect(bed.example).not.toBeNull(); // planted flowers stay
    }
    expect(placedCount(after)).toBe(1);

    // The new rule is playable: the next flower goes to its (updated) target bed.
    await placeCurrentCorrectly(page);
  });

  test('[AC-23] @single-orientation e2e+seed seeded L2 shows picture labels with ghost slots', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await enter(page, 'profile-a', { level: 2 });
    const info = await waitForSortingReady(page);
    expect(info.level).toBe(2);
    for (const bed of info.beds) {
      expect(bed.label).toBe('picture');
      expect(bed.ghostSlots).toBe(true);
      expect(bed.example).toBeNull();
    }
  });

  test('[AC-23] @single-orientation e2e+seed seeded L5 shows symbol labels without ghost slots', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await enter(page, 'profile-b', { level: 5 });
    const info = await waitForSortingReady(page);
    expect(info.level).toBe(5);
    for (const bed of info.beds) {
      expect(bed.label).toBe('symbol');
      expect(bed.ghostSlots).toBe(false);
      expect(bed.example).toBeNull();
    }
  });

  test('[AC-23] @single-orientation e2e+seed seeded L7 shows blank plaques and an example flower in every bed', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await enter(page, 'profile-b', { level: 7 });
    const info = await waitForSortingReady(page);
    expect(info.level).toBe(7);
    expect(info.beds.length).toBeGreaterThan(0);
    for (const bed of info.beds) {
      expect(bed.label).toBe('none');
      expect(bed.ghostSlots).toBe(false);
      expect(bed.example).not.toBeNull();
    }
  });
});

test.describe('sorting beds: hints', () => {
  test('[AC-26] @single-orientation age 2 gets an idle hint after hintDelayMs: hinted flips and the rule line is requested again', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const ready = await waitForSortingReady(page);
    const ruleId = ruleLineId(ready.rule);
    const ruleRequests = async (): Promise<number> => (await getSpokenLines(page)).filter((l) => l.lineId === ruleId && l.lang === 'he').length;
    const requestsAtReady = await ruleRequests();
    expect(requestsAtReady).toBeGreaterThanOrEqual(1);

    await page.waitForTimeout(3_000); // well before hintDelayMs (6000)
    expect((await getSortingInfo(page))?.currentItem?.hinted).toBe(false);

    // The hint may wait out a playing voice line and retry after another hintDelayMs (spec), hence the generous poll.
    await expect.poll(async () => (await getSortingInfo(page))?.currentItem?.hinted, { timeout: 18_000 }).toBe(true);
    expect(await ruleRequests()).toBeGreaterThan(requestsAtReady);
    const hinted = await getSortingInfo(page);
    expect(hinted?.currentItem?.tries).toBe(0); // an idle hint is not a try
    expect(hinted ? placedCount(hinted) : -1).toBe(0);

    // The trial was hinted before it was recorded, so the correct placement is assisted, not clean.
    await placeCurrentCorrectly(page);
    expect((await readStoredSkill(page, 'profile-a', ready.lang))?.recent).toEqual(['assisted']);
  });

  test('[AC-26] @single-orientation a correct tap during the idle-hint hop still plants the flower and keeps the trial assisted', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const ready = await waitForSortingReady(page);
    // Poll fast so the tap lands inside the 520 ms hop (hinted flips as the hop starts).
    await expect.poll(async () => (await getSortingInfo(page))?.currentItem?.hinted, { timeout: 18_000, intervals: [25] }).toBe(true);
    await tapBed(page, ready.currentItem.targetBedId);
    await expect
      .poll(async () => {
        const info = await getSortingInfo(page);
        return info ? placedCount(info) : -1;
      }, { timeout: 8_000 })
      .toBe(1);
    const target = (await getSortingInfo(page))?.beds.find((b) => b.id === ready.currentItem.targetBedId);
    expect(target?.count).toBe(1);
    expect((await readStoredSkill(page, 'profile-a', ready.lang))?.recent).toEqual(['assisted']);
    // The next flower comes up normally.
    const next = await waitForSortingReady(page);
    expect(next.currentItem.tries).toBe(0);
  });

  test('[AC-28] @single-orientation age 5 gets no hint after 10 s idle, only after a wrong tap', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-b');
    const before = await waitForSortingReady(page);
    const lines0 = await getSpokenLineCount(page);

    await page.waitForTimeout(10_000);
    const quiet = (await getSpokenLines(page, lines0)).filter((l) => l.lineId.startsWith('sorting.'));
    expect(quiet.map((l) => l.lineId)).toEqual([]);
    expect((await getSortingInfo(page))?.currentItem?.hinted).toBe(false);

    await tapBed(page, wrongBedId(before));
    await waitForSpokenLine(page, (l) => l.lineId === 'sorting.wrong.hint.he' && l.lang === 'he', 8_000, lines0);
    expect((await getSortingInfo(page))?.currentItem?.tries).toBe(1);
  });
});

test.describe('sorting beds: voice', () => {
  test('[AC-10] @single-orientation lines request the right line id and language: rule, help, wrong hint, correct, token, bed full', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a');
    const first = await waitForSortingReady(page);
    expect(['en', 'fr']).toContain(first.lang);

    const rule = await waitForSpokenLine(page, (l) => l.lineId === ruleLineId(first.rule), 10_000);
    expect(rule.lang).toBe('he');

    // Help button: its line, the card, and a close by tapping the overlay.
    const helpFrom = await getSpokenLineCount(page);
    await page.locator('[data-testid="hud-help"]').click();
    const help = await waitForSpokenLine(page, (l) => l.lineId === 'sorting.help.he', 8_000, helpFrom);
    expect(help.lang).toBe('he');
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await page.locator('[data-testid="help-card-close"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toHaveCount(0);

    // Wrong bed: the hint line, in Hebrew.
    const wrongFrom = await getSpokenLineCount(page);
    await wrongTapAndSettle(page, first, 1);
    const hint = await waitForSpokenLine(page, (l) => l.lineId === 'sorting.wrong.hint.he', 8_000, wrongFrom);
    expect(hint.lang).toBe('he');

    // Correct placement: the positive line plus the learning token(s) in the round language.
    const correctFrom = await getSpokenLineCount(page);
    const placed = await placeCurrentCorrectly(page);
    const correct = await waitForSpokenLine(page, (l) => l.lineId === 'sorting.correct.he', 8_000, correctFrom);
    expect(correct.lang).toBe('he');
    for (const wordId of wordLineIds(placed.rule, placed.currentItem, first.lang)) {
      const word = await waitForSpokenLine(page, (l) => l.lineId === wordId, 8_000, correctFrom);
      expect(word.lang).toBe(first.lang);
    }

    // Finishing the round fills every targeted bed, so a bed-full line was requested.
    await placeCurrentCorrectly(page);
    await placeCurrentCorrectly(page);
    const full = await waitForSpokenLine(page, (l) => l.lineId === 'sorting.bed-full.he', 10_000);
    expect(full.lang).toBe('he');
  });

  test('[AC-31] @single-orientation e2e+seed L5: round start requests the rule line, a correct placement requests the token in the round language', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-b', { level: 5 });
    const info = await waitForSortingReady(page);
    expect(['color', 'size']).toContain(info.rule); // L5 alternates colour and size between rounds
    const rule = await waitForSpokenLine(page, (l) => l.lineId === ruleLineId(info.rule), 10_000);
    expect(rule.lang).toBe('he');

    const from = await getSpokenLineCount(page);
    const placed = await placeCurrentCorrectly(page);
    const expected = wordLineIds(info.rule, placed.currentItem, info.lang);
    expect(expected).toHaveLength(1);
    const word = await waitForSpokenLine(page, (l) => l.lineId === expected[0], 8_000, from);
    expect(word.lang).toBe(info.lang);
  });

  test('[AC-31] @single-orientation e2e+seed L6: a conjunction round starts with the two-attribute line and speaks size then colour', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-b', { level: 6 });
    const info = await waitForSortingReady(page);
    expect(info.rule).toBe('size+color');
    const rule = await waitForSpokenLine(page, (l) => l.lineId === 'sorting.rule.two-attr.he', 10_000);
    expect(rule.lang).toBe('he');

    const from = await getSpokenLineCount(page);
    const placed = await placeCurrentCorrectly(page);
    const [sizeId, colorId] = wordLineIds('size+color', placed.currentItem, info.lang);
    const sizeLine = await waitForSpokenLine(page, (l) => l.lineId === sizeId, 8_000, from);
    const colorLine = await waitForSpokenLine(page, (l) => l.lineId === colorId, 8_000, from);
    expect(sizeLine.lang).toBe(info.lang);
    expect(colorLine.lang).toBe(info.lang);
    expect(sizeLine.index).toBeLessThan(colorLine.index); // two separate requests, size first
  });

  test('[AC-31] @single-orientation e2e+seed L8: the rule switch requests the shape switch line, then only the size token', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-b', { level: 8 });
    const before = await waitForSortingReady(page);
    expect(before.rule).toBe('size+color');
    const fromSwitch = await getSpokenLineCount(page);
    const first = await placeCurrentCorrectly(page);
    const switchLine = await waitForSpokenLine(page, (l) => l.lineId === 'sorting.switch.shape.he', 10_000, fromSwitch);
    expect(switchLine.lang).toBe('he');

    // After the switch: Pass 1 speaks only the size token; no shape word, no second colour word.
    const after = await waitForSortingReady(page);
    expect(after.rule).toBe('size+shape');
    const fromPlace = await getSpokenLineCount(page);
    const second = await placeCurrentCorrectly(page);
    const sizeId = wordLineIds('size+shape', second.currentItem, after.lang)[0];
    const sizeLine = await waitForSpokenLine(page, (l) => l.lineId === sizeId, 8_000, fromPlace);
    expect(sizeLine.lang).toBe(after.lang);
    const spoken = await getSpokenLines(page, fromPlace);
    expect(spoken.filter((l) => l.lineId.startsWith('sorting.word.')).map((l) => l.lineId)).toEqual([sizeId]);
    expect(spoken.some((l) => /tulip|daisy|round|shape/.test(l.lineId))).toBe(false);
    // The pre-switch placement still used size then colour (recorded before fromPlace).
    expect(wordLineIds('size+color', first.currentItem, before.lang)).toHaveLength(2);
  });
});

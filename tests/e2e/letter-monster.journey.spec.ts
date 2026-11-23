// Letter Monster (docs/specs/letter-monster.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getLetterMonsterInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  seedLanguageSetting,
  seedLetterMonsterLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForLetterMonsterReady,
  waitForScene,
  type LetterMonsterInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterLetterMonster(
  page: Page,
  profile: 'profile-a' | 'profile-b',
  level?: number,
): Promise<LetterMonsterInfo> {
  await enterWorldByTap(page, profile, 'language-house', 'letter-monster', {
    beforeEnter: level === undefined ? undefined : () => seedLetterMonsterLevel(page, level),
  });
  return waitForLetterMonsterReady(page);
}

/** Polls until Letter Monster state satisfies `check`. */
async function waitForMonster(
  page: Page,
  check: (info: LetterMonsterInfo) => boolean,
  what: string,
  timeout = 12_000,
): Promise<LetterMonsterInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getLetterMonsterInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

test.describe('letter monster', () => {
  test('[AC-01] full real-tap journey: profile -> Language House -> picker card -> feed the monster once -> back to the map', async ({ page }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'language-house');
    await tapTestId(page, 'game-picker-letter-monster');
    await waitForScene(page, 'LetterMonsterScene');
    const info = await waitForLetterMonsterReady(page);

    const starsBefore = await readStarCount(page);
    await tapRect(page, info.foods[info.matchId]);
    await expect.poll(() => readStarCount(page), { timeout: 12_000 }).toBe(starsBefore + 1);
    await waitForMonster(page, (i) => i.ready && i.tries === 0, 'did not settle onto next round');

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('LetterMonsterScene');
  });

  test('[AC-04] @single-orientation age 2 color levels: request names color in Hebrew and learning language; feeding names food', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterLetterMonster(page, 'profile-a', 1);
    expect(info.level).toBe(1);
    expect(info.mode).toBe('color');
    expect(info.request.kind).toBe('color');
    expect(info.offeredIds).toHaveLength(2);
    expect(info.signVisible).toBe(true);

    if (info.request.kind !== 'color') throw new Error('Expected color request at L1');
    const targetColor = info.request.color;

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page);
          const hasHeColor = lines.some((l) => l.lineId === `monster.askColor.${targetColor}.he` && l.lang === 'he');
          const hasLearnColor = lines.some(
            (l) => l.lineId === `monster.color.${targetColor}.${info.language}` && l.lang === info.language,
          );
          return hasHeColor && hasLearnColor;
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const spokenBeforeFeed = (await getSpokenLines(page)).length;
    await tapRect(page, info.foods[info.matchId]);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeFeed);
          const hasFood = lines.some(
            (l) => l.lineId === `monster.food.${info.matchId}.${info.language}` && l.lang === info.language,
          );
          const hasPraise = lines.some((l) => l.lineId === 'he.praise.0' && l.lang === 'he');
          return hasFood && hasPraise;
        },
        { timeout: 12_000 },
      )
      .toBe(true);
  });

  test('[AC-05] @single-orientation age 5 letter levels: wrong food speaks notThis, keeps request/stars/balance; right food gives star', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterLetterMonster(page, 'profile-b', 3);
    expect(info.level).toBe(3);
    expect(info.mode).toBe('letter');
    expect(info.request.kind).toBe('letter');
    expect(info.offeredIds).toHaveLength(3);

    const firstRequest = info.request;
    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);
    const spokenBefore = (await getSpokenLines(page)).length;

    const wrongId = info.offeredIds.find((id) => id !== info.matchId);
    if (!wrongId) throw new Error('Expected at least one distractor');
    await tapRect(page, info.foods[wrongId]);

    const afterWrong = await waitForMonster(
      page,
      (i) => i.ready && i.lastEvent === 'not-this-one' && i.tries >= 1,
      'wrong food did not trigger not-this-one and return to ready',
    );
    expect(afterWrong.request).toEqual(firstRequest);
    expect(await readStarCount(page)).toBe(starsBefore);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBefore);
          return lines.some((l) => l.lineId === 'monster.notThis.he' && l.lang === 'he');
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    await tapRect(page, afterWrong.foods[afterWrong.matchId]);
    await expect.poll(() => readStarCount(page), { timeout: 12_000 }).toBe(starsBefore + 1);

    const next = await waitForMonster(
      page,
      (i) =>
        i.ready &&
        i.tries === 0 &&
        (i.request.kind !== firstRequest.kind ||
          (i.request.kind === 'letter' && firstRequest.kind === 'letter' && i.request.letter !== firstRequest.letter)),
      'no new request after feeding the matching food',
      15_000,
    );
    expect(next.stars).toBe(starsBefore + 1);
  });

  test('[AC-08] food and monster tap targets are at least 64 CSS px in both orientations', async ({ page }) => {
    const info = await enterLetterMonster(page, 'profile-a');
    const vp = page.viewportSize()!;
    const targets = [info.monster, ...info.offeredIds.map((id) => info.foods[id])];
    expect(targets.length).toBe(info.offeredIds.length + 1);

    for (const rect of targets) {
      expect(rect).toBeDefined();
      expect(rect.width).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.height).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.x).toBeGreaterThanOrEqual(0);
      expect(rect.y).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(rect.y + rect.height).toBeLessThanOrEqual(vp.height + 0.5);
    }
  });
  test('[AC-13] @single-orientation L6 ending-letter request: Hebrew lead then the ending model line; wrong food keeps the request, right food earns a star', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterLetterMonster(page, 'profile-b', 6);
    expect(info.level).toBe(6);
    expect(info.mode).toBe('ending');
    expect(info.request.kind).toBe('ending');
    expect(info.offeredIds).toHaveLength(4);
    expect(info.signVisible).toBe(true);

    const request = info.request as { kind: 'ending'; letter: string };
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page);
          return (
            lines.some((l) => l.lineId === 'monster.askEnding.he' && l.lang === 'he') &&
            lines.some((l) => l.lineId === `monster.ending.${request.letter}.${info.language}` && l.lang === info.language)
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const starsBefore = await readStarCount(page);
    const wrongId = info.offeredIds.find((id) => id !== info.matchId)!;
    await tapRect(page, info.foods[wrongId]);
    const afterWrong = await waitForMonster(page, (i) => i.ready && i.lastEvent === 'not-this-one', 'wrong food not rejected');
    expect(afterWrong.request).toEqual(request);
    expect(await readStarCount(page)).toBe(starsBefore);

    await tapRect(page, afterWrong.foods[afterWrong.matchId]);
    await expect.poll(() => readStarCount(page), { timeout: 12_000 }).toBe(starsBefore + 1);
  });

  test('[AC-14] @single-orientation L8 word reading in French: the written word is on the sign, six foods, exactly one matches', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-b', 'language-house', 'letter-monster', {
      beforeEnter: async () => {
        await seedLanguageSetting(page, 'fr');
        await seedLetterMonsterLevel(page, 8);
      },
    });
    const info = await waitForLetterMonsterReady(page);
    expect(info.level).toBe(8);
    expect(info.language).toBe('fr');
    expect(info.mode).toBe('word');
    expect(info.signVisible).toBe(true);
    expect(info.offeredIds).toHaveLength(6);
    expect(info.request.kind).toBe('word');
    const request = info.request as { kind: 'word'; foodId: string; word: string };
    expect(request.foodId).toBe(info.matchId);
    expect(request.word.length).toBeLessThanOrEqual(6);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page);
          return (
            lines.some((l) => l.lineId === 'monster.askWord.he' && l.lang === 'he') &&
            lines.some((l) => l.lineId === `monster.word.${request.foodId}.fr` && l.lang === 'fr')
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const starsBefore = await readStarCount(page);
    await tapRect(page, info.foods[info.matchId]);
    await expect.poll(() => readStarCount(page), { timeout: 12_000 }).toBe(starsBefore + 1);
  });

  test('[AC-15] L5 (4 foods) and L7 (6 foods): every food and the monster at least 64 CSS px, on screen and not overlapping, in both orientations', async ({ page }) => {
    test.setTimeout(60_000);
    const vp = page.viewportSize()!;
    for (const [level, count] of [
      [5, 4],
      [7, 6],
    ] as const) {
      const info = await enterLetterMonster(page, 'profile-b', level);
      expect(info.level).toBe(level);
      expect(info.offeredIds).toHaveLength(count);
      const rects = info.offeredIds.map((id) => ({ id, rect: info.foods[id] }));
      for (const { id, rect } of rects) {
        expect(rect.width, `${id} width`).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(rect.height, `${id} height`).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(rect.x, `${id} left`).toBeGreaterThanOrEqual(0);
        expect(rect.y, `${id} top`).toBeGreaterThanOrEqual(0);
        expect(rect.x + rect.width, `${id} right`).toBeLessThanOrEqual(vp.width + 0.5);
        expect(rect.y + rect.height, `${id} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
      }
      for (let i = 0; i < rects.length; i++) {
        for (let j = i + 1; j < rects.length; j++) {
          const a = rects[i].rect;
          const b = rects[j].rect;
          const overlap = a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
          expect(overlap, `L${level} ${rects[i].id} overlaps ${rects[j].id}`).toBe(false);
        }
      }
      await tapTestId(page, 'hud-back');
      await waitForScene(page, 'MapScene');
    }
  });
});

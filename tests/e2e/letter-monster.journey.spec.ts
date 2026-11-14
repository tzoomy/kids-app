// Letter Monster (docs/specs/letter-monster.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getLetterMonsterInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
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
});

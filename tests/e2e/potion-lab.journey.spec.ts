// Potion Lab (docs/specs/potion-lab.md), Pass 1. Real taps only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import { potsFor } from '../../src/games/potionLab/potionMachine';
import {
  enterWorldByTap,
  getActiveScenes,
  getPotionInfo,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  seedPotionLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForPotionReady,
  waitForScene,
  waitForSpokenLine,
  type PotionInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterPotionLab(page: Page, profile: 'profile-a' | 'profile-b', level?: number): Promise<PotionInfo> {
  await enterWorldByTap(page, profile, 'science-world', 'potion-lab', {
    beforeEnter: level === undefined ? undefined : () => seedPotionLevel(page, level),
  });
  return waitForPotionReady(page);
}

/** Polls until Potion Lab state satisfies `check`. */
async function waitForPotion(
  page: Page,
  check: (info: PotionInfo) => boolean,
  what: string,
  timeout = 10_000,
): Promise<PotionInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getPotionInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

test.describe('potion lab', () => {
  test('[AC-01] full real-tap journey: profile -> Science World (one game: direct entry, no picker) -> mix two colors -> back to the map', async ({ page }) => {
    test.setTimeout(60_000);
    // Station trail entry rule (docs/specs/station-trail.md AC-10): a world with exactly one game enters it directly.
    await tapWorldBuilding(page, 'profile-a', 'science-world');
    await waitForScene(page, 'PotionScene');
    await expect(page.locator('[data-testid="game-picker-potion-lab"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="game-picker-empty"]')).toHaveCount(0);
    const info = await waitForPotionReady(page);

    await tapRect(page, info.pots.red);
    await waitForPotion(page, (i) => i.ready && i.bowlColor === 'red', 'first pot was not poured');
    await tapRect(page, info.pots.yellow);
    await waitForPotion(page, (i) => i.bowlColor === 'orange' || i.lastEvent === 'mixed', 'second pot did not mix into orange');
    await waitForPotion(page, (i) => i.ready && i.bowlColor === null, 'bowl did not reset after mixing', 15_000);

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('PotionScene');
  });

  test('[AC-04] @single-orientation free mode (age 2): entering speaks the free-mode intro line', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterPotionLab(page, 'profile-a');
    expect(info.level).toBe(1);
    expect(info.mode).toBe('free');

    const intro = await waitForSpokenLine(
      page,
      (l) => l.lineId === 'potion.intro.free.he' && l.lang === 'he',
      10_000,
    );
    const lines = await getSpokenLines(page, intro.index);
    expect(lines.some((l) => l.lineId === 'potion.intro.free.he' && l.lang === 'he')).toBe(true);
  });

  test('[AC-04] @single-orientation free mode (age 2): every mix is named in Hebrew and in the learning language', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterPotionLab(page, 'profile-a');
    expect(info.level).toBe(1);
    expect(info.mode).toBe('free');

    const spokenBefore = (await getSpokenLines(page)).length;
    await tapRect(page, info.pots.red);
    await waitForPotion(page, (i) => i.ready && i.bowlColor === 'red', 'red pot was not poured');
    await tapRect(page, info.pots.blue);
    await waitForPotion(page, (i) => i.bowlColor === 'purple' || i.lastEvent === 'mixed', 'red + blue did not mix into purple');

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBefore);
          const hasHe = lines.some((l) => l.lineId === 'potion.color.purple.he' && l.lang === 'he');
          const hasLearn = lines.some((l) => l.lineId === `potion.color.purple.${info.language}` && l.lang === info.language);
          return hasHe && hasLearn;
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('[AC-05] @single-orientation request mode (age 5): a matched mix gives a star and a new request; a different mix is named, keeps the request, and never reduces stars or balance', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await enterPotionLab(page, 'profile-b', 2);
    expect(info.level).toBe(2);
    expect(info.mode).toBe('request');
    expect(info.request).not.toBeNull();

    const firstRequest = info.request!;
    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);
    const spokenBefore = (await getSpokenLines(page)).length;

    // Same pot twice makes a primary color, which never matches a secondary target.
    await tapRect(page, info.pots.red);
    await waitForPotion(page, (i) => i.ready && i.bowlColor === 'red', 'first pot not poured for mismatch');
    await tapRect(page, info.pots.red);
    const afterOther = await waitForPotion(
      page,
      (i) => i.ready && i.bowlColor === null && i.lastEvent === 'mixed-other',
      'mixed-other did not reset the bowl',
      15_000,
    );
    expect(afterOther.request).toBe(firstRequest);
    expect(await readStarCount(page)).toBe(starsBefore);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBefore);
          return (
            lines.some((l) => l.lineId === 'potion.color.red.he' && l.lang === 'he') &&
            lines.some((l) => l.lineId === `potion.color.red.${info.language}` && l.lang === info.language) &&
            lines.some((l) => l.lineId === 'potion.tryAgain.he' && l.lang === 'he')
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const [p1, p2] = potsFor(firstRequest);
    await tapRect(page, afterOther.pots[p1]);
    await waitForPotion(page, (i) => i.ready && i.bowlColor === p1, 'first matching pot was not poured');
    await tapRect(page, afterOther.pots[p2]);

    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(starsBefore + 1);
    const next = await waitForPotion(
      page,
      (i) => i.ready && i.bowlColor === null && i.request !== null && i.request !== firstRequest,
      'no new request after matched mix',
      15_000,
    );
    expect(next.stars).toBe(starsBefore + 1);
  });

  test('[AC-05] @single-orientation request mode (age 5): entering speaks the request intro, the request line, and the color word in order before any tap', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterPotionLab(page, 'profile-b', 2);
    expect(info.level).toBe(2);
    expect(info.mode).toBe('request');
    expect(info.request).not.toBeNull();
    const req = info.request!;

    const intro = await waitForSpokenLine(
      page,
      (l) => l.lineId === 'potion.intro.request.he' && l.lang === 'he',
      10_000,
    );
    const request = await waitForSpokenLine(
      page,
      (l) => l.lineId === `potion.request.${req}.he` && l.lang === 'he',
      10_000,
      intro.index + 1,
    );
    const color = await waitForSpokenLine(
      page,
      (l) => l.lineId === `potion.color.${req}.${info.language}` && l.lang === info.language,
      10_000,
      request.index + 1,
    );
    const visitLines = (await getSpokenLines(page, intro.index)).filter((l) => l.lineId.startsWith('potion.'));
    expect(visitLines.slice(0, 3).map((l) => ({ lineId: l.lineId, lang: l.lang }))).toEqual([
      { lineId: 'potion.intro.request.he', lang: 'he' },
      { lineId: `potion.request.${req}.he`, lang: 'he' },
      { lineId: `potion.color.${req}.${info.language}`, lang: info.language },
    ]);
    expect(intro.index).toBeLessThan(request.index);
    expect(request.index).toBeLessThan(color.index);
  });

  test('[AC-08] pot and bowl tap targets are at least 64 CSS px in both orientations', async ({ page }) => {
    const info = await enterPotionLab(page, 'profile-a');
    const vp = page.viewportSize()!;
    const targets = [info.pots.red, info.pots.yellow, info.pots.blue, info.bowl];
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

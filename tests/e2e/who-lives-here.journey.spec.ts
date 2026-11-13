// Who Lives Here? Pass 1: real-tap acceptance tests (docs/specs/who-lives-here.md, docs/PROCESS.md section 4).
// Every test enters through the Nature Lab map building -> the Nature Lab picker -> the Who Lives Here? card, and taps
// hit rectangles read from getHabitatInfo with real pointer clicks. Hooks only seed (level, balance, language) or read state.
// profile-a is the age-2 track (starts at L1, idle hint after 6 s); profile-b is the age-5 track (starts at L5, no idle hint).
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getBuildingHit,
  getHabitatInfo,
  getSpokenLineCount,
  getStableBox,
  placeCurrentAnimalCorrectly,
  readBalanceSec,
  readStarCount,
  seedBalanceSec,
  seedHabitatLevel,
  seedLanguageSetting,
  tapHome,
  tapTestId,
  tapWorldBuilding,
  waitForHabitatReady,
  waitForScene,
  waitForSpokenLine,
  wrongHomeId,
  type PageRect,
  type ProfileTestId,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_TAP = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enter(
  page: Page,
  profile: ProfileTestId,
  opts: { level?: number; balanceSec?: number; lang?: 'en' | 'fr' | 'both' } = {},
): Promise<void> {
  await enterWorldByTap(page, profile, 'nature-lab', 'who-lives-here', {
    beforeEnter: async () => {
      if (opts.lang) await seedLanguageSetting(page, opts.lang);
      if (opts.level !== undefined) await seedHabitatLevel(page, opts.level);
      if (opts.balanceSec !== undefined) await seedBalanceSec(page, opts.balanceSec);
    },
  });
}

/** Places every animal of the current round and returns how many were placed. */
async function playRound(page: Page): Promise<number> {
  const first = await waitForHabitatReady(page);
  const total = first.round.total;
  for (let i = 0; i < total; i++) await placeCurrentAnimalCorrectly(page, 15_000);
  return total;
}

test.describe('who lives here: map, picker and journey', () => {
  test('[AC-01] real-tap journey: profile -> Nature Lab -> picker -> Who Lives Here? -> one round -> back to the map', async ({ page }) => {
    test.setTimeout(90_000);
    await enter(page, 'profile-a');
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('HabitatScene');
    expect(scenes).not.toContain('MapScene');
    expect(scenes).not.toContain('HidingScene');
    expect(await readStarCount(page)).toBe(0);

    const total = await playRound(page);
    expect(total).toBeGreaterThanOrEqual(2);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/1$/, { timeout: 15_000 });

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('HabitatScene');
  });

  test('[AC-01] the game opens only from the Nature Lab building and its picker card', async ({ page }) => {
    test.setTimeout(90_000);
    for (const worldId of ['language-house', 'number-garden', 'art-studio']) {
      await tapWorldBuilding(page, 'profile-a', worldId);
      await page.waitForTimeout(1200);
      expect(await getActiveScenes(page), `${worldId} must not open Who Lives Here?`).not.toContain('HabitatScene');
      await expect(page.locator('[data-testid="game-picker-who-lives-here"]'), `${worldId} must not show its card`).toHaveCount(0);
    }
    await tapWorldBuilding(page, 'profile-a', 'nature-lab');
    await page.locator('[data-testid="game-picker-who-lives-here"]').waitFor({ state: 'visible', timeout: 10_000 });
    expect(await getActiveScenes(page)).not.toContain('HabitatScene');
    await tapTestId(page, 'game-picker-who-lives-here');
    await waitForScene(page, 'HabitatScene');
  });

  test('[AC-16] the Nature Lab building opens a picker with two big cards (Who\'s Hiding? first) and a close button', async ({ page }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'nature-lab');
    const ids = ['game-picker-who-is-hiding', 'game-picker-who-lives-here', 'game-picker-close'];
    const vp = page.viewportSize()!;
    const landscape = vp.width > vp.height;
    const boxes: Record<string, PageRect> = {};
    for (const id of ids) {
      const box = await getStableBox(page, id);
      boxes[id] = box;
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.x).toBeGreaterThanOrEqual(0);
      expect(box.y).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box.y + box.height).toBeLessThanOrEqual(vp.height + 0.5);
    }
    const hiding = boxes['game-picker-who-is-hiding'];
    const lives = boxes['game-picker-who-lives-here'];
    // RTL chrome: the first card is on the right in landscape and on top in portrait.
    if (landscape) expect(hiding.x).toBeGreaterThan(lives.x);
    else expect(hiding.y).toBeLessThan(lives.y);
    expect(await page.locator('[data-testid="game-picker-who-is-hiding"]').evaluate((el) => el.closest('[dir="rtl"]') !== null)).toBe(true);

    // Close: stays on the map, no game opens.
    await tapTestId(page, 'game-picker-close');
    await expect(page.locator('[data-testid="game-picker-who-lives-here"]')).toHaveCount(0);
    await waitForScene(page, 'MapScene');
    const scenes = await getActiveScenes(page);
    expect(scenes).not.toContain('HabitatScene');
    expect(scenes).not.toContain('HidingScene');
    expect(await getBuildingHit(page, 'nature-lab')).not.toBeNull();

    // The first card still opens Who's Hiding?.
    const hit = (await getBuildingHit(page, 'nature-lab'))!;
    await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
    await tapTestId(page, 'game-picker-who-is-hiding');
    await waitForScene(page, 'HidingScene');
    expect(await getActiveScenes(page)).not.toContain('HabitatScene');
  });
});

test.describe('who lives here: placing animals', () => {
  test('[AC-02] @single-orientation a correct tap walks the animal home, the next animal comes, and the round earns a star', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a');
    const before = await waitForHabitatReady(page);
    const lines0 = await getSpokenLineCount(page);
    const stars0 = await readStarCount(page);
    expect(before.round.placed).toBe(0);

    await tapHome(page, before.currentAnimal.homeId);
    await expect
      .poll(async () => (await getHabitatInfo(page))?.homes.find((h) => h.id === before.currentAnimal.homeId)?.count ?? -1, { timeout: 8_000 })
      .toBe(1);
    await waitForSpokenLine(page, (l) => l.lineId === 'habitat.correct.he' && l.lang === 'he', 8_000, lines0);

    const next = await waitForHabitatReady(page);
    expect(next.round.placed).toBe(1);
    expect(next.currentAnimal.id).not.toBe(before.currentAnimal.id);
    expect(next.currentAnimal.tries).toBe(0);
    expect(next.currentAnimal.hinted).toBe(false);
    expect(await readStarCount(page)).toBe(stars0); // not the last animal: no star yet

    // The star comes with the LAST animal of the round (3 animals), not the second one.
    for (let placed = next.round.placed; placed < next.round.total; placed++) await placeCurrentAnimalCorrectly(page, 15_000);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(new RegExp(`${stars0 + 1}$`), { timeout: 15_000 });
  });

  test('[AC-03] @single-orientation a wrong tap is no failure: the animal stays, the child retries, and the balance never drops', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a', { balanceSec: 300 });
    const before = await waitForHabitatReady(page);
    const balance0 = await readBalanceSec(page);
    expect(balance0).toBeGreaterThanOrEqual(300);
    const lines0 = await getSpokenLineCount(page);

    await tapHome(page, wrongHomeId(before));
    await waitForSpokenLine(page, (l) => l.lineId === 'habitat.wrong.he' && l.lang === 'he', 8_000, lines0);
    const after = await getHabitatInfo(page);
    expect(after?.currentAnimal?.id).toBe(before.currentAnimal.id);
    expect(after?.currentAnimal?.tries).toBe(1);
    expect(after?.round.placed).toBe(0);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance0);

    // Retry: after the short lock the right home is accepted, and the round goes on.
    const retry = await waitForHabitatReady(page);
    expect(retry.currentAnimal.id).toBe(before.currentAnimal.id);
    await tapHome(page, retry.currentAnimal.homeId);
    const next = await waitForHabitatReady(page);
    expect(next.round.placed).toBe(1);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance0);
  });

  test('[AC-10] @single-orientation voice: Hebrew ask line then the animal name in the round language; praise and home word; Hebrew retry line', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a', { lang: 'fr' });
    const info = await waitForHabitatReady(page);
    expect(info.lang).toBe('fr');
    const id = info.currentAnimal.id;

    await waitForSpokenLine(page, (l) => l.lineId === 'habitat.ask.he' && l.lang === 'he', 10_000);
    const name = await waitForSpokenLine(page, (l) => l.lineId === `habitat.name.${id}.fr` && l.lang === 'fr', 10_000);
    expect(name.text?.length ?? 0).toBeGreaterThan(0);

    const lines0 = await getSpokenLineCount(page);
    await tapHome(page, wrongHomeId(info));
    await waitForSpokenLine(page, (l) => l.lineId === 'habitat.wrong.he' && l.lang === 'he', 8_000, lines0);

    const retry = await waitForHabitatReady(page);
    const lines1 = await getSpokenLineCount(page);
    await tapHome(page, retry.currentAnimal.homeId);
    await waitForSpokenLine(page, (l) => l.lineId === 'habitat.correct.he' && l.lang === 'he', 8_000, lines1);
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.home.${retry.currentAnimal.homeId}.fr` && l.lang === 'fr', 8_000, lines1);
  });

  test('[AC-10] @single-orientation the English setting speaks English tokens only', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a', { lang: 'en' });
    const info = await waitForHabitatReady(page);
    expect(info.lang).toBe('en');
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.name.${info.currentAnimal.id}.en` && l.lang === 'en', 10_000);
  });
});

test.describe('who lives here: levels', () => {
  test('[AC-05] @single-orientation age 2 seeded at level 3 plays one clean round and the next round is level 4', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(120_000);
    // Pin the language: the level is per language, and 'both' picks the next round's language at random.
    await enter(page, 'profile-a', { level: 3, lang: 'en' });
    const first = await waitForHabitatReady(page);
    expect(first.level).toBe(3);
    expect(first.lang).toBe('en');
    expect(first.homes).toHaveLength(3);
    expect(first.round.total).toBe(3);

    for (let i = 0; i < first.round.total; i++) await placeCurrentAnimalCorrectly(page, 15_000);
    await expect
      .poll(async () => (await getHabitatInfo(page))?.round.index ?? -1, { timeout: 20_000 })
      .toBeGreaterThan(first.round.index);
    const next = await waitForHabitatReady(page, 20_000);
    expect(next.lang).toBe('en');
    expect(next.level).toBe(4);
    expect(next.homes).toHaveLength(3);
  });

  test('[AC-06] @single-orientation age 5 seeded at level 8 shows 4 homes, no text bubble, speaks the clue, and completes a round', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(120_000);
    await enter(page, 'profile-b', { level: 8, lang: 'en' });
    const info = await waitForHabitatReady(page);
    expect(info.level).toBe(8);
    expect(info.homes).toHaveLength(4);
    expect(info.request).toBe('riddle');
    expect(info.textBubble).toBe(false);
    await expect(page.locator('[data-testid="prompt-bubble"]')).toHaveCount(0);
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.clue.${info.currentAnimal.id}.en` && l.lang === 'en', 12_000);

    for (let i = 0; i < info.round.total; i++) await placeCurrentAnimalCorrectly(page, 15_000);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/1$/, { timeout: 15_000 });
  });

  test('[AC-19] @single-orientation age 5 hears the descriptive clue after a wrong tap, and gets no idle hint', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-b', { level: 5, lang: 'fr' });
    const info = await waitForHabitatReady(page);
    expect(info.level).toBe(5);
    expect(info.homes).toHaveLength(3);
    const lines0 = await getSpokenLineCount(page);
    await tapHome(page, wrongHomeId(info));
    await waitForSpokenLine(page, (l) => l.lineId === 'habitat.wrong.he' && l.lang === 'he', 8_000, lines0);
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.clue.${info.currentAnimal.id}.fr` && l.lang === 'fr', 8_000, lines0);

    // No idle hint at age 5, even well past the age-2 delay of 6 s.
    const retry = await waitForHabitatReady(page);
    await page.waitForTimeout(7_000);
    expect((await getHabitatInfo(page))?.currentAnimal?.hinted).toBe(false);
    expect(retry.currentAnimal.hinted).toBe(false);
  });

  test('[AC-19] @single-orientation age 2 gets an idle hint after 6 s that marks the trial hinted', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    const info = await waitForHabitatReady(page);
    expect(info.currentAnimal.hinted).toBe(false);
    await expect
      .poll(async () => (await getHabitatInfo(page))?.currentAnimal?.hinted ?? false, { timeout: 20_000 })
      .toBe(true);
  });
});

test.describe('who lives here: smoke', () => {
  test('[AC-11] playable in both orientations: homes and animal inside the viewport with tap targets of at least 64 px', async ({ page }) => {
    test.setTimeout(90_000);
    await enter(page, 'profile-a', { level: 3 });
    const info = await waitForHabitatReady(page);
    const vp = page.viewportSize()!;
    const rects: Array<[string, PageRect]> = [
      ...info.homes.map((h): [string, PageRect] => [`home ${h.id}`, h.hit]),
      ['animal', info.currentAnimal.hit],
    ];
    for (const [name, r] of rects) {
      expect(r.width, `${name} width`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(r.height, `${name} height`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(r.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(r.y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(r.x + r.width, `${name} right`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(r.y + r.height, `${name} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
    }
    await placeCurrentAnimalCorrectly(page, 15_000);
    const next = await waitForHabitatReady(page);
    expect(next.round.placed).toBe(1);
  });

  test('[AC-12] @single-orientation works offline: after the cache is warm the game still opens and plays', async ({ page, context }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(120_000);
    await page.goto('/?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // preview environments without a service worker still have the HTTP cache
      }
    });
    await page.reload();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible({ timeout: 15_000 });

    await enter(page, 'profile-a');
    const info = await waitForHabitatReady(page);
    expect(info.homes.length).toBeGreaterThanOrEqual(2);
    await placeCurrentAnimalCorrectly(page, 15_000);
    expect((await waitForHabitatReady(page)).round.placed).toBe(1);
    await context.setOffline(false);
  });

  test('[AC-13] @single-orientation the parent area stays gated without the e2e bypass', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await page.goto('/'); // no ?e2e=1: no test hooks, no gate bypass
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __testHooks__?: unknown }).__testHooks__)).toBeUndefined();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('[data-testid="parent-exit-btn"]')).toHaveCount(0);
  });
});

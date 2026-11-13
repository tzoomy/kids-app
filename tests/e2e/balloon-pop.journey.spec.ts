// Balloon Pop Pass 1 (docs/specs/balloon-pop.md): real-tap acceptance tests.
// Every test enters through the map: profile -> Number Garden building -> picker card `game-picker-balloon-pop`.
// Balloon hit rectangles come from getBalloonInfo (page CSS px) and are tapped with real pointer clicks.
// Hooks only seed (level, balance, language) or read state. No goToScreen.
// profile-a is the age-2 track (colour balloons, starts at L1); profile-b is the age-5 track (digit balloons, starts at L5).
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getBalloonInfo,
  getSpokenLineCount,
  popCorrectBalloon,
  readBalanceSec,
  readBalloonSkill,
  readStarCount,
  seedBalanceSec,
  seedBalloonLevel,
  seedLanguageSetting,
  tapBalloon,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForBalloonReady,
  waitForScene,
  waitForSpokenLine,
  type BalloonInfo,
  type ProfileTestId,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const screenshotsDir = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../../docs/screenshots');

function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enter(
  page: Page,
  profile: ProfileTestId,
  seed: { level?: number; balanceSec?: number; lang?: 'en' | 'fr' | 'both' } = {},
): Promise<void> {
  await enterWorldByTap(page, profile, 'number-garden', 'balloon-pop', {
    beforeEnter: async () => {
      if (seed.lang !== undefined) await seedLanguageSetting(page, seed.lang);
      if (seed.level !== undefined) await seedBalloonLevel(page, seed.level);
      if (seed.balanceSec !== undefined) await seedBalanceSec(page, seed.balanceSec);
    },
  });
}

function wrongItemId(info: BalloonInfo): string {
  const other = info.balloons.find((b) => b.itemId !== info.targetItemId);
  if (!other) throw new Error('the trial has no second balloon');
  return other.itemId;
}

test.describe('balloon pop: map journey', () => {
  test('[AC-01] real-tap journey: profile -> Number Garden -> picker -> Balloon Pop -> one round -> back to the map', async ({ page }) => {
    test.setTimeout(90_000);
    // The Number Garden building opens a picker with both games; closing it stays on the map.
    await tapWorldBuilding(page, 'profile-a', 'number-garden');
    await expect(page.locator('[data-testid="game-picker-sorting-beds"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-picker-balloon-pop"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-picker-kitchen-orchestra"]')).toHaveCount(0);
    await tapTestId(page, 'game-picker-close');
    await expect(page.locator('[data-testid="game-picker-balloon-pop"]')).toHaveCount(0);
    expect(await getActiveScenes(page)).toContain('MapScene');
    expect(await getActiveScenes(page)).not.toContain('BalloonScene');

    await enter(page, 'profile-a');
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('BalloonScene');
    expect(scenes).not.toContain('MapScene');

    const first = await waitForBalloonReady(page);
    expect(first.mode).toBe('color');
    expect(await readStarCount(page)).toBe(0);
    for (let i = 1; i <= 3; i++) {
      await popCorrectBalloon(page);
      await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(i);
    }

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('BalloonScene');
  });

  test('[AC-11] smoke: playable at the current viewport, with balloon tap targets of at least 64 CSS px inside the screen', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    const size = testInfo.project.name.split('-').pop();
    for (const profile of ['profile-a', 'profile-b'] as const) {
      await enter(page, profile, { lang: 'en' });
      const info = await waitForBalloonReady(page);
      expect(info.mode).toBe(profile === 'profile-a' ? 'color' : 'digit');
      const viewport = page.viewportSize();
      if (!viewport) throw new Error('no viewport');
      for (const b of info.balloons) {
        expect(b.hit.width, `${b.itemId} width`).toBeGreaterThanOrEqual(64);
        expect(b.hit.height, `${b.itemId} height`).toBeGreaterThanOrEqual(64);
        expect(b.hit.x).toBeGreaterThanOrEqual(0);
        expect(b.hit.y).toBeGreaterThanOrEqual(0);
        expect(b.hit.x + b.hit.width).toBeLessThanOrEqual(viewport.width);
        expect(b.hit.y + b.hit.height).toBeLessThanOrEqual(viewport.height);
      }
      await page.waitForTimeout(400);
      await page.screenshot({ path: path.join(screenshotsDir, `balloon-pop-${profile === 'profile-a' ? 'age2' : 'age5'}-start-${size}.png`) });
      if (profile === 'profile-b') {
        // Retry frame: one wrong tap (the balloon wobbles; the request repeats).
        await tapBalloon(page, wrongItemId(info));
        await page.waitForTimeout(300);
        await page.screenshot({ path: path.join(screenshotsDir, `balloon-pop-retry-${size}.png`) });
        await page.waitForTimeout(500);
      }
      await popCorrectBalloon(page);
      expect((await getBalloonInfo(page))?.correctCount).toBe(1);
    }
  });
});

test.describe('balloon pop: popping', () => {
  test('[AC-02] @single-orientation a correct tap pops the balloon, adds a star, says "pop", and starts the next trial', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-b', { lang: 'en' });
    const before = await waitForBalloonReady(page);
    const stars0 = await readStarCount(page);
    const lines0 = await getSpokenLineCount(page);
    await tapBalloon(page, before.targetItemId);
    await waitForSpokenLine(page, (l) => /^balloon\.popped\.en\.\d$/.test(l.lineId) && l.lang === 'en', 8_000, lines0);
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(stars0 + 1);
    const next = await waitForBalloonReady(page);
    expect(next.correctCount).toBe(1);
    expect(next.tries).toBe(0);
    expect(next.hinted).toBe(false);
  });

  test('[AC-03] @single-orientation a wrong tap pops nothing, counts one try, repeats the request, and never reduces the balance', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-b', { lang: 'en', balanceSec: 300 });
    const before = await waitForBalloonReady(page);
    const balance0 = await readBalanceSec(page);
    expect(balance0).toBeGreaterThanOrEqual(300);
    const stars0 = await readStarCount(page);
    const lines0 = await getSpokenLineCount(page);

    await tapBalloon(page, wrongItemId(before));
    await waitForSpokenLine(page, (l) => l.lineId === 'he.retry.0' || l.lineId === 'he.retry.1', 8_000, lines0);
    await waitForSpokenLine(page, (l) => l.lineId === `balloon.${before.targetItemId}.en`, 10_000, lines0);

    const after = await getBalloonInfo(page);
    expect(after?.targetItemId).toBe(before.targetItemId);
    expect(after?.tries).toBe(1);
    expect(after?.balloons).toHaveLength(before.balloons.length);
    expect(await readStarCount(page)).toBe(stars0);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance0);
    const skill = await readBalloonSkill(page, 'profile-b', 'en');
    expect(skill?.recent).toEqual(['miss']);
  });

  test('[AC-05] @single-orientation age 2: a clean round of three real pops at L1 raises the level to L2', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enter(page, 'profile-a', { lang: 'en', level: 1 });
    const first = await waitForBalloonReady(page);
    expect(first.level).toBe(1);
    expect(first.balloons).toHaveLength(2);
    for (let i = 0; i < 3; i++) await popCorrectBalloon(page);
    const next = await waitForBalloonReady(page);
    expect(next.level).toBe(2);
    expect(next.balloons).toHaveLength(3);
    expect(next.mode).toBe('color');
    expect((await readBalloonSkill(page, 'profile-a', 'en'))?.level).toBe(2);
  });

  test('[AC-06] @single-orientation L8: six digit balloons with near distractors play correctly', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enter(page, 'profile-b', { lang: 'fr', level: 8 });
    const info = await waitForBalloonReady(page);
    expect(info.level).toBe(8);
    expect(info.mode).toBe('digit');
    expect(info.balloons).toHaveLength(6);
    const labels = info.balloons.map((b) => b.label);
    expect(new Set(labels).size).toBe(6);
    for (const label of labels) expect(label).toMatch(/^[0-9]$/);
    await popCorrectBalloon(page);
    const next = await waitForBalloonReady(page);
    expect(next.correctCount).toBe(1);
    expect(next.level).toBe(8);
  });

  test('[AC-10] @single-orientation the request uses balloon.<itemId>.<lang>, the round language and the content text (EN and FR)', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    const cases = [
      { profile: 'profile-a' as const, lang: 'en' as const, text: /^Pop the (red|blue|yellow|green|orange|purple) balloon!$/ },
      { profile: 'profile-b' as const, lang: 'fr' as const, text: /^Éclate le chiffre (un|deux|trois|quatre|cinq) !$/ },
    ];
    for (const c of cases) {
      await enter(page, c.profile, { lang: c.lang });
      const info = await waitForBalloonReady(page);
      expect(info.language).toBe(c.lang);
      expect(info.skillKey).toBe(`number-garden.balloon-pop.${c.lang}`);
      const line = await waitForSpokenLine(page, (l) => l.lineId === `balloon.${info.targetItemId}.${c.lang}`, 15_000);
      expect(line.lang).toBe(c.lang);
      expect(info.promptText).toMatch(c.text);
      if (line.text !== undefined) expect(line.text).toBe(info.promptText);
      // The voluntary replay (speaker button) repeats the same line and is not a hint.
      const lines0 = await getSpokenLineCount(page);
      await tapRect(page, info.replay);
      await waitForSpokenLine(page, (l) => l.lineId === `balloon.${info.targetItemId}.${c.lang}`, 8_000, lines0);
      expect((await getBalloonInfo(page))?.hinted).toBe(false);
    }
  });
});

test.describe('balloon pop: platform', () => {
  test('[AC-12] @single-orientation works offline: after the cache is warm the game still opens and plays', async ({ page, context }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
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
    await popCorrectBalloon(page);
    expect((await getBalloonInfo(page))?.correctCount).toBe(1);
    await context.setOffline(false);
  });

  test('[AC-13] @single-orientation the parent area stays gated without the e2e bypass', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await page.goto('/');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    expect(await page.evaluate(() => (window as unknown as { __testHooks__?: unknown }).__testHooks__)).toBeUndefined();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.locator('input[type="number"]')).toBeVisible();
    await expect(page.locator('[data-testid="parent-exit-btn"]')).toHaveCount(0);
  });
});

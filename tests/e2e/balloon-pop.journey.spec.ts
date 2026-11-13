// Balloon Pop Pass 1 (docs/specs/balloon-pop.md): real-tap acceptance tests.
// Every test enters through the map: profile -> Number Garden building -> picker card `game-picker-balloon-pop`.
// Balloon hit rectangles come from getBalloonInfo (page CSS px) and are tapped with real pointer clicks.
// Hooks only seed (level, balance, language) or read state. No goToScreen.
// profile-a is the age-2 track (colour balloons, starts at L1); profile-b is the age-5 track (digit balloons, starts at L5).
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
  getSpokenLines,
  type BalloonInfo,
  type SpokenLine,
  type ProfileTestId,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

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

  test('[AC-11] smoke: playable at the current viewport, with balloon tap targets of at least 64 CSS px inside the screen', async ({ page }) => {
    test.setTimeout(90_000);
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
      if (profile === 'profile-b') {
        // One wrong tap (the balloon wobbles; the request repeats), then the trial still plays.
        await tapBalloon(page, wrongItemId(info));
        await expect.poll(async () => (await getBalloonInfo(page))?.tries, { timeout: 5_000 }).toBe(1);
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
    // The service worker must be installed and active; otherwise the offline part proves nothing.
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'no service worker support';
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('serviceWorker.ready timed out'), 30_000));
      return Promise.race([navigator.serviceWorker.ready.then((reg) => (reg.active ? 'ready' : 'no active worker')), timeout]);
    });
    expect(sw).toBe('ready');
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

/** Deterministic device-TTS mock: every utterance ends after `durationMs` (pure JS string for addInitScript). */
async function installE2eTts(page: Page, durationMs: number): Promise<void> {
  await page.addInitScript(`(() => {
    const durationMs = ${durationMs};
    const voices = [
      { name: 'E2E Hebrew', lang: 'he-IL', default: false, localService: true, voiceURI: 'e2e-he' },
      { name: 'E2E English', lang: 'en-US', default: true, localService: true, voiceURI: 'e2e-en' },
      { name: 'E2E French', lang: 'fr-FR', default: false, localService: true, voiceURI: 'e2e-fr' },
    ];
    let timer = 0;
    const synth = {
      pending: false, speaking: false, paused: false, onvoiceschanged: null,
      getVoices: () => voices,
      cancel() { if (timer) { window.clearTimeout(timer); timer = 0; } synth.speaking = false; },
      speak(utterance) {
        synth.cancel();
        synth.speaking = true;
        timer = window.setTimeout(function () {
          timer = 0;
          synth.speaking = false;
          if (typeof utterance.onend === 'function') utterance.onend(new Event('end'));
        }, durationMs);
      },
      pause() {}, resume() {}, addEventListener() {}, removeEventListener() {}, dispatchEvent() { return false; },
    };
    var desc = Object.getOwnPropertyDescriptor(SpeechSynthesisUtterance.prototype, 'voice');
    if (desc && desc.set) {
      Object.defineProperty(SpeechSynthesisUtterance.prototype, 'voice', {
        configurable: true,
        get: function () { return desc.get.call(this); },
        set: function (v) { try { desc.set.call(this, v); } catch (e) {} },
      });
    }
    Object.defineProperty(window, 'speechSynthesis', { configurable: true, value: synth });
  })()`);
}

/** Tap the help overlay at a point that is not on the card itself (the card does not close on a card tap). */
async function closeHelpCard(page: Page): Promise<void> {
  const cardBox = await page.locator('[data-testid="help-card"]').boundingBox();
  const overlayBox = await page.locator('[data-testid="help-card-close"]').boundingBox();
  if (!cardBox || !overlayBox) throw new Error('help card or overlay not visible');
  const inRect = (pt: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }) =>
    pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height;
  const candidates = [
    { x: overlayBox.x + 12, y: overlayBox.y + overlayBox.height - 12 },
    { x: overlayBox.x + overlayBox.width - 12, y: overlayBox.y + overlayBox.height - 12 },
    { x: overlayBox.x + 12, y: overlayBox.y + overlayBox.height / 2 },
  ];
  const tap = candidates.find((pt) => !inRect(pt, cardBox));
  if (!tap) throw new Error('no free overlay tap point outside the card');
  await page.mouse.click(tap.x, tap.y);
  await expect(page.locator('[data-testid="help-card"]')).toHaveCount(0);
}

const isRetry = (l: SpokenLine): boolean => /^he\.retry\.[01]$/.test(l.lineId);

test.describe('balloon pop: hints and help (review fixes)', () => {
  test('[AC-17] @single-orientation age 2: a wrong tap during the intro still gets its retry line and hint once the intro ends', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 2500);
    await enter(page, 'profile-a', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    const intro = await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.intro', 8_000);
    await tapBalloon(page, wrongItemId(info));
    await expect.poll(async () => (await getBalloonInfo(page))?.tries, { timeout: 5_000 }).toBe(1);
    const retry = await waitForSpokenLine(page, isRetry, 15_000, intro.index);
    expect(retry.index).toBeGreaterThan(intro.index);
    // The hint repeats the request after the retry line.
    await waitForSpokenLine(page, (l) => l.lineId === `balloon.${info.targetItemId}.${info.language}`, 10_000, retry.index);
  });

  test('[AC-17] @single-orientation age 2: a wrong tap just before help opens gets its retry line and hint after the card closes', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 600);
    await enter(page, 'profile-a', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    await waitForSpokenLine(page, (l) => l.lineId === `balloon.${info.targetItemId}.en`, 10_000);
    // The hint after a wrong tap waits for the wobble; open help inside that window.
    await tapBalloon(page, wrongItemId(info));
    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    expect((await getBalloonInfo(page))?.tries).toBe(1);
    const help = await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.help', 8_000);
    expect((await getSpokenLines(page, help.index)).some(isRetry)).toBe(false);
    await closeHelpCard(page);
    await waitForSpokenLine(page, isRetry, 10_000, help.index);
  });

  test('[AC-17] @single-orientation age 2: a speaker replay that cuts the intro short does not block later hints', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 2500); // a long intro, so the replay tap lands inside it
    await enter(page, 'profile-a', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.intro', 8_000);
    await tapRect(page, info.replay);
    const lineId = `balloon.${info.targetItemId}.en`;
    const replayed = await waitForSpokenLine(page, (l) => l.lineId === lineId, 8_000);
    // Then, idle: the age-2 idle hint (the request again) still comes.
    await waitForSpokenLine(page, (l) => l.lineId === lineId, 15_000, replayed.index + 1);
    // And a wrong tap still gets its retry line.
    const before = await getSpokenLineCount(page);
    await tapBalloon(page, wrongItemId(info));
    await waitForSpokenLine(page, isRetry, 10_000, before);
  });

  test('[AC-17] @single-orientation help opened during the intro: the intro plays again once the card closes', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 2500);
    await enter(page, 'profile-a', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    const intro = await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.intro', 8_000);
    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.help', 8_000, intro.index + 1);
    await closeHelpCard(page);
    const again = await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.intro', 10_000, intro.index + 1);
    await waitForSpokenLine(page, (l) => l.lineId === `balloon.${info.targetItemId}.en`, 10_000, again.index + 1);
  });

  test('[AC-17] @single-orientation age 5: the first wrong tap keeps its retry line when help opens right after it', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 600);
    await enter(page, 'profile-b', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    await waitForSpokenLine(page, (l) => l.lineId === `balloon.${info.targetItemId}.en`, 10_000);
    // The age-5 retry line waits for the wobble; open help inside that window (pre-measured, raw clicks for speed).
    const helpBox = await page.locator('[data-testid="hud-help"]').boundingBox();
    if (!helpBox) throw new Error('no help button');
    const wrong = info.balloons.find((b) => b.itemId === wrongItemId(info))!.hit;
    await page.mouse.click(wrong.x + wrong.width / 2, wrong.y + wrong.height / 2);
    await page.mouse.click(helpBox.x + helpBox.width / 2, helpBox.y + helpBox.height / 2);
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    expect((await getBalloonInfo(page))?.tries).toBe(1);
    const help = await waitForSpokenLine(page, (l) => l.lineId === 'he.balloon.help', 8_000);
    // Keep the card open past the wobble delay, so the retry falls due while help is up.
    await page.waitForTimeout(1_000);
    expect((await getSpokenLines(page, help.index)).some(isRetry)).toBe(false);
    await closeHelpCard(page);
    await waitForSpokenLine(page, isRetry, 10_000, help.index);
  });

  test('[AC-17] @single-orientation age 2: the idle hint repeats while the child stays idle', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 500);
    await enter(page, 'profile-a', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    const lineId = `balloon.${info.targetItemId}.en`;
    const first = await waitForSpokenLine(page, (l) => l.lineId === lineId, 10_000);
    // Idle hint after 6 s: the request again; then the idle clock restarts and a second hint follows.
    const hint1 = await waitForSpokenLine(page, (l) => l.lineId === lineId && l.index > first.index, 12_000, first.index + 1);
    const hint2 = await waitForSpokenLine(page, (l) => l.lineId === lineId && l.index > hint1.index, 12_000, hint1.index + 1);
    expect(hint2.at - hint1.at).toBeGreaterThanOrEqual(5_000);
    expect((await getBalloonInfo(page))?.hinted).toBe(true);
  });

  test('[AC-17] @single-orientation a correct pop never starts the next trial behind the help card', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await installE2eTts(page, 600);
    await enter(page, 'profile-b', { lang: 'en' });
    const info = await waitForBalloonReady(page);
    await tapBalloon(page, info.targetItemId);
    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(1);
    // Well past the pop line and follow-up: still no new trial while the card is open.
    await page.waitForTimeout(5_000);
    expect(await getBalloonInfo(page)).toBeNull();
    await closeHelpCard(page);
    const next = await waitForBalloonReady(page);
    expect(next.correctCount).toBe(1);
  });
});

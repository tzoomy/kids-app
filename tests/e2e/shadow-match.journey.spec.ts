// Shadow Match Pass 1 (docs/specs/shadow-match.md): real-tap acceptance tests.
// Every test enters through the map (profile -> Nature Lab building -> picker card) and taps hit rectangles read from
// getShadowInfo with real pointer clicks. Hooks only seed (level, language, balance) or read state. No goToScreen.
// profile-a is the age-2 track (starts at L1: two silhouettes, sound cue); profile-b is the age-5 track (starts at L5).
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getShadowInfo,
  getSpokenLineCount,
  getSpokenLines,
  matchCorrectShadow,
  readBalanceSec,
  readShadowSkill,
  readStarCount,
  seedBalanceSec,
  seedLanguageSetting,
  seedShadowLevel,
  tapRect,
  tapShadow,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  waitForShadowReady,
  waitForSpokenLine,
  type ProfileTestId,
  type ShadowInfo,
  type SpokenLine,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const E2E_TTS_MS = 600;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

/** Deterministic device-TTS mock (same shape as the Who's Hiding? journey): every utterance ends after E2E_TTS_MS. */
async function installE2eTts(page: Page, durationMs = E2E_TTS_MS): Promise<void> {
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

async function enter(
  page: Page,
  profile: ProfileTestId,
  seed: { level?: number; balanceSec?: number; lang?: 'en' | 'fr' | 'both' } = {},
): Promise<ShadowInfo> {
  await enterWorldByTap(page, profile, 'nature-lab', 'shadow-match', {
    beforeEnter: async () => {
      if (seed.lang !== undefined) await seedLanguageSetting(page, seed.lang);
      if (seed.level !== undefined) await seedShadowLevel(page, seed.level);
      if (seed.balanceSec !== undefined) await seedBalanceSec(page, seed.balanceSec);
    },
  });
  return waitForShadowReady(page, 20_000);
}

function wrongId(info: ShadowInfo): string {
  const other = info.shadows.find((s) => s.animalId !== info.targetId);
  if (!other) throw new Error('no wrong silhouette in the trial');
  return other.animalId;
}

test.beforeEach(async ({ page }) => {
  await installE2eTts(page);
});

test.describe('shadow match: map journey', () => {
  test('[AC-01] real-tap journey: profile -> Nature Lab -> picker -> Shadow Match -> one round -> back to the map', async ({ page }) => {
    test.setTimeout(90_000);
    // The Nature Lab building opens a picker with both games; closing it stays on the map.
    await tapWorldBuilding(page, 'profile-a', 'nature-lab');
    for (const id of ['game-picker-who-is-hiding', 'game-picker-shadow-match', 'game-picker-close']) {
      await expect(page.locator(`[data-testid="${id}"]`)).toBeVisible();
    }
    await tapTestId(page, 'game-picker-close');
    await expect(page.locator('[data-testid="game-picker-shadow-match"]')).toBeHidden();
    expect(await getActiveScenes(page)).toContain('MapScene');
    expect(await getActiveScenes(page)).not.toContain('ShadowScene');

    const first = await enter(page, 'profile-a');
    expect(await getActiveScenes(page)).toContain('ShadowScene');
    expect(first.level).toBe(1);
    expect(first.shadows).toHaveLength(2);
    expect(first.shadows.every((s) => s.silhouette)).toBe(true);
    expect(first.skillKey).toMatch(/^nature-lab\.shadow-match\.(en|fr)$/);

    for (let i = 0; i < 3; i++) await matchCorrectShadow(page);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(3);

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('ShadowScene');
  });

  test('[AC-11] smoke: playable at the current viewport, silhouettes at least 64 CSS px and on screen', async ({ page }) => {
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-b', { level: 8 });
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('no viewport');
    expect(info.shadows).toHaveLength(6);
    for (const s of info.shadows) {
      expect(s.hit.width, `${s.animalId} width`).toBeGreaterThanOrEqual(64);
      expect(s.hit.height, `${s.animalId} height`).toBeGreaterThanOrEqual(64);
      expect(s.hit.x).toBeGreaterThanOrEqual(0);
      expect(s.hit.y).toBeGreaterThanOrEqual(0);
      expect(s.hit.x + s.hit.width).toBeLessThanOrEqual(viewport.width + 0.5);
      expect(s.hit.y + s.hit.height).toBeLessThanOrEqual(viewport.height + 0.5);
    }
    await matchCorrectShadow(page);
  });
});

test.describe('shadow match: trials', () => {
  test('[AC-02] [AC-10] @single-orientation a correct tap reveals only that silhouette, adds a star, and names it in the learning language then Hebrew', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-a', { lang: 'fr', level: 2 });
    expect(info.language).toBe('fr');
    expect(info.speak).toBe('sound');
    const cue = await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.sound.fr`, 15_000);
    expect(cue.lang).toBe('fr');
    const since = await getSpokenLineCount(page);

    await tapShadow(page, info.targetId);
    await expect
      .poll(async () => {
        const now = await getShadowInfo(page);
        if (!now?.done) return 'not done';
        return now.shadows.map((s) => `${s.animalId}:${s.silhouette ? 'dark' : 'shown'}`).sort().join(',');
      }, { timeout: 5_000 })
      .toBe(
        info.shadows
          .map((s) => `${s.animalId}:${s.animalId === info.targetId ? 'shown' : 'dark'}`)
          .sort()
          .join(','),
      );
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(1);

    const reveal = await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.reveal.fr`, 10_000, since);
    const he = await waitForSpokenLine(page, (l) => l.lineId === `he.shadow.${info.targetId}`, 10_000, since);
    expect(reveal.lang).toBe('fr');
    expect(he.lang).toBe('he');
    expect(he.text).toMatch(/^זה .+!$/);
    expect(reveal.index).toBeLessThan(he.index);
    const names = (await getSpokenLines(page, since)).filter((l) => l.lineId.startsWith(`shadow.${info.targetId}.reveal.`));
    expect(names.map((l) => l.lang)).toEqual(['fr']);

    const next = await waitForShadowReady(page, 20_000);
    expect(next.shadows.every((s) => s.silhouette)).toBe(true);
  });

  test('[AC-03] @single-orientation a wrong tap reveals nothing, counts a try, repeats the cue, and never reduces leisure', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-b', { lang: 'en', level: 6, balanceSec: 120 });
    expect(info.speak).toBe('sound');
    await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.sound.en`, 15_000);
    const balance = await readBalanceSec(page);
    const since = await getSpokenLineCount(page);

    await tapShadow(page, wrongId(info));
    await expect.poll(async () => (await getShadowInfo(page))?.tries, { timeout: 5_000 }).toBe(1);
    const after = await getShadowInfo(page);
    expect(after?.done).toBe(false);
    expect(after?.shadows.every((s) => s.silhouette)).toBe(true);
    await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.sound.en`, 8_000, since);
    expect(await readStarCount(page)).toBe(0);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balance);
  });

  test('[AC-10] @single-orientation a name-only cue speaks the name in the learning language', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-b', { lang: 'en', level: 5 });
    expect(info.speak).toBe('name');
    expect(info.promptText).toMatch(/^Find .+!$/);
    const cue = await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.name.en`, 15_000);
    expect(cue.lang).toBe('en');
    expect(info.shadows).toHaveLength(4);
  });

  test('[AC-05] @single-orientation age 2 moves from L1 to L2 after a clean round of three real taps', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(90_000);
    const first = await enter(page, 'profile-a', { lang: 'en', level: 1 });
    expect(first.level).toBe(1);
    expect(first.shadows).toHaveLength(2);
    for (let i = 0; i < 3; i++) await matchCorrectShadow(page);
    const next = await waitForShadowReady(page, 20_000);
    expect(next.level).toBe(2);
    expect(next.shadows).toHaveLength(3);
    expect((await readShadowSkill(page, 'profile-a', 'en'))?.level).toBe(2);
  });

  test('[AC-06] @single-orientation L8 plays six silhouettes with the short sound cue', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-b', { lang: 'fr', level: 8 });
    expect(info.level).toBe(8);
    expect(info.shadows).toHaveLength(6);
    expect(new Set(info.shadows.map((s) => s.animalId)).size).toBe(6);
    await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.sound-short.fr`, 15_000);
    await matchCorrectShadow(page);
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(1);
  });

  test('[AC-12] @single-orientation Shadow Match keeps working offline', async ({ page, context }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    await enter(page, 'profile-a');
    await context.setOffline(true);
    await matchCorrectShadow(page);
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(1);
    await context.setOffline(false);
  });

  test('[AC-13] @single-orientation the parent area stays gated without the e2e bypass', async ({ page }) => {
    landscapeOnly(test.info());
    await page.goto('/');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.getByText('אזור הורים')).toBeVisible();
    await expect(page.getByText(/כמה זה/)).toBeVisible();
    await page.getByRole('button', { name: 'ביטול' }).click();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
  });
});

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

test.describe('shadow match: hints and help', () => {
  test('[AC-18] @single-orientation age 2: a wrong tap during the intro still gets its retry line and hint once the intro ends', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    await installE2eTts(page, 2500); // a long intro, so the tap lands inside it
    const info = await enter(page, 'profile-a', { lang: 'en' });
    const intro = await waitForSpokenLine(page, (l) => l.lineId === 'he.shadow.intro', 8_000);
    await tapShadow(page, wrongId(info));
    await expect.poll(async () => (await getShadowInfo(page))?.tries, { timeout: 5_000 }).toBe(1);
    const retry = await waitForSpokenLine(page, isRetry, 15_000, intro.index);
    expect(retry.index).toBeGreaterThan(intro.index);
    // The hint repeats the cue after the retry line.
    await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.sound.en`, 10_000, retry.index);
  });

  test('[AC-18] @single-orientation age 2: a speaker replay that cuts the intro short does not block later hints', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    await installE2eTts(page, 2500); // a long intro, so the replay tap lands inside it
    const info = await enter(page, 'profile-a', { lang: 'en' });
    await waitForSpokenLine(page, (l) => l.lineId === 'he.shadow.intro', 8_000);
    await tapRect(page, info.replay);
    const lineId = `shadow.${info.targetId}.sound.en`;
    const replayed = await waitForSpokenLine(page, (l) => l.lineId === lineId, 8_000);
    // Then, idle: the age-2 idle hint (the cue again) still comes.
    await waitForSpokenLine(page, (l) => l.lineId === lineId, 15_000, replayed.index + 1);
    // And a wrong tap still gets its retry line.
    const before = await getSpokenLineCount(page);
    await tapShadow(page, wrongId(info));
    await waitForSpokenLine(page, isRetry, 10_000, before);
  });

  test('[AC-18] @single-orientation help opened during the intro: the intro plays again once the card closes', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    await installE2eTts(page, 2500);
    const info = await enter(page, 'profile-a', { lang: 'en' });
    const intro = await waitForSpokenLine(page, (l) => l.lineId === 'he.shadow.intro', 8_000);
    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await waitForSpokenLine(page, (l) => l.lineId === 'he.shadow.help', 8_000, intro.index + 1);
    await closeHelpCard(page);
    const again = await waitForSpokenLine(page, (l) => l.lineId === 'he.shadow.intro', 10_000, intro.index + 1);
    await waitForSpokenLine(page, (l) => l.lineId === `shadow.${info.targetId}.sound.en`, 10_000, again.index + 1);
  });

  test('[AC-18] @single-orientation age 2: the idle hint repeats while the child stays idle', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-a', { lang: 'en' });
    const lineId = `shadow.${info.targetId}.sound.en`;
    const first = await waitForSpokenLine(page, (l) => l.lineId === lineId, 10_000);
    // Idle hint after 6 s: the cue again; then the idle clock restarts and a second hint follows.
    const hint1 = await waitForSpokenLine(page, (l) => l.lineId === lineId, 12_000, first.index + 1);
    const hint2 = await waitForSpokenLine(page, (l) => l.lineId === lineId, 12_000, hint1.index + 1);
    expect(hint2.at - hint1.at).toBeGreaterThanOrEqual(5_000);
    expect((await getShadowInfo(page))?.hinted).toBe(true);
  });

  test('[AC-18] @single-orientation a correct tap never starts the next trial behind the help card', async ({ page }) => {
    landscapeOnly(test.info());
    test.setTimeout(60_000);
    const info = await enter(page, 'profile-b', { lang: 'en' });
    await tapShadow(page, info.targetId);
    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(1);
    // Well past the reveal lines and follow-up: the answered trial is still on screen while the card is open.
    await page.waitForTimeout(6_000);
    const during = await getShadowInfo(page);
    expect(during?.done).toBe(true);
    expect(during?.targetId).toBe(info.targetId);
    await closeHelpCard(page);
    const next = await waitForShadowReady(page, 20_000);
    expect(next.correctCount).toBe(1);
  });
});

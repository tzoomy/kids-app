import { test, expect, type Page } from '@playwright/test';
import {
  clickGame,
  enterWorldByTap,
  seedHidingLevel,
  getBuildingHit,
  getGameSize,
  getRoundInfo,
  getSpokenLines,
  isListening,
  tapTestId,
  waitForRoundReady,
  waitForScene,
  waitForSpokenLine,
  type PageRect,
  type SpokenLine,
} from './helpers/journey';

/** Device-TTS mock duration (ms). Kept short enough to poll, long enough not to miss isListening. */
const E2E_TTS_MS = 1000;
/** Longest spoken line: the recorded Hebrew intro/help clips (#39, on main) last about 10-12 s; device TTS is mocked at E2E_TTS_MS. */
const SPOKEN_LINE_MAX_MS = 14_000;
/** Age-2 idle auto-hint delay from who-is-hiding.json. */
const HINT_DELAY_MS = 6000;
const SPEAKER_RADIUS_GAME = 44;
const MIN_HIT_PX = 64;

/** Install a SpeechSynthesis stand-in with he/en/fr voices and a fixed utterance length. */
async function installE2eTts(page: Page): Promise<void> {
  // Pure JS string: Playwright serializes addInitScript callbacks from the test source,
  // so type annotations in a function body can break the mock in the browser.
  await page.addInitScript(`(() => {
    const durationMs = ${E2E_TTS_MS};
    const voices = [
      { name: 'E2E Hebrew', lang: 'he-IL', default: false, localService: true, voiceURI: 'e2e-he' },
      { name: 'E2E English', lang: 'en-US', default: true, localService: true, voiceURI: 'e2e-en' },
      { name: 'E2E French', lang: 'fr-FR', default: false, localService: true, voiceURI: 'e2e-fr' },
    ];
    let timer = 0;
    const synth = {
      pending: false,
      speaking: false,
      paused: false,
      onvoiceschanged: null,
      getVoices: () => voices,
      cancel() {
        if (timer) {
          window.clearTimeout(timer);
          timer = 0;
        }
        synth.speaking = false;
      },
      speak(utterance) {
        synth.cancel();
        synth.speaking = true;
        timer = window.setTimeout(function () {
          timer = 0;
          synth.speaking = false;
          if (typeof utterance.onend === 'function') {
            utterance.onend(new Event('end'));
          }
        }, durationMs);
      },
      pause() {},
      resume() {},
      addEventListener() {},
      removeEventListener() {},
      dispatchEvent() { return false; },
    };
    // Fake voice objects are enough for hasVoiceFor('he'), but assigning one to
    // SpeechSynthesisUtterance.voice throws and rejects play(), hanging the intro.
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

function rectsOverlap(a: PageRect, b: PageRect): boolean {
  return a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
}

async function speakerPageRect(page: Page): Promise<PageRect> {
  const info = await getRoundInfo(page);
  if (!info?.replayCenter) throw new Error('no replayCentre in getRoundInfo');
  const size = await getGameSize(page);
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  const r = SPEAKER_RADIUS_GAME;
  const { x, y } = info.replayCenter;
  return {
    x: box.x + ((x - r) / size.width) * box.width,
    y: box.y + ((y - r) / size.height) * box.height,
    width: ((2 * r) / size.width) * box.width,
    height: ((2 * r) / size.height) * box.height,
  };
}

/** Tap the help overlay at a point that is not on the card or the speaker. */
async function clickOverlayOutsideCard(page: Page): Promise<void> {
  const cardBox = await page.locator('[data-testid="help-card"]').boundingBox();
  const overlayBox = await page.locator('[data-testid="help-card-close"]').boundingBox();
  if (!cardBox || !overlayBox) throw new Error('help card or overlay not visible');
  let speaker: PageRect | null = null;
  try {
    speaker = await speakerPageRect(page);
  } catch {
    speaker = null;
  }
  const inRect = (pt: { x: number; y: number }, r: PageRect) =>
    pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height;
  const candidates = [
    { x: overlayBox.x + 12, y: overlayBox.y + 12 },
    { x: overlayBox.x + overlayBox.width - 12, y: overlayBox.y + 12 },
    { x: overlayBox.x + 12, y: overlayBox.y + overlayBox.height - 12 },
    { x: overlayBox.x + overlayBox.width / 2, y: overlayBox.y + 12 },
  ];
  const tap = candidates.find((pt) => !inRect(pt, cardBox) && (!speaker || !inRect(pt, speaker)));
  if (!tap) throw new Error('no free overlay tap point outside the card and speaker');
  await page.mouse.click(tap.x, tap.y);
}

async function hinted(page: Page): Promise<boolean> {
  const info = await getRoundInfo(page);
  return info?.hinted === true;
}

function isIntro(line: SpokenLine): boolean {
  return line.lineId === 'he.hiding.intro' && line.lang === 'he';
}

function isHelp(line: SpokenLine): boolean {
  return line.lineId === 'he.hiding.help' && line.lang === 'he';
}

function isRequest(line: SpokenLine): boolean {
  return line.lineId.startsWith('hiding.') && !line.lineId.startsWith('hiding.found.');
}

async function waitForRequest(page: Page, since?: number): Promise<SpokenLine> {
  return waitForSpokenLine(page, isRequest, 15_000, since);
}

/** Taps the Nature Lab building from an already-open map (no page reload). */
async function enterNatureLabFromMap(page: Page): Promise<void> {
  await waitForScene(page, 'MapScene');
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  const deadline = Date.now() + 15_000;
  for (;;) {
    const current = await getBuildingHit(page, 'nature-lab');
    const settled = current !== null && current.width > 20 && previous !== null && Math.abs(current.width - previous.width) < 0.5;
    previous = current;
    rect = current;
    if (settled) break;
    if (Date.now() > deadline) throw new Error('Nature Lab building hit rectangle never became available and stable');
    await page.waitForTimeout(100);
  }
  const hit = (await getBuildingHit(page, 'nature-lab')) ?? rect;
  if (!hit) throw new Error('Nature Lab building has no hit rectangle');
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
  // Nature Lab opens its game picker; Who's Hiding? is a card.
  await tapTestId(page, 'game-picker-who-is-hiding');
  await waitForScene(page, 'HidingScene');
}

test.describe("Who's Hiding? intro and help (Pass 1)", () => {
  test.beforeEach(async ({ page }) => {
    await installE2eTts(page);
  });

  test('[AC-32] intro plays once per visit, before the first request, and again after leaving and re-entering', async ({ page }) => {
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);

    const intro = await waitForSpokenLine(page, isIntro, 15_000);
    const request = await waitForRequest(page);
    expect(intro.index).toBeLessThan(request.index);
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(1);

    // A later request in the same visit must not play the intro again.
    const info = await getRoundInfo(page);
    expect(info).not.toBeNull();
    const correct = info!.choiceCenters[info!.correctIndex];
    await clickGame(page, correct.x, correct.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    await page.waitForFunction(() => {
      const i = (window as unknown as { __testHooks__: { getRoundInfo: () => { ready?: boolean; correctCount?: number } | null } }).__testHooks__.getRoundInfo();
      return i !== null && i.ready === true && i.correctCount === 1;
    }, undefined, { timeout: 15_000 });
    const second = await waitForRequest(page, request.index + 1);
    expect(second.index).toBeGreaterThan(request.index);
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(1);

    const afterFirstVisit = (await getSpokenLines(page)).at(-1)?.index ?? 0;
    await page.locator('[data-testid="hud-back"]').click();
    await enterNatureLabFromMap(page);
    await waitForRoundReady(page);
    const introAgain = await waitForSpokenLine(page, isIntro, 15_000, afterFirstVisit + 1);
    expect(introAgain.lang).toBe('he');
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(2);
    const requestAgain = await waitForRequest(page, introAgain.index + 1);
    expect(introAgain.index).toBeLessThan(requestAgain.index);
  });

  test('[AC-33] the help pill plays he.hiding.help', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await waitForSpokenLine(page, isIntro, 15_000);

    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    const help = await waitForSpokenLine(page, isHelp, 10_000);
    expect(help.lang).toBe('he');
    expect(help.lineId).toBe('he.hiding.help');
  });

  test('[AC-35] opening help stops audio, plays the help clip, blocks replay, and closing repeats the request', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    const firstRequest = await waitForRequest(page);

    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    const help = await waitForSpokenLine(page, isHelp, 10_000);
    expect(help.index).toBeGreaterThan(firstRequest.index);
    // The overlay is moved so it does not cover the speaker; a tap on the overlay
    // outside the card still closes it (AC-39). Closing repeats the request.
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    const afterHelp = (await getSpokenLines(page)).at(-1)!.index;
    // No further request should start while the card stays open.
    await page.waitForTimeout(400);
    const duringHelp = (await getSpokenLines(page)).filter((l) => l.index > afterHelp);
    expect(duringHelp.filter(isRequest)).toHaveLength(0);

    await clickOverlayOutsideCard(page);
    await expect(page.locator('[data-testid="help-card"]')).toHaveCount(0);
    const repeated = await waitForRequest(page, afterHelp + 1);
    expect(repeated.index).toBeGreaterThan(help.index);
  });

  test('[AC-38] @single-orientation isListening is true only while the help line plays, and false before and after it', async ({ page }) => {
    test.skip(test.info().project.name !== 'landscape-1280x800');
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await waitForRequest(page);
    // Wait until the first request has finished so listening is idle before help.
    await expect.poll(async () => isListening(page), { timeout: SPOKEN_LINE_MAX_MS }).toBe(false);

    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await waitForSpokenLine(page, isHelp, 10_000);
    await expect.poll(async () => isListening(page), { timeout: 2000 }).toBe(true);

    await expect.poll(async () => isListening(page), { timeout: SPOKEN_LINE_MAX_MS }).toBe(false);
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    expect(await isListening(page)).toBe(false);
  });

  test('[AC-39] help card and speaker do not overlap in either orientation; hit targets are at least 64px; tapping the card does not close it, the dimmer does, and the speaker stays tappable', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await waitForSpokenLine(page, isIntro, 15_000);

    await page.locator('[data-testid="hud-help"]').click();
    const card = page.locator('[data-testid="help-card"]');
    await expect(card).toBeVisible();
    const cardBox = await card.boundingBox();
    if (!cardBox) throw new Error('no help-card box');
    const speaker = await speakerPageRect(page);
    expect(speaker.width, 'speaker width').toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(speaker.height, 'speaker height').toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(Math.min(cardBox.width, cardBox.height), 'help-card hit').toBeGreaterThanOrEqual(MIN_HIT_PX);
    expect(rectsOverlap(cardBox, speaker), `card ${JSON.stringify(cardBox)} overlaps speaker ${JSON.stringify(speaker)}`).toBe(false);

    const info = await getRoundInfo(page);
    if (!info?.replayCenter) throw new Error('no replayCenter');
    await clickGame(page, info.replayCenter.x, info.replayCenter.y);
    await page.waitForTimeout(200);
    await expect(card).toBeVisible();

    await card.click();
    await expect(card).toBeVisible();

    await clickOverlayOutsideCard(page);
    await expect(card).toHaveCount(0);
  });

  test('[AC-40] @single-orientation idle hint does not fire during intro or help, only after the full delay from when they end', async ({ page }) => {
    test.skip(test.info().project.name !== 'landscape-1280x800');
    test.setTimeout(90_000);
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await waitForSpokenLine(page, isIntro, 15_000);

    // During the intro the idle hint must stay off.
    const introDeadline = Date.now() + SPOKEN_LINE_MAX_MS;
    while (Date.now() < introDeadline && !(await getSpokenLines(page)).some(isRequest)) {
      expect(await hinted(page)).toBe(false);
      await page.waitForTimeout(100);
    }
    const afterIntro = await waitForRequest(page);
    expect(await hinted(page)).toBe(false);

    // Wait until just before the full delay measured from when the intro actually ended
    // (the request line's `at`), not from when the test noticed it — under load the
    // poll can lag and a fixed 5600 ms wait would overshoot.
    const hintDueAt = afterIntro.at + HINT_DELAY_MS - 400;
    const introRemain = hintDueAt - Date.now();
    if (introRemain > 0) await page.waitForTimeout(introRemain);
    expect(await hinted(page)).toBe(false);
    await expect.poll(async () => hinted(page), { timeout: 2000 }).toBe(true);

    // Fresh visit for the help-line delay (the idle hint runs only once per request).
    await page.locator('[data-testid="hud-back"]').click();
    await enterNatureLabFromMap(page);
    await waitForRoundReady(page);
    await waitForRequest(page);
    await expect.poll(async () => isListening(page), { timeout: SPOKEN_LINE_MAX_MS }).toBe(false);
    expect(await hinted(page)).toBe(false);

    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    await waitForSpokenLine(page, isHelp, 10_000);
    const helpWatchUntil = Date.now() + SPOKEN_LINE_MAX_MS;
    while (Date.now() < helpWatchUntil) {
      expect(await hinted(page)).toBe(false);
      if (!(await isListening(page))) break;
      await page.waitForTimeout(80);
    }
    await expect.poll(async () => isListening(page), { timeout: 2000 }).toBe(false);
    expect(await hinted(page)).toBe(false);

    await clickOverlayOutsideCard(page);
    await expect(page.locator('[data-testid="help-card"]')).toHaveCount(0);
    const closedAt = Date.now();
    // Closing repeats the request; the full delay still starts from close / line end, not from ready.
    const closeRemain = closedAt + HINT_DELAY_MS - 400 - Date.now();
    if (closeRemain > 0) await page.waitForTimeout(closeRemain);
    expect(await hinted(page)).toBe(false);
    await expect.poll(async () => hinted(page), { timeout: 2000 }).toBe(true);
  });

  test('[AC-10] [AC-21] @single-orientation age-2 idle hint restores front foliage scale, does not shrink the peek, and speaks a hint', async ({ page }) => {
    test.skip(test.info().project.name !== 'landscape-1280x800');
    test.setTimeout(90_000);
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await waitForSpokenLine(page, isIntro, 15_000);
    const afterIntro = await waitForRequest(page);
    const before = await getRoundInfo(page);
    expect(before).not.toBeNull();
    expect(before!.hinted).toBe(false);
    const scaleBefore = before!.correctFrontScale!;
    const peekBefore = before!.correctPeek!;
    expect(scaleBefore).toBeGreaterThan(0);
    expect(scaleBefore).not.toBeCloseTo(1, 2); // setDisplaySize, not native scale
    expect(peekBefore).toBeGreaterThan(0);

    // Wait until the idle hint has fired and the pulse has finished (260ms × yoyo × 3).
    const hintDueAt = afterIntro.at + HINT_DELAY_MS + 200;
    const remain = hintDueAt - Date.now();
    if (remain > 0) await page.waitForTimeout(remain);
    await expect.poll(async () => hinted(page), { timeout: 3000 }).toBe(true);
    await page.waitForTimeout(1800);

    const after = await getRoundInfo(page);
    expect(after).not.toBeNull();
    expect(after!.hinted).toBe(true);
    expect(after!.correctFrontScale).toBeCloseTo(scaleBefore, 3);
    // The animal is lifted to at least 0.9; the visible peek must not shrink.
    expect(after!.correctPeek).toBeGreaterThanOrEqual(peekBefore - 1);
    // AC-10: a hint line is spoken after the request (repeat of the request on L2).
    const afterHint = (await getSpokenLines(page)).filter((l) => l.index > afterIntro.index);
    expect(afterHint.filter(isRequest).length).toBeGreaterThanOrEqual(1);
  });

  test('[AC-21] @single-orientation age 5 gets no idle auto-hint', async ({ page }) => {
    test.skip(test.info().project.name !== 'landscape-1280x800');
    test.setTimeout(40_000);
    await enterWorldByTap(page, 'profile-b', 'nature-lab');
    await waitForRoundReady(page);
    await waitForRequest(page);
    expect(await hinted(page)).toBe(false);
    await page.waitForTimeout(HINT_DELAY_MS + 500);
    expect(await hinted(page)).toBe(false);
    const info = await getRoundInfo(page);
    expect(info?.level).toBe(5);
  });

  const LOOKALIKE: Record<string, string> = {
    cat: 'lion', lion: 'cat', bear: 'panda', panda: 'bear', dog: 'rabbit', rabbit: 'dog',
  };

  test('[AC-05] @single-orientation age-2 climbs from seeded L2 to L3 after three clean trials; L3 has a same-category neighbour', async ({ page }) => {
    test.skip(test.info().project.name !== 'landscape-1280x800');
    test.setTimeout(120_000);
    await enterWorldByTap(page, 'profile-a', 'nature-lab', undefined, { beforeEnter: () => seedHidingLevel(page, 2) });
    await waitForSpokenLine(page, isIntro, 15_000);
    let stars = 0;
    const playCleanOnLevel = async (level: number, count: number): Promise<void> => {
      for (let n = 0; n < count; n++) {
        const info = await waitForRoundReady(page);
        expect(info.level, `trial still on L${level}`).toBe(level);
        const c = info.choiceCenters[info.correctIndex];
        await clickGame(page, c.x, c.y);
        stars += 1;
        await expect(page.locator('[data-testid="star-count"]')).toHaveText(new RegExp(`⭐ ${stars}`), { timeout: 8000 });
      }
    };
    // A clean engine round of 3 raises that language to L3. The next request may
    // still be L2 if the engine re-picks the other (still seeded) language.
    await playCleanOnLevel(2, 3);
    let l3 = await waitForRoundReady(page);
    if (l3.level === 2) {
      await playCleanOnLevel(2, 3);
      l3 = await waitForRoundReady(page);
    }
    expect(l3.level).toBe(3);
    expect(l3.choiceCount).toBe(3);
    expect(l3.targetId).toBeTruthy();
    expect(l3.choiceIds).toContain(LOOKALIKE[l3.targetId!]);
  });

  test('[AC-01] [AC-02] [AC-10] [AC-11] real-tap journey: Nature Lab, a found line after a correct tap, then back to the map', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    const request = await waitForRequest(page);
    expect(request.lang === 'en' || request.lang === 'fr').toBe(true);
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(1);
    const info = await getRoundInfo(page);
    expect(info).not.toBeNull();
    await clickGame(page, info!.choiceCenters[info!.correctIndex].x, info!.choiceCenters[info!.correctIndex].y);
    const found = await waitForSpokenLine(page, (l) => l.lineId.startsWith('hiding.found.'), 10_000);
    expect(found.lang).toBe(request.lang);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
  });

  test('[AC-12] @single-orientation Nature Lab stays available after going offline', async ({ page, context }) => {
    test.skip(test.info().project.name !== 'landscape-1280x800');
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await context.setOffline(true);
    await expect(page.locator('canvas')).toBeVisible();
    await expect(page.locator('[data-testid="hud-back"]')).toBeVisible();
    expect(await getRoundInfo(page)).not.toBeNull();
    await context.setOffline(false);
  });

  test('[AC-13] parent multiplication gate is shown when e2e bypass is off', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.getByText('אזור הורים')).toBeVisible();
    await expect(page.getByText(/כמה זה/)).toBeVisible();
    await page.getByRole('button', { name: 'ביטול' }).click();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
  });
});

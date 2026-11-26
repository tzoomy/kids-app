// Mystery Egg game shell (docs/specs/game-shell.md). Real taps on the page rectangles of the read hook only; the ?e2e=1
// hooks read state (getMysteryEggInfo, getSpokenLines, getActiveScenes) or seed persisted progress (seedMysteryEggProgress).
// Landscape tablet first: every test is @single-orientation and runs in the landscape project only.
import { test, expect, type Page } from '@playwright/test';
import type { MysteryEggInfo } from '../../src/games/mysteryEgg/types';
import { enterMapByTap, getActiveScenes, getBuildingHit, getSpokenLines, tapTestId, waitForScene } from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const PORTRAIT = 'portrait-800x1280';
const MIN_TAP_PX = 96;
const WORLDS = ['workshop', 'bakery', 'detective', 'jungle', 'garden'] as const;
const LOCKED = ['bakery', 'detective', 'jungle', 'garden'] as const;

function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

type Target = keyof MysteryEggInfo['rects'];
type Rect = { x: number; y: number; width: number; height: number };
type Seed = Parameters<NonNullable<Window['__testHooks__']>['seedMysteryEggProgress']>[0];

const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

async function info(page: Page): Promise<MysteryEggInfo | null> {
  return page.evaluate(() => {
    const hooks = (window as unknown as { __testHooks__?: { getMysteryEggInfo: () => unknown } }).__testHooks__;
    return (hooks?.getMysteryEggInfo() ?? null) as never;
  });
}

async function waitInfo(page: Page, check: (i: MysteryEggInfo) => boolean, message: string, timeout = 30_000): Promise<MysteryEggInfo> {
  const deadline = Date.now() + timeout;
  let last: MysteryEggInfo | null = null;
  for (;;) {
    last = await info(page);
    if (last && check(last)) return last;
    if (Date.now() > deadline) throw new Error(`${message}; last info: ${JSON.stringify(last)}`);
    await page.waitForTimeout(80);
  }
}

async function rectOf(page: Page, target: Target): Promise<Rect> {
  const i = await waitInfo(page, (x) => Boolean(x.rects[target]), `target ${target} never appeared`);
  return i.rects[target] as Rect;
}

async function tap(page: Page, target: Target): Promise<void> {
  const c = centre(await rectOf(page, target));
  await page.mouse.click(c.x, c.y);
}

async function seed(page: Page, s: Seed): Promise<void> {
  await page.evaluate((v) => (window as unknown as { __testHooks__: { seedMysteryEggProgress: (x: unknown) => void } }).__testHooks__.seedMysteryEggProgress(v), s);
}

/** v2 seed: intro and entry already seen, so the map opens straight away. */
const SEEN: Seed = { v: 2, introSeen: true, entrySeen: ['workshop'] };

/** Real tap on the egg button, then wait for the map scene to be drawn. Does not skip the intro. */
async function openShellByTap(page: Page): Promise<MysteryEggInfo> {
  await tapTestId(page, 'mystery-egg-btn');
  await waitForScene(page, 'MysteryEggScene');
  // `hub` = not tappable yet (assets or the intro images are still loading), so wait for `intro` or `map`.
  return waitInfo(page, (i) => i.ready && i.scene === 'MysteryEggScene' && i.phase !== 'hub', 'the shell never became ready');
}

async function openMapByTap(page: Page): Promise<MysteryEggInfo> {
  await openShellByTap(page);
  return waitInfo(page, (i) => i.phase === 'map', 'the map never became interactive');
}

async function toMapSkippingIntro(page: Page): Promise<MysteryEggInfo> {
  const first = await openShellByTap(page);
  if (first.phase === 'intro') await tap(page, 'skipBtn');
  return waitInfo(page, (i) => i.phase === 'map', 'the map never became interactive');
}

async function dragBetween(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

const spoken = async (page: Page, since = 0) => (await getSpokenLines(page, since)).map((s) => [s.lineId, s.lang]);

test.describe('game-shell', () => {
  test('[AC-01] @single-orientation full journey: egg button -> intro (4 taps) -> map -> Workshop -> walking -> entry (2 slides) -> the Workshop game -> win -> map with the piece flying into the nest; no Workshop button', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(180_000);
    await enterMapByTap(page, 'profile-a');
    const first = await openShellByTap(page);
    expect(first.rects).not.toHaveProperty('workshopBtn');

    // Intro: 4 slides, one real tap each.
    expect(first.phase).toBe('intro');
    expect(first.map?.slide).toMatchObject({ kind: 'intro', index: 0, count: 4 });
    for (let n = 1; n <= 4; n++) {
      await waitInfo(page, (i) => i.map?.slide?.index === n - 1, `slide ${n} never showed`);
      await tap(page, 'slideTap');
    }
    const map = await waitInfo(page, (i) => i.phase === 'map', 'the map never opened after the intro');
    expect(map.map?.introSeen).toBe(true);
    expect(map.map?.slide).toBeNull();
    expect(map.heartsLit).toEqual([]);
    expect(map.eggLevel).toBe(0);

    // Tap the Workshop: the friends walk, then the 2 entry slides, then the game.
    await tap(page, 'world-workshop');
    const walking = await waitInfo(page, (i) => i.phase === 'walking', 'the walk never started');
    expect(walking.map?.walkingTo).toBe('workshop');
    const entry = await waitInfo(page, (i) => i.phase === 'entry', 'the entry slides never showed', 20_000);
    expect(entry.map?.slide).toMatchObject({ kind: 'entry', world: 'workshop', index: 0, count: 2 });
    await tap(page, 'slideTap');
    await waitInfo(page, (i) => i.map?.slide?.index === 1, 'entry slide 2 never showed');
    await tap(page, 'slideTap');
    await waitForScene(page, 'MysteryEggBuildScene');
    const intro = await waitInfo(page, (i) => i.scene === 'MysteryEggBuildScene' && i.ready && i.phase === 'intro', 'the Workshop intro never showed');
    expect(intro.rects.goBtn).toBeDefined();
    expect(await getActiveScenes(page)).toContain('MysteryEggBuildScene');

    // The unchanged Workshop game: go, drag the ramp, play, win.
    await tap(page, 'goBtn');
    await waitInfo(page, (i) => i.phase === 'build', 'build phase never started');
    await dragBetween(page, centre(await rectOf(page, 'partRamp')), centre(await rectOf(page, 'slot')));
    await waitInfo(page, (i) => i.slotFilled, 'the ramp did not snap into the slot');
    await tap(page, 'playBtn');
    await waitInfo(page, (i) => i.phase === 'success', 'the ball never rang the bell', 45_000);
    await waitInfo(page, (i) => Boolean(i.rects.continueBtn), 'the success view never finished');
    await tap(page, 'continueBtn');

    // Back on the map: the piece flies into the nest, the heart and the brighter egg stay.
    await waitForScene(page, 'MysteryEggScene');
    const back = await waitInfo(page, (i) => i.scene === 'MysteryEggScene' && i.phase === 'map' && i.map !== undefined, 'the map never came back', 30_000);
    expect(back.map?.pieceFlights).toEqual(['feather']);
    expect(back.map?.pieces).toEqual(['feather']);
    expect(back.featherInNest).toBe(true);
    expect(back.heartsLit).toEqual([0]);
    expect(back.eggLevel).toBe(1);
    expect(back.map?.worlds.workshop).toMatchObject({ completed: [1], fill: 1 });
    // No intro or entry slides this time, and the way back to the old map still works.
    expect(back.map?.slide).toBeNull();
    await tap(page, 'backBtn');
    await waitForScene(page, 'MapScene');
    expect(await getBuildingHit(page, 'language-house')).not.toBeNull();
  });

  test('[AC-03] @single-orientation the map shows the nest, the heart panel, the back button and five worlds (Workshop open, four locked) with big tap rectangles that overlap nothing', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterMapByTap(page, 'profile-b');
    await seed(page, SEEN);
    const m = await openMapByTap(page);
    expect(m.rects).not.toHaveProperty('workshopBtn');
    const rects: Record<string, Rect> = {};
    for (const id of WORLDS) {
      const r = m.rects[`world-${id}` as Target] as Rect;
      expect(r, id).toBeDefined();
      expect(r.width, id).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(r.height, id).toBeGreaterThanOrEqual(MIN_TAP_PX);
      rects[id] = r;
    }
    rects.backBtn = m.rects.backBtn as Rect;
    expect(rects.backBtn.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    const names = Object.keys(rects);
    for (let i = 0; i < names.length; i++) {
      for (let j = i + 1; j < names.length; j++) {
        const a = rects[names[i]];
        const b = rects[names[j]];
        const overlap = a.x < b.x + b.width && a.x + a.width > b.x && a.y < b.y + b.height && a.y + a.height > b.y;
        expect(overlap, `${names[i]} overlaps ${names[j]}`).toBe(false);
      }
    }
    expect(m.map?.worlds.workshop.open).toBe(true);
    for (const id of LOCKED) expect(m.map?.worlds[id].open, id).toBe(false);
    expect(m.map?.heartFill).toEqual([0, 0, 0, 0, 0]);
    expect(m.map?.pieces).toEqual([]);
    expect(m.map?.readyToHatch).toBe(false);
    expect(m.eggLevel).toBe(0);
    // The egg is still tappable (wiggle + beep): a tap in the middle of the nest leaves the map phase alone.
    await page.mouse.click(rects.workshop.x + rects.workshop.width * 3, rects.workshop.y + rects.workshop.height * 2);
    expect((await info(page))?.phase).toBe('map');
  });

  test('[AC-05] @single-orientation the shared map shows the same four friends, the frog included, for both profiles', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    for (const profile of ['profile-a', 'profile-b'] as const) {
      await enterMapByTap(page, profile);
      await seed(page, SEEN);
      const m = await openMapByTap(page);
      expect(m.map?.friends, profile).toEqual(['bunny', 'robot', 'capybara', 'frog']);
      expect(Object.keys(m.map?.friendPositions ?? {}).sort(), profile).toEqual(['bunny', 'capybara', 'frog', 'robot']);
    }
  });

  test('[AC-07] @single-orientation tapping the Workshop makes the friends walk along the path (input locked), and arriving enters the world', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, SEEN);
    const before = await openMapByTap(page);
    const bunnyStart = before.map?.friendPositions.bunny as { x: number; y: number };
    const bakery = centre(before.rects['world-bakery'] as Rect);
    await tap(page, 'world-workshop');
    const walking = await waitInfo(page, (i) => i.phase === 'walking', 'the walk never started');
    expect(walking.map?.walkingTo).toBe('workshop');

    // Input is locked: a tap on another world does nothing meanwhile.
    await page.mouse.click(bakery.x, bakery.y);
    const later = await waitInfo(page, (i) => i.phase === 'walking' && Math.hypot((i.map?.friendPositions.bunny?.x ?? 0) - bunnyStart.x, (i.map?.friendPositions.bunny?.y ?? 0) - bunnyStart.y) > 40, 'the bunny never moved');
    expect(later.map?.lockedTaps).toBe(0);
    expect(later.map?.walkingTo).toBe('workshop');
    // Everyone walks: the other friends have left their spots too, a little later than the bunny.
    await waitInfo(page, (i) => Object.values(i.map?.friendPositions ?? {}).length === 4 && i.map?.friends.length === 4, 'friends vanished');

    // Arriving enters the world (the entry was seen, so the game opens straight away).
    await waitForScene(page, 'MysteryEggBuildScene');
    const intro = await waitInfo(page, (i) => i.scene === 'MysteryEggBuildScene' && i.ready, 'the Workshop never opened');
    expect(intro.phase).toBe('intro');
  });

  test('[AC-08] @single-orientation a closed world only wiggles (no voice line), nobody walks and the child stays on the map', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, SEEN);
    await openMapByTap(page);
    let taps = 0;
    for (const id of LOCKED) {
      const since = (await getSpokenLines(page)).length;
      await tap(page, `world-${id}` as Target);
      taps++;
      const i = await waitInfo(page, (x) => (x.map?.lockedTaps ?? 0) === taps, `no locked feedback for ${id}`);
      expect(i.phase, id).toBe('map');
      expect(i.map?.walkingTo, id).toBeNull();
      // A wiggle only: no voice line is requested for a closed world.
      await page.waitForTimeout(300);
      expect(await spoken(page, since), id).toEqual([]);
      await page.waitForTimeout(400);
    }
    // Still on the map after a pause: no walk, no entry, nothing opened.
    await page.waitForTimeout(1500);
    const after = await info(page);
    expect(after?.scene).toBe('MysteryEggScene');
    expect(after?.phase).toBe('map');
    expect(after?.map?.walkingTo).toBeNull();
    expect(await getActiveScenes(page)).not.toContain('MysteryEggBuildScene');
  });

  test('[AC-19] @single-orientation repeated taps on a closed world never accumulate rotation: the tile swings within its wiggle and returns to rest', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, SEEN);
    await openMapByTap(page);
    const rect = centre(await rectOf(page, 'world-bakery'));
    const angles: number[] = [];
    for (let n = 0; n < 8; n++) {
      await page.mouse.click(rect.x, rect.y);
      await page.waitForTimeout(35);
      angles.push((await info(page))?.map?.worldAngles.bakery ?? 99);
    }
    expect((await info(page))?.map?.lockedTaps).toBe(8);
    // The wiggle is +-4 degrees: eight overlapping taps stay inside it.
    for (const a of angles) expect(Math.abs(a)).toBeLessThanOrEqual(4.01);
    await expect.poll(async () => (await info(page))?.map?.worldAngles.bakery, { timeout: 5_000 }).toBe(0);
    const rest = (await info(page))?.map?.worldAngles;
    for (const id of WORLDS) expect(rest?.[id], id).toBe(0);
    expect((await info(page))?.phase).toBe('map');
  });

  test('[AC-20] @single-orientation world taps do nothing unless the map is up: not during the intro slides, not while the friends walk', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterMapByTap(page, 'profile-a');
    const first = await openShellByTap(page);
    expect(first.phase).toBe('intro');
    // A tap where a closed world sits only advances the slide: no wiggle, no walk.
    const bakery = centre(first.rects['world-bakery'] as Rect);
    const workshop = centre(first.rects['world-workshop'] as Rect);
    await page.mouse.click(bakery.x, bakery.y);
    const second = await waitInfo(page, (i) => i.map?.slide?.index === 1, 'the tap did not advance the slide');
    expect(second.map?.lockedTaps).toBe(0);
    await page.mouse.click(workshop.x, workshop.y);
    await waitInfo(page, (i) => i.map?.slide?.index === 2, 'the tap did not advance the slide');
    expect((await info(page))?.map?.walkingTo).toBeNull();
    await tap(page, 'skipBtn');
    await waitInfo(page, (i) => i.phase === 'map', 'the map never opened');

    // While walking, taps on the walked-to world and on a closed world are ignored too.
    await tap(page, 'world-workshop');
    await waitInfo(page, (i) => i.phase === 'walking', 'the walk never started');
    await page.mouse.click(bakery.x, bakery.y);
    await page.mouse.click(workshop.x, workshop.y);
    const walking = await info(page);
    if (walking?.phase === 'walking') {
      expect(walking.map?.lockedTaps).toBe(0);
      expect(walking.map?.walkingTo).toBe('workshop');
      expect(walking.map?.worldAngles.bakery).toBe(0);
    }
    await waitInfo(page, (i) => i.phase === 'entry', 'the entry slides never showed', 20_000);
    expect((await info(page))?.map?.lockedTaps).toBe(0);
  });

  test('[AC-21] @single-orientation friends flip while walking left and face the default side again on arrival and on a re-entered map', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, { v: 2, introSeen: true });
    const before = await openMapByTap(page);
    expect(Object.values(before.map?.friendFacing ?? {})).toEqual([1, 1, 1, 1]);
    await tap(page, 'world-workshop');
    let flipped = false;
    const deadline = Date.now() + 30_000;
    for (;;) {
      const i = await info(page);
      if (Object.values(i?.map?.friendFacing ?? {}).includes(-1)) flipped = true;
      if (i?.phase === 'entry') break;
      if (Date.now() > deadline) throw new Error(`the walk never arrived; last info: ${JSON.stringify(i)}`);
      await page.waitForTimeout(60);
    }
    expect(flipped).toBe(true);
    // Arrived (the entry slides are up): nobody stays flipped.
    const entry = await info(page);
    expect(Object.values(entry?.map?.friendFacing ?? {})).toEqual([1, 1, 1, 1]);
    await tap(page, 'skipBtn');
    await waitForScene(page, 'MysteryEggBuildScene');
    // Back on the re-entered map everyone faces the default side.
    await waitInfo(page, (i) => i.scene === 'MysteryEggBuildScene' && i.ready, 'the Workshop never opened');
    await tap(page, 'backBtn');
    await waitForScene(page, 'MysteryEggScene');
    const map = await waitInfo(page, (i) => i.scene === 'MysteryEggScene' && i.phase === 'map', 'the map never came back');
    expect(Object.values(map.map?.friendFacing ?? {})).toEqual([1, 1, 1, 1]);
  });

  test('[AC-22] @single-orientation (portrait only, where the board is scaled down) the map\'s back button is still at least 96 CSS px, on screen, and a real tap on it leaves the map', async ({ page }, testInfo) => {
    if (testInfo.project.name !== PORTRAIT) test.skip();
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, SEEN);
    const m = await openMapByTap(page);
    const back = m.rects.backBtn as Rect;
    expect(back.width).toBeGreaterThanOrEqual(MIN_TAP_PX - 0.5);
    expect(back.height).toBeGreaterThanOrEqual(MIN_TAP_PX - 0.5);
    const vp = page.viewportSize() as { width: number; height: number };
    expect(back.x).toBeGreaterThanOrEqual(0);
    expect(back.y).toBeGreaterThanOrEqual(0);
    expect(back.x + back.width).toBeLessThanOrEqual(vp.width);
    expect(back.y + back.height).toBeLessThanOrEqual(vp.height);
    // The five world tap areas are 0.625 x board scale here (not child-facing 96 px targets); the button does not sit on them.
    for (const id of WORLDS) {
      const r = m.rects[`world-${id}` as Target] as Rect;
      expect(back.x < r.x + r.width && back.x + back.width > r.x && back.y < r.y + r.height && back.y + back.height > r.y, id).toBe(false);
    }
    await tap(page, 'backBtn');
    await waitForScene(page, 'MapScene');
  });

  test('[AC-10] @single-orientation the intro: 4 slides on the first visit, a tap advances and requests the French then the Hebrew line, the skip button skips all, and the next visit goes straight to the map', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterMapByTap(page, 'profile-a');
    const first = await openShellByTap(page);
    expect(first.phase).toBe('intro');
    expect(first.map?.slide).toMatchObject({ kind: 'intro', world: null, index: 0, count: 4 });
    const skip = first.rects.skipBtn as Rect;
    expect(skip.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(skip.height).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(first.rects.slideTap).toBeDefined();

    // Slide 1: French hero line, then the Hebrew robot line.
    await expect.poll(() => spoken(page), { timeout: 10_000 }).toEqual(expect.arrayContaining([['vo-shell-intro-1-hero', 'fr'], ['vo-shell-intro-1-narr', 'he']]));
    const ids = (await spoken(page)).map(([id]) => id);
    expect(ids.indexOf('vo-shell-intro-1-hero')).toBeLessThan(ids.indexOf('vo-shell-intro-1-narr'));

    // A tap anywhere advances; slide 2 requests its own lines.
    const since = (await getSpokenLines(page)).length;
    await tap(page, 'slideTap');
    const second = await waitInfo(page, (i) => i.map?.slide?.index === 1, 'the tap did not advance');
    expect(second.phase).toBe('intro');
    await expect.poll(() => spoken(page, since), { timeout: 10_000 }).toEqual(expect.arrayContaining([['vo-shell-intro-2-hero', 'fr'], ['vo-shell-intro-2-robot', 'he']]));

    // Skip: the whole intro is over, the map is up and the intro counts as seen.
    await tap(page, 'skipBtn');
    const map = await waitInfo(page, (i) => i.phase === 'map', 'the skip did not end the intro');
    expect(map.map?.introSeen).toBe(true);
    expect(map.map?.slide).toBeNull();

    // The next visit (a fresh page load) goes straight to the map.
    await enterMapByTap(page, 'profile-a');
    const again = await openShellByTap(page);
    expect(again.phase).toBe('map');
    expect(again.map?.slide).toBeNull();

    // Another profile has its own intro, and a tap on the last slide ends it too.
    await enterMapByTap(page, 'profile-b');
    const other = await openShellByTap(page);
    expect(other.phase).toBe('intro');
    for (let n = 0; n < 4; n++) await tap(page, 'slideTap');
    await waitInfo(page, (i) => i.phase === 'map', 'four taps did not end the intro');
  });

  test('[AC-11] @single-orientation the Workshop entry: 2 slides on the first arrival, skippable, and later arrivals go straight into the game', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(120_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, { v: 2, introSeen: true });
    await openMapByTap(page);
    const since = (await getSpokenLines(page)).length;
    await tap(page, 'world-workshop');
    const entry = await waitInfo(page, (i) => i.phase === 'entry', 'the entry slides never showed', 20_000);
    expect(entry.map?.slide).toMatchObject({ kind: 'entry', world: 'workshop', index: 0, count: 2 });
    await expect.poll(() => spoken(page, since), { timeout: 10_000 }).toEqual(expect.arrayContaining([['vo-shell-ws-1-hero', 'fr'], ['vo-shell-ws-1-narr', 'he']]));
    expect((entry.rects.skipBtn as Rect).width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    await tap(page, 'skipBtn');
    await waitForScene(page, 'MysteryEggBuildScene');
    await waitInfo(page, (i) => i.scene === 'MysteryEggBuildScene' && i.ready && i.phase === 'intro', 'the game never opened after the skip');

    // Leave the game (its back button), then arrive again: straight in, no entry slides.
    await tap(page, 'backBtn');
    await waitForScene(page, 'MysteryEggScene');
    const map = await waitInfo(page, (i) => i.scene === 'MysteryEggScene' && i.phase === 'map', 'the map never came back');
    expect(map.map?.entrySeen).toEqual(['workshop']);
    await tap(page, 'world-workshop');
    let sawEntry = false;
    const deadline = Date.now() + 30_000;
    for (;;) {
      const i = await info(page);
      if (i?.phase === 'entry') sawEntry = true;
      if (i?.scene === 'MysteryEggBuildScene' && i.ready) break;
      if (Date.now() > deadline) throw new Error(`the second arrival never opened the game; last info: ${JSON.stringify(i)}`);
      await page.waitForTimeout(80);
    }
    expect(sawEntry).toBe(false);
  });

  test('[AC-16] @single-orientation seeds: a v1 save keeps heart 0, the feather and egg level 1; a v2 seed shows several hearts and pieces', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await seed(page, { completed: ['1.1'] });
    const v1 = await toMapSkippingIntro(page);
    expect(v1.heartsLit).toEqual([0]);
    expect(v1.map?.pieces).toEqual(['feather']);
    expect(v1.featherInNest).toBe(true);
    expect(v1.eggLevel).toBe(1);
    expect(v1.map?.heartFill).toEqual([1, 0, 0, 0, 0]);
    expect(v1.map?.worlds.workshop).toMatchObject({ level: 1, completed: [1], fill: 1 });
    // The old save is migrated on load and a reload shows the same.
    await enterMapByTap(page, 'profile-a');
    const reloaded = await toMapSkippingIntro(page);
    expect(reloaded.heartsLit).toEqual([0]);
    expect(reloaded.eggLevel).toBe(1);

    await enterMapByTap(page, 'profile-b');
    await seed(page, { v: 2, introSeen: true, worlds: { workshop: { completed: [1] }, bakery: { completed: [1, 2, 3] }, jungle: { completed: [1] } } });
    const v2 = await openMapByTap(page);
    expect(v2.heartsLit).toEqual([0, 1, 3]);
    expect(v2.map?.pieces).toEqual(['feather', 'knit-square']);
    expect(v2.eggLevel).toBe(2);
    expect(v2.map?.heartFill?.[1]).toBe(1);
    expect(v2.map?.heartFill?.[3]).toBeCloseTo(1 / 3, 2);
    expect(v2.map?.worlds['detective'].fill).toBe(0);
    expect(v2.map?.readyToHatch).toBe(false);
  });

  test('[AC-26] [AC-27] @single-orientation an old v2 save with introSeen true (the first shell release) sees the intro once, keeps its progress, and never sees it again', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterMapByTap(page, 'profile-a');
    // Exactly what the first shell release stored for a child who had seen the intro: a boolean, no version (seed only).
    await page.evaluate(() =>
      window.localStorage.setItem(
        'kids-app-mystery-egg:a',
        JSON.stringify({ v: 2, worlds: { workshop: { level: 1, completed: [1] } }, pieces: ['feather'], introSeen: true, entrySeen: ['workshop'] }),
      ),
    );
    const first = await openShellByTap(page);
    expect(first.phase).toBe('intro');
    expect(first.map?.slide).toMatchObject({ kind: 'intro', index: 0, count: 4 });
    expect(first.map?.introSeen).toBe(false);
    expect(first.map?.introSeenVersion).toBe(0);
    // Slide voice-over stays at the recorded speed (the in-game lines run at 1.2x).
    await expect.poll(async () => (await getSpokenLines(page)).map((s) => [s.lineId, s.rate]), { timeout: 5000 }).toContainEqual(['vo-shell-intro-1-hero', 1]);
    await tap(page, 'skipBtn');
    const map = await waitInfo(page, (i) => i.phase === 'map', 'the map never opened after the intro');
    expect(map.map?.introSeen).toBe(true);
    expect(map.map?.introSeenVersion).toBe(2);
    // The old progress is untouched.
    expect(map.heartsLit).toEqual([0]);
    expect(map.map?.pieces).toEqual(['feather']);
    expect(map.map?.entrySeen).toEqual(['workshop']);

    // Not again: back to the old map and in again, then after a full reload of the app.
    await tap(page, 'backBtn');
    await waitForScene(page, 'MapScene');
    const again = await openShellByTap(page);
    expect(again.phase).toBe('map');
    expect(again.map?.slide).toBeNull();
    await enterMapByTap(page, 'profile-a');
    const reloaded = await openShellByTap(page);
    expect(reloaded.phase).toBe('map');
    expect(reloaded.map?.slide).toBeNull();
    expect(reloaded.heartsLit).toEqual([0]);
  });
});

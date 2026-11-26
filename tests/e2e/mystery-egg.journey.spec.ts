// Mystery Egg (docs/specs/mystery-egg.md), Pass 1. Real taps and real pointer drags only; the ?e2e=1 hooks only read state
// (getMysteryEggInfo, getSpokenLines, getActiveScenes, getBuildingHit) or seed persisted progress (seedMysteryEggProgress).
// Landscape tablet first: every test is @single-orientation and runs in the landscape project only.
import { test, expect, type Page } from '@playwright/test';
import type { MysteryEggInfo } from '../../src/games/mysteryEgg/types';
import { enterMapByTap, getActiveScenes, getBuildingHit, getSpokenLines, tapTestId, waitForScene } from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_TAP_PX = 96;
const WORLD_IDS = ['language-house', 'number-garden', 'nature-lab', 'science-world', 'art-studio', 'leisure-corner'];

function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

type Target = keyof MysteryEggInfo['rects'];
type Rect = { x: number; y: number; width: number; height: number };

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
    await page.waitForTimeout(100);
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

/** A real pointer drag from the centre of one point to another. */
async function dragBetween(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

async function dragPartToSlot(page: Page, part: 'partRamp' | 'partBall' | 'partBell'): Promise<void> {
  const from = centre(await rectOf(page, part));
  const to = centre(await rectOf(page, 'slot'));
  await dragBetween(page, from, to);
}

/** Egg button -> the world map (docs/specs/game-shell.md). The first-visit intro slides are skipped with the skip button. */
async function openHubByTap(page: Page): Promise<MysteryEggInfo> {
  await tapTestId(page, 'mystery-egg-btn');
  await waitForScene(page, 'MysteryEggScene');
  const first = await waitInfo(page, (i) => i.ready && i.scene === 'MysteryEggScene', 'hub never became ready');
  if (first.phase === 'intro') await tap(page, 'skipBtn');
  return waitInfo(page, (i) => i.scene === 'MysteryEggScene' && i.phase === 'map', 'the map never became interactive');
}

/** Tap the Workshop on the map (the friends walk there); the first-arrival entry slides are skipped. */
async function openWorkshopByTap(page: Page): Promise<MysteryEggInfo> {
  await tap(page, 'world-workshop');
  const deadline = Date.now() + 40_000;
  for (;;) {
    const i = await info(page);
    if (i?.scene === 'MysteryEggBuildScene' && i.ready && i.phase === 'intro') return i;
    if (i?.scene === 'MysteryEggScene' && i.phase === 'entry' && i.rects.skipBtn) await tap(page, 'skipBtn');
    if (Date.now() > deadline) throw new Error(`the Workshop never opened; last info: ${JSON.stringify(i)}`);
    await page.waitForTimeout(100);
  }
}

async function startBuildByTap(page: Page): Promise<MysteryEggInfo> {
  await tap(page, 'goBtn');
  return waitInfo(page, (i) => i.phase === 'build', 'build phase never started');
}

/** Profile -> map -> egg button -> hub -> Workshop -> intro -> go. */
async function reachBuild(page: Page): Promise<MysteryEggInfo> {
  await enterMapByTap(page, 'profile-a');
  await openHubByTap(page);
  await openWorkshopByTap(page);
  return startBuildByTap(page);
}

async function playToSuccess(page: Page): Promise<void> {
  await dragPartToSlot(page, 'partRamp');
  await waitInfo(page, (i) => i.slotFilled, 'the ramp did not snap into the slot');
  await tap(page, 'playBtn');
  await waitInfo(page, (i) => i.phase === 'success', 'the ball never rang the bell', 45_000);
}

test.describe('mystery-egg', () => {
  test('[AC-01] @single-orientation full real-tap journey: map egg button -> hub -> Workshop -> intro -> drag the ramp -> Play -> success -> hub with 1 lit heart, brighter egg and feather; still there after a reload', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(120_000);
    await enterMapByTap(page, 'profile-a');

    // Map: the egg in its nest, 5 empty heart slots, the Workshop as a big world on the map (no Workshop button).
    const hub = await openHubByTap(page);
    expect(hub.heartsLit).toEqual([]);
    expect(hub.eggLevel).toBe(0);
    expect(hub.featherInNest).toBe(false);
    for (const t of ['world-workshop', 'backBtn'] as const) {
      const r = hub.rects[t] as Rect;
      expect(r.width, t).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(r.height, t).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }

    // Intro: the French request plays and the goal card is up; the go button is big.
    const intro = await openWorkshopByTap(page);
    const goBtn = intro.rects.goBtn as Rect;
    expect(goBtn.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    // The story line first, then the request (the second follows the first once it ends, so poll).
    await expect.poll(async () => (await getSpokenLines(page)).map((s) => [s.lineId, s.lang]), { timeout: 10_000 }).toContainEqual(['vo-fr-instruction', 'fr']);
    const spokenIds = (await getSpokenLines(page)).map((s) => s.lineId);
    expect(spokenIds.indexOf('vo-fr-story')).toBeGreaterThanOrEqual(0);
    expect(spokenIds.indexOf('vo-fr-story')).toBeLessThan(spokenIds.indexOf('vo-fr-instruction'));

    // Build: ONE glowing slot, three big parts in the tray, a big Play button.
    const build = await startBuildByTap(page);
    expect(build.partsInTray.sort()).toEqual(['ball', 'bell', 'ramp']);
    expect(build.slotFilled).toBe(false);
    for (const t of ['playBtn', 'earBtn', 'partBall', 'partRamp', 'partBell'] as const) {
      const r = build.rects[t] as Rect;
      expect(r.width, t).toBeGreaterThanOrEqual(MIN_TAP_PX);
      expect(r.height, t).toBeGreaterThanOrEqual(MIN_TAP_PX);
    }

    // Drag the ramp into the slot, press Play, the ball rings the bell.
    await playToSuccess(page);
    const won = await rectOf(page, 'continueBtn');
    expect(won.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    const afterWin = await waitInfo(page, (i) => i.featherInNest && Boolean(i.rects.continueBtn), 'the success view never finished');
    expect(afterWin.heartsLit).toEqual([0]);
    expect(afterWin.eggLevel).toBe(1);
    const ids = (await getSpokenLines(page)).map((s) => s.lineId);
    expect(ids).toContain('vo-fr-cat-croissants');
    expect(ids).toContain('vo-fr-success');

    // Back to the hub: 1 lit heart, the brighter egg, the feather in the nest.
    await tap(page, 'continueBtn');
    await waitForScene(page, 'MysteryEggScene');
    const hubAfter = await waitInfo(page, (i) => i.scene === 'MysteryEggScene' && i.phase === 'map', 'hub never came back');
    expect(hubAfter.heartsLit).toEqual([0]);
    expect(hubAfter.eggLevel).toBe(1);
    expect(hubAfter.featherInNest).toBe(true);

    // Persisted: a reload and the egg button again show the same hub.
    await enterMapByTap(page, 'profile-a');
    const reloaded = await openHubByTap(page);
    expect(reloaded.heartsLit).toEqual([0]);
    expect(reloaded.eggLevel).toBe(1);
    expect(reloaded.featherInNest).toBe(true);

    // And the way back to the map still works.
    await tap(page, 'backBtn');
    await waitForScene(page, 'MapScene');
    expect(await getBuildingHit(page, 'language-house')).not.toBeNull();
  });

  test('[AC-10] @single-orientation a failed run resets the ball and touches no part; the help ladder: 2nd failed run = Hebrew goal hint (help-1), next failed run = glowing-slot hint (help-2) with the slot pointer, which goes away once the ramp is placed', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(150_000);
    await reachBuild(page);
    const linesBefore = (await getSpokenLines(page)).length;
    const hebrew = async () => (await getSpokenLines(page, linesBefore)).filter((s) => s.lang === 'he').map((s) => s.lineId);

    await tap(page, 'playBtn');
    await waitInfo(page, (i) => i.phase === 'playing', 'the run never started');
    const first = await waitInfo(page, (i) => i.failedRuns === 1 && i.ballAtStart && i.phase === 'build', 'the first failed run never reset', 45_000);
    expect(first.hintsGiven).toBe(0);
    expect(first.hintVisible).toBe(false);
    expect(first.partsInTray.sort()).toEqual(['ball', 'bell', 'ramp']);
    expect(first.slotFilled).toBe(false);
    expect(await hebrew()).toEqual([]);

    // Rung 1: the goal hint (explains the request). No pointer yet.
    await tap(page, 'playBtn');
    const second = await waitInfo(page, (i) => i.failedRuns === 2 && i.ballAtStart && i.phase === 'build', 'the second failed run never reset', 45_000);
    expect(second.hintsGiven).toBe(1);
    expect(second.hintVisible).toBe(false);
    expect(second.partsInTray.sort()).toEqual(['ball', 'bell', 'ramp']);
    expect(await hebrew()).toEqual(['vo-he-robot-help-1']);

    // Rung 2: the glowing-slot hint, together with the pulsing pointer at the empty slot.
    await tap(page, 'playBtn');
    const third = await waitInfo(page, (i) => i.failedRuns === 3 && i.ballAtStart && i.phase === 'build', 'the third failed run never reset', 45_000);
    expect(third.hintsGiven).toBe(2);
    expect(third.hintVisible).toBe(true);
    expect(await hebrew()).toEqual(['vo-he-robot-help-1', 'vo-he-robot-help-2']);

    await dragPartToSlot(page, 'partRamp');
    const placed = await waitInfo(page, (i) => i.slotFilled && !i.hintVisible, 'the hint pointer stayed after the ramp was placed');
    expect(placed.failedRuns).toBe(3);
  });

  test('[AC-11] @single-orientation the robot ear button is there in the intro and in the build view and gives HEBREW help (vo-he-robot-help-1), not the French request', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await openHubByTap(page);
    const intro = await openWorkshopByTap(page);
    const ear = intro.rects.earBtn as Rect;
    expect(ear.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    // Let the intro's own automatic French lines (story, then request) settle before the first tap.
    await expect.poll(async () => (await getSpokenLines(page)).some((s) => s.lineId === 'vo-fr-instruction'), { timeout: 15_000 }).toBe(true);

    let since = (await getSpokenLines(page)).length;
    await tap(page, 'earBtn');
    await expect.poll(async () => (await getSpokenLines(page, since)).map((s) => [s.lineId, s.lang]), { timeout: 5000 }).toContainEqual(['vo-he-robot-help-1', 'he']);
    expect((await getSpokenLines(page, since)).map((s) => s.lineId)).not.toContain('vo-fr-instruction');

    await startBuildByTap(page);
    since = (await getSpokenLines(page)).length;
    await tap(page, 'earBtn');
    await expect.poll(async () => (await getSpokenLines(page, since)).map((s) => [s.lineId, s.lang]), { timeout: 5000 }).toContainEqual(['vo-he-robot-help-1', 'he']);
    expect((await getSpokenLines(page, since)).map((s) => s.lineId)).not.toContain('vo-fr-instruction');
    // The ear is not a ladder step: it leaves the failed-run counter and the pointer alone.
    const after = await info(page);
    expect(after?.failedRuns).toBe(0);
    expect(after?.hintVisible).toBe(false);
  });

  test('[AC-18] @single-orientation Go tapped right away (before the story line ends) cuts the story and requests vo-fr-instruction at build start, once', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await openHubByTap(page);
    await openWorkshopByTap(page);
    const ids = async () => (await getSpokenLines(page)).map((s) => s.lineId);
    // The story has just been requested; do not wait for it to end.
    await tap(page, 'goBtn');
    await waitInfo(page, (i) => i.phase === 'build', 'build phase never started');
    await expect.poll(ids, { timeout: 5000 }).toContain('vo-fr-instruction');
    // Give any late chained callback time to fire a duplicate, then count.
    await page.waitForTimeout(4000);
    const all = await ids();
    expect(all.filter((id) => id === 'vo-fr-instruction')).toHaveLength(1);
    expect(all.filter((id) => id === 'vo-fr-story')).toHaveLength(1);
    expect(all.indexOf('vo-fr-story')).toBeLessThan(all.indexOf('vo-fr-instruction'));
  });

  test('[AC-19] @single-orientation the bunny replays vo-fr-instruction in the intro and in the build view; the ear stays Hebrew', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await openHubByTap(page);
    const intro = await openWorkshopByTap(page);
    const bunny = intro.rects.bunny as Rect;
    expect(bunny.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(bunny.height).toBeGreaterThanOrEqual(MIN_TAP_PX);

    let since = (await getSpokenLines(page)).length;
    await tap(page, 'bunny');
    await expect.poll(async () => (await getSpokenLines(page, since)).map((s) => [s.lineId, s.lang]), { timeout: 5000 }).toContainEqual(['vo-fr-instruction', 'fr']);

    await startBuildByTap(page);
    since = (await getSpokenLines(page)).length;
    await tap(page, 'bunny');
    await expect.poll(async () => (await getSpokenLines(page, since)).map((s) => s.lineId), { timeout: 5000 }).toContain('vo-fr-instruction');

    since = (await getSpokenLines(page)).length;
    await tap(page, 'earBtn');
    await expect.poll(async () => (await getSpokenLines(page, since)).map((s) => s.lineId), { timeout: 5000 }).toContain('vo-he-robot-help-1');
    expect((await getSpokenLines(page, since)).map((s) => s.lineId)).not.toContain('vo-fr-instruction');
  });

  test('[AC-12] @single-orientation a part dropped far away, or the ball or bell dropped on the slot, goes back to the tray and the board is unchanged', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await reachBuild(page);

    // The ramp dropped far from the slot.
    const ramp = centre(await rectOf(page, 'partRamp'));
    const slot = centre(await rectOf(page, 'slot'));
    await dragBetween(page, ramp, { x: slot.x + 500, y: slot.y - 250 });
    const afterFar = await waitInfo(page, (i) => i.partsInTray.includes('ramp'), 'the ramp did not return to the tray');
    expect(afterFar.slotFilled).toBe(false);

    // The ball and the bell are not accepted by the slot.
    for (const part of ['partBall', 'partBell'] as const) {
      await dragPartToSlot(page, part);
      const back = await waitInfo(page, (i) => i.partsInTray.length === 3, `${part} did not return to the tray`);
      expect(back.slotFilled).toBe(false);
    }

    // The snap is forgiving: a drop 130 px off the slot centre still snaps the ramp in.
    await dragBetween(page, centre(await rectOf(page, 'partRamp')), { x: slot.x + 100, y: slot.y + 80 });
    const snapped = await waitInfo(page, (i) => i.slotFilled, 'a near drop did not snap');
    expect(snapped.partsInTray.sort()).toEqual(['ball', 'bell']);

    // A placed ramp can be lifted out again; dropped far away it goes back to the tray and the slot is free.
    await dragBetween(page, centre(await rectOf(page, 'partRamp')), { x: slot.x + 500, y: slot.y - 250 });
    const lifted = await waitInfo(page, (i) => !i.slotFilled && i.partsInTray.includes('ramp'), 'the lifted ramp did not return');
    expect(lifted.partsInTray).toHaveLength(3);
  });

  test('[AC-13] @single-orientation replay: seeded progress shows 1 lit heart, the brighter egg and the feather on the hub, and winning again keeps exactly 1 heart', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(120_000);
    await enterMapByTap(page, 'profile-a');
    await page.evaluate(() => {
      (window as unknown as { __testHooks__: { seedMysteryEggProgress: (s: { completed: string[] }) => void } }).__testHooks__.seedMysteryEggProgress({ completed: ['1.1'] });
    });
    const hub = await openHubByTap(page);
    expect(hub.heartsLit).toEqual([0]);
    expect(hub.eggLevel).toBe(1);
    expect(hub.featherInNest).toBe(true);

    await openWorkshopByTap(page);
    await startBuildByTap(page);
    await playToSuccess(page);
    const again = await waitInfo(page, (i) => Boolean(i.rects.continueBtn), 'the success view never finished');
    expect(again.heartsLit).toEqual([0]);
    expect(again.eggLevel).toBe(1);
    await tap(page, 'continueBtn');
    await waitForScene(page, 'MysteryEggScene');
    const hubAfter = await waitInfo(page, (i) => i.scene === 'MysteryEggScene' && i.phase === 'map', 'hub never came back');
    expect(hubAfter.heartsLit).toEqual([0]);
    expect(hubAfter.eggLevel).toBe(1);
  });

  test('[AC-16] @single-orientation the egg button is additive: big, clear of every world building, and the map still works', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterMapByTap(page, 'profile-a');
    const egg = await page.locator('[data-testid="mystery-egg-btn"]').boundingBox();
    expect(egg).not.toBeNull();
    const e = egg as Rect;
    expect(e.width).toBeGreaterThanOrEqual(MIN_TAP_PX);
    expect(e.height).toBeGreaterThanOrEqual(MIN_TAP_PX);
    for (const id of WORLD_IDS) {
      const b = await getBuildingHit(page, id);
      expect(b, id).not.toBeNull();
      const r = b as Rect;
      const overlap = e.x < r.x + r.width && e.x + e.width > r.x && e.y < r.y + r.height && e.y + e.height > r.y;
      expect(overlap, `egg button overlaps ${id}`).toBe(false);
    }
    expect(await getActiveScenes(page)).toContain('MapScene');
  });
});

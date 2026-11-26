// Mystery Egg game shell, review nits of PR #114 (docs/specs/game-shell.md AC-28, AC-30). Real taps on the page rectangles of the
// read hook only; ?e2e=1 hooks read state or seed progress. Kept apart from game-shell.journey.spec.ts on purpose.
import { test, expect, type Page } from '@playwright/test';
import type { MysteryEggInfo } from '../../src/games/mysteryEgg/types';
import { NEST, WORLDS } from '../../src/games/mysteryEgg/worlds';
import { enterMapByTap, getGameSize, tapTestId, waitForScene } from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_TAP_PX = 96;

type Rect = { x: number; y: number; width: number; height: number };
type Seed = Parameters<NonNullable<Window['__testHooks__']>['seedMysteryEggProgress']>[0];

/** v2 seed: intro and entry already seen, so the map opens straight away. */
const SEEN: Seed = { v: 2, introSeen: true, entrySeen: ['workshop'] };

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

async function openMapByTap(page: Page): Promise<MysteryEggInfo> {
  await enterMapByTap(page, 'profile-a');
  await page.evaluate((v) => (window as unknown as { __testHooks__: { seedMysteryEggProgress: (x: unknown) => void } }).__testHooks__.seedMysteryEggProgress(v), SEEN);
  await tapTestId(page, 'mystery-egg-btn');
  await waitForScene(page, 'MysteryEggScene');
  return waitInfo(page, (i) => i.ready && i.scene === 'MysteryEggScene' && i.phase === 'map', 'the map never became interactive');
}

async function centreOf(page: Page, target: 'world-workshop'): Promise<[number, number]> {
  const i = await waitInfo(page, (x) => Boolean(x.rects[target]), `target ${target} never appeared`);
  const r = i.rects[target] as Rect;
  return [r.x + r.width / 2, r.y + r.height / 2];
}

/** Board px -> page px, read off the Workshop's tap rectangle (its board position is known), so it holds in any orientation. */
function boardToPage(i: MysteryEggInfo, p: { x: number; y: number }): { x: number; y: number } {
  const ws = WORLDS.find((w) => w.id === 'workshop');
  const r = i.rects['world-workshop'] as Rect;
  if (!ws) throw new Error('no workshop');
  const k = r.width / ws.hit.w;
  return { x: r.x + r.width / 2 + (p.x - ws.hit.x) * k, y: r.y + r.height / 2 + (p.y - ws.hit.y) * k };
}

test.describe('game-shell review nits', () => {
  test('[AC-28] @single-orientation the back button is re-placed when the window rotates: at least 96 CSS px and inside the viewport, landscape -> portrait -> landscape', async ({ page }, testInfo) => {
    if (testInfo.project.name !== LANDSCAPE) test.skip();
    test.setTimeout(90_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await openMapByTap(page);

    const backIsRight = async (viewport: { width: number; height: number }, label: string): Promise<void> => {
      await page.setViewportSize(viewport);
      await expect
        .poll(
          async () => {
            const back = (await info(page))?.rects.backBtn as Rect | undefined;
            if (!back) return 'no back button';
            const ok =
              back.width >= MIN_TAP_PX - 0.5 &&
              back.height >= MIN_TAP_PX - 0.5 &&
              back.x >= 0 &&
              back.y >= 0 &&
              back.x + back.width <= viewport.width &&
              back.y + back.height <= viewport.height;
            return ok ? 'ok' : `${Math.round(back.width)}x${Math.round(back.height)} at (${Math.round(back.x)}, ${Math.round(back.y)})`;
          },
          { message: `${label}: back button size and place`, timeout: 10_000 },
        )
        .toBe('ok');
    };
    await backIsRight({ width: 1280, height: 800 }, 'landscape at start');
    await backIsRight({ width: 800, height: 1280 }, 'after rotating to portrait');
    await backIsRight({ width: 1280, height: 800 }, 'after rotating back to landscape');
    // The re-placed button still works: a real tap leaves the map. (The browser may still be settling the canvas after the
    // viewport change: tap once the button's rectangle has stopped moving.)
    // (A re-placed button is reported again one frame after it was made, so a missing rectangle only means "not settled yet".)
    let back: Rect | undefined;
    for (let settled = 0; settled < 3; ) {
      await page.waitForTimeout(200);
      const now = (await info(page))?.rects.backBtn as Rect | undefined;
      settled = now && back && now.x === back.x && now.y === back.y && now.width === back.width ? settled + 1 : 0;
      back = now;
    }
    if (!back) throw new Error('the back button never settled');
    await page.mouse.click(back.x + back.width / 2, back.y + back.height / 2);
    await waitForScene(page, 'MapScene');
  });

  test('[AC-30] @single-orientation friend and nest taps count on the map and do nothing while the friends walk', async ({ page }, testInfo) => {
    if (testInfo.project.name !== LANDSCAPE) test.skip();
    test.setTimeout(90_000);
    const map = await openMapByTap(page);
    expect(map.map?.friendTaps).toBe(0);
    expect(map.map?.nestTaps).toBe(0);

    // On the map a tap on a friend and on the nest counts once each.
    const capy = boardToPage(map, map.map?.friendPositions.capybara as { x: number; y: number });
    await page.mouse.click(capy.x, capy.y);
    const nest = boardToPage(map, NEST);
    await page.mouse.click(nest.x, nest.y);
    const tapped = await waitInfo(page, (i) => i.map?.friendTaps === 1 && i.map?.nestTaps === 1, 'friend and nest taps were not counted on the map');
    expect(tapped.phase).toBe('map');

    // While the friends walk (the capybara is the last to leave, so it is still at its spot) both taps are ignored.
    const ws = boardToPage(tapped, WORLDS.find((w) => w.id === 'workshop') as { x: number; y: number });
    await page.mouse.click(ws.x, ws.y);
    const walking = await waitInfo(page, (i) => i.phase === 'walking', 'the walk never started');
    const spot = boardToPage(walking, walking.map?.friendPositions.capybara as { x: number; y: number });
    await page.mouse.click(spot.x, spot.y);
    await page.mouse.click(nest.x, nest.y);
    const after = await info(page);
    if (after?.phase === 'walking') {
      expect(after.map?.friendTaps).toBe(1);
      expect(after.map?.nestTaps).toBe(1);
    }
    expect(after?.map?.friendTaps).toBe(1);
    expect(after?.map?.nestTaps).toBe(1);
  });

  for (const [boot, then] of [
    [{ width: 800, height: 1280 }, { width: 1280, height: 800 }],
    [{ width: 1280, height: 800 }, { width: 800, height: 1280 }],
  ] as const) {
    const label = `${boot.width}x${boot.height} -> ${then.width}x${then.height}`;
    test(`[AC-33] @single-orientation booting at ${label}: after the rotation the game and its canvas match the new orientation, the map re-fits, the back button stays at least 96 CSS px and the Workshop tile still takes a real tap`, async ({ page }, testInfo) => {
      if (testInfo.project.name !== LANDSCAPE) test.skip();
      test.setTimeout(90_000);
      await page.setViewportSize(boot);
      await openMapByTap(page);
      expect(await getGameSize(page), 'game size at boot').toEqual(boot);

      await page.setViewportSize(then);
      await expect.poll(() => getGameSize(page), { message: 'the game size follows the rotation', timeout: 10_000 }).toEqual(then);
      // The canvas fills the viewport exactly (same aspect as the game: FIT leaves no bars).
      await expect
        .poll(async () => {
          const box = await page.locator('canvas').boundingBox();
          return box ? [Math.round(box.x), Math.round(box.y), Math.round(box.width), Math.round(box.height)] : null;
        }, { message: 'the canvas box fills the rotated viewport', timeout: 10_000 })
        .toEqual([0, 0, then.width, then.height]);
      // The map re-fits: the back button (>= 96 CSS px, inside the viewport) and the Workshop tile are where the fit puts them.
      const settled = await waitInfo(page, (i) => {
        const back = i.rects.backBtn as Rect | undefined;
        const ws = i.rects['world-workshop'] as Rect | undefined;
        return Boolean(back && ws && back.width >= MIN_TAP_PX - 0.5 && back.height >= MIN_TAP_PX - 0.5);
      }, 'the map never re-fitted to the new size');
      for (const target of ['backBtn', 'world-workshop'] as const) {
        const r = settled.rects[target] as Rect;
        expect(r.x, target).toBeGreaterThanOrEqual(0);
        expect(r.y, target).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width, target).toBeLessThanOrEqual(then.width + 0.5);
        expect(r.y + r.height, target).toBeLessThanOrEqual(then.height + 0.5);
      }
      // A real tap on the re-fitted tile starts the walk.
      const ws = settled.rects['world-workshop'] as Rect;
      await page.mouse.click(ws.x + ws.width / 2, ws.y + ws.height / 2);
      await waitInfo(page, (i) => i.phase === 'walking', 'the Workshop tap did not start the walk after the rotation', 15_000);
    });
  }

  test('[AC-33] @single-orientation the Workshop board re-fits when the window rotates (portrait boot -> landscape): the game follows and every control stays on screen', async ({ page }, testInfo) => {
    if (testInfo.project.name !== LANDSCAPE) test.skip();
    test.setTimeout(120_000);
    await page.setViewportSize({ width: 800, height: 1280 });
    await openMapByTap(page);
    await page.mouse.click(...(await centreOf(page, 'world-workshop')));
    // The walk takes a few seconds; the first-visit entry slides are already seen by the seed.
    await waitInfo(page, (i) => i.scene === 'MysteryEggBuildScene' && i.ready && i.phase === 'intro', 'the Workshop never opened', 45_000);
    await page.setViewportSize({ width: 1280, height: 800 });
    await expect.poll(() => getGameSize(page), { timeout: 10_000 }).toEqual({ width: 1280, height: 800 });
    const board = await waitInfo(page, (i) => i.scene === 'MysteryEggBuildScene' && Boolean(i.rects.goBtn), 'the board never re-fitted');
    // At 1280x800 the board is zoom 1: the Go button is the board's own 160 px wide, and the tray parts are on screen.
    expect((board.rects.goBtn as Rect).width).toBeCloseTo(160, 0);
    for (const target of ['goBtn', 'backBtn', 'partRamp', 'slot'] as const) {
      const r = (board.rects[target] ?? (await info(page))?.rects[target]) as Rect | undefined;
      expect(r, target).toBeDefined();
      const rr = r as Rect;
      expect(rr.x, target).toBeGreaterThanOrEqual(-0.5);
      expect(rr.y, target).toBeGreaterThanOrEqual(-0.5);
      expect(rr.x + rr.width, target).toBeLessThanOrEqual(1280.5);
      expect(rr.y + rr.height, target).toBeLessThanOrEqual(800.5);
    }
  });
});

// Balloon Pop floating stage (docs/specs/balloon-pop.md, "Floating stage"): every 3rd trial the balloons drift
// upward; the child pops the named balloon while it moves. Real taps on fresh hit rectangles from getBalloonInfo.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { enterWorldByTap, getBalloonInfo, popCorrectBalloon, readStarCount, tapRect, waitForBalloonReady, type BalloonInfo } from './helpers/journey';

const PORTRAIT = 'portrait-800x1280';

function portraitOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== PORTRAIT) test.skip();
}

/**
 * Waits until the balloon is in the lower part of the sky (so it cannot loop to the bottom between the read and
 * the tap), then taps the centre of its current hit rectangle for real.
 */
async function tapMovingBalloon(page: Page, itemId: string): Promise<BalloonInfo> {
  const viewportH = page.viewportSize()?.height ?? 1280;
  const lowEnough = async () => {
    const info = await getBalloonInfo(page);
    const b = info?.balloons.find((x) => x.itemId === itemId);
    return info && b && b.hit.y + b.hit.height / 2 > viewportH * 0.4 ? { info, b } : null;
  };
  await expect.poll(async () => Boolean(await lowEnough()), { timeout: 40_000, intervals: [100] }).toBe(true);
  const found = await lowEnough();
  if (!found) throw new Error(`balloon "${itemId}" left the lower sky before the tap`);
  await tapRect(page, found.b.hit);
  return found.info;
}

async function reachThirdTrial(page: Page): Promise<BalloonInfo> {
  await enterWorldByTap(page, 'profile-a', 'number-garden', 'balloon-pop');
  for (let i = 0; i < 2; i++) {
    const info = await popCorrectBalloon(page);
    expect(info.floating).toBe(false);
  }
  return waitForBalloonReady(page);
}

test.describe('balloon pop: floating stage', () => {
  test('[AC-21] @single-orientation portrait: the third trial floats, a wrong tap fails nothing, and a moving balloon pops', async ({ page }, testInfo) => {
    portraitOnly(testInfo);
    test.setTimeout(90_000);
    const first = await reachThirdTrial(page);
    expect(first.floating).toBe(true);
    const stars = await readStarCount(page);
    const target = (i: BalloonInfo) => i.balloons.find((b) => b.itemId === i.targetItemId)!;

    // The balloons really move (rise, or loop back to the bottom).
    const y0 = target(first).hit.y;
    await expect.poll(async () => Math.abs(target((await getBalloonInfo(page))!).hit.y - y0), { timeout: 5_000 }).toBeGreaterThan(3);
    const moved = (await getBalloonInfo(page))!;
    for (const b of moved.balloons) {
      expect(b.hit.width).toBeGreaterThanOrEqual(64);
      expect(b.hit.height).toBeGreaterThanOrEqual(64);
    }

    // A wrong tap only wobbles: same trial, every balloon still there and still floating, no star lost.
    const wrong = moved.balloons.find((b) => b.itemId !== moved.targetItemId)!;
    await tapMovingBalloon(page, wrong.itemId);
    await expect.poll(async () => (await getBalloonInfo(page))?.tries).toBe(1);
    const after = (await getBalloonInfo(page))!;
    expect(after.floating).toBe(true);
    expect(after.balloons).toHaveLength(first.balloons.length);
    expect(await readStarCount(page)).toBe(stars);

    // Pop the moving target.
    await page.waitForTimeout(500); // past the wrong-tap lock
    await tapMovingBalloon(page, after.targetItemId);
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(stars + 1);
    const next = await waitForBalloonReady(page, 15_000);
    expect(next.correctCount).toBe(3);
    expect(next.floating).toBe(false);
  });
});

test.describe('balloon pop: floating stage with reduced motion', () => {
  test.use({ reducedMotion: 'reduce' });
  test('[AC-22] @single-orientation with prefers-reduced-motion the third trial stays still', async ({ page }, testInfo) => {
    portraitOnly(testInfo);
    test.setTimeout(90_000);
    const third = await reachThirdTrial(page);
    expect(third.floating).toBe(false);
    const y0 = third.balloons.map((b) => b.hit.y);
    await page.waitForTimeout(800);
    const later = (await getBalloonInfo(page))!;
    expect(later.balloons.map((b) => b.hit.y)).toEqual(y0);
  });
});

/**
 * Age-5 floating trials have 4-6 balloons whose 64 px+ pads can overlap. Waits until the target is in the middle
 * of the sky, then taps a point of its pad that no other pad covers (a real tap on the target only).
 */
async function tapMovingTargetClear(page: Page, itemId: string): Promise<BalloonInfo> {
  const viewportH = page.viewportSize()?.height ?? 1280;
  const inside = (r: { x: number; y: number; width: number; height: number }, x: number, y: number) =>
    x >= r.x && x <= r.x + r.width && y >= r.y && y <= r.y + r.height;
  const clearPoint = async () => {
    const info = await getBalloonInfo(page);
    const b = info?.balloons.find((x) => x.itemId === itemId);
    if (!info || !b) return null;
    const cy = b.hit.y + b.hit.height / 2;
    if (cy < viewportH * 0.3 || cy > viewportH * 0.7) return null;
    const others = info.balloons.filter((x) => x.itemId !== itemId);
    for (const fy of [0.5, 0.35, 0.65, 0.25, 0.75]) {
      for (const fx of [0.5, 0.3, 0.7, 0.2, 0.8]) {
        const x = b.hit.x + b.hit.width * fx;
        const y = b.hit.y + b.hit.height * fy;
        if (!others.some((o) => inside(o.hit, x, y))) return { info, x, y };
      }
    }
    return null;
  };
  await expect.poll(async () => Boolean(await clearPoint()), { timeout: 40_000, intervals: [50] }).toBe(true);
  const found = await clearPoint();
  if (!found) throw new Error(`balloon "${itemId}" had no clear point before the tap`);
  await page.mouse.click(found.x, found.y);
  return found.info;
}

test.describe('balloon pop: floating stage on the age-5 stretch', () => {
  test('[AC-25] @single-orientation portrait: an L11 sum trial floats at the L8 speed, keeps 64 px pads, and the moving answer pops', async ({ page }, testInfo) => {
    portraitOnly(testInfo);
    test.setTimeout(120_000);
    await enterWorldByTap(page, 'profile-b', 'number-garden', 'balloon-pop', {
      beforeEnter: () => page.evaluate(() => (window as unknown as { __testHooks__: { seedBalloonLevel: (l: number) => void } }).__testHooks__.seedBalloonLevel(11)),
    });
    for (let i = 0; i < 2; i++) {
      const info = await popCorrectBalloon(page);
      expect(info.floating).toBe(false);
      expect(info.mode).toBe('sum');
    }
    const third = await waitForBalloonReady(page);
    expect(third.level).toBe(11);
    expect(third.mode).toBe('sum');
    expect(third.floating).toBe(true);
    expect(third.balloons).toHaveLength(4);
    for (const b of third.balloons) {
      expect(b.hit.width).toBeGreaterThanOrEqual(64);
      expect(b.hit.height).toBeGreaterThanOrEqual(64);
    }
    const stars = await readStarCount(page);
    await tapMovingTargetClear(page, third.targetItemId);
    await expect.poll(() => readStarCount(page), { timeout: 8_000 }).toBe(stars + 1);
    const next = await waitForBalloonReady(page, 15_000);
    expect(next.floating).toBe(false);
  });
});

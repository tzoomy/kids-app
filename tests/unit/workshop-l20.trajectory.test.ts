// Workshop L20 rung-2 trajectory hint: the dotted path of the ball for the CURRENT setup, from the shared headless world
// (docs/specs/workshop-l20.md AC-17). Phaser's bundled Matter, fixed 1/60 s step.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { L20_WORLD, type L20Config } from '../../src/games/mysteryEgg/workshop/l20Level';
import { L20World, type L20Matter } from '../../src/games/mysteryEgg/workshop/l20World';
import { dotsAlong, trajectoryFor, trajectoryInfoOf } from '../../src/games/mysteryEgg/workshop/l20Trajectory';

const Matter = MatterModule as unknown as L20Matter;
const empty: L20Config = { ramp: 'none', slots: [], scissors: 'none' };
const ramp = (dir: 'down-right' | 'down-left'): L20Config => ({ ramp: dir, slots: [], scissors: 'none' });

/** The real run of the same config on the same world code: the ball's final position. */
function realFinalBall(config: L20Config): { x: number; y: number } {
  const w = new L20World(Matter, config);
  w.release();
  while (w.step()) {
    // stepping
  }
  const b = w.bodies.ball!;
  return { x: b.position.x, y: b.position.y };
}

describe('workshop L20 trajectory preview', () => {
  it('[AC-17] an empty board: the ball drops straight down from the chute (x about 200) and ends on the floor', () => {
    const pts = trajectoryFor(Matter, empty);
    expect(pts.length).toBeGreaterThan(5);
    expect(pts[0].x).toBeCloseTo(200, 0);
    expect(pts[0].y).toBeCloseTo(95, 0);
    // It falls through the chute (inner half-width 42) and, at timeScale 1.25, rolls a little on the floor after landing (16.5 px measured).
    for (const p of pts) expect(Math.abs(p.x - 200)).toBeLessThan(42);
    const last = pts[pts.length - 1];
    expect(last.y).toBeGreaterThan(600);
    // It only falls (a small bounce on the floor is fine).
    for (let i = 1; i < pts.length; i++) expect(pts[i].y).toBeGreaterThanOrEqual(pts[i - 1].y - 10);
  });

  it('[AC-17] the ramp down-right in R1: the path goes right off the ramp and into the cup', () => {
    const pts = trajectoryFor(Matter, ramp('down-right'));
    const last = pts[pts.length - 1];
    expect(last.x).toBeGreaterThan(280);
    expect(last.x).toBeLessThan(400);
    expect(last.y).toBeGreaterThan(500);
    expect(Math.max(...pts.map((p) => p.x))).toBeGreaterThan(260);
  });

  it('[AC-17] the ramp down-left in R1: the path goes left, away from the cup (it ends against the left wall)', () => {
    const pts = trajectoryFor(Matter, ramp('down-left'));
    const last = pts[pts.length - 1];
    expect(last.x).toBeLessThan(120);
    expect(last.y).toBeGreaterThan(400);
    expect(Math.min(...pts.map((p) => p.x))).toBeLessThan(120);
    expect(Math.max(...pts.map((p) => p.x))).toBeLessThan(260);
  });

  it('[AC-17] the last point is the final ball position of the real run of the same config (same world code)', () => {
    const configs: L20Config[] = [
      empty,
      ramp('down-right'),
      ramp('down-left'),
      { ramp: 'down-right', slots: [460, 620], scissors: 'A' },
      { ramp: 'down-right', slots: [500, 580], scissors: 'B' },
    ];
    for (const c of configs) {
      const pts = trajectoryFor(Matter, c);
      const real = realFinalBall(c);
      const last = pts[pts.length - 1];
      expect(Math.abs(last.x - real.x)).toBeLessThanOrEqual(3);
      expect(Math.abs(last.y - real.y)).toBeLessThanOrEqual(3);
    }
  });

  it('[AC-17] the path is deterministic, stays on the board, and a different config gives a different path (cache by config)', () => {
    const solved: L20Config = { ramp: 'down-right', slots: [460, 620], scissors: 'A' };
    const a = trajectoryFor(Matter, solved);
    expect(trajectoryFor(Matter, { ...solved, slots: [...solved.slots] })).toEqual(a);
    for (const p of a) {
      expect(p.x).toBeGreaterThan(0);
      expect(p.x).toBeLessThan(L20_WORLD.width);
      expect(p.y).toBeLessThan(L20_WORLD.height);
    }
    expect(trajectoryFor(Matter, empty)).not.toEqual(a);
  });

  it('[AC-17] the slot order of the config does not matter (the same placements give the same path)', () => {
    const a = trajectoryFor(Matter, { ramp: 'down-right', slots: [460, 620], scissors: 'A' });
    const b = trajectoryFor(Matter, { ramp: 'down-right', slots: [620, 460], scissors: 'A' });
    expect(b).toEqual(a);
  });

  it('[AC-17] dotsAlong spaces dots evenly along the polyline, ends on the last point and never piles up on a resting ball', () => {
    const dots = dotsAlong(
      [
        { x: 0, y: 0 },
        { x: 100, y: 0 },
        { x: 100, y: 0.2 },
        { x: 100, y: 0.4 },
      ],
      25,
    );
    expect(dots.map((d) => d.x)).toEqual([0, 25, 50, 75, 100]);
    expect(dotsAlong([{ x: 5, y: 5 }], 25)).toEqual([{ x: 5, y: 5 }]);
    expect(dotsAlong([], 25)).toEqual([]);
  });

  // Gemini's nits on #121.
  it('[AC-17] dotsAlong always ends on the last sample: a path that is not a multiple of the spacing gets the last point appended', () => {
    const line = (len: number) => [{ x: 0, y: 0 }, { x: len, y: 0 }];
    expect(dotsAlong(line(100), 30).map((d) => d.x)).toEqual([0, 30, 60, 90, 100]);
    expect(dotsAlong(line(10), 30)).toEqual([{ x: 0, y: 0 }, { x: 10, y: 0 }]);
    // An exact multiple adds nothing; a residual under 3 px snaps the last dot onto the last point instead of piling a second dot on it.
    expect(dotsAlong(line(90), 30).map((d) => d.x)).toEqual([0, 30, 60, 90]);
    expect(dotsAlong(line(61), 30).map((d) => d.x)).toEqual([0, 30, 61]);
    // A bent path: the residual is measured along the polyline, the last dot is the last point.
    const bent = [{ x: 0, y: 0 }, { x: 40, y: 0 }, { x: 40, y: 40 }];
    const dots = dotsAlong(bent, 30);
    expect(dots[dots.length - 1]).toEqual({ x: 40, y: 40 });
    for (let i = 1; i < dots.length - 1; i++) expect(Math.hypot(dots[i].x - dots[i - 1].x, dots[i].y - dots[i - 1].y)).toBeGreaterThan(0);
    // The real path of a run ends on its last sample too.
    const pts = trajectoryFor(Matter, ramp('down-right'));
    expect(dotsAlong(pts, 30).at(-1)).toEqual(pts[pts.length - 1]);
  });

  it('[AC-17] the hook info of a trajectory is null for an empty path (no points[0] access) and reports first/last copies otherwise', () => {
    expect(trajectoryInfoOf([], true)).toBeNull();
    const pts = [{ x: 1, y: 2 }, { x: 3, y: 4 }, { x: 5, y: 6 }];
    const info = trajectoryInfoOf(pts, false)!;
    expect(info).toEqual({ points: 3, visible: false, first: { x: 1, y: 2 }, last: { x: 5, y: 6 } });
    info.first.x = 99;
    expect(pts[0].x).toBe(1);
  });
});

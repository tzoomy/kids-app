// Workshop L20 trajectory preview (hint ladder step 4; v4 §1.8 "rung 2 trajectory", v3 §1.5): where the ball would go NOW.
// Pure, Phaser-free: one fresh headless L20World built from the CURRENT placements (the same world code the scene's Play and the
// Vitest physics ACs use, with its 60 settle steps and the scissors snip), stepped at the fixed 1/60 s step until the run ends,
// the ball's position sampled along the way. Deterministic (no jitter) and cached by config. Cosmetic: never touches a live engine.
import { L20_WORLD, type L20Config } from './l20Level';
import { L20World, type L20Matter } from './l20World';

export interface TrajectoryPoint {
  x: number;
  y: number;
}

/** The ball is sampled every this many steps (about 83 ms). */
export const TRAJECTORY_SAMPLE_STEPS = 5;
/** A sample is kept only when the ball moved at least this far from the last kept one, so a resting ball adds no points. */
const MIN_MOVE = 3;

const cache = new Map<string, readonly TrajectoryPoint[]>();

function keyOf(config: L20Config): string {
  return `${config.ramp}|${[...config.slots].sort((a, b) => a - b).join(',')}|${config.scissors}`;
}

/** The ball's path for `config`: the release point first, the final resting position last. */
export function trajectoryFor(M: L20Matter, config: L20Config): readonly TrajectoryPoint[] {
  const key = keyOf(config);
  const hit = cache.get(key);
  if (hit) return hit;
  const world = new L20World(M, { ...config, slots: [...config.slots] });
  world.release();
  const ball = world.bodies.ball;
  const points: TrajectoryPoint[] = [];
  if (ball) {
    const at = (): TrajectoryPoint => ({ x: round(ball.position.x), y: round(ball.position.y) });
    const keep = (p: TrajectoryPoint, force = false): void => {
      const last = points[points.length - 1];
      if (force ? !last || last.x !== p.x || last.y !== p.y : !last || Math.hypot(p.x - last.x, p.y - last.y) >= MIN_MOVE) points.push(p);
    };
    keep(at());
    let n = 0;
    // The run's own end (everything rested for 1 s, or the 16 s timeout) is the cap; leaving the board stops the sampling too.
    while (world.step()) {
      n++;
      const p = at();
      if (p.x < 0 || p.x > L20_WORLD.width || p.y > L20_WORLD.height) break;
      if (n % TRAJECTORY_SAMPLE_STEPS === 0) keep(p);
    }
    keep(at(), true);
  }
  cache.set(key, points);
  return points;
}

/** Drops the cache (tests). */
export function clearTrajectoryCache(): void {
  cache.clear();
}

function round(v: number): number {
  return Math.round(v * 10) / 10;
}

/** Evenly spaced dots (`spacing` px apart along the path) from the first point to the last; a resting ball piles nothing up. */
export function dotsAlong(points: readonly TrajectoryPoint[], spacing: number): TrajectoryPoint[] {
  if (points.length === 0) return [];
  const dots: TrajectoryPoint[] = [{ ...points[0] }];
  let carry = 0;
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    if (len === 0) continue;
    let d = spacing - carry;
    while (d <= len + 1e-9) {
      const t = d / len;
      dots.push({ x: a.x + (b.x - a.x) * t, y: a.y + (b.y - a.y) * t });
      d += spacing;
    }
    carry = len - (d - spacing);
  }
  // The last dot is the last sample: a path that is not a multiple of the spacing gets its end point appended; a residual under
  // END_SNAP px (the last dot would sit on top of it) moves the last dot onto the end point instead.
  const end = points[points.length - 1];
  const tail = dots[dots.length - 1];
  const residual = Math.hypot(end.x - tail.x, end.y - tail.y);
  if (residual > 1e-6) {
    if (residual < END_SNAP && dots.length > 1) dots[dots.length - 1] = { ...end };
    else dots.push({ ...end });
  }
  return dots;
}

/** A residual shorter than this does not get a dot of its own (the dots are about 10 px across). */
const END_SNAP = 3;

/** The read-only hook field for a path: null for an empty path (never reads `points[0]`), else the point count and copies of the ends. */
export function trajectoryInfoOf(points: readonly TrajectoryPoint[], visible: boolean): { points: number; visible: boolean; first: TrajectoryPoint; last: TrajectoryPoint } | null {
  if (points.length === 0) return null;
  return { points: points.length, visible, first: { ...points[0] }, last: { ...points[points.length - 1] } };
}

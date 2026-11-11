// Pure arc math for "fly to target" motion. Writes into a caller-owned object so
// per-frame updates never allocate.

export interface Point {
  x: number;
  y: number;
}

/**
 * Quadratic Bezier from `from` to `to` whose control point sits `height` px above the
 * higher of the two endpoints (screen space, y grows downward). t in [0, 1].
 */
export function arcPoint(t: number, fromX: number, fromY: number, toX: number, toY: number, height: number, out: Point): Point {
  const cx = (fromX + toX) / 2;
  const cy = Math.min(fromY, toY) - height;
  const u = 1 - t;
  out.x = u * u * fromX + 2 * u * t * cx + t * t * toX;
  out.y = u * u * fromY + 2 * u * t * cy + t * t * toY;
  return out;
}

/** Linear interpolation helper. */
export function lerp(a: number, b: number, t: number): number {
  return a + (b - a) * t;
}

/** Uniform random in [min, max). Injectable RNG for tests. */
export function randomBetween(min: number, max: number, random: () => number = Math.random): number {
  return min + (max - min) * random();
}

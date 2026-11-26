// Mystery Egg: the drawn placeholder of the ramp part (shown while `part-ramp.webp` is missing) follows the full RAMP_POLY
// silhouette that the physics body uses, with no fixed vertex indices (docs/specs/mystery-egg.md AC-24).
import { describe, expect, it } from 'vitest';
import { RAMP_POLY, rampPlaceholderShape } from '../../src/games/mysteryEgg/layout';

const inside = (poly: readonly { x: number; y: number }[], p: { x: number; y: number }): boolean => {
  // Convex polygon: the point is on the same side of every edge.
  const signs = poly.map((a, i) => {
    const b = poly[(i + 1) % poly.length];
    return (b.x - a.x) * (p.y - a.y) - (b.y - a.y) * (p.x - a.x);
  });
  return signs.every((s) => s >= -1e-9) || signs.every((s) => s <= 1e-9);
};

describe('mystery-egg ramp placeholder', () => {
  it('[AC-24] the placeholder outline is exactly the RAMP_POLY silhouette, every vertex in order (8 since the painted-silhouette ramp)', () => {
    const shape = rampPlaceholderShape();
    expect(RAMP_POLY.length).toBeGreaterThanOrEqual(8);
    expect(shape.outline).toEqual(RAMP_POLY.map((p) => ({ x: p.x, y: p.y })));
  });

  it('[AC-24] the placeholder shading is derived from the whole outline (one vertex per outline vertex) and lies inside it, so it never leaves the physics body', () => {
    const shape = rampPlaceholderShape();
    expect(shape.shade).toHaveLength(RAMP_POLY.length);
    for (const p of shape.shade) expect(inside(RAMP_POLY, p), `${p.x},${p.y}`).toBe(true);
  });
});

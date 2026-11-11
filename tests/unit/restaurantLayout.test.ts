import { describe, it, expect } from 'vitest';
import { computeRestaurantLayout, iconSizeFor, plateWidthFor, MAX_ICON_SIZE, PLATE_Y_RATIO } from '../../src/games/restaurant/restaurantLayout';

const SIZES: [number, number][] = [
  [1280, 800],
  [800, 1280],
];

describe('restaurant layout', () => {
  for (const [w, h] of SIZES) {
    for (const n of [2, 3]) {
      it(`fits ${n} plates and the animal in ${w}x${h}`, () => {
        const l = computeRestaurantLayout(w, h, n);
        expect(l.landscape).toBe(w >= h);
        expect(l.plates.xs).toHaveLength(n);
        expect(l.plates.y).toBeCloseTo(h * PLATE_Y_RATIO);
        // Every plate (at the widest content, 3 foods) stays on screen and they never overlap.
        const widest = plateWidthFor(iconSizeFor(l.plates.spacing, 3), 3);
        expect(widest).toBeLessThanOrEqual(l.plates.spacing);
        for (const x of l.plates.xs) {
          expect(x - widest / 2).toBeGreaterThanOrEqual(0);
          expect(x + widest / 2).toBeLessThanOrEqual(w);
        }
        // Animal stands behind the counter: feet hidden below the counter top, head on screen
        // and below the HUD/prompt band at the top.
        expect(l.animal.feetY).toBeGreaterThan(l.counter.top);
        expect(l.animal.feetY).toBeLessThan(l.counter.top + l.counter.height);
        expect(l.animal.hitTop).toBeGreaterThan(h * 0.12);
        // Enters from off-screen left, exits off-screen right.
        expect(l.animal.enterFromX + l.animal.displayHeight * 0.5).toBeLessThan(0);
        expect(l.animal.exitToX - l.animal.displayHeight * 0.5).toBeGreaterThan(w);
      });
    }
  }

  it('shrinks food icons to fit more pieces on a plate', () => {
    expect(iconSizeFor(260, 1)).toBe(MAX_ICON_SIZE);
    expect(iconSizeFor(260, 3)).toBeLessThan(iconSizeFor(260, 2));
    expect(iconSizeFor(100, 3)).toBeGreaterThanOrEqual(40);
  });
});

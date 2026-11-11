import { describe, it, expect } from 'vitest';
import {
  COUNTER_SRC_HEIGHT,
  MAX_ICON_SIZE,
  PLATE_ASPECT,
  PLATE_HIT_OVERHANG,
  PLATE_SURFACE_ROW,
  computeRestaurantLayout,
  foodOffsets,
  iconSizeFor,
  plateWidthFor,
  rectsIntersect,
} from '../../src/games/restaurant/restaurantLayout';

const SIZES: [number, number][] = [
  [1280, 800],
  [800, 1280],
];
/** Plate counts of the two age tracks. */
const COUNTS = [2, 3];

describe('restaurant layout', () => {
  for (const [w, h] of SIZES) {
    for (const n of COUNTS) {
      describe(`${n} plates in ${w}x${h}`, () => {
        const l = computeRestaurantLayout(w, h, n);

        it('keeps plates and the animal on screen and in order', () => {
          expect(l.landscape).toBe(w >= h);
          expect(l.plates.xs).toHaveLength(n);
          const widest = plateWidthFor(iconSizeFor(l.plates.spacing, 3), 3);
          expect(widest).toBeLessThanOrEqual(l.plates.spacing);
          for (const x of l.plates.xs) {
            expect(x - widest / 2).toBeGreaterThanOrEqual(0);
            expect(x + widest / 2).toBeLessThanOrEqual(w);
          }
          expect(l.animal.feetY).toBeGreaterThan(l.counter.top);
          expect(l.animal.feetY).toBeLessThan(l.counter.top + l.counter.height);
          expect(l.animal.hitTop).toBeGreaterThan(h * 0.12);
          expect(l.animal.enterFromX + l.animal.displayHeight * 0.5).toBeLessThan(0);
          expect(l.animal.exitToX - l.animal.displayHeight * 0.5).toBeGreaterThan(w);
        });

        it('fills the counter from its top to the bottom of the screen', () => {
          expect(l.counter.top + l.counter.height).toBeCloseTo(h);
          expect(l.counter.left).toBe(0);
          expect(l.counter.width).toBe(w);
        });

        it('puts the plate centre line on the cream countertop surface', () => {
          // Surface rows are 6..84 of counter.svg; the front lip runs to row 100. A plate may rest
          // on the lip edge but must not hang over the wooden front below it.
          const surfaceTop = l.counter.top;
          const surfaceBottom = l.counter.top + 90 * l.counter.scaleY;
          expect(l.plates.y).toBeCloseTo(l.counter.top + PLATE_SURFACE_ROW * l.counter.scaleY);
          // The whole plate (widest case) fits vertically on the surface.
          const plateH = plateWidthFor(iconSizeFor(l.plates.spacing, 1), 1) * PLATE_ASPECT;
          expect(l.plates.y - plateH / 2).toBeGreaterThanOrEqual(surfaceTop);
          expect(l.plates.y + plateH / 2).toBeLessThanOrEqual(surfaceBottom);
        });

        it('never lets a plate hit area overlap the animal tap zone or another plate', () => {
          for (const hit of l.plates.hits) {
            expect(rectsIntersect(hit, l.animal.hit)).toBe(false);
            expect(hit.top).toBeGreaterThanOrEqual(l.counter.top - PLATE_HIT_OVERHANG);
            expect(hit.left).toBeGreaterThanOrEqual(0);
            expect(hit.right).toBeLessThanOrEqual(w);
          }
          l.plates.hits.forEach((a, i) => l.plates.hits.forEach((b, j) => i < j && expect(rectsIntersect(a, b)).toBe(false)));
          expect(l.animal.hit.top).toBeGreaterThan(h * 0.12);
          expect(l.animal.hit.bottom).toBeGreaterThan(l.animal.hit.top);
        });

        it('covers each plate centre with its own hit area', () => {
          l.plates.xs.forEach((x, i) => {
            const hit = l.plates.hits[i];
            expect(x).toBeGreaterThan(hit.left);
            expect(x).toBeLessThan(hit.right);
            expect(l.plates.y).toBeGreaterThan(hit.top);
            expect(l.plates.y).toBeLessThan(hit.bottom);
          });
        });
      });
    }
  }

  it('lines three plates up with the three counter panels and spreads two plates wide', () => {
    const l3 = computeRestaurantLayout(1280, 800, 3);
    expect(l3.plates.xs.map(Math.round)).toEqual([224, 640, 1056]);
    const l2 = computeRestaurantLayout(1280, 800, 2);
    expect(l2.plates.xs[1] - l2.plates.xs[0]).toBeGreaterThanOrEqual(400);
  });

  it('gives a toddler big single foods', () => {
    const l = computeRestaurantLayout(1280, 800, 2);
    expect(iconSizeFor(l.plates.spacing, 1)).toBe(MAX_ICON_SIZE);
    expect(MAX_ICON_SIZE).toBeGreaterThanOrEqual(128);
  });

  it('keeps three-piece plates readable in portrait', () => {
    const l = computeRestaurantLayout(800, 1280, 3);
    expect(iconSizeFor(l.plates.spacing, 3)).toBeGreaterThanOrEqual(76);
  });

  it('shrinks food icons to fit more pieces on a plate', () => {
    expect(iconSizeFor(260, 1)).toBe(MAX_ICON_SIZE);
    expect(iconSizeFor(260, 2)).toBeLessThan(iconSizeFor(260, 1));
    expect(iconSizeFor(260, 3)).toBeLessThanOrEqual(iconSizeFor(260, 2));
    expect(iconSizeFor(100, 3)).toBeGreaterThanOrEqual(40);
  });

  it('arranges three foods as two in back and one in front', () => {
    const [a, b, c] = foodOffsets(80, 3);
    expect(a.y).toBe(b.y);
    expect(c.y).toBeGreaterThan(a.y);
    expect(c.x).toBe(0);
    expect(foodOffsets(80, 2).map((o) => o.y)).toEqual([foodOffsets(80, 2)[0].y, foodOffsets(80, 2)[0].y]);
    expect(COUNTER_SRC_HEIGHT).toBe(260);
  });
});

import { describe, it, expect } from 'vitest';
import { TRAIN_LAYOUT, planTrainCars, planTrainView, trainContentWidth } from '../../src/anim/trainLayout';

describe('Picnic Train layout helper', () => {
  it('composes 2–10 seats from 2-seat and 1-seat cars', () => {
    expect(planTrainCars(2)).toEqual([{ type: 'car', seats: 2 }]);
    expect(planTrainCars(5)).toEqual([
      { type: 'car', seats: 2 },
      { type: 'car', seats: 2 },
      { type: 'single', seats: 1 },
    ]);
    const ten = planTrainCars(10);
    expect(ten.reduce((n, c) => n + c.seats, 0)).toBe(10);
    expect(ten.filter((c) => c.type === 'single')).toHaveLength(0);
  });

  it('never scales passengers below the minimum tap-friendly height', () => {
    const view = planTrainView({ viewportWidth: 800, seatCount: 10 });
    expect(view.scale * TRAIN_LAYOUT.passengerHeightAtScale1).toBeGreaterThanOrEqual(TRAIN_LAYOUT.minPassengerHeight);
    expect(view.scale).toBeGreaterThanOrEqual(1);
    expect(view.contentWidth).toBe(trainContentWidth(10, view.scale));
  });

  it('pans the camera to keep a focused seat in view instead of shrinking the train', () => {
    const start = planTrainView({ viewportWidth: 600, seatCount: 10, focusSeat: 0 });
    const mid = planTrainView({ viewportWidth: 600, seatCount: 10, focusSeat: 6 });
    expect(start.scale).toBe(mid.scale);
    expect(mid.offsetX).toBeGreaterThan(start.offsetX);
    expect(mid.offsetX).toBeLessThanOrEqual(Math.max(0, mid.contentWidth - 600));
    const fits = planTrainView({ viewportWidth: 4000, seatCount: 2, focusSeat: 0 });
    expect(fits.offsetX).toBe(0);
  });
});

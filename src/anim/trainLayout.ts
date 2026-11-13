/**
 * Picnic Train layout recommendation (no game logic).
 *
 * Do not shrink a 2–10 seat train to fit the entire consist in one tablet
 * viewport. That makes passengers too small to tap. Keep a minimum passenger
 * display height and pan (or scroll) a camera along the train instead.
 *
 * Preview pieces at scale 1 use TRAIN_LAYOUT.engineWidth / carWidth /
 * carSingleWidth and pieceHeight. `planTrainView` returns the scale and
 * camera offset a scene or preview should use.
 */
export const TRAIN_LAYOUT = {
  /** Minimum on-screen height of a seated passenger, in CSS / game pixels. */
  minPassengerHeight: 112,
  engineWidth: 180,
  carWidth: 160,
  carSingleWidth: 100,
  pieceHeight: 130,
  /**
   * Passenger sprite height inside a car at layout scale 1 (the seat is 55%
   * of the 130 px piece, and the passenger fills 90% of that seat).
   */
  passengerHeightAtScale1: 64,
} as const;

export type TrainCarType = 'car' | 'single';

export interface TrainCarPlan {
  type: TrainCarType;
  /** 2 for a standard car, 1 for the short car. */
  seats: number;
}

export interface TrainViewPlan {
  /** Layout scale, never below what TRAIN_LAYOUT.minPassengerHeight requires. */
  scale: number;
  contentWidth: number;
  contentHeight: number;
  viewportWidth: number;
  /** Camera scroll in content pixels; 0 keeps the engine at the left edge. */
  offsetX: number;
  /** 0-based seat index the camera was asked to keep in view, if any. */
  focusSeat: number;
}

/** Compose 2-seat and 1-seat cars so `seatCount` seats (2–10) can be laid out. */
export function planTrainCars(seatCount: number): TrainCarPlan[] {
  const n = Math.max(1, Math.round(seatCount));
  const cars: TrainCarPlan[] = [];
  let remaining = n;
  while (remaining >= 2) {
    cars.push({ type: 'car', seats: 2 });
    remaining -= 2;
  }
  if (remaining === 1) cars.push({ type: 'single', seats: 1 });
  return cars;
}

export function trainContentWidth(seatCount: number, scale = 1): number {
  const cars = planTrainCars(seatCount);
  let width = TRAIN_LAYOUT.engineWidth;
  for (const car of cars) {
    width += car.type === 'single' ? TRAIN_LAYOUT.carSingleWidth : TRAIN_LAYOUT.carWidth;
  }
  return width * scale;
}

/**
 * Choose a scale that keeps passengers at least `minPassengerHeight` tall,
 * then pan so `focusSeat` (default 0, the first passenger seat) stays in view.
 * If the train already fits, offsetX is 0.
 */
export function planTrainView(opts: {
  viewportWidth: number;
  seatCount: number;
  focusSeat?: number;
  minPassengerHeight?: number;
}): TrainViewPlan {
  const minH = opts.minPassengerHeight ?? TRAIN_LAYOUT.minPassengerHeight;
  const scale = Math.max(1, minH / TRAIN_LAYOUT.passengerHeightAtScale1);
  const contentWidth = trainContentWidth(opts.seatCount, scale);
  const contentHeight = TRAIN_LAYOUT.pieceHeight * scale;
  const viewportWidth = Math.max(1, opts.viewportWidth);
  const cars = planTrainCars(opts.seatCount);
  const totalSeats = cars.reduce((n, c) => n + c.seats, 0);
  const focusSeat = Math.max(0, Math.min(totalSeats - 1, opts.focusSeat ?? 0));

  // Walk from the engine's right edge to the focused seat's approximate center.
  let x = TRAIN_LAYOUT.engineWidth * scale;
  let seen = 0;
  for (const car of cars) {
    const w = (car.type === 'single' ? TRAIN_LAYOUT.carSingleWidth : TRAIN_LAYOUT.carWidth) * scale;
    for (let i = 0; i < car.seats; i++) {
      if (seen === focusSeat) {
        const seatCenter = x + ((i + 0.5) / car.seats) * w;
        const raw = seatCenter - viewportWidth / 2;
        const max = Math.max(0, contentWidth - viewportWidth);
        const offsetX = Math.max(0, Math.min(max, raw));
        return { scale, contentWidth, contentHeight, viewportWidth, offsetX, focusSeat };
      }
      seen += 1;
    }
    x += w;
  }
  return { scale, contentWidth, contentHeight, viewportWidth, offsetX: 0, focusSeat };
}

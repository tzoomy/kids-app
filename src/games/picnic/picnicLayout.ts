// Pure layout for Picnic Train in both supported orientations (1280x800 and 800x1280). No Phaser, so it is unit-testable.
// The train is laid out with src/anim/trainLayout.ts (planTrainView): passengers are never shown smaller than
// TRAIN_LAYOUT.minPassengerHeight, and the camera pans along the train instead of shrinking it. Below the train sit the
// cargo shelf (load) or the number cards (missing), and at the bottom the picnic basket with the go flag.
// All values are game px; the game is FIT-scaled, so at the two supported sizes 1 game px = 1 CSS px.
import { TRAIN_LAYOUT, planTrainCars, trainContentWidth, type TrainCarType } from '../../anim/trainLayout';
import { MAX_LOAD } from './picnicLogic';

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Top band covered by the DOM HUD bar and the prompt bubble. */
export const TOP_RESERVED = 128;
export const MIN_TAP = 64;
/** Seat cushion centres as a fraction of a piece's width (read off art/train/car.svg and car-single.svg). */
const SEAT_FRACTIONS: Record<TrainCarType, readonly number[]> = { car: [0.3, 0.7], single: [0.5] };
/** Cushion top as a fraction of the piece height (art y 122 of 260). */
const SEAT_TOP_FRACTION = 122 / 260;
const SEAT_HIT_WIDTH = 104;
const SIDE_MARGIN = 28;
const VISIBLE_MARGIN = 8;

export interface TrainPieceLayout {
  type: 'engine' | TrainCarType;
  /** Content coordinates (before the pan): left edge. */
  x: number;
  width: number;
}

export interface SeatLayout {
  index: number;
  /** Seat centre x in content coordinates. */
  cx: number;
  /** Seat centre x on screen, after the pan. */
  pageCx: number;
  /** Feet line of a seated passenger on screen. */
  feetY: number;
  /** Tap rectangle on screen (after the pan). */
  hit: LayoutRect;
  /** The whole tap rectangle is inside the screen. */
  visible: boolean;
}

export interface PicnicLayout {
  width: number;
  height: number;
  landscape: boolean;
  scale: number;
  /** Display height of a seated passenger (never below TRAIN_LAYOUT.minPassengerHeight). */
  passengerHeight: number;
  /** Left shift that centres a short train on screen. */
  originX: number;
  /** Camera scroll in content pixels. */
  offsetX: number;
  contentWidth: number;
  trainTop: number;
  trainHeight: number;
  pieces: TrainPieceLayout[];
  seats: SeatLayout[];
  basket: { x: number; y: number; width: number; height: number; hit: LayoutRect };
  go: { x: number; y: number; width: number; height: number; hit: LayoutRect };
  shelf: { slots: LayoutRect[] };
}

export interface PicnicLayoutOptions {
  seatCount: number;
  /** 0-based seat the camera must keep in view. */
  focusSeat: number;
  /** When this scroll already shows the focus seat it is kept, so the camera does not jitter. */
  currentOffsetX?: number;
}

/** Vertical metrics of the train band, shared with `cardRects`. */
export function trainBand(width: number, height: number): { trainTop: number; trainHeight: number; scale: number; below: number } {
  const landscape = width >= height;
  const scale = Math.max(1, TRAIN_LAYOUT.minPassengerHeight / TRAIN_LAYOUT.passengerHeightAtScale1);
  const trainTop = landscape ? TOP_RESERVED + 84 : TOP_RESERVED + 132;
  const trainHeight = TRAIN_LAYOUT.pieceHeight * scale;
  return { trainTop, trainHeight, scale, below: trainTop + trainHeight + 40 };
}

function slotSize(width: number): number {
  const fit = Math.floor((width - 2 * SIDE_MARGIN - (MAX_LOAD - 1) * 6) / MAX_LOAD);
  return Math.max(MIN_TAP, Math.min(76, fit));
}

/** Number cards 1..count in one centred row below the train (same band as the cargo shelf). */
export function cardRects(width: number, height: number, count: number): LayoutRect[] {
  const { below } = trainBand(width, height);
  const gap = 8;
  const fit = Math.floor((width - 2 * SIDE_MARGIN - (count - 1) * gap) / Math.max(1, count));
  const size = Math.max(MIN_TAP, Math.min(110, fit));
  const rowWidth = count * size + (count - 1) * gap;
  const left = (width - rowWidth) / 2;
  return Array.from({ length: count }, (_, i) => ({ x: left + i * (size + gap), y: below, width: size, height: size }));
}

export function computePicnicLayout(width: number, height: number, options: PicnicLayoutOptions): PicnicLayout {
  const landscape = width >= height;
  const seatCount = Math.max(1, Math.min(10, Math.round(options.seatCount)));
  const { trainTop, trainHeight, scale } = trainBand(width, height);
  // `trainBand` applies the same minimum passenger scale as planTrainView; the pan below centres the focus seat.
  const contentWidth = trainContentWidth(seatCount, scale);
  const originX = Math.max(0, (width - contentWidth) / 2);
  const maxOffset = Math.max(0, contentWidth - width);

  // Pieces and seat centres in content coordinates.
  const pieces: TrainPieceLayout[] = [{ type: 'engine', x: 0, width: TRAIN_LAYOUT.engineWidth * scale }];
  const seatCenters: number[] = [];
  let x = TRAIN_LAYOUT.engineWidth * scale;
  for (const car of planTrainCars(seatCount)) {
    const w = (car.type === 'single' ? TRAIN_LAYOUT.carSingleWidth : TRAIN_LAYOUT.carWidth) * scale;
    pieces.push({ type: car.type, x, width: w });
    for (const fraction of SEAT_FRACTIONS[car.type].slice(0, car.seats)) seatCenters.push(x + fraction * w);
    x += w;
  }

  const focus = Math.max(0, Math.min(seatCenters.length - 1, Math.round(options.focusSeat)));
  const hitLeft = (cx: number, offset: number) => originX + cx - offset - SEAT_HIT_WIDTH / 2;
  const showsFocus = (offset: number) => {
    const left = hitLeft(seatCenters[focus], offset);
    return left >= VISIBLE_MARGIN && left + SEAT_HIT_WIDTH <= width - VISIBLE_MARGIN;
  };
  let offsetX: number;
  if (options.currentOffsetX !== undefined && showsFocus(Math.max(0, Math.min(maxOffset, options.currentOffsetX)))) {
    offsetX = Math.max(0, Math.min(maxOffset, options.currentOffsetX));
  } else {
    offsetX = maxOffset === 0 ? 0 : Math.max(0, Math.min(maxOffset, seatCenters[focus] - width / 2));
  }

  const passengerHeight = TRAIN_LAYOUT.passengerHeightAtScale1 * scale;
  const feetY = trainTop + trainHeight * SEAT_TOP_FRACTION;
  const hitHeight = passengerHeight + 24;
  const seats: SeatLayout[] = seatCenters.map((cx, index) => {
    const left = hitLeft(cx, offsetX);
    const hit: LayoutRect = { x: left, y: feetY - passengerHeight - 12, width: SEAT_HIT_WIDTH, height: hitHeight };
    return {
      index,
      cx,
      pageCx: originX + cx - offsetX,
      feetY,
      hit,
      visible: left >= 0 && left + SEAT_HIT_WIDTH <= width,
    };
  });

  // Basket and go flag at the bottom.
  const basketSize = landscape ? 150 : 190;
  const basketCy = height - 24 - basketSize / 2;
  const basketCx = width / 2;
  const goSize = landscape ? 112 : 128;
  const goCx = basketCx + basketSize / 2 + 28 + goSize / 2;
  const goCy = basketCy + basketSize / 2 - goSize / 2;
  const basket = {
    x: basketCx,
    y: basketCy,
    width: basketSize,
    height: basketSize,
    hit: { x: basketCx - basketSize / 2, y: basketCy - basketSize / 2, width: basketSize, height: basketSize },
  };
  const go = {
    x: goCx,
    y: goCy,
    width: goSize,
    height: goSize,
    hit: { x: goCx - goSize / 2, y: goCy - goSize / 2, width: goSize, height: goSize },
  };

  // Cargo shelf: MAX_LOAD slots in one centred row below the train.
  const size = slotSize(width);
  const gap = 6;
  const rowWidth = MAX_LOAD * size + (MAX_LOAD - 1) * gap;
  const left = (width - rowWidth) / 2;
  const { below } = trainBand(width, height);
  const slots: LayoutRect[] = Array.from({ length: MAX_LOAD }, (_, i) => ({ x: left + i * (size + gap), y: below, width: size, height: size }));

  return {
    width,
    height,
    landscape,
    scale,
    passengerHeight,
    originX,
    offsetX,
    contentWidth,
    trainTop,
    trainHeight,
    pieces,
    seats,
    basket,
    go,
    shelf: { slots },
  };
}

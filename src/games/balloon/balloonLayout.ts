// Pure layout for Balloon Pop in both supported orientations (1280x800 and 800x1280).
// Balloons sit in one row (landscape) or up to two rows (portrait) under the HUD and prompt bubble. No Phaser.
import type { Rect } from '../restaurant/restaurantLayout';

export interface BalloonSlot {
  /** Centre of the balloon body. */
  x: number;
  y: number;
  /** Body radii (the body is an ellipse a little taller than wide). */
  rx: number;
  ry: number;
  /** Length of the string below the knot. */
  stringLength: number;
  row: number;
  /** Tap rectangle in game coordinates (body plus a margin for the idle bob). */
  hit: Rect;
}

export interface BalloonLayout {
  width: number;
  height: number;
  landscape: boolean;
  cols: number;
  rows: number;
  balloons: BalloonSlot[];
  /** Round speaker button that replays the request (not a hint). */
  replay: { x: number; y: number; radius: number };
  /** Start y for the rise-in tween (below the screen). */
  riseFromY: number;
}

const MAX_RX = 105;
/** Height to width of the balloon body. */
const BODY_RATIO = 1.22;
/** Idle bob distance in game px; the hit box covers it. */
export const BOB_DISTANCE = 8;
const HIT_MARGIN = 14;

export function columnsFor(count: number, landscape: boolean): number {
  if (landscape || count <= 3) return Math.max(1, count);
  return Math.ceil(count / 2);
}

export function computeBalloonLayout(width: number, height: number, count: number): BalloonLayout {
  const landscape = width >= height;
  const n = Math.max(1, count);
  const cols = columnsFor(n, landscape);
  const rows = Math.ceil(n / cols);
  // Keep clear of the HUD and the prompt bubble at the top.
  const top = Math.max(200, height * 0.22);
  const bottom = height * 0.97;
  const rowH = (bottom - top) / rows;
  const slotW = width / cols;
  // Each row holds the body (2 * ry) plus a string of about 0.5 * ry.
  const rx = Math.min(MAX_RX, slotW * 0.36, rowH / (BODY_RATIO * 2.6));
  const ry = rx * BODY_RATIO;
  const balloons: BalloonSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    const x = (width - inRow * slotW) / 2 + (col + 0.5) * slotW;
    // Stagger heights a little so the row reads as floating, not as a shelf.
    const stagger = inRow > 1 ? (col % 2 === 0 ? -0.06 : 0.06) * rowH : 0;
    const y = top + row * rowH + rowH * 0.42 + stagger;
    const hitHalfW = Math.min(slotW / 2 - 6, rx + HIT_MARGIN);
    balloons.push({
      x,
      y,
      rx,
      ry,
      stringLength: ry * 0.55,
      row,
      hit: {
        left: x - hitHalfW,
        right: x + hitHalfW,
        top: y - ry - HIT_MARGIN - BOB_DISTANCE,
        bottom: y + ry + HIT_MARGIN + BOB_DISTANCE,
      },
    });
  }
  return {
    width,
    height,
    landscape,
    cols,
    rows,
    balloons,
    replay: { x: width - 72, y: Math.round(height * 0.155), radius: 44 },
    riseFromY: height + 200,
  };
}

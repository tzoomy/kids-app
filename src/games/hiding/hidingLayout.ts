// Pure layout for Who's Hiding? in both supported orientations (1280x800 and 800x1280).
// Bushes sit in one or two rows below the HUD / prompt bubble area. No Phaser.
import type { Rect } from '../restaurant/restaurantLayout';

export type BushShape = 'round' | 'tall';

export interface BushSlot {
  x: number;
  shape: BushShape;
  /** Bottom of the bush art (origin is bottom-centre). */
  bottomY: number;
  width: number;
  height: number;
  /** Top edge of the solid front foliage: the animal's visible part is measured from here. */
  topY: number;
  /** Display height of the hiding animal. */
  animalHeight: number;
  row: number;
  /** Tap rectangle in game coordinates. */
  hit: Rect;
  /** Depth base for this bush (back +1, animal +2, front +3, popped-out animal +4). */
  depth: number;
}

export interface HidingLayout {
  width: number;
  height: number;
  landscape: boolean;
  cols: number;
  rows: number;
  bushes: BushSlot[];
  /** Round speaker button that replays the request (not a hint). */
  replay: { x: number; y: number; radius: number };
}

/** Source art (viewBox) of the bush props and the fraction where the solid front foliage starts. */
export const BUSH_ART = {
  round: { w: 360, h: 280, topFrac: 0.54 },
  tall: { w: 280, h: 360, topFrac: 0.52 },
} as const;

const MAX_BUSH_WIDTH = 300;
const ANIMAL_TO_BUSH_WIDTH = 0.78;
/** Rows need this much height per bush width: the animal above the foliage plus the foliage below. */
const ROW_HEIGHT_PER_WIDTH = 1.14;
const HIT_GAP = 10;

export function columnsFor(count: number, landscape: boolean): number {
  if (count <= 3) return Math.max(1, count);
  if (landscape) return count <= 5 ? count : Math.ceil(count / 2);
  return Math.ceil(count / 2);
}

/** Y position of the animal's feet so that `reveal` (0..1) of its height shows above `topY`. */
export function animalFeetY(topY: number, animalHeight: number, reveal: number): number {
  return topY + (1 - reveal) * animalHeight;
}

export function computeHidingLayout(width: number, height: number, bushCount: number): HidingLayout {
  const landscape = width >= height;
  const n = Math.max(1, bushCount);
  const cols = columnsFor(n, landscape);
  const rows = Math.ceil(n / cols);
  const top = Math.max(190, height * 0.2);
  const rowH = (height - top - height * 0.03) / rows;
  const slotW = width / cols;
  const bushW = Math.min(MAX_BUSH_WIDTH, slotW * 0.92, rowH / ROW_HEIGHT_PER_WIDTH);
  const bushes: BushSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    const x = (width - inRow * slotW) / 2 + (col + 0.5) * slotW;
    const shape: BushShape = i % 2 === 0 ? 'round' : 'tall';
    const art = BUSH_ART[shape];
    const w = shape === 'tall' ? bushW * 0.8 : bushW;
    const h = (w * art.h) / art.w;
    const bottomY = top + (row + 1) * rowH - 6;
    const topY = bottomY - h * (1 - art.topFrac);
    const animalHeight = bushW * ANIMAL_TO_BUSH_WIDTH;
    const rowTop = top + row * rowH;
    bushes.push({
      x,
      shape,
      bottomY,
      width: w,
      height: h,
      topY,
      animalHeight,
      row,
      hit: { left: x - slotW / 2 + HIT_GAP, top: Math.max(rowTop, topY - animalHeight * 0.6), right: x + slotW / 2 - HIT_GAP, bottom: bottomY },
      depth: row * 10,
    });
  }
  return { width, height, landscape, cols, rows, bushes, replay: { x: width - 72, y: Math.round(height * 0.155), radius: 44 } };
}

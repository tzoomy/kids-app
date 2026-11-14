// Pure layout for Shadow Match in both supported orientations (1280x800 and 800x1280).
// Standing full-body animal silhouettes sit in one or two centred rows below the HUD. No Phaser.
import type { Rect } from '../restaurant/restaurantLayout';
import { columnsFor } from './hidingLayout';

export interface ShadowSlot {
  x: number;
  feetY: number;
  animalHeight: number;
  row: number;
  hit: Rect;
}

export interface ShadowLayout {
  width: number;
  height: number;
  landscape: boolean;
  cols: number;
  rows: number;
  slots: ShadowSlot[];
  replay: { x: number; y: number; radius: number };
}

export function computeShadowLayout(width: number, height: number, count: number): ShadowLayout {
  const landscape = width >= height;
  const n = Math.max(1, count);
  const cols = columnsFor(n, landscape);
  const rows = Math.ceil(n / cols);
  const top = Math.max(190, height * 0.2);
  const rowH = (height * 0.97 - top) / rows;
  const slotW = width / cols;
  const animalHeight = Math.min(300, rowH * 0.82, slotW * 1.05);
  const halfHitW = Math.min(slotW / 2 - 8, animalHeight * 0.55);

  const slots: ShadowSlot[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const inRow = Math.min(cols, n - row * cols);
    const col = i - row * cols;
    const x = (width - inRow * slotW) / 2 + (col + 0.5) * slotW;
    const feetY = top + (row + 1) * rowH - 10;
    slots.push({
      x,
      feetY,
      animalHeight,
      row,
      hit: {
        left: x - halfHitW,
        top: feetY - animalHeight - 10,
        right: x + halfHitW,
        bottom: feetY + 8,
      },
    });
  }

  return {
    width,
    height,
    landscape,
    cols,
    rows,
    slots,
    replay: { x: width - 72, y: Math.round(height * 0.155), radius: 44 },
  };
}

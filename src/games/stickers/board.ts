// Pure Sticker Board state and geometry helpers. No Phaser dependency.
// Coordinates are normalised to [0, 1] inside the board rectangle.

export const MAX_STICKERS = 30;
export const MAX_STROKES = 80;
export const MAX_POINTS = 400;
export const TAP_SLOP_CSS = 8;
export const UNDO_CAP = 30;

export interface PlacedSticker {
  stickerId: string;
  /** Normalised x coordinate in [0, 1] relative to the board. */
  x: number;
  /** Normalised y coordinate in [0, 1] relative to the board. */
  y: number;
}

export interface Stroke {
  colorId: string;
  /** Flat array of normalised coordinates [x0, y0, x1, y1, ...] in [0, 1]. */
  points: number[];
}

export interface Board {
  backgroundId: string;
  stickers: PlacedSticker[];
  strokes: Stroke[];
}

const GRID_COLS = 6;
const GRID_ROWS = 5;
const GRID_X_MIN = 0.1;
const GRID_X_MAX = 0.9;
const GRID_Y_MIN = 0.12;
const GRID_Y_MAX = 0.88;
const SLOT_TOLERANCE_X = 0.07;
const SLOT_TOLERANCE_Y = 0.08;

const SLOT_GRID: ReadonlyArray<{ x: number; y: number }> = (() => {
  const slots: Array<{ x: number; y: number }> = [];
  for (let row = 0; row < GRID_ROWS; row++) {
    const y = GRID_Y_MIN + (row / (GRID_ROWS - 1)) * (GRID_Y_MAX - GRID_Y_MIN);
    for (let col = 0; col < GRID_COLS; col++) {
      const x = GRID_X_MIN + (col / (GRID_COLS - 1)) * (GRID_X_MAX - GRID_X_MIN);
      slots.push({ x, y });
    }
  }
  return slots;
})();

function clamp(n: number, min: number, max: number): number {
  if (!Number.isFinite(n)) return min;
  return Math.max(min, Math.min(max, n));
}

export function clamp01(n: number): number {
  return clamp(n, 0, 1);
}

export function createEmptyBoard(backgroundId: string): Board {
  return { backgroundId, stickers: [], strokes: [] };
}

export function cloneBoard(board: Board): Board {
  return {
    backgroundId: board.backgroundId,
    stickers: board.stickers.map((s) => ({ stickerId: s.stickerId, x: s.x, y: s.y })),
    strokes: board.strokes.map((st) => ({ colorId: st.colorId, points: [...st.points] })),
  };
}

/** Returns the next deterministic free slot in the 6x5 board grid. */
export function nextSlot(board: Board): { x: number; y: number } {
  for (const slot of SLOT_GRID) {
    const occupied = board.stickers.some(
      (s) => Math.abs(s.x - slot.x) < SLOT_TOLERANCE_X && Math.abs(s.y - slot.y) < SLOT_TOLERANCE_Y,
    );
    if (!occupied) return { x: slot.x, y: slot.y };
  }
  const fallback = SLOT_GRID[board.stickers.length % SLOT_GRID.length];
  return { x: fallback.x, y: fallback.y };
}

/**
 * Adds a sticker to the board at `pos` or at `nextSlot`.
 * Caps at MAX_STICKERS (30): adding a 31st drops the oldest sticker.
 */
export function addSticker(board: Board, stickerId: string, pos?: { x: number; y: number }): Board {
  const trimmed =
    board.stickers.length >= MAX_STICKERS
      ? board.stickers.slice(board.stickers.length - MAX_STICKERS + 1)
      : board.stickers.slice();
  const targetPos = pos
    ? { x: clamp01(pos.x), y: clamp01(pos.y) }
    : nextSlot({ ...board, stickers: trimmed });
  trimmed.push({ stickerId, x: targetPos.x, y: targetPos.y });
  return {
    ...board,
    stickers: trimmed,
    strokes: board.strokes.map((st) => ({ colorId: st.colorId, points: [...st.points] })),
  };
}

/**
 * Returns the index of the topmost placed sticker containing (x, y) within
 * (halfWidthNorm, halfHeightNorm), or -1 if none hits.
 */
export function hitSticker(
  board: Board,
  x: number,
  y: number,
  halfWidthNorm: number,
  halfHeightNorm: number,
): number {
  for (let i = board.stickers.length - 1; i >= 0; i--) {
    const s = board.stickers[i];
    if (Math.abs(x - s.x) <= halfWidthNorm && Math.abs(y - s.y) <= halfHeightNorm) {
      return i;
    }
  }
  return -1;
}

/**
 * Moves sticker at `index` to `(x, y)` clamped within `[padX, 1 - padX]` x `[padY, 1 - padY]`,
 * and brings it to the top (end of the stickers array).
 */
export function moveSticker(
  board: Board,
  index: number,
  x: number,
  y: number,
  padX = 0,
  padY = 0,
): Board {
  if (index < 0 || index >= board.stickers.length) return board;
  const safePadX = clamp(padX, 0, 0.5);
  const safePadY = clamp(padY, 0, 0.5);
  const nx = clamp(x, safePadX, 1 - safePadX);
  const ny = clamp(y, safePadY, 1 - safePadY);
  const nextStickers = board.stickers.map((s) => ({ ...s }));
  const [moved] = nextStickers.splice(index, 1);
  moved.x = nx;
  moved.y = ny;
  nextStickers.push(moved);
  return {
    ...board,
    stickers: nextStickers,
    strokes: board.strokes.map((st) => ({ colorId: st.colorId, points: [...st.points] })),
  };
}

/** Starts a new stroke at normalised `(x, y)`. Drops oldest stroke if exceeding MAX_STROKES (80). */
export function startStroke(board: Board, colorId: string, x: number, y: number): Board {
  const strokes = board.strokes.map((st) => ({ colorId: st.colorId, points: [...st.points] }));
  strokes.push({ colorId, points: [clamp01(x), clamp01(y)] });
  const capped = strokes.length > MAX_STROKES ? strokes.slice(strokes.length - MAX_STROKES) : strokes;
  return {
    ...board,
    stickers: board.stickers.map((s) => ({ ...s })),
    strokes: capped,
  };
}

/** Appends `(x, y)` to the active (last) stroke, ignoring points beyond MAX_POINTS (400). */
export function extendStroke(board: Board, x: number, y: number): Board {
  if (board.strokes.length === 0) return board;
  const last = board.strokes[board.strokes.length - 1];
  if (last.points.length >= MAX_POINTS * 2) return board;
  const strokes = board.strokes.map((st) => ({ colorId: st.colorId, points: [...st.points] }));
  strokes[strokes.length - 1].points.push(clamp01(x), clamp01(y));
  return {
    ...board,
    stickers: board.stickers.map((s) => ({ ...s })),
    strokes,
  };
}

/** Clears all stickers and strokes while keeping the current backgroundId. */
export function clearBoard(board: Board): Board {
  return { backgroundId: board.backgroundId, stickers: [], strokes: [] };
}

/** Restores stickers and strokes from `previous` while keeping `current.backgroundId`. */
export function undoKeepingBackground(current: Board, previous: Board): Board {
  return {
    ...cloneBoard(previous),
    backgroundId: current.backgroundId,
  };
}

/** In-memory undo stack storing deep-cloned Board snapshots up to `cap` (default UNDO_CAP = 30). */
export class UndoStack {
  private readonly items: Board[] = [];

  constructor(private readonly cap: number = UNDO_CAP) {}

  get length(): number {
    return this.items.length;
  }

  get isEmpty(): boolean {
    return this.items.length === 0;
  }

  push(snapshot: Board): void {
    if (this.cap <= 0) return;
    this.items.push(cloneBoard(snapshot));
    if (this.items.length > this.cap) {
      this.items.shift();
    }
  }

  pop(): Board | undefined {
    const item = this.items.pop();
    return item ? cloneBoard(item) : undefined;
  }

  clear(): void {
    this.items.length = 0;
  }
}

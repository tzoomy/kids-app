// Pure layout for the Animal Restaurant in both supported orientations (1280x800 and
// 800x1280). No Phaser, so it is unit-testable. The counter front (counter.svg, 1280x260
// source units) is stretched from `counter.top` down to the bottom of the screen; the
// source rows below describe where its cream countertop surface sits so plates can be
// placed on it in either orientation.

export interface Rect {
  left: number;
  top: number;
  right: number;
  bottom: number;
}

export interface RestaurantLayout {
  width: number;
  height: number;
  landscape: boolean;
  /** Counter front: fills from `top` to the bottom of the screen. */
  counter: { left: number; top: number; width: number; height: number; stripHeight: number; scaleY: number };
  animal: { x: number; feetY: number; displayHeight: number; enterFromX: number; exitToX: number; hitTop: number; hit: Rect };
  /** `y` is the plate centre line; `hits` are plate tap rectangles in game coordinates. */
  plates: { xs: number[]; y: number; spacing: number; hits: Rect[] };
}

export const COUNTER_TOP_RATIO = 0.58;
/** counter.svg source height; the countertop surface spans rows 6..84 of it. */
export const COUNTER_SRC_HEIGHT = 260;
/** Source row of the plate centre line on the cream surface (surface is 6..84). */
export const PLATE_SURFACE_ROW = 42;
export const MAX_ICON_SIZE = 140;
export const ICON_GAP = 8;
/** Plate art aspect (plate.svg is 320x140). */
export const PLATE_ASPECT = 140 / 320;
/** Plate hit areas reach this far above the counter top; the animal zone stops there. */
export const PLATE_HIT_OVERHANG = 44;
/** Horizontal breathing room between neighbouring plate hit areas. */
const HIT_GAP = 12;
/** Counter panel centres (fractions of the width) the plates line up with. */
const PANEL_CENTERS_3 = [0.175, 0.5, 0.825];
const PANEL_CENTERS_2_LANDSCAPE = [0.32, 0.68];
const PANEL_CENTERS_2_PORTRAIT = [0.3, 0.7];

function plateXs(width: number, n: number, landscape: boolean): number[] {
  if (n <= 1) return [width / 2];
  if (n === 2) return (landscape ? PANEL_CENTERS_2_LANDSCAPE : PANEL_CENTERS_2_PORTRAIT).map((f) => width * f);
  if (n === 3) return PANEL_CENTERS_3.map((f) => width * f);
  const spacing = (width - 64) / n;
  const startX = width / 2 - ((n - 1) * spacing) / 2;
  return Array.from({ length: n }, (_, i) => startX + i * spacing);
}

export function computeRestaurantLayout(width: number, height: number, choiceCount: number): RestaurantLayout {
  const landscape = width >= height;
  const counterTop = height * COUNTER_TOP_RATIO;
  const counterHeight = height - counterTop;
  const scaleY = counterHeight / COUNTER_SRC_HEIGHT;
  const n = Math.max(1, choiceCount);
  const xs = plateXs(width, n, landscape);
  const spacing = n > 1 ? xs[1] - xs[0] : width - 64;
  const displayHeight = landscape ? Math.min(340, height * 0.43) : Math.min(430, height * 0.34);
  // Feet hidden behind the counter front so the animal stands "behind the counter".
  const feetY = counterTop + displayHeight * 0.15;
  const plateY = counterTop + PLATE_SURFACE_ROW * scaleY;

  const hitTop = counterTop - PLATE_HIT_OVERHANG;
  const hitHalf = (spacing - HIT_GAP) / 2;
  const hits: Rect[] = xs.map((x) => ({ left: x - hitHalf, top: hitTop, right: x + hitHalf, bottom: height }));
  const animalTop = feetY - displayHeight;
  const animalHalf = (displayHeight * 0.75) / 2;
  return {
    width,
    height,
    landscape,
    counter: { left: 0, top: counterTop, width, height: counterHeight, stripHeight: 22 * scaleY, scaleY },
    animal: {
      x: width / 2,
      feetY,
      displayHeight,
      enterFromX: -displayHeight * 0.6,
      exitToX: width + displayHeight * 0.6,
      hitTop: animalTop,
      hit: { left: width / 2 - animalHalf, top: animalTop, right: width / 2 + animalHalf, bottom: hitTop },
    },
    plates: { xs, y: plateY, spacing, hits },
  };
}

export function rectsIntersect(a: Rect, b: Rect): boolean {
  return a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
}

/** Columns a plate needs for `count` foods: three pieces sit in a 2-back / 1-front triangle. */
function columnsFor(count: number): number {
  return count === 3 ? 2 : Math.max(1, count);
}

/** Food icon size so `count` icons (plus plate rim) fit inside one plate slot. */
export function iconSizeFor(spacing: number, count: number): number {
  const c = Math.max(1, count);
  const slot = spacing - 12;
  if (c === 1) return Math.max(40, Math.min(MAX_ICON_SIZE, Math.floor(slot / 1.7)));
  const cols = columnsFor(c);
  const available = slot - 40 - (cols - 1) * ICON_GAP;
  return Math.max(40, Math.min(MAX_ICON_SIZE, Math.floor(available / cols)));
}

/** Total plate width for `count` icons of `iconSize`. */
export function plateWidthFor(iconSize: number, count: number): number {
  const cols = columnsFor(count);
  const foods = cols * iconSize + (cols - 1) * ICON_GAP;
  return Math.max(iconSize * 1.7, foods + 40);
}

/** Food centres relative to the plate centre (x, y), back-to-front draw order. */
export function foodOffsets(iconSize: number, count: number): Array<{ x: number; y: number }> {
  const lift = -iconSize * 0.3;
  if (count === 3) {
    const dx = (iconSize + ICON_GAP) / 2;
    return [
      { x: -dx, y: lift - iconSize * 0.12 },
      { x: dx, y: lift - iconSize * 0.12 },
      { x: 0, y: lift + iconSize * 0.16 },
    ];
  }
  const total = count * iconSize + (count - 1) * ICON_GAP;
  return Array.from({ length: count }, (_, i) => ({ x: -total / 2 + iconSize / 2 + i * (iconSize + ICON_GAP), y: lift }));
}

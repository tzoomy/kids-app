// Pure layout for the Animal Restaurant in both supported orientations (1280x800 and
// 800x1280). No Phaser, so it is unit-testable. The counter geometry matches
// paintRestaurantKitchen in src/assets/vectorArt.ts so the counter front we draw over
// the animal lines up with the painted one.

export interface RestaurantLayout {
  width: number;
  height: number;
  landscape: boolean;
  counter: { left: number; top: number; width: number; height: number; stripHeight: number };
  animal: { x: number; feetY: number; displayHeight: number; enterFromX: number; exitToX: number; hitTop: number };
  plates: { xs: number[]; y: number; spacing: number };
}

export const COUNTER_TOP_RATIO = 0.58;
export const COUNTER_HEIGHT_RATIO = 0.16;
export const PLATE_Y_RATIO = 0.64;
export const MAX_ICON_SIZE = 108;
export const ICON_GAP = 12;

export function computeRestaurantLayout(width: number, height: number, choiceCount: number): RestaurantLayout {
  const landscape = width >= height;
  const counterTop = height * COUNTER_TOP_RATIO;
  const n = Math.max(1, choiceCount);
  const spacing = Math.min(260, (width - 80) / n);
  const startX = width / 2 - ((n - 1) * spacing) / 2;
  const xs = Array.from({ length: n }, (_, i) => startX + i * spacing);
  const displayHeight = landscape ? Math.min(340, height * 0.43) : Math.min(430, height * 0.34);
  // Feet hidden behind the counter front so the animal stands "behind the counter".
  const feetY = counterTop + displayHeight * 0.15;
  return {
    width,
    height,
    landscape,
    counter: { left: width * 0.08, top: counterTop, width: width * 0.84, height: height * COUNTER_HEIGHT_RATIO, stripHeight: 22 },
    animal: {
      x: width / 2,
      feetY,
      displayHeight,
      enterFromX: -displayHeight * 0.6,
      exitToX: width + displayHeight * 0.6,
      hitTop: feetY - displayHeight,
    },
    plates: { xs, y: height * PLATE_Y_RATIO, spacing },
  };
}

/** Food icon size so `count` icons (plus plate rim) fit inside one plate slot. */
export function iconSizeFor(spacing: number, count: number): number {
  const c = Math.max(1, count);
  const available = spacing - 50 - (c - 1) * ICON_GAP;
  return Math.max(40, Math.min(MAX_ICON_SIZE, Math.floor(available / c)));
}

/** Total plate width for `count` icons of `iconSize`. */
export function plateWidthFor(iconSize: number, count: number): number {
  const c = Math.max(1, count);
  const foods = c * iconSize + (c - 1) * ICON_GAP;
  return Math.max(iconSize * 1.5, foods + 36);
}

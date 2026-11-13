// Pure layout for Sorting Beds in both supported orientations (1280x800 and 800x1280). No Phaser, so it is
// unit-testable. Beds sit in one row (two rows of two for 4 beds in portrait); each bed column holds the planting
// zone (with the rule sign standing behind the bed's back-left corner) above the bed itself. The basket with the current flower sits centred
// below every bed. All values are game px; the game is FIT-scaled, so at the two supported sizes 1 game px = 1 CSS px.

export interface LayoutRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface BedSlotLayout {
  /** Bed centre (garden-bed-back/front art, 520x260 source). */
  x: number;
  y: number;
  width: number;
  height: number;
  /** Stem base line for planted flowers (inside the soil, hidden by the front rim). */
  soilY: number;
  /** Planting x positions (absolute), left to right. */
  slotXs: number[];
  /** Rule sign: post + plaque share a 280x360 source box; this is its display box (centre + size), behind the bed's back-left corner. */
  sign: { x: number; y: number; width: number; height: number };
  /** Display height of a large planted flower (small flowers are SMALL_FLOWER_RATIO of it). */
  flowerHeight: number;
  /** Tap rectangle: the whole bed column (sign, planting zone and bed). */
  hit: LayoutRect;
}

export interface SortingLayout {
  width: number;
  height: number;
  landscape: boolean;
  beds: BedSlotLayout[];
  basket: {
    x: number;
    /** Basket art centre (520x400 source). */
    y: number;
    width: number;
    height: number;
    /** Stem base of the current flower (hidden by the basket front). */
    flowerBaseY: number;
    /** Display height of a large current flower. */
    flowerHeight: number;
    hit: LayoutRect;
  };
  /** Decorative pile of waiting flowers (not tappable): base points. */
  pile: Array<{ x: number; y: number }>;
}

/** Top band covered by the DOM HUD bar and the prompt bubble. */
export const TOP_RESERVED = 128;
export const MIN_TAP = 64;
export const BED_ASPECT = 260 / 520;
export const BASKET_ASPECT = 400 / 520;
export const SIGN_ASPECT = 360 / 280;
/** Small flowers are this fraction of a large flower's height (stem-small 200 vs stem-large 280 source px). */
export const SMALL_FLOWER_RATIO = 0.72;
/** Planted slots per bed (3 round flowers at most plus one example flower). */
export const SLOTS_PER_BED = 4;

const MARGIN = 28;

export function computeSortingLayout(width: number, height: number, bedCount: number): SortingLayout {
  const landscape = width >= height;
  const n = Math.max(1, Math.min(4, Math.floor(bedCount)));
  const cols = !landscape && n === 4 ? 2 : n;
  const rows = Math.ceil(n / cols);
  const gapX = landscape ? 28 : 24;
  const gapY = 18;

  // Basket zone at the bottom.
  const basketZone = landscape ? Math.min(250, height * 0.31) : Math.min(300, height * 0.24);
  const basketTop = height - basketZone;

  // Each bed column: planting zone (with the rule sign standing at the back-left corner) + bed.
  // Column height as a multiple of the bed width: zone 0.62, bed 0.5.
  const ZONE_K = 0.62;
  const COLUMN_K = ZONE_K + BED_ASPECT;
  const available = basketTop - TOP_RESERVED - 12;
  const rowBlock = (available - gapY * (rows - 1)) / rows;
  const maxBedW = landscape ? (n <= 2 ? 360 : 320) : 360;
  const bedW = Math.max(
    MIN_TAP,
    Math.min(maxBedW, (width - 2 * MARGIN - gapX * (cols - 1)) / cols, rowBlock / COLUMN_K),
  );
  const bedH = bedW * BED_ASPECT;
  const columnH = bedW * COLUMN_K;
  const usedH = rows * columnH + (rows - 1) * gapY;
  const firstTop = TOP_RESERVED + Math.max(0, (available - usedH) / 2);
  const rowWidth = cols * bedW + (cols - 1) * gapX;
  const left0 = (width - rowWidth) / 2;

  const beds: BedSlotLayout[] = [];
  for (let i = 0; i < n; i++) {
    const row = Math.floor(i / cols);
    const col = i % cols;
    const colLeft = left0 + col * (bedW + gapX);
    const top = firstTop + row * (columnH + gapY);
    const cx = colLeft + bedW / 2;
    const bedTop = top + bedW * ZONE_K;
    const bedCy = bedTop + bedH / 2;
    // Stem bases sit just below the front lip of the bed, so the front layer hides them.
    const soilY = bedCy + bedH * 0.04;
    const slotXs = Array.from({ length: SLOTS_PER_BED }, (_, k) => colLeft + bedW * (0.42 + (0.44 * k) / (SLOTS_PER_BED - 1)));
    // Sign (280x360 box, feet at 95% of its height) stands behind the back-left corner; the bed hides its feet.
    const signH = bedW * 0.6;
    const signW = (signH * 280) / 360;
    const feetY = bedTop + bedH * 0.22;
    const signCy = feetY - signH * 0.955 + signH / 2;
    beds.push({
      x: cx,
      y: bedCy,
      width: bedW,
      height: bedH,
      soilY,
      slotXs,
      sign: { x: colLeft + bedW * 0.2, y: signCy, width: signW, height: signH },
      flowerHeight: bedW * 0.52,
      hit: { x: colLeft, y: top, width: bedW, height: columnH },
    });
  }

  const basketW = landscape ? Math.min(210, width * 0.2) : Math.min(250, width * 0.31);
  const basketH = basketW * BASKET_ASPECT;
  const basketCy = height - 16 - basketH / 2;
  const flowerBaseY = basketCy - basketH * 0.02;
  const flowerHeight = Math.min(basketZone - basketH * 0.55, landscape ? 150 : 180);
  const hitTop = Math.max(basketTop, flowerBaseY - flowerHeight - 10);
  const hitW = Math.max(MIN_TAP, basketW);
  const basketHit: LayoutRect = {
    x: width / 2 - hitW / 2,
    y: hitTop,
    width: hitW,
    height: Math.max(MIN_TAP, basketCy + basketH / 2 - hitTop),
  };

  const pileDx = basketW * 0.85;
  const pileY = height - 26;
  const pile = [
    { x: width / 2 - pileDx, y: pileY },
    { x: width / 2 - pileDx - 44, y: pileY - 6 },
    { x: width / 2 + pileDx, y: pileY },
  ];

  return {
    width,
    height,
    landscape,
    beds,
    basket: { x: width / 2, y: basketCy, width: basketW, height: basketH, flowerBaseY, flowerHeight, hit: basketHit },
    pile,
  };
}

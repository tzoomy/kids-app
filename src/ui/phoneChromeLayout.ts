// Phone-portrait chrome reflow for the absolutely positioned DOM chrome of Sticker Board and Colouring Time
// (portrait audit 2026-11-16, H1/H2).
//
// Why: both chromes map game-unit rects through the FIT-scaled canvas and then force every button to a 64 CSS px
// minimum. On a phone in portrait the canvas scale is ~0.45-0.52, so the buttons grow to 64 px while their spacing
// shrinks to ~33 px: rows and neighbours overlap and a tap on a control's centre lands on its neighbour.
// Fix: on a phone in portrait, lay the controls out again in CSS px from the actual viewport, in the free band
// between the drawing surface (board/page) and the bottom edge: the largest square size <= 64 px that fits with an
// 8 px gap, never overlapping and never off-screen. Landscape and tablet sizes keep the scaled game layout unchanged.
// Pure: no DOM access, so it is unit-tested directly.

export interface CssRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/** Widest CSS viewport treated as a phone (same breakpoint as the phone station-trail picker). */
export const PHONE_MAX_WIDTH = 600;
/** Preferred and maximum control size (docs: tap targets are at least 64 CSS px wherever they fit). */
export const MAX_TAP = 64;
/** Floor for the search; below this the band is used as-is (never reached at 360x800 or larger). */
export const MIN_TAP = 32;
/** Minimum gap between two controls, and between the controls and the viewport edge or the drawing surface. */
export const CHROME_GAP = 8;

/** True for a phone held upright: the only case that reflows. Landscape and tablets keep the game layout. */
export function isPhonePortrait(viewportWidth: number, viewportHeight: number): boolean {
  return viewportHeight > viewportWidth && viewportWidth <= PHONE_MAX_WIDTH;
}

/** The free band under the drawing surface: edge margins and a gap to the surface, in root-relative CSS px. */
export function chromeBand(surfaceBottom: number, viewportWidth: number, viewportHeight: number): CssRect {
  const top = surfaceBottom + CHROME_GAP;
  return {
    x: CHROME_GAP,
    y: top,
    width: Math.max(0, viewportWidth - 2 * CHROME_GAP),
    height: Math.max(0, viewportHeight - CHROME_GAP - top),
  };
}

const colsFor = (width: number, size: number): number => Math.max(1, Math.floor((width + CHROME_GAP) / (size + CHROME_GAP)));
const stackHeight = (rows: number, size: number): number => (rows > 0 ? rows * size + (rows - 1) * CHROME_GAP : 0);

/** Splits `count` items into rows of at most `cols`. */
function rowLengths(count: number, cols: number): number[] {
  const rows: number[] = [];
  for (let left = count; left > 0; left -= cols) rows.push(Math.min(cols, left));
  return rows;
}

/**
 * Places rows of `size` squares inside `area`, each row centred horizontally, the block centred vertically.
 * `rtl` fills each row from the right (item 0 is the rightmost), matching the Hebrew chrome.
 */
function placeRows(area: CssRect, rows: number[], size: number, rtl: boolean): CssRect[] {
  const out: CssRect[] = [];
  const top = area.y + Math.max(0, (area.height - stackHeight(rows.length, size)) / 2);
  rows.forEach((n, r) => {
    const rowW = n * size + (n - 1) * CHROME_GAP;
    const left = area.x + (area.width - rowW) / 2;
    for (let i = 0; i < n; i++) {
      const col = rtl ? n - 1 - i : i;
      out.push({ x: left + col * (size + CHROME_GAP), y: top + r * (size + CHROME_GAP), width: size, height: size });
    }
  });
  return out;
}

export interface GroupPack {
  size: number;
  /** One array per input group, in input order. */
  groups: CssRect[][];
  /** 'grouped': every group starts on its own row; 'flow': one continuous wrap (used when it allows a larger size). */
  mode: 'grouped' | 'flow';
}

/**
 * Packs groups of square controls into `band`: the largest size <= MAX_TAP that fits. At each size it tries
 * "each group on its own rows" first, then one continuous flow (groups stay contiguous and in order).
 */
export function packGroups(band: CssRect, groupCounts: readonly number[], rtl = false): GroupPack {
  const total = groupCounts.reduce((a, b) => a + b, 0);
  const split = (flat: CssRect[]): CssRect[][] => {
    const groups: CssRect[][] = [];
    let at = 0;
    for (const n of groupCounts) {
      groups.push(flat.slice(at, at + n));
      at += n;
    }
    return groups;
  };
  for (let size = MAX_TAP; size >= MIN_TAP; size--) {
    if (size > band.width) continue;
    const cols = colsFor(band.width, size);
    const groupedRows = groupCounts.flatMap((n) => rowLengths(n, cols));
    if (stackHeight(groupedRows.length, size) <= band.height) {
      return { size, groups: split(placeRows(band, groupedRows, size, rtl)), mode: 'grouped' };
    }
    const flowRows = rowLengths(total, cols);
    if (stackHeight(flowRows.length, size) <= band.height) {
      return { size, groups: split(placeRows(band, flowRows, size, rtl)), mode: 'flow' };
    }
  }
  const cols = colsFor(band.width, MIN_TAP);
  return { size: MIN_TAP, groups: split(placeRows(band, rowLengths(total, cols), MIN_TAP, rtl)), mode: 'flow' };
}

export interface ToolsGridPack {
  size: number;
  tools: CssRect[];
  grid: CssRect[];
  /** 'row': tools on one row above the grid; 'column': tools stacked on the left, grid on the right. */
  mode: 'row' | 'column';
}

/**
 * Colouring Time: a short tool group plus a swatch grid, both RTL. At each size (largest first) it tries the tools
 * as a row above the grid (the tablet portrait arrangement), then the tools as a column beside the grid.
 */
export function packToolsAndGrid(band: CssRect, toolCount: number, gridCount: number): ToolsGridPack {
  for (let size = MAX_TAP; size >= MIN_TAP; size--) {
    if (size > band.width) continue;
    const cols = colsFor(band.width, size);
    if (toolCount <= cols) {
      const pack = packGroupsAtSize(band, [toolCount, gridCount], size);
      if (pack) return { size, tools: pack[0], grid: pack[1], mode: 'row' };
    }
    const gridArea = { x: band.x, y: band.y, width: band.width - size - CHROME_GAP, height: band.height };
    if (gridArea.width >= size && stackHeight(toolCount, size) <= band.height) {
      const gridRows = rowLengths(gridCount, colsFor(gridArea.width, size));
      const gridH = stackHeight(gridRows.length, size);
      if (gridH <= band.height) {
        const blockH = Math.max(gridH, stackHeight(toolCount, size));
        const widest = Math.max(0, ...gridRows);
        const blockW = widest > 0 ? size + CHROME_GAP + widest * size + (widest - 1) * CHROME_GAP : size;
        const left = band.x + (band.width - blockW) / 2;
        const top = band.y + (band.height - blockH) / 2;
        const tools = Array.from({ length: toolCount }, (_, i) => ({ x: left, y: top + i * (size + CHROME_GAP), width: size, height: size }));
        const grid = placeRows({ x: left + size + CHROME_GAP, y: top, width: blockW - size - CHROME_GAP, height: blockH }, gridRows, size, true);
        return { size, tools, grid, mode: 'column' };
      }
    }
  }
  const fallback = packGroups(band, [toolCount, gridCount], true);
  return { size: fallback.size, tools: fallback.groups[0], grid: fallback.groups[1], mode: 'row' };
}

function packGroupsAtSize(band: CssRect, groupCounts: readonly number[], size: number): CssRect[][] | null {
  const cols = colsFor(band.width, size);
  const rows = groupCounts.flatMap((n) => rowLengths(n, cols));
  if (stackHeight(rows.length, size) > band.height) return null;
  const flat = placeRows(band, rows, size, true);
  const out: CssRect[][] = [];
  let at = 0;
  for (const n of groupCounts) {
    out.push(flat.slice(at, at + n));
    at += n;
  }
  return out;
}

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

// ---------------------------------------------------------------------------------------------------------------
// Phone landscape (follow-up to the portrait audit): on a phone turned sideways (short side <= 600 CSS px) the
// 1280x800 canvas is FIT-scaled to ~0.45-0.52, so the game layout's tool, tray and palette columns sit ~33-48 px apart
// while each button is forced to 64 px: 8-14 controls run off the bottom edge or under the top bar. The drawing
// surface stays where the canvas draws it; the controls move into the free side regions left and right of it.

/** True for a phone turned sideways: the only landscape case that reflows. Tablets (short side > 600) are unchanged. */
export function isPhoneLandscape(viewportWidth: number, viewportHeight: number): boolean {
  return viewportWidth > viewportHeight && viewportHeight <= PHONE_MAX_WIDTH;
}

/**
 * The free regions beside the drawing surface, in RTL reading order (right side first, then left), each inset by
 * CHROME_GAP from the surface and from the viewport edges. Regions narrower than MIN_TAP are dropped.
 */
export function sideRegions(surface: CssRect, viewportWidth: number, viewportHeight: number): CssRect[] {
  const y = CHROME_GAP;
  const height = Math.max(0, viewportHeight - 2 * CHROME_GAP);
  const rightX = surface.x + surface.width + CHROME_GAP;
  const right = { x: rightX, y, width: viewportWidth - CHROME_GAP - rightX, height };
  const left = { x: CHROME_GAP, y, width: surface.x - CHROME_GAP - CHROME_GAP, height };
  return [right, left].filter((r) => r.width >= MIN_TAP && r.height >= MIN_TAP);
}

const overlapsAny = (r: CssRect, obstacles: readonly CssRect[]): boolean =>
  obstacles.some(
    (o) =>
      r.x < o.x + o.width + CHROME_GAP &&
      o.x < r.x + r.width + CHROME_GAP &&
      r.y < o.y + o.height + CHROME_GAP &&
      o.y < r.y + r.height + CHROME_GAP,
  );

/**
 * The free cells of one region at `size`: a grid with CHROME_GAP gutters, centred horizontally and top-aligned,
 * minus every cell within CHROME_GAP of an obstacle (top-bar buttons, the request bubble). Rows in order; with `rtl`
 * each row runs right to left (item 0 is the top-right cell), otherwise left to right.
 */
export function regionCells(region: CssRect, size: number, obstacles: readonly CssRect[] = [], rtl = true): CssRect[][] {
  if (size > region.width || size > region.height) return [];
  const cols = colsFor(region.width, size);
  const rows = colsFor(region.height, size);
  const blockW = cols * size + (cols - 1) * CHROME_GAP;
  const left = region.x + (region.width - blockW) / 2;
  const out: CssRect[][] = [];
  for (let r = 0; r < rows; r++) {
    const row: CssRect[] = [];
    for (let i = 0; i < cols; i++) {
      const c = rtl ? cols - 1 - i : i;
      const cell = { x: left + c * (size + CHROME_GAP), y: region.y + r * (size + CHROME_GAP), width: size, height: size };
      if (!overlapsAny(cell, obstacles)) row.push(cell);
    }
    out.push(row);
  }
  return out;
}

export interface RegionPack {
  size: number;
  /** One array per input group, in input order. */
  groups: CssRect[][];
  /**
   * 'grouped': each group starts on a new row and stays in one region; 'rows': each group starts on a new row but
   * may continue in the next region; 'flow': one continuous fill across regions (groups stay contiguous, in order).
   */
  mode: RegionMode;
}

export type RegionMode = 'grouped' | 'rows' | 'flow';
/** A more structured mode is kept when its size is at most this much smaller than the largest size any mode reaches. */
export const MODE_TOLERANCE = 4;

function packRegionsAtSize(
  regions: readonly CssRect[],
  groupCounts: readonly number[],
  size: number,
  obstacles: readonly CssRect[],
  mode: RegionMode,
  rtl: boolean,
): CssRect[][] | null {
  const grids = regions.map((r) => regionCells(r, size, obstacles, rtl));
  const out: CssRect[][] = [];
  if (mode === 'flow') {
    const flat = grids.flatMap((rows) => rows.flat());
    const total = groupCounts.reduce((a, b) => a + b, 0);
    if (flat.length < total) return null;
    let at = 0;
    for (const n of groupCounts) {
      out.push(flat.slice(at, at + n));
      at += n;
    }
    return out;
  }
  let region = 0;
  let row = 0;
  for (const n of groupCounts) {
    const placed: CssRect[] = [];
    while (placed.length < n && region < grids.length) {
      const free = grids[region].slice(row).flat();
      if (free.length === 0 || (mode === 'grouped' && free.length < n)) {
        // Region full, or (grouped) the whole group moves to the next region.
        region++;
        row = 0;
        continue;
      }
      const take = free.slice(0, n - placed.length);
      placed.push(...take);
      // The next group (or the rest of this one) starts on the row after the last one used.
      const last = take[take.length - 1];
      row = grids[region].findIndex((cellsInRow) => cellsInRow.includes(last)) + 1;
    }
    if (placed.length < n) return null;
    out.push(placed);
  }
  return out;
}

/**
 * Packs groups of square controls into the side regions: the largest size <= MAX_TAP (down to MIN_TAP) at which they
 * fit, never within CHROME_GAP of each other, an obstacle, the surface or the viewport edge. Three arrangements, most
 * structured first: 'grouped' (whole groups, each on new rows), 'rows' (each group starts a new row, may continue in
 * the next region) and 'flow' (one continuous fill). The most structured one within MODE_TOLERANCE px of the largest
 * size wins.
 */
export function packRegions(
  regions: readonly CssRect[],
  groupCounts: readonly number[],
  obstacles: readonly CssRect[] = [],
  rtl = true,
): RegionPack {
  const best = (mode: RegionMode): RegionPack | null => {
    for (let size = MAX_TAP; size >= MIN_TAP; size--) {
      const groups = packRegionsAtSize(regions, groupCounts, size, obstacles, mode, rtl);
      if (groups) return { size, groups, mode };
    }
    return null;
  };
  const packs = (['grouped', 'rows', 'flow'] as const).map(best).filter((p): p is RegionPack => p !== null);
  if (packs.length > 0) {
    const largest = Math.max(...packs.map((p) => p.size));
    // Most structured first: keep groups whole and on their own rows unless that costs more than MODE_TOLERANCE px.
    return packs.find((p) => p.size >= largest - MODE_TOLERANCE) ?? packs[packs.length - 1];
  }
  // Not reached at any phone size (800x360 needs ~50 px): keep the smallest grid, even if some controls stay unplaced.
  const groups = packRegionsAtSize(regions, groupCounts, MIN_TAP, obstacles, 'flow', rtl) ?? groupCounts.map(() => []);
  return { size: MIN_TAP, groups, mode: 'flow' };
}

// ---------------------------------------------------------------------------------------------------------------
// Tablet portrait (e.g. 768x1024, canvas scale 0.8): the 64 px minimum grows each button from its top-left corner
// while the game spacing shrinks, so neighbouring crayons, tools and swatches overlap by ~5-6 px. Re-space only the
// rows/columns whose gap is under CHROME_GAP, around the same centre, and leave every other box untouched (at
// 800x1280 every gap is already >= 8 px, so nothing moves).

/** True for a tablet held upright (wider than the phone breakpoint). */
export function isTabletPortrait(viewportWidth: number, viewportHeight: number): boolean {
  return viewportHeight > viewportWidth && viewportWidth > PHONE_MAX_WIDTH;
}

const EPS = 1e-6;

/** Distinct values (within 0.5 px), ascending. */
function distinct(values: readonly number[]): number[] {
  const out: number[] = [];
  for (const v of [...values].sort((a, b) => a - b)) if (!out.length || v - out[out.length - 1] > 0.5) out.push(v);
  return out;
}

function respaceAxis(starts: readonly number[], size: number): Map<number, number> | null {
  const lines = distinct(starts);
  if (lines.length < 2) return null;
  let minGap = Infinity;
  for (let i = 1; i < lines.length; i++) minGap = Math.min(minGap, lines[i] - lines[i - 1] - size);
  if (minGap >= CHROME_GAP - EPS) return null;
  const pitch = size + CHROME_GAP;
  const centre = (lines[0] + lines[lines.length - 1] + size) / 2;
  const first = centre - (lines.length * size + (lines.length - 1) * CHROME_GAP) / 2;
  return new Map(lines.map((v, i) => [v, first + i * pitch]));
}

/**
 * Re-spaces a grid of equal boxes (a row, a column or rows x columns) so neighbours are at least CHROME_GAP apart,
 * around the grid's centre, then shifts a re-spaced grid back inside [minX + CHROME_GAP, maxX - CHROME_GAP] if it
 * grew past an edge. Axes whose gaps are already >= CHROME_GAP are returned unchanged (same numbers).
 */
export function respaceGrid(rects: readonly CssRect[], minX = -Infinity, maxX = Infinity): CssRect[] {
  if (rects.length < 2) return rects.map((r) => ({ ...r }));
  const w = Math.max(...rects.map((r) => r.width));
  const h = Math.max(...rects.map((r) => r.height));
  const lookup = (map: Map<number, number> | null, v: number): number => {
    if (!map) return v;
    for (const [k, nv] of map) if (Math.abs(k - v) <= 0.5) return nv;
    return v;
  };
  const xs = respaceAxis(rects.map((r) => r.x), w);
  const ys = respaceAxis(rects.map((r) => r.y), h);
  const out = rects.map((r) => ({ ...r, x: lookup(xs, r.x), y: lookup(ys, r.y) }));
  if (xs) {
    const left = Math.min(...out.map((r) => r.x));
    const right = Math.max(...out.map((r) => r.x + r.width));
    const shift = right > maxX - CHROME_GAP ? maxX - CHROME_GAP - right : left < minX + CHROME_GAP ? minX + CHROME_GAP - left : 0;
    for (const r of out) r.x += shift;
  }
  return out;
}

/**
 * Vertical stack of rows between `top` (e.g. the board bottom) and the fixed row below them (`bottom`): when two
 * neighbouring rows sit closer than CHROME_GAP, spreads them so every gap (top -> row 0 -> ... -> bottom) is equal.
 * Returns the new top of each row, or the old tops when every gap is already >= CHROME_GAP or nothing fits.
 */
export function spreadRows(rowTops: readonly number[], rowHeight: number, top: number, bottom: number): number[] {
  const gaps = rowTops.map((t, i) => (i === 0 ? t - top : t - (rowTops[i - 1] + rowHeight)));
  gaps.push(bottom - (rowTops[rowTops.length - 1] + rowHeight));
  if (Math.min(...gaps.slice(1)) >= CHROME_GAP - EPS) return [...rowTops];
  const gap = (bottom - top - rowTops.length * rowHeight) / (rowTops.length + 1);
  if (gap <= 0) return [...rowTops];
  return rowTops.map((_, i) => top + gap + i * (rowHeight + gap));
}

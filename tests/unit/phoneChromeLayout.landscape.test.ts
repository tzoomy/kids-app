// Unit tests for the landscape-phone chrome reflow and the tablet-portrait re-spacing of Sticker Board and Colouring
// Time (follow-up to the 2026-11-16 portrait audit; src/ui/phoneChromeLayout.ts).
import { describe, expect, it } from 'vitest';
import {
  CHROME_GAP,
  MAX_TAP,
  MODE_TOLERANCE,
  isPhoneLandscape,
  isPhonePortrait,
  isTabletPortrait,
  packRegions,
  regionCells,
  respaceGrid,
  sideRegions,
  spreadRows,
  type CssRect,
} from '../../src/ui/phoneChromeLayout';
import { computeStickerBoardLayout } from '../../src/games/stickers/layout';
import { computeColouringLayout } from '../../src/games/colouring/layout';

const separated = (a: CssRect, b: CssRect, gap: number): boolean =>
  a.x + a.width + gap <= b.x + 1e-6 ||
  b.x + b.width + gap <= a.x + 1e-6 ||
  a.y + a.height + gap <= b.y + 1e-6 ||
  b.y + b.height + gap <= a.y + 1e-6;

const inside = (r: CssRect, area: CssRect): boolean =>
  r.x >= area.x - 1e-6 && r.y >= area.y - 1e-6 && r.x + r.width <= area.x + area.width + 1e-6 && r.y + r.height <= area.y + area.height + 1e-6;

describe('orientation gates', () => {
  it('reflows landscape only on phones (short side <= 600); landscape tablets keep the game layout', () => {
    for (const [w, h] of [[915, 412], [800, 360], [844, 390], [960, 600]]) expect(isPhoneLandscape(w, h)).toBe(true);
    for (const [w, h] of [[1024, 768], [1280, 800], [1366, 1024], [412, 915], [360, 800], [768, 1024], [800, 1280]]) {
      expect(isPhoneLandscape(w, h)).toBe(false);
    }
  });

  it('tablet portrait is portrait wider than the phone breakpoint; it never overlaps the phone gates', () => {
    expect(isTabletPortrait(768, 1024)).toBe(true);
    expect(isTabletPortrait(800, 1280)).toBe(true);
    for (const [w, h] of [[360, 800], [412, 915], [915, 412], [1024, 768], [1280, 800]]) expect(isTabletPortrait(w, h)).toBe(false);
    for (const [w, h] of [[360, 800], [412, 915], [768, 1024], [800, 1280], [915, 412], [1024, 768]]) {
      expect([isPhonePortrait(w, h), isPhoneLandscape(w, h), isTabletPortrait(w, h)].filter(Boolean).length).toBeLessThanOrEqual(1);
    }
  });
});

describe('side regions and cells', () => {
  it('regions sit beside the surface, right side first (RTL), inset by 8 px', () => {
    const regions = sideRegions({ x: 300, y: 40, width: 400, height: 320 }, 800, 360);
    expect(regions).toEqual([
      { x: 708, y: 8, width: 84, height: 344 },
      { x: 8, y: 8, width: 284, height: 344 },
    ]);
    // A surface flush with an edge leaves no region on that side.
    expect(sideRegions({ x: 0, y: 0, width: 700, height: 360 }, 800, 360)).toHaveLength(1);
  });

  it('cells run right to left by default and left to right with rtl = false; cells near an obstacle are skipped', () => {
    const region = { x: 0, y: 0, width: 136, height: 136 };
    const rtl = regionCells(region, 64);
    expect(rtl[0].map((c) => c.x)).toEqual([72, 0]);
    expect(regionCells(region, 64, [], false)[0].map((c) => c.x)).toEqual([0, 72]);
    // An obstacle over the top-right cell (plus the 8 px gap) removes only that cell.
    const blocked = regionCells(region, 64, [{ x: 100, y: 0, width: 30, height: 30 }]);
    expect(blocked[0].map((c) => c.x)).toEqual([0]);
    expect(blocked[1]).toHaveLength(2);
  });
});

// Measured on main: the 1280x800 canvas is FIT-scaled and right-aligned in the phone viewport; the top bar has the
// help pill on the left and the back pill on the right (64 px tall, inset 1.5 vmin / max(2.5 vmin, 9 px)).
function phone(vw: number, vh: number) {
  const k = vh / 800;
  const left = vw - 1280 * k;
  const map = (r: CssRect): CssRect => ({ x: left + r.x * k, y: r.y * k, width: r.width * k, height: r.height * k });
  const inset = vh * 0.025;
  const bar = [
    { x: inset, y: vh * 0.015, width: 68, height: 64 },
    { x: vw - inset - 64, y: vh * 0.015, width: 64, height: 64 },
  ];
  return { map, bar, k, left };
}

const PHONES = [
  [915, 412],
  [844, 390],
  [800, 360],
] as const;

// Fitted control sizes (CSS px) per phone, game and age. 64 px wherever it fits.
const EXPECTED: Record<string, { size: number; mode: string }> = {
  '915x412 stickers age2': { size: 64, mode: 'grouped' },
  '915x412 stickers age5': { size: 59, mode: 'flow' },
  '844x390 stickers age2': { size: 64, mode: 'grouped' },
  '844x390 stickers age5': { size: 53, mode: 'flow' },
  '800x360 stickers age2': { size: 62, mode: 'grouped' },
  '800x360 stickers age5': { size: 50, mode: 'flow' },
  '915x412 colouring age2': { size: 64, mode: 'grouped' },
  '915x412 colouring age5': { size: 64, mode: 'grouped' },
  '844x390 colouring age2': { size: 64, mode: 'grouped' },
  '844x390 colouring age5': { size: 64, mode: 'grouped' },
  '800x360 colouring age2': { size: 64, mode: 'grouped' },
  '800x360 colouring age5': { size: 62, mode: 'grouped' },
};

describe('landscape-phone packing', () => {
  for (const [vw, vh] of PHONES) {
    for (const age of ['age2', 'age5'] as const) {
      const { map, bar } = phone(vw, vh);
      const viewport = { x: 0, y: 0, width: vw, height: vh };

      const g = computeStickerBoardLayout(1280, 800, age, age === 'age5' ? 8 : 4);
      const board = map(g.board);
      const bubble = g.requestBubble ? [{ ...map(g.requestBubble), width: 64, height: 64 }] : [];
      const stickerCounts = age === 'age5' ? [5, 3, 8, 12] : [2, 3, 4, 12];

      const c = computeColouringLayout(1280, 800, age === 'age5' ? 16 : 8);
      const page = map(c.page);
      const colouringCounts = [4, age === 'age5' ? 16 : 8];

      const cases = [
        { game: 'stickers', surface: board, counts: stickerCounts, obstacles: [...bar, ...bubble], rtl: false },
        { game: 'colouring', surface: page, counts: colouringCounts, obstacles: bar, rtl: true },
      ];
      for (const t of cases) {
        const key = `${vw}x${vh} ${t.game} ${age}`;
        it(`${key}: every control placed, >= 44 px, 8 px apart, beside the surface, clear of the top bar, on-screen`, () => {
          const pack = packRegions(sideRegions(t.surface, vw, vh), t.counts, t.obstacles, t.rtl);
          expect({ size: pack.size, mode: pack.mode }).toEqual(EXPECTED[key]);
          expect(pack.groups.map((gr) => gr.length)).toEqual(t.counts);
          const all = pack.groups.flat();
          for (const r of all) {
            expect(r.width).toBe(pack.size);
            expect(r.height).toBe(pack.size);
            expect(r.width).toBeGreaterThanOrEqual(44);
            expect(r.width).toBeLessThanOrEqual(MAX_TAP);
            expect(inside(r, { x: CHROME_GAP, y: CHROME_GAP, width: vw - 2 * CHROME_GAP, height: vh - 2 * CHROME_GAP })).toBe(true);
            expect(inside(r, viewport)).toBe(true);
            expect(separated(r, t.surface, CHROME_GAP)).toBe(true);
            for (const o of t.obstacles) expect(separated(r, o, CHROME_GAP)).toBe(true);
          }
          for (let i = 0; i < all.length; i++) {
            for (let j = i + 1; j < all.length; j++) expect(separated(all[i], all[j], CHROME_GAP)).toBe(true);
          }
        });
      }
    }
  }

  it('keeps groups whole and on their own rows unless that costs more than MODE_TOLERANCE px', () => {
    // Two regions; the first holds exactly the first group.
    const regions = [
      { x: 500, y: 0, width: 64, height: 136 },
      { x: 0, y: 0, width: 208, height: 208 },
    ];
    const pack = packRegions(regions, [2, 3, 4], []);
    expect(pack.mode).toBe('grouped');
    expect(pack.size).toBe(64);
    expect(pack.groups[0].every((r) => r.x === 500)).toBe(true);
    // Group 1 starts a new row in the second region and group 2 starts the row after it.
    expect(new Set(pack.groups[1].map((r) => r.y)).size).toBe(1);
    expect(Math.min(...pack.groups[2].map((r) => r.y))).toBeGreaterThan(pack.groups[1][0].y);
    expect(MODE_TOLERANCE).toBe(4);
  });

  it('flows groups across regions in order when whole groups would be much smaller', () => {
    const regions = [
      { x: 600, y: 0, width: 64, height: 136 },
      { x: 0, y: 0, width: 352, height: 136 },
    ];
    // 3 + 8 items in 2 + 10 cells at 64 px: only one continuous fill fits; whole groups would need much smaller cells.
    const pack = packRegions(regions, [3, 8], []);
    expect(pack.size).toBe(64);
    expect(pack.mode).toBe('flow');
    expect(pack.groups[0].slice(0, 2).every((r) => r.x === 600)).toBe(true);
    expect(pack.groups[0][2].x).toBeLessThan(600);
  });
});

describe('tablet-portrait re-spacing (768x1024)', () => {
  const k = 0.8;
  const canvasLeft = 128;
  // Game rects × 0.8 grown to 64 px from the top-left corner, as the chrome's place() does.
  const grow = (r: CssRect): CssRect => ({ x: canvasLeft + r.x * k, y: r.y * k, width: Math.max(64, r.width * k), height: Math.max(64, r.height * k) });

  it('crayons that overlapped by ~5 px end 8 px apart around the same centre', () => {
    const g = computeStickerBoardLayout(800, 1280, 'age5', 8);
    const before = g.crayons.map(grow);
    expect(before[1].x - (before[0].x + before[0].width)).toBeCloseTo(-4.8, 5);
    const after = respaceGrid(before, 0, 768);
    for (let i = 1; i < after.length; i++) expect(after[i].x - (after[i - 1].x + after[i - 1].width)).toBeCloseTo(CHROME_GAP, 6);
    const centre = (rs: CssRect[]) => (Math.min(...rs.map((r) => r.x)) + Math.max(...rs.map((r) => r.x + r.width))) / 2;
    expect(centre(after)).toBeCloseTo(centre(before), 6);
    expect(after.every((r, i) => r.y === before[i].y && r.width === 64)).toBe(true);
  });

  it('a re-spaced row that would pass the screen edge shifts back inside', () => {
    const g = computeStickerBoardLayout(800, 1280, 'age5', 8);
    const after = respaceGrid(g.backgrounds.map(grow), 0, 768);
    expect(Math.max(...after.map((r) => r.x + r.width))).toBeLessThanOrEqual(768 - CHROME_GAP + 1e-6);
    for (let i = 1; i < after.length; i++) expect(separated(after[i], after[i - 1], CHROME_GAP)).toBe(true);
  });

  it('a 2-row swatch grid is re-spaced on both axes', () => {
    const c = computeColouringLayout(800, 1280, 16);
    const after = respaceGrid(c.swatches.map(grow), 0, 768);
    for (let i = 0; i < after.length; i++) for (let j = i + 1; j < after.length; j++) expect(separated(after[i], after[j], CHROME_GAP)).toBe(true);
    for (const r of after) expect(inside(r, { x: 0, y: 0, width: 768, height: 1024 })).toBe(true);
  });

  it('leaves rows that are already >= 8 px apart untouched (800x1280: same numbers)', () => {
    const g = computeStickerBoardLayout(800, 1280, 'age5', 8);
    const c = computeColouringLayout(800, 1280, 16);
    for (const rects of [g.crayons, g.backgrounds, [g.tools.undo, g.tools.clear], c.swatches, Object.values(c.tools)]) {
      expect(respaceGrid(rects, 0, 800)).toEqual(rects);
    }
  });

  it('spreadRows evens out touching rows between the board and the tray, and leaves spaced rows alone', () => {
    // Sticker Board 768x1024: tools/backgrounds row at 736, crayons at 800, tray at 864, board bottom at 723.2.
    const tops = spreadRows([736, 800], 64, 723.2, 864);
    const gaps = [tops[0] - 723.2, tops[1] - (tops[0] + 64), 864 - (tops[1] + 64)];
    for (const gap of gaps) expect(gap).toBeCloseTo(12.8 / 3, 6);
    expect(spreadRows([100, 180], 64, 80, 260)).toEqual([100, 180]);
  });
});

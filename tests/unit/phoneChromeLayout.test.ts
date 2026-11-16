// Unit tests for the phone-portrait chrome reflow (portrait audit 2026-11-16, H1/H2; src/ui/phoneChromeLayout.ts).
import { describe, expect, it } from 'vitest';
import {
  CHROME_GAP,
  MAX_TAP,
  chromeBand,
  isPhonePortrait,
  packGroups,
  packToolsAndGrid,
  type CssRect,
} from '../../src/ui/phoneChromeLayout';

const separated = (a: CssRect, b: CssRect, gap: number): boolean =>
  a.x + a.width + gap <= b.x + 1e-6 ||
  b.x + b.width + gap <= a.x + 1e-6 ||
  a.y + a.height + gap <= b.y + 1e-6 ||
  b.y + b.height + gap <= a.y + 1e-6;

function expectValid(rects: CssRect[], band: CssRect): void {
  for (const r of rects) {
    expect(r.x).toBeGreaterThanOrEqual(band.x - 1e-6);
    expect(r.y).toBeGreaterThanOrEqual(band.y - 1e-6);
    expect(r.x + r.width).toBeLessThanOrEqual(band.x + band.width + 1e-6);
    expect(r.y + r.height).toBeLessThanOrEqual(band.y + band.height + 1e-6);
    expect(r.width).toBe(r.height);
  }
  for (let i = 0; i < rects.length; i++) {
    for (let j = i + 1; j < rects.length; j++) expect(separated(rects[i], rects[j], CHROME_GAP)).toBe(true);
  }
}

// Board / page bottoms measured on main (CSS px): the 800x1280 canvas FIT into the phone viewport.
const fitTop = (vw: number, vh: number) => (vh - (vw / 800) * 1280) / 2;
const stickerBoardBottom = (vw: number, vh: number) => fitTop(vw, vh) + 904 * (vw / 800);
const colouringPageBottom = (vw: number, vh: number) => fitTop(vw, vh) + 808 * (vw / 800);

describe('phone-portrait chrome reflow', () => {
  it('reflows only on phones held upright; landscape and tablets keep the game layout', () => {
    expect(isPhonePortrait(360, 800)).toBe(true);
    expect(isPhonePortrait(412, 915)).toBe(true);
    expect(isPhonePortrait(600, 960)).toBe(true);
    expect(isPhonePortrait(768, 1024)).toBe(false);
    expect(isPhonePortrait(800, 1280)).toBe(false);
    expect(isPhonePortrait(915, 412)).toBe(false);
    expect(isPhonePortrait(1024, 768)).toBe(false);
    expect(isPhonePortrait(1280, 800)).toBe(false);
  });

  it('the band sits under the drawing surface with an 8 px gap and 8 px viewport margins', () => {
    expect(chromeBand(500, 360, 800)).toEqual({ x: 8, y: 508, width: 344, height: 284 });
  });

  const viewports = [
    { vw: 360, vh: 800 },
    { vw: 412, vh: 915 },
  ];

  for (const { vw, vh } of viewports) {
    for (const [age, counts] of [
      ['age2', [2, 3, 4, 12]],
      ['age5', [5, 3, 8, 12]],
    ] as const) {
      it(`Sticker Board ${age} at ${vw}x${vh}: no overlap, >= 8 px gaps, inside the band, largest size <= 64`, () => {
        const band = chromeBand(stickerBoardBottom(vw, vh), vw, vh);
        const pack = packGroups(band, counts);
        const flat = pack.groups.flat();
        expect(flat).toHaveLength(counts.reduce((a, b) => a + b, 0));
        expectValid(flat, band);
        expect(pack.size).toBeLessThanOrEqual(MAX_TAP);
        expect(pack.size).toBeGreaterThanOrEqual(44);
      });
    }

    for (const [age, swatches] of [
      ['age2', 8],
      ['age5', 16],
    ] as const) {
      it(`Colouring Time ${age} at ${vw}x${vh}: no overlap, >= 8 px gaps, inside the band`, () => {
        const band = chromeBand(colouringPageBottom(vw, vh), vw, vh);
        const pack = packToolsAndGrid(band, 4, swatches);
        expect(pack.tools).toHaveLength(4);
        expect(pack.grid).toHaveLength(swatches);
        expectValid([...pack.tools, ...pack.grid], band);
        expect(pack.size).toBeGreaterThanOrEqual(60);
      });
    }
  }

  it('keeps 64 px when the band is large enough, with each group on its own rows', () => {
    const band = { x: 8, y: 0, width: 584, height: 600 };
    const pack = packGroups(band, [5, 3, 8, 12]);
    expect(pack.size).toBe(64);
    expect(pack.mode).toBe('grouped');
    expectValid(pack.groups.flat(), band);
  });

  it('measured fitted sizes (before: 64 px boxes overlapping on 33 px spacing)', () => {
    const sizes = viewports.map(({ vw, vh }) => ({
      stickersAge5: packGroups(chromeBand(stickerBoardBottom(vw, vh), vw, vh), [5, 3, 8, 12]).size,
      stickersAge2: packGroups(chromeBand(stickerBoardBottom(vw, vh), vw, vh), [2, 3, 4, 12]).size,
      colouringAge5: packToolsAndGrid(chromeBand(colouringPageBottom(vw, vh), vw, vh), 4, 16).size,
      colouringAge2: packToolsAndGrid(chromeBand(colouringPageBottom(vw, vh), vw, vh), 4, 8).size,
    }));
    expect(sizes).toEqual([
      { stickersAge5: 46, stickersAge2: 50, colouringAge5: 62, colouringAge2: 64 },
      { stickersAge5: 54, stickersAge2: 59, colouringAge5: 64, colouringAge2: 64 },
    ]);
  });

  it('Colouring Time keeps the RTL order: the first swatch and the first tool start on the right / top', () => {
    const pack = packToolsAndGrid({ x: 8, y: 0, width: 584, height: 400 }, 4, 16);
    expect(pack.mode).toBe('row');
    expect(pack.tools[0].x).toBeGreaterThan(pack.tools[3].x);
    expect(pack.grid[0].x).toBeGreaterThan(pack.grid[1].x);
  });

  it('Colouring Time at 360x800 age 5 uses a tool column beside the palette (62 px beats 50 px as a row)', () => {
    const band = chromeBand(colouringPageBottom(360, 800), 360, 800);
    const pack = packToolsAndGrid(band, 4, 16);
    expect(pack.mode).toBe('column');
    const toolRight = Math.max(...pack.tools.map((r) => r.x + r.width));
    expect(Math.min(...pack.grid.map((r) => r.x))).toBeGreaterThanOrEqual(toolRight + CHROME_GAP);
    expect(pack.tools[0].y).toBeLessThan(pack.tools[1].y);
    expect(pack.grid[0].x).toBeGreaterThan(pack.grid[1].x);
  });

  it('handles empty groups without NaN or infinite boxes', () => {
    const band = { x: 8, y: 0, width: 344, height: 300 };
    const tg = packToolsAndGrid(band, 4, 0);
    expect(tg.grid).toEqual([]);
    for (const r of tg.tools) expect(Number.isFinite(r.x + r.y + r.width + r.height)).toBe(true);
    const g = packGroups(band, [2, 0, 4]);
    expect(g.groups.map((x) => x.length)).toEqual([2, 0, 4]);
    expectValid(g.groups.flat(), band);
  });

  it('flow mode keeps every group contiguous and in order when grouping would force a smaller size', () => {
    const band = chromeBand(stickerBoardBottom(360, 800), 360, 800);
    const pack = packGroups(band, [5, 3, 8, 12]);
    expect(pack.mode).toBe('flow');
    const order = pack.groups.flat().map((r) => [Math.round(r.y), r.x] as const);
    for (let i = 1; i < order.length; i++) {
      const [y0, x0] = order[i - 1];
      const [y1, x1] = order[i];
      expect(y1 > y0 || (y1 === y0 && x1 > x0)).toBe(true);
    }
  });
});

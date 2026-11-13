// Colouring Time (leisure-colouring) art contract, docs/specs/leisure-colouring.md
// ("SVG contract (pages)" and the frozen page and region manifest). Structure only: pure Node +
// jsdom DOMParser, no Phaser, no canvas. jsdom has no path geometry, so visible thickness, gaps,
// seams, containment and self-intersection are checked in Chromium by
// tests/e2e/leisure-colouring.art.spec.ts (PR #49 review M6).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { COLOURING_ART_MANIFEST } from '../../src/assets/art/colouringManifest';
import { COLOURING_PAGES, pageRegions, type ColouringPageSpec } from '../shared/leisureColouringPages';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const PAGE_DIR = path.join(PUBLIC_DIR, 'art/colouring/pages');
const BG_DIR = path.join(PUBLIC_DIR, 'art/scenes/leisure-colouring');
const MAX_SVG_BYTES = 15 * 1024;
const PAPER = '#FFFDF9';
const OUTLINE = '#3B2A22';


// ---------- minimal SVG path flattening (M L H V C S Q T Z, absolute and relative) ----------
type Pt = [number, number];
interface Flat { subpaths: Pt[][]; closed: boolean[]; commands: string }

function flattenPath(d: string): Flat {
  const tokens = d.match(/[a-zA-Z]|-?(?:\d+\.?\d*|\.\d+)(?:e[-+]?\d+)?/g) ?? [];
  const subpaths: Pt[][] = [];
  const closed: boolean[] = [];
  let cmds = '';
  let i = 0;
  let cmd = '';
  let cur: Pt = [0, 0];
  let start: Pt = [0, 0];
  let lastCtrl: Pt | null = null;
  let lastQ: Pt | null = null;
  let sp: Pt[] | null = null;
  const num = () => {
    const t = tokens[i++];
    if (t === undefined || /[a-zA-Z]/.test(t)) throw new Error(`bad path data near token ${i}: ${d.slice(0, 60)}`);
    return Number(t);
  };
  const cubic = (p0: Pt, p1: Pt, p2: Pt, p3: Pt) => {
    for (let k = 1; k <= 16; k++) {
      const t = k / 16, u = 1 - t;
      sp!.push([u * u * u * p0[0] + 3 * u * u * t * p1[0] + 3 * u * t * t * p2[0] + t * t * t * p3[0],
        u * u * u * p0[1] + 3 * u * u * t * p1[1] + 3 * u * t * t * p2[1] + t * t * t * p3[1]]);
    }
  };
  const quad = (p0: Pt, p1: Pt, p2: Pt) => {
    for (let k = 1; k <= 12; k++) {
      const t = k / 12, u = 1 - t;
      sp!.push([u * u * p0[0] + 2 * u * t * p1[0] + t * t * p2[0], u * u * p0[1] + 2 * u * t * p1[1] + t * t * p2[1]]);
    }
  };
  while (i < tokens.length) {
    if (/[a-zA-Z]/.test(tokens[i])) { cmd = tokens[i++]; cmds += cmd; }
    else if (!cmd) throw new Error('path must start with a command');
    const rel = cmd === cmd.toLowerCase();
    const C = cmd.toUpperCase();
    const ox = rel ? cur[0] : 0, oy = rel ? cur[1] : 0;
    if (C === 'Z') {
      if (sp) { closed[closed.length - 1] = true; }
      cur = start; lastCtrl = lastQ = null; sp = null;
      continue;
    }
    if (C === 'M') {
      cur = [ox + num(), oy + num()]; start = cur;
      sp = [cur]; subpaths.push(sp); closed.push(false);
      cmd = rel ? 'l' : 'L'; lastCtrl = lastQ = null;
      continue;
    }
    if (!sp) { sp = [cur]; subpaths.push(sp); closed.push(false); }
    if (C === 'L') { cur = [ox + num(), oy + num()]; sp.push(cur); lastCtrl = lastQ = null; }
    else if (C === 'H') { cur = [ox + num(), cur[1]]; sp.push(cur); lastCtrl = lastQ = null; }
    else if (C === 'V') { cur = [cur[0], oy + num()]; sp.push(cur); lastCtrl = lastQ = null; }
    else if (C === 'C') {
      const p1: Pt = [ox + num(), oy + num()], p2: Pt = [ox + num(), oy + num()], p3: Pt = [ox + num(), oy + num()];
      cubic(cur, p1, p2, p3); lastCtrl = p2; lastQ = null; cur = p3;
    } else if (C === 'S') {
      const p1: Pt = lastCtrl ? [2 * cur[0] - lastCtrl[0], 2 * cur[1] - lastCtrl[1]] : cur;
      const p2: Pt = [ox + num(), oy + num()], p3: Pt = [ox + num(), oy + num()];
      cubic(cur, p1, p2, p3); lastCtrl = p2; lastQ = null; cur = p3;
    } else if (C === 'Q') {
      const p1: Pt = [ox + num(), oy + num()], p2: Pt = [ox + num(), oy + num()];
      quad(cur, p1, p2); lastQ = p1; lastCtrl = null; cur = p2;
    } else if (C === 'T') {
      const p1: Pt = lastQ ? [2 * cur[0] - lastQ[0], 2 * cur[1] - lastQ[1]] : cur;
      const p2: Pt = [ox + num(), oy + num()];
      quad(cur, p1, p2); lastQ = p1; lastCtrl = null; cur = p2;
    } else {
      throw new Error(`unsupported path command "${cmd}" (use M L H V C S Q T Z; draw circles with cubic curves)`);
    }
  }
  return { subpaths, closed, commands: cmds };
}

function bbox(flat: Flat) {
  let x0 = Infinity, y0 = Infinity, x1 = -Infinity, y1 = -Infinity;
  for (const s of flat.subpaths) for (const [x, y] of s) { x0 = Math.min(x0, x); y0 = Math.min(y0, y); x1 = Math.max(x1, x); y1 = Math.max(y1, y); }
  return { x0, y0, x1, y1, w: x1 - x0, h: y1 - y0 };
}

function readSvg(file: string): { text: string; doc: Document } {
  const text = fs.readFileSync(file, 'utf8');
  const doc = new DOMParser().parseFromString(text, 'image/svg+xml');
  expect(doc.getElementsByTagName('parsererror').length, `${file} parses as XML`).toBe(0);
  return { text, doc };
}

function expectCleanSvg(text: string, doc: Document, label: string) {
  for (const tag of ['text', 'image', 'script', 'style', 'filter', 'foreignObject', 'use', 'linearGradient', 'radialGradient', 'pattern', 'mask']) {
    expect(doc.getElementsByTagName(tag).length, `${label}: no <${tag}>`).toBe(0);
  }
  expect(/href\s*=|url\(|https?:|data:/i.test(text.replace('xmlns="http://www.w3.org/2000/svg"', '')), `${label}: no external refs, urls, or rasters`).toBe(false);
}

const regionIds = (p: ColouringPageSpec) => pageRegions(p).map((r) => r.id);
const PAGES = COLOURING_PAGES;

describe('leisure-colouring page art', () => {
  it('[AC-26] the page manifest has 8 pages with 6-10 coarse and 12-20 total regions', () => {
    expect(PAGES.map((p) => p.id)).toEqual(['cat', 'dog', 'rabbit', 'bear', 'panda', 'lion', 'butterfly', 'chef']);
    for (const p of PAGES) {
      expect(p.coarse.length, p.id).toBeGreaterThanOrEqual(6);
      expect(p.coarse.length, p.id).toBeLessThanOrEqual(10);
      const total = p.coarse.length + p.fine.length;
      expect(total, p.id).toBeGreaterThanOrEqual(12);
      expect(total, p.id).toBeLessThanOrEqual(20);
      for (const [, parent] of p.fine) expect(p.coarse, `${p.id} parent ${parent}`).toContain(parent);
    }
  });

  it('[AC-26] registers every page and background in the art manifest at its size', () => {
    for (const p of PAGES) {
      const e = COLOURING_ART_MANIFEST.find((m) => m.key === `colouring-page-${p.id}`);
      expect(e, p.id).toBeDefined();
      expect(e).toMatchObject({ url: `art/colouring/pages/${p.id}.svg`, width: 800, height: 800 });
    }
    expect(COLOURING_ART_MANIFEST.find((m) => m.key === 'leisure-colouring-bg-landscape'))
      .toMatchObject({ url: 'art/scenes/leisure-colouring/bg-landscape.svg', width: 1280, height: 800 });
    expect(COLOURING_ART_MANIFEST.find((m) => m.key === 'leisure-colouring-bg-portrait'))
      .toMatchObject({ url: 'art/scenes/leisure-colouring/bg-portrait.svg', width: 800, height: 1280 });
  });

  for (const page of PAGES) {
    describe(page.id, () => {
      const file = path.join(PAGE_DIR, `${page.id}.svg`);

      it('[AC-26] [AC-32] is a clean 800x800 SVG under 15 KB with fills under outlines', () => {
        expect(fs.existsSync(file), file).toBe(true);
        expect(fs.statSync(file).size).toBeLessThan(MAX_SVG_BYTES);
        const { text, doc } = readSvg(file);
        const svg = doc.documentElement;
        expect(svg.tagName).toBe('svg');
        expect(svg.getAttribute('viewBox')).toBe('0 0 800 800');
        expect(svg.getAttribute('width')).toBe('800');
        expect(svg.getAttribute('height')).toBe('800');
        expect(svg.hasAttribute('transform') || svg.querySelector('g#fills')?.hasAttribute('transform'), 'no transform above the regions').toBe(false);
        expectCleanSvg(text, doc, page.id);
        const groups = Array.from(svg.children);
        expect(groups.map((g) => `${g.tagName}#${g.getAttribute('id')}`)).toEqual(['g#fills', 'g#outlines']);
        expect(groups[0].getAttribute('stroke')).toBe('none');
        const outlines = groups[1];
        expect(outlines.getAttribute('fill')).toBe('none');
        expect(outlines.getAttribute('stroke')).toBe(OUTLINE);
        expect(outlines.getAttribute('stroke-width')).toBe('6');
        expect(outlines.getAttribute('stroke-linecap')).toBe('round');
        expect(outlines.getAttribute('stroke-linejoin')).toBe('round');
        expect(outlines.children.length, 'outlines has strokes').toBeGreaterThan(0);
        for (const el of Array.from(outlines.querySelectorAll('*'))) {
          expect(el.hasAttribute('id'), `outline ${el.tagName} has no region id`).toBe(false);
          const sw = el.getAttribute('stroke-width');
          if (sw !== null) expect(Number(sw), 'detail strokes stay 3-6').toBeGreaterThanOrEqual(3);
          if (el.getAttribute('fill') && el.getAttribute('fill') !== 'none') expect(el.getAttribute('fill'), 'only dark detail dots are filled').toBe(OUTLINE);
        }
      });

      it('[AC-26] [AC-32] has exactly the manifest regions, in z-order, closed, and flagged', () => {
        const { doc } = readSvg(file);
        const fills = doc.getElementById('fills')!;
        const kids = Array.from(fills.children);
        for (const k of kids) expect(k.tagName, 'only <path> regions in fills').toBe('path');
        const ids = kids.map((k) => k.getAttribute('id'));
        expect(new Set(ids).size, 'unique ids').toBe(ids.length);
        expect(ids, 'exactly the manifest regions, in manifest (z-) order').toEqual(regionIds(page));
        const fineParent = new Map(page.fine.map(([f, par]) => [`${page.id}-${f}`, `${page.id}-${par}`]));
        for (const k of kids) {
          const id = k.getAttribute('id')!;
          expect(k.getAttribute('fill'), `${id} paper fill`).toBe(PAPER);
          expect(k.hasAttribute('transform'), `${id} no transform`).toBe(false);
          expect(k.getAttribute('fill-rule') ?? 'nonzero', `${id} fill-rule nonzero (no holes)`).toBe('nonzero');
          const d = k.getAttribute('d') ?? '';
          expect((d.match(/[Zz]/g) ?? []).length, `${id}: as many Z as M`).toBe((d.match(/[Mm]/g) ?? []).length);
          const parent = fineParent.get(id);
          const flat = flattenPath(k.getAttribute('d') ?? '');
          expect(flat.subpaths.length, `${id} has geometry`).toBeGreaterThan(0);
          expect(flat.closed.every(Boolean), `${id}: every subpath ends with Z`).toBe(true);
          const b = bbox(flat);
          expect(b.x0 >= 0 && b.y0 >= 0 && b.x1 <= 800 && b.y1 <= 800, `${id} inside the page`).toBe(true);
          if (parent) {
            expect(k.getAttribute('data-age2'), id).toBe('false');
            expect(k.getAttribute('data-parent'), id).toBe(parent);
            expect(ids.indexOf(parent), `${id} after its parent`).toBeLessThan(ids.indexOf(id));
          } else {
            expect(k.getAttribute('data-age2'), id).toBe('true');
            expect(k.hasAttribute('data-parent'), `${id} coarse has no parent`).toBe(false);
          }
        }
      });

    });
  }

  for (const [name, w, h] of [['bg-landscape', 1280, 800], ['bg-portrait', 800, 1280]] as const) {
    it(`[AC-26] background ${name} is a clean ${w}x${h} SVG under 15 KB`, () => {
      const file = path.join(BG_DIR, `${name}.svg`);
      expect(fs.existsSync(file), file).toBe(true);
      expect(fs.statSync(file).size).toBeLessThan(MAX_SVG_BYTES);
      const { text, doc } = readSvg(file);
      expect(doc.documentElement.getAttribute('viewBox')).toBe(`0 0 ${w} ${h}`);
      expectCleanSvg(text, doc, name);
    });
  }
});

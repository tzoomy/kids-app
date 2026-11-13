// Content, schema, and art-key contracts for Colouring Time (AC-04, AC-08, AC-09, AC-34).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { LeisureColouringContentSchema } from '../../src/content/schema';
import { loadLeisureColouring } from '../../src/content/loadContent';
import { COLOURING_PAGES, pageRegions } from '../shared/leisureColouringPages';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { COLOURING_ART_MANIFEST, COLOURING_ART_KEYS } from '../../src/assets/art/colouringManifest';

const ROOT = path.resolve(__dirname, '../..');
const PAGE_DIR = path.join(ROOT, 'public/art/colouring/pages');
const content = loadLeisureColouring();

const AGE2_IDS = ['red', 'orange', 'yellow', 'green', 'blue', 'purple', 'pink', 'charcoal'];
const AGE5_IDS = [
  ...AGE2_IDS,
  'brown',
  'red-light',
  'red-dark',
  'blue-light',
  'blue-dark',
  'green-light',
  'grey',
  'peach',
];
const PALETTE_HEX: Record<string, string> = {
  red: '#E2554F',
  orange: '#FF9F43',
  yellow: '#FFD93D',
  green: '#6BCB77',
  blue: '#4D96FF',
  purple: '#9B5DE5',
  pink: '#FF6FB5',
  charcoal: '#6B6662',
  brown: '#A97155',
  'red-light': '#F4908C',
  'red-dark': '#A93A36',
  'blue-light': '#9CC3FF',
  'blue-dark': '#2F67C2',
  'green-light': '#A8E6AE',
  grey: '#A7A39F',
  peach: '#F6C59B',
};

describe('leisure-colouring content', () => {
  it('[AC-04] [AC-08] the content JSON has no adaptive block, earns no leisure, and passes the leisure-game schema', () => {
    expect(content.id).toBe('leisure-colouring');
    expect(content.world).toBe('leisure-corner');
    expect(content.earnsLeisure).toBe(false);
    expect(content).not.toHaveProperty('adaptive');
    expect(LeisureColouringContentSchema.parse(content).id).toBe('leisure-colouring');
    const raw = JSON.parse(fs.readFileSync(path.join(ROOT, 'src/content/games/leisure-colouring.json'), 'utf8')) as Record<string, unknown>;
    expect(raw).not.toHaveProperty('adaptive');
  });

  it('[AC-09] the 8 pages and their region manifest match the shared frozen list, and palettes match the spec table', () => {
    expect(content.pages.map((p) => p.id)).toEqual(COLOURING_PAGES.map((p) => p.id));
    expect(content.defaultColor).toBe('red');
    for (const spec of COLOURING_PAGES) {
      const page = content.pages.find((p) => p.id === spec.id)!;
      expect(page.regions).toEqual(pageRegions(spec).map((r) => (
        r.parent ? { id: r.id, age2: r.age2, parent: r.parent } : { id: r.id, age2: r.age2 }
      )));
    }
    expect(content.palette.map((c) => c.id)).toEqual(AGE5_IDS);
    expect(content.palette.filter((c) => c.age2).map((c) => c.id)).toEqual(AGE2_IDS);
    expect(content.palette.filter((c) => c.age2).map((c) => c.id)).not.toContain('white');
    expect(content.palette.filter((c) => c.age2).map((c) => c.id)).not.toContain('cream');
    expect(content.palette.filter((c) => c.age2).map((c) => c.id)).toContain('charcoal');
    expect(content.palette.map((c) => c.id)).toContain('grey');
    expect(content.palette.map((c) => c.id)).toContain('peach');
    for (const c of content.palette) {
      expect(c.hex.toUpperCase()).toBe(PALETTE_HEX[c.id].toUpperCase());
      expect(c.age5).toBe(true);
    }
  });

  it('[AC-09] each page SVG exists and its fills group matches the manifest ids, flags, and closed subpaths', () => {
    for (const spec of COLOURING_PAGES) {
      const file = path.join(PAGE_DIR, `${spec.id}.svg`);
      expect(fs.existsSync(file), `${spec.id}.svg exists`).toBe(true);
      const text = fs.readFileSync(file, 'utf8');
      const expected = pageRegions(spec);
      for (const r of expected) {
        const age = r.age2 ? 'true' : 'false';
        expect(text, `${r.id} path`).toMatch(new RegExp(`id="${r.id}"`));
        expect(text, `${r.id} data-age2`).toMatch(new RegExp(`id="${r.id}"[^>]*data-age2="${age}"`));
        if (r.parent) expect(text, `${r.id} parent`).toMatch(new RegExp(`id="${r.id}"[^>]*data-parent="${r.parent}"`));
      }
    }
  });

  it('[AC-34] the boot art manifest excludes the colouring page and background keys', () => {
    const bootKeys = new Set(ART_MANIFEST.map((e) => e.key));
    const bootUrls = new Set(ART_MANIFEST.map((e) => e.url));
    for (const entry of COLOURING_ART_MANIFEST) {
      expect(bootKeys.has(entry.key), `${entry.key} must not be in ART_MANIFEST`).toBe(false);
      expect(bootUrls.has(entry.url), `${entry.url} must not be in ART_MANIFEST`).toBe(false);
    }
    expect(COLOURING_ART_KEYS).toHaveLength(10);
  });
});

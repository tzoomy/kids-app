// Guards the real art contract: the manifest and the animal rigs agree with each other and
// with the files under public/ (every SVG < 15 KB, see docs/ANIMATION.md).
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { ANIMAL_RIGS, CHARACTER_RIGS } from '../../src/assets/art/rigs';
import { registerAnimalRigs, registerArtManifest, resetArtRegistry, rigTextureKeys, foodArtKey, propArtKey, sceneArtKey, fxArtKey, instrumentArtKey, puppetArtKey, coloringArtKey, paletteArtKey } from '../../src/anim/artRegistry';
import { PUPPET_LAYER_ORDER, COLORING_PAGES, CRAYON_IDS, POT_IDS, MIX_RECIPES } from '../../src/assets/art/puppetColor';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
// Mirrors ANIMAL_KINDS in src/assets/vectorArt.ts (not imported: it pulls in Phaser).
const ANIMAL_KINDS = ['lion', 'rabbit', 'cat', 'bear', 'dog', 'panda'];
const MAX_SVG_BYTES = 15 * 1024;

beforeEach(() => {
  resetArtRegistry();
  registerArtManifest(ART_MANIFEST);
  registerAnimalRigs(ANIMAL_RIGS);
  registerAnimalRigs(CHARACTER_RIGS);
});

describe('real art manifest', () => {
  it('has unique keys and urls', () => {
    expect(new Set(ART_MANIFEST.map((e) => e.key)).size).toBe(ART_MANIFEST.length);
    expect(new Set(ART_MANIFEST.map((e) => e.url)).size).toBe(ART_MANIFEST.length);
  });

  it('points every entry at an existing SVG under public/ below 15 KB', () => {
    for (const e of ART_MANIFEST) {
      const file = path.join(PUBLIC_DIR, e.url);
      expect(fs.existsSync(file), `${e.url} exists`).toBe(true);
      expect(fs.statSync(file).size, `${e.url} size`).toBeLessThan(MAX_SVG_BYTES);
      expect(e.width).toBeGreaterThan(0);
      expect(e.height).toBeGreaterThan(0);
    }
  });

  it('has no SVG under public/art that the manifest does not list', () => {
    const listed = new Set(ART_MANIFEST.map((e) => e.url));
    const walk = (dir: string): string[] =>
      fs.readdirSync(dir, { withFileTypes: true }).flatMap((d) => (d.isDirectory() ? walk(path.join(dir, d.name)) : [path.join(dir, d.name)]));
    for (const f of walk(path.join(PUBLIC_DIR, 'art')).filter((f) => f.endsWith('.svg'))) {
      expect(listed.has(path.relative(PUBLIC_DIR, f).split(path.sep).join('/')), f).toBe(true);
    }
  });

  it('registers the shared props, fx and restaurant scene pieces', () => {
    expect(propArtKey('plate')).toBeDefined();
    expect(propArtKey('plate-shadow')).toBeDefined();
    for (const fx of ['star', 'sparkle', 'heart', 'crumb'] as const) expect(fxArtKey(fx)).toBeDefined();
    for (const name of ['bg-landscape', 'bg-portrait', 'counter']) expect(sceneArtKey('restaurant', name)).toBeDefined();
    expect(foodArtKey('apple')).toBeDefined();
  });

  it('registers Kitchen Orchestra chef, instruments, glow, and kitchen scenes', () => {
    for (const name of ['pot', 'pan', 'glass-low', 'glass-mid', 'glass-high']) expect(instrumentArtKey(name), name).toBeDefined();
    expect(fxArtKey('instrument-glow')).toBeDefined();
    for (const name of ['bg-landscape', 'bg-portrait']) expect(sceneArtKey('kitchen', name), `kitchen/${name}`).toBeDefined();
  });

  it('registers Puppet Says layers, the stage, and puppet-stage scenes', () => {
    for (const part of PUPPET_LAYER_ORDER) expect(puppetArtKey(part), part).toBeDefined();
    expect(puppetArtKey('eye-closed')).toBeDefined();
    expect(puppetArtKey('mouth-open')).toBeDefined();
    expect(puppetArtKey('mouth-sleep')).toBeDefined();
    expect(propArtKey('puppet-stage')).toBeDefined();
    expect(sceneArtKey('puppet-stage', 'bg-landscape')).toBeDefined();
    expect(sceneArtKey('puppet-stage', 'bg-portrait')).toBeDefined();
  });

  it('registers Color the World pages, palette, mix cards, and Art Studio scenes', () => {
    for (const page of Object.keys(COLORING_PAGES)) expect(coloringArtKey(page), page).toBeDefined();
    for (const id of CRAYON_IDS) expect(paletteArtKey(`crayon-${id}`), id).toBeDefined();
    for (const id of POT_IDS) expect(paletteArtKey(`pot-${id}`), id).toBeDefined();
    for (const mix of MIX_RECIPES) expect(paletteArtKey(`mix-${mix.id}`), mix.id).toBeDefined();
    expect(fxArtKey('splash')).toBeDefined();
    expect(fxArtKey('fill-burst')).toBeDefined();
    expect(sceneArtKey('art-studio', 'bg-landscape')).toBeDefined();
    expect(sceneArtKey('art-studio', 'bg-portrait')).toBeDefined();
  });

  it('gives every Color the World page the documented fill-region ids', () => {
    const PUBLIC_DIR = path.resolve(__dirname, '../../public');
    for (const [page, ids] of Object.entries(COLORING_PAGES)) {
      const svg = fs.readFileSync(path.join(PUBLIC_DIR, `art/coloring/${page}.svg`), 'utf8');
      expect(svg.includes('id="fills"'), page).toBe(true);
      expect(svg.includes('id="outlines"'), page).toBe(true);
      for (const id of ids) {
        expect(svg.includes(`id="${id}"`), `${page} ${id}`).toBe(true);
      }
    }
  });
});

describe('real animal rigs', () => {
  it('has a complete rig for every animal kind the restaurant can pick', () => {
    for (const kind of ANIMAL_KINDS) {
      const rig = ANIMAL_RIGS[kind];
      expect(rig, `rig for ${kind}`).toBeDefined();
      expect(rig.kind).toBe(kind);
      for (const id of ['body', 'head']) expect(rig.parts[id], `${kind}.${id}`).toBeDefined();
      expect(rigTextureKeys(rig), `${kind} textures are all in the manifest`).toBeDefined();
    }
  });

  it('matches every rig part size to its manifest entry', () => {
    for (const rig of Object.values(ANIMAL_RIGS)) {
      for (const part of Object.values(rig.parts)) {
        const entry = ART_MANIFEST.find((e) => e.url === `art/animals/${rig.kind}/${part.key}.svg`);
        expect(entry, `${rig.kind}/${part.key}`).toBeDefined();
        expect([entry?.width, entry?.height], `${rig.kind}/${part.key} size`).toEqual([part.width, part.height]);
      }
    }
  });
});

describe('chef rig', () => {
  it('is registered as a character, not a restaurant animal', () => {
    expect(ANIMAL_RIGS.chef).toBeUndefined();
    const rig = CHARACTER_RIGS.chef;
    expect(rig, 'chef rig').toBeDefined();
    expect(rig.kind).toBe('chef');
    for (const id of ['body', 'head', 'hat']) expect(rig.parts[id], `chef.${id}`).toBeDefined();
    expect(rigTextureKeys(rig), 'chef textures are all in the manifest').toBeDefined();
  });

  it('matches every chef part size to its manifest entry', () => {
    const rig = CHARACTER_RIGS.chef;
    for (const part of Object.values(rig.parts)) {
      const entry = ART_MANIFEST.find((e) => e.url === `art/characters/chef/${part.key}.svg`);
      expect(entry, `chef/${part.key}`).toBeDefined();
      expect([entry?.width, entry?.height], `chef/${part.key} size`).toEqual([part.width, part.height]);
    }
  });
});

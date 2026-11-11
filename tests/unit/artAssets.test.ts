// Guards the real art contract: the manifest and the animal rigs agree with each other and
// with the files under public/ (every SVG < 15 KB, see docs/ANIMATION.md).
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { ANIMAL_RIGS, CHARACTER_RIGS } from '../../src/assets/art/rigs';
import { registerAnimalRigs, registerArtManifest, resetArtRegistry, rigTextureKeys, foodArtKey, propArtKey, sceneArtKey, fxArtKey, instrumentArtKey, flowerArtKey, itemArtKey } from '../../src/anim/artRegistry';

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

  it('registers Sorting Beds and Travel Suitcase art', () => {
    for (const name of ['garden-bed-back', 'garden-bed-front', 'rule-sign-post', 'rule-sign-plaque', 'shelf', 'suitcase-back', 'suitcase-front']) {
      expect(propArtKey(name), name).toBeDefined();
    }
    for (const name of ['rule-icon-color-red', 'rule-icon-color-yellow', 'rule-icon-color-blue', 'rule-icon-shape-tulip', 'rule-icon-shape-daisy', 'rule-icon-shape-round', 'rule-icon-size-small', 'rule-icon-size-large']) {
      expect(propArtKey(name), name).toBeDefined();
    }
    expect(flowerArtKey('stem-small')).toBeDefined();
    expect(flowerArtKey('stem-large')).toBeDefined();
    for (const shape of ['tulip', 'daisy', 'round']) {
      for (const color of ['red', 'yellow', 'blue']) {
        expect(flowerArtKey(`bloom-${shape}-${color}`), `bloom-${shape}-${color}`).toBeDefined();
      }
    }
    for (const name of ['bg-landscape', 'bg-portrait']) {
      expect(sceneArtKey('number-garden', name), `number-garden/${name}`).toBeDefined();
      expect(sceneArtKey('language-house', name), `language-house/${name}`).toBeDefined();
    }
    for (const name of ['hat', 'hat-yellow', 'hat-blue', 'shoes', 'shoes-red', 'shoes-yellow', 'sunglasses', 'ball', 'ball-red', 'ball-blue', 'book', 'coat', 'coat-red', 'coat-blue', 'shirt', 'shirt-yellow', 'shirt-blue', 'socks', 'bottle', 'toothbrush', 'teddy', 'umbrella']) {
      expect(itemArtKey(name), name).toBeDefined();
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

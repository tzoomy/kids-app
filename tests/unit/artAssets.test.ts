// Guards the real art contract: the manifest and the animal rigs agree with each other and
// with the files under public/ (every SVG < 15 KB, see docs/ANIMATION.md).
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { ANIMAL_RIGS, CHARACTER_RIGS } from '../../src/assets/art/rigs';
import { registerAnimalRigs, registerArtManifest, resetArtRegistry, rigTextureKeys, foodArtKey, propArtKey, sceneArtKey, fxArtKey, instrumentArtKey } from '../../src/anim/artRegistry';

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

  it('registers Who\'s Hiding? and Kitchen Orchestra art', () => {
    for (const name of ['bush-round-back', 'bush-round-front', 'bush-tall-back', 'bush-tall-front']) {
      expect(propArtKey(name), name).toBeDefined();
    }
    for (const name of ['bg-landscape', 'bg-portrait']) {
      expect(sceneArtKey('nature-lab', name), `nature-lab/${name}`).toBeDefined();
      expect(sceneArtKey('kitchen', name), `kitchen/${name}`).toBeDefined();
    }
    for (const name of ['pot', 'pan', 'glass-low', 'glass-mid', 'glass-high']) {
      expect(instrumentArtKey(name), name).toBeDefined();
    }
    expect(fxArtKey('instrument-glow')).toBeDefined();
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

  it('keeps every animal ear above the Who\'s Hiding? L5 reveal line (0.3), still overlapping the head', () => {
    // L5 hides the animal so only the top 30% of its rig shows (feet at y=0, so the line is at
    // -(1 - 0.3) * height). The ears are the only clue left there, so each ear's top must clear
    // the line by a readable margin, and its bottom must still tuck under the head when fully shown.
    const L5_REVEAL = 0.3;
    const MIN_EAR_ABOVE_LINE = 24;
    for (const kind of ANIMAL_KINDS) {
      const rig = ANIMAL_RIGS[kind];
      const line = -(1 - L5_REVEAL) * rig.height;
      const head = rig.parts.head;
      const headTop = head.y - head.originY * head.height;
      for (const id of ['earL', 'earR']) {
        const ear = rig.parts[id];
        expect(ear, `${kind}.${id}`).toBeDefined();
        const earTop = ear.y - ear.originY * ear.height;
        const earBottom = earTop + ear.height;
        expect(line - earTop, `${kind}.${id} top clears the L5 line`).toBeGreaterThanOrEqual(MIN_EAR_ABOVE_LINE);
        expect(earBottom, `${kind}.${id} reaches below the head top`).toBeGreaterThan(headTop);
      }
    }
  });
});

describe('chef rig', () => {
  it('is complete, registered, and kept out of the restaurant animal list', () => {
    expect(ANIMAL_RIGS.chef).toBeUndefined();
    const rig = CHARACTER_RIGS.chef;
    expect(rig, 'chef rig').toBeDefined();
    expect(rig.kind).toBe('chef');
    for (const id of ['body', 'head', 'hat', 'eyeL', 'eyeR', 'mouth']) {
      expect(rig.parts[id], `chef.${id}`).toBeDefined();
    }
    expect(rigTextureKeys(rig), 'chef textures are all in the manifest').toBeDefined();
  });

  it('matches every chef part size to its manifest entry', () => {
    const rig = CHARACTER_RIGS.chef;
    for (const part of Object.values(rig.parts)) {
      const entry = ART_MANIFEST.find((e) => e.url === `art/characters/${rig.kind}/${part.key}.svg`);
      expect(entry, `chef/${part.key}`).toBeDefined();
      expect([entry?.width, entry?.height], `chef/${part.key} size`).toEqual([part.width, part.height]);
    }
  });
});

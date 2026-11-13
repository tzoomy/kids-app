// Guards the real art contract: the manifest and the animal rigs agree with each other and
// with the files under public/ (every SVG < 15 KB, see docs/ANIMATION.md).
import { describe, it, expect, beforeEach } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { COLOURING_ART_MANIFEST } from '../../src/assets/art/colouringManifest';
import { STICKER_BOARD_ART_MANIFEST } from '@/assets/art/stickerBoardManifest';
import { ANIMAL_RIGS, ANIMAL_ART_KINDS, CHARACTER_RIGS, HABITAT_ANIMAL_RIGS, HABITAT_ANIMAL_KINDS } from '../../src/assets/art/rigs';
import { registerAnimalRigs, registerArtManifest, resetArtRegistry, getArtManifest, rigTextureKeys, foodArtKey, propArtKey, sceneArtKey, fxArtKey, instrumentArtKey, flowerArtKey, itemArtKey, homeArtKey, trainArtKey, puppetArtKey, coloringArtKey, paletteArtKey } from '../../src/anim/artRegistry';
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
  registerAnimalRigs(HABITAT_ANIMAL_RIGS);
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
    // Colouring Time art is lazy-loaded (never in the boot ART_MANIFEST, AC-34).
    const lazyColouring = COLOURING_ART_MANIFEST.map((e) => e.url);
    // Sticker Board art is lazy-loaded when its scene opens (docs/specs/sticker-board.md).
    const lazyStickers = STICKER_BOARD_ART_MANIFEST.map((e) => e.url);
    const listed = new Set([...ART_MANIFEST.map((e) => e.url), ...lazyColouring, ...lazyStickers]);
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
      expect(sceneArtKey('hiding', name), `hiding/${name}`).toBeDefined();
      expect(sceneArtKey('kitchen', name), `kitchen/${name}`).toBeDefined();
    }
    for (const name of ['pot', 'pan', 'glass-low', 'glass-mid', 'glass-high']) {
      expect(instrumentArtKey(name), name).toBeDefined();
    }
    expect(fxArtKey('instrument-glow')).toBeDefined();
  });

  it('registers Language House game-picker assets and ensures picker-close is at least 64x64', () => {
    const registered = getArtManifest();
    for (const key of [
      'picker-card-animal-restaurant',
      'picker-card-kitchen-orchestra',
      'picker-close',
      'picker-bg',
    ]) {
      expect(ART_MANIFEST.find((e) => e.key === key), `${key} in ART_MANIFEST`).toBeDefined();
      expect(registered.find((e) => e.key === key), `${key} registered`).toBeDefined();
    }
    const closeEntry = ART_MANIFEST.find((e) => e.key === 'picker-close');
    expect(closeEntry?.width).toBeGreaterThanOrEqual(64);
    expect(closeEntry?.height).toBeGreaterThanOrEqual(64);
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

  it('registers all eight food colour variants and resolves foodArtKey with optional colour', () => {
    const expectedVariants: Array<[string, string, string]> = [
      ['apple', 'red', 'food-apple-red'],
      ['apple', 'green', 'food-apple-green'],
      ['banana', 'yellow', 'food-banana-yellow'],
      ['banana', 'green', 'food-banana-green'],
      ['grapes', 'purple', 'food-grapes-purple'],
      ['grapes', 'green', 'food-grapes-green'],
      ['pear', 'green', 'food-pear-green'],
      ['pear', 'yellow', 'food-pear-yellow'],
    ];
    const manifestKeys = new Set(ART_MANIFEST.map((e) => e.key));
    for (const [foodId, color, expectedKey] of expectedVariants) {
      expect(manifestKeys.has(expectedKey), `${expectedKey} in manifest`).toBe(true);
      expect(foodArtKey(foodId, color)).toBe(expectedKey);
    }
    expect(foodArtKey('apple')).toBe('food-apple');
    expect(foodArtKey('banana')).toBe('food-banana');
    expect(foodArtKey('grapes')).toBe('food-grapes');
    expect(foodArtKey('pear')).toBe('food-pear');
  });

  it('registers Sorting Beds flower-basket and layered back/front props with matching dimensions', () => {
    const keys = ['flower-basket', 'flower-basket-back', 'flower-basket-front'] as const;
    const entries = keys.map((key) => {
      const entry = ART_MANIFEST.find((e) => e.key === key);
      expect(entry, key).toBeDefined();
      return entry!;
    });
    expect([entries[1].width, entries[1].height]).toEqual([entries[0].width, entries[0].height]);
    expect([entries[2].width, entries[2].height]).toEqual([entries[0].width, entries[0].height]);
    expect(propArtKey('flower-basket')).toBe('flower-basket');
    expect(propArtKey('flower-basket-back')).toBe('flower-basket-back');
    expect(propArtKey('flower-basket-front')).toBe('flower-basket-front');
  });

  it('registers Who Lives Here? and Picnic Train art', () => {
    for (const name of ['nest-back', 'nest-front', 'burrow-back', 'burrow-front', 'pond-back', 'pond-front', 'hive-back', 'hive-front', 'kennel-back', 'kennel-front', 'tree-hollow-back', 'tree-hollow-front']) {
      expect(homeArtKey(name), name).toBeDefined();
    }
    for (const name of ['clue-card-back', 'clue-card-frame', 'clue-icon-feather', 'clue-icon-paw', 'clue-icon-water', 'clue-icon-honeycomb', 'clue-icon-bone', 'clue-icon-leaf', 'picnic-basket']) {
      expect(propArtKey(name), name).toBeDefined();
    }
    for (const name of ['engine', 'car', 'car-single', 'seat-outline', 'item-outline']) {
      expect(trainArtKey(name), name).toBeDefined();
    }
    for (const name of ['bg-landscape', 'bg-portrait']) {
      expect(sceneArtKey('habitats', name), `habitats/${name}`).toBeDefined();
      expect(sceneArtKey('picnic-train', name), `picnic-train/${name}`).toBeDefined();
    }
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

describe('habitat animal rigs', () => {
  it('is complete, registered, and kept out of the restaurant animal list', () => {
    for (const kind of HABITAT_ANIMAL_KINDS) {
      expect(ANIMAL_ART_KINDS.includes(kind), `${kind} must not be a restaurant kind`).toBe(false);
      const rig = HABITAT_ANIMAL_RIGS[kind];
      expect(rig, `rig for ${kind}`).toBeDefined();
      expect(rig.kind).toBe(kind);
      for (const id of ['body', 'head']) expect(rig.parts[id], `${kind}.${id}`).toBeDefined();
      expect(rigTextureKeys(rig), `${kind} textures are all in the manifest`).toBeDefined();
    }
  });

  it('matches every habitat rig part size to its manifest entry', () => {
    for (const rig of Object.values(HABITAT_ANIMAL_RIGS)) {
      for (const part of Object.values(rig.parts)) {
        const entry = ART_MANIFEST.find((e) => e.url === `art/animals/${rig.kind}/${part.key}.svg`);
        expect(entry, `${rig.kind}/${part.key}`).toBeDefined();
        expect([entry?.width, entry?.height], `${rig.kind}/${part.key} size`).toEqual([part.width, part.height]);
      }
    }
  });
});

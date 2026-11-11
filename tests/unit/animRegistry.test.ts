import { describe, it, expect, beforeEach } from 'vitest';
import {
  animalPartKey,
  foodArtKey,
  fxArtKey,
  getAnimalRig,
  getArtManifest,
  keyForUrl,
  propArtKey,
  registerAnimalRigs,
  registerArtManifest,
  resetArtRegistry,
  rigTextureKeys,
  sceneArtKey,
} from '../../src/anim/artRegistry';
import { fallbackAnchors, fallbackRigFor, planCharacterArt, FALLBACK_SIZE } from '../../src/anim/fallbackRig';
import { assetUrl } from '../../src/anim/assetLoader';
import type { AnimalRig } from '../../src/anim/rigTypes';

function part(key: string, extra: Partial<AnimalRig['parts'][string]> = {}) {
  return { key, x: 0, y: -100, originX: 0.5, originY: 0.5, width: 50, height: 50, depth: 1, ...extra };
}

const BEAR: AnimalRig = {
  kind: 'bear',
  height: 480,
  parts: {
    body: part('body'),
    head: part('head', { y: -300, depth: 2 }),
    earL: part('ear-left', { parent: 'head' }),
    earR: part('ear-right', { parent: 'head' }),
    eyeL: part('eye-open', { parent: 'head', depth: 3 }),
    eyeR: part('eye-open', { parent: 'head', depth: 3, flipX: true }),
    mouth: part('mouth-smile', { parent: 'head', depth: 3 }),
  },
  eyeClosedKey: 'eye-closed',
  mouthKeys: { smile: 'mouth-smile', open: 'mouth-open', hmm: 'mouth-hmm' },
};

const BEAR_FILES = ['body', 'head', 'ear-left', 'ear-right', 'eye-open', 'eye-closed', 'mouth-smile', 'mouth-open', 'mouth-hmm'];

function bearManifest() {
  return BEAR_FILES.map((f) => ({ key: `animal.bear.${f}`, url: `art/animals/bear/${f}.svg`, width: 50, height: 50 }));
}

beforeEach(() => resetArtRegistry());

describe('art registry fallbacks', () => {
  it('returns nothing when no art is registered', () => {
    expect(getAnimalRig('bear')).toBeUndefined();
    expect(foodArtKey('apple')).toBeUndefined();
    expect(propArtKey('plate')).toBeUndefined();
    expect(fxArtKey('star')).toBeUndefined();
    expect(sceneArtKey('restaurant', 'bg-landscape')).toBeUndefined();
    expect(getArtManifest()).toHaveLength(0);
  });

  it('resolves keys by path, whatever key naming the manifest uses', () => {
    registerArtManifest([
      { key: 'foodApple', url: './art/foods/apple.svg', width: 256, height: 256 },
      { key: 'plate', url: '/art/props/plate.svg', width: 320, height: 140 },
      { key: 'fx-star', url: 'art/fx/star.svg', width: 64, height: 64 },
    ]);
    expect(foodArtKey('apple')).toBe('foodApple');
    expect(propArtKey('plate')).toBe('plate');
    expect(fxArtKey('star')).toBe('fx-star');
    expect(keyForUrl('art/foods/banana.svg')).toBeUndefined();
  });

  it('re-registering a key replaces the entry instead of duplicating it', () => {
    registerArtManifest([{ key: 'a', url: 'art/fx/star.svg', width: 64, height: 64 }]);
    registerArtManifest([{ key: 'a', url: 'art/fx/star.svg', width: 128, height: 128 }]);
    expect(getArtManifest()).toHaveLength(1);
    expect(getArtManifest()[0].width).toBe(128);
  });

  it('namespaces animal part keys by kind', () => {
    registerArtManifest(bearManifest());
    expect(animalPartKey('bear', 'ear-left')).toBe('animal.bear.ear-left');
    expect(animalPartKey('cat', 'ear-left')).toBeUndefined();
  });

  it('rigTextureKeys needs every part plus eye-closed and mouth variants', () => {
    registerArtManifest(bearManifest().filter((e) => !e.url.endsWith('mouth-hmm.svg')));
    expect(rigTextureKeys(BEAR)).toBeUndefined();
    registerArtManifest(bearManifest());
    expect(Object.keys(rigTextureKeys(BEAR)!).sort()).toEqual([...BEAR_FILES].sort());
  });
});

describe('planCharacterArt', () => {
  it('uses the single-image fallback when no rig is registered', () => {
    const plan = planCharacterArt('cat', () => true);
    expect(plan.fallback).toBe(true);
    expect(Object.keys(plan.rig.parts)).toEqual(['body']);
    expect(plan.textures[plan.rig.parts.body.key]).toBe(`animal-cat-${FALLBACK_SIZE}`);
  });

  it('uses the layered rig only when all textures are registered and loaded', () => {
    registerAnimalRigs({ bear: BEAR });
    registerArtManifest(bearManifest());
    expect(planCharacterArt('bear', (k) => k !== 'animal.bear.eye-closed').fallback).toBe(true);
    const plan = planCharacterArt('bear', () => true);
    expect(plan.fallback).toBe(false);
    expect(plan.rig).toBe(BEAR);
    expect(plan.textures['ear-left']).toBe('animal.bear.ear-left');
  });

  it('falls back when a rig is registered but its manifest is missing', () => {
    registerAnimalRigs({ bear: BEAR });
    expect(planCharacterArt('bear', () => true).fallback).toBe(true);
  });
});

describe('fallback rig geometry', () => {
  it('pivots the single body part at the feet', () => {
    const rig = fallbackRigFor('dog');
    const body = rig.parts.body;
    expect(body.width).toBeCloseTo(FALLBACK_SIZE * 1.8);
    expect(body.originY).toBeGreaterThan(0.5);
    expect(body.originY).toBeLessThan(1);
    const a = fallbackAnchors();
    expect(a.mouthY).toBeLessThan(0);
    expect(a.headY).toBeLessThan(a.mouthY);
    expect(-a.headY).toBeLessThan(rig.height);
  });
});

describe('assetUrl', () => {
  it('joins the Vite base and relative urls', () => {
    expect(assetUrl('/kids-app/', 'art/foods/apple.svg')).toBe('/kids-app/art/foods/apple.svg');
    expect(assetUrl('/kids-app', './art/x.svg')).toBe('/kids-app/art/x.svg');
    expect(assetUrl('/', 'art/x.svg')).toBe('/art/x.svg');
  });
});

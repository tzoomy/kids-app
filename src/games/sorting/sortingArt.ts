// Sorting Beds art: uses the frozen SVG keys from PR #20 (beds, signs, icons, flowers, backgrounds) and PR #42
// (flower basket) when their textures are loaded, and a clean procedural fallback (./sortingFallbackArt.ts) per
// key when they are not. Neither art PR is merged into this branch; keys are referenced by name only.
import Phaser from 'phaser';
import type { FlowerSpec } from './sortingLogic';
import type { SortAttribute } from './types';
import {
  drawBasketFallback,
  drawBedFallback,
  drawFlowerFallback,
  drawPlaqueFallback,
  drawPostFallback,
  drawRuleIconFallback,
} from './sortingFallbackArt';

type Obj = Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;

export const SORTING_ART_KEYS = {
  bedBack: 'garden-bed-back',
  bedFront: 'garden-bed-front',
  signPost: 'rule-sign-post',
  signPlaque: 'rule-sign-plaque',
  basketBack: 'flower-basket-back',
  basketFront: 'flower-basket-front',
  bgLandscape: 'number-garden-bg-landscape',
  bgPortrait: 'number-garden-bg-portrait',
} as const;

export const ruleIconKey = (attr: SortAttribute, value: string): string => `rule-icon-${attr}-${value}`;
export const stemKey = (size: FlowerSpec['size']): string => `flower-stem-${size}`;
export const bloomKey = (spec: Pick<FlowerSpec, 'shape' | 'color'>): string => `flower-bloom-${spec.shape}-${spec.color}`;

function has(scene: Phaser.Scene, key: string): boolean {
  return scene.textures.exists(key) && key !== '__MISSING';
}

/** Full-screen background (landscape or portrait art), or a soft procedural garden. */
export function addBackground(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.GameObject {
  const key = width >= height ? SORTING_ART_KEYS.bgLandscape : SORTING_ART_KEYS.bgPortrait;
  if (has(scene, key)) {
    return scene.add.image(width / 2, height / 2, key).setDisplaySize(width, height).setDepth(0);
  }
  const g = scene.add.graphics().setDepth(0);
  g.fillStyle(0xcdeefa, 1);
  g.fillRect(0, 0, width, height);
  g.fillStyle(0xbfe6a8, 1);
  g.fillRect(0, height * 0.18, width, height);
  g.fillStyle(0xaedb94, 1);
  g.fillEllipse(width * 0.2, height * 0.2, width * 0.7, height * 0.12);
  g.fillEllipse(width * 0.8, height * 0.21, width * 0.7, height * 0.1);
  // Garden path at the bottom, where the basket stands.
  g.fillStyle(0xead2a8, 1);
  g.fillEllipse(width / 2, height * 1.02, width * 1.3, height * (width >= height ? 0.42 : 0.36));
  g.lineStyle(4, 0xc9a777, 1);
  g.strokeEllipse(width / 2, height * 1.02, width * 1.3, height * (width >= height ? 0.42 : 0.36));
  return g;
}

/** Bed back and front layers (520x260 source), centred at (0,0). */
export function makeBed(scene: Phaser.Scene, width: number, height: number): { back: Obj; front: Obj } {
  if (has(scene, SORTING_ART_KEYS.bedBack) && has(scene, SORTING_ART_KEYS.bedFront)) {
    return {
      back: scene.add.image(0, 0, SORTING_ART_KEYS.bedBack).setDisplaySize(width, height),
      front: scene.add.image(0, 0, SORTING_ART_KEYS.bedFront).setDisplaySize(width, height),
    };
  }
  return drawBedFallback(scene, width, height);
}

/** Rule sign (post + plaque) in a 280x360 box of the given display size, centred at (0,0). */
export function makeSign(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.Container {
  const sign = scene.add.container(0, 0);
  const sx = width / 280;
  const sy = height / 360;
  if (has(scene, SORTING_ART_KEYS.signPost)) {
    sign.add(scene.add.image(0, 0, SORTING_ART_KEYS.signPost).setDisplaySize(width, height));
  } else {
    // Post from below the plaque to the feet (source rows 216..344), centred on x.
    const postH = (344 - 200) * sy;
    const post = drawPostFallback(scene, postH);
    post.setPosition(0, ((200 + 344) / 2 - 180) * sy);
    sign.add(post);
  }
  if (has(scene, SORTING_ART_KEYS.signPlaque)) {
    sign.add(scene.add.image(0, 0, SORTING_ART_KEYS.signPlaque).setDisplaySize(width, height));
  } else {
    // Plaque at source rect (36..244, 34..234).
    const plaque = drawPlaqueFallback(scene, 208 * sx, 200 * sy);
    plaque.setPosition(0, ((34 + 234) / 2 - 180) * sy);
    sign.add(plaque);
  }
  sign.setSize(width, height);
  return sign;
}

/** One rule icon (160x160 source) at the given display size, centred at (0,0). */
export function makeRuleIcon(scene: Phaser.Scene, attr: SortAttribute, value: string, size: number): Obj {
  const key = ruleIconKey(attr, value);
  if (has(scene, key)) return scene.add.image(0, 0, key).setDisplaySize(size, size);
  return drawRuleIconFallback(scene, attr, value, size);
}

/**
 * A composited flower, origin at the stem base (bottom centre); `largeHeight` is the display height of a large
 * flower, small flowers are shorter (stem-small 200 vs stem-large 280 source px).
 */
export function makeFlower(scene: Phaser.Scene, spec: FlowerSpec, largeHeight: number): Phaser.GameObjects.Container {
  const sKey = stemKey(spec.size);
  const bKey = bloomKey(spec);
  if (has(scene, sKey) && has(scene, bKey)) {
    // Source units: stem 160 wide; the stem's top is at y=80; large composite is ~290 units tall.
    const u = largeHeight / 290;
    const stemSrcH = spec.size === 'large' ? 280 : 200;
    const container = scene.add.container(0, 0);
    const stem = scene.add.image(0, 0, sKey).setOrigin(0.5, 1).setDisplaySize(160 * u, stemSrcH * u);
    const bloomSize = (spec.size === 'large' ? 150 : 124) * u;
    const stemTopY = -(stemSrcH - 80) * u;
    const bloom = scene.add.image(0, stemTopY - bloomSize * 0.22, bKey).setDisplaySize(bloomSize, bloomSize);
    container.add([stem, bloom]);
    container.setSize(bloomSize, (stemSrcH - 80) * u + bloomSize * 0.72);
    return container;
  }
  return drawFlowerFallback(scene, spec.shape, spec.color, spec.size, largeHeight / 1.45);
}

/** Basket back and front layers (520x400 source), centred at (0,0). */
export function makeBasket(scene: Phaser.Scene, width: number, height: number): { back: Obj; front: Obj } {
  const hasBack = has(scene, SORTING_ART_KEYS.basketBack);
  const hasFront = has(scene, SORTING_ART_KEYS.basketFront);
  if (hasBack && hasFront) {
    return {
      back: scene.add.image(0, 0, SORTING_ART_KEYS.basketBack).setDisplaySize(width, height),
      front: scene.add.image(0, 0, SORTING_ART_KEYS.basketFront).setDisplaySize(width, height),
    };
  }
  return drawBasketFallback(scene, width, height);
}

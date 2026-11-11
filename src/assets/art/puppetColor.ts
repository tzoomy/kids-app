/**
 * Puppet Says and Color the World art data (no game logic, no Phaser).
 *
 * The puppet parts all share a 360×480 canvas with the feet on the bottom
 * edge, so they stack in place. Hotspots are axis-aligned boxes in that
 * same canvas space (origin at the top-left of the viewBox).
 */

export const PUPPET_CANVAS = { width: 360, height: 480 } as const;

/** Draw order, back to front. Eyes/mouth swap to the closed/sleep files in the sleep pose. */
export const PUPPET_LAYER_ORDER = [
  'foot-left',
  'foot-right',
  'leg-left',
  'leg-right',
  'body',
  'arm-left',
  'arm-right',
  'tummy',
  'hand-left',
  'hand-right',
  'ear-left',
  'ear-right',
  'head',
  'eye-open',
  'nose',
  'mouth-smile',
] as const;

export type PuppetLayer = (typeof PUPPET_LAYER_ORDER)[number];

export const PUPPET_POSE_LAYERS = {
  rest: { eyes: 'eye-open', mouth: 'mouth-smile' },
  jump: { eyes: 'eye-open', mouth: 'mouth-open' },
  clap: { eyes: 'eye-open', mouth: 'mouth-open' },
  wave: { eyes: 'eye-open', mouth: 'mouth-smile' },
  sleep: { eyes: 'eye-closed', mouth: 'mouth-sleep' },
} as const;

export type PuppetPose = keyof typeof PUPPET_POSE_LAYERS;

export type PuppetHotspotId =
  | 'head'
  | 'ear-left'
  | 'ear-right'
  | 'eyes'
  | 'nose'
  | 'mouth'
  | 'tummy'
  | 'hand-left'
  | 'hand-right'
  | 'foot-left'
  | 'foot-right';

/** Tap targets in 360×480 canvas pixels. Generous for a 2-year-old finger. */
export const PUPPET_HOTSPOTS: Record<PuppetHotspotId, { x: number; y: number; width: number; height: number }> = {
  'ear-left': { x: 62, y: 52, width: 70, height: 86 },
  'ear-right': { x: 228, y: 52, width: 70, height: 86 },
  head: { x: 86, y: 44, width: 188, height: 172 },
  eyes: { x: 112, y: 104, width: 136, height: 52 },
  nose: { x: 156, y: 142, width: 48, height: 40 },
  mouth: { x: 140, y: 172, width: 80, height: 44 },
  tummy: { x: 118, y: 262, width: 124, height: 110 },
  'hand-left': { x: 10, y: 268, width: 88, height: 88 },
  'hand-right': { x: 262, y: 268, width: 88, height: 88 },
  'foot-left': { x: 78, y: 412, width: 96, height: 68 },
  'foot-right': { x: 186, y: 412, width: 96, height: 68 },
};

export const PUPPET_HOTSPOT_IDS = Object.keys(PUPPET_HOTSPOTS) as PuppetHotspotId[];

export const COLORING_PAGES = {
  apple: ['apple-body', 'apple-stem', 'apple-leaf'],
  house: ['house-wall', 'house-roof', 'house-door', 'house-window', 'house-chimney', 'house-path'],
  fish: ['fish-body', 'fish-tail', 'fish-fin', 'fish-eye'],
  flower: [
    'flower-center',
    'flower-petal-1',
    'flower-petal-2',
    'flower-petal-3',
    'flower-petal-4',
    'flower-petal-5',
    'flower-stem',
    'flower-leaf',
  ],
  car: ['car-body', 'car-cabin', 'car-window', 'car-wheel-left', 'car-wheel-right'],
  sun: ['sun-disk', 'sun-ray-1', 'sun-ray-2', 'sun-ray-3', 'sun-ray-4', 'sun-ray-5', 'sun-ray-6'],
  tree: ['tree-trunk', 'tree-foliage', 'tree-ground'],
  balloon: ['balloon-body', 'balloon-highlight', 'balloon-string', 'balloon-bow'],
} as const;

export type ColoringPageId = keyof typeof COLORING_PAGES;
export const COLORING_PAGE_IDS = Object.keys(COLORING_PAGES) as ColoringPageId[];

export const CRAYON_IDS = [
  'red',
  'red-light',
  'red-dark',
  'orange',
  'yellow',
  'green',
  'green-light',
  'blue',
  'blue-light',
  'blue-dark',
  'purple',
  'pink',
  'brown',
] as const;

export type CrayonId = (typeof CRAYON_IDS)[number];

/** Named close-shade families used on the age-5 palette. */
export const CRAYON_SHADE_FAMILIES = {
  red: ['red-light', 'red', 'red-dark'],
  blue: ['blue-light', 'blue', 'blue-dark'],
  green: ['green-light', 'green'],
} as const;

export const MIX_RECIPES = [
  { id: 'orange', left: 'red', right: 'yellow', result: 'orange' },
  { id: 'green', left: 'blue', right: 'yellow', result: 'green' },
  { id: 'purple', left: 'red', right: 'blue', result: 'purple' },
] as const;

export const POT_IDS = ['red', 'yellow', 'blue', 'orange', 'green', 'purple'] as const;

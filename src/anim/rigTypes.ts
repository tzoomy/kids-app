// Rig description types. These mirror the contract in docs/ANIMATION.md exactly, so
// `ANIMAL_RIGS` from `src/assets/art/rigs.ts` (owned by the art branch) can be passed
// straight into `registerAnimalRigs()` without adapters. No Phaser dependency.

export interface RigPart {
  /** File name without .svg, e.g. "ear-left". */
  key: string;
  /** Position of the part's pivot, relative to the character origin (feet center), reference px. */
  x: number;
  y: number;
  /** Pivot inside the part, 0..1 (e.g. ear base, tail base, head neck). */
  originX: number;
  originY: number;
  /** Rasterize size at reference scale (matches the viewBox). */
  width: number;
  height: number;
  /** Draw order, lower is further back. */
  depth: number;
  /** Head-attached parts move with the head. */
  parent?: 'body' | 'head';
  /** For the reused right eye. */
  flipX?: boolean;
}

export interface AnimalRig {
  kind: string;
  /** Reference full height (480). */
  height: number;
  /** Part ids: body, tail?, mane?, head, earL, earR, eyeL, eyeR, mouth. */
  parts: Record<string, RigPart>;
  eyeClosedKey: string;
  mouthKeys: { smile: string; open: string; hmm: string };
}

/** One SVG in the art manifest (`src/assets/art/manifest.ts`). */
export interface ArtManifestEntry {
  key: string;
  /** Relative to the Vite base URL, no leading slash, e.g. "art/foods/apple.svg". */
  url: string;
  width: number;
  height: number;
}

/** Well-known part ids used by the Character. */
export const PART_IDS = {
  body: 'body',
  tail: 'tail',
  mane: 'mane',
  head: 'head',
  earL: 'earL',
  earR: 'earR',
  eyeL: 'eyeL',
  eyeR: 'eyeR',
  mouth: 'mouth',
} as const;

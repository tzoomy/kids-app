// Frozen hook types for Sorting Beds (spec: docs/specs/sorting-beds.md, "sorting screen and hooks").
// These types are part of the test contract: tests/e2e/sorting-beds*.spec.ts and tests/unit/sorting-beds*.test.ts
// depend on them. Do not rename or reshape them without a spec change (and a changelog line).

export type SortAttribute = 'color' | 'shape' | 'size';
export type FlowerColor = 'red' | 'yellow' | 'blue';
export type FlowerShape = 'tulip' | 'daisy' | 'round';
export type FlowerSize = 'small' | 'large';

/** Rectangle in page CSS px (top-left + size), the same space as `getBuildingHit`. */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type SortRule = SortAttribute | 'size+color' | 'size+shape';

export interface SortingBedInfo {
  /** Stable within the round, e.g. 'bed-0' ... 'bed-3'. */
  id: string;
  /** L1-L3 picture, L4-L6 symbol, L7-L8 none. */
  label: 'picture' | 'symbol' | 'none';
  /** Scaffold 'outline' (L2-L3). */
  ghostSlots: boolean;
  /** The bed's attribute value(s). */
  accepts: { color?: FlowerColor; shape?: FlowerShape; size?: FlowerSize };
  /** Pre-planted example flower id (L7-L8), else null. */
  example: string | null;
  /** Flowers placed this round (examples excluded). */
  count: number;
  /** This round's flowers that belong here. */
  capacity: number;
  bloomed: boolean;
  hit: PageRect;
}

export interface SortingCurrentItem {
  /** '<shape>-<color>-<size>', e.g. 'tulip-red-small'. */
  id: string;
  color: FlowerColor;
  shape: FlowerShape;
  size: FlowerSize;
  /** The bed it belongs in under the current rule. */
  targetBedId: string;
  /** Bed taps on this flower that were not swallowed by the 400 ms lock. */
  tries: number;
  /** An idle hint fired before the trial was recorded. */
  hinted: boolean;
  /** The flower in the basket. */
  hit: PageRect;
}

export interface SortingInfo {
  /** 1..8, the level of the active round. */
  level: number;
  /** What defines the beds right now (after an L8 switch: 'size+shape'). */
  rule: SortRule;
  /** True after the L8 mid-round switch. */
  ruleSwitched: boolean;
  beds: SortingBedInfo[];
  /** null between flowers, during animations, and after the round. */
  currentItem: SortingCurrentItem | null;
  /** Learning-token language of this round (Hebrew guidance is always 'he'). */
  lang: 'en' | 'fr';
  /** The current flower is in the basket and bed taps are accepted. */
  ready: boolean;
}

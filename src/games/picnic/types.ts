// Frozen hook types for Picnic Train (spec: docs/specs/picnic-train.md, "Player journey from the map").
// These types are part of the test contract: tests/e2e/picnic-train*.spec.ts and tests/e2e/helpers/picnic.ts depend on
// them. Do not rename or reshape them without a spec change (and a changelog line).

export type PicnicTask = 'one-each' | 'load' | 'missing';

/** Rectangle in page CSS px (top-left + size), the same space as `getBuildingHit`. */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PicnicPassengerInfo {
  /** 'p-0' ... left to right. */
  id: string;
  seat: number;
  /** Animal kind. */
  kind: string;
  hasItem: boolean;
  /** Inside the screen after the camera pan. */
  visible: boolean;
  hit: PageRect;
}

export interface PicnicInfo {
  /** 1..8, the level of the active train. */
  level: number;
  task: PicnicTask;
  /** Counting-token language of this train (Hebrew guidance is always 'he'). */
  lang: 'en' | 'fr';
  /** Passengers in the train (n). */
  size: number;
  /** one-each: n; load: N to load; missing: the missing count m. */
  target: number;
  /** What input is expected now. */
  phase: 'give' | 'load' | 'answer' | 'depart';
  scaffold: 'outline' | 'symbol' | 'none';
  /** Scaffold 'outline': a ghost item above every free passenger. */
  ghostItems: boolean;
  /** Scaffold 'symbol': number of tally dots shown, else null. */
  tally: number | null;
  passengers: PicnicPassengerInfo[];
  /** First passenger without an item (a correct tap in `give`). */
  nextFreeId: string | null;
  /** Tappable in `give` (the item source) and `load`. */
  basket: { hit: PageRect } | null;
  /** load: items on the cargo shelf. */
  loaded: number;
  /** load: one tappable rectangle per loaded item. */
  cargoHits: PageRect[];
  /** load: the go flag. */
  go: { hit: PageRect } | null;
  /** missing step 1: the number cards. */
  cards: Array<{ value: number; hit: PageRect }> | null;
  /** Wrong taps on this train that were not swallowed by the 400 ms lock. */
  tries: number;
  /** An idle hint fired before the trial was recorded. */
  hinted: boolean;
  /** Input is accepted now. */
  ready: boolean;
}

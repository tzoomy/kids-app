// Pure Colouring Time tap resolution (no Phaser, no DOM).
// Spec: docs/specs/leisure-colouring.md (B1 / AC-29, AC-30). Contract: docs/contracts/leisure-colouring.md.
//
// TDD step 1: exported signatures are frozen. Bodies throw 'not implemented' so unit tests fail
// because the feature is missing, not because of a missing export. Step 2 keeps these signatures
// and implements: (1) the region under the finger (topmost if several), (2) else the nearest
// hit-testable region within 20 CSS px (converted to viewBox units), (3) else a no-op.
// Runtime contains() uses Path2D.isPointInPath in viewBox units. Unit tests inject contains().

export type ColouringAgeTrack = 'age2' | 'age5';

export interface ColouringRegionDef {
  id: string;
  age2: boolean;
  parent?: string;
}

/** Returns whether (x, y) in viewBox units lies inside the region's path. */
export type ContainsFn = (regionId: string, x: number, y: number) => boolean;

/** Distance in viewBox units from (x, y) to the region's path edge. */
export type DistanceFn = (regionId: string, x: number, y: number) => number;

export interface HitTestOptions {
  regions: ColouringRegionDef[];
  ageTrack: ColouringAgeTrack;
  contains: ContainsFn;
  /** viewBox-unit equivalent of 20 CSS px at the current page scale. */
  snapRadiusVu: number;
  /** Required for the snap-to-nearest step; unused until this module is implemented. */
  distance?: DistanceFn;
}

/**
 * Resolves a tap in viewBox units to a hit-testable region id, or null for a no-op.
 * Age 2 considers only coarse (`age2: true`) regions; age 5 considers all regions.
 */
export function hitTest(_x: number, _y: number, _opts: HitTestOptions): string | null {
  throw new Error('not implemented');
}

/** Regions the given age track may fill (coarse only at age 2; all at age 5). */
export function hitTestableRegions(
  _regions: ColouringRegionDef[],
  _ageTrack: ColouringAgeTrack,
): ColouringRegionDef[] {
  throw new Error('not implemented');
}

/**
 * Age-2 rule: a tap that lands in a fine region's area fills the parent coarse region.
 * (hitTest already ignores fine regions at age 2; this helper maps a fine id to its parent
 * when tests want the fill target of a geometric point.)
 */
export function fillTarget(
  _regionId: string,
  _regions: ColouringRegionDef[],
  _ageTrack: ColouringAgeTrack,
): string {
  throw new Error('not implemented');
}

const PAPER = '#FFFDF9';

/**
 * Painted colour of a region: explicit fill, else a fine region's parent fill, else paper.
 */
export function effectiveColour(
  _regionId: string,
  _fills: Record<string, string>,
  _regions: ColouringRegionDef[],
): string {
  void PAPER;
  throw new Error('not implemented');
}

/** True when `id` is a known region on the page (used to drop unknown ids from a save). */
export function isKnownRegion(_regionId: string, _regions: ColouringRegionDef[]): boolean {
  throw new Error('not implemented');
}

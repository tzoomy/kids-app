// Pure Colouring Time tap resolution (no Phaser, no DOM).
// Spec: docs/specs/leisure-colouring.md (B1 / AC-29, AC-30). Contract: docs/contracts/leisure-colouring.md.
//
// Runtime contains() uses Path2D.isPointInPath in viewBox units (via a Canvas 2D context).
// Unit tests inject contains(). This module does not import Phaser and does not sample a canvas pixel buffer.

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
 * Runtime helper: whether (x, y) in path space lies inside a Path2D (nonzero fill rule).
 * Kept here so the unit-test file can assert the Path2D.isPointInPath plan without importing Phaser.
 */
export function path2dContains(ctx: { isPointInPath: (path: Path2D, x: number, y: number, fillRule?: CanvasFillRule) => boolean }, path: Path2D, x: number, y: number): boolean {
  return ctx.isPointInPath(path, x, y, 'nonzero');
}

/** Regions the given age track may fill (coarse only at age 2; all at age 5). */
export function hitTestableRegions(
  regions: ColouringRegionDef[],
  ageTrack: ColouringAgeTrack,
): ColouringRegionDef[] {
  return ageTrack === 'age2' ? regions.filter((r) => r.age2) : [...regions];
}

/**
 * Resolves a tap in viewBox units to a hit-testable region id, or null for a no-op.
 * Age 2 considers only coarse (`age2: true`) regions; age 5 considers all regions.
 */
export function hitTest(x: number, y: number, opts: HitTestOptions): string | null {
  const candidates = hitTestableRegions(opts.regions, opts.ageTrack);
  let inside: string | null = null;
  for (const region of candidates) {
    if (opts.contains(region.id, x, y)) inside = region.id;
  }
  if (inside) return inside;

  if (!opts.distance) return null;
  let nearest: string | null = null;
  let best = Infinity;
  for (const region of candidates) {
    const d = opts.distance(region.id, x, y);
    if (d <= opts.snapRadiusVu && d <= best) {
      best = d;
      nearest = region.id;
    }
  }
  return nearest;
}

/**
 * Age-2 rule: a tap that lands in a fine region's area fills the parent coarse region.
 * (hitTest already ignores fine regions at age 2; this helper maps a fine id to its parent
 * when tests want the fill target of a geometric point.)
 */
export function fillTarget(
  regionId: string,
  regions: ColouringRegionDef[],
  ageTrack: ColouringAgeTrack,
): string {
  if (ageTrack !== 'age2') return regionId;
  const region = regions.find((r) => r.id === regionId);
  if (!region || region.age2) return regionId;
  return region.parent ?? regionId;
}

const PAPER = '#FFFDF9';

/**
 * Painted colour of a region: explicit fill, else a fine region's parent fill, else paper.
 */
export function effectiveColour(
  regionId: string,
  fills: Record<string, string>,
  regions: ColouringRegionDef[],
): string {
  const own = fills[regionId];
  if (own) return own;
  const region = regions.find((r) => r.id === regionId);
  if (region?.parent) {
    const inherited = fills[region.parent];
    if (inherited) return inherited;
  }
  return PAPER;
}

/** True when `id` is a known region on the page (used to drop unknown ids from a save). */
export function isKnownRegion(regionId: string, regions: ColouringRegionDef[]): boolean {
  return regions.some((r) => r.id === regionId);
}

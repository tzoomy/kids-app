// Frozen hook types for Colouring Time (spec: docs/specs/leisure-colouring.md).
// Tests and stubs depend on these shapes. Do not rename them without a spec change.

/** Rectangle in page CSS px (top-left + size), the same space as `getBuildingHit`. */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type ColouringAgeTrack = 'age2' | 'age5';

export interface ColouringRegionInfo {
  id: string;
  /** Painted bounding box in CSS pixels, not expanded. */
  hit: PageRect;
  /** A CSS-pixel point guaranteed inside this region's own path. */
  tapPoint: { x: number; y: number };
}

/** Snapshot returned by ColouringScene.getColouringInfo() while the scene is active. */
export interface ColouringInfo {
  pageId: string;
  pageIndex: number;
  selectedColor: string;
  /** Explicit fills only: regionId -> colorId. */
  fills: Record<string, string>;
  undoCount: number;
  ageTrack: ColouringAgeTrack;
  balanceSec: number;
  inGrace: boolean;
  /** True after the time-out end screen is shown. */
  ended: boolean;
  pageRect: PageRect;
  /** CSS px side of the fitted square page; must be >= 680 in both orientations. */
  pageSide: number;
  /** Only regions hit-testable for this age track. */
  regions: ColouringRegionInfo[];
}

/** Payload of the seed-only hook `seedColouringState`. */
export interface ColouringSeed {
  pageId: string;
  fills?: Record<string, string>;
}

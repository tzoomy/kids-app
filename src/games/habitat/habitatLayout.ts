// Pure layout for Who Lives Here? in both supported orientations (1280x800 and 800x1280). No Phaser, so it is
// unit-testable. It reuses the Sorting Beds slot geometry (`computeSortingLayout`): one column per home (a row of
// them, or two rows of two for 3-4 homes in portrait) above a stage at the bottom where the current animal stands.
// Each column's tap rectangle is the whole column; the home art is fitted inside it, bottom-aligned.
import { ART_MANIFEST } from '../../assets/art/manifest';
import { computeSortingLayout, MIN_TAP, type LayoutRect } from '../sorting/sortingLayout';

export { MIN_TAP };
export type { LayoutRect };

export interface HabitatHomeLayout {
  id: string;
  /** Tap rectangle: the whole home column (art and a little air above it). */
  hit: LayoutRect;
  /** Where the home art is drawn (aspect of the manifest entry, inside `hit`). */
  art: LayoutRect;
  /** Where the animal's feet rest once it has settled in (inside the art). */
  settle: { x: number; feetY: number };
  /** Display height of a settled animal. */
  animalHeight: number;
}

export interface HabitatLayout {
  width: number;
  height: number;
  landscape: boolean;
  homes: HabitatHomeLayout[];
  /** The path patch where the current animal stands. */
  animal: {
    x: number;
    /** Feet y. */
    feetY: number;
    /** Display height of the animal on the path. */
    height: number;
    hit: LayoutRect;
    patch: { x: number; y: number; width: number; height: number };
  };
}

/** Width / height of a home's art (from the art manifest entry `home-<id>-back`), 1.3 when unknown. */
export function homeAspect(homeId: string): number {
  const entry = ART_MANIFEST.find((e) => e.key === `home-${homeId}-back`);
  return entry && entry.height > 0 ? entry.width / entry.height : 1.3;
}

/** Fraction of the art height, from the top, where a settled animal's feet rest (the doorway or the water line). */
const SETTLE_FEET_FRACTION = 0.84;
const COLUMN_PADDING = 6;

export function computeHabitatLayout(width: number, height: number, homeIds: readonly string[]): HabitatLayout {
  const base = computeSortingLayout(width, height, homeIds.length);
  const homes: HabitatHomeLayout[] = homeIds.map((id, i) => {
    const slot = base.beds[i];
    const hit = slot.hit;
    const maxW = hit.width - COLUMN_PADDING * 2;
    const maxH = hit.height - COLUMN_PADDING * 2;
    const aspect = homeAspect(id);
    const artW = Math.min(maxW, maxH * aspect);
    const artH = artW / aspect;
    const art: LayoutRect = {
      x: hit.x + (hit.width - artW) / 2,
      y: hit.y + hit.height - COLUMN_PADDING - artH,
      width: artW,
      height: artH,
    };
    return {
      id,
      hit: { ...hit },
      art,
      settle: { x: art.x + art.width / 2, feetY: art.y + art.height * SETTLE_FEET_FRACTION },
      animalHeight: Math.min(art.height * 0.5, base.basket.flowerHeight),
    };
  });
  const b = base.basket;
  return {
    width,
    height,
    landscape: base.landscape,
    homes,
    animal: {
      x: b.x,
      feetY: b.flowerBaseY,
      height: b.flowerHeight,
      hit: { ...b.hit },
      patch: { x: b.x, y: b.flowerBaseY, width: Math.max(b.width, b.flowerHeight * 1.1), height: Math.max(28, b.height * 0.32) },
    },
  };
}

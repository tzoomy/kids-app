// Workshop L20 touch targets (spec AC-18): every interactive hit area is at least 48 CSS px on its shortest side at every supported
// viewport (landscape 1280x800 and 1180x820, portrait 820x1180 and 800x1280). The board is letterboxed, so one world px is fewer
// CSS px in portrait: the hit size in WORLD px is computed from the live board scale and re-applied on resize. The art keeps its size;
// only the invisible hit areas grow. Pure TS, no Phaser.

/** The minimum touch target for a 5-year-old's finger, CSS px. */
export const MIN_TOUCH_CSS = 48;
/** A safety margin so rounding in the page-rect conversion never lands under 48. */
const MARGIN_CSS = 0.5;
/** Board scales below this are treated as broken (a zero-size canvas while the page lays out) and clamped. */
const MIN_SCALE = 0.2;

/** The hit side in world px for a board scale `cssPerWorld` (CSS px per world px). */
export function minHitWorld(cssPerWorld: number): number {
  const s = Number.isFinite(cssPerWorld) && cssPerWorld > 0 ? Math.max(MIN_SCALE, cssPerWorld) : 1;
  return Math.ceil((MIN_TOUCH_CSS + MARGIN_CSS) / s);
}

/** A hit side: the art, the part's own floor (board px) and the 48 CSS px minimum, whichever is largest. */
export function hitSide(art: number, floor: number, minWorld: number): number {
  return Math.max(art, floor, minWorld);
}

export interface HitCandidate {
  id: string;
  /** Centre, world px. */
  x: number;
  y: number;
  w: number;
  h: number;
}

/**
 * Overlapping hit rects (placed dominoes are 40 px apart, their hit areas are wider): among the rects that contain the point,
 * the one whose CENTRE is nearest wins (the first in the list on an exact tie). Null when none contains it.
 */
export function nearestHit(candidates: readonly HitCandidate[], at: { x: number; y: number }): string | null {
  let best: { id: string; d: number } | null = null;
  for (const c of candidates) {
    if (Math.abs(at.x - c.x) > c.w / 2 || Math.abs(at.y - c.y) > c.h / 2) continue;
    const d = Math.hypot(at.x - c.x, at.y - c.y);
    if (!best || d < best.d) best = { id: c.id, d };
  }
  return best ? best.id : null;
}

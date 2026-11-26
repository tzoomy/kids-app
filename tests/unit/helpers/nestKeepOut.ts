// The painted nest of the FINAL `map-nest-home` as every game-shell test sees it: ONE measurement, shared by the world,
// friend and walk tests (docs/specs/game-shell.md AC-02, AC-06, AC-24, AC-25, AC-28). Test helper only (no Phaser).
//
// HOW IT WAS MEASURED. Gemini's final whole-egg nest (PR #113, `public/art/game-shell/map-nest-home.webp`: a 720x600 file, the
// 1x box 360x300 of `gameShellAssets.json`; no blanket, no feather, no baked glow) is drawn at the nest anchor (640, 420) at
// scale 1, so board x = 640 - 180 + px / 2 and board y = 420 - 150 + py / 2 for a pixel (px, py) of the 2x file. The
// silhouette is the alpha channel: alpha > 20 gives the pixel bounding box (41, 27)..(677, 585) on the 2x canvas, alpha > 60
// gives (42, 28)..(677, 584), i.e. the egg tip at board y 284 and the bowl at board x 481..798. `NEST_ROWS` are the alpha > 60
// columns (first and last opaque pixel) of the 2x row for each board y in 10 px steps, plus the tip row at 284. The egg is
// the cream part of the picture (R >= 200, G >= 180, B >= 150, alpha > 60: the twigs are brown, so they drop out): its
// bounding box is x 550..726 and it is widest at y 410..422; it disappears behind the bowl's front twigs below y 468.
// RE-MEASURE ALL OF THIS whenever Gemini re-delivers `map-nest-home`.

/** Rows of the nest silhouette (egg and bowl): [board y, x of the first opaque pixel, x just past the last one]. */
export const NEST_ROWS: readonly (readonly [number, number, number])[] = [
  [284, 633, 648], [290, 616, 665], [300, 601, 679], [310, 591, 689], [320, 582, 697], [330, 576, 703], [340, 570, 709], [350, 564, 714],
  [360, 560, 718], [370, 556, 721], [380, 522, 742], [390, 518, 766], [400, 500, 780], [410, 496, 782], [420, 488, 790], [430, 484, 794],
  [440, 487, 794], [450, 482, 798], [460, 484, 797], [470, 481, 794], [480, 488, 797], [490, 486, 794], [500, 482, 794],
  [510, 500, 784], [520, 504, 785], [530, 510, 767], [540, 530, 744], [550, 555, 724], [560, 606, 662],
];

/** The painted egg alone (board px): the tip is at y 284, the widest part x 550..726, its lower part hides behind the bowl at y 468. */
export const EGG_BOX = { x0: 550, x1: 726, y0: 284, y1: 468 } as const;

/** The whole nest silhouette's bounding box (board px, alpha > 60): the bowl's tips are at x 481 and 798, its bottom at y 562. */
export const NEST_BOX = { x0: 481, x1: 798, y0: 284, y1: 562 } as const;

/** Whether a board point is inside the nest silhouette (egg and bowl) grown by `margin` px on every side (negative = inset). */
export function inNestKeepOut(p: { x: number; y: number }, margin = 10): boolean {
  const top = NEST_ROWS[0];
  const bottom = NEST_ROWS[NEST_ROWS.length - 1];
  if (p.y < top[0] - margin || p.y > bottom[0]) return false;
  if (p.y < top[0]) return Math.abs(p.x - (top[1] + top[2]) / 2) <= (top[2] - top[1]) / 2 + margin;
  let k = NEST_ROWS.findIndex((r) => r[0] >= p.y);
  if (k <= 0) k = 1;
  const a = NEST_ROWS[k - 1];
  const b = NEST_ROWS[k];
  const t = (p.y - a[0]) / (b[0] - a[0]);
  const xMin = a[1] + (b[1] - a[1]) * t;
  const xMax = a[2] + (b[2] - a[2]) * t;
  return p.x >= xMin - margin && p.x <= xMax + margin;
}

/** Whether a board rectangle (x0..x1, y0..y1) overlaps the painted egg grown by `margin` px on every side. */
export function overlapsEgg(r: { x0: number; x1: number; y0: number; y1: number }, margin = 0): boolean {
  return r.x1 > EGG_BOX.x0 - margin && r.x0 < EGG_BOX.x1 + margin && r.y1 > EGG_BOX.y0 - margin && r.y0 < EGG_BOX.y1 + margin;
}

/**
 * The smallest distance (board px) between a board rectangle and the nest silhouette (egg and bowl, `NEST_ROWS`; each row is
 * the span between its first and last opaque pixel, sampled every 2 px of y and interpolated between rows). 0 = touching or
 * overlapping. This is the OUTER outline, so the bowl's twigs count, not only the egg.
 */
export function gapToNest(r: { x0: number; x1: number; y0: number; y1: number }): number {
  let best = Infinity;
  const first = NEST_ROWS[0][0];
  const last = NEST_ROWS[NEST_ROWS.length - 1][0];
  for (let y = first; y <= last; y += 2) {
    let k = NEST_ROWS.findIndex((row) => row[0] >= y);
    if (k <= 0) k = 1;
    const a = NEST_ROWS[k - 1];
    const b = NEST_ROWS[k];
    const t = Math.min(1, Math.max(0, (y - a[0]) / (b[0] - a[0])));
    const xMin = a[1] + (b[1] - a[1]) * t;
    const xMax = a[2] + (b[2] - a[2]) * t;
    const dx = Math.max(xMin - r.x1, r.x0 - xMax, 0);
    const dy = Math.max(r.y0 - y, y - r.y1, 0);
    best = Math.min(best, Math.hypot(dx, dy));
  }
  return best;
}

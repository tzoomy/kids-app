// Placement of the decorative bear mascot on the map (docs/specs/wardrobe.md AC-14). Pure geometry: the bear sits in
// a margin the building grid leaves free (left side in landscape, below the grid in portrait), so it never overlaps a
// building hit target. The mascot is never interactive; the HUD wardrobe button stays the only Wardrobe entry.

export interface MapBearPlacement {
  /** Feet position (the Character root sits at the feet) and drawn height, in game coordinates. */
  x: number;
  y: number;
  displayHeight: number;
}

export interface MapBearInput {
  width: number;
  height: number;
  /** Centres of the world buildings (game coordinates). */
  buildings: ReadonlyArray<{ x: number; y: number }>;
  /** Drawn size of one building (the map draws them at 180). */
  buildingSize: number;
}

/** Idle float (8 px) and the pop-in overshoot (about 10%) both extend a building beyond its resting rectangle. */
const FLOAT_PX = 8;
const OVERSHOOT = 1.15;
/** DOM world labels sit under each building (gameY + 88) and are about this tall. */
const LABEL_ALLOWANCE = 50;
const GAP = 12;
const MAX_HEIGHT = 260;
const BODY_ASPECT = 0.8; // Character.displaySize(): width = 0.8 * height

export function computeMapBearPlacement(input: MapBearInput): MapBearPlacement {
  const { width, height, buildings, buildingSize } = input;
  const half = (buildingSize * OVERSHOOT) / 2;
  const left = Math.min(...buildings.map((b) => b.x)) - half;
  const bottom = Math.max(...buildings.map((b) => b.y)) + half + FLOAT_PX + LABEL_ALLOWANCE;

  const sideRoom = left - GAP;
  if (width >= height && sideRoom >= 150) {
    const displayHeight = Math.min(MAX_HEIGHT, height * 0.32, sideRoom / BODY_ASPECT);
    return { x: left / 2, y: height - 30, displayHeight };
  }
  const belowRoom = height - bottom - GAP;
  const displayHeight = Math.max(100, Math.min(MAX_HEIGHT, belowRoom - 6));
  return { x: width / 2, y: height - GAP, displayHeight };
}

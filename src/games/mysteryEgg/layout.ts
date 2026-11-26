// Mystery Egg mission 1.1 board: geometry in board coordinates (1280x800, y down). Pure data, no Phaser.
// The scene draws from these numbers and the physics (machine.ts) builds its bodies from them, so they cannot drift apart.
import type { SlotDef } from './snap';

export interface Point2 {
  x: number;
  y: number;
}

export const BOARD = { width: 1280, height: 800 } as const;

export const BALL = { x: 150, y: 232, radius: 34 } as const;

/**
 * `part-ball.webp` is a 64 px display box whose painted disc is only 59 px wide (measured on the alpha of the 128 px file:
 * a transparent margin of 2.5 px each side). The ball view is scaled so the VISIBLE disc has the physics diameter, otherwise
 * the painted ball floats about 2.7 px (radius) above the surface it rolls on. Re-measure if the ball art changes.
 */
export const BALL_ART_VISIBLE_1X = 59;
export const BALL_ART_SCALE = (BALL.radius * 2) / BALL_ART_VISIBLE_1X;

/** The fixed shelf the ball starts on (static), tilted slightly down to the right so the ball rolls off by itself. Centre + size + angle (rad). */
export const SHELF = { x: 210, y: 300, w: 300, h: 28, angle: 0.22 } as const;

/** The slot the missing ramp piece goes into: its centre, and the display size of the ramp art (the drop zone). */
export const RAMP_SLOT = { x: 470, y: 440, w: 240, h: 140 } as const;

/**
 * The solid wedge of the ramp piece: a convex polygon in display px relative to the slot (art) centre. It is the SILHOUETTE
 * of the painted `part-ramp.webp` (alpha >= 128 on the 480x280 file, drawn 240x140 centred on the slot, scale 1): its top
 * edge follows the painted top surface (left shoulder, crest at about (-29, -59), then the slope down to the right tip), so
 * a ball resting on the body touches the painted slope instead of sinking into it. The older wedge sat about 34 px (one
 * ball radius) below the painted surface, so the ball looked as if it rolled inside the ramp. Measured with
 * `tests/unit/mystery-egg.physics.test.ts` (RAMP_ART_TOP): re-measure when Gemini re-delivers the ramp art. The physics
 * body, the slot glow and the drawn placeholder all use this polygon, unrotated.
 */
export const RAMP_POLY = [
  { x: -100.5, y: -42 },
  { x: -94, y: -46 },
  { x: -29, y: -59 },
  { x: 99, y: 34 },
  { x: 101, y: 39 },
  { x: 33, y: 65.5 },
  { x: -97.5, y: 20 },
  { x: -100.5, y: 17 },
] as const;

/** Workbench the ramp feeds onto, with the bell hanging over it. */
export const TABLE = { x: 750, y: 552, w: 300, h: 24 } as const;
export const RIGHT_WALL = { x: 912, y: 470, w: 24, h: 220 } as const;

/** The bell (a goal zone, not a solid): the ball rings it when its centre comes within BALL.radius + BELL.radius. */
export const BELL = { x: 800, y: 490, radius: 44 } as const;

/** Floor below everything and a low wall that keeps the failed ball in the pit under the shelf. */
export const FLOOR = { x: 640, y: 712, w: 1500, h: 24 } as const;
export const PIT_WALL = { x: 585, y: 650, w: 20, h: 100 } as const;

/** The bed with the sleeping cat (scenery only). */
export const BED = { x: 1080, y: 400, w: 300, h: 40 } as const;

/** The one glowing slot. The ramp is the only part it accepts in mission 1.1. */
export const SLOTS: readonly SlotDef[] = [{ id: 'ramp-slot', x: RAMP_SLOT.x, y: RAMP_SLOT.y, accepts: ['ramp'] }];

/** Small push (px per step) given at Play; gravity on the tilted shelf does the rest. */
export const LAUNCH_SPEED = 2;

/** Heart-panel socket centres on the 1x panel (from Gemini's PR #108): x = 40/100/160/220/280, y = 40. */
export const HEART_SOCKETS_1X = { x: [40, 100, 160, 220, 280], y: 40 } as const;

/**
 * Board position of each of the 5 sockets when the heart panel (manifest display size `panel`) is drawn centred at
 * (cx, cy) with `scale`. Slots (48x48 at 1x) are centred on these points at the same scale.
 */
export function heartSlotCentres(cx: number, cy: number, panel: { w: number; h: number }, scale: number): Point2[] {
  const left = cx - (panel.w * scale) / 2;
  const top = cy - (panel.h * scale) / 2;
  return HEART_SOCKETS_1X.x.map((sx) => ({ x: left + sx * scale, y: top + HEART_SOCKETS_1X.y * scale }));
}

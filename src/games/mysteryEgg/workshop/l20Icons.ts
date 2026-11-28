// Workshop L20 code-drawn icons (no Phaser import: the graphics object is only used through its drawing calls).
import type Phaser from 'phaser';

/** Continue's palette: violet (the dotted-arrow violet of the goal card), clearly not Play's green. */
export const CONTINUE_COLOURS = { base: 0x8e5bd6, edge: 0x5e35b1, door: 0xffffff, doorway: 0x3f2a7a, arrow: 0xffffff } as const;

/**
 * "Next" / "go on": an arrow going INTO a door, on a violet rounded button. Not a play triangle, not green, so a child cannot read it
 * as "run again". Drawn for a button box w x h centred on (0, 0); everything stays inside it.
 */
export function drawContinueIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const u = Math.min(w, h);
  g.fillStyle(CONTINUE_COLOURS.base, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 30);
  g.lineStyle(6, CONTINUE_COLOURS.edge, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 30);
  // The door on the right: a white frame with a dark doorway and a knob.
  const dx = 0.1 * u;
  g.fillStyle(CONTINUE_COLOURS.door, 1);
  g.fillRoundedRect(dx, -0.36 * u, 0.3 * u, 0.72 * u, 6);
  g.fillStyle(CONTINUE_COLOURS.doorway, 1);
  g.fillRoundedRect(dx + 0.05 * u, -0.3 * u, 0.2 * u, 0.6 * u, 4);
  g.fillStyle(CONTINUE_COLOURS.door, 1);
  g.fillCircle(dx + 0.2 * u, 0.02 * u, 0.025 * u);
  // The arrow: a thick shaft and a head pointing into the doorway.
  g.fillStyle(CONTINUE_COLOURS.arrow, 1);
  g.fillRect(-0.44 * u, -0.07 * u, 0.36 * u, 0.14 * u);
  g.fillTriangle(-0.12 * u, -0.22 * u, -0.12 * u, 0.22 * u, 0.1 * u, 0);
}

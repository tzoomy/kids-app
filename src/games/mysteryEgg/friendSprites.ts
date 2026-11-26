// Game shell friend sizes (docs/specs/game-shell.md AC-23): how big each friend is drawn on the 1280x800 map, measured on
// Gemini's real sprites (PR #113; 2x canvases, alpha > 20). Pure data and arithmetic, no Phaser.
import type { FriendId } from './worlds';

export interface FriendSprite {
  /** The manifest's 1x display box (idle art and one walk frame) and the real 2x canvas of one frame. */
  box: { w: number; h: number };
  canvas: { w: number; h: number };
  /** Height of the visible (non-transparent) pixels of the idle art on the 2x canvas. */
  visible: number;
  /** Typical visible height of the walk frames (documentation and guard: within a few % of `visible`, so one scale serves both). */
  walkVisible: number;
  /** Canvas row just below the lowest visible pixel (the feet) on the 2x canvas; idle and walk frames share it. */
  feet: number;
  /** Width of the visible pixels of the idle art on the 2x canvas (used for spacing). */
  visibleWidth: number;
  /** Board px the visible friend is tall on the map (idle art and walk strip alike). */
  height: number;
}

/**
 * Measured on the delivered files (Gemini's PR #113, alpha > 20). Walk frames (visible px): bunny 382/384/382/372, robot
 * 286/289/287/288, capybara 366/365/365/362, frog 202/233/225 (airborne)/227; idle 384 / 287 / 364 / 228, so one scale per
 * friend serves both states. Feet rows match between idle and walk (bunny 392, robot 292, capybara 372, frog 252).
 * Target heights: the bunny is about 190 px (Gemini's map mock), the capybara about as tall, the robot a bit shorter, the
 * frog clearly the smallest.
 */
export const FRIEND_SPRITES: Readonly<Record<FriendId, FriendSprite>> = {
  bunny: { box: { w: 160, h: 200 }, canvas: { w: 320, h: 400 }, visible: 384, walkVisible: 380, feet: 392, visibleWidth: 169, height: 190 },
  robot: { box: { w: 120, h: 150 }, canvas: { w: 240, h: 300 }, visible: 287, walkVisible: 288, feet: 292, visibleWidth: 191, height: 150 },
  capybara: { box: { w: 160, h: 190 }, canvas: { w: 320, h: 380 }, visible: 364, walkVisible: 365, feet: 372, visibleWidth: 235, height: 182 },
  frog: { box: { w: 110, h: 130 }, canvas: { w: 220, h: 260 }, visible: 228, walkVisible: 222, feet: 252, visibleWidth: 204, height: 120 },
};

/** Scale of the manifest's 1x box (what `eggArt` draws, placeholders included) that makes the visible friend `height` px tall. */
export function friendBoxScale(id: FriendId): number {
  const s = FRIEND_SPRITES[id];
  return (s.height * s.canvas.h) / (s.visible * s.box.h);
}

/** The visible width of the idle art (board px). */
export function displayedVisibleWidth(id: FriendId): number {
  const s = FRIEND_SPRITES[id];
  return (s.visibleWidth * s.height) / s.visible;
}

/**
 * y of the art box centre relative to the friend's root (the centre of its visible body) so that the feet are `height / 2`
 * below the root: the idle art and the walk strip stand on the same line.
 */
export function friendArtY(id: FriendId): number {
  const s = FRIEND_SPRITES[id];
  return s.height / 2 - (s.feet / s.canvas.h - 0.5) * s.box.h * friendBoxScale(id);
}

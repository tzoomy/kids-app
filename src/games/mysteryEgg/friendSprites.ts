// Game shell friend sizes (docs/specs/game-shell.md AC-23): how big each friend is drawn on the 1280x800 map, measured on
// Gemini's real sprites (PR #113; 2x canvases, alpha > 20). Pure data and arithmetic, no Phaser.
import type { FriendId } from './worlds';

export interface FriendSprite {
  /** The manifest's 1x display box (idle art and one walk frame) and the real 2x canvas of one frame. */
  box: { w: number; h: number };
  canvas: { w: number; h: number };
  /** Height of the visible (non-transparent) pixels of the idle art on the 2x canvas. */
  visible: number;
  /** Typical visible height of the walk frames on the 2x canvas. Within `WALK_SCALE_TOLERANCE` of `visible` the walk strip shares the idle scale; beyond it (the frog) the strip gets its own. */
  walkVisible: number;
  /** Canvas row just below the lowest visible pixel (the feet) on the 2x canvas; idle and walk frames share it. */
  feet: number;
  /** Width of the visible pixels of the idle art, and of the widest land walk frame, on the 2x canvas (used for spacing). */
  visibleWidth: number;
  walkWidth: number;
  /** Board px the visible friend is tall on the map (idle art and walk strip alike). */
  height: number;
}

/**
 * Measured on the delivered files (Gemini's PR #113 head b8cb8ba, alpha > 20, visible px on the 2x canvas). Idle: bunny 384,
 * robot 287, capybara 364, frog 228. Walk frames: bunny 382/384/382/372, robot 286/289/287/288, capybara 366/365/365/362, frog
 * 156/180/174 (land frames; the airborne frame, 173 tall with the feet at row 190, is left out)/174, so `walkVisible` is the
 * typical land frame (frog 174, the 220 px cell is its limit). Feet rows match idle and walk (bunny 392, robot 292,
 * capybara 372, frog 252; frog walk 251..253). Re-measure when Gemini re-delivers a sprite.
 * Target heights: the bunny is about 190 px (Gemini's map mock), the capybara about as tall, the robot a bit shorter, the
 * frog clearly the smallest.
 */
export const FRIEND_SPRITES: Readonly<Record<FriendId, FriendSprite>> = {
  bunny: { box: { w: 160, h: 200 }, canvas: { w: 320, h: 400 }, visible: 384, walkVisible: 380, feet: 392, visibleWidth: 169, walkWidth: 183, height: 190 },
  robot: { box: { w: 120, h: 150 }, canvas: { w: 240, h: 300 }, visible: 287, walkVisible: 288, feet: 292, visibleWidth: 191, walkWidth: 135, height: 150 },
  capybara: { box: { w: 160, h: 190 }, canvas: { w: 320, h: 380 }, visible: 364, walkVisible: 365, feet: 372, visibleWidth: 235, walkWidth: 210, height: 182 },
  frog: { box: { w: 110, h: 130 }, canvas: { w: 220, h: 260 }, visible: 228, walkVisible: 174, feet: 252, visibleWidth: 204, walkWidth: 205, height: 120 },
};

/** A walk strip whose frames differ from the idle art by more than this fraction gets its own scale. */
export const WALK_SCALE_TOLERANCE = 0.05;

export type FriendState = 'idle' | 'walk';

/**
 * Scale of the manifest's 1x box (what `eggArt` draws, placeholders included) that makes the visible friend `height` px tall.
 * The walk strip uses the idle scale, except for a friend whose walk frames are measurably smaller or bigger than the idle
 * art (the frog: walk 174 vs idle 228 visible px, so its walk scale is idle x 228 / 174 = x1.31).
 */
export function friendBoxScale(id: FriendId, state: FriendState = 'idle'): number {
  const s = FRIEND_SPRITES[id];
  const own = state === 'walk' && Math.abs(s.walkVisible / s.visible - 1) > WALK_SCALE_TOLERANCE;
  return (s.height * s.canvas.h) / ((own ? s.walkVisible : s.visible) * s.box.h);
}

/** The visible width (board px) of the idle art. */
export function displayedVisibleWidth(id: FriendId): number {
  const s = FRIEND_SPRITES[id];
  return (s.visibleWidth * s.height) / s.visible;
}

/**
 * y of the art box centre relative to the friend's root (the centre of its visible body) so that the feet are `height / 2`
 * below the root in the given state: where a state has its own scale (the frog's walk strip) the box is moved so the feet stay level on the swap.
 */
export function friendArtY(id: FriendId, state: FriendState = 'idle'): number {
  const s = FRIEND_SPRITES[id];
  return s.height / 2 - (s.feet / s.canvas.h - 0.5) * s.box.h * friendBoxScale(id, state);
}

/** Widest visible width (board px) of the friend, idle or in a walk frame: the footprint the spacing keeps clear. */
export function footprintWidth(id: FriendId): number {
  const s = FRIEND_SPRITES[id];
  const walk = (s.walkWidth * s.height) / (Math.abs(s.walkVisible / s.visible - 1) > WALK_SCALE_TOLERANCE ? s.walkVisible : s.visible);
  return Math.max(displayedVisibleWidth(id), walk);
}

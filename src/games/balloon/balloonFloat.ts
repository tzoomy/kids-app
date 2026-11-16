// Floating stage for Balloon Pop (docs/specs/balloon-pop.md, "Floating stage"): every Nth trial the balloons
// drift slowly upward and the child pops the named one while it moves. Pure (no Phaser) so the motion,
// respawn, hit areas and the difficulty mapping are unit-testable. Coordinates are game px.
// Forgiving by design for ages 2-5: no timer and no fail state; a balloon that drifts past the top
// re-enters from the bottom at once, so the requested balloon never escapes.
import type { Rect } from '../restaurant/restaurantLayout';

export type AgeTrackId = 'age2' | 'age5';

export interface FloatingConfig {
  /** Every Nth trial of a visit is a floating trial (trial N, 2N, ...). */
  everyNthTrial: number;
  /** Rise speed in game px per second at the bottom level of each age track. */
  speed: Record<AgeTrackId, number>;
  /** Extra speed per level above the track's bottom level, as a fraction of the base (0.1 = +10%). */
  speedStepPerLevel: number;
  /** Side-to-side sway amplitude in game px. */
  swayPx: number;
  /** Hit area size relative to the drawn balloon body (>= 1.5). */
  hitScale: number;
  /** Minimum hit area side in CSS px. */
  minHitCssPx: number;
}

/** Speeds never exceed this, whatever the content says (game px per second; the portrait sky is 1280 tall). */
export const MAX_FLOAT_SPEED = 120;
/** Sway angular speed (radians per second): one slow side-to-side swing every ~8 s. */
const SWAY_RAD_PER_SEC = 0.8;
const MAX_FLOAT_RX = 92;
const BODY_RATIO = 1.22;

/** True when the trial with this 1-based number (within the visit) is a floating trial. */
export function isFloatingTrial(trialNumber: number, cfg: Pick<FloatingConfig, 'everyNthTrial'>): boolean {
  const n = Math.max(1, Math.floor(cfg.everyNthTrial));
  return trialNumber >= n && trialNumber % n === 0;
}

/**
 * Rise speed for a level: the age track's base speed, a little faster for each level above the track's
 * bottom level, clamped to MAX_FLOAT_SPEED. Age 2 at its first level is the slowest case.
 */
export function floatSpeed(cfg: FloatingConfig, age: AgeTrackId, levelNo: number, trackMin: number): number {
  const above = Math.max(0, levelNo - trackMin);
  return Math.min(MAX_FLOAT_SPEED, cfg.speed[age] * (1 + cfg.speedStepPerLevel * above));
}

export interface FloatBalloon {
  /** Lane centre (the sway swings around it). */
  laneX: number;
  x: number;
  y: number;
  rx: number;
  ry: number;
  /** Sway phase offset in radians. */
  phase: number;
  /** Times this balloon left the top and came back from the bottom. */
  loops: number;
}

export interface FloatArea {
  width: number;
  height: number;
  /** A balloon whose centre rises above this line (under the HUD and prompt bubble) respawns at the bottom. */
  top: number;
  /** Respawn centre y (just below the visible bottom edge, so it slides back into view). */
  spawnY: number;
}

export function floatArea(width: number, height: number, ry: number): FloatArea {
  return { width, height, top: Math.max(200, height * 0.22), spawnY: height + ry * 0.35 };
}

/** Balloon body radii for `count` lanes across `width`. */
export function floatRadii(width: number, count: number): { rx: number; ry: number } {
  const laneW = width / Math.max(1, count);
  const rx = Math.min(MAX_FLOAT_RX, laneW * 0.34);
  return { rx, ry: rx * BODY_RATIO };
}

/**
 * Starting positions: one lane per balloon; heights spread over the sky (shuffled by `random`) so every
 * balloon is visible from the first frame and they do not all reach the top together.
 */
export function initialFloatBalloons(width: number, height: number, count: number, random: () => number = Math.random): FloatBalloon[] {
  const n = Math.max(1, count);
  const { rx, ry } = floatRadii(width, n);
  const area = floatArea(width, height, ry);
  const laneW = width / n;
  const bands = Array.from({ length: n }, (_, i) => i);
  for (let i = bands.length - 1; i > 0; i--) {
    const j = Math.floor(random() * (i + 1));
    [bands[i], bands[j]] = [bands[j], bands[i]];
  }
  const low = area.top + ry;
  const high = height - ry * 0.6;
  return bands.map((band, i) => {
    const laneX = (i + 0.5) * laneW;
    const y = low + ((band + 0.5) / n) * (high - low);
    return { laneX, x: laneX, y, rx, ry, phase: random() * Math.PI * 2, loops: 0 };
  });
}

/** Sway amplitude that keeps a balloon inside its own lane. */
function swayFor(b: FloatBalloon, swayPx: number, width: number, count: number): number {
  const laneW = width / Math.max(1, count);
  return Math.max(0, Math.min(swayPx, laneW / 2 - b.rx));
}

/**
 * Advances every balloon by `dtMs`: rises at `speed`, sways gently in its lane, and re-enters from the
 * bottom once it passes the top line. Mutates and returns the array. `elapsedMs` is the stage clock.
 */
export function stepFloat(
  balloons: FloatBalloon[],
  dtMs: number,
  elapsedMs: number,
  speed: number,
  area: FloatArea,
  swayPx: number,
): FloatBalloon[] {
  // Clamp long frames (a background tab) so a balloon never jumps across the screen.
  const dt = Math.min(Math.max(dtMs, 0), 100) / 1000;
  const t = elapsedMs / 1000;
  for (const b of balloons) {
    b.y -= speed * dt;
    if (b.y < area.top) {
      b.y = area.spawnY;
      b.loops++;
    }
    b.x = b.laneX + swayFor(b, swayPx, area.width, balloons.length) * Math.sin(b.phase + t * SWAY_RAD_PER_SEC);
  }
  return balloons;
}

/**
 * Opacity while floating: 1 in the open sky, fading to 0 over the last body height before the top line,
 * so a balloon about to loop melts away under the HUD instead of vanishing mid-sky.
 */
export function floatAlpha(b: Pick<FloatBalloon, 'y' | 'ry'>, area: Pick<FloatArea, 'top'>): number {
  return Math.min(1, Math.max(0, (b.y - area.top) / (b.ry * 1.2)));
}

/**
 * Tap rectangle: the drawn body scaled by `hitScale` (at least 1.5x), and at least `minHitGamePx` on each side.
 * Pass `minHitGamePx = minHitCssPx * gamePxPerCssPx` from the scene.
 */
export function floatHitRect(b: Pick<FloatBalloon, 'x' | 'y' | 'rx' | 'ry'>, hitScale: number, minHitGamePx: number): Rect {
  const scale = Math.max(1.5, hitScale);
  const halfW = Math.max(b.rx * scale, minHitGamePx / 2);
  const halfH = Math.max(b.ry * scale, minHitGamePx / 2);
  return { left: b.x - halfW, right: b.x + halfW, top: b.y - halfH, bottom: b.y + halfH };
}

/**
 * Index of the balloon a tap at (x, y) means: among balloons whose hit rectangle contains the point, the one
 * whose centre is nearest (hit areas are generous, so neighbours may overlap). -1 when none contains it.
 */
export function pickFloatBalloon(
  balloons: ReadonlyArray<Pick<FloatBalloon, 'x' | 'y' | 'rx' | 'ry'>>,
  x: number,
  y: number,
  hitScale: number,
  minHitGamePx: number,
): number {
  let best = -1;
  let bestD = Infinity;
  balloons.forEach((b, i) => {
    const r = floatHitRect(b, hitScale, minHitGamePx);
    if (x < r.left || x > r.right || y < r.top || y > r.bottom) return;
    const d = ((x - b.x) / b.rx) ** 2 + ((y - b.y) / b.ry) ** 2;
    if (d < bestD) {
      bestD = d;
      best = i;
    }
  });
  return best;
}

// Global physics config of every Mystery Egg / Workshop Matter engine (workshop v5.1 §1.2b, decision 5/20).
// One module so the live game, the headless unit tests and the v5.1 simulator (design sim/core.cjs) run the SAME world.
// Phaser-free: the Matter library is passed in (Phaser's bundled build in the scene, the same build headless in tests).

/** `engine.timing.timeScale` for every level: the fastest value with no failing solution in the v5.1 sim (1.2 passes, 1.3 loses L8/L17). */
export const PHYSICS_TIME_SCALE = 1.25;

/**
 * Matter's global collision-resolver constants as Phaser 3.90's MatterPhysics plugin sets them when any Matter-enabled scene
 * exists (the live game), and as the v5.1 simulator pins them (`PIN=1`). They are GLOBAL, so every world pins them around
 * each Engine.update and restores the caller's values (live == headless == sim). The v4 pin (2 / sqrt(6)) is gone.
 */
export const RESOLVER_PIN = {
  _restingThresh: 4,
  _restingThreshTangent: 6,
  _positionDampen: 0.9,
  _positionWarming: 0.8,
  _frictionNormalMultiplier: 5,
} as const;
export type ResolverConstants = Record<keyof typeof RESOLVER_PIN, number>;

/** A body moves 1.25x further per step, so a static a ball must not pass is at least this thick (px); thinner ones can be tunnelled. */
export const MIN_CATCH_FLOOR = 20;

export interface TimedEngine {
  timing: { timeScale: number };
}
export interface ResolverHost {
  Resolver?: Partial<ResolverConstants>;
}

/** Sets the engine's timeScale. Call once after `Engine.create()` (and for an engine the Phaser plugin owns). */
export function applyPhysicsConfig(engine: TimedEngine): void {
  engine.timing.timeScale = PHYSICS_TIME_SCALE;
}

/** Runs `fn` with the resolver constants pinned; the caller's global values are restored afterwards, even when `fn` throws. */
export function withResolverPin<T>(M: ResolverHost, fn: () => T): T {
  const resolver = M.Resolver;
  if (!resolver) return fn();
  const saved = { ...resolver };
  Object.assign(resolver, RESOLVER_PIN);
  try {
    return fn();
  } finally {
    Object.assign(resolver, saved);
  }
}

/**
 * Scripted spring contact test (L7/L8/L22): look ahead by the real per-step displacement v x timeScale, otherwise a ball can
 * land and be resolved before the hook sees it move down (seen in L8 at 1.25x). Only a ball moving down needs it.
 */
export function lookAheadPx(velocityY: number): number {
  return Math.max(0, velocityY) * PHYSICS_TIME_SCALE;
}

/** A scripted lift/pulley timer measured in base steps runs `timeScale` times faster: divide it. */
export function scriptedTimerSteps(baseSteps: number): number {
  return baseSteps / PHYSICS_TIME_SCALE;
}

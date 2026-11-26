// Game shell map rules (docs/specs/game-shell.md AC-19, AC-20, AC-30): when a map tap counts, and a wiggle that never stacks.
// Pure, no Phaser: the scene passes its own tween factory.
import type { EggPhase } from './types';

/**
 * A tap on the map counts only on a live, loaded map in phase `map`: not while walking, in slides, on a transition or while a
 * piece flies. One guard for every map tap: a world (open or closed), a friend and the nest.
 */
export function mapTapAllowed(s: { alive: boolean; ready: boolean; phase: EggPhase }): boolean {
  return s.alive && s.ready && s.phase === 'map';
}

/** The guard's original name (world taps); the same rule. */
export const worldTapAllowed = mapTapAllowed;

export interface StoppableTween {
  stop(): unknown;
}

/**
 * One running wiggle per target. A new wiggle stops the running one and restores the target's rest pose first, so quick
 * repeated taps never accumulate rotation or scale.
 */
export class WiggleGuard<T> {
  private readonly running = new Map<T, StoppableTween>();

  constructor(private readonly restore: (target: T) => void) {}

  start(target: T, run: () => StoppableTween): void {
    this.running.get(target)?.stop();
    this.restore(target);
    this.running.set(target, run());
  }

  /** The wiggle of `target` ended by itself (its tween completed). */
  finish(target: T): void {
    this.running.delete(target);
  }

  /** Forget every running wiggle (the scene restarted, its tweens are gone). */
  clear(): void {
    this.running.clear();
  }

  isRunning(target: T): boolean {
    return this.running.has(target);
  }
}

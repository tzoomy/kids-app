// Game shell map rules (docs/specs/game-shell.md): the map-phase tap guard and the non-stacking wiggle. Pure modules only.
import { describe, expect, it } from 'vitest';
import { WiggleGuard, worldTapAllowed } from '../../src/games/mysteryEgg/mapRules';
import type { EggPhase } from '../../src/games/mysteryEgg/types';

describe('game-shell map tap guard', () => {
  it('[AC-20] a world tap (open or closed) is only allowed on a live, ready map in phase `map`', () => {
    const phases: EggPhase[] = ['hub', 'intro', 'map', 'walking', 'entry', 'build', 'success'];
    for (const phase of phases) {
      expect(worldTapAllowed({ alive: true, ready: true, phase }), phase).toBe(phase === 'map');
    }
    expect(worldTapAllowed({ alive: false, ready: true, phase: 'map' })).toBe(false);
    expect(worldTapAllowed({ alive: true, ready: false, phase: 'map' })).toBe(false);
  });
});

interface FakeTween {
  stopped: boolean;
  stop(): void;
}

describe('game-shell wiggle guard', () => {
  const setup = () => {
    const target = { angle: 0 };
    const log: string[] = [];
    const guard = new WiggleGuard<{ angle: number }>((t) => {
      t.angle = 0;
      log.push('restore');
    });
    const tweens: FakeTween[] = [];
    const run = () => {
      const tween: FakeTween = { stopped: false, stop() { this.stopped = true; } };
      tweens.push(tween);
      log.push('start');
      return tween;
    };
    return { target, log, guard, tweens, run };
  };

  it('[AC-19] a second tap stops the running wiggle and restores the rest angle before it starts the new one', () => {
    const { target, log, guard, tweens, run } = setup();
    guard.start(target, run);
    target.angle = 4; // mid-wiggle
    guard.start(target, run);
    expect(tweens[0].stopped).toBe(true);
    expect(tweens[1].stopped).toBe(false);
    expect(log).toEqual(['restore', 'start', 'restore', 'start']);
    expect(target.angle).toBe(0);
  });

  it('[AC-19] many quick taps leave exactly one running wiggle; finishing it clears the guard', () => {
    const { target, guard, tweens, run } = setup();
    for (let i = 0; i < 6; i++) guard.start(target, run);
    expect(tweens.filter((t) => !t.stopped)).toHaveLength(1);
    expect(guard.isRunning(target)).toBe(true);
    guard.finish(target);
    expect(guard.isRunning(target)).toBe(false);
  });

  it('[AC-19] wiggles of different targets do not stop each other', () => {
    const a = { angle: 0 };
    const b = { angle: 0 };
    const guard = new WiggleGuard<{ angle: number }>((t) => { t.angle = 0; });
    const tweens: FakeTween[] = [];
    const run = () => {
      const tween: FakeTween = { stopped: false, stop() { this.stopped = true; } };
      tweens.push(tween);
      return tween;
    };
    guard.start(a, run);
    guard.start(b, run);
    expect(tweens.map((t) => t.stopped)).toEqual([false, false]);
  });
});

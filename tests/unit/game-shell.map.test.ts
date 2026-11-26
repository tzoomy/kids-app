// Game shell map rules (docs/specs/game-shell.md): the map-phase tap guard and the non-stacking wiggle. Pure modules only.
import { describe, expect, it } from 'vitest';
import { WiggleGuard, worldTapAllowed } from '../../src/games/mysteryEgg/mapRules';
import { facingFor, friendRoute, polylineLength, pointAtDistance } from '../../src/games/mysteryEgg/walk';
import { FRIEND_HOMES, MAP_FRIENDS, WORLDS } from '../../src/games/mysteryEgg/worlds';
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

describe('game-shell friend facing', () => {
  it('[AC-21] a walking friend faces its heading (left flips, right and up or down keep the current side)', () => {
    expect(facingFor({ moving: true, angle: 0, current: 1 })).toBe(1);
    expect(facingFor({ moving: true, angle: Math.PI, current: 1 })).toBe(-1);
    expect(facingFor({ moving: true, angle: Math.PI * 0.9, current: 1 })).toBe(-1);
    // Walking straight up or down does not flip the friend back and forth.
    expect(facingFor({ moving: true, angle: -Math.PI / 2, current: -1 })).toBe(-1);
    expect(facingFor({ moving: true, angle: Math.PI / 2, current: 1 })).toBe(1);
    expect(facingFor({ moving: true, angle: 0.1, current: -1 })).toBe(1);
  });

  it('[AC-21] a friend that is not walking always faces the default side again, whatever it did before', () => {
    expect(facingFor({ moving: false, angle: Math.PI, current: -1 })).toBe(1);
    expect(facingFor({ moving: false, angle: 0, current: -1 })).toBe(1);
    expect(facingFor({ moving: false, angle: Math.PI, current: 1 })).toBe(1);
  });

  it('[AC-21] the walks to the left-hand worlds do flip a friend on the way, so the reset on arrival matters', () => {
    const w = WORLDS.find((x) => x.id === 'workshop');
    if (!w) throw new Error('no workshop');
    let facing: 1 | -1 = 1;
    let flipped = false;
    const route = friendRoute(FRIEND_HOMES[MAP_FRIENDS[0]], w);
    for (let d = 0; d <= polylineLength(route); d += 4) {
      facing = facingFor({ moving: true, angle: pointAtDistance(route, d).angle, current: facing });
      if (facing === -1) flipped = true;
    }
    expect(flipped).toBe(true);
    expect(facingFor({ moving: false, angle: 0, current: facing })).toBe(1);
  });
});

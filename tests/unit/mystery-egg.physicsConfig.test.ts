// Global Mystery Egg physics config (workshop v5.1 §1.2b): timeScale 1.25 + the Phaser-plugin resolver pin for every Matter engine.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { Machine, simulateRun, type MatterLib } from '../../src/games/mysteryEgg/machine';
import { FLOOR, PIT_WALL, RIGHT_WALL, SHELF, TABLE } from '../../src/games/mysteryEgg/layout';
import {
  MIN_CATCH_FLOOR,
  PHYSICS_TIME_SCALE,
  RESOLVER_PIN,
  applyPhysicsConfig,
  lookAheadPx,
  scriptedTimerSteps,
  withResolverPin,
} from '../../src/games/mysteryEgg/physicsConfig';

const Matter = MatterModule as unknown as MatterLib & { Resolver: Record<string, number> };

describe('mystery-egg physics config (v5.1 global speed rules)', () => {
  it('[AC-09] timeScale is 1.25 and the resolver pin is the Phaser plugin\'s values (not the library defaults)', () => {
    expect(PHYSICS_TIME_SCALE).toBe(1.25);
    expect(RESOLVER_PIN).toEqual({ _restingThresh: 4, _restingThreshTangent: 6, _positionDampen: 0.9, _positionWarming: 0.8, _frictionNormalMultiplier: 5 });
    expect(MIN_CATCH_FLOOR).toBe(20);
  });

  it('[AC-09] the v5.1 helpers: look-ahead is v x 1.25 and a scripted timer is divided by 1.25', () => {
    expect(lookAheadPx(8)).toBeCloseTo(10, 9);
    expect(lookAheadPx(-3)).toBe(0); // only a ball moving down needs the look-ahead
    expect(scriptedTimerSteps(100)).toBeCloseTo(80, 9);
  });

  it('[AC-09] applyPhysicsConfig sets engine.timing.timeScale', () => {
    const engine = Matter.Engine.create() as unknown as { timing: { timeScale: number } };
    expect(engine.timing.timeScale).toBe(1);
    applyPhysicsConfig(engine);
    expect(engine.timing.timeScale).toBe(1.25);
  });

  it('[AC-09] withResolverPin pins the constants during the call and restores the caller\'s afterwards (even on a throw)', () => {
    const R = Matter.Resolver;
    const saved = { ...R };
    withResolverPin(Matter, () => {
      for (const [k, v] of Object.entries(RESOLVER_PIN)) expect(R[k], k).toBe(v);
    });
    expect({ ...R }).toEqual(saved);
    expect(() => withResolverPin(Matter, () => { throw new Error('x'); })).toThrow('x');
    expect({ ...R }).toEqual(saved);
  });

  it('[AC-09] the mission 1.1 machine runs its engine at 1.25x and pins the resolver for every step', () => {
    const engine = Matter.Engine.create() as unknown as { world: unknown; timing: { timeScale: number } };
    const machine = new Machine(Matter, engine);
    expect(engine.timing.timeScale).toBe(1.25);
    machine.placeRamp();
    machine.launch();
    const seen: number[] = [];
    const R = Matter.Resolver;
    const before = R._restingThresh ?? 0;
    for (let i = 0; i < 5; i++) {
      machine.step();
      seen.push(R._restingThresh ?? 0);
    }
    expect(seen.every((v) => v === before)).toBe(true); // restored after every step
    machine.dispose();
  });

  it('[AC-09] mission 1.1 still wins with the ramp and fails without, at 1.25x with the pin (25 jittered starts)', () => {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        expect(simulateRun(Matter, { rampPlaced: true, ballOffset: { x: dx, y: dy } }).result, `offset ${dx},${dy}`).toEqual({ status: 'success' });
      }
    }
    expect(simulateRun(Matter, { rampPlaced: false }).result.status).toBe('fail');
  });

  it('[AC-09] catch-floor audit: every static of the mission 1.1 board is at least 20 px thick (no tunnelling at 1.25x)', () => {
    const statics = { SHELF, TABLE, RIGHT_WALL, FLOOR, PIT_WALL };
    for (const [name, s] of Object.entries(statics)) expect(Math.min(s.w, s.h), name).toBeGreaterThanOrEqual(MIN_CATCH_FLOOR);
  });
});

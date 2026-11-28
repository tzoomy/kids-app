// Shared Workshop lever (v5.1 §1.2, ONE spec for L13/L14/L15/L20): plank 160 x 10, density 0.001, pinned by a length-0
// constraint on a static post, rest 11 degrees left-up, counterweight r6 mass 1.2 on the right tip resting on a stop, a down-stop that
// limits the left arm to 30 degrees, trips at >= 10 degrees from the angle at the first run step.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { applyPhysicsConfig, withResolverPin } from '../../src/games/mysteryEgg/physicsConfig';
import { LEVER, createLever, leverGeometry, type LeverMatter } from '../../src/games/mysteryEgg/workshop/lever';

const M = MatterModule as unknown as LeverMatter & {
  Engine: { create(): { world: unknown; timing: { timeScale: number } }; update(e: unknown, d: number): void };
  Bodies: { circle(x: number, y: number, r: number, o?: object): { label: string; position: { x: number; y: number }; velocity: { x: number; y: number } } };
  Body: { setVelocity(b: unknown, v: { x: number; y: number }): void };
};
const STEP = 1000 / 60;
const PIVOT = { x: 1125, y: 548 };

function world() {
  const engine = M.Engine.create();
  applyPhysicsConfig(engine);
  const lever = createLever(M, engine.world, PIVOT);
  const step = (): void => withResolverPin(M as never, () => M.Engine.update(engine, STEP));
  return { engine, lever, step };
}

describe('workshop lever (shared spec)', () => {
  it('[AC-20] the spec numbers: 160 x 10, density 0.001, rest 11 deg, counterweight r6 mass 1.2, trip 10 deg, down-stop 30 deg', () => {
    expect(LEVER).toMatchObject({ length: 160, thickness: 10, density: 0.001, restDeg: 11, counterweightMass: 1.2, counterweightRadius: 6, tripDeg: 10, downStopDeg: 30 });
  });

  it('[AC-20] geometry for the L20 pivot (1125,548): tips, right stop under the counterweight, 30 degree down-stop', () => {
    const g = leverGeometry(PIVOT);
    expect(g.leftTip.x).toBeCloseTo(1046.5, 1);
    expect(g.leftTip.y).toBeCloseTo(532.7, 1);
    expect(g.rightTip.x).toBeCloseTo(1203.5, 1);
    expect(g.rightTip.y).toBeCloseTo(563.3, 1);
    expect(g.rightStop).toEqual({ x0: g.rightTip.x - 11, y0: g.rightTip.y + 5, x1: g.rightTip.x + 11, y1: g.rightTip.y + 15 });
    // 30 degrees of turn from the rest angle: the left arm points 19 degrees down-left of the pivot's level at the stop.
    expect(g.downStop.x1 - g.downStop.x0).toBe(16);
    expect(g.downStop.x0 + 8).toBeCloseTo(PIVOT.x - 80 * Math.cos((-19 * Math.PI) / 180), 6);
    expect(g.downStop.y0 - 5).toBeCloseTo(PIVOT.y - 80 * Math.sin((-19 * Math.PI) / 180), 6);
  });

  it('[AC-20] it stays within 1 degree of its rest angle during the 60 settle steps', () => {
    const { lever, step } = world();
    const a0 = lever.body.angle;
    let worst = 0;
    for (let i = 0; i < 60; i++) {
      step();
      worst = Math.max(worst, (Math.abs(lever.body.angle - a0) * 180) / Math.PI);
    }
    expect(worst).toBeLessThan(1);
    expect((a0 * 180) / Math.PI).toBeCloseTo(11, 3);
  });

  it('[AC-20] check() stays false while nothing touches it, and does not trip from the settle alone', () => {
    const { lever, step } = world();
    for (let i = 0; i < 60; i++) step();
    for (let i = 0; i < 120; i++) {
      step();
      expect(lever.check()).toBe(false);
    }
    expect(lever.tripped).toBe(false);
  });

  it('[AC-20] a heavy ball dropped on the left arm trips it once (>= 10 degrees from the first checked angle)', () => {
    const { engine, lever, step } = world();
    for (let i = 0; i < 60; i++) step();
    const ball = M.Bodies.circle(PIVOT.x - 60, PIVOT.y - 120, 30, { density: 0.004 });
    (M as unknown as { Composite: { add(w: unknown, b: unknown): void } }).Composite.add(engine.world, ball);
    let trippedAt = -1;
    let fired = 0;
    for (let i = 0; i < 240; i++) {
      if (lever.check()) {
        fired++;
        trippedAt = i;
      }
      step();
    }
    expect(fired).toBe(1);
    expect(trippedAt).toBeGreaterThan(5);
    expect(lever.tripped).toBe(true);
    expect(lever.deviationDeg).toBeGreaterThanOrEqual(10);
  });
});

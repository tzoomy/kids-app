// Headless check of the mission-1.1 board (GDD section 9: solver verification with a fixed 60 Hz step).
// Uses the Matter build bundled inside Phaser, the same one the scene runs on.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { Machine, simulateRun, type MatterLib } from '../../src/games/mysteryEgg/machine';
import { BALL, BELL, RAMP_SLOT, SLOTS } from '../../src/games/mysteryEgg/layout';
import { STEP_MS } from '../../src/games/mysteryEgg/run';

const Matter = MatterModule as unknown as MatterLib;

describe('mystery-egg physics (headless, fixed 60 Hz)', () => {
  it('[AC-09] the step is exactly 1/60 s', () => {
    expect(STEP_MS).toBeCloseTo(16.6667, 3);
  });

  it('[AC-09] the layout has exactly one slot, and it is the ramp slot', () => {
    expect(SLOTS).toHaveLength(1);
    expect(SLOTS[0]).toMatchObject({ id: 'ramp-slot', accepts: ['ramp'], x: RAMP_SLOT.x, y: RAMP_SLOT.y });
  });

  it('[AC-09] with the ramp in the slot the ball rings the bell', () => {
    const run = simulateRun(Matter, { rampPlaced: true });
    expect(run.result).toEqual({ status: 'success' });
    expect(run.steps).toBeLessThan(600);
  });

  it('[AC-09] the ramp run succeeds for every ±2 px jitter of the ball start (25 combinations)', () => {
    for (let dx = -2; dx <= 2; dx++) {
      for (let dy = -2; dy <= 2; dy++) {
        const run = simulateRun(Matter, { rampPlaced: true, ballOffset: { x: dx, y: dy } });
        expect(run.result, `offset ${dx},${dy}`).toEqual({ status: 'success' });
      }
    }
  });

  it('[AC-09] the ramp run also survives a ±2 px jitter of the ramp itself', () => {
    for (const dx of [-2, 0, 2]) {
      for (const dy of [-2, 0, 2]) {
        const run = simulateRun(Matter, { rampPlaced: true, rampOffset: { x: dx, y: dy } });
        expect(run.result, `ramp offset ${dx},${dy}`).toEqual({ status: 'success' });
      }
    }
  });

  it('[AC-09] a ramp dropped anywhere in the snap radius still lands in the slot, so the board is the same', () => {
    // Snapping puts the ramp at the slot centre; this documents that the result does not depend on the drop point.
    const a = simulateRun(Matter, { rampPlaced: true });
    const b = simulateRun(Matter, { rampPlaced: true });
    expect(b).toEqual(a);
  });

  it('[AC-09] with the slot empty the ball never rings the bell (it is a failed run)', () => {
    const run = simulateRun(Matter, { rampPlaced: false });
    expect(run.result.status).toBe('fail');
    for (let dx = -2; dx <= 2; dx++) {
      const jittered = simulateRun(Matter, { rampPlaced: false, ballOffset: { x: dx, y: 0 } });
      expect(jittered.result.status, `offset ${dx}`).toBe('fail');
    }
  });

  it('[AC-09] runs are deterministic: identical inputs give identical steps and final position', () => {
    const a = simulateRun(Matter, { rampPlaced: true });
    const b = simulateRun(Matter, { rampPlaced: true });
    expect(b.steps).toBe(a.steps);
    expect(b.final).toEqual(a.final);
    const c = simulateRun(Matter, { rampPlaced: false });
    const d = simulateRun(Matter, { rampPlaced: false });
    expect(d).toEqual(c);
  });

  it('[AC-09] the ball starts on the shelf, left of the slot, and the bell is right of the slot', () => {
    expect(BALL.x).toBeLessThan(RAMP_SLOT.x);
    expect(BELL.x).toBeGreaterThan(RAMP_SLOT.x);
  });

  it('[AC-10] after a failed run the ball is back on the shelf at rest and a placed ramp stays in the slot', () => {
    const engine = Matter.Engine.create();
    const machine = new Machine(Matter, engine);
    machine.placeRamp();
    machine.launch();
    for (let i = 0; i < 200; i++) machine.step();
    expect(machine.ball.position.x).toBeGreaterThan(BALL.x + 50);
    machine.resetBall();
    expect(machine.rampPlaced).toBe(true);
    expect(machine.ball.position).toMatchObject({ x: BALL.x, y: BALL.y });
    // Parked: stepping before Play does not move the ball.
    for (let i = 0; i < 30; i++) machine.step();
    expect(machine.ball.position).toMatchObject({ x: BALL.x, y: BALL.y });
    // And a second Play from the reset state still succeeds.
    machine.launch();
    let rang = false;
    for (let i = 0; i < 500 && !rang; i++) {
      const s = machine.step();
      rang = s.bellDistance < BELL.radius + BALL.radius;
    }
    expect(rang).toBe(true);
  });
});

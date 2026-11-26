// Headless check of the mission-1.1 board (GDD section 9: solver verification with a fixed 60 Hz step).
// Uses the Matter build bundled inside Phaser, the same one the scene runs on.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { Machine, simulateRun, type MatterLib } from '../../src/games/mysteryEgg/machine';
import * as layout from '../../src/games/mysteryEgg/layout';
import { BALL, BALL_ART_SCALE, BALL_ART_VISIBLE_1X, BELL, RAMP_POLY, RAMP_SLOT, SLOTS } from '../../src/games/mysteryEgg/layout';
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

  it('[AC-09] the ramp body is the wedge RAMP_POLY (display px relative to the slot centre), unrotated, and the plank is gone', () => {
    expect('RAMP_BODY' in layout).toBe(false);
    // Convex: all cross products of consecutive edges have the same sign.
    const n = RAMP_POLY.length;
    const cross = RAMP_POLY.map((p, i) => {
      const q = RAMP_POLY[(i + 1) % n];
      const r = RAMP_POLY[(i + 2) % n];
      return (q.x - p.x) * (r.y - q.y) - (q.y - p.y) * (r.x - q.x);
    });
    expect(cross.every((c) => c > 0) || cross.every((c) => c < 0)).toBe(true);

    const engine = Matter.Engine.create();
    const machine = new Machine(Matter, engine);
    machine.placeRamp();
    const world = machine.rampVertices();
    expect(world).toHaveLength(n);
    for (const p of RAMP_POLY) {
      const hit = world.some((v) => Math.abs(v.x - (RAMP_SLOT.x + p.x)) < 1e-6 && Math.abs(v.y - (RAMP_SLOT.y + p.y)) < 1e-6);
      expect(hit, `vertex ${p.x},${p.y}`).toBe(true);
    }
    // A jittered ramp moves rigidly.
    const engine2 = Matter.Engine.create();
    const m2 = new Machine(Matter, engine2);
    m2.placeRamp({ x: 2, y: -2 });
    expect(m2.rampVertices().some((v) => Math.abs(v.x - (RAMP_SLOT.x + RAMP_POLY[0].x + 2)) < 1e-6 && Math.abs(v.y - (RAMP_SLOT.y + RAMP_POLY[0].y - 2)) < 1e-6)).toBe(true);
  });

  it('[AC-09] the ramp run succeeds for every ±2 px ball jitter AND ±2 px ramp jitter combined (225 runs)', () => {
    let wins = 0;
    for (let bx = -2; bx <= 2; bx++) for (let by = -2; by <= 2; by++) for (let rx = -2; rx <= 2; rx += 2) for (let ry = -2; ry <= 2; ry += 2) {
      const run = simulateRun(Matter, { rampPlaced: true, ballOffset: { x: bx, y: by }, rampOffset: { x: rx, y: ry } });
      if (run.result.status === 'success') wins++;
    }
    expect(wins).toBe(225);
  });

  // ---- The ball must ride ON the painted ramp, not inside it (tablet feedback 2026-11-26) -------------------------------------

  it('[AC-22] the body top edge follows the painted top surface of part-ramp.webp within 3 px along its whole width', () => {
    const engine = Matter.Engine.create();
    const machine = new Machine(Matter, engine);
    machine.placeRamp();
    const world = machine.rampVertices();
    for (const [dx, artTop] of RAMP_ART_TOP) {
      const x = RAMP_SLOT.x + dx;
      const top = bodyTopAt(world, x);
      expect(top, `body has no surface at dx ${dx}`).not.toBeNull();
      expect(Math.abs((top as number) - (RAMP_SLOT.y + artTop)), `dx ${dx}: body top ${top} vs art top ${RAMP_SLOT.y + artTop}`).toBeLessThanOrEqual(3);
    }
  });

  it('[AC-22] a rolling ball touches the painted slope: its centre stays one ball radius (+-3 px) off the art surface line while it is on the ramp', () => {
    // The painted slope: least-squares line through the measured samples of the sloping part (dx -24..96).
    const slope = RAMP_ART_TOP.filter(([dx]) => dx >= -24);
    const n = slope.length;
    const mx = slope.reduce((a, [dx]) => a + dx, 0) / n;
    const my = slope.reduce((a, [, t]) => a + t, 0) / n;
    const b = slope.reduce((a, [dx, t]) => a + (dx - mx) * (t - my), 0) / slope.reduce((a, [dx]) => a + (dx - mx) ** 2, 0);
    const a0 = my - b * mx;
    const engine = Matter.Engine.create();
    const machine = new Machine(Matter, engine);
    machine.placeRamp();
    machine.launch();
    const distances: number[] = [];
    for (let i = 0; i < 400; i++) {
      const s = machine.step();
      const dx = s.x - RAMP_SLOT.x;
      const dy = s.y - RAMP_SLOT.y;
      if (dx >= 0 && dx <= 80) distances.push(((dy - (a0 + b * dx)) * -1) / Math.sqrt(1 + b * b)); // perpendicular distance above the line
    }
    expect(distances.length).toBeGreaterThan(5);
    const sorted = [...distances].sort((x, y) => x - y);
    const median = sorted[Math.floor(sorted.length / 2)];
    expect(Math.abs(median - BALL.radius)).toBeLessThanOrEqual(3);
    // It never sinks into the painted ramp: never closer than the radius minus 3 px.
    expect(Math.min(...distances)).toBeGreaterThanOrEqual(BALL.radius - 3);
  });

  it('[AC-22] the ball art is drawn so its VISIBLE disc has the physics diameter (the art has a transparent margin)', () => {
    expect(BALL_ART_VISIBLE_1X).toBe(59);
    expect(BALL_ART_SCALE * BALL_ART_VISIBLE_1X).toBeCloseTo(BALL.radius * 2, 6);
  });
});

/**
 * Top edge of the painted ramp (`public/art/mystery-egg/part-ramp.webp`, 480x280, drawn 240x140 centred on the slot at
 * scale 1): for each display x relative to the slot centre, the first opaque row (alpha >= 128) relative to the slot centre.
 * Measured with a throwaway script reading the file's alpha; re-measure when Gemini re-delivers the ramp art.
 */
const RAMP_ART_TOP: ReadonlyArray<readonly [number, number]> = [
  [-96, -46], [-88, -47.5], [-80, -49.5], [-72, -51], [-64, -53], [-56, -54.5], [-48, -56.5], [-40, -58], [-32, -59.5],
  [-24, -55.5], [-16, -50], [-8, -44.5], [0, -38.5], [8, -32.5], [16, -27], [24, -21], [32, -15], [40, -9.5], [48, -3.5],
  [56, 2], [64, 8], [72, 14], [80, 19.5], [88, 25.5], [96, 31.5],
];

/** The smallest y of the polygon along the vertical line at x (null when x is outside it). */
function bodyTopAt(poly: ReadonlyArray<{ x: number; y: number }>, x: number): number | null {
  let top: number | null = null;
  for (let i = 0; i < poly.length; i++) {
    const p = poly[i];
    const q = poly[(i + 1) % poly.length];
    if ((p.x - x) * (q.x - x) > 0 || p.x === q.x) continue;
    const y = p.y + ((q.y - p.y) * (x - p.x)) / (q.x - p.x);
    top = top === null ? y : Math.min(top, y);
  }
  return top;
}

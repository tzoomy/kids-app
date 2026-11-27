// Workshop L20 "Bonjour, Ville des Surprises !": headless physics (Phaser's bundled Matter, fixed 1/60 s step).
// Reference: the v4 simulator (design/v4-sim/l20.cjs, 50/50 on both valid sets). Spec: docs/specs/workshop-l20.md.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { DOMINO_SLOTS, FIXED_DOMINOES, L20_TIMEOUT_STEPS, type L20Config } from '../../src/games/mysteryEgg/workshop/l20Level';
import { L20World, simulateL20, type L20Matter } from '../../src/games/mysteryEgg/workshop/l20World';

const Matter = MatterModule as unknown as L20Matter;
const STEPS_PER_SECOND = 60;

const solution = (slots: number[]): L20Config => ({ ramp: 'down-right', slots, scissors: 'A' });

describe('workshop L20 physics', () => {
  it('[AC-01] the level data lists the strip slots and the fixed dominoes of the sim', () => {
    expect([...DOMINO_SLOTS]).toEqual([460, 500, 580, 620]);
    expect([...FIXED_DOMINOES]).toEqual([400, 540, 700, 780, 860, 940]);
    expect(L20_TIMEOUT_STEPS).toBe(16 * STEPS_PER_SECOND);
  });

  it('[AC-01] the valid set {460,620} + ramp down-right + scissors on A rings both bells with the right bodies', () => {
    const run = simulateL20(Matter, solution([460, 620]));
    const ids = run.events.map((e) => e.id);
    expect(ids).toContain('snip:A');
    expect(ids.some((id) => /^bell:coco:dom\d+$/.test(id))).toBe(true);
    expect(ids).toContain('bell:morning:seesaw');
    expect(ids).toContain('domino:540:fallen');
    expect(run.run).toMatchObject({ state: 'ended', result: 'win', reason: 'both-bells' });
    expect(run.run.endStep).toBeGreaterThan(0);
    expect(run.run.endStep).toBeLessThanOrEqual(L20_TIMEOUT_STEPS);
  });

  const VALID: Array<[string, number[]]> = [
    ['{460,620}', [460, 620]],
    ['{500,620}', [500, 620]],
  ];
  for (const [name, slots] of VALID) {
    it(`[AC-01] ${name} + ramp down-right + scissors A: both bells within 11.5 s in at least 95% of 10 jittered runs (+-2 px)`, () => {
      let wins = 0;
      for (let seed = 1; seed <= 10; seed++) {
        const run = simulateL20(Matter, solution(slots), { seed, jitter: 2 });
        const coco = run.events.find((e) => /^bell:coco:dom\d+$/.test(e.id));
        const morning = run.events.find((e) => e.id === 'bell:morning:seesaw');
        if (coco && morning && Math.max(coco.step, morning.step) <= 11.5 * STEPS_PER_SECOND) wins++;
      }
      expect(wins / 10).toBeGreaterThanOrEqual(0.95);
    });
  }

  it('[AC-01] the morning bell rings first (about 1 s) and Coco\'s bell at about 7 s, like the sim', () => {
    const run = simulateL20(Matter, solution([460, 620]));
    const morning = run.events.find((e) => e.id === 'bell:morning:seesaw')!;
    const coco = run.events.find((e) => e.id.startsWith('bell:coco:'))!;
    expect(morning.step / STEPS_PER_SECOND).toBeLessThan(3);
    expect(coco.step / STEPS_PER_SECOND).toBeGreaterThan(5);
    expect(coco.step / STEPS_PER_SECOND).toBeLessThan(9);
  });

  const WRONG: Array<[string, L20Config]> = [
    ['dominoes {460,500}', solution([460, 500])],
    ['dominoes {580,620}', solution([580, 620])],
    ['dominoes {500,580}', solution([500, 580])],
    ['dominoes {460,580}', solution([460, 580])],
    ['ramp down-left', { ramp: 'down-left', slots: [460, 620], scissors: 'A' }],
    ['no ramp', { ramp: 'none', slots: [460, 620], scissors: 'A' }],
    ['scissors on B', { ramp: 'down-right', slots: [460, 620], scissors: 'B' }],
    ['no scissors', { ramp: 'down-right', slots: [460, 620], scissors: 'none' }],
    ['empty board', { ramp: 'none', slots: [], scissors: 'none' }],
  ];
  for (const [name, config] of WRONG) {
    it(`[AC-02] ${name}: never both bells (4 jittered runs)`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const run = simulateL20(Matter, config, { seed, jitter: 2 });
        expect(run.run.result, `${name} seed ${seed}`).toBe('fail');
        const ids = run.events.map((e) => e.id);
        const both = ids.some((id) => id.startsWith('bell:coco:dom')) && ids.includes('bell:morning:seesaw');
        expect(both, `${name} seed ${seed}`).toBe(false);
      }
    });
  }

  it('[AC-02] scissors on B cut the lantern: the morning bell stays silent and the lantern falls', () => {
    const run = simulateL20(Matter, { ramp: 'down-right', slots: [460, 620], scissors: 'B' });
    const ids = run.events.map((e) => e.id);
    expect(ids).toContain('snip:B');
    expect(ids).not.toContain('bell:morning:seesaw');
    expect(ids.some((id) => id.startsWith('bell:coco:dom'))).toBe(true);
    expect(run.run).toMatchObject({ result: 'fail', reason: 'coco-only' });
  });

  it('[AC-02] the failure reasons name which bell rang (none, one of them)', () => {
    expect(simulateL20(Matter, { ramp: 'none', slots: [], scissors: 'none' }).run.reason).toBe('no-bell');
    expect(simulateL20(Matter, { ramp: 'none', slots: [460, 620], scissors: 'A' }).run.reason).toBe('morning-only');
  });

  it('[AC-01] each Play is a fresh engine: the same config twice gives the identical event list', () => {
    const a = simulateL20(Matter, solution([460, 620]));
    const b = simulateL20(Matter, solution([460, 620]));
    expect(b.events).toEqual(a.events);
    expect(b.run).toEqual(a.run);
  });

  it('[AC-01] the world exposes the bodies the scene draws, and bells ring once only', () => {
    const world = new L20World(Matter, solution([460, 620]));
    expect(world.bodies.dominoes.map((d) => d.label).sort()).toEqual(
      ['dom400', 'dom460', 'dom540', 'dom620', 'dom700', 'dom780', 'dom860', 'dom940'].sort(),
    );
    expect(world.bodies.ball).toBeNull();
    world.cut();
    world.release();
    expect(world.bodies.ball?.position.x).toBeCloseTo(200, 5);
    expect(world.bodies.ball?.position.y).toBeCloseTo(95, 5);
    while (world.run.state === 'running') world.step();
    const bellEvents = world.events.filter((e) => e.id.startsWith('bell:'));
    expect(bellEvents).toHaveLength(2);
  });
});

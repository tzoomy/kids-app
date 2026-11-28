// Workshop L20 "Bonjour, Ville des Surprises !" v5.1: headless physics (Phaser's bundled Matter, fixed 1/60 s step, timeScale 1.25,
// the Phaser-plugin resolver pin). Reference: workshop-v5-notes sim/levels.cjs X.L20 (50/50 on both valid sets).
// ONE chain: drop -> ramp -> cup -> dominoes -> (Coco's small bell, cosmetic) -> lever -> cord -> scissors -> sandbag -> seesaw -> morning bell.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import { DOMINO_SLOTS, FIXED_DOMINOES, L20_TIMEOUT_STEPS, LEVER_PIVOT, LEDGE, TABLE, POST, CORD, type L20Config } from '../../src/games/mysteryEgg/workshop/l20Level';
import { L20World, simulateL20, type L20Matter } from '../../src/games/mysteryEgg/workshop/l20World';
import { PHYSICS_TIME_SCALE, RESOLVER_PIN } from '../../src/games/mysteryEgg/physicsConfig';

const Matter = MatterModule as unknown as L20Matter;
const STEPS_PER_SECOND = 60;

const solution = (slots: number[]): L20Config => ({ ramp: 'down-right', slots, scissors: 'A' });
const idsOf = (run: { events: { id: string }[] }): string[] => run.events.map((e) => e.id);
const stepOf = (run: { events: { id: string; step: number }[] }, re: RegExp): number => run.events.find((e) => re.test(e.id))?.step ?? -1;

describe('workshop L20 v5.1 physics', () => {
  it('[AC-01] the level data: strip slots, fixed dominoes, the lever pivot (1125,548), the table to x 1150 and the ledge x 1150-1228', () => {
    expect([...DOMINO_SLOTS]).toEqual([460, 500, 580, 620]);
    expect([...FIXED_DOMINOES]).toEqual([400, 540, 710, 780, 860, 940]);
    expect(L20_TIMEOUT_STEPS).toBe(16 * STEPS_PER_SECOND);
    expect(LEVER_PIVOT).toEqual({ x: 1125, y: 548 });
    expect(TABLE).toMatchObject({ x0: 390, x1: 1150, y0: 560, y1: 584 });
    expect(LEDGE).toMatchObject({ x0: 1150, x1: 1228, top: 408 });
    expect(POST).toEqual({ x0: 1119, y0: 558, x1: 1131, y1: 560 });
    expect(CORD.P0).toEqual({ x: 1238, y: 688 });
    expect(CORD.P1).toEqual({ x: 1244, y: 72 });
    expect(CORD.P2).toEqual({ x: 896, y: 72 });
    expect(CORD.handle).toEqual({ x: 880, y: 98 });
  });

  it('[AC-01] the engine runs at timeScale 1.25 (the global v5.1 speed)', () => {
    expect(PHYSICS_TIME_SCALE).toBe(1.25);
    expect(new L20World(Matter, solution([460, 620])).engine.timing.timeScale).toBe(1.25);
  });

  it('[AC-01] the valid set {460,620} + ramp down-right + scissors A: coco -> lever:tripped -> snip:A -> goal:morning, one goal, a win', () => {
    const run = simulateL20(Matter, solution([460, 620]));
    const ids = idsOf(run);
    expect(ids.some((id) => /^bell:coco:dom\d+$/.test(id))).toBe(true);
    expect(ids).toContain('lever:tripped');
    expect(ids).toContain('snip:A');
    expect(ids).toContain('goal:morning');
    expect(ids.filter((id) => id.startsWith('goal:'))).toEqual(['goal:morning']);
    const coco = stepOf(run, /^bell:coco:/);
    const tripped = stepOf(run, /^lever:tripped$/);
    const snip = stepOf(run, /^snip:A$/);
    const morning = stepOf(run, /^goal:morning$/);
    expect(coco).toBeLessThanOrEqual(tripped);
    expect(tripped).toBeLessThanOrEqual(snip);
    expect(snip).toBeLessThan(morning);
    // The event order in the list is the order of the chain.
    const order = ['bell:coco:', 'lever:tripped', 'snip:A', 'goal:morning'].map((p) => ids.findIndex((id) => id.startsWith(p)));
    expect(order).toEqual([...order].sort((a, b) => a - b));
    expect(order.every((i) => i >= 0)).toBe(true);
    expect(ids).toContain('domino:540:fallen');
    expect(run.run).toMatchObject({ state: 'ended', result: 'win', reason: 'goal' });
    expect(run.run.endStep).toBeLessThanOrEqual(L20_TIMEOUT_STEPS);
  });

  it('[AC-05] no snip at Play: nothing is cut during the settle or at the release; the snip comes with the lever trip, never before step 1', () => {
    const world = new L20World(Matter, solution([460, 620]));
    expect(world.events).toEqual([]);
    expect((world as unknown as { cut?: unknown }).cut).toBeUndefined();
    world.release();
    expect(world.events).toEqual([]);
    expect(world.snipped).toBeNull();
    while (world.step());
    expect(world.snipped).toBe('A');
    expect(stepOf(world, /^snip:A$/)).toBeGreaterThan(60);
  });

  it('[AC-05] with the ramp missing the lever is never hit: no lever:tripped, no snip, no goal (even with the scissors on A)', () => {
    const run = simulateL20(Matter, { ramp: 'none', slots: [460, 620], scissors: 'A' });
    expect(idsOf(run)).not.toContain('lever:tripped');
    expect(idsOf(run).some((id) => id.startsWith('snip:'))).toBe(false);
    expect(run.run).toMatchObject({ result: 'fail', reason: 'lever-not-hit' });
  });

  it('[AC-05] no scissors: the cord pulls an empty hook (only lever:tripped), nothing is cut and no goal', () => {
    const run = simulateL20(Matter, { ramp: 'down-right', slots: [460, 620], scissors: 'none' });
    const ids = idsOf(run);
    expect(ids).toContain('lever:tripped');
    expect(ids.some((id) => id.startsWith('snip:'))).toBe(false);
    expect(ids).not.toContain('goal:morning');
    expect(run.run).toMatchObject({ result: 'fail', reason: 'empty-hook' });
  });

  it('[AC-02] scissors on B: the lever trips, the lantern string is cut and the lantern falls onto the table; no goal', () => {
    const run = simulateL20(Matter, { ramp: 'down-right', slots: [460, 620], scissors: 'B' });
    const ids = idsOf(run);
    expect(ids).toContain('lever:tripped');
    expect(ids).toContain('snip:B');
    expect(ids).toContain('lantern:floor');
    expect(ids).not.toContain('goal:morning');
    expect(run.run).toMatchObject({ result: 'fail', reason: 'wrong-string' });
  });

  it('[AC-02] the lantern lands on the table (about y 536) and is not tunnelled through it', () => {
    const world = new L20World(Matter, { ramp: 'down-right', slots: [460, 620], scissors: 'B' });
    world.release();
    let maxY = 0;
    while (world.step()) maxY = Math.max(maxY, world.bodies.lantern.position.y);
    expect(world.bodies.lantern.position.y).toBeGreaterThan(500);
    expect(world.bodies.lantern.position.y).toBeLessThan(560);
    expect(maxY).toBeLessThan(560);
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
    it(`[AC-02] ${name}: never the goal (4 jittered runs)`, () => {
      for (let seed = 1; seed <= 4; seed++) {
        const run = simulateL20(Matter, config, { seed, jitter: 2 });
        expect(run.run.result, `${name} seed ${seed}`).toBe('fail');
        expect(idsOf(run), `${name} seed ${seed}`).not.toContain('goal:morning');
      }
    });
  }

  it('[AC-02] a wrong domino pair stops the row: no small bell, no lever:tripped', () => {
    for (const slots of [[460, 500], [500, 580], [460, 580], [580, 620]]) {
      const run = simulateL20(Matter, solution(slots), { seed: 3, jitter: 2 });
      expect(idsOf(run), `${slots}`).not.toContain('lever:tripped');
      expect(run.run.reason, `${slots}`).toBe('lever-not-hit');
    }
  });

  it('[AC-01] the lever never rings Coco\'s bell (its left tip stays below the sensor) and holds still during the 60 settle steps', () => {
    for (let seed = 1; seed <= 6; seed++) {
      const world = new L20World(Matter, solution([460, 620]), { seed, jitter: 2 });
      const rest = (11 * Math.PI) / 180;
      expect(Math.abs(world.bodies.lever.angle - rest) * (180 / Math.PI), `seed ${seed}`).toBeLessThan(1);
      world.release();
      while (world.step());
      expect(world.events.map((e) => e.id), `seed ${seed}`).not.toContain('bell:coco:lever');
    }
  });

  it('[AC-01] each Play is a fresh engine: the same config twice gives the identical event list', () => {
    const a = simulateL20(Matter, solution([460, 620]));
    const b = simulateL20(Matter, solution([460, 620]));
    expect(b.events).toEqual(a.events);
    expect(b.run).toEqual(a.run);
  });

  it('[AC-01] the world exposes the bodies the scene draws; the ball starts at the chute', () => {
    const world = new L20World(Matter, solution([460, 620]));
    expect(world.bodies.dominoes.map((d) => d.label).sort()).toEqual(['dom400', 'dom460', 'dom540', 'dom620', 'dom710', 'dom780', 'dom860', 'dom940'].sort());
    expect(world.bodies.ball).toBeNull();
    expect(world.bodies.lever.label).toBe('lever');
    world.release();
    expect(world.bodies.ball?.position.x).toBeCloseTo(200, 5);
    expect(world.bodies.ball?.position.y).toBeCloseTo(95, 5);
  });

  // Phaser's MatterPhysics plugin overwrites the GLOBAL Resolver constants when any Matter scene exists; the world pins its own
  // for every step, so a run under the library defaults equals a run under the plugin's values (live == headless == sim).
  describe('[AC-02] independent of the global Resolver constants', () => {
    type Resolver = Record<keyof typeof RESOLVER_PIN, number>;
    const R = (Matter as unknown as { Resolver: Resolver }).Resolver;
    const withValues = <T>(values: Partial<Resolver>, fn: () => T): T => {
      const saved = { ...R };
      Object.assign(R, values);
      try {
        return fn();
      } finally {
        Object.assign(R, saved);
      }
    };
    const LIBRARY_DEFAULTS = { _restingThresh: 2, _restingThreshTangent: Math.sqrt(6) };

    it('the pin is the plugin\'s values (4 / 6 / 0.9 / 0.8 / 5), not the v4 library defaults', () => {
      expect({ ...RESOLVER_PIN }).toEqual({ _restingThresh: 4, _restingThreshTangent: 6, _positionDampen: 0.9, _positionWarming: 0.8, _frictionNormalMultiplier: 5 });
    });

    it('both valid sets and {500,580} give the same events under the library defaults as under the plugin values', () => {
      for (const slots of [[460, 620], [500, 620], [500, 580]]) {
        const plugin = withValues({ ...RESOLVER_PIN }, () => simulateL20(Matter, solution(slots)));
        const defaults = withValues(LIBRARY_DEFAULTS, () => simulateL20(Matter, solution(slots)));
        expect(defaults.events, `${slots}`).toEqual(plugin.events);
        expect(defaults.run, `${slots}`).toEqual(plugin.run);
      }
    });

    it('does not leak: the caller\'s global constants are restored after a run', () => {
      withValues(LIBRARY_DEFAULTS, () => {
        simulateL20(Matter, solution([460, 620]));
        expect(R._restingThresh).toBe(2);
        expect(R._restingThreshTangent).toBeCloseTo(Math.sqrt(6), 9);
      });
    });
  });

  it('[AC-02] {500,580}: never wins in 10 jittered seeds, and the fixed domino after the gap is never touched hard (maxAngle < 0.3 rad)', () => {
    // The fallen 580 (domino 110 px) reaches x 690; the fixed domino stands at 710 (left face 700), so the row stops with a gap.
    let worst = 0;
    for (let seed = 1; seed <= 10; seed++) {
      const world = new L20World(Matter, solution([500, 580]), { seed, jitter: 2 });
      world.release();
      const fixed = world.bodies.dominoes.find((d) => d.label === 'dom710')!;
      while (world.step()) worst = Math.max(worst, Math.abs(fixed.angle));
      expect(world.run, `seed ${seed}`).toMatchObject({ result: 'fail', reason: 'lever-not-hit' });
      expect(world.events.map((e) => e.id), `seed ${seed}`).not.toContain('domino:710:fallen');
    }
    expect(worst).toBeLessThan(0.3);
  });
});

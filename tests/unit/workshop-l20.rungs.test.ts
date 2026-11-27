// Workshop L20 hint rungs 4-6 (trajectory, ghost part, Bip places one part) and the break-point marker (v4 §1.8; docs/specs/workshop-l20.md
// AC-13, AC-14, AC-15, AC-17). Pure, no Phaser.
import { describe, expect, it } from 'vitest';
import { nextNeeded, partsFromConfig, planFailure, rungFor, type FailInput, type PartState } from '../../src/games/mysteryEgg/workshop/l20Hints';
import { chooseBreakPoint } from '../../src/games/mysteryEgg/workshop/l20BreakPoint';

const part = (id: string, kind: PartState['kind'], socketId: string | null, flipped = false): PartState => ({ id, kind, socketId, flipped });
const tray = (): PartState[] => [part('ramp', 'ramp', null), part('domino1', 'domino', null), part('domino2', 'domino', null), part('scissors', 'scissors', null)];
const withPlaced = (over: Record<string, [string | null, boolean?]>): PartState[] =>
  tray().map((p) => (over[p.id] ? { ...p, socketId: over[p.id][0], flipped: over[p.id][1] ?? false } : p));

describe('workshop L20 ladder: which rung at which fail count', () => {
  it('[AC-13] [AC-14] [AC-17] ladder step = the fail count up to 6 (3 glow, 4 trajectory, 5 ghost, 6 Bip places one part)', () => {
    expect([0, 1, 2, 3, 4, 5, 6, 7, 9].map(rungFor)).toEqual([0, 1, 2, 3, 4, 5, 6, 6, 6]);
  });
});

describe('workshop L20 ladder: the next needed part', () => {
  it('[AC-13] an empty board needs the ramp, down-right, in R1 first', () => {
    expect(nextNeeded(tray())).toEqual({ partId: 'ramp', kind: 'ramp', socketId: 'R1', orientation: 'down-right', fromSocketId: null });
  });

  it('[AC-13] a flipped ramp in R1 is the next fix (same socket, turned down-right)', () => {
    const n = nextNeeded(withPlaced({ ramp: ['R1', true] }));
    expect(n).toMatchObject({ partId: 'ramp', socketId: 'R1', orientation: 'down-right', fromSocketId: 'R1' });
  });

  it('[AC-13] then the scissors on string A, from the tray or from string B', () => {
    expect(nextNeeded(withPlaced({ ramp: ['R1'] }))).toMatchObject({ partId: 'scissors', socketId: 'string-A', orientation: 'upright', fromSocketId: null });
    expect(nextNeeded(withPlaced({ ramp: ['R1'], scissors: ['string-B'] }))).toMatchObject({ partId: 'scissors', socketId: 'string-A', fromSocketId: 'string-B' });
  });

  it('[AC-13] then a domino slot that completes {460,620} or {500,620} given what is placed', () => {
    const base = { ramp: ['R1'], scissors: ['string-A'] } as Record<string, [string | null, boolean?]>;
    const slot = (extra: Record<string, [string | null]>): string | undefined => nextNeeded(withPlaced({ ...base, ...extra }))?.socketId;
    expect(slot({})).toBe('slot-460');
    expect(slot({ domino1: ['slot-620'] })).toBe('slot-460');
    expect(slot({ domino1: ['slot-460'] })).toBe('slot-620');
    expect(slot({ domino1: ['slot-500'] })).toBe('slot-620');
    expect(slot({ domino1: ['slot-460'], domino2: ['slot-500'] })).toBe('slot-620');
    expect(slot({ domino1: ['slot-500'], domino2: ['slot-580'] })).toBe('slot-620');
    expect(slot({ domino1: ['slot-460'], domino2: ['slot-580'] })).toBe('slot-620');
    expect(slot({ domino1: ['slot-580'], domino2: ['slot-620'] })).toBe('slot-460');
  });

  it('[AC-13] a domino from the tray is used before one frees a wrong slot; with the tray empty a wrong slot is freed', () => {
    const base = { ramp: ['R1'], scissors: ['string-A'] } as Record<string, [string | null, boolean?]>;
    expect(nextNeeded(withPlaced({ ...base, domino1: ['slot-580'] }))).toMatchObject({ partId: 'domino2', socketId: 'slot-460', fromSocketId: null });
    expect(nextNeeded(withPlaced({ ...base, domino1: ['slot-580'], domino2: ['slot-500'] }))).toMatchObject({ partId: 'domino1', socketId: 'slot-620', fromSocketId: 'slot-580' });
    expect(nextNeeded(withPlaced({ ...base, domino1: ['slot-460'], domino2: ['slot-500'] }))).toMatchObject({ partId: 'domino2', socketId: 'slot-620', fromSocketId: 'slot-500' });
  });

  it('[AC-13] nothing left to fix: null for both valid solutions', () => {
    const base = { ramp: ['R1'], scissors: ['string-A'] } as Record<string, [string | null, boolean?]>;
    expect(nextNeeded(withPlaced({ ...base, domino1: ['slot-460'], domino2: ['slot-620'] }))).toBeNull();
    expect(nextNeeded(withPlaced({ ...base, domino1: ['slot-620'], domino2: ['slot-500'] }))).toBeNull();
  });

  it('[AC-13] partsFromConfig gives the same answer as the placements it describes', () => {
    expect(nextNeeded(partsFromConfig({ ramp: 'none', slots: [], scissors: 'none' }))?.socketId).toBe('R1');
    expect(nextNeeded(partsFromConfig({ ramp: 'down-right', slots: [460, 500], scissors: 'A' }))?.socketId).toBe('slot-620');
  });
});

describe('workshop L20 ladder: what each failure plans', () => {
  const emptyInput: FailInput = { failedRuns: 1, oneBellFails: 0, reason: 'no-bell', dominoRowStopped: false, config: { ramp: 'none', slots: [], scissors: 'none' } };
  const plan = (n: number, over: Partial<FailInput> = {}) => planFailure({ ...emptyInput, failedRuns: n, ...over });

  it('[AC-17] 4th failure: the trajectory only (beep, no new voice line), no ghost, Bip places nothing', () => {
    const p = plan(4);
    expect(p.rung).toBe(4);
    expect(p.trajectory).toBe(true);
    expect(p.trajectorySfx).toBe('sfx-robot-beep-1');
    expect(p.ghost).toBeNull();
    expect(p.bip).toBeNull();
    expect(p.voices).not.toContain('vo-fr-robot-regarde');
    expect(p.voices).not.toContain('vo-fr-robot-aide');
    expect(p.voices).not.toContain('vo-he-robot-help-2');
  });

  it('[AC-13] 5th failure: the ghost of the next part, "Regarde ici !", the trajectory stays on, Bip places nothing', () => {
    const p = plan(5);
    expect(p.rung).toBe(5);
    expect(p.trajectory).toBe(true);
    expect(p.trajectorySfx).toBeNull();
    expect(p.ghost).toEqual({ partId: 'ramp', kind: 'ramp', socketId: 'R1', orientation: 'down-right', fromSocketId: null });
    expect(p.bip).toBeNull();
    expect(p.voices).toContain('vo-fr-robot-regarde');
    expect(p.voices).not.toContain('vo-fr-robot-aide');
  });

  it('[AC-14] 6th and later failures: Bip places exactly ONE part, "Je t\'aide un peu !" + beep, no ghost, the trajectory stays on', () => {
    for (const n of [6, 7, 12]) {
      const p = plan(n);
      expect(p.rung).toBe(6);
      expect(p.trajectory).toBe(true);
      expect(p.bip).toMatchObject({ partId: 'ramp', socketId: 'R1' });
      expect(p.ghost).toBeNull();
      expect(p.bipSfx).toBe('sfx-robot-beep-1');
      expect(p.trajectorySfx).toBeNull();
      expect(p.voices).toContain('vo-fr-robot-aide');
      expect(p.voices).not.toContain('vo-fr-robot-regarde');
    }
  });

  it('[AC-17] the "Regarde ici !" line is never used twice in a row across the ladder (4th beep only, 5th speaks it)', () => {
    const lines = [4, 5, 6].map((n) => plan(n).voices.filter((v) => v === 'vo-fr-robot-regarde').length);
    expect(lines).toEqual([0, 1, 0]);
  });

  it('[AC-14] rung 6 never needs the child to press Play: the plan only names a part to place', () => {
    const p = plan(6);
    expect(Object.keys(p)).not.toContain('play');
  });

  it('[AC-13] [AC-14] [AC-17] before the trajectory nothing is shown or placed; with nothing left to fix the ghost and Bip do nothing', () => {
    for (const n of [1, 2, 3]) {
      expect(plan(n).trajectory).toBe(false);
      expect(plan(n).trajectorySfx).toBeNull();
      expect(plan(n).ghost).toBeNull();
      expect(plan(n).bip).toBeNull();
    }
    const solved = { ramp: 'down-right' as const, slots: [460, 620], scissors: 'A' as const };
    for (const n of [5, 6]) {
      const p = plan(n, { config: solved });
      expect(p.ghost).toBeNull();
      expect(p.bip).toBeNull();
      expect(p.voices).not.toContain('vo-fr-robot-regarde');
      expect(p.voices).not.toContain('vo-fr-robot-aide');
    }
  });

  it('[AC-14] rung 6 over many partial setups places one part toward a valid solution until it is complete', () => {
    // Simulate a child who fails over and over without touching the board: Bip fixes one thing per failure.
    let parts = tray();
    const order: string[] = [];
    for (let guard = 0; guard < 8; guard++) {
      const n = nextNeeded(parts);
      if (!n) break;
      order.push(`${n.partId}->${n.socketId}`);
      parts = parts.map((p) => (p.id === n.partId ? { ...p, socketId: n.socketId, flipped: false } : p));
    }
    expect(order).toEqual(['ramp->R1', 'scissors->string-A', 'domino1->slot-460', 'domino2->slot-620']);
    expect(nextNeeded(parts)).toBeNull();
  });
});

describe('workshop L20 break-point marker', () => {
  const dom = (...xs: number[]) => xs.map((x, i) => ({ id: `domino:${x}:fallen`, step: 100 + i }));
  const solved = { ramp: 'down-right' as const, slots: [460, 620], scissors: 'A' as const };

  it('[AC-15] the ball missed the ramp / rolled the wrong way / nothing happened: the R1 socket', () => {
    expect(chooseBreakPoint({ reason: 'no-bell', events: [], config: { ramp: 'none', slots: [], scissors: 'none' } })).toMatchObject({ kind: 'ramp', x: 200, y: 440 });
    expect(chooseBreakPoint({ reason: 'morning-only', events: [], config: { ...solved, ramp: 'down-left' } })).toMatchObject({ kind: 'ramp', x: 200, y: 440 });
    expect(chooseBreakPoint({ reason: 'morning-only', events: [], config: solved })).toMatchObject({ kind: 'ramp' });
  });

  it('[AC-15] the domino row stopped: the centre of the gap between the last fallen and the first standing domino', () => {
    // Slots {500,580}: the row 400, 500, 540, 580 falls, 710 stands -> the gap between 580 and 710.
    const bp = chooseBreakPoint({ reason: 'no-bell', events: dom(400, 500, 540, 580), config: { ramp: 'down-right', slots: [500, 580], scissors: 'none' } });
    expect(bp).toMatchObject({ kind: 'domino-gap', x: 645 });
    // Slots {460,500}: the row 400, 460, 500, 540 falls, then a hole 540 -> 710.
    expect(chooseBreakPoint({ reason: 'morning-only', events: dom(400, 460, 500, 540), config: { ramp: 'down-right', slots: [460, 500], scissors: 'A' } })).toMatchObject({ kind: 'domino-gap', x: 625 });
    // Only the first fixed domino fell: the gap right after it (400 -> 540, no slot used).
    expect(chooseBreakPoint({ reason: 'no-bell', events: dom(400), config: { ramp: 'down-right', slots: [], scissors: 'none' } })).toMatchObject({ kind: 'domino-gap', x: 470 });
  });

  it('[AC-15] the gap uses only the dominoes that exist (placed slots + fixed), and counts the leading run of fallen ones', () => {
    const bp = chooseBreakPoint({ reason: 'no-bell', events: dom(400, 540), config: { ramp: 'down-right', slots: [580, 620], scissors: 'none' } });
    // 400 fell, 540 fell, 580 stands: the gap is between 540 and 580.
    expect(bp).toMatchObject({ kind: 'domino-gap', x: 560 });
  });

  it('[AC-15] Coco rang but the morning bell did not: the string socket A', () => {
    expect(chooseBreakPoint({ reason: 'coco-only', events: dom(400, 460, 540, 620, 710, 780, 860, 940), config: { ...solved, scissors: 'B' } })).toMatchObject({ kind: 'string', x: 860, y: 110 });
    expect(chooseBreakPoint({ reason: 'coco-only', events: [], config: { ...solved, scissors: 'none' } })).toMatchObject({ kind: 'string' });
  });

  it('[AC-15] a win has no break point', () => {
    expect(chooseBreakPoint({ reason: 'both-bells', events: [], config: solved })).toBeNull();
  });
});

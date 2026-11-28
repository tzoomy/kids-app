// Workshop L20 failure feedback and hint ladder (v4 §1.8; docs/specs/workshop-l20.md AC-07, AC-09). Pure, no Phaser.
import { describe, expect, it } from 'vitest';
import { EAR_LINE, planFailure, type FailInput } from '../../src/games/mysteryEgg/workshop/l20Hints';

const base: FailInput = {
  failedRuns: 1,
  oneBellFails: 0,
  cocoRang: false,
  reason: 'lever-not-hit',
  dominoRowStopped: false,
  config: { ramp: 'down-right', slots: [460, 620], scissors: 'A' },
};
const plan = (over: Partial<FailInput>) => planFailure({ ...base, ...over });

describe('workshop L20 failure feedback (no buzzer, ever)', () => {
  it('[AC-07] the small bell stirred the friends but the chain failed: they fall asleep again, the capybara rings an imaginary bell, a yawn, and the Moustache gag', () => {
    const p = plan({ reason: 'wrong-string', cocoRang: true, oneBellFails: 1, config: { ramp: 'down-right', slots: [460, 620], scissors: 'B' } });
    expect(p.feedback).toMatchObject({ kind: 'one-bell', capybara: 'ring', sfx: 'sfx-ws-yawn', voice: 'vo-fr-ws-l20-one-bell' });
    // Only Coco's small bell stirs anyone mid-chain (cosmetic): the morning bell rings only on the win, which has no failure feedback.
    expect(p.feedback.sleepersFallAsleep).toEqual(['moustache', 'bruno', 'cocopom']);
  });

  it('[AC-07] the second one-bell failure says "Presque !" instead (alternating with the gag)', () => {
    expect(plan({ reason: 'empty-hook', cocoRang: true, oneBellFails: 2 }).feedback.voice).toBe('vo-fr-presque');
    expect(plan({ reason: 'empty-hook', cocoRang: true, oneBellFails: 3 }).feedback.voice).toBe('vo-fr-ws-l20-one-bell');
  });

  it('[AC-07] the small bell never rang: nobody woke, the capybara mimes (facepalm), no yawn, no buzzer sound anywhere', () => {
    const p = plan({ reason: 'lever-not-hit' });
    expect(p.feedback).toMatchObject({ kind: 'no-bell', capybara: 'facepalm', sfx: null, voice: null });
    expect(p.feedback.sleepersFallAsleep).toEqual([]);
    for (const x of [p.feedback.sfx, ...p.voices]) expect(String(x)).not.toMatch(/buzz|wrong|error|fail/i);
  });
});

describe('workshop L20 hint ladder', () => {
  it('[AC-09] the ear button always plays the goal hint', () => {
    expect(EAR_LINE).toBe('vo-he-ws-l20-goal');
  });

  it('[AC-09] 1st failure: a targeted hint only (the lever tripped but no goal -> which string; domino row stopped -> no big hole; nothing happened -> none)', () => {
    for (const reason of ['wrong-string', 'empty-hook', 'no-goal'] as const) {
      expect(plan({ failedRuns: 1, reason, cocoRang: true }).hint, reason).toEqual({ lineId: 'vo-he-ws-scissors-which', glow: null });
    }
    expect(plan({ failedRuns: 1, reason: 'lever-not-hit', dominoRowStopped: true }).hint).toEqual({ lineId: 'vo-he-ws-dominoes-gap', glow: null });
    expect(plan({ failedRuns: 1, reason: 'lever-not-hit', dominoRowStopped: false, config: { ramp: 'none', slots: [], scissors: 'none' } }).hint).toBeNull();
  });

  it('[AC-09] 2nd failure: the goal hint, never the solution (no glow)', () => {
    const p = plan({ failedRuns: 2, reason: 'lever-not-hit' });
    expect(p.hint).toEqual({ lineId: 'vo-he-ws-l20-goal', glow: null });
    expect(p.breathe).toBe(false);
  });

  it('[AC-09] 3rd failure and later: a glowing socket (ramp first, with the ramp hint), and after 3 fails Bip says to breathe', () => {
    const empty = { ramp: 'none' as const, slots: [] as number[], scissors: 'none' as const };
    const third = plan({ failedRuns: 3, reason: 'lever-not-hit', config: empty });
    expect(third.hint).toEqual({ lineId: 'vo-he-robot-help-2', glow: 'R1' });
    expect(third.breathe).toBe(true);
    expect(third.voices).toEqual(['vo-he-robot-breathe', 'vo-he-robot-help-2']);
    const fourth = plan({ failedRuns: 4, reason: 'lever-not-hit', config: empty });
    expect(fourth.hint).toEqual({ lineId: 'vo-he-robot-help-2', glow: 'R1' });
    expect(fourth.breathe).toBe(false);
    // The glow stays through the later rungs (4 trajectory, 5 ghost, 6 Bip); the 3rd failure is the only one that speaks its line.
    expect(fourth.voices).not.toContain('vo-he-robot-help-2');
  });

  it('[AC-09] the glow goes to the first missing part: ramp (also a wrong direction), then the scissors on A, then a domino slot', () => {
    const ok = { ramp: 'down-right' as const, slots: [460, 620], scissors: 'A' as const };
    expect(plan({ failedRuns: 3, config: { ...ok, ramp: 'down-left' } }).hint?.glow).toBe('R1');
    expect(plan({ failedRuns: 3, config: { ...ok, scissors: 'B' } }).hint).toEqual({ lineId: 'vo-he-ws-scissors-which', glow: 'string-A' });
    expect(plan({ failedRuns: 3, config: { ...ok, scissors: 'none' } }).hint?.glow).toBe('string-A');
    expect(plan({ failedRuns: 3, config: { ...ok, slots: [460, 500] } }).hint).toEqual({ lineId: 'vo-he-ws-dominoes-gap', glow: 'slot-620' });
    expect(plan({ failedRuns: 3, config: { ...ok, slots: [] } }).hint?.glow).toBe('slot-460');
  });

  it('[AC-09] voices play in order: the failure line first, then the hint; a line is never listed twice', () => {
    const p = plan({ failedRuns: 2, reason: 'wrong-string', cocoRang: true, oneBellFails: 1 });
    expect(p.voices).toEqual(['vo-fr-ws-l20-one-bell', 'vo-he-ws-l20-goal']);
    for (const v of [plan({ failedRuns: 3 }).voices, p.voices]) expect(new Set(v).size).toBe(v.length);
  });
});

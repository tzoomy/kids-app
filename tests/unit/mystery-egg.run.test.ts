import { describe, expect, it } from 'vitest';
import {
  HINT_AFTER_FAILS,
  EAR_LINE_ID,
  HINT_LADDER,
  RUN_TIMEOUT_STEPS,
  RunWatcher,
  isNearMiss,
  createRunTracker,
  recordRun,
  type RunSample,
} from '../../src/games/mysteryEgg/run';

const bounds = { minX: -100, maxX: 1380, maxY: 1000 };
const cfg = { reach: 100, bounds, restSpeed: 0.05, restSteps: 60, timeoutSteps: RUN_TIMEOUT_STEPS };
const sample = (over: Partial<RunSample> = {}): RunSample => ({ step: 1, x: 300, y: 300, speed: 5, bellDistance: 400, ...over });

describe('mystery-egg run tracker', () => {
  it('[AC-07] ladder step 1: the goal hint (help-1, no pointer) is due on the 2nd failed run, not before', () => {
    expect(HINT_AFTER_FAILS).toBe(2);
    let t = createRunTracker();
    const first = recordRun(t, 'fail');
    expect(first.state.failedRuns).toBe(1);
    expect(first.hint).toBeNull();
    t = first.state;
    const second = recordRun(t, 'fail');
    expect(second.state.failedRuns).toBe(2);
    expect(second.hint).toEqual({ lineId: 'vo-he-robot-help-1', step: 'goal', pointer: false });
  });

  it('[AC-07] ladder step 2: the next failed run gives the glowing-slot hint (help-2) with the slot pointer, and it repeats on every later failed run', () => {
    let t = createRunTracker();
    const steps: Array<[string | null, boolean | null]> = [];
    for (let i = 0; i < 5; i++) {
      const r = recordRun(t, 'fail');
      t = r.state;
      steps.push([r.hint?.lineId ?? null, r.hint?.pointer ?? null]);
    }
    expect(steps).toEqual([
      [null, null],
      ['vo-he-robot-help-1', false],
      ['vo-he-robot-help-2', true],
      ['vo-he-robot-help-2', true],
      ['vo-he-robot-help-2', true],
    ]);
    expect(t.hintsGiven).toBe(4);
  });

  it('[AC-07] the ladder is explicit: two rungs, goal then slot, in order', () => {
    expect(HINT_LADDER.map((r) => [r.afterFailedRuns, r.lineId, r.pointer])).toEqual([
      [2, 'vo-he-robot-help-1', false],
      [3, 'vo-he-robot-help-2', true],
    ]);
  });

  it('[AC-07] a success never counts as a failure and never asks for a hint', () => {
    const afterFail = recordRun(createRunTracker(), 'fail').state;
    const win = recordRun(afterFail, 'success');
    expect(win.state.failedRuns).toBe(1);
    expect(win.state.won).toBe(true);
    expect(win.hint).toBeNull();
  });

  it('[AC-07] recordRun is pure: the input state is not mutated', () => {
    const t = createRunTracker();
    recordRun(t, 'fail');
    expect(t.failedRuns).toBe(0);
  });
});

describe('mystery-egg run outcome', () => {
  it('[AC-08] ringing the bell is a success', () => {
    const w = new RunWatcher(cfg);
    expect(w.update(sample()).status).toBe('running');
    expect(w.update(sample({ step: 2, bellDistance: 99 }))).toEqual({ status: 'success' });
  });

  it('[AC-08] leaving the board is a failed run', () => {
    const w = new RunWatcher(cfg);
    expect(w.update(sample({ y: 1200 }))).toEqual({ status: 'fail', reason: 'out-of-bounds' });
    const w2 = new RunWatcher(cfg);
    expect(w2.update(sample({ x: 1500 }))).toEqual({ status: 'fail', reason: 'out-of-bounds' });
  });

  it('[AC-08] coming to rest away from the bell is a failed run, but only after resting long enough', () => {
    const w = new RunWatcher(cfg);
    let last: ReturnType<RunWatcher['update']> = { status: 'running' };
    for (let s = 1; s < 60; s++) last = w.update(sample({ step: s, speed: 0.01 }));
    expect(last.status).toBe('running');
    last = w.update(sample({ step: 60, speed: 0.01 }));
    expect(last).toEqual({ status: 'fail', reason: 'at-rest' });
  });

  it('[AC-08] a moving ball resets the rest counter', () => {
    const w = new RunWatcher(cfg);
    for (let s = 1; s < 50; s++) w.update(sample({ step: s, speed: 0.01 }));
    w.update(sample({ step: 50, speed: 3 }));
    for (let s = 51; s < 100; s++) expect(w.update(sample({ step: s, speed: 0.01 })).status).toBe('running');
  });

  it('[AC-08] running out of simulated time is a failed run', () => {
    const w = new RunWatcher(cfg);
    expect(w.update(sample({ step: RUN_TIMEOUT_STEPS - 1 })).status).toBe('running');
    expect(w.update(sample({ step: RUN_TIMEOUT_STEPS }))).toEqual({ status: 'fail', reason: 'timeout' });
  });

  it('[AC-08] a result is final: after a success later samples do not change it', () => {
    const w = new RunWatcher(cfg);
    w.update(sample({ bellDistance: 10 }));
    expect(w.update(sample({ step: 5, y: 1200 }))).toEqual({ status: 'success' });
  });

  it('[AC-08] the watcher remembers how close the ball came to the bell (for the "Presque !" near-miss line)', () => {
    const w = new RunWatcher(cfg);
    expect(w.minBellDistance).toBe(Infinity);
    w.update(sample({ step: 1, bellDistance: 400 }));
    w.update(sample({ step: 2, bellDistance: 150 }));
    w.update(sample({ step: 3, bellDistance: 300 }));
    expect(w.minBellDistance).toBe(150);
    expect(isNearMiss(150, cfg.reach)).toBe(true);
    expect(isNearMiss(400, cfg.reach)).toBe(false);
  });

  it('[AC-11] the robot ear button gives Hebrew help: it plays help-1 (the goal hint), which is also the first ladder rung, and help-2 stays the last rung', () => {
    expect(EAR_LINE_ID).toBe('vo-he-robot-help-1');
    expect(EAR_LINE_ID).toBe(HINT_LADDER[0].lineId);
    expect(HINT_LADDER[HINT_LADDER.length - 1].lineId).toBe('vo-he-robot-help-2');
    // Tapping the ear is not a failed run: recordRun is never involved, so the ladder cannot advance from it.
    expect(EAR_LINE_ID).not.toBe('vo-fr-instruction');
  });
});

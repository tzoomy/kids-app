// Mystery Egg: run outcome and failed-run tracking. Pure TS, no Phaser. Spec: docs/specs/mystery-egg.md (AC-07, AC-08).

/**
 * The help ladder (GDD section 8; the order is pending Maor's decision). Failed runs never cost anything.
 *  - 2nd failed run: `vo-he-robot-help-1`, the GOAL hint (explains the request, never the solution). No pointer.
 *  - 3rd failed run and every later one: `vo-he-robot-help-2`, the GLOWING-SLOT hint (GDD hint step 3), together with
 *    the pulsing pointer at the empty slot.
 * The robot's ear button is separate: it plays help-1 at any time (`EAR_LINE_ID`) and is not a ladder step.
 */
export const HINT_LADDER = [
  { afterFailedRuns: 2, lineId: 'vo-he-robot-help-1', step: 'goal', pointer: false },
  { afterFailedRuns: 3, lineId: 'vo-he-robot-help-2', step: 'slot', pointer: true },
] as const;
export const HINT_AFTER_FAILS = HINT_LADDER[0].afterFailedRuns;
export type HintLineId = (typeof HINT_LADDER)[number]['lineId'];
export type HintStep = (typeof HINT_LADDER)[number]['step'];

/**
 * The robot ear button gives HEBREW help at any time (intro and build): it plays the goal hint, `vo-he-robot-help-1`
 * (decided by Maor via the team lead, 2026-11-25). It is not a ladder step: it never counts as a failed run and never
 * shows the pointer; `vo-he-robot-help-2` stays the last automatic rung.
 */
export const EAR_LINE_ID: HintLineId = HINT_LADDER[0].lineId;

/** Fixed simulation step (60 Hz). Outcomes depend on step counts, never on frame times. */
export const STEP_MS = 1000 / 60;
/** 10 s of simulated time. */
export const RUN_TIMEOUT_STEPS = 600;

export interface RunTrackerState {
  failedRuns: number;
  hintsGiven: number;
  won: boolean;
}

export function createRunTracker(): RunTrackerState {
  return { failedRuns: 0, hintsGiven: 0, won: false };
}

export interface HintDue {
  lineId: HintLineId;
  step: HintStep;
  /** Show the pulsing pointer at the empty slot with this hint. */
  pointer: boolean;
}

/**
 * Records one finished run. Pure: returns the next state and, when a ladder rung is reached, which hint to give.
 * Rung 1 on the 2nd failed run, rung 2 on the 3rd and on every failed run after it.
 */
export function recordRun(state: RunTrackerState, outcome: 'success' | 'fail'): { state: RunTrackerState; hint: HintDue | null } {
  if (outcome === 'success') return { state: { ...state, won: true }, hint: null };
  const failedRuns = state.failedRuns + 1;
  const rung = [...HINT_LADDER].reverse().find((r) => failedRuns >= r.afterFailedRuns);
  if (!rung) return { state: { ...state, failedRuns }, hint: null };
  return {
    state: { ...state, failedRuns, hintsGiven: state.hintsGiven + 1 },
    hint: { lineId: rung.lineId, step: rung.step, pointer: rung.pointer },
  };
}

export type FailReason = 'out-of-bounds' | 'at-rest' | 'timeout';
export type RunResult = { status: 'running' } | { status: 'success' } | { status: 'fail'; reason: FailReason };

/** What the physics step reports to the watcher after each step. */
export interface RunSample {
  /** 1-based number of steps since Play. */
  step: number;
  x: number;
  y: number;
  /** Ball speed in px per step. */
  speed: number;
  /** Distance from the ball centre to the bell centre. */
  bellDistance: number;
}

export interface RunWatcherConfig {
  /** Ball radius + bell reach: the bell rings when the distance is below this. */
  reach: number;
  bounds: { minX: number; maxX: number; maxY: number };
  /** Below this speed (px per step) the ball counts as resting. */
  restSpeed: number;
  /** Consecutive resting steps before the run is called. */
  restSteps: number;
  timeoutSteps: number;
}

/** Decides the result of one run, step by step. The first final result sticks. */
export class RunWatcher {
  private restCount = 0;
  private minDistance = Infinity;
  private result: RunResult = { status: 'running' };

  constructor(private readonly cfg: RunWatcherConfig) {}

  /** Closest the ball centre came to the bell centre during this run (Infinity before the first sample). */
  get minBellDistance(): number {
    return this.minDistance;
  }

  update(s: RunSample): RunResult {
    if (this.result.status !== 'running') return this.result;
    const { cfg } = this;
    this.minDistance = Math.min(this.minDistance, s.bellDistance);
    if (s.bellDistance < cfg.reach) {
      this.result = { status: 'success' };
    } else if (s.x < cfg.bounds.minX || s.x > cfg.bounds.maxX || s.y > cfg.bounds.maxY) {
      this.result = { status: 'fail', reason: 'out-of-bounds' };
    } else {
      this.restCount = s.speed < cfg.restSpeed ? this.restCount + 1 : 0;
      if (this.restCount >= cfg.restSteps) this.result = { status: 'fail', reason: 'at-rest' };
      else if (s.step >= cfg.timeoutSteps) this.result = { status: 'fail', reason: 'timeout' };
    }
    return this.result;
  }
}

/** A failed run that still passed within twice the bell's reach earns the gentle "Presque !" line. */
export function isNearMiss(minBellDistance: number, reach: number): boolean {
  return minBellDistance < reach * 2;
}

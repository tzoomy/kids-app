// Mystery Egg: run outcome and failed-run tracking. Pure TS, no Phaser. Spec: docs/specs/mystery-egg.md (AC-07, AC-08).

/** The 2nd failed run triggers the Hebrew hint (pending Maor decision: GDD section 8, "automatically after 2 failed tries"). */
export const HINT_AFTER_FAILS = 2;
export const HINT_LINE_IDS = ['vo-he-robot-help-1', 'vo-he-robot-help-2'] as const;
export type HintLineId = (typeof HINT_LINE_IDS)[number];

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
}

/**
 * Records one finished run. Pure: returns the next state and, when a hint is due, which line to play.
 * A hint is due on the 2nd failed run and on every 2nd failed run after it; the two lines alternate.
 */
export function recordRun(state: RunTrackerState, outcome: 'success' | 'fail'): { state: RunTrackerState; hint: HintDue | null } {
  if (outcome === 'success') return { state: { ...state, won: true }, hint: null };
  const failedRuns = state.failedRuns + 1;
  const due = failedRuns >= HINT_AFTER_FAILS && failedRuns % HINT_AFTER_FAILS === 0;
  if (!due) return { state: { ...state, failedRuns }, hint: null };
  const lineId = HINT_LINE_IDS[state.hintsGiven % HINT_LINE_IDS.length];
  return { state: { ...state, failedRuns, hintsGiven: state.hintsGiven + 1 }, hint: { lineId } };
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

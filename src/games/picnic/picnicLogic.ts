// Pure Picnic Train logic (no Phaser, no DOM). Spec: docs/specs/picnic-train.md.
// One train is one adaptive trial and one round (`rules.trialsPerRound: 1` in picnic-train.json).
import type { LevelDescriptor, PicnicLayout, PicnicTask } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { Lang } from '../templates/choiceServe';

export type { PicnicTask, PicnicLayout };
export type PicnicScaffold = 'outline' | 'symbol' | 'none';

/** After a wrong tap, taps are ignored for this long (same value as the restaurant and Sorting Beds). */
export const WRONG_TAP_LOCK_MS = 400;

/** The cargo shelf holds at most this many items (the largest train has 10 passengers). */
export const MAX_LOAD = 10;

/** Approved animal rigs used as passengers (`Character` kinds), at least 10 so the biggest train has distinct animals. */
export const PASSENGER_KINDS: readonly string[] = ['bear', 'rabbit', 'cat', 'dog', 'panda', 'lion', 'bird', 'frog', 'owl', 'bee'];

/** Approved food art ids (`art/foods/<id>.svg`) used as picnic items. */
export const PICNIC_FOODS: readonly string[] = ['apple', 'banana', 'cookie', 'pear', 'orange', 'strawberry', 'grapes', 'cheese', 'carrot', 'egg'];

// ---------------------------------------------------------------------------------------------
// Level levers
// ---------------------------------------------------------------------------------------------

/** The levers Picnic Train reads from a content level descriptor. */
export interface LevelLevers {
  /** The largest train of the level. */
  setSize: number;
  task: PicnicTask;
  layout: PicnicLayout;
  scaffold: PicnicScaffold;
}

/** Reads the levers from a validated level (see PicnicTrainContentSchema). It only maps content fields. */
export function levelLevers(level: LevelDescriptor): LevelLevers {
  const task = level.extra?.task;
  const layout = level.extra?.layout;
  return {
    setSize: level.setSize ?? 2,
    task: task === 'load' || task === 'missing' ? task : 'one-each',
    layout: layout === 'scattered' ? 'scattered' : 'rows',
    scaffold: level.scaffold ?? 'none',
  };
}

/** Candidate train-size ids `n<size>` for the engine's `selectNextItem`: setSize - 1 and setSize, never below 2. */
export function trainSizeCandidates(setSize: number): string[] {
  const lo = Math.max(2, setSize - 1);
  const ids: string[] = [];
  for (let k = lo; k <= setSize; k++) ids.push(`n${k}`);
  return ids;
}

/** Train size of a candidate id; anything else (or a size outside the level's range) falls back to `setSize`. */
export function parseTrainSize(id: string, setSize: number): number {
  const match = /^n(\d+)$/.exec(id);
  if (!match) return setSize;
  const size = Number(match[1]);
  return size >= Math.max(2, setSize - 1) && size <= setSize ? size : setSize;
}

// ---------------------------------------------------------------------------------------------
// Round plan
// ---------------------------------------------------------------------------------------------

export interface TrainPassenger {
  /** 'p-0' ... left to right. */
  id: string;
  seat: number;
  kind: string;
}

export interface TrainPlan {
  task: PicnicTask;
  /** Passengers in the train (n). */
  size: number;
  /** Seats in the train: `size` for rows, `min(10, size + 2)` for scattered. */
  seatCount: number;
  passengers: TrainPassenger[];
  /** missing: ids of the passengers who already hold an item. Empty for the other tasks. */
  served: string[];
  /** one-each: n; load: N to load; missing: the missing count m = n - served.length. */
  target: number;
  scaffoldKind: PicnicScaffold;
  scaffold: { ghostItems: boolean; tally: number | null };
}

export interface BuildTrainParams {
  levers: LevelLevers;
  /** The engine's choice, `n<size>` (see trainSizeCandidates). */
  sizeId: string;
  random: () => number;
}

/** Fisher-Yates shuffle of a copy. */
function shuffled<T>(items: readonly T[], random: () => number): T[] {
  const out = [...items];
  for (let i = out.length - 1; i > 0; i--) {
    const j = Math.min(i, Math.floor(random() * (i + 1)));
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

export function buildTrain(params: BuildTrainParams): TrainPlan {
  const { levers, random } = params;
  const size = parseTrainSize(params.sizeId, levers.setSize);
  const seatCount = levers.layout === 'scattered' ? Math.min(10, size + 2) : size;
  const allSeats = Array.from({ length: seatCount }, (_, i) => i);
  const seats = (seatCount === size ? allSeats : shuffled(allSeats, random).slice(0, size)).sort((a, b) => a - b);
  const kinds = shuffled(PASSENGER_KINDS, random).slice(0, size);
  const passengers: TrainPassenger[] = seats.map((seat, i) => ({ id: `p-${i}`, seat, kind: kinds[i] }));

  let served: string[] = [];
  if (levers.task === 'missing') {
    const k = 1 + Math.min(size - 2, Math.floor(random() * (size - 1))); // 1 .. size - 1
    const order = new Map(passengers.map((p, i) => [p.id, i]));
    served = shuffled(passengers.map((p) => p.id), random)
      .slice(0, k)
      .sort((a, b) => (order.get(a) ?? 0) - (order.get(b) ?? 0));
  }
  const target = levers.task === 'missing' ? size - served.length : size;
  return {
    task: levers.task,
    size,
    seatCount,
    passengers,
    served,
    target,
    scaffoldKind: levers.scaffold,
    scaffold: {
      ghostItems: levers.scaffold === 'outline',
      tally: levers.scaffold === 'symbol' ? size : null,
    },
  };
}

// ---------------------------------------------------------------------------------------------
// One train's progress (the rules of the three tasks)
// ---------------------------------------------------------------------------------------------

export type RoundPhase = 'give' | 'load' | 'answer' | 'depart';

export type GiveOutcome = { kind: 'given'; count: number; done: boolean } | { kind: 'already' } | { kind: 'ignored' };
export type LoadOutcome = { kind: 'loaded'; count: number } | { kind: 'full' } | { kind: 'ignored' };
export type GoOutcome = { kind: 'ready' } | { kind: 'wrong'; count: number } | { kind: 'ignored' };
export type AnswerOutcome = { kind: 'right'; missing: number } | { kind: 'wrong' } | { kind: 'ignored' };

/** Pure state machine of one train. The scene only animates what it returns. */
export class TrainRound {
  private readonly withItem: Set<string>;
  private phaseValue: RoundPhase;
  private loadedValue = 0;

  constructor(private readonly plan: TrainPlan) {
    this.withItem = new Set(plan.served);
    this.phaseValue = plan.task === 'load' ? 'load' : plan.task === 'missing' ? 'answer' : 'give';
  }

  get phase(): RoundPhase {
    return this.phaseValue;
  }

  get loaded(): number {
    return this.loadedValue;
  }

  /** Passengers holding an item (already served ones included). */
  get servedCount(): number {
    return this.withItem.size;
  }

  hasItem(id: string): boolean {
    return this.withItem.has(id);
  }

  /** First passenger (left to right) without an item. */
  get nextFreeId(): string | null {
    return this.plan.passengers.find((p) => !this.withItem.has(p.id))?.id ?? null;
  }

  /** missing step 1: the number cards 1 .. n-1; empty for the other tasks. */
  get cardValues(): number[] {
    return this.plan.task === 'missing' ? Array.from({ length: this.plan.size - 1 }, (_, i) => i + 1) : [];
  }

  tapPassenger(id: string): GiveOutcome {
    if (this.phaseValue !== 'give') return { kind: 'ignored' };
    if (!this.plan.passengers.some((p) => p.id === id)) return { kind: 'ignored' };
    if (this.withItem.has(id)) return { kind: 'already' };
    this.withItem.add(id);
    const count = this.withItem.size;
    const done = count === this.plan.size;
    if (done) this.phaseValue = 'depart';
    return { kind: 'given', count, done };
  }

  load(): LoadOutcome {
    if (this.phaseValue !== 'load') return { kind: 'ignored' };
    if (this.loadedValue >= MAX_LOAD) return { kind: 'full' };
    this.loadedValue++;
    return { kind: 'loaded', count: this.loadedValue };
  }

  /** Takes one item back off the shelf; the new count, or null when the shelf is empty (or not in the load phase). */
  unload(): number | null {
    if (this.phaseValue !== 'load' || this.loadedValue === 0) return null;
    this.loadedValue--;
    return this.loadedValue;
  }

  go(): GoOutcome {
    if (this.phaseValue !== 'load') return { kind: 'ignored' };
    if (this.loadedValue === this.plan.target) {
      this.phaseValue = 'depart';
      return { kind: 'ready' };
    }
    const count = this.loadedValue;
    this.loadedValue = 0; // the cargo goes back to the basket
    return { kind: 'wrong', count };
  }

  answer(value: number): AnswerOutcome {
    if (this.phaseValue !== 'answer') return { kind: 'ignored' };
    if (value !== this.plan.target) return { kind: 'wrong' };
    this.phaseValue = 'give';
    return { kind: 'right', missing: this.plan.target };
  }
}

// ---------------------------------------------------------------------------------------------
// Trial bookkeeping and the tap lock
// ---------------------------------------------------------------------------------------------

/**
 * Per-train bookkeeping, same semantics as the restaurant `TrialTracker` and `SortingTrialTracker`:
 * - `onHint()` (idle hint) marks the trial hinted until the trial is recorded;
 * - `onMistake()` yields the miss at once, at most once per train;
 * - `onComplete()` yields the clean (or assisted) result only when nothing was recorded yet;
 * - `onReplay()` (voluntary replay of the instruction) is never a hint.
 */
export class PicnicTrialTracker {
  private hinted = false;
  private recorded = false;

  constructor(
    readonly itemId: string,
    readonly language: Lang,
  ) {}

  onHint(): void {
    if (!this.recorded) this.hinted = true;
  }

  onMistake(): TrialResult | null {
    if (this.recorded) return null;
    this.recorded = true;
    return { itemId: this.itemId, firstTryCorrect: false, hinted: this.hinted };
  }

  onComplete(): TrialResult | null {
    if (this.recorded) return null;
    this.recorded = true;
    return { itemId: this.itemId, firstTryCorrect: true, hinted: this.hinted };
  }

  onReplay(): void {}

  get isHinted(): boolean {
    return this.hinted;
  }

  get isRecorded(): boolean {
    return this.recorded;
  }
}

/** True while taps are swallowed by the lock that follows a wrong tap. */
export function isLocked(nowMs: number, lockedUntilMs: number): boolean {
  return nowMs < lockedUntilMs;
}

// ---------------------------------------------------------------------------------------------
// Voice lines
// ---------------------------------------------------------------------------------------------

export interface LineRequest {
  lineId: string;
  lang: 'he' | Lang;
}

/** Train-start instruction (also the replay and the idle-hint line). */
export function askLine(plan: Pick<TrainPlan, 'task' | 'target'>): LineRequest {
  if (plan.task === 'load') return { lineId: `picnic.ask.load.${plan.target}.he`, lang: 'he' };
  if (plan.task === 'missing') return { lineId: 'picnic.ask.missing.he', lang: 'he' };
  return { lineId: 'picnic.ask.one-each.he', lang: 'he' };
}

/** A number counted aloud in the round language. */
export function numberLine(n: number, lang: Lang): LineRequest {
  return { lineId: `picnic.number.${n}.${lang}`, lang };
}

export const WRONG_GIVEN_LINE: LineRequest = { lineId: 'picnic.wrong.given.he', lang: 'he' };
export const WRONG_COUNT_LINE: LineRequest = { lineId: 'picnic.wrong.count.he', lang: 'he' };
export const MISSING_GIVE_LINE: LineRequest = { lineId: 'picnic.missing.give.he', lang: 'he' };
export const READY_LINE: LineRequest = { lineId: 'picnic.ready.he', lang: 'he' };
export const HELP_LINE: LineRequest = { lineId: 'picnic.help.he', lang: 'he' };

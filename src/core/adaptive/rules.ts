// Level up/down rules and item state updates. Pure: every function returns new objects.
import { trackPolicy } from './policy';
import type {
  AdaptiveRules,
  AgeTrack,
  Box,
  GameLevelsMeta,
  ItemState,
  LevelChange,
  OutcomeKind,
  SkillSessionState,
  SkillState,
  TrackBounds,
  TrialResult,
} from './types';

export const DEFAULT_RULES: AdaptiveRules = {
  upCleanStreak: 3,
  downMisses: 2,
  downWindow: 3,
  trialsPerRound: 3,
  maxChangesPerRound: 1,
  retryAfterTrials: 2,
  masteredBox: 3,
};

/** Review interval in days, indexed by box - 1. */
export const BOX_INTERVAL_DAYS = [0, 0, 2, 4, 7] as const;

export const RECENT_LIMIT = 8;

export interface MetaInput {
  levelCount: number;
  tracks: Record<AgeTrack, { start: number; min?: number; max: number }>;
  rules?: Partial<AdaptiveRules>;
}

/** Builds engine metadata from content, merging rule overrides onto DEFAULT_RULES. */
export function buildMeta(input: MetaInput): GameLevelsMeta {
  const track = (t: { start: number; min?: number; max: number }): TrackBounds => ({
    start: t.start,
    min: t.min ?? 1,
    max: t.max,
  });
  const rules: AdaptiveRules = { ...DEFAULT_RULES };
  for (const [k, v] of Object.entries(input.rules ?? {})) {
    if (v !== undefined) rules[k as keyof AdaptiveRules] = v;
  }
  return {
    levelCount: input.levelCount,
    tracks: { age2: track(input.tracks.age2), age5: track(input.tracks.age5) },
    rules,
  };
}

export function classify(r: TrialResult): OutcomeKind {
  if (!r.firstTryCorrect) return 'miss';
  return r.hinted ? 'assisted' : 'clean';
}

export function initialSkill(meta: GameLevelsMeta, track: AgeTrack, today: string): SkillState {
  return {
    level: meta.tracks[track].start,
    cleanStreak: 0,
    recent: [],
    afterDrop: false,
    lastPlayedDay: today,
    items: {},
  };
}

export function initialSession(): SkillSessionState {
  return {
    trialIndex: 0,
    trialsInRound: 0,
    changesInRound: 0,
    retryQueue: [],
    lastItemId: null,
    knownSinceNew: 0,
  };
}

function clampLevel(level: number, bounds: TrackBounds): number {
  return Math.min(bounds.max, Math.max(bounds.min, level));
}

/** Clamps the level to the current track's bounds. Run on every read. */
export function clampToTrack(skill: SkillState, meta: GameLevelsMeta, track: AgeTrack): SkillState {
  const level = clampLevel(skill.level, meta.tracks[track]);
  return level === skill.level ? skill : { ...skill, level };
}

export function decideChange(skill: SkillState, meta: GameLevelsMeta): LevelChange {
  const { downMisses, downWindow, upCleanStreak } = meta.rules;
  const lastTrials = skill.recent.slice(-downWindow);
  if (lastTrials.filter((o) => o === 'miss').length >= downMisses) return -1;
  if (skill.cleanStreak >= upCleanStreak) return 1;
  return 0;
}

/**
 * Applies a decided change. At the floor a down decision is a "soft drop": history is
 * cleared and `afterDrop` set, although the level cannot fall. At the ceiling an up
 * decision is a no-op and the clean streak keeps counting.
 */
export function applyChange(skill: SkillState, delta: LevelChange, meta: GameLevelsMeta, track: AgeTrack): SkillState {
  if (delta === 0) return skill;
  const bounds = meta.tracks[track];
  if (delta > 0 && skill.level >= bounds.max) return skill;
  return {
    ...skill,
    level: clampLevel(skill.level + delta, bounds),
    recent: [],
    cleanStreak: 0,
    afterDrop: delta < 0 ? true : skill.afterDrop,
  };
}

function updateItem(prev: ItemState | undefined, outcome: OutcomeKind, today: string): ItemState {
  const base: ItemState = prev ?? { box: 1, seen: 0, clean: 0, lastSeenDay: today };
  let box = base.box;
  if (outcome === 'clean') box = Math.min(5, box + 1) as Box;
  else if (outcome === 'miss') box = 1;
  return {
    box,
    seen: base.seen + 1,
    clean: base.clean + (outcome === 'clean' ? 1 : 0),
    lastSeenDay: today,
  };
}

export interface StepResult {
  skill: SkillState;
  session: SkillSessionState;
  /** The decision that was applied (0 when nothing happened, including an up at the ceiling). */
  change: LevelChange;
}

function tryChange(
  skill: SkillState,
  session: SkillSessionState,
  meta: GameLevelsMeta,
  track: AgeTrack,
): StepResult {
  const delta = decideChange(skill, meta);
  const next = applyChange(skill, delta, meta, track);
  if (next === skill) return { skill, session, change: 0 };
  return { skill: next, session: { ...session, changesInRound: session.changesInRound + 1 }, change: delta };
}

/** Closes a round: applies a deferred change (between-rounds policy) and resets round counters. */
export function endRound(skill: SkillState, session: SkillSessionState, meta: GameLevelsMeta, track: AgeTrack): StepResult {
  let result: StepResult = { skill, session, change: 0 };
  if (trackPolicy(track).levelChange === 'between-rounds' && session.changesInRound < meta.rules.maxChangesPerRound) {
    result = tryChange(skill, session, meta, track);
  }
  return {
    ...result,
    session: { ...result.session, trialsInRound: 0, changesInRound: 0 },
  };
}

export function recordTrial(
  skillIn: SkillState,
  sessionIn: SkillSessionState,
  result: TrialResult,
  meta: GameLevelsMeta,
  track: AgeTrack,
  today: string,
): StepResult {
  const outcome = classify(result);
  const wasSeen = result.itemId in skillIn.items;

  let skill: SkillState = {
    ...clampToTrack(skillIn, meta, track),
    items: { ...skillIn.items, [result.itemId]: updateItem(skillIn.items[result.itemId], outcome, today) },
    recent: [...skillIn.recent, outcome].slice(-RECENT_LIMIT),
    cleanStreak: outcome === 'clean' ? skillIn.cleanStreak + 1 : 0,
    lastPlayedDay: today,
  };

  const retryQueue = sessionIn.retryQueue.filter((r) => r.itemId !== result.itemId);
  if (outcome === 'miss') {
    retryQueue.push({ itemId: result.itemId, dueAtTrial: sessionIn.trialIndex + meta.rules.retryAfterTrials });
  }
  let session: SkillSessionState = {
    ...sessionIn,
    retryQueue,
    trialIndex: sessionIn.trialIndex + 1,
    trialsInRound: sessionIn.trialsInRound + 1,
    lastItemId: result.itemId,
    knownSinceNew: wasSeen ? sessionIn.knownSinceNew + 1 : 0,
  };

  let change: LevelChange = 0;
  if (trackPolicy(track).levelChange === 'after-trial' && session.changesInRound < meta.rules.maxChangesPerRound) {
    const step = tryChange(skill, session, meta, track);
    skill = step.skill;
    session = step.session;
    change = step.change;
  }

  if (session.trialsInRound >= meta.rules.trialsPerRound) {
    const end = endRound(skill, session, meta, track);
    skill = end.skill;
    session = end.session;
    if (end.change !== 0) change = end.change;
  }

  return { skill, session, change };
}

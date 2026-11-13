// Adaptive-difficulty engine types. Pure TypeScript: no Phaser, no DOM.
import type { AgeTrack } from '../storage/schema';

export type { AgeTrack };

/** `${world}.${gameId}.${lang}`, e.g. language-house.animal-restaurant.fr */
export type SkillKey = string;
export type OutcomeKind = 'clean' | 'assisted' | 'miss';
export type Box = 1 | 2 | 3 | 4 | 5;

export interface TrialResult {
  itemId: string;
  firstTryCorrect: boolean;
  /** The auto-hint fired before the first tap. A voluntary replay is NOT a hint. */
  hinted: boolean;
  /** Recorded for later versions. No v1 function reads it. */
  rtMs?: number;
}

export interface AdaptiveRules {
  upCleanStreak: number;
  downMisses: number;
  downWindow: number;
  trialsPerRound: number;
  maxChangesPerRound: number;
  retryAfterTrials: number;
  masteredBox: number;
}

export interface TrackBounds {
  start: number;
  min: number;
  max: number;
}

/** Built from content. The engine never sees lever values, only the level count and bounds. */
export interface GameLevelsMeta {
  levelCount: number;
  tracks: Record<AgeTrack, TrackBounds>;
  rules: AdaptiveRules;
}

export interface ItemState {
  box: Box;
  seen: number;
  clean: number;
  lastSeenDay: string;
}

export interface SkillState {
  /** 1-based. */
  level: number;
  cleanStreak: number;
  /** Outcomes since the last level change, newest last, length <= 8. */
  recent: OutcomeKind[];
  /** Serve a known item next. */
  afterDrop: boolean;
  /** YYYY-MM-DD local. Stored now so the later decay feature needs no migration. */
  lastPlayedDay: string;
  items: Record<string, ItemState>;
}

export interface AdaptiveProfile {
  schemaVersion: 1;
  profileId: string;
  skills: Record<SkillKey, SkillState>;
}

/** In memory only; reset per game visit. */
export interface SkillSessionState {
  trialIndex: number;
  trialsInRound: number;
  changesInRound: number;
  retryQueue: { itemId: string; dueAtTrial: number }[];
  lastItemId: string | null;
  knownSinceNew: number;
  /** Decision computed after a trial and applied at the round end (see endRound). */
  pendingChange: LevelChange;
}

export interface TrackPolicy {
  interaction: 'tap' | 'drag';
  useResponseTime: boolean;
  levelChange: 'after-trial' | 'between-rounds';
}

/** -1 down, 0 none, 1 up. */
export type LevelChange = -1 | 0 | 1;

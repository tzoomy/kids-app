// Parent-driven level edits (profile page). Pure: no storage, no DOM. All results stay inside the track bounds.
import { clampToTrack, initialSkill, startingLevel, type StartPrefs } from './rules';
import type { AgeTrack, GameLevelsMeta, SkillState } from './types';

function clamp(level: number, meta: GameLevelsMeta, track: AgeTrack): number {
  const { min, max } = meta.tracks[track];
  return Math.min(max, Math.max(min, level));
}

/** The level a parent sees: the stored (track-clamped) level, or the effective start of an unstarted game. */
export function shownLevel(
  skill: SkillState | undefined,
  meta: GameLevelsMeta,
  track: AgeTrack,
  lang: string,
  prefs: StartPrefs = {},
): number {
  return skill ? clampToTrack(skill, meta, track).level : startingLevel(meta, track, lang, prefs);
}

/**
 * One `+`/`-` step. A started skill keeps its item history but loses its streak and recent window; an unstarted
 * game gets a new skill at `clamp(effective start + delta)`. Never leaves the profile's track bounds.
 */
export function adjustSkillLevel(
  skill: SkillState | undefined,
  meta: GameLevelsMeta,
  track: AgeTrack,
  lang: string,
  prefs: StartPrefs,
  delta: 1 | -1,
  today: string,
): SkillState {
  const base = skill ? clampToTrack(skill, meta, track) : initialSkill(meta, track, today, startingLevel(meta, track, lang, prefs));
  return { ...base, level: clamp(base.level + delta, meta, track), cleanStreak: 0, recent: [] };
}

/** A fresh skill at the effective start (items and streak cleared), or undefined when the game was never started. */
export function resetSkill(
  skill: SkillState | undefined,
  meta: GameLevelsMeta,
  track: AgeTrack,
  lang: string,
  prefs: StartPrefs,
  today: string,
): SkillState | undefined {
  return skill ? initialSkill(meta, track, today, startingLevel(meta, track, lang, prefs)) : undefined;
}

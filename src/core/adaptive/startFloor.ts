// Start-floor lift for the parent profile page. Pure: no DOM, no Phaser, no storage driver.
//
// The profile page has no per-game level controls. Two age5-only options move the START of a game: `challenging`
// difficulty (+2 for every language) and `startFrenchHigher` (+1 for `fr`). `startingLevel` applies them to games the
// child has not started yet; this module raises the games she already started so the parent sees the effect at once.
// It only ever raises a level (a lift, not a reset: item history, streak and recent window are kept), and turning an
// option off never lowers anything.
import { startingLevel, type StartPrefs } from './rules';
import type { AgeTrack, GameLevelsMeta, SkillKey, SkillState } from './types';
import { skillKey } from './skillSession';

/** A game as far as the lift needs it: its content ids, supported languages, and level metadata. */
export interface SkillGame {
  world: string;
  gameId: string;
  languages: readonly string[];
  meta: GameLevelsMeta;
}

export interface SkillMetaRef {
  meta: GameLevelsMeta;
  lang: string;
}

/** Stored skill key -> its game meta and language. Keys that are not in the index are never touched. */
export type SkillMetaIndex = ReadonlyMap<SkillKey, SkillMetaRef>;

/** `all` = every language of every game; `fr` = French skills only. */
export type LiftScope = 'all' | 'fr';

export function buildSkillMetaIndex(games: readonly SkillGame[]): SkillMetaIndex {
  const index = new Map<SkillKey, SkillMetaRef>();
  for (const game of games) {
    for (const lang of game.languages) index.set(skillKey(game.world, game.gameId, lang), { meta: game.meta, lang });
  }
  return index;
}

/**
 * What a change of the age5 start options should lift, or null for nothing. Only switching an option ON lifts:
 * `challenging` lifts every language, French-higher lifts French only (both at once lift every language).
 * age2 never lifts.
 */
export function liftScopeFor(track: AgeTrack, prev: StartPrefs, next: StartPrefs): LiftScope | null {
  if (track !== 'age5') return null;
  if (prev.difficulty !== 'challenging' && next.difficulty === 'challenging') return 'all';
  if (prev.startFrenchHigher !== true && next.startFrenchHigher === true) return 'fr';
  return null;
}

/**
 * Raises every STARTED skill of a known game that sits below its new start floor (`startingLevel` with the new prefs,
 * clamped to the age5 bounds). Skills at or above the floor, unknown keys, and unstarted games are left alone; no key is
 * ever created. `scope: 'fr'` limits the lift to French skills. Returns the input object itself when nothing changed.
 */
export function liftStartedSkills(
  skills: Readonly<Record<SkillKey, SkillState>>,
  index: SkillMetaIndex,
  track: AgeTrack,
  prefs: StartPrefs,
  scope: LiftScope,
): { skills: Record<SkillKey, SkillState>; lifted: SkillKey[] } {
  const lifted: SkillKey[] = [];
  if (track !== 'age5') return { skills, lifted };
  const next: Record<SkillKey, SkillState> = { ...skills };
  for (const [key, skill] of Object.entries(skills)) {
    const ref = index.get(key);
    if (!ref || (scope === 'fr' && ref.lang !== 'fr')) continue;
    const floor = startingLevel(ref.meta, track, ref.lang, prefs);
    if (skill.level < floor) {
      next[key] = { ...skill, level: floor };
      lifted.push(key);
    }
  }
  return lifted.length > 0 ? { skills: next, lifted } : { skills, lifted };
}

/** The slice of `AdaptiveStore` the lift needs. */
export interface SkillStoreLike {
  getProfile(profileId: string): { skills: Readonly<Record<SkillKey, SkillState>> };
  setSkill(profileId: string, key: SkillKey, skill: SkillState): void;
  persist(profileId: string): void;
}

/** Lifts one profile's started skills in the store and persists it immediately. Returns how many skills were raised. */
export function liftProfileSkills(
  store: SkillStoreLike,
  profileId: string,
  index: SkillMetaIndex,
  track: AgeTrack,
  prefs: StartPrefs,
  scope: LiftScope,
): number {
  const { skills, lifted } = liftStartedSkills(store.getProfile(profileId).skills, index, track, prefs, scope);
  if (lifted.length === 0) return 0;
  for (const key of lifted) store.setSkill(profileId, key, skills[key]);
  store.persist(profileId);
  return lifted.length;
}

// What a parent's edit on a child's profile page does to the saved state (no DOM, no Phaser).
import { liftProfileSkills, liftScopeFor, type SkillMetaIndex, type SkillStoreLike } from '../core/adaptive';
import type { ProfileSettings, AppState } from '../core/storage/schema';
import type { ParentProfileEdit } from './parent';

/** Copies the edited fields onto the stored profile. An empty name keeps the old one. */
export function applyProfileEdit(profiles: ProfileSettings[], edit: ParentProfileEdit): ProfileSettings | undefined {
  const p = profiles.find((pr) => pr.id === edit.id);
  if (!p) return undefined;
  if (edit.name) p.name = edit.name;
  p.ageTrack = edit.ageTrack;
  p.languages = edit.languages;
  p.startFrenchHigher = edit.startFrenchHigher;
  p.difficulty = edit.difficulty;
  return p;
}

/**
 * Applies one profile-page edit and, when an age5 profile just switched `מאתגר` or French-higher ON, raises that
 * child's already-started skills that sit below the new start floor (persisted at once). Switching an option off,
 * or changing only the name, language or age track, never rewrites a skill. Returns how many skills were raised.
 */
export function commitProfileEdit(
  state: Pick<AppState, 'profiles'>,
  edit: ParentProfileEdit,
  adaptive: SkillStoreLike,
  index: SkillMetaIndex,
): number {
  const before = state.profiles.find((pr) => pr.id === edit.id);
  const prev = { difficulty: before?.difficulty, startFrenchHigher: before?.startFrenchHigher === true };
  if (!applyProfileEdit(state.profiles, edit)) return 0;
  const next = { difficulty: edit.difficulty, startFrenchHigher: edit.startFrenchHigher };
  const scope = liftScopeFor(edit.ageTrack, prev, next);
  return scope ? liftProfileSkills(adaptive, edit.id, index, edit.ageTrack, next, scope) : 0;
}

/** "איפוס התקדמות": drops this child's saved skills only. Profile settings, leisure balance and stars are not touched. */
export function resetProfileProgress(adaptive: { clearSkills(profileId: string): void; persist(profileId: string): void }, profileId: string): void {
  adaptive.clearSkills(profileId);
  adaptive.persist(profileId);
}

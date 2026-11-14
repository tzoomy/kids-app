import type { AppContext } from '../game/appContext';
import type { GamePickerOptions } from '../ui/picker/gamePicker';
import { WORLD_GAMES } from '../ui/picker/pickerModel';
import { buildTrail, collectTrailGames, type Station, type WorldEntry } from '../ui/picker/trailModel';

/**
 * The active profile's station trail for a world (docs/specs/station-trail.md). Stations come from the game
 * registry and the content bundle; stars and the suggestion come from the profile's stored adaptive skills.
 * Read-only: nothing is written.
 */
export function stationsForActiveProfile(context: AppContext, worldId: string): Station[] {
  const profileId = context.requireProfileId();
  return buildTrail({
    worldId,
    registry: WORLD_GAMES,
    games: collectTrailGames(context.content as unknown as Record<string, unknown>),
    skills: context.adaptive.getProfile(profileId).skills,
    track: context.currentAgeTrack(),
  });
}

/** The picker options a world entry opens (everything of `GamePickerOptions` except the callbacks). */
export type WorldPickerOptions = Pick<GamePickerOptions, 'games' | 'stations' | 'title' | 'emptyText'>;

/**
 * What a world building tap shows for a `WorldEntry`:
 * - `none` (no game yet): the empty coming-soon picker, `games: []` plus the empty text;
 * - `picker` (2+ games): the station trail picker;
 * - `direct` (one game): no picker, the caller enters `entry.game` (returns null).
 */
export function worldPickerOptions(entry: WorldEntry, strings: { title: string; emptyText: string }): WorldPickerOptions | null {
  switch (entry.kind) {
    case 'none':
      return { games: [], title: strings.title, emptyText: strings.emptyText };
    case 'picker':
      return { stations: entry.stations, title: strings.title };
    case 'direct':
      return null;
  }
}

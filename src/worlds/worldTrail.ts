import type { AppContext } from '../game/appContext';
import { WORLD_GAMES } from '../ui/picker/pickerModel';
import { buildTrail, collectTrailGames, type Station } from '../ui/picker/trailModel';

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

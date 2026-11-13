// Pure helper behind the `seedSortingLevel` e2e hook, so a unit test can check it without Phaser.
// Seeds persisted adaptive state only: no leisure state, no game action, no navigation.
import { skillKey } from '../../core/adaptive';
import type { AdaptiveStore } from '../../core/storage/adaptiveStore';

/**
 * Writes `level` (with `cleanStreak: 0`, `recent: []`) to the profile's adaptive skill of the game for every
 * content language (`<world>.<id>.<lang>`), keeping any stored item boxes, then persists.
 */
export function seedAdaptiveLevel(
  adaptive: AdaptiveStore,
  profileId: string,
  game: { world: string; id: string; languages: readonly string[] },
  level: number,
  today: string,
): void {
  for (const lang of game.languages) {
    const key = skillKey(game.world, game.id, lang);
    const stored = adaptive.getSkill(profileId, key);
    adaptive.setSkill(profileId, key, {
      ...(stored ?? { cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: today, items: {} }),
      level,
      cleanStreak: 0,
      recent: [],
    });
  }
  adaptive.persist(profileId);
}

import type { PickerGameId } from '../../../src/ui/picker/pickerModel';

/**
 * Scene source of every picker game id (repo-relative path). Shared by the wardrobe round-hook test,
 * the code-split static test and the build-size guard.
 * Typed as Record<PickerGameId, string>, so adding an id to PickerGameId without listing its scene here
 * is a type error, and the tests that iterate WORLD_GAMES fail on a missing mapping.
 */
export const WORLD_SCENE_SOURCE: Record<PickerGameId, string> = {
  'animal-restaurant': 'src/games/restaurant/RestaurantScene.ts',
  'kitchen-orchestra': 'src/games/orchestra/OrchestraScene.ts',
  'letter-monster': 'src/games/letterMonster/LetterMonsterScene.ts',
  'travel-suitcase': 'src/games/travelSuitcase/SuitcaseScene.ts',
  'sorting-beds': 'src/games/sorting/SortingScene.ts',
  'balloon-pop': 'src/games/balloon/BalloonScene.ts',
  'picnic-train': 'src/games/picnic/PicnicScene.ts',
  'who-is-hiding': 'src/games/hiding/HidingScene.ts',
  'seed-to-flower': 'src/games/seedFlower/SeedFlowerScene.ts',
  'who-lives-here': 'src/games/habitat/HabitatScene.ts',
  'shadow-match': 'src/games/hiding/ShadowScene.ts',
  'potion-lab': 'src/games/potionLab/PotionScene.ts',
  'sink-or-float': 'src/games/sinkFloat/SinkFloatScene.ts',
  'magic-magnet': 'src/games/magicMagnet/MagnetScene.ts',
  // Leisure ids exist on PickerGameId; they are not world games, so they are covered by the
  // "Leisure Corner games do not call recordCompletedRound" test, not by the world-hook test.
  bubbles: 'src/games/bubbles/BubblesScene.ts',
  'leisure-colouring': 'src/games/colouring/ColouringScene.ts',
};

/** The wardrobe scene is not a picker game (it opens from the bear), but it is a lazily loaded game scene too. */
export const WARDROBE_SCENE_SOURCE = 'src/games/wardrobe/WardrobeScene.ts';

/** Every game scene source that must be code-split out of the shell entry. */
export const ALL_SCENE_SOURCES: readonly string[] = [...Object.values(WORLD_SCENE_SOURCE), WARDROBE_SCENE_SOURCE];

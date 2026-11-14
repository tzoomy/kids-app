/** Language House (and other world) stations derived from WORLD_GAMES + content, for e2e. */
import {
  loadAnimalRestaurant,
  loadBalloonPop,
  loadKitchenOrchestra,
  loadLetterMonster,
  loadMagicMagnet,
  loadPotionLab,
  loadSeedToFlower,
  loadSinkOrFloat,
  loadSortingBeds,
  loadTravelSuitcase,
  loadWhosHiding,
} from '../../../src/content/loadContent';
import { WORLD_GAMES, type PickerGame } from '../../../src/ui/picker/pickerModel';
import { collectTrailGames, stationGamesForWorld } from '../../../src/ui/picker/trailModel';

const TRAIL_GAMES = collectTrailGames({
  restaurant: loadAnimalRestaurant(),
  orchestra: loadKitchenOrchestra(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  sorting: loadSortingBeds(),
  balloon: loadBalloonPop(),
  hiding: loadWhosHiding(),
  seedToFlower: loadSeedToFlower(),
  potion: loadPotionLab(),
  sinkOrFloat: loadSinkOrFloat(),
  magicMagnet: loadMagicMagnet(),
});

/** Stations of a world, in registry order. Counts and ids come from the registry, not a hardcoded list. */
export function stationsForWorld(worldId: string): readonly PickerGame[] {
  return stationGamesForWorld(worldId, WORLD_GAMES, TRAIL_GAMES);
}

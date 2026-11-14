import worldsJson from './worlds.json';
import animalRestaurantJson from './games/animal-restaurant.json';
import kitchenOrchestraJson from './games/kitchen-orchestra.json';
import sortingBedsJson from './games/sorting-beds.json';
import picnicTrainJson from './games/picnic-train.json';
import whosHidingJson from './games/who-is-hiding.json';
import leisureColouringJson from './games/leisure-colouring.json';
import letterMonsterJson from './games/letter-monster.json';
import balloonPopJson from './games/balloon-pop.json';
import travelSuitcaseJson from './games/travel-suitcase.json';
import seedToFlowerJson from './games/seed-to-flower.json';
import potionLabJson from './games/potion-lab.json';
import sinkOrFloatJson from './games/sink-or-float.json';
import magicMagnetJson from './games/magic-magnet.json';
import heJson from './i18n/he.json';
import audioManifestJson from './audio-manifest.json';
import {
  WorldsFileSchema,
  AnimalRestaurantContentSchema,
  KitchenOrchestraContentSchema,
  SortingBedsContentSchema,
  PicnicTrainContentSchema,
  WhosHidingContentSchema,
  LeisureColouringContentSchema,
  LetterMonsterContentSchema,
  BalloonPopContentSchema,
  PotionLabContentSchema,
  SinkOrFloatContentSchema,
  TravelSuitcaseContentSchema,
  SeedToFlowerContentSchema,
  MagicMagnetContentSchema,
  type WorldsFile,
  type AnimalRestaurantContent,
  type KitchenOrchestraContent,
  type SortingBedsContent,
  type PicnicTrainContent,
  type WhosHidingContent,
  type LeisureColouringContent,
  type LetterMonsterContent,
  type BalloonPopContent,
  type TravelSuitcaseContent,
  type SeedToFlowerContent,
  type PotionLabContent,
  type SinkOrFloatContent,
  type MagicMagnetContent,
} from './schema';
import type { AudioManifest } from '../core/audio/types';

/** Validates content once at module load. A broken content file fails fast, not at runtime on a tablet. */
export function loadWorlds(): WorldsFile {
  return WorldsFileSchema.parse(worldsJson);
}

export function loadAnimalRestaurant(): AnimalRestaurantContent {
  return AnimalRestaurantContentSchema.parse(animalRestaurantJson);
}

export function loadWhosHiding(): WhosHidingContent {
  return WhosHidingContentSchema.parse(whosHidingJson);
}

export function loadHeStrings(): typeof heJson {
  return heJson;
}

export function loadKitchenOrchestra(): KitchenOrchestraContent {
  return KitchenOrchestraContentSchema.parse(kitchenOrchestraJson);
}

export function loadSortingBeds(): SortingBedsContent {
  return SortingBedsContentSchema.parse(sortingBedsJson);
}

export function loadPicnicTrain(): PicnicTrainContent {
  return PicnicTrainContentSchema.parse(picnicTrainJson);
}

export function loadLeisureColouring(): LeisureColouringContent {
  return LeisureColouringContentSchema.parse(leisureColouringJson);
}

export function loadLetterMonster(): LetterMonsterContent {
  return LetterMonsterContentSchema.parse(letterMonsterJson);
}

export function loadBalloonPop(): BalloonPopContent {
  return BalloonPopContentSchema.parse(balloonPopJson);
}

export function loadPotionLab(): PotionLabContent {
  return PotionLabContentSchema.parse(potionLabJson);
}

export function loadSinkOrFloat(): SinkOrFloatContent {
  return SinkOrFloatContentSchema.parse(sinkOrFloatJson);
}

export function loadTravelSuitcase(): TravelSuitcaseContent {
  return TravelSuitcaseContentSchema.parse(travelSuitcaseJson);
}

export function loadSeedToFlower(): SeedToFlowerContent {
  return SeedToFlowerContentSchema.parse(seedToFlowerJson);
}

export function loadMagicMagnet(): MagicMagnetContent {
  return MagicMagnetContentSchema.parse(magicMagnetJson);
}

export function loadAudioManifest(): AudioManifest {
  const manifest: AudioManifest = {};
  for (const [key, value] of Object.entries(audioManifestJson)) {
    if (key === '_comment') continue;
    manifest[key] = value as string;
  }
  return manifest;
}

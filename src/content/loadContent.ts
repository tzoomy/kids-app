import worldsJson from './worlds.json';
import animalRestaurantJson from './games/animal-restaurant.json';
import kitchenOrchestraJson from './games/kitchen-orchestra.json';
import sortingBedsJson from './games/sorting-beds.json';
import whosHidingJson from './games/who-is-hiding.json';
import leisureColouringJson from './games/leisure-colouring.json';
import shadowMatchJson from './games/shadow-match.json';
import heJson from './i18n/he.json';
import audioManifestJson from './audio-manifest.json';
import {
  WorldsFileSchema,
  AnimalRestaurantContentSchema,
  KitchenOrchestraContentSchema,
  SortingBedsContentSchema,
  WhosHidingContentSchema,
  LeisureColouringContentSchema,
  ShadowMatchContentSchema,
  type WorldsFile,
  type AnimalRestaurantContent,
  type KitchenOrchestraContent,
  type SortingBedsContent,
  type WhosHidingContent,
  type LeisureColouringContent,
  type ShadowMatchContent,
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

export function loadLeisureColouring(): LeisureColouringContent {
  return LeisureColouringContentSchema.parse(leisureColouringJson);
}

/** Shadow Match content. Its animals come from Who's Hiding? (`animalsFrom`); every animal needs a Hebrew name. */
export function loadShadowMatch(): ShadowMatchContent {
  const content = ShadowMatchContentSchema.parse(shadowMatchJson);
  const animals = loadWhosHiding().animals;
  for (const a of animals) {
    if (!content.namesHe[a.id]) throw new Error(`shadow-match: missing Hebrew name for "${a.id}"`);
  }
  for (const level of content.adaptive.levels) {
    if ((level.choiceCount ?? 0) > animals.length) throw new Error('shadow-match: choiceCount exceeds the number of animals');
  }
  return content;
}

export function loadAudioManifest(): AudioManifest {
  const manifest: AudioManifest = {};
  for (const [key, value] of Object.entries(audioManifestJson)) {
    if (key === '_comment') continue;
    manifest[key] = value as string;
  }
  return manifest;
}

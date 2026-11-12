import worldsJson from './worlds.json';
import animalRestaurantJson from './games/animal-restaurant.json';
import kitchenOrchestraJson from './games/kitchen-orchestra.json';
import heJson from './i18n/he.json';
import audioManifestJson from './audio-manifest.json';
import { WorldsFileSchema, AnimalRestaurantContentSchema, KitchenOrchestraContentSchema, type WorldsFile, type AnimalRestaurantContent, type KitchenOrchestraContent } from './schema';
import type { AudioManifest } from '../core/audio/types';

/** Validates content once at module load. A broken content file fails fast, not at runtime on a tablet. */
export function loadWorlds(): WorldsFile {
  return WorldsFileSchema.parse(worldsJson);
}

export function loadAnimalRestaurant(): AnimalRestaurantContent {
  return AnimalRestaurantContentSchema.parse(animalRestaurantJson);
}

export function loadHeStrings(): typeof heJson {
  return heJson;
}

export function loadKitchenOrchestra(): KitchenOrchestraContent {
  return KitchenOrchestraContentSchema.parse(kitchenOrchestraJson);
}

export function loadAudioManifest(): AudioManifest {
  const manifest: AudioManifest = {};
  for (const [key, value] of Object.entries(audioManifestJson)) {
    if (key === '_comment') continue;
    manifest[key] = value as string;
  }
  return manifest;
}

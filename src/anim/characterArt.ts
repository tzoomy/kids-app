// Phaser side of character art resolution: ensures the fallback texture exists.
import type Phaser from 'phaser';
import { drawAnimal } from '../assets/vectorArt';
import { FALLBACK_SIZE, fallbackTextureKey, planCharacterArt, type CharacterArtPlan } from './fallbackRig';

/** Makes sure the drawAnimal texture exists (drawn once per game, then reused). */
export function ensureFallbackTexture(scene: Phaser.Scene, kind: string, size = FALLBACK_SIZE): string {
  const key = fallbackTextureKey(kind, size);
  if (!scene.textures.exists(key)) drawAnimal(scene, kind, size).destroy();
  return key;
}

export function resolveCharacterArt(scene: Phaser.Scene, kind: string): CharacterArtPlan {
  const plan = planCharacterArt(kind, (key) => scene.textures.exists(key));
  if (plan.fallback) ensureFallbackTexture(scene, kind);
  return plan;
}

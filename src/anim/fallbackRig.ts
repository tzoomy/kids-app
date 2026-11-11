// Single-part fallback rig built on the procedural `drawAnimal` texture, used whenever
// no layered rig is registered (or its textures failed to load) for a kind.
// Pure (no Phaser): the texture itself is ensured in characterArt.ts.
import type { AnimalRig } from './rigTypes';
import { getAnimalRig, rigTextureKeys } from './artRegistry';

/** Size passed to drawAnimal. The generated texture is 1.8x this, centered on the body. */
export const FALLBACK_SIZE = 260;

// drawAnimal geometry (see src/assets/vectorArt.ts): the texture is a square of side
// 1.8*size centered on the drawing origin; the feet (bottom of the body circle) sit at
// +0.525*size and the smile at about -0.216*size relative to that origin.
const TEXTURE_RATIO = 1.8;
const FEET_BELOW_CENTER = 0.525;
const MOUTH_ABOVE_CENTER = 0.216;
const HEAD_ABOVE_CENTER = 0.26;
/** Visible character height (ear tips to feet) as a ratio of size. */
const VISIBLE_HEIGHT_RATIO = 1.2;

export function fallbackTextureKey(kind: string, size = FALLBACK_SIZE): string {
  return `animal-${kind}-${size}`;
}

/** An AnimalRig with one `body` part whose pivot is the feet. */
export function fallbackRigFor(kind: string, size = FALLBACK_SIZE): AnimalRig {
  const side = size * TEXTURE_RATIO;
  const key = fallbackTextureKey(kind, size);
  return {
    kind,
    height: size * VISIBLE_HEIGHT_RATIO,
    parts: {
      body: {
        key,
        x: 0,
        y: 0,
        originX: 0.5,
        originY: (side / 2 + size * FEET_BELOW_CENTER) / side,
        width: side,
        height: side,
        depth: 0,
      },
    },
    eyeClosedKey: key,
    mouthKeys: { smile: key, open: key, hmm: key },
  };
}

/** Mouth and head anchors relative to the feet, reference px (y negative = up). */
export function fallbackAnchors(size = FALLBACK_SIZE): { mouthY: number; headY: number } {
  return {
    mouthY: -(FEET_BELOW_CENTER + MOUTH_ABOVE_CENTER) * size,
    headY: -(FEET_BELOW_CENTER + HEAD_ABOVE_CENTER) * size,
  };
}

export interface CharacterArtPlan {
  rig: AnimalRig;
  /** Rig file key ("ear-left") -> loaded texture key. */
  textures: Record<string, string>;
  fallback: boolean;
}

/**
 * Chooses between the registered layered rig and the single-image fallback. The layered
 * rig is used only when every texture it needs is registered and actually loaded, so a
 * missing SVG can never produce a half-drawn animal.
 */
export function planCharacterArt(kind: string, textureExists: (key: string) => boolean): CharacterArtPlan {
  const rig = getAnimalRig(kind);
  if (rig) {
    const textures = rigTextureKeys(rig);
    if (textures && Object.values(textures).every(textureExists)) return { rig, textures, fallback: false };
  }
  const fb = fallbackRigFor(kind);
  const key = fb.parts.body.key;
  return { rig: fb, textures: { [key]: key }, fallback: true };
}

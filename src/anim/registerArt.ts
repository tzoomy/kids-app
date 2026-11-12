// The single place where project art is plugged into the animation system.
// Gemini's layered SVG art (src/assets/art/rigs.ts + manifest.ts) is registered here;
// anything missing still falls back to the procedural art in src/assets/vectorArt.ts.
import { ANIMAL_RIGS, CHARACTER_RIGS } from '../assets/art/rigs';
import { ART_MANIFEST } from '../assets/art/manifest';
import { initMotionPreference } from './motion';
import { registerAnimalRigs, registerArtManifest } from './artRegistry';

let registered = false;

export function registerProjectArt(): void {
  if (registered) return;
  registered = true;
  initMotionPreference();
  registerAnimalRigs(ANIMAL_RIGS);
  registerAnimalRigs(CHARACTER_RIGS);
  registerArtManifest(ART_MANIFEST);
}

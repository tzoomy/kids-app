// The single place where project art is plugged into the animation system.
// When the art branch lands (src/assets/art/rigs.ts and src/assets/art/manifest.ts),
// uncomment the imports and the two register calls below. Until then every lookup
// falls back to the procedural art in src/assets/vectorArt.ts.
//
// import { ANIMAL_RIGS } from '../assets/art/rigs';
// import { ART_MANIFEST } from '../assets/art/manifest';
import { initMotionPreference } from './motion';
// import { registerAnimalRigs, registerArtManifest } from './artRegistry';

let registered = false;

export function registerProjectArt(): void {
  if (registered) return;
  registered = true;
  initMotionPreference();
  // registerAnimalRigs(ANIMAL_RIGS);
  // registerArtManifest(ART_MANIFEST);
}

// Lazy loading of the wardrobe art for a dressed bear (docs/specs/wardrobe.md AC-17). Never at boot: scenes call this
// only when a bear is about to wear something. Phaser-free at runtime (type-only import; 'complete' is
// Phaser.Loader.Events.COMPLETE).
import type Phaser from 'phaser';
import type { WardrobeItem } from '../../assets/art/wardrobeManifest';
import { queueArtManifest } from '../../anim/assetLoader';
import { outfitArtEntries } from './dress';

/**
 * Queues the art of the worn items that is not loaded yet. Returns false when nothing needed loading (the caller has
 * already dressed with everything available); otherwise `onLoaded` runs once the loader finishes. The caller's
 * `dressCharacter` call is a no-op if the Character was destroyed meanwhile (scene left), so no extra guard is needed.
 */
export function loadOutfitArt(scene: Phaser.Scene, kind: string, items: readonly WardrobeItem[], onLoaded: () => void): boolean {
  const queued = queueArtManifest(scene, outfitArtEntries(kind, items), import.meta.env.BASE_URL);
  if (queued === 0) return false;
  scene.load.once('complete', onLoaded);
  scene.load.start();
  return true;
}

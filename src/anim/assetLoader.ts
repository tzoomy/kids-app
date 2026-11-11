// Queues every SVG in the registered art manifest on a Phaser loader. Missing files
// only log a warning; the PreloadScene also has a hard timeout so it never blocks.
import type Phaser from 'phaser';
import type { ArtManifestEntry } from './rigTypes';

/** Joins the Vite base URL ("/kids-app/") with a relative asset url ("art/x.svg"). */
export function assetUrl(base: string, url: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${url.replace(/^\.?\//, '')}`;
}

/** Returns how many files were queued (already-loaded keys are skipped). */
export function queueArtManifest(scene: Phaser.Scene, entries: readonly ArtManifestEntry[], base: string): number {
  let queued = 0;
  for (const e of entries) {
    if (scene.textures.exists(e.key)) continue;
    scene.load.svg(e.key, assetUrl(base, e.url), { width: e.width, height: e.height });
    queued++;
  }
  return queued;
}

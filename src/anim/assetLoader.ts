// Queues every SVG in the registered art manifest on a Phaser loader. Missing files
// only log a warning; the PreloadScene also has a hard timeout so it never blocks.
import type Phaser from 'phaser';
import type { ArtManifestEntry } from './rigTypes';

/** Joins the Vite base URL ("/kids-app/") with a relative asset url ("art/x.svg"). */
export function assetUrl(base: string, url: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${url.replace(/^\.?\//, '')}`;
}

/** True for a full-screen background of the orientation that is not in use (e.g. `*-bg-portrait` on a landscape canvas). */
export function isInactiveOrientationKey(key: string, landscape: boolean): boolean {
  return landscape ? key.endsWith('-bg-portrait') : key.endsWith('-bg-landscape');
}

/**
 * Returns how many files were queued (already-loaded keys are skipped). The canvas size is
 * fixed at boot, so backgrounds for the other orientation are never loaded.
 */
export function queueArtManifest(
  scene: Phaser.Scene,
  entries: readonly ArtManifestEntry[],
  base: string,
  landscape: boolean = scene.scale.width >= scene.scale.height,
): number {
  let queued = 0;
  for (const e of entries) {
    if (scene.textures.exists(e.key) || isInactiveOrientationKey(e.key, landscape)) continue;
    scene.load.svg(e.key, assetUrl(base, e.url), { width: e.width, height: e.height });
    queued++;
  }
  return queued;
}

// Pluggable art source. Pure (no Phaser). Today nothing is registered, so every lookup
// falls back to the procedural art in src/assets/vectorArt.ts. When the art branch
// lands, wiring it in is two lines in src/anim/registerArt.ts:
//   registerAnimalRigs(ANIMAL_RIGS);
//   registerArtManifest(ART_MANIFEST);
import type { AnimalRig, ArtManifestEntry } from './rigTypes';

let rigs: Record<string, AnimalRig> = {};
let manifest: ArtManifestEntry[] = [];
let byUrl = new Map<string, ArtManifestEntry>();

function normalizeUrl(url: string): string {
  return url.replace(/^\.?\//, '');
}

export function registerAnimalRigs(next: Record<string, AnimalRig>): void {
  rigs = { ...rigs, ...next };
}

export function registerArtManifest(entries: readonly ArtManifestEntry[]): void {
  for (const e of entries) {
    const entry = { ...e, url: normalizeUrl(e.url) };
    const existing = manifest.findIndex((m) => m.key === entry.key);
    if (existing >= 0) manifest[existing] = entry;
    else manifest.push(entry);
    byUrl.set(entry.url, entry);
  }
}

/** Test helper: forget everything registered. */
export function resetArtRegistry(): void {
  rigs = {};
  manifest = [];
  byUrl = new Map();
}

export function getArtManifest(): readonly ArtManifestEntry[] {
  return manifest;
}

export function getAnimalRig(kind: string): AnimalRig | undefined {
  return rigs[kind];
}

export function registeredAnimalKinds(): string[] {
  return Object.keys(rigs);
}

/** Texture key of the manifest entry at a relative url, if registered. */
export function keyForUrl(url: string): string | undefined {
  return byUrl.get(normalizeUrl(url))?.key;
}

/** Part keys are file names ("ear-left") and repeat across kinds, so resolve by path. */
export function animalPartKey(kind: string, partKey: string): string | undefined {
  return keyForUrl(`art/animals/${kind}/${partKey}.svg`) ?? keyForUrl(`art/characters/${kind}/${partKey}.svg`);
}

export function foodArtKey(foodId: string): string | undefined {
  return keyForUrl(`art/foods/${foodId}.svg`);
}

export function propArtKey(name: string): string | undefined {
  return keyForUrl(`art/props/${name}.svg`);
}

export function sceneArtKey(scene: string, name: string): string | undefined {
  return keyForUrl(`art/scenes/${scene}/${name}.svg`);
}

export function fxArtKey(name: string): string | undefined {
  return keyForUrl(`art/fx/${name}.svg`);
}

export function instrumentArtKey(name: string): string | undefined {
  return keyForUrl(`art/instruments/${name}.svg`);
}

export function puppetArtKey(name: string): string | undefined {
  return keyForUrl(`art/puppet/${name}.svg`);
}

export function coloringArtKey(name: string): string | undefined {
  return keyForUrl(`art/coloring/${name}.svg`);
}

export function paletteArtKey(name: string): string | undefined {
  return keyForUrl(`art/palette/${name}.svg`);
}


/**
 * Lists every texture key a rig needs (parts plus the eye-closed and mouth variants),
 * or undefined when any of them is not in the manifest. The Character uses this to
 * decide between the full rig and the single-image fallback.
 */
export function rigTextureKeys(rig: AnimalRig): Record<string, string> | undefined {
  const out: Record<string, string> = {};
  const fileKeys = new Set<string>([
    ...Object.values(rig.parts).map((p) => p.key),
    rig.eyeClosedKey,
    rig.mouthKeys.smile,
    rig.mouthKeys.open,
    rig.mouthKeys.hmm,
  ]);
  for (const fileKey of fileKeys) {
    const key = animalPartKey(rig.kind, fileKey);
    if (!key) return undefined;
    out[fileKey] = key;
  }
  return out;
}

// Wardrobe Pass 2 (docs/specs/wardrobe.md AC-14..AC-17): dresses the bear Characters (map mascot, games) with the
// current profile's outfit through Character.setAccessories. Phaser-free at runtime: scenes, characters and images are
// duck-typed (type-only imports), so the unit tests drive it with plain fakes.
import type Phaser from 'phaser';
import type { StorageDriver } from '../storage/store';
import type { AgeTrack } from '../storage/schema';
import { WARDROBE_ART_MANIFEST, wardrobeArtKey, type WardrobeItem } from '../../assets/art/wardrobeManifest';
import type { ArtManifestEntry } from '../../assets/art/manifest';
import { layoutOutfit, type PlacedItem } from './layout';
import { wornItems } from './model';
import { loadWardrobeState } from './store';

/** Only the bear wears the outfit (the Wardrobe character); animals, the chef and habitat animals stay as drawn. */
export function wearsOutfit(kind: string): boolean {
  return kind === 'bear';
}

export function outfitPlacements(kind: string, items: readonly WardrobeItem[]): PlacedItem[] {
  return wearsOutfit(kind) ? layoutOutfit(kind, items) : [];
}

/** The manifest entries to lazy-load for the worn items (never loaded at boot). */
export function outfitArtEntries(kind: string, items: readonly WardrobeItem[]): ArtManifestEntry[] {
  const keys = new Set(outfitPlacements(kind, items).map((p) => wardrobeArtKey(p.itemId)));
  return WARDROBE_ART_MANIFEST.filter((e) => keys.has(e.key));
}

export function currentOutfitItems(storage: Pick<StorageDriver, 'getItem'>, profileId: string, track: AgeTrack): WardrobeItem[] {
  return wornItems(loadWardrobeState(storage, profileId), track);
}

type Layer = Phaser.GameObjects.GameObject[];
interface DressImage {
  setOrigin(x: number, y?: number): unknown;
  setScale(s: number): unknown;
  setAngle(a: number): unknown;
  setFlipX(f: boolean): unknown;
}
interface DressScene {
  textures: { exists(key: string): boolean };
  make: { image(cfg: { key: string; x: number; y: number; add: boolean }): DressImage };
  scene?: { key: string };
  events?: { once(event: string, fn: () => void): unknown };
}
interface DressCharacter {
  setAccessories(layers: { behindHead: Layer; head: Layer; front: Layer }): void;
  root?: { x: number; y: number; scene?: unknown };
  displaySize?(): { width: number; height: number };
}

/** A bear Character that went through `dressCharacter`, for the e2e hook (read only). */
export interface DressedBear {
  sceneKey: string;
  /** Item ids actually mounted on the Character, in draw order. */
  items: string[];
  /** Bounds in game coordinates (feet at root.x/root.y); null when the Character cannot report them. */
  bounds(): { x: number; y: number; width: number; height: number } | null;
}

const dressedBears = new Map<DressCharacter, DressedBear>();

/** Bears that are still alive (their Character was not destroyed). Registry entries die with their Character. */
export function listDressedBears(): DressedBear[] {
  for (const character of [...dressedBears.keys()]) {
    if (character.root && !character.root.scene) dressedBears.delete(character);
  }
  return [...dressedBears.values()];
}

/**
 * Mounts the outfit on a bear Character and returns the item ids actually mounted, in draw order. A non-bear is left
 * alone. An empty outfit still calls `setAccessories` so stale accessories are cleared. Images are never interactive,
 * so the outfit never blocks a tap. Items whose art has not loaded yet are skipped.
 */
export function dressCharacter(scene: Phaser.Scene, character: unknown, kind: string, items: readonly WardrobeItem[]): string[] {
  if (!wearsOutfit(kind)) return [];
  const s = scene as unknown as DressScene;
  const c = character as DressCharacter;
  if (c.root && !c.root.scene) return []; // destroyed while the art was loading
  const layers = { behindHead: [] as Layer, head: [] as Layer, front: [] as Layer };
  const mounted: string[] = [];
  for (const p of outfitPlacements(kind, items)) {
    const item = items.find((i) => i.id === p.itemId);
    const key = wardrobeArtKey(p.itemId);
    if (!item || !s.textures.exists(key)) continue;
    const img = s.make.image({ key, x: p.left + p.originX, y: p.top + p.originY, add: false });
    img.setOrigin(item.pivot.x, item.pivot.y);
    img.setScale(p.scale);
    img.setAngle(p.rotate);
    img.setFlipX(p.flipX);
    layers[p.band].push(img as unknown as Phaser.GameObjects.GameObject);
    mounted.push(p.itemId);
  }
  c.setAccessories(layers);

  const first = !dressedBears.has(c);
  dressedBears.set(c, {
    sceneKey: s.scene?.key ?? '',
    items: mounted,
    bounds() {
      if (!c.root || !c.displaySize) return null;
      const { width, height } = c.displaySize();
      return { x: c.root.x - width / 2, y: c.root.y - height, width, height };
    },
  });
  if (first) s.events?.once('shutdown', () => dressedBears.delete(c));
  return mounted;
}

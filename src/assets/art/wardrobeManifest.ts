// Wardrobe accessory art keys (docs/contracts/wardrobe-art.md). Art only: no unlock or game logic here.
// Lazy, like the colouring and sticker manifests: load when a wardrobe screen opens, never at boot.
// Status: pending Maor decision / pending Claude alignment.
import type { ArtManifestEntry } from './manifest';
import wardrobeItems from '../../content/wardrobe/items.json';

export type WardrobeSlot = 'head' | 'eyes' | 'neck' | 'headSide';

export interface WardrobeItem {
  id: string;
  slot: WardrobeSlot;
  url: string;
  width: number;
  height: number;
  /** Point of the item (0..1 of its width/height) placed on the slot anchor. */
  pivot: { x: number; y: number };
}

export const WARDROBE_ITEMS = wardrobeItems.items as WardrobeItem[];

export function wardrobeArtKey(itemId: string): string {
  return `wardrobe-${itemId}`;
}

export const WARDROBE_ART_MANIFEST: ArtManifestEntry[] = WARDROBE_ITEMS.map((item) => ({
  key: wardrobeArtKey(item.id),
  url: item.url,
  width: item.width,
  height: item.height,
}));

// Wardrobe layout and layering (docs/contracts/wardrobe-art.md, docs/specs/wardrobe.md AC-07).
// Pure math, no Phaser: turns a character kind and worn items into placements in draw order.
import anchorsJson from '../../content/wardrobe/anchors.json';
import { WARDROBE_SLOT_ORDER, type WardrobeItem, type WardrobeSlot } from '../../assets/art/wardrobeManifest';

export interface SlotAnchor {
  /** `head` (the rig's head pivot) or `body` (the feet centre). */
  attach: string;
  x: number;
  y: number;
  scale: number;
  rotate: number;
  layer?: 'front';
}

export interface AnchorsFile {
  characters: Record<string, { rig: string; slots: Partial<Record<WardrobeSlot, SlotAnchor | null>> }>;
}

/** back to front: between body and head, inside the head group above the head parts, above the head group. */
export type PlacedBand = 'behindHead' | 'head' | 'front';

export interface PlacedItem {
  itemId: string;
  slot: WardrobeSlot;
  attach: 'head' | 'body';
  band: PlacedBand;
  /** Top-left of the item relative to the attach origin: anchor - pivot * size. */
  left: number;
  top: number;
  /** The pivot in item px: the rotate and scale origin (it lands on the anchor). */
  originX: number;
  originY: number;
  scale: number;
  rotate: number;
  /** Always false in Pass 1: no mirroring. */
  flipX: false;
}

const BAND_RANK: Record<PlacedBand, number> = { behindHead: 0, head: 1, front: 2 };

const DEFAULT_ANCHORS = anchorsJson as unknown as AnchorsFile;

export function slotAnchor(kind: string, slot: WardrobeSlot, anchors: AnchorsFile = DEFAULT_ANCHORS): SlotAnchor | null {
  return anchors.characters[kind]?.slots[slot] ?? null;
}

function bandOf(anchor: SlotAnchor): PlacedBand {
  if (anchor.layer === 'front') return 'front';
  return anchor.attach === 'body' ? 'behindHead' : 'head';
}

/** Placements for the worn items in draw order. Items without an anchor (chef head, unfitted characters) are skipped. */
export function layoutOutfit(kind: string, items: readonly WardrobeItem[], anchors: AnchorsFile = DEFAULT_ANCHORS): PlacedItem[] {
  const placed: PlacedItem[] = [];
  for (const item of items) {
    const anchor = slotAnchor(kind, item.slot, anchors);
    if (!anchor) continue;
    placed.push({
      itemId: item.id,
      slot: item.slot,
      attach: anchor.attach === 'body' ? 'body' : 'head',
      band: bandOf(anchor),
      left: anchor.x - item.pivot.x * item.width,
      top: anchor.y - item.pivot.y * item.height,
      originX: item.pivot.x * item.width,
      originY: item.pivot.y * item.height,
      scale: anchor.scale,
      rotate: anchor.rotate,
      flipX: false,
    });
  }
  return placed.sort(
    (a, b) => BAND_RANK[a.band] - BAND_RANK[b.band] || WARDROBE_SLOT_ORDER.indexOf(a.slot) - WARDROBE_SLOT_ORDER.indexOf(b.slot),
  );
}

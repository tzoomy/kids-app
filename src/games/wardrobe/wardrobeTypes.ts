// Wardrobe hook and snapshot types (docs/specs/wardrobe.md). Type-imported by tests/e2e/helpers/journey.ts.
import type { WardrobeSlot } from '../../assets/art/wardrobeManifest';
import type { AgeTrack } from '../../core/storage/schema';

/** Seed for the active profile (?e2e=1 only). Merged over the defaults; the starter is always kept. */
export interface WardrobeSeed {
  unlocked?: string[];
  outfit?: Partial<Record<WardrobeSlot, string>>;
  completed?: Record<string, string[]>;
}

/** Snapshot read by `getWardrobeInfo`: works on the map (sceneActive false) and in the scene. */
export interface WardrobeInfo {
  sceneActive: boolean;
  ageTrack: AgeTrack;
  /** The character shown in the Wardrobe (Pass 1: always the bear). */
  character: string;
  /** Item ids shown at this age. */
  offered: string[];
  /** Saved unlocked item ids. */
  unlocked: string[];
  /** Worn items per slot (saved outfit without locked or not-offered entries). */
  worn: Partial<Record<WardrobeSlot, string>>;
  /** Item ids actually drawn, in draw order. */
  rendered: string[];
  /** Ids unlocked by the latest recorded round in this page session. */
  lastUnlock: string[];
}

/** A bear Character visible in an active scene, as read by `getVisibleBearOutfits` (mounted accessories, not saved state). */
export interface VisibleBearOutfit {
  /** Scene key, e.g. `MapScene` or `RestaurantScene`. */
  scene: string;
  /** Item ids mounted on the bear, in draw order (empty when it wears nothing). */
  items: string[];
  /** Bounds in page CSS px (top-left + size); null when the Character cannot report them. */
  rect: { x: number; y: number; width: number; height: number } | null;
}

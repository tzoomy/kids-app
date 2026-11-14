// Pure snapshot and seed helpers for the Wardrobe hooks (no Phaser, no DOM).
import { layoutOutfit } from '../../core/wardrobe/layout';
import { createWardrobeState, offeredItems, wornItems, type WardrobeState } from '../../core/wardrobe/model';
import type { AgeTrack } from '../../core/storage/schema';
import type { WardrobeInfo, WardrobeSeed } from './wardrobeTypes';

/** Pass 1 shows one character. */
export const WARDROBE_CHARACTER = 'bear';

export function buildWardrobeInfo(
  state: WardrobeState,
  track: AgeTrack,
  lastUnlock: readonly string[],
  sceneActive: boolean,
): WardrobeInfo {
  const worn = wornItems(state, track);
  const outfit: WardrobeInfo['worn'] = {};
  for (const item of worn) outfit[item.slot] = item.id;
  return {
    sceneActive,
    ageTrack: track,
    character: WARDROBE_CHARACTER,
    offered: offeredItems(track).map((i) => i.id),
    unlocked: [...state.unlocked],
    worn: outfit,
    rendered: layoutOutfit(WARDROBE_CHARACTER, worn).map((p) => p.itemId),
    lastUnlock: [...lastUnlock],
  };
}

/** Merges a seed over the defaults; the store sanitises it (unknown ids dropped, starter kept) when it is saved. */
export function applyWardrobeSeed(seed: WardrobeSeed): WardrobeState {
  const base = createWardrobeState();
  return {
    ...base,
    unlocked: [...new Set([...base.unlocked, ...(seed.unlocked ?? [])])],
    outfit: { ...(seed.outfit ?? {}) },
    completed: { ...(seed.completed ?? {}) },
  };
}

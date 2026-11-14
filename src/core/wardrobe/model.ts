// Wardrobe unlock and equip model (docs/specs/wardrobe.md). Pure and immutable: no Phaser, no DOM.
// Unlock rules are a pending Maor decision (team-lead default); see UNLOCK_RULES.
import {
  WARDROBE_ITEMS,
  WARDROBE_EXCLUSIVE_SLOTS,
  WARDROBE_SLOT_ORDER,
  type WardrobeItem,
  type WardrobeSlot,
} from '../../assets/art/wardrobeManifest';
import type { AgeTrack } from '../storage/schema';

export type { WardrobeItem, WardrobeSlot };

export const WARDROBE_SAVE_VERSION = 1 as const;

/** The only world ids whose rounds can unlock anything. Leisure Corner is deliberately absent. */
export const LEARNING_WORLDS = ['language-house', 'number-garden', 'nature-lab', 'science-world', 'art-studio'] as const;

export interface WardrobeState {
  v: typeof WARDROBE_SAVE_VERSION;
  /** Unlocked item ids (starter always included). */
  unlocked: string[];
  /** Worn item per slot. */
  outfit: Partial<Record<WardrobeSlot, string>>;
  /** Distinct completed game ids per learning world (enough to evaluate sun-hat). */
  completed: Record<string, string[]>;
}

export interface CompletedRound {
  worldId: string;
  gameId: string;
}

export interface RoundResult {
  state: WardrobeState;
  newlyUnlocked: string[];
}

interface UnlockContext {
  /** Distinct game ids completed per world. */
  completed: Record<string, string[]>;
  /** Item ids unlocked so far, before this rule runs. */
  unlocked: ReadonlySet<string>;
  /** Items offered to the current age track. */
  offered: readonly WardrobeItem[];
}

/** Item id -> predicate. Pending Maor decision (docs/specs/wardrobe.md, Mechanic). Reverse by editing here and AC-03. */
export const UNLOCK_RULES: Record<string, (ctx: UnlockContext) => boolean> = {
  beanie: (c) => hasWorld(c, 'language-house'),
  scarf: (c) => hasWorld(c, 'number-garden'),
  'party-hat': (c) => hasWorld(c, 'nature-lab'),
  'hair-bow': (c) => hasWorld(c, 'art-studio'),
  glasses: (c) => hasWorld(c, 'nature-lab') || hasWorld(c, 'science-world'),
  'sun-hat': (c) => Object.values(c.completed).some((games) => games.length >= 3),
  // Crown last: every other offered item must already be unlocked.
  crown: (c) => c.offered.filter((i) => i.id !== 'crown').every((i) => c.unlocked.has(i.id)),
};

function hasWorld(c: UnlockContext, worldId: string): boolean {
  return (c.completed[worldId]?.length ?? 0) > 0;
}

const STARTER_IDS = WARDROBE_ITEMS.filter((i) => i.starter).map((i) => i.id);

export function findItem(itemId: string): WardrobeItem | undefined {
  return WARDROBE_ITEMS.find((i) => i.id === itemId);
}

export function createWardrobeState(): WardrobeState {
  return { v: WARDROBE_SAVE_VERSION, unlocked: [...STARTER_IDS], outfit: {}, completed: {} };
}

function ageOf(track: AgeTrack): 2 | 5 {
  return track === 'age2' ? 2 : 5;
}

/** Items shown to an age track (age 2 sees only items whose ages include 2; age 5 sees all). */
export function offeredItems(track: AgeTrack): WardrobeItem[] {
  const age = ageOf(track);
  return WARDROBE_ITEMS.filter((i) => i.ages.includes(age));
}

function isOffered(track: AgeTrack, item: WardrobeItem): boolean {
  return item.ages.includes(ageOf(track));
}

/** Records one completed round, then unlocks whatever the rules now allow. Idempotent; never mutates `state`. */
export function recordCompletedRound(state: WardrobeState, track: AgeTrack, round: CompletedRound): RoundResult {
  const completed: Record<string, string[]> = {};
  for (const [world, games] of Object.entries(state.completed)) completed[world] = [...games];
  if ((LEARNING_WORLDS as readonly string[]).includes(round.worldId)) {
    const games = completed[round.worldId] ?? [];
    if (!games.includes(round.gameId)) games.push(round.gameId);
    completed[round.worldId] = games;
  }

  const offered = offeredItems(track);
  const unlocked = new Set(state.unlocked);
  const newlyUnlocked: string[] = [];
  // Run twice so crown (which depends on the others) is evaluated after the rest in the same round.
  for (let pass = 0; pass < 2; pass += 1) {
    for (const item of offered) {
      if (unlocked.has(item.id)) continue;
      const rule = UNLOCK_RULES[item.id];
      if (rule?.({ completed, unlocked, offered })) {
        unlocked.add(item.id);
        newlyUnlocked.push(item.id);
      }
    }
  }
  return {
    state: { v: WARDROBE_SAVE_VERSION, unlocked: [...unlocked], outfit: { ...state.outfit }, completed },
    newlyUnlocked,
  };
}

/** True when the item can be worn now: known, offered for the age, and unlocked. */
export function canEquip(state: WardrobeState, track: AgeTrack, itemId: string): boolean {
  const item = findItem(itemId);
  return item !== undefined && isOffered(track, item) && state.unlocked.includes(itemId);
}

function withOutfit(state: WardrobeState, outfit: WardrobeState['outfit']): WardrobeState {
  return { ...state, unlocked: [...state.unlocked], completed: state.completed, outfit };
}

/** Puts an item on, replacing the item in its slot (and any slot it excludes). Locked, unoffered and unknown ids change nothing. */
export function equipItem(state: WardrobeState, track: AgeTrack, itemId: string): WardrobeState {
  const item = findItem(itemId);
  if (!item || !canEquip(state, track, itemId)) return withOutfit(state, { ...state.outfit });
  const outfit = { ...state.outfit };
  for (const group of WARDROBE_EXCLUSIVE_SLOTS) {
    if (group.includes(item.slot)) for (const other of group) if (other !== item.slot) delete outfit[other];
  }
  outfit[item.slot] = item.id;
  return withOutfit(state, outfit);
}

export function unequipSlot(state: WardrobeState, slot: WardrobeSlot): WardrobeState {
  const outfit = { ...state.outfit };
  delete outfit[slot];
  return withOutfit(state, outfit);
}

/** Takes the item off if it is worn, otherwise puts it on. */
export function toggleItem(state: WardrobeState, track: AgeTrack, itemId: string): WardrobeState {
  const item = findItem(itemId);
  if (item && state.outfit[item.slot] === itemId) return unequipSlot(state, item.slot);
  return equipItem(state, track, itemId);
}

/** Worn items in slotOrder, without entries that are locked, unknown or not offered for the age. */
export function wornItems(state: WardrobeState, track: AgeTrack): WardrobeItem[] {
  const out: WardrobeItem[] = [];
  for (const slot of WARDROBE_SLOT_ORDER) {
    const id = state.outfit[slot];
    if (!id) continue;
    const item = findItem(id);
    if (item && item.slot === slot && canEquip(state, track, id)) out.push(item);
  }
  return out;
}

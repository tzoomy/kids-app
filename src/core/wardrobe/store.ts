// Wardrobe persistence. No Phaser. Spec: docs/specs/wardrobe.md (AC-04).
// Key: kids-app-wardrobe:<profileId>. Schema: { v: 1, unlocked, outfit, completed }.
import { WARDROBE_SLOT_ORDER } from '../../assets/art/wardrobeManifest';
import type { StorageDriver } from '../storage/store';
import type { AgeTrack } from '../storage/schema';
import {
  LEARNING_WORLDS,
  WARDROBE_SAVE_VERSION,
  createWardrobeState,
  findItem,
  recordCompletedRound,
  type CompletedRound,
  type RoundResult,
  type WardrobeState,
} from './model';

export const WARDROBE_KEY_PREFIX = 'kids-app-wardrobe:';

export function wardrobeKey(profileId: string): string {
  return `${WARDROBE_KEY_PREFIX}${profileId}`;
}

const isRecord = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

/** Field-by-field repair of anything read from storage or passed in: unknown ids and wrong slots are dropped. */
function sanitize(input: unknown): WardrobeState {
  const state = createWardrobeState();
  if (!isRecord(input)) return state;

  const unlocked = new Set(state.unlocked);
  if (Array.isArray(input.unlocked)) {
    for (const id of input.unlocked) if (typeof id === 'string' && findItem(id)) unlocked.add(id);
  }
  state.unlocked = [...unlocked];

  if (isRecord(input.outfit)) {
    for (const slot of WARDROBE_SLOT_ORDER) {
      const id = input.outfit[slot];
      if (typeof id !== 'string') continue;
      const item = findItem(id);
      if (item && item.slot === slot && unlocked.has(id)) state.outfit[slot] = id;
    }
  }

  if (isRecord(input.completed)) {
    for (const world of LEARNING_WORLDS) {
      const games = input.completed[world];
      if (!Array.isArray(games)) continue;
      const distinct = [...new Set(games.filter((g): g is string => typeof g === 'string' && g.length > 0))];
      if (distinct.length > 0) state.completed[world] = distinct;
    }
  }
  return state;
}

export function loadWardrobeState(storage: Pick<StorageDriver, 'getItem'>, profileId: string): WardrobeState {
  const raw = storage.getItem(wardrobeKey(profileId));
  if (!raw) return createWardrobeState();
  try {
    const parsed: unknown = JSON.parse(raw);
    if (!isRecord(parsed) || parsed.v !== WARDROBE_SAVE_VERSION) return createWardrobeState();
    return sanitize(parsed);
  } catch {
    return createWardrobeState();
  }
}

export function saveWardrobeState(storage: Pick<StorageDriver, 'setItem'>, profileId: string, state: WardrobeState): void {
  storage.setItem(wardrobeKey(profileId), JSON.stringify(sanitize(state)));
}

/** Loads, records one completed round, saves, and returns the model result. */
export function recordRoundAndSave(
  storage: StorageDriver,
  profileId: string,
  track: AgeTrack,
  round: CompletedRound,
): RoundResult {
  const result = recordCompletedRound(loadWardrobeState(storage, profileId), track, round);
  saveWardrobeState(storage, profileId, result.state);
  return result;
}

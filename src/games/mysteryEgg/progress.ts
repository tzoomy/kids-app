// Mystery Egg progress: which missions are done, and what that lights up. Pure TS, no Phaser.
// Spec: docs/specs/mystery-egg.md (AC-04, AC-05, AC-06).
// Key: kids-app-mystery-egg:<profileId>. Schema: { v: 1, completed: string[] } (mission ids, distinct).
// Hearts, the nest treasure and the egg glow are DERIVED from `completed`, so replaying never adds a second heart.
import type { StorageDriver } from '../../core/storage/store';

export const MYSTERY_EGG_SAVE_VERSION = 1;
export const MYSTERY_EGG_KEY_PREFIX = 'kids-app-mystery-egg:';
export const HEART_SLOT_COUNT = 5;
/** Egg art has glow levels 0..5 (`egg-nest-0` .. `egg-nest-5`). */
export const MAX_EGG_LEVEL = 5;

export interface MissionDef {
  id: string;
  /** Robot heart slot (0-based) this mission lights. Pending Maor decision: per mission vs per episode. */
  heartSlot: number;
  /** Nest treasure the neighbour gives (art id). */
  treasure: string;
}

/** Prototype: one mission. */
export const MISSIONS: readonly MissionDef[] = [{ id: '1.1', heartSlot: 0, treasure: 'feather' }];

const findMission = (id: string): MissionDef | undefined => MISSIONS.find((m) => m.id === id);

export interface MysteryEggProgress {
  v: typeof MYSTERY_EGG_SAVE_VERSION;
  completed: string[];
}

export function createProgress(): MysteryEggProgress {
  return { v: MYSTERY_EGG_SAVE_VERSION, completed: [] };
}

export function mysteryEggKey(profileId: string): string {
  return `${MYSTERY_EGG_KEY_PREFIX}${profileId}`;
}

/** Field-by-field repair of anything read from storage or passed in: unknown ids and wrong types are dropped. */
function sanitize(input: unknown): MysteryEggProgress {
  const progress = createProgress();
  if (typeof input !== 'object' || input === null || Array.isArray(input)) return progress;
  const completed = (input as { completed?: unknown }).completed;
  if (!Array.isArray(completed)) return progress;
  const seen = new Set<string>();
  for (const id of completed) {
    if (typeof id === 'string' && findMission(id) && !seen.has(id)) seen.add(id);
  }
  // Keep mission-table order so equal states compare equal.
  progress.completed = MISSIONS.filter((m) => seen.has(m.id)).map((m) => m.id);
  return progress;
}

export function loadProgress(storage: Pick<StorageDriver, 'getItem'>, profileId: string): MysteryEggProgress {
  try {
    const raw = storage.getItem(mysteryEggKey(profileId));
    if (!raw) return createProgress();
    const parsed: unknown = JSON.parse(raw);
    if (typeof parsed !== 'object' || parsed === null || (parsed as { v?: unknown }).v !== MYSTERY_EGG_SAVE_VERSION) return createProgress();
    return sanitize(parsed);
  } catch {
    return createProgress();
  }
}

export function saveProgress(storage: Pick<StorageDriver, 'setItem'>, profileId: string, progress: MysteryEggProgress): void {
  try {
    storage.setItem(mysteryEggKey(profileId), JSON.stringify(sanitize(progress)));
  } catch {
    // Storage full or blocked: progress is best-effort and must never break the game.
  }
}

export function completeMission(progress: MysteryEggProgress, missionId: string): { progress: MysteryEggProgress; newlyCompleted: boolean } {
  if (!findMission(missionId) || progress.completed.includes(missionId)) return { progress: sanitize(progress), newlyCompleted: false };
  return { progress: sanitize({ ...progress, completed: [...progress.completed, missionId] }), newlyCompleted: true };
}

/** Loads, completes one mission, saves. */
export function recordMissionAndSave(
  storage: Pick<StorageDriver, 'getItem' | 'setItem'>,
  profileId: string,
  missionId: string,
): { progress: MysteryEggProgress; newlyCompleted: boolean } {
  const res = completeMission(loadProgress(storage, profileId), missionId);
  if (res.newlyCompleted) saveProgress(storage, profileId, res.progress);
  return res;
}

const completedMissions = (progress: MysteryEggProgress): MissionDef[] =>
  progress.completed.map(findMission).filter((m): m is MissionDef => m !== undefined);

/** Lit heart slots, ascending, distinct. */
export function litHearts(progress: MysteryEggProgress): number[] {
  const slots = new Set(completedMissions(progress).map((m) => m.heartSlot).filter((s) => s >= 0 && s < HEART_SLOT_COUNT));
  return [...slots].sort((a, b) => a - b);
}

/** Treasures in the nest, in mission order. */
export function nestTreasures(progress: MysteryEggProgress): string[] {
  return completedMissions(progress).map((m) => m.treasure);
}

/** Egg glow level 0..5: one step per nest treasure. */
export function eggLevel(progress: MysteryEggProgress): number {
  return Math.min(MAX_EGG_LEVEL, nestTreasures(progress).length);
}

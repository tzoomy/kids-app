// Mystery Egg progress: per-world levels, robot hearts, nest pieces and the egg glow. Pure TS, no Phaser.
// Spec: docs/specs/game-shell.md (AC-13..AC-15), docs/specs/mystery-egg.md (AC-04..AC-06, mission 1.1).
// Key: kids-app-mystery-egg:<profileId>.
// Save v2: { v: 2, worlds: { [worldId]: { level, completed: number[] } }, pieces: string[], introSeen: boolean,
//   introSeenVersion: number, entrySeen: string[] }.
// `introSeenVersion` is the INTRO_VERSION the child last saw. The map shows the intro while it is below INTRO_VERSION, so an
// existing save (introSeen true, no version) sees the current intro once after an update. `introSeen` stays in the JSON
// (readable by older builds) and means "the current intro was seen".
// Save v1 ({ v: 1, completed: ['1.1'] }) migrates on load: mission 1.1 is Workshop level 1.
// Hearts and the gear fill derive from `completed`; nest PIECES are persisted so an earned piece is never lost when a
// later release adds levels to a world (the threshold min(PIECE_LEVELS, levels) would otherwise move).
import type { StorageDriver } from '../../core/storage/store';
import { WORLDS, isWorldId, worldDef, type WorldDef, type WorldId } from './worlds';

export const MYSTERY_EGG_SAVE_VERSION = 2;
export const MYSTERY_EGG_KEY_PREFIX = 'kids-app-mystery-egg:';
/**
 * The intro's version. A profile sees the intro again once when this goes up past the version it saw (bump it when the
 * slides change substantively). 2 = the first version that stores `introSeenVersion`: saves from the first shell
 * release only had a boolean, which never counts as having seen the current one.
 */
export const INTRO_VERSION = 2;
export const HEART_SLOT_COUNT = 5;
/** Egg art has glow levels 0..5 (`egg-nest-0` .. `egg-nest-5`): one step per nest piece. */
export const MAX_EGG_LEVEL = 5;
/** Distinct levels a world needs before it gives its nest piece (capped by the world's own level count). */
export const PIECE_LEVELS = 3;

export interface MissionDef {
  id: string;
  world: WorldId;
  /** 1-based level in that world. */
  level: number;
}

/** Mission 1.1 (the existing Workshop game) is Workshop level 1. */
export const MISSIONS: readonly MissionDef[] = [{ id: '1.1', world: 'workshop', level: 1 }];

const findMission = (id: string): MissionDef | undefined => MISSIONS.find((m) => m.id === id);

export interface WorldProgress {
  /** The level the child plays next in this world (1-based, capped at the world's last level). */
  level: number;
  /** Distinct completed levels, ascending. */
  completed: number[];
}

export interface MysteryEggProgress {
  v: typeof MYSTERY_EGG_SAVE_VERSION;
  worlds: Record<WorldId, WorldProgress>;
  /** Earned nest pieces (persisted), in world order. */
  pieces: string[];
  /** The current intro (INTRO_VERSION) was seen or skipped; derived from `introSeenVersion`, kept in the save for older readers. */
  introSeen: boolean;
  /** The INTRO_VERSION last seen or skipped; 0 = never (a legacy boolean `introSeen: true` does not count). */
  introSeenVersion: number;
  /** Worlds whose entry slides were seen or skipped. */
  entrySeen: WorldId[];
}

export function createProgress(): MysteryEggProgress {
  return repairProgress({});
}

export function mysteryEggKey(profileId: string): string {
  return `${MYSTERY_EGG_KEY_PREFIX}${profileId}`;
}

/** Slides and pieces needed: `min(PIECE_LEVELS, levels)`, 0 for a world with no levels. */
export function pieceThreshold(levels: number): number {
  return levels <= 0 ? 0 : Math.min(PIECE_LEVELS, levels);
}

const isObject = (v: unknown): v is Record<string, unknown> => typeof v === 'object' && v !== null && !Array.isArray(v);

function levelsOf(raw: unknown, def: WorldDef): number[] {
  const list = isObject(raw) && Array.isArray(raw.completed) ? raw.completed : [];
  const seen = new Set<number>();
  for (const l of list) if (typeof l === 'number' && Number.isInteger(l) && l >= 1 && l <= def.levels) seen.add(l);
  return [...seen].sort((a, b) => a - b);
}

const nextLevel = (completed: readonly number[], def: WorldDef): number => Math.max(1, Math.min(def.levels, (completed[completed.length - 1] ?? 0) + 1));

/**
 * Field-by-field repair of a v2-shaped value (anything read from storage or passed in): unknown worlds, ids and wrong
 * types are dropped, the world level is derived, and a piece is earned when its world meets the threshold. Stored pieces
 * are KEPT even when the threshold moved (levels added later).
 */
export function repairProgress(input: unknown, defs: readonly WorldDef[] = WORLDS): MysteryEggProgress {
  const src = isObject(input) ? input : {};
  const rawWorlds = isObject(src.worlds) ? src.worlds : {};
  const worlds = {} as Record<WorldId, WorldProgress>;
  const pieces = new Set<string>(Array.isArray(src.pieces) ? src.pieces.filter((p): p is string => typeof p === 'string') : []);
  for (const def of defs) {
    const completed = levelsOf(rawWorlds[def.id], def);
    worlds[def.id] = { level: nextLevel(completed, def), completed };
    const need = pieceThreshold(def.levels);
    if (need > 0 && completed.length >= need) pieces.add(def.piece);
  }
  const entrySeen = Array.isArray(src.entrySeen) ? src.entrySeen : [];
  const v = src.introSeenVersion;
  const introSeenVersion = typeof v === 'number' && Number.isInteger(v) && v >= 0 ? v : 0;
  return {
    v: MYSTERY_EGG_SAVE_VERSION,
    worlds,
    pieces: defs.filter((d) => pieces.has(d.piece)).map((d) => d.piece),
    introSeen: introSeenVersion >= INTRO_VERSION,
    introSeenVersion,
    entrySeen: defs.filter((d) => entrySeen.includes(d.id)).map((d) => d.id),
  };
}

/** v1 -> v2 (mission ids become world levels) and v2 repair; anything else is a fresh state. Idempotent. */
export function migrateProgress(input: unknown): MysteryEggProgress {
  if (!isObject(input)) return createProgress();
  if (input.v === 1) {
    const worlds: Record<string, { completed: number[] }> = {};
    const done = Array.isArray(input.completed) ? input.completed : [];
    for (const id of done) {
      const mission = typeof id === 'string' ? findMission(id) : undefined;
      if (mission) (worlds[mission.world] ??= { completed: [] }).completed.push(mission.level);
    }
    return repairProgress({ worlds });
  }
  if (input.v === MYSTERY_EGG_SAVE_VERSION) return repairProgress(input);
  return createProgress();
}

export function loadProgress(storage: Pick<StorageDriver, 'getItem'>, profileId: string): MysteryEggProgress {
  try {
    const raw = storage.getItem(mysteryEggKey(profileId));
    if (!raw) return createProgress();
    return migrateProgress(JSON.parse(raw));
  } catch {
    return createProgress();
  }
}

export function saveProgress(storage: Pick<StorageDriver, 'setItem'>, profileId: string, progress: MysteryEggProgress): void {
  try {
    storage.setItem(mysteryEggKey(profileId), JSON.stringify(repairProgress(progress)));
  } catch {
    // Storage full or blocked: progress is best-effort and must never break the game.
  }
}

export interface RecordResult {
  progress: MysteryEggProgress;
  newlyCompleted: boolean;
  /** The nest piece this success earned for the first time, else null. */
  newPiece: string | null;
}

/** A success at `level` of `worldId`: records it, raises the world's level, and earns the piece at the threshold. */
export function recordLevel(progress: MysteryEggProgress, worldId: WorldId, level: number, defs: readonly WorldDef[] = WORLDS): RecordResult {
  const current = repairProgress(progress, defs);
  const def = defs.find((d) => d.id === worldId);
  const valid = def !== undefined && Number.isInteger(level) && level >= 1 && level <= def.levels;
  if (!valid || current.worlds[worldId].completed.includes(level)) return { progress: current, newlyCompleted: false, newPiece: null };
  const completed = [...current.worlds[worldId].completed, level].sort((a, b) => a - b);
  const next = repairProgress({ ...current, worlds: { ...current.worlds, [worldId]: { completed } } }, defs);
  const newPiece = next.pieces.includes(def.piece) && !current.pieces.includes(def.piece) ? def.piece : null;
  return { progress: next, newlyCompleted: true, newPiece };
}

/** Mission 1.1 = Workshop level 1; an unknown mission changes nothing. */
export function completeMission(progress: MysteryEggProgress, missionId: string): RecordResult {
  const mission = findMission(missionId);
  if (!mission) return { progress: repairProgress(progress), newlyCompleted: false, newPiece: null };
  return recordLevel(progress, mission.world, mission.level);
}

/** Loads, completes one mission, saves. */
export function recordMissionAndSave(storage: Pick<StorageDriver, 'getItem' | 'setItem'>, profileId: string, missionId: string): RecordResult {
  const res = completeMission(loadProgress(storage, profileId), missionId);
  if (res.newlyCompleted) saveProgress(storage, profileId, res.progress);
  return res;
}

export function markIntroSeen(progress: MysteryEggProgress): MysteryEggProgress {
  return repairProgress({ ...progress, introSeenVersion: Math.max(progress.introSeenVersion, INTRO_VERSION) });
}

export function markEntrySeen(progress: MysteryEggProgress, worldId: WorldId): MysteryEggProgress {
  if (!isWorldId(worldId)) return repairProgress(progress);
  return repairProgress({ ...progress, entrySeen: [...progress.entrySeen, worldId] });
}

/** The level the child plays next in a world. */
export function worldLevel(progress: MysteryEggProgress, worldId: WorldId, defs: readonly WorldDef[] = WORLDS): number {
  return repairProgress(progress, defs).worlds[worldId].level;
}

/** Lit heart slots, ascending, distinct: a world's slot lights on its first success. */
export function litHearts(progress: MysteryEggProgress, defs: readonly WorldDef[] = WORLDS): number[] {
  const slots = defs
    .filter((d) => (progress.worlds[d.id]?.completed.length ?? 0) > 0)
    .map((d) => d.heartSlot)
    .filter((s) => s >= 0 && s < HEART_SLOT_COUNT);
  return [...new Set(slots)].sort((a, b) => a - b);
}

/** How full the world's gear is, 0..1: completed levels / `min(PIECE_LEVELS, levels)`. */
export function gearFill(progress: MysteryEggProgress, worldId: WorldId, defs: readonly WorldDef[] = WORLDS): number {
  const def = defs.find((d) => d.id === worldId) ?? worldDef(worldId);
  const need = pieceThreshold(def.levels);
  if (need === 0) return 0;
  return Math.min(1, (progress.worlds[worldId]?.completed.length ?? 0) / need);
}

/** Earned nest pieces (persisted ones included), in world order. */
export function earnedPieces(progress: MysteryEggProgress, defs: readonly WorldDef[] = WORLDS): string[] {
  return repairProgress(progress, defs).pieces;
}

/** The earned nest pieces (kept under its prototype name: the feather is the Workshop's piece). */
export function nestTreasures(progress: MysteryEggProgress, defs: readonly WorldDef[] = WORLDS): string[] {
  return earnedPieces(progress, defs);
}

/** Egg glow level 0..5: one step per nest piece. */
export function eggLevel(progress: MysteryEggProgress, defs: readonly WorldDef[] = WORLDS): number {
  return Math.min(MAX_EGG_LEVEL, earnedPieces(progress, defs).length);
}

/** All five pieces: the egg is ready to hatch (hatching itself is out of scope). */
export function readyToHatch(progress: MysteryEggProgress, defs: readonly WorldDef[] = WORLDS): boolean {
  return earnedPieces(progress, defs).length >= MAX_EGG_LEVEL;
}

/** Earned pieces the map has not shown yet (they fly into the nest on the return to the map). */
export function newPieces(progress: MysteryEggProgress, shown: readonly string[], defs: readonly WorldDef[] = WORLDS): string[] {
  return earnedPieces(progress, defs).filter((p) => !shown.includes(p));
}

/** A seed for the e2e hook: v1 `{ completed }` is stored raw (so the migration runs on load); v2 is repaired and stored as v2. */
export type ProgressSeed =
  | { v?: 1; completed: string[] }
  | {
      v: 2;
      worlds?: Partial<Record<WorldId, { level?: number; completed?: number[] }>>;
      pieces?: string[];
      /** true = the current intro was seen (unless `introSeenVersion` says otherwise). */
      introSeen?: boolean;
      /** An explicit saved version, e.g. 0 with `introSeen: true` to seed an old save written before the version existed. */
      introSeenVersion?: number;
      entrySeen?: WorldId[];
    };

export function seedToSave(seed: ProgressSeed): unknown {
  if ('completed' in seed) return { v: 1, completed: [...seed.completed] };
  const introSeenVersion = seed.introSeenVersion ?? (seed.introSeen === true ? INTRO_VERSION : 0);
  return repairProgress({ ...seed, introSeenVersion });
}

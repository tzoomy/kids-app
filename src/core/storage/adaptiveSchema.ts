// Persistence schema for the adaptive engine. Own key, separate from `kids-app-state-v2`.
import type { AdaptiveProfile, Box, ItemState, OutcomeKind, SkillState } from '../adaptive/types';

export const ADAPTIVE_KEY_PREFIX = 'kids-app-adaptive:';
export const ADAPTIVE_SCHEMA_VERSION = 1;

export function adaptiveKey(profileId: string): string {
  return `${ADAPTIVE_KEY_PREFIX}${profileId}`;
}

export function defaultAdaptiveProfile(profileId: string): AdaptiveProfile {
  return { schemaVersion: 1, profileId, skills: {} };
}

/** Upgrades a payload from version N to N+1. Empty today; kept for future versions. */
export type Migration = (old: unknown) => unknown;
export const MIGRATIONS: Record<number, Migration> = {};

const OUTCOMES: readonly string[] = ['clean', 'assisted', 'miss'];

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

function isCount(v: unknown): v is number {
  return typeof v === 'number' && Number.isInteger(v) && v >= 0;
}

function parseItem(v: unknown): ItemState | null {
  if (!isRecord(v)) return null;
  const { box, seen, clean, lastSeenDay } = v;
  if (typeof box !== 'number' || !Number.isInteger(box) || box < 1 || box > 5) return null;
  if (!isCount(seen) || !isCount(clean) || typeof lastSeenDay !== 'string') return null;
  return { box: box as Box, seen, clean, lastSeenDay };
}

function parseSkill(v: unknown): SkillState | null {
  if (!isRecord(v)) return null;
  const { level, cleanStreak, recent, afterDrop, lastPlayedDay, items } = v;
  if (typeof level !== 'number' || !Number.isInteger(level) || level < 1) return null;
  if (!isCount(cleanStreak) || typeof afterDrop !== 'boolean' || typeof lastPlayedDay !== 'string') return null;
  if (!Array.isArray(recent) || !recent.every((o) => typeof o === 'string' && OUTCOMES.includes(o))) return null;
  if (!isRecord(items)) return null;
  const parsedItems: Record<string, ItemState> = {};
  for (const [id, raw] of Object.entries(items)) {
    const item = parseItem(raw);
    if (item) parsedItems[id] = item;
  }
  return {
    level,
    cleanStreak,
    recent: (recent as OutcomeKind[]).slice(-8),
    afterDrop,
    lastPlayedDay,
    items: parsedItems,
  };
}

export interface ParsedProfile {
  profile: AdaptiveProfile;
  /** False when the payload was written by a newer build: defaults are used and nothing may be written. */
  writable: boolean;
}

/** Parses a stored payload. Never throws; falls back to defaults. */
export function parseAdaptiveProfile(
  raw: string | null,
  profileId: string,
  migrations: Record<number, Migration> = MIGRATIONS,
): ParsedProfile {
  const defaults = (writable = true): ParsedProfile => ({ profile: defaultAdaptiveProfile(profileId), writable });
  if (!raw) return defaults();
  let data: unknown;
  try {
    data = JSON.parse(raw);
  } catch {
    return defaults();
  }
  if (!isRecord(data) || typeof data.schemaVersion !== 'number') return defaults();
  if (data.schemaVersion > ADAPTIVE_SCHEMA_VERSION) return defaults(false);

  let version = data.schemaVersion;
  while (version < ADAPTIVE_SCHEMA_VERSION) {
    const migrate = migrations[version];
    if (!migrate) return defaults();
    try {
      data = migrate(data);
    } catch {
      return defaults();
    }
    if (!isRecord(data) || typeof data.schemaVersion !== 'number' || data.schemaVersion <= version) return defaults();
    version = data.schemaVersion;
  }
  if (!isRecord(data) || data.schemaVersion !== ADAPTIVE_SCHEMA_VERSION || !isRecord(data.skills)) return defaults();

  const skills: Record<string, SkillState> = {};
  for (const [key, value] of Object.entries(data.skills)) {
    const skill = parseSkill(value);
    if (skill) skills[key] = skill;
  }
  return { profile: { schemaVersion: 1, profileId, skills }, writable: true };
}

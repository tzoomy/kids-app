/**
 * Pure model of the station trail inside a world (spec: docs/specs/station-trail.md). No DOM, no Phaser.
 *
 * The station list is data-driven: a world's stations are the registry games (`WORLD_GAMES`) whose content says
 * `world: <id>`. Stars and the suggested next game are derived from the stored adaptive skill state; nothing new
 * is persisted.
 */
import { buildMeta, clampToTrack, type AgeTrack, type GameLevelsMeta, type SkillKey, type SkillState } from '../../core/adaptive';
import type { PickerGame } from './pickerModel';

/** A game's content as the trail needs it: id, world, and the adaptive metadata when the content has any. */
export interface TrailGame {
  id: string;
  world: string;
  meta?: GameLevelsMeta;
}

export interface Station {
  game: PickerGame;
  /** The active profile has played this game through (shows the star). */
  completed: boolean;
  /** The one gently pulsing "next" station. */
  suggested: boolean;
  /** Always true: the trail never locks a game. Typed as a literal so a lock cannot be introduced by accident. */
  enabled: true;
}

interface RawAdaptive {
  levels?: unknown[];
  tracks?: { age2: { start: number; min?: number; max: number }; age5: { start: number; min?: number; max: number } };
  rules?: Parameters<typeof buildMeta>[0]['rules'];
}

function isRecord(v: unknown): v is Record<string, unknown> {
  return typeof v === 'object' && v !== null && !Array.isArray(v);
}

/**
 * Collects every game content object (anything with a string `id` and `world`) from the content bundle, so a new
 * game's content shows up on its world's trail without a change here. Entries that are not games are skipped.
 */
export function collectTrailGames(bundle: Record<string, unknown>): TrailGame[] {
  const games: TrailGame[] = [];
  for (const value of Object.values(bundle)) {
    if (!isRecord(value) || typeof value.id !== 'string' || typeof value.world !== 'string') continue;
    const adaptive = isRecord(value.adaptive) ? (value.adaptive as RawAdaptive) : undefined;
    const meta =
      adaptive && Array.isArray(adaptive.levels) && adaptive.tracks
        ? buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules })
        : undefined;
    games.push({ id: value.id, world: value.world, meta });
  }
  return games;
}

/** The registry games that belong to `worldId` (by their content), in registry order. */
export function stationGamesForWorld(worldId: string, registry: readonly PickerGame[], games: readonly TrailGame[]): PickerGame[] {
  const inWorld = new Set(games.filter((g) => g.world === worldId).map((g) => g.id));
  return registry.filter((card) => inWorld.has(card.gameId));
}

/** Skill states stored for one game: every key `<world>.<gameId>.<lang>`. */
function skillsOfGame(skills: Readonly<Record<SkillKey, SkillState>>, world: string, gameId: string): SkillState[] {
  const prefix = `${world}.${gameId}.`;
  return Object.entries(skills)
    .filter(([key]) => key.startsWith(prefix))
    .map(([, skill]) => skill);
}

/**
 * Star rule: the game counts as completed when the profile has played one full round (`trialsPerRound` trials
 * across all languages), or any language's level is above the track's start level. A game without adaptive
 * metadata never completes.
 */
export function isGameCompleted(
  skills: Readonly<Record<SkillKey, SkillState>>,
  world: string,
  gameId: string,
  meta: GameLevelsMeta | undefined,
  track: AgeTrack,
): boolean {
  if (!meta) return false;
  const own = skillsOfGame(skills, world, gameId);
  const trials = own.reduce((sum, s) => sum + Object.values(s.items).reduce((n, item) => n + item.seen, 0), 0);
  if (trials >= meta.rules.trialsPerRound) return true;
  return own.some((s) => clampToTrack(s, meta, track).level > meta.tracks[track].start);
}

/** Latest `lastPlayedDay` over a game's languages ('' when never played). ISO days sort as strings. */
function lastPlayedDay(skills: Readonly<Record<SkillKey, SkillState>>, world: string, gameId: string): string {
  return skillsOfGame(skills, world, gameId).reduce((latest, s) => (s.lastPlayedDay > latest ? s.lastPlayedDay : latest), '');
}

export interface BuildTrailInput {
  worldId: string;
  registry: readonly PickerGame[];
  games: readonly TrailGame[];
  /** The active profile's stored skills (`AdaptiveStore.getProfile(id).skills`). */
  skills: Readonly<Record<SkillKey, SkillState>>;
  /** The active profile's age track. */
  track: AgeTrack;
}

/**
 * Builds a world's trail: one station per game, star flags, and exactly one suggested station (none when the world
 * has no games). Suggestion: the first uncompleted station in trail order; when all are completed, the least
 * recently played one, ties to trail order.
 */
export function buildTrail(input: BuildTrailInput): Station[] {
  const { worldId, registry, games, skills, track } = input;
  const cards = stationGamesForWorld(worldId, registry, games);
  const completed = cards.map((card) => {
    const content = games.find((g) => g.id === card.gameId && g.world === worldId);
    return isGameCompleted(skills, worldId, card.gameId, content?.meta, track);
  });

  let suggestedIndex = completed.findIndex((done) => !done);
  if (suggestedIndex < 0 && cards.length > 0) {
    const days = cards.map((card) => lastPlayedDay(skills, worldId, card.gameId));
    suggestedIndex = days.reduce((best, day, i) => (day < days[best] ? i : best), 0);
  }

  return cards.map((game, i) => ({ game, completed: completed[i], suggested: i === suggestedIndex, enabled: true as const }));
}

export type WorldEntry =
  | { kind: 'none' }
  | { kind: 'direct'; game: PickerGame }
  | { kind: 'picker'; stations: Station[] };

/** What a tap on a world building does: nothing, enter the only game directly, or open the trail picker (2+ games). */
export function worldEntry(stations: readonly Station[]): WorldEntry {
  if (stations.length === 0) return { kind: 'none' };
  if (stations.length === 1) return { kind: 'direct', game: stations[0].game };
  return { kind: 'picker', stations: [...stations] };
}

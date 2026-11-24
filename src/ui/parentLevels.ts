// The adaptive games of the content bundle (world, id, languages, level meta), for the parent profile's start-floor lift (no DOM, no Phaser).
import { buildMeta, type GameLevelsMeta } from '../core/adaptive';
import { WORLD_GAMES, type PickerGame } from './picker/pickerModel';

export interface ParentLevelGame {
  gameId: string;
  world: string;
  /** Languages the game supports (`languages` of its content): almost all en + fr, Word Train en only. */
  languages: string[];
  meta: GameLevelsMeta;
}

interface RawGame {
  id: string;
  world: string;
  languages?: unknown;
  adaptive?: { levels?: unknown[]; tracks?: Parameters<typeof buildMeta>[0]['tracks']; rules?: Parameters<typeof buildMeta>[0]['rules'] };
}

function isRawGame(v: unknown): v is RawGame {
  return typeof v === 'object' && v !== null && typeof (v as RawGame).id === 'string' && typeof (v as RawGame).world === 'string';
}

/**
 * Every game of the content bundle that has an `adaptive` block, in the station-trail registry order (`WORLD_GAMES`).
 * Leisure-only games (colouring, sticker board) have no adaptive block and are skipped.
 */
export function collectParentLevelGames(
  bundle: Record<string, unknown>,
  registry: readonly PickerGame[] = WORLD_GAMES,
): ParentLevelGame[] {
  const raws = Object.values(bundle).filter(isRawGame);
  const games: ParentLevelGame[] = [];
  for (const card of registry) {
    const raw = raws.find((g) => g.id === card.gameId);
    const adaptive = raw?.adaptive;
    if (!raw || !adaptive || !Array.isArray(adaptive.levels) || !adaptive.tracks) continue;
    const languages = Array.isArray(raw.languages) ? raw.languages.filter((l): l is string => l === 'en' || l === 'fr') : ['en', 'fr'];
    games.push({
      gameId: raw.id,
      world: raw.world,
      languages,
      meta: buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    });
  }
  return games;
}

// Pure model behind the per-game level view of the parent profile page (no DOM, no Phaser).
import { buildMeta, type GameLevelsMeta, type SkillKey, type SkillState } from '../core/adaptive';
import heStrings from '../content/i18n/he.json';
import { WORLD_GAMES, type PickerGame } from './picker/pickerModel';

export interface ParentLevelGame {
  gameId: string;
  world: string;
  worldName: string;
  /** Hebrew game name from `he.json` `gamePicker`. */
  label: string;
  /** Languages the game supports (`languages` of its content): almost all en + fr, Word Train en only. */
  languages: string[];
  meta: GameLevelsMeta;
}

/** Storage access of the profile page: reads skills and writes them through (persisting immediately). */
export interface ParentLevelsApi {
  games: ParentLevelGame[];
  getSkill(profileId: string, key: SkillKey): SkillState | undefined;
  saveSkill(profileId: string, key: SkillKey, skill: SkillState): void;
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
  labels: Record<string, string> = heStrings.gamePicker,
): ParentLevelGame[] {
  const raws = Object.values(bundle).filter(isRawGame);
  const worlds = (bundle.worlds as { worlds?: { id: string; nameHe: string }[] } | undefined)?.worlds ?? [];
  const games: ParentLevelGame[] = [];
  for (const card of registry) {
    const raw = raws.find((g) => g.id === card.gameId);
    const adaptive = raw?.adaptive;
    if (!raw || !adaptive || !Array.isArray(adaptive.levels) || !adaptive.tracks) continue;
    const languages = Array.isArray(raw.languages) ? raw.languages.filter((l): l is string => l === 'en' || l === 'fr') : ['en', 'fr'];
    games.push({
      gameId: raw.id,
      world: raw.world,
      worldName: worlds.find((w) => w.id === raw.world)?.nameHe ?? raw.world,
      label: labels[card.labelKey] ?? raw.id,
      languages,
      meta: buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    });
  }
  return games;
}

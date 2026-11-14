/** Language House (and other world) stations derived from WORLD_GAMES + content, for e2e.
 * Reads game JSON with fs so Playwright's Node loader does not need Vite's JSON import. */
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { WORLD_GAMES, type PickerGame } from '../../../src/ui/picker/pickerModel';
import { stationGamesForWorld, type TrailGame } from '../../../src/ui/picker/trailModel';

const gamesDir = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../../src/content/games');
const TRAIL_GAMES: TrailGame[] = fs.readdirSync(gamesDir)
  .filter((file) => file.endsWith('.json'))
  .map((file) => {
    const data = JSON.parse(fs.readFileSync(path.join(gamesDir, file), 'utf8')) as { id: string; world: string };
    return { id: data.id, world: data.world };
  });

/** Stations of a world, in registry order. Counts and ids come from the registry, not a hardcoded list. */
export function stationsForWorld(worldId: string): readonly PickerGame[] {
  return stationGamesForWorld(worldId, WORLD_GAMES, TRAIL_GAMES);
}

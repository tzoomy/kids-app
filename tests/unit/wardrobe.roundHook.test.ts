// Contract: every WORLD_GAMES scene records a wardrobe round on completion
// (this.session.complete() immediately followed by this.context.recordCompletedRound).
// Leisure Corner games must not call the hook (docs/specs/wardrobe.md).
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEISURE_PICKER_GAMES, WORLD_GAMES, type PickerGameId } from '../../src/ui/picker/pickerModel';

/** Scene source of every world game. The test fails if WORLD_GAMES gains an id that is not listed here. */
const WORLD_SCENE_SOURCE: Record<PickerGameId, string> = {
  'animal-restaurant': 'src/games/restaurant/RestaurantScene.ts',
  'kitchen-orchestra': 'src/games/orchestra/OrchestraScene.ts',
  'letter-monster': 'src/games/letterMonster/LetterMonsterScene.ts',
  'travel-suitcase': 'src/games/travelSuitcase/SuitcaseScene.ts',
  'sorting-beds': 'src/games/sorting/SortingScene.ts',
  'balloon-pop': 'src/games/balloon/BalloonScene.ts',
  'who-is-hiding': 'src/games/hiding/HidingScene.ts',
  'seed-to-flower': 'src/games/seedFlower/SeedFlowerScene.ts',
  'potion-lab': 'src/games/potionLab/PotionScene.ts',
  'sink-or-float': 'src/games/sinkFloat/SinkFloatScene.ts',
  'magic-magnet': 'src/games/magicMagnet/MagnetScene.ts',
  // Leisure ids exist on PickerGameId; they are not world games, so they are covered by the third test below
  // ("Leisure Corner games do not call recordCompletedRound"), not by the world-hook test.
  bubbles: 'src/games/bubbles/BubblesScene.ts',
  'leisure-colouring': 'src/games/colouring/ColouringScene.ts',
};

const WORLD_IDS = new Set(WORLD_GAMES.map((g) => g.gameId));
const LEISURE_IDS = new Set(LEISURE_PICKER_GAMES.map((g) => g.gameId));

const HOOK_AFTER_COMPLETE =
  /this\.session\.complete\(\);\s*this\.context\.recordCompletedRound\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;

/** Drops block and line comments so a call mentioned only in a comment is not counted. */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

function readSource(rel: string): string {
  const abs = path.join(process.cwd(), rel);
  expect(existsSync(abs), `missing scene source ${rel}`).toBe(true);
  return stripComments(readFileSync(abs, 'utf8'));
}

function contentWorld(gameId: string): string {
  const abs = path.join(process.cwd(), 'src/content/games', `${gameId}.json`);
  expect(existsSync(abs), `missing content JSON for ${gameId}`).toBe(true);
  const data = JSON.parse(readFileSync(abs, 'utf8')) as { world: string };
  expect(data.world, `${gameId} content world`).toBeTruthy();
  return data.world;
}

describe('wardrobe round-completion hook in WORLD_GAMES scenes', () => {
  it('the explicit scene map covers every WORLD_GAMES id and no unknown world id', () => {
    const mappedWorldIds = (Object.keys(WORLD_SCENE_SOURCE) as PickerGameId[]).filter((id) => WORLD_IDS.has(id));
    expect(mappedWorldIds.sort()).toEqual([...WORLD_IDS].sort());
    for (const game of WORLD_GAMES) {
      expect(WORLD_SCENE_SOURCE[game.gameId], game.gameId).toBeTruthy();
    }
  });

  it('every WORLD_GAMES scene calls recordCompletedRound immediately after each session.complete()', () => {
    for (const game of WORLD_GAMES) {
      const rel = WORLD_SCENE_SOURCE[game.gameId];
      const source = readSource(rel);
      const world = contentWorld(game.gameId);
      const completes = source.match(/this\.session\.complete\(\)/g) ?? [];
      expect(completes.length, `${game.gameId} (${rel}) must call session.complete()`).toBeGreaterThan(0);

      const hooks = [...source.matchAll(HOOK_AFTER_COMPLETE)];
      expect(
        hooks.length,
        `${game.gameId} (${rel}): every this.session.complete() must be followed by this.context.recordCompletedRound`,
      ).toBe(completes.length);

      for (const match of hooks) {
        expect(match[2], `${game.gameId} hook gameId in ${rel}`).toBe(game.gameId);
        expect(match[1], `${game.gameId} hook world in ${rel}`).toBe(world);
      }
    }
  });

  it('Leisure Corner games do not call recordCompletedRound', () => {
    const mappedLeisureIds = (Object.keys(WORLD_SCENE_SOURCE) as PickerGameId[]).filter((id) => LEISURE_IDS.has(id));
    expect(mappedLeisureIds.sort()).toEqual([...LEISURE_IDS].sort());

    for (const game of LEISURE_PICKER_GAMES) {
      const rel = WORLD_SCENE_SOURCE[game.gameId];
      const source = readSource(rel);
      expect(source, `${game.gameId} (${rel}) must not call recordCompletedRound`).not.toMatch(
        /recordCompletedRound\s*\(/,
      );
    }
  });
});

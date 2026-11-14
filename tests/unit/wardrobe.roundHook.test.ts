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
  'word-train': 'src/games/wordTrain/WordTrainScene.ts',
  'sorting-beds': 'src/games/sorting/SortingScene.ts',
  'balloon-pop': 'src/games/balloon/BalloonScene.ts',
  'picnic-train': 'src/games/picnic/PicnicScene.ts',
  'who-is-hiding': 'src/games/hiding/HidingScene.ts',
  'seed-to-flower': 'src/games/seedFlower/SeedFlowerScene.ts',
  'who-lives-here': 'src/games/habitat/HabitatScene.ts',
  'shadow-match': 'src/games/hiding/ShadowScene.ts',
  'potion-lab': 'src/games/potionLab/PotionScene.ts',
  'sink-or-float': 'src/games/sinkFloat/SinkFloatScene.ts',
  'magic-magnet': 'src/games/magicMagnet/MagnetScene.ts',
  'sticker-board': 'src/games/stickers/StickerBoardScene.ts',
  // Leisure ids exist on PickerGameId; they are not world games, so they are covered by the third test below
  // ("Leisure Corner games do not call recordCompletedRound"), not by the world-hook test.
  bubbles: 'src/games/bubbles/BubblesScene.ts',
  'leisure-colouring': 'src/games/colouring/ColouringScene.ts',
};

const WORLD_IDS = new Set(WORLD_GAMES.map((g) => g.gameId));
const LEISURE_IDS = new Set(LEISURE_PICKER_GAMES.map((g) => g.gameId));

const HOOK_AFTER_COMPLETE =
  /this\.session\.complete\(\);\s*this\.context\.recordCompletedRound\(\s*'([^']+)'\s*,\s*'([^']+)'\s*\)/g;

/**
 * Drops block and line comments so a call mentioned only in a comment is not counted.
 * String-aware: `//` or `/*` inside '...', "..." or `...` literals (e.g. a URL) is kept.
 * Handles backslash escapes. Not a full lexer: regex literals and `${...}` nesting are not modelled.
 */
function stripComments(source: string): string {
  const len = source.length;
  let out = '';
  let i = 0;
  while (i < len) {
    const c = source[i];
    const next = source[i + 1];
    if (c === "'" || c === '"' || c === '`') {
      let j = i + 1;
      while (j < len && source[j] !== c) {
        if (source[j] === '\\') j += 1; // skip the escaped character
        else if (source[j] === '\n' && c !== '`') break; // unterminated ' or " literal ends at the line break
        j += 1;
      }
      out += source.slice(i, j + 1);
      i = j + 1;
    } else if (c === '/' && next === '/') {
      while (i < len && source[i] !== '\n') i += 1;
    } else if (c === '/' && next === '*') {
      const end = source.indexOf('*/', i + 2);
      i = end === -1 ? len : end + 2;
    } else {
      out += c;
      i += 1;
    }
  }
  return out;
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

describe('stripComments (test helper)', () => {
  it('keeps // inside a string literal, so a URL does not eat the rest of the line', () => {
    const src = "const assetUrl = 'https://cdn.example.com/star.png'; this.session.complete();";
    const out = stripComments(src);
    expect(out).toContain('this.session.complete()');
    expect(out).toContain('https://cdn.example.com/star.png');
    expect(stripComments('const u = "http://x.test/a"; this.session.complete();')).toContain(
      'this.session.complete()',
    );
  });

  it('keeps /* inside a string literal and does not swallow code up to a later */', () => {
    const src = "const g = '/* not a comment'; this.session.complete(); const h = 'x */';";
    const out = stripComments(src);
    expect(out).toContain("'/* not a comment'");
    expect(out).toContain('this.session.complete()');
    expect(out).toContain("'x */'");
  });

  it('still strips real line and block comments', () => {
    expect(stripComments('a(); // this.session.complete();\nb();')).not.toContain('session.complete');
    expect(stripComments('a(); /* this.session.complete(); */ b();')).not.toContain('session.complete');
    expect(stripComments('a(); /* multi\nline this.session.complete(); */ b();')).not.toContain('session.complete');
    expect(stripComments('a(); // c\nb();')).toBe('a(); \nb();');
  });

  it('honours escapes: \\\', \\", and \\\\ before a closing quote', () => {
    // \' does not end the string, so the // after it is still inside the string.
    expect(stripComments("const a = 'it\\'s // fine'; keep1();")).toContain('keep1()');
    expect(stripComments('const a = "say \\"//\\" now"; keep2();')).toContain('keep2()');
    // '\\' ends the string (escaped backslash), so the // that follows is a real comment.
    const out = stripComments("const a = '\\\\'; // gone\nkeep3();");
    expect(out).toContain('keep3()');
    expect(out).not.toContain('gone');
  });

  it('keeps comment markers inside template literals but strips real comments after them', () => {
    const out = stripComments('const t = `http://x/${1}`; this.session.complete(); // gone');
    expect(out).toContain('this.session.complete()');
    expect(out).toContain('http://x/');
    expect(out).not.toContain('gone');
  });

  it('a commented-out call is not counted, a real one next to a URL is', () => {
    const src = [
      "const u = 'https://cdn.example.com/a.png'; this.session.complete();",
      '// this.session.complete();',
      '/* this.session.complete(); */',
    ].join('\n');
    expect(stripComments(src).match(/this\.session\.complete\(\)/g)).toHaveLength(1);
  });
});

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

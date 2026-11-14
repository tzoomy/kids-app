import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import * as loadContent from '../../src/content/loadContent';
import { WORLD_GAMES } from '../../src/ui/picker/pickerModel';
import { collectTrailGames, stationGamesForWorld } from '../../src/ui/picker/trailModel';

// Spec: docs/specs/station-trail.md. Guards the runtime ContentBundle in src/main.ts.
// A hand-copied fixture cannot catch a game whose JSON exists but is missing from the bundle
// (the Travel Suitcase bug fixed in 4003944), so this test reads the bundle literal from main.ts itself.

function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/\/\/[^\n]*/g, '');
}

/** The object literal passed as the content bundle to `new AppContext(store, audioManager, sfx, { ... }, shell)`. */
function readMainBundleEntries(): Array<{ key: string; loader: string }> {
  const source = stripComments(readFileSync(path.join(process.cwd(), 'src/main.ts'), 'utf8'));
  const literal = /new AppContext\(\s*[^{]*?,\s*\{([\s\S]*?)\}\s*,\s*shell\s*\)/.exec(source);
  expect(literal, 'could not find the AppContext content literal in src/main.ts').not.toBeNull();
  const entries = (literal as RegExpExecArray)[1]
    .split(',')
    .map((part) => part.trim())
    .filter((part) => part.length > 0)
    .map((part) => {
      const m = /^(\w+)\s*:\s*(\w+)\(\)$/.exec(part);
      expect(m, `unrecognised AppContext content entry in src/main.ts: "${part}"`).not.toBeNull();
      return { key: (m as RegExpExecArray)[1], loader: (m as RegExpExecArray)[2] };
    });
  expect(entries.length).toBeGreaterThan(0);
  return entries;
}

function buildRuntimeBundle(): Record<string, unknown> {
  const loaders = loadContent as unknown as Record<string, unknown>;
  const bundle: Record<string, unknown> = {};
  for (const { key, loader } of readMainBundleEntries()) {
    const fn = loaders[loader];
    expect(typeof fn, `src/main.ts uses ${loader}(), which loadContent.ts does not export`).toBe('function');
    bundle[key] = (fn as () => unknown)();
  }
  return bundle;
}

describe('station trail on the real runtime content bundle (src/main.ts)', () => {
  it('language-house has exactly the four stations in registry order', () => {
    const games = collectTrailGames(buildRuntimeBundle());
    const stations = stationGamesForWorld('language-house', WORLD_GAMES, games).map((g) => g.gameId);
    expect(stations).toEqual(['animal-restaurant', 'kitchen-orchestra', 'letter-monster', 'travel-suitcase']);
  });

  it('number-garden stations on the runtime bundle match the registry, with Number Bridge last', () => {
    const games = collectTrailGames(buildRuntimeBundle());
    const stations = stationGamesForWorld('number-garden', WORLD_GAMES, games).map((g) => g.gameId);
    const expected = WORLD_GAMES.filter((card) => games.some((g) => g.id === card.gameId && g.world === 'number-garden')).map((c) => c.gameId);
    expect(stations).toEqual(expected);
    expect(stations).toEqual(['sorting-beds', 'balloon-pop', 'picnic-train', 'number-bridge']);
  });
});

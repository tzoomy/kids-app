// Static contract of the lazy scene registry (src/game/sceneLoaders.ts): every game scene has exactly one loader line,
// pointing at its scene source, resolving to the class whose Phaser key matches. No Phaser boot needed.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { LEISURE_PICKER_GAMES, WORLD_GAMES } from '../../src/ui/picker/pickerModel';
import { ALL_SCENE_SOURCES, WARDROBE_SCENE_SOURCE, WORLD_SCENE_SOURCE } from './helpers/worldSceneSource';

const ROOT = process.cwd();
const LOADER_LINE = /^\s*(\w+):\s*\(\)\s*=>\s*import\('([^']+)'\)\.then\(\(m\)\s*=>\s*m\.(\w+)\),?\s*$/gm;

interface LoaderEntry {
  key: string;
  source: string; // repo-relative, with .ts
  exportName: string;
}

function parseLoaders(): LoaderEntry[] {
  const text = readFileSync(path.join(ROOT, 'src/game/sceneLoaders.ts'), 'utf8');
  return [...text.matchAll(LOADER_LINE)].map((m) => ({
    key: m[1],
    source: `${path.posix.normalize(path.posix.join('src/game', m[2]))}.ts`,
    exportName: m[3],
  }));
}

const LOADERS = parseLoaders();
const byKey = new Map(LOADERS.map((l) => [l.key, l]));

/** [sceneKey, expected scene source] of every scene that must be lazily loadable. */
const EXPECTED: Array<[string, string]> = [
  ...[...WORLD_GAMES, ...LEISURE_PICKER_GAMES].map((g): [string, string] => [g.sceneKey, WORLD_SCENE_SOURCE[g.gameId]]),
  ['WardrobeScene', WARDROBE_SCENE_SOURCE],
];

describe('scene loader registry (src/game/sceneLoaders.ts)', () => {
  it('the parser sees one loader line per scene (a reformatted loader would otherwise hide a missing one)', () => {
    expect(LOADERS.length).toBe(new Set(EXPECTED.map(([key]) => key)).size);
    expect(new Set(LOADERS.map((l) => l.key)).size, 'duplicate loader key').toBe(LOADERS.length);
  });

  it('has a loader for every WORLD_GAMES sceneKey, Bubbles, Colouring and Wardrobe', () => {
    for (const [key] of EXPECTED) expect(byKey.has(key), `no loader line for scene key ${key}`).toBe(true);
    for (const game of WORLD_GAMES) expect(byKey.has(game.sceneKey), `${game.gameId}: no loader for ${game.sceneKey}`).toBe(true);
  });

  it('each loader imports that game\'s scene source (the shared WORLD_SCENE_SOURCE map)', () => {
    for (const [key, source] of EXPECTED) {
      expect(byKey.get(key)?.source, `loader ${key} must import ${source}`).toBe(source);
    }
  });

  it('each loader resolves to the exported class whose Phaser key equals the loader key', () => {
    for (const loader of LOADERS) {
      expect(existsSync(path.join(ROOT, loader.source)), `${loader.key}: missing ${loader.source}`).toBe(true);
      const src = readFileSync(path.join(ROOT, loader.source), 'utf8');
      expect(loader.exportName, `${loader.key}: loader must return the class named like the key`).toBe(loader.key);
      expect(src, `${loader.source} must export class ${loader.exportName}`).toMatch(
        new RegExp(`export class ${loader.exportName}\\s+extends\\s+Phaser\\.Scene`),
      );
      expect(src, `${loader.source}: class ${loader.exportName} must register under key '${loader.key}'`).toMatch(
        new RegExp(`super\\(\\s*'${loader.key}'\\s*\\)`),
      );
    }
  });

  it('lists no loader for a source outside the known game scenes, and none for MapScene or PreloadScene', () => {
    for (const loader of LOADERS) expect(ALL_SCENE_SOURCES, `${loader.key} -> ${loader.source}`).toContain(loader.source);
    expect(byKey.has('MapScene')).toBe(false);
    expect(byKey.has('PreloadScene')).toBe(false);
  });
});

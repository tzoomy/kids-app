// Static guard for code-splitting: src/main.ts and src/game/createGame.ts must not statically import
// any game scene, and main.ts must reach createGame (Phaser) only through a dynamic import().
// The build-level proof lives in buildSize.guard.test.ts; this one fails fast without a build.
import { readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ALL_SCENE_SOURCES } from './helpers/worldSceneSource';

const ROOT = process.cwd();

/** Drops comments so an import mentioned in a comment is not counted. Good enough for import lines (no regex or URL parsing). */
function stripComments(source: string): string {
  return source.replace(/\/\*[\s\S]*?\*\//g, '').replace(/(^|[^:'"`])\/\/[^\n]*/gm, '$1');
}

interface StaticImport {
  specifier: string;
  typeOnly: boolean;
}

/** Static `import ... from 'x'`, `import 'x'` and `export ... from 'x'`. Dynamic `import('x')` is not included. */
function staticImports(source: string): StaticImport[] {
  const code = stripComments(source);
  const found: StaticImport[] = [];
  for (const m of code.matchAll(/\b(import|export)\s+(type\s+)?([^;'"()]*?)\s*from\s*['"]([^'"]+)['"]/g)) {
    // `export const x = ...` has no `from`; the lazy [^;'"()] body cannot cross a statement end.
    found.push({ specifier: m[4], typeOnly: Boolean(m[2]) });
  }
  for (const m of code.matchAll(/\bimport\s*['"]([^'"]+)['"]/g)) found.push({ specifier: m[1], typeOnly: false });
  return found;
}

function resolveSpecifier(fromRel: string, specifier: string): string | null {
  let abs: string;
  if (specifier.startsWith('.')) abs = path.resolve(ROOT, path.dirname(fromRel), specifier);
  else if (specifier.startsWith('@/')) abs = path.resolve(ROOT, 'src', specifier.slice(2));
  else return null; // bare package import
  return path.relative(ROOT, abs).split(path.sep).join('/').replace(/\.(ts|js)$/, '');
}

const SCENES_NO_EXT = new Set(ALL_SCENE_SOURCES.map((s) => s.replace(/\.ts$/, '')));

function readRel(rel: string): string {
  return readFileSync(path.join(ROOT, rel), 'utf8');
}

function sceneValueImports(rel: string): string[] {
  return staticImports(readRel(rel))
    .filter((i) => !i.typeOnly)
    .map((i) => resolveSpecifier(rel, i.specifier))
    .filter((r): r is string => r !== null && SCENES_NO_EXT.has(r));
}

describe('static import detector (test helper)', () => {
  it('finds value imports, side-effect imports and re-exports, but not dynamic imports or comments', () => {
    const src = [
      "import { A } from './a';",
      "import type { B } from './b';",
      "import './c.css';",
      "export { D } from './d';",
      "const lazy = () => import('./e');",
      "// import { F } from './f';",
      '/* import { G } from "./g"; */',
      "import {\n  H,\n  I,\n} from './h';",
    ].join('\n');
    const found = staticImports(src);
    expect(found.filter((i) => !i.typeOnly).map((i) => i.specifier).sort()).toEqual(['./a', './c.css', './d', './h']);
    expect(found.filter((i) => i.typeOnly).map((i) => i.specifier)).toEqual(['./b']);
  });

  it('resolves relative and @/ specifiers to extensionless repo paths', () => {
    expect(resolveSpecifier('src/game/createGame.ts', '../games/hiding/ShadowScene')).toBe('src/games/hiding/ShadowScene');
    expect(resolveSpecifier('src/main.ts', '@/games/bubbles/BubblesScene')).toBe('src/games/bubbles/BubblesScene');
    expect(resolveSpecifier('src/main.ts', 'phaser')).toBeNull();
  });
});

describe('code-splitting: no static scene imports in the shell', () => {
  for (const rel of ['src/main.ts', 'src/game/createGame.ts']) {
    it(`${rel} does not statically import any game scene (scenes load through import())`, () => {
      expect(sceneValueImports(rel), `${rel} statically imports scene modules`).toEqual([]);
    });
  }

  it('src/main.ts imports ./game/createGame only as a type, never as a value', () => {
    const valueImports = staticImports(readRel('src/main.ts'))
      .filter((i) => !i.typeOnly)
      .map((i) => resolveSpecifier('src/main.ts', i.specifier));
    expect(valueImports, 'src/main.ts has a static value import of ./game/createGame (pulls Phaser into the entry)').not.toContain(
      'src/game/createGame',
    );
  });

  it('src/main.ts does not statically import phaser as a value', () => {
    const phaserValueImports = staticImports(readRel('src/main.ts')).filter((i) => !i.typeOnly && i.specifier === 'phaser');
    expect(phaserValueImports).toEqual([]);
  });

  it('src/main.ts loads createGame with a dynamic import()', () => {
    const code = stripComments(readRel('src/main.ts'));
    expect(code, "src/main.ts must call import('./game/createGame')").toMatch(/\bimport\(\s*['"]\.\/game\/createGame['"]\s*\)/);
  });
});

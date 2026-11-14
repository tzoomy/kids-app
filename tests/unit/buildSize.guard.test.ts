// @vitest-environment node
// Guard: the shell entry chunk stays small because Phaser, createGame and every game scene are
// code-split (dynamic import) and still precached by the service worker for offline use.
// Runs a real `vite build` of the repo config into a temp dir (slow: one build for the whole file).
import { existsSync, mkdtempSync, readdirSync, readFileSync, rmSync, statSync } from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import { build } from 'vite';
import { WORLD_GAMES } from '../../src/ui/picker/pickerModel';
import { ALL_SCENE_SOURCES, WARDROBE_SCENE_SOURCE, WORLD_SCENE_SOURCE } from './helpers/worldSceneSource';

/** Max size of the shell entry JS chunk. 1 MiB is the default, pending Maor decision. */
const SHELL_ENTRY_BUDGET_BYTES = 1024 * 1024;

const REPO_ROOT = process.cwd();
const CREATE_GAME_SOURCE = 'src/game/createGame.ts';

interface ManifestChunk {
  file: string;
  src?: string;
  isEntry?: boolean;
  isDynamicEntry?: boolean;
  imports?: string[];
  dynamicImports?: string[];
}
type Manifest = Record<string, ManifestChunk>;

let outDir = '';
let manifest: Manifest = {};

/** Manifest keys/src are relative to the Vite root (web/), so repo sources look like "../src/x.ts". */
function normalizeSrc(src: string): string {
  return src.replace(/\\/g, '/').replace(/^(\.\.\/)+/, '');
}

function chunkForSource(repoRelSource: string): ManifestChunk | undefined {
  return Object.entries(manifest).find(([key, chunk]) => normalizeSrc(chunk.src ?? key) === repoRelSource)?.[1];
}

function entryChunk(): ManifestChunk {
  const entries = Object.values(manifest).filter((c) => c.isEntry && c.file.endsWith('.js'));
  expect(entries.map((c) => c.file), 'expected exactly one JS entry chunk in the build manifest').toHaveLength(1);
  return entries[0];
}

/** Files statically reachable from the entry (following manifest `imports`, not `dynamicImports`). */
function staticallyReachableFiles(entry: ManifestChunk): Set<string> {
  const byKey = new Map(Object.entries(manifest));
  const files = new Set<string>([entry.file]);
  const seen = new Set<ManifestChunk>([entry]);
  const queue: ManifestChunk[] = [entry];
  while (queue.length > 0) {
    const current = queue.shift() as ManifestChunk;
    for (const key of current.imports ?? []) {
      const next = byKey.get(key);
      if (next && !seen.has(next)) {
        seen.add(next);
        files.add(next.file);
        queue.push(next);
      }
    }
  }
  return files;
}

function readManifest(dir: string): Manifest {
  for (const candidate of [path.join(dir, '.vite', 'manifest.json'), path.join(dir, 'manifest.json')]) {
    if (existsSync(candidate)) return JSON.parse(readFileSync(candidate, 'utf8')) as Manifest;
  }
  throw new Error(`no Vite build manifest found under ${dir}`);
}

/** Precached urls of the built sw.js (Workbox generateSW: `precacheAndRoute([{url:"...",revision:...}, ...])`). */
function readPrecacheUrls(dir: string): Set<string> {
  const sw = readFileSync(path.join(dir, 'sw.js'), 'utf8');
  const urls = new Set<string>();
  for (const m of sw.matchAll(/["']?url["']?\s*:\s*["']([^"']+)["']/g)) urls.add(m[1].replace(/^\.?\//, ''));
  return urls;
}

function listJsUnderAssets(dir: string): string[] {
  const assets = path.join(dir, 'assets');
  const out: string[] = [];
  const walk = (current: string): void => {
    for (const name of readdirSync(current)) {
      const abs = path.join(current, name);
      if (statSync(abs).isDirectory()) walk(abs);
      else if (name.endsWith('.js')) out.push(path.relative(dir, abs).split(path.sep).join('/'));
    }
  };
  if (existsSync(assets)) walk(assets);
  return out;
}

beforeAll(async () => {
  outDir = mkdtempSync(path.join(os.tmpdir(), 'kids-app-build-guard-'));
  await build({
    configFile: path.join(REPO_ROOT, 'vite.config.ts'),
    root: path.join(REPO_ROOT, 'web'),
    logLevel: 'silent',
    build: { outDir, emptyOutDir: true, manifest: true },
  });
  manifest = readManifest(outDir);
}, 180_000);

afterAll(() => {
  if (outDir) rmSync(outDir, { recursive: true, force: true });
});

describe('build code-splitting guard', () => {
  it('shell entry chunk stays within the size budget', () => {
    const entry = entryChunk();
    const size = statSync(path.join(outDir, entry.file)).size;
    expect(
      size,
      `shell entry ${entry.file} is ${size} bytes (${(size / 1024 / 1024).toFixed(2)} MiB); budget is ${SHELL_ENTRY_BUDGET_BYTES} bytes`,
    ).toBeLessThanOrEqual(SHELL_ENTRY_BUDGET_BYTES);
  });

  it('every WORLD_GAMES scene is emitted as its own dynamic-entry chunk', () => {
    const entry = entryChunk();
    for (const game of WORLD_GAMES) {
      const source = WORLD_SCENE_SOURCE[game.gameId];
      expect(source, `no scene source mapped for WORLD_GAMES id "${game.gameId}" (tests/unit/helpers/worldSceneSource.ts)`).toBeTruthy();
      const chunk = chunkForSource(source);
      expect(chunk, `${game.gameId}: ${source} is not emitted as its own chunk (still bundled into another chunk)`).toBeDefined();
      expect(chunk?.isDynamicEntry, `${game.gameId}: ${source} must be a dynamic entry (loaded via import())`).toBe(true);
      expect(chunk?.file, `${game.gameId}: ${source} must not live in the entry chunk`).not.toBe(entry.file);
    }
  });

  it('the Bubbles, Colouring and Wardrobe scenes are dynamic-entry chunks too', () => {
    const entry = entryChunk();
    for (const source of [WORLD_SCENE_SOURCE.bubbles, WORLD_SCENE_SOURCE['leisure-colouring'], WARDROBE_SCENE_SOURCE]) {
      const chunk = chunkForSource(source);
      expect(chunk, `${source} is not emitted as its own chunk`).toBeDefined();
      expect(chunk?.isDynamicEntry, `${source} must be a dynamic entry`).toBe(true);
      expect(chunk?.file).not.toBe(entry.file);
    }
  });

  it('the game engine (createGame, with Phaser) is a dynamic-entry chunk, not part of the shell entry', () => {
    const entry = entryChunk();
    const chunk = chunkForSource(CREATE_GAME_SOURCE);
    expect(chunk, `${CREATE_GAME_SOURCE} is not emitted as its own chunk (profile select would pull Phaser)`).toBeDefined();
    expect(chunk?.isDynamicEntry).toBe(true);
    expect(chunk?.file).not.toBe(entry.file);
    expect(staticallyReachableFiles(entry).has(chunk?.file ?? ''), 'createGame chunk is statically reachable from the entry').toBe(false);
  });

  it('no game scene chunk is statically reachable from the entry', () => {
    const entry = entryChunk();
    const reachable = staticallyReachableFiles(entry);
    for (const source of ALL_SCENE_SOURCES) {
      const chunk = chunkForSource(source);
      // A scene with no chunk of its own is bundled into some other chunk: that is a failure too, never a vacuous pass.
      expect(chunk, `${source} has no chunk of its own, so it cannot be lazily loaded`).toBeDefined();
      expect(reachable.has(chunk?.file ?? ''), `${source} (${chunk?.file}) is statically reachable from the entry`).toBe(false);
    }
  });

  it('the service worker precaches the entry and every emitted JS chunk so games work offline', () => {
    const urls = readPrecacheUrls(outDir);
    expect(urls.size, 'could not parse any precache url from the built sw.js').toBeGreaterThan(0);

    const entry = entryChunk();
    expect(urls.has(entry.file), `sw.js precache is missing the entry ${entry.file}`).toBe(true);

    for (const source of ALL_SCENE_SOURCES) {
      const chunk = chunkForSource(source);
      expect(chunk, `${source} has no chunk of its own`).toBeDefined();
      expect(urls.has(chunk?.file ?? ''), `sw.js precache is missing the scene chunk ${chunk?.file} (${source})`).toBe(true);
    }

    const jsFiles = listJsUnderAssets(outDir);
    expect(jsFiles.length, 'build emitted no JS under assets/').toBeGreaterThan(0);
    const missing = jsFiles.filter((f) => !urls.has(f));
    expect(missing, `emitted JS chunks missing from the sw.js precache: ${missing.join(', ')}`).toEqual([]);
  });
});

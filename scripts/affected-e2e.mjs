#!/usr/bin/env node
// Affected e2e selection (see docs/PROCESS.md, "CI: affected tests").
//
// Maps changed files to the Playwright specs that should run. Explicit map, no heuristics:
//   - a changed spec selects itself;
//   - game-specific files (game folder, content JSON, unit tests, helpers) select that game's specs;
//   - any other changed path (shared runtime code, config, scripts, tooling, unknown paths)
//     falls back to the smoke set (plus any direct mappings that also match);
//   - only docs, markdown, prototype files and unit-only tests select nothing.
// A changed code path never selects zero specs. A missing diff base or a failed `git diff`
// selects the smoke set with a `::warning::` line, never zero specs.
// The full e2e suite is never selected; run it with `npm run test:e2e` or workflow_dispatch.
//
// Usage:
//   node scripts/affected-e2e.mjs --base <sha> [--head <ref>]   changed files = git diff base...head
//   node scripts/affected-e2e.mjs --files a.ts b.ts             explicit file list
//   git diff --name-only X | node scripts/affected-e2e.mjs      file list on stdin
// Prints one spec per line. With --github-output (or GITHUB_OUTPUT set) it also writes
// `run=true|false` and `specs=<space separated>` for the workflow.
//
// No dependencies beyond Node.

import fs from 'node:fs';
import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const E2E = 'tests/e2e/';

/** Approved smoke set, run for any shared (non game-specific) runtime change. */
export const SMOKE_SPECS = ['tests/e2e/journey.spec.ts', 'tests/e2e/hud.spec.ts'];

const COLOURING_SPECS = [
  'tests/e2e/leisure-colouring.art.spec.ts',
  'tests/e2e/leisure-colouring.journey.spec.ts',
  'tests/e2e/leisure-colouring.platform.spec.ts',
];

/**
 * Every spec that goes through a world picker or station trail (src/ui/picker/**): a change to the shared picker
 * (model, trail, cards, art keys) can break any of them, so it selects all of them. One rule, not one per game.
 */
export const PICKER_SPECS = [
  'tests/e2e/balloon-pop.journey.spec.ts',
  'tests/e2e/hiding.spec.ts',
  'tests/e2e/kitchen-orchestra.picker.spec.ts',
  'tests/e2e/letter-monster.journey.spec.ts',
  'tests/e2e/magic-magnet.journey.spec.ts',
  'tests/e2e/picker.press-through.spec.ts',
  'tests/e2e/potion-lab.journey.spec.ts',
  'tests/e2e/science-world.map.spec.ts',
  'tests/e2e/seed-to-flower.journey.spec.ts',
  'tests/e2e/sink-or-float.journey.spec.ts',
  'tests/e2e/sorting-beds.journey.spec.ts',
  'tests/e2e/sorting-beds.platform.spec.ts',
  'tests/e2e/station-trail.spec.ts',
  'tests/e2e/travel-suitcase.journey.spec.ts',
  'tests/e2e/who-is-hiding.journey.spec.ts',
  'tests/e2e/who-lives-here.journey.spec.ts',
];

/** Explicit map. Every tests/e2e/*.spec.ts must appear in some `specs` list or in SMOKE_SPECS. */
export const GAME_RULES = [
  {
    // The shared picker and station trail are the way into every world with 2+ games (and the coming-soon picker for a world with none).
    id: 'picker',
    match: [/^src\/ui\/picker\//],
    specs: PICKER_SPECS,
  },
  {
    id: 'animal-restaurant',
    match: [
      /^src\/games\/restaurant\//,
      /^src\/content\/games\/animal-restaurant\.json$/,
      /^tests\/unit\/(restaurant|animal-restaurant|trialTracker)[^/]*$/,
    ],
    specs: ['tests/e2e/animal-restaurant.journey.spec.ts'],
  },
  {
    id: 'who-is-hiding',
    match: [
      /^src\/games\/hiding\//,
      /^src\/content\/games\/who-is-hiding\.json$/,
      /^tests\/unit\/(hiding|who-is-hiding)[^/]*$/,
    ],
    specs: ['tests/e2e/hiding.spec.ts', 'tests/e2e/who-is-hiding.journey.spec.ts'],
  },
  {
    id: 'who-lives-here',
    match: [
      /^src\/games\/habitat\//,
      /^src\/content\/games\/who-lives-here\.json$/,
      /^src\/anim\/homesTrainMotion\.ts$/,
      /^public\/art\/(homes|scenes\/habitats)\//,
      /^tests\/unit\/who-lives-here[^/]*$/,
    ],
    specs: ['tests/e2e/who-lives-here.journey.spec.ts'],
  },
  {
    id: 'kitchen-orchestra',
    match: [
      /^src\/games\/orchestra\//,
      /^src\/content\/games\/kitchen-orchestra\.json$/,
      /^public\/art\/instruments\//,
      /^tests\/unit\/(orchestra|kitchen-orchestra)[^/]*$/,
    ],
    specs: ['tests/e2e/kitchen-orchestra.picker.spec.ts'],
  },
  {
    id: 'travel-suitcase',
    match: [
      /^src\/games\/travelSuitcase\//,
      /^src\/content\/games\/travel-suitcase\.json$/,
      /^src\/anim\/sortPackMotion\.ts$/,
      /^public\/art\/props\/suitcase-(back|front)\.svg$/,
      /^tests\/e2e\/helpers\/journey\.ts$/,
      /^tests\/unit\/travel-suitcase[^/]*$/,
    ],
    specs: ['tests/e2e/travel-suitcase.journey.spec.ts'],
  },
  {
    id: 'picker-press-through',
    match: [
      /^tests\/e2e\/helpers\/pickerPressThrough\.ts$/,
    ],
    specs: ['tests/e2e/picker.press-through.spec.ts'],
  },
  {
    id: 'station-trail',
    match: [
      /^src\/worlds\/worldTrail\.ts$/,
      /^tests\/unit\/station-trail[^/]*$/,
    ],
    specs: ['tests/e2e/station-trail.spec.ts'],
  },
  {
    id: 'letter-monster',
    match: [
      /^src\/games\/letterMonster\//,
      /^src\/content\/games\/letter-monster\.json$/,
      /^public\/art\/props\/monster-[a-z]+\.svg$/,
      /^tests\/unit\/letter-monster[^/]*$/,
    ],
    specs: ['tests/e2e/letter-monster.journey.spec.ts'],
  },
  {
    id: 'seed-to-flower',
    match: [
      /^src\/games\/seedFlower\//,
      /^src\/content\/games\/seed-to-flower\.json$/,
      /^public\/art\/props\/(seed|sprout|flower-bud|watering-can|sun)\.svg$/,
      /^tests\/unit\/seed-to-flower[^/]*$/,
    ],
    specs: ['tests/e2e/seed-to-flower.journey.spec.ts'],
  },
  {
    id: 'leisure-colouring',
    match: [
      /^src\/games\/colouring\//,
      /^src\/core\/colouring\//,
      /^src\/content\/games\/leisure-colouring\.json$/,
      /^src\/ui\/colouringChrome\.ts$/,
      /^src\/assets\/art\/(colouringManifest|puppetColor)\.ts$/,
      /^src\/anim\/puppetColorMotion\.ts$/,
      /^public\/art\/(colouring|coloring|puppet)\//,
      /^tests\/shared\/leisureColouringPages\.ts$/,
      /^tests\/fixtures\/colouring\//,
      /^tests\/e2e\/helpers\/colouringArtCheck\.ts$/,
      /^tests\/unit\/(leisure-colouring|puppetColorMotion)[^/]*$/,
    ],
    specs: COLOURING_SPECS,
  },
  {
    id: 'sorting-beds',
    match: [
      /^src\/games\/sorting\//,
      /^src\/content\/games\/sorting-beds\.json$/,
      /^src\/anim\/(homesTrainMotion|sortPackMotion|trainLayout)\.ts$/,
      /^public\/art\/(homes|train)\//,
      /^tests\/unit\/(sorting-beds|sortPackMotion|homesTrainMotion|trainLayout)[^/]*$/,
    ],
    specs: ['tests/e2e/sorting-beds.journey.spec.ts', 'tests/e2e/sorting-beds.platform.spec.ts'],
  },
  {
    id: 'science-world',
    // Science World map area: its building art and its entry (one game: direct; none: coming-soon picker). MapScene stays smoke-only.
    match: [
      /^public\/art\/buildings\//,
      /^tests\/unit\/science-world[^/]*$/,
    ],
    specs: ['tests/e2e/science-world.map.spec.ts'],
  },
  {
    id: 'potion-lab',
    match: [
      /^src\/games\/potionLab\//,
      /^src\/content\/games\/potion-lab\.json$/,
      /^public\/art\/props\/mixing-bowl\.svg$/,
      /^public\/art\/palette\/pot-(red|yellow|blue)\.svg$/,
      /^tests\/unit\/potion-lab[^/]*$/,
    ],
    specs: ['tests/e2e/potion-lab.journey.spec.ts', 'tests/e2e/science-world.map.spec.ts'],
  },
  {
    // Wardrobe (docs/specs/wardrobe.md): HUD entry, scene, pure model, content and art. hud.ts and
    // appContext.ts are shared and fall back to the smoke set on their own; they are not listed here.
    id: 'wardrobe',
    match: [
      /^src\/core\/wardrobe\//,
      /^src\/content\/wardrobe\//,
      /^src\/games\/wardrobe\//,
      /^src\/ui\/wardrobeChrome\.ts$/,
      /^src\/assets\/art\/wardrobeManifest\.ts$/,
      /^public\/art\/wardrobe\//,
      /^tests\/unit\/wardrobe[^/]*$/,
    ],
    specs: ['tests/e2e/wardrobe.journey.spec.ts'],
  },
  {
    id: 'sink-or-float',
    match: [
      /^src\/games\/sinkFloat\//,
      /^src\/content\/games\/sink-or-float\.json$/,
      /^public\/art\/props\/(water-tank|float-[a-z]+)\.svg$/,
      /^tests\/unit\/sink-or-float[^/]*$/,
    ],
    specs: ['tests/e2e/sink-or-float.journey.spec.ts', 'tests/e2e/science-world.map.spec.ts'],
  },
  {
    id: 'magic-magnet',
    match: [
      /^src\/games\/magicMagnet\//,
      /^src\/content\/games\/magic-magnet\.json$/,
      /^public\/art\/magnet\//,
      /^tests\/unit\/magic-magnet[^/]*$/,
    ],
    specs: ['tests/e2e/magic-magnet.journey.spec.ts', 'tests/e2e/science-world.map.spec.ts'],
  },
  {
    id: 'balloon-pop',
    match: [
      /^src\/games\/balloon\//,
      /^src\/content\/games\/balloon-pop\.json$/,
      /^tests\/unit\/balloon-pop[^/]*$/,
    ],
    specs: ['tests/e2e/balloon-pop.journey.spec.ts'],
  },
  {
    id: 'credits',
    match: [
      /^src\/content\/credits[^/]*$/,
      /^src\/ui\/credits\.ts$/,
      /^tests\/unit\/credits[^/]*$/,
    ],
    specs: ['tests/e2e/credits.spec.ts'],
  },
  {
    id: 'build-info',
    // The parent screen shows the build info line, so parent.ts also selects the smoke set (shared UI).
    match: [
      /^src\/buildInfo\.ts$/,
      /^build\/buildDefines\.ts$/,
      /^src\/ui\/parent\.ts$/,
      /^tests\/unit\/buildInfo[^/]*$/,
    ],
    specs: ['tests/e2e/buildInfo.spec.ts'],
  },
  {
    id: 'help-card',
    // The shell is also shared code, so shell.ts additionally selects the smoke set.
    match: [/^src\/ui\/shell\.ts$/],
    specs: ['tests/e2e/help-card.shell.spec.ts'],
  },
  {
    id: 'parent-longpress-gate',
    // The long-press binder is bound by the profile-select and map-HUD parent buttons: those shared files
    // (and shell.css) also select the smoke set via ALSO_SMOKE. Its unit tests select only the gate spec.
    match: [
      /^src\/ui\/longPress\.ts$/,
      /^src\/ui\/profileSelect\.ts$/,
      /^src\/ui\/hud\.ts$/,
      /^src\/styles\/shell\.css$/,
      /^tests\/unit\/parent-longpress-gate[^/]*$/,
    ],
    specs: ['tests/e2e/parent-longpress-gate.spec.ts'],
  },
];

/**
 * The only paths that select nothing: clearly non-runtime. Everything else that changed
 * (src, web, public, config, scripts, tools, build, workflows, unknown paths) selects the smoke set.
 */
const NO_E2E = [
  /\.md$/i,
  /^docs\//,
  // Prototype files at the repository root (not built by Vite).
  /^(index\.html|app\.js|style\.css|sw\.js|manifest\.json|icon[^/]*)$/,
  // Unit-only tests (game-mapped ones are handled by GAME_RULES before this point).
  /^tests\/unit\//,
];

/** Directly mapped files that are also shared runtime code. */
const ALSO_SMOKE = [
  /^src\/ui\/shell\.ts$/,
  /^src\/ui\/picker\//,
  /^src\/ui\/parent\.ts$/,
  /^tests\/e2e\/helpers\/journey\.ts$/,
  /^src\/ui\/longPress\.ts$/,
  /^src\/ui\/profileSelect\.ts$/,
  /^src\/ui\/hud\.ts$/,
  /^src\/styles\/shell\.css$/,
];

const norm = (f) => f.trim().replace(/\\/g, '/').replace(/^\.\//, '');

export function parseChangedFiles(text) {
  return text
    .split(/\r?\n/)
    .map(norm)
    .filter(Boolean);
}

/**
 * @param {string[]} changedFiles repo-relative paths
 * @param {string[]} [existingSpecs] when given, selected specs not in this list (deleted) are dropped
 * @returns {string[]} sorted, de-duplicated spec paths
 */
export function selectAffectedE2e(changedFiles, existingSpecs) {
  const selected = new Set();
  for (const raw of changedFiles) {
    const file = norm(raw);
    if (!file) continue;

    if (file.startsWith(E2E) && file.endsWith('.spec.ts')) {
      selected.add(file);
      continue;
    }

    let direct = false;
    for (const rule of GAME_RULES) {
      if (rule.match.some((re) => re.test(file))) {
        direct = true;
        for (const s of rule.specs) selected.add(s);
      }
    }

    // Game-specific files select only their game. Shared UI that also has a direct mapping
    // (shell help, game picker) additionally selects the smoke set.
    if (direct && !ALSO_SMOKE.some((re) => re.test(file))) continue;
    if (NO_E2E.some((re) => re.test(file))) continue;
    // Anything else (shared runtime, config, scripts, tooling, unknown paths): smoke, never zero.
    for (const s of SMOKE_SPECS) selected.add(s);
  }
  let result = [...selected];
  if (existingSpecs) {
    const keep = new Set(existingSpecs);
    result = result.filter((s) => keep.has(s));
  }
  return result.sort();
}

/** Recursively lists tests/e2e/**\/*.spec.ts (repo-relative, forward slashes, sorted). */
export function listSpecs(root) {
  const out = [];
  const walk = (rel) => {
    for (const entry of fs.readdirSync(path.join(root, rel), { withFileTypes: true })) {
      const child = `${rel}/${entry.name}`;
      if (entry.isDirectory()) walk(child);
      else if (entry.name.endsWith('.spec.ts')) out.push(child);
    }
  };
  walk('tests/e2e');
  return out.sort();
}

const ZERO_SHA = /^0+$/;

/**
 * Selects specs for `git diff base...head`. Never selects zero specs because the diff is unavailable:
 * a missing/all-zeros base or a throwing `diff` returns the smoke set plus a `::warning::` line.
 *
 * @param {{ base?: string, head?: string, diff: (range: string) => string, existingSpecs?: string[] }} opts
 *   `diff(range)` returns `git diff --name-only <range>` output and may throw.
 * @returns {{ changed: string[], specs: string[], warning: string | null }}
 */
export function selectAffectedE2eOrSmokeOnDiffFailure({ base, head = 'HEAD', diff, existingSpecs }) {
  const smoke = () => {
    const keep = existingSpecs ? new Set(existingSpecs) : null;
    return SMOKE_SPECS.filter((s) => !keep || keep.has(s)).sort();
  };
  const trimmed = (base ?? '').trim();
  if (!trimmed || ZERO_SHA.test(trimmed)) {
    return {
      changed: [],
      specs: smoke(),
      warning: '::warning::affected-e2e: diff base was missing or unusable (empty or all zeros); running the smoke e2e set instead of skipping.',
    };
  }
  const range = `${trimmed}...${head}`;
  let changed;
  try {
    changed = parseChangedFiles(diff(range));
  } catch (err) {
    const reason = String(err && err.message ? err.message : err).split('\n')[0];
    return {
      changed: [],
      specs: smoke(),
      warning: `::warning::affected-e2e: git diff failed for ${range} (${reason}); running the smoke e2e set instead of skipping.`,
    };
  }
  return { changed, specs: selectAffectedE2e(changed, existingSpecs), warning: null };
}

function git(root, args) {
  return execFileSync('git', args, { cwd: root, encoding: 'utf8' });
}

function readStdin() {
  try {
    return fs.readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

export function parseArgs(argv) {
  const opts = { base: null, head: 'HEAD', files: null, githubOutput: false };
  for (let i = 0; i < argv.length; i++) {
    const a = argv[i];
    if (a === '--base') {
      const next = argv[i + 1];
      // A bare `--base` (last flag, or followed by another flag) is an empty base, not stdin.
      if (next !== undefined && !String(next).startsWith('--')) opts.base = argv[++i];
      else opts.base = '';
    } else if (a === '--head') opts.head = argv[++i];
    else if (a === '--github-output') opts.githubOutput = true;
    else if (a === '--files') {
      opts.files = [];
      while (i + 1 < argv.length && !argv[i + 1].startsWith('--')) opts.files.push(argv[++i]);
    }
  }
  return opts;
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const opts = parseArgs(process.argv.slice(2));
  const existingSpecs = listSpecs(root);

  let changed;
  let specs;
  if (opts.files) {
    changed = opts.files.map(norm).filter(Boolean);
    specs = selectAffectedE2e(changed, existingSpecs);
  } else if (opts.base !== null && opts.base !== undefined) {
    // Missing base or a failed diff selects the smoke set with a warning, never zero specs.
    const r = selectAffectedE2eOrSmokeOnDiffFailure({
      base: opts.base,
      head: opts.head,
      diff: (range) => git(root, ['diff', '--name-only', range]),
      existingSpecs,
    });
    changed = r.changed;
    specs = r.specs;
    if (r.warning) console.error(r.warning);
  } else {
    changed = parseChangedFiles(readStdin());
    specs = selectAffectedE2e(changed, existingSpecs);
  }

  console.error(`affected-e2e: ${changed.length} changed file(s)`);
  for (const f of changed) console.error(`  changed: ${f}`);
  if (specs.length === 0) console.error('affected-e2e: no e2e specs affected; e2e will be skipped.');
  else {
    console.error(`affected-e2e: ${specs.length} spec(s) selected:`);
    for (const s of specs) console.error(`  spec: ${s}`);
  }
  for (const s of specs) console.log(s);

  const out = process.env.GITHUB_OUTPUT;
  if ((opts.githubOutput || out) && out) {
    fs.appendFileSync(out, `run=${specs.length > 0}\nspecs=${specs.join(' ')}\n`);
  }
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import {
  GAME_RULES,
  SMOKE_SPECS,
  listSpecs,
  parseArgs,
  parseChangedFiles,
  selectAffectedE2e,
  selectAffectedE2eOrSmokeOnDiffFailure,
} from '../../scripts/affected-e2e.mjs';

const root = path.resolve(__dirname, '..', '..');
const e2eDir = path.join(root, 'tests', 'e2e');

/** Recursive listing used for map-coverage, matching production `listSpecs`. */
function listSpecsOnDisk(dir: string, prefix = 'tests/e2e'): string[] {
  const out: string[] = [];
  for (const entry of fs.readdirSync(dir, { withFileTypes: true })) {
    const rel = `${prefix}/${entry.name}`;
    if (entry.isDirectory()) out.push(...listSpecsOnDisk(path.join(dir, entry.name), rel));
    else if (entry.name.endsWith('.spec.ts')) out.push(rel);
  }
  return out.sort();
}

const specsOnDisk = listSpecsOnDisk(e2eDir);

const SMOKE = ['tests/e2e/hud.spec.ts', 'tests/e2e/journey.spec.ts'];

describe('affected e2e selection', () => {
  it('approved smoke set is journey + hud', () => {
    expect([...SMOKE_SPECS].sort()).toEqual(SMOKE);
  });

  it('empty input selects nothing', () => {
    expect(selectAffectedE2e([])).toEqual([]);
  });

  it('docs-only and markdown-only changes select nothing', () => {
    expect(selectAffectedE2e(['docs/PROCESS.md', 'README.md', 'docs/specs/sorting-beds.md', 'AGENTS.md'])).toEqual([]);
  });

  it('unrelated tooling (prototype files, unit-only tests) selects nothing', () => {
    expect(selectAffectedE2e(['index.html', 'app.js', 'style.css', 'sw.js', 'tests/unit/storage.test.ts'])).toEqual([]);
  });

  it('an unmapped source path falls back to the smoke set, never zero specs', () => {
    expect(selectAffectedE2e(['unknown/path.ts'])).toEqual(SMOKE);
  });

  it('unmapped scripts, tools, build helpers and odd config names fall back to the smoke set', () => {
    for (const f of ['scripts/some-new-script.mjs', 'tools/art-preview/render.ts', 'build/otherHelper.ts', 'eslint.config.js', '.nvmrc', 'tests/fixtures/other/data.json']) {
      expect(selectAffectedE2e([f]), f).toEqual(SMOKE);
    }
  });

  it('build info files select the buildInfo spec only', () => {
    for (const f of ['src/buildInfo.ts', 'build/buildDefines.ts', 'tests/unit/buildInfo.test.ts', 'tests/e2e/buildInfo.spec.ts']) {
      expect(selectAffectedE2e([f]), f).toEqual(['tests/e2e/buildInfo.spec.ts']);
    }
  });

  it('the parent screen (shows the build info line) selects buildInfo plus smoke', () => {
    expect(selectAffectedE2e(['src/ui/parent.ts'])).toEqual(['tests/e2e/buildInfo.spec.ts', ...SMOKE]);
  });

  it('a game-only change selects that game specs and not the whole suite', () => {
    const picked = selectAffectedE2e(['src/games/sorting/sortingLogic.ts']);
    expect(picked).toEqual(['tests/e2e/sorting-beds.journey.spec.ts', 'tests/e2e/sorting-beds.platform.spec.ts']);
  });

  it('game content JSON selects that game specs', () => {
    expect(selectAffectedE2e(['src/content/games/animal-restaurant.json'])).toEqual([
      'tests/e2e/animal-restaurant.journey.spec.ts',
    ]);
  });

  it('game unit tests select that game specs', () => {
    expect(selectAffectedE2e(['tests/unit/who-is-hiding.audio.test.ts'])).toEqual([
      'tests/e2e/hiding.spec.ts',
      'tests/e2e/who-is-hiding.journey.spec.ts',
    ]);
    expect(selectAffectedE2e(['tests/unit/restaurantLayout.test.ts'])).toEqual([
      'tests/e2e/animal-restaurant.journey.spec.ts',
    ]);
  });

  it('colouring core and colouring game map to all three colouring specs', () => {
    const expected = [
      'tests/e2e/leisure-colouring.art.spec.ts',
      'tests/e2e/leisure-colouring.journey.spec.ts',
      'tests/e2e/leisure-colouring.platform.spec.ts',
    ];
    expect(selectAffectedE2e(['src/core/colouring/store.ts'])).toEqual(expected);
    expect(selectAffectedE2e(['src/games/colouring/ColouringScene.ts'])).toEqual(expected);
    expect(selectAffectedE2e(['tests/shared/leisureColouringPages.ts'])).toEqual(expected);
  });

  it('orchestra game and shell.css select the orchestra picker spec', () => {
    expect(selectAffectedE2e(['src/games/orchestra/orchestraGame.ts'])).toEqual([
      'tests/e2e/kitchen-orchestra.picker.spec.ts',
    ]);
    // shell.css is also shared (smoke + long-press gate from #70).
    expect(selectAffectedE2e(['src/styles/shell.css'])).toEqual([
      ...SMOKE,
      'tests/e2e/kitchen-orchestra.picker.spec.ts',
      'tests/e2e/parent-longpress-gate.spec.ts',
    ]);
  });

  it('word train selects its journey spec, and picker files select word train too', () => {
    const expected = ['tests/e2e/word-train.journey.spec.ts'];
    expect(selectAffectedE2e(['src/games/wordTrain/WordTrainScene.ts'])).toEqual(expected);
    expect(selectAffectedE2e(['src/content/games/word-train.json'])).toEqual(expected);
    expect(selectAffectedE2e(['public/art/word-train/wagon.svg'])).toEqual(expected);
    expect(selectAffectedE2e(['tests/unit/word-train.machine.test.ts'])).toEqual(expected);
    expect(selectAffectedE2e(['src/ui/picker/gamePicker.ts'])).toEqual(
      expect.arrayContaining(['tests/e2e/word-train.journey.spec.ts']),
    );
  });

  it('seed to flower selects its journey; the shared picker also selects both Nature Lab journeys', () => {
    expect(selectAffectedE2e(['src/games/seedFlower/seedFlowerMachine.ts'])).toEqual(['tests/e2e/seed-to-flower.journey.spec.ts']);
    expect(selectAffectedE2e(['src/content/games/seed-to-flower.json'])).toEqual(['tests/e2e/seed-to-flower.journey.spec.ts']);
    const natureLab = ['tests/e2e/hiding.spec.ts', 'tests/e2e/who-is-hiding.journey.spec.ts', 'tests/e2e/seed-to-flower.journey.spec.ts'];
    expect(selectAffectedE2e(['src/ui/picker/pickerModel.ts'])).toEqual(expect.arrayContaining(natureLab));
  });

  it('credits content and UI select the credits spec', () => {
    expect(selectAffectedE2e(['src/content/credits.json'])).toEqual(['tests/e2e/credits.spec.ts']);
    expect(selectAffectedE2e(['src/content/credits.ts'])).toEqual(['tests/e2e/credits.spec.ts']);
    expect(selectAffectedE2e(['src/ui/credits.ts'])).toEqual(['tests/e2e/credits.spec.ts']);
  });

  it('a shared-only change selects exactly the smoke set', () => {
    expect(selectAffectedE2e(['src/core/audio/manager.ts'])).toEqual(SMOKE);
    expect(selectAffectedE2e(['src/game/createGame.ts'])).toEqual(SMOKE);
    expect(selectAffectedE2e(['src/main.ts'])).toEqual(SMOKE);
    expect(selectAffectedE2e(['src/games/templates/choiceServe.ts'])).toEqual(SMOKE);
    expect(selectAffectedE2e(['src/worlds/MapScene.ts'])).toEqual(SMOKE);
  });

  it('shared tooling and config select the smoke set only', () => {
    for (const f of ['package.json', 'package-lock.json', 'vite.config.ts', 'vitest.config.ts', 'playwright.config.ts', 'tsconfig.json']) {
      expect(selectAffectedE2e([f]), f).toEqual(SMOKE);
    }
  });

  it('a game folder without dedicated e2e specs (bubbles) falls back to the smoke set', () => {
    expect(selectAffectedE2e(['src/games/bubbles/BubblesScene.ts'])).toEqual(SMOKE);
  });

  it('shared e2e helpers select the smoke set, game helpers select their game', () => {
    expect(selectAffectedE2e(['tests/e2e/helpers/journey.ts'])).toEqual(SMOKE);
    expect(selectAffectedE2e(['tests/e2e/helpers/colouringArtCheck.ts'])).toEqual([
      'tests/e2e/leisure-colouring.art.spec.ts',
      'tests/e2e/leisure-colouring.journey.spec.ts',
      'tests/e2e/leisure-colouring.platform.spec.ts',
    ]);
  });

  it('mixed shared + game selects smoke plus the game specs, de-duplicated and sorted', () => {
    expect(selectAffectedE2e(['src/core/audio/manager.ts', 'src/games/hiding/HidingScene.ts', 'src/games/hiding/hidingRound.ts'])).toEqual([
      'tests/e2e/hiding.spec.ts',
      'tests/e2e/hud.spec.ts',
      'tests/e2e/journey.spec.ts',
      'tests/e2e/who-is-hiding.journey.spec.ts',
    ]);
  });

  it('shell help changes select the help-card spec plus smoke (shell is shared)', () => {
    expect(selectAffectedE2e(['src/ui/shell.ts'])).toEqual(['tests/e2e/help-card.shell.spec.ts', ...SMOKE]);
  });

  it('the long-press gate binder and the shared buttons that use it select the gate spec plus smoke', () => {
    for (const f of ['src/ui/longPress.ts', 'src/ui/profileSelect.ts', 'src/ui/hud.ts']) {
      expect(selectAffectedE2e([f]), f).toEqual([...SMOKE, 'tests/e2e/parent-longpress-gate.spec.ts']);
    }
    // shell.css also matches the kitchen-orchestra --picker-count rule on this branch.
    expect(selectAffectedE2e(['src/styles/shell.css'])).toEqual([
      ...SMOKE,
      'tests/e2e/kitchen-orchestra.picker.spec.ts',
      'tests/e2e/parent-longpress-gate.spec.ts',
    ]);
  });

  it('long-press gate unit tests select only the gate spec (no smoke)', () => {
    for (const f of ['tests/unit/parent-longpress-gate.timer.test.ts', 'tests/unit/parent-longpress-gate.dom.test.ts']) {
      expect(selectAffectedE2e([f]), f).toEqual(['tests/e2e/parent-longpress-gate.spec.ts']);
    }
  });

  it('a changed spec file selects that spec only', () => {
    expect(selectAffectedE2e(['tests/e2e/sorting-beds.platform.spec.ts'])).toEqual(['tests/e2e/sorting-beds.platform.spec.ts']);
    expect(selectAffectedE2e(['tests/e2e/brand-new.spec.ts'])).toEqual(['tests/e2e/brand-new.spec.ts']);
    expect(selectAffectedE2e(['tests/e2e/parent-longpress-gate.spec.ts'])).toEqual(['tests/e2e/parent-longpress-gate.spec.ts']);
  });

  it('never selects the full suite for shared + every game folder touched at once is bounded by the map', () => {
    const picked = selectAffectedE2e(['package.json', 'src/core/audio/manager.ts']);
    expect(picked.length).toBeLessThan(specsOnDisk.length);
  });

  it('only keeps selected specs that exist when an existing list is supplied (deleted specs)', () => {
    expect(selectAffectedE2e(['tests/e2e/gone.spec.ts', 'src/ui/credits.ts'], specsOnDisk)).toEqual(['tests/e2e/credits.spec.ts']);
  });

  it('normalises Windows-style separators and blank lines in parsed input', () => {
    expect(parseChangedFiles('src\\games\\sorting\\sortingLogic.ts\n\n  docs/PROCESS.md  \n')).toEqual([
      'src/games/sorting/sortingLogic.ts',
      'docs/PROCESS.md',
    ]);
  });
});

describe('affected e2e diff-base fallbacks', () => {
  const noDiff = () => {
    throw new Error('diff must not be called without a usable base');
  };

  it('uses three-dot base...head and selects from the changed files when the diff works', () => {
    const calls: string[][] = [];
    const r = selectAffectedE2eOrSmokeOnDiffFailure({
      base: 'abc123',
      head: 'HEAD',
      diff: (...args: string[]) => {
        calls.push(args);
        return 'src/games/sorting/sortingLogic.ts\n';
      },
      existingSpecs: specsOnDisk,
    });
    expect(calls).toEqual([['abc123...HEAD']]);
    expect(r.warning).toBeNull();
    expect(r.changed).toEqual(['src/games/sorting/sortingLogic.ts']);
    expect(r.specs).toEqual(['tests/e2e/sorting-beds.journey.spec.ts', 'tests/e2e/sorting-beds.platform.spec.ts']);
  });

  it('a docs-only diff legitimately selects nothing and does not warn', () => {
    const r = selectAffectedE2eOrSmokeOnDiffFailure({ base: 'abc123', head: 'HEAD', diff: () => 'docs/PROCESS.md\n', existingSpecs: specsOnDisk });
    expect(r.specs).toEqual([]);
    expect(r.warning).toBeNull();
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['all zeros', '0000000000000000000000000000000000000000'],
  ])('a %s base selects the smoke set with a warning and never diffs', (_name, base) => {
    const r = selectAffectedE2eOrSmokeOnDiffFailure({ base: base as string | undefined, head: 'HEAD', diff: noDiff, existingSpecs: specsOnDisk });
    expect(r.specs).toEqual(SMOKE);
    expect(r.warning).toMatch(/^::warning::/);
    expect(r.warning).toMatch(/base/i);
  });

  it('a throwing git diff selects the smoke set with a warning, not an empty selection', () => {
    const r = selectAffectedE2eOrSmokeOnDiffFailure({
      base: 'deadbeef',
      head: 'HEAD',
      diff: () => {
        throw new Error('fatal: bad revision');
      },
      existingSpecs: specsOnDisk,
    });
    expect(r.specs).toEqual(SMOKE);
    expect(r.warning).toMatch(/^::warning::/);
    expect(r.warning).toMatch(/diff failed/i);
    expect(r.warning).toContain('fatal: bad revision');
  });
});

describe('affected e2e spec listing', () => {
  it('lists specs recursively so a nested spec is not dropped as deleted', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'affected-e2e-'));
    try {
      const dir = path.join(tmp, 'tests', 'e2e');
      fs.mkdirSync(path.join(dir, 'nested', 'deeper'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'top.spec.ts'), '');
      fs.writeFileSync(path.join(dir, 'nested', 'a.spec.ts'), '');
      fs.writeFileSync(path.join(dir, 'nested', 'deeper', 'b.spec.ts'), '');
      fs.writeFileSync(path.join(dir, 'nested', 'helper.ts'), '');
      const listed = listSpecs(tmp);
      expect(listed).toEqual(['tests/e2e/nested/a.spec.ts', 'tests/e2e/nested/deeper/b.spec.ts', 'tests/e2e/top.spec.ts']);
      expect(selectAffectedE2e(['tests/e2e/nested/a.spec.ts'], listed)).toEqual(['tests/e2e/nested/a.spec.ts']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });

  it('lists exactly the real specs on disk, including nested ones', () => {
    expect(listSpecs(root)).toEqual(specsOnDisk);
  });

  it('map-coverage disk helper lists nested specs, not only the top level', () => {
    const tmp = fs.mkdtempSync(path.join(os.tmpdir(), 'affected-e2e-disk-'));
    try {
      const dir = path.join(tmp, 'tests', 'e2e');
      fs.mkdirSync(path.join(dir, 'nested'), { recursive: true });
      fs.writeFileSync(path.join(dir, 'top.spec.ts'), '');
      fs.writeFileSync(path.join(dir, 'nested', 'inner.spec.ts'), '');
      expect(listSpecsOnDisk(dir)).toEqual(['tests/e2e/nested/inner.spec.ts', 'tests/e2e/top.spec.ts']);
    } finally {
      fs.rmSync(tmp, { recursive: true, force: true });
    }
  });
});

describe('affected e2e map coverage', () => {
  const mapped = new Set<string>([...SMOKE_SPECS, ...GAME_RULES.flatMap((r: { specs: string[] }) => r.specs)]);

  it('every tests/e2e/**/*.spec.ts is reachable by a mapping entry or the smoke set (no orphans)', () => {
    const orphans = specsOnDisk.filter((s) => !mapped.has(s));
    expect(orphans).toEqual([]);
  });

  it('every mapped spec exists on disk', () => {
    const missing = [...mapped].filter((s) => !specsOnDisk.includes(s));
    expect(missing).toEqual([]);
  });

  it('every existing spec selects at least itself', () => {
    for (const spec of specsOnDisk) {
      expect(selectAffectedE2e([spec]), spec).toContain(spec);
    }
  });

  it('every src/games/<folder> is covered by a rule or deliberately falls back to smoke', () => {
    const folders = fs
      .readdirSync(path.join(root, 'src', 'games'), { withFileTypes: true })
      .filter((d) => d.isDirectory())
      .map((d) => d.name);
    for (const folder of folders) {
      expect(selectAffectedE2e([`src/games/${folder}/x.ts`]).length, folder).toBeGreaterThan(0);
    }
  });
});

describe('affected e2e parseArgs', () => {
  it('treats a bare --base (no value) as an empty base, not as missing/stdin', () => {
    expect(parseArgs(['--base']).base).toBe('');
    expect(parseArgs(['--base', '--head', 'HEAD']).base).toBe('');
    expect(parseArgs(['--head', 'HEAD', '--base']).base).toBe('');
  });

  it('still reads an explicit --base value', () => {
    expect(parseArgs(['--base', 'abc123', '--head', 'HEAD']).base).toBe('abc123');
    expect(parseArgs(['--head', 'HEAD', '--base', 'abc123']).base).toBe('abc123');
  });

  it('leaves base null when --base is omitted, so main can still read stdin', () => {
    expect(parseArgs([]).base).toBeNull();
    expect(parseArgs(['--head', 'HEAD']).base).toBeNull();
  });

  it('empty --base selects the smoke set instead of skipping or waiting on stdin', () => {
    const r = selectAffectedE2eOrSmokeOnDiffFailure({
      base: parseArgs(['--base']).base ?? undefined,
      head: 'HEAD',
      diff: () => {
        throw new Error('diff should not run for an empty base');
      },
    });
    expect(r.specs).toEqual([...SMOKE_SPECS].sort());
    expect(r.warning).toMatch(/missing or unusable/);
  });
});

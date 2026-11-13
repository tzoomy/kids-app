import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import {
  checkCoverage,
  extractTestTitles,
  loadRepo,
  parseAcceptanceCriteria,
  parsePassInProgress,
  testFileBelongsToGame,
} from '../../scripts/check-ac-coverage.mjs';

const spec = (passInProgress: string, rows: string[]): string =>
  [
    '# `demo-game` — Demo',
    '',
    'Status: **approved**',
    `Pass in progress: **${passInProgress}**`,
    '',
    '## Acceptance criteria',
    '',
    '| ID | Criterion | Pass | Verified by | Orientation | Hooks used |',
    '|---|---|---|---|---|---|',
    ...rows,
    '',
  ].join('\n');

const ROWS = [
  '| AC-01 | Opens from the map building | 1 | e2e | both | getBuildingHit |',
  '| AC-02 | Level rises after 3 clean answers | 1 | unit | @single-orientation | — |',
  '| AC-03 | Voice is audible on the tablet | 1 | device | both | — |',
  '| ~~AC-04~~ | ~~Removed criterion~~ | 1 | e2e | both | — |',
  '| AC-05 | High level renders | 1 | e2e+seed | both | seedLevel |',
  '| AC-06 | Polished celebration | 2 | e2e | both | — |',
];

describe('AC coverage check', () => {
  it('parses ids, passes, methods and struck-through rows', () => {
    const { criteria, errors } = parseAcceptanceCriteria(spec('1', ROWS));
    expect(errors).toEqual([]);
    expect(criteria.map((c) => c.id)).toEqual(['AC-01', 'AC-02', 'AC-03', 'AC-04', 'AC-05', 'AC-06']);
    expect(criteria.find((c) => c.id === 'AC-04')?.struck).toBe(true);
    expect(criteria.find((c) => c.id === 'AC-05')?.methods).toEqual(['e2e+seed']);
    expect(criteria.find((c) => c.id === 'AC-06')?.pass).toBe(2);
  });

  it('reads Pass in progress', () => {
    expect(parsePassInProgress('Pass in progress: **none**')).toBe(0);
    expect(parsePassInProgress('Pass in progress: 2')).toBe(2);
    expect(parsePassInProgress('no such line')).toBeNull();
    expect(parsePassInProgress('Pass in progress: maybe')).toBeNaN();
  });

  it('extracts non-skipped test titles', () => {
    const src = [
      "test('[AC-01] opens from the map', async () => {});",
      "it(\"[AC-02] level rises\", () => {});",
      "test.skip('[AC-05] skipped', () => {});",
      "test.fixme('[AC-05] fixme', () => {});",
      "test('[AC-05] seeded level @single-orientation', () => {});",
    ].join('\n');
    expect(extractTestTitles(src)).toEqual(['[AC-01] opens from the map', '[AC-02] level rises', '[AC-05] seeded level @single-orientation']);
  });

  it('matches test files to a game by file name or folder', () => {
    expect(testFileBelongsToGame('tests/e2e/demo-game.spec.ts', 'demo-game')).toBe(true);
    expect(testFileBelongsToGame('tests/unit/demo-game.rules.test.ts', 'demo-game')).toBe(true);
    expect(testFileBelongsToGame('tests/unit/demo-game/rules.test.ts', 'demo-game')).toBe(true);
    expect(testFileBelongsToGame('tests/unit/demo-gamer.test.ts', 'demo-game')).toBe(false);
    expect(testFileBelongsToGame('tests/unit/other.test.ts', 'demo-game')).toBe(false);
  });

  it('passes when every automated criterion of the current pass has a tagged test', () => {
    const tests = [
      { path: 'tests/e2e/demo-game.spec.ts', source: "test('[AC-01] opens', () => {}); test('[AC-05] high level', () => {});" },
      { path: 'tests/unit/demo-game.test.ts', source: "it('[AC-02] rises', () => {});" },
    ];
    // AC-03 is device-only, AC-04 is struck through, AC-06 belongs to Pass 2.
    expect(checkCoverage([{ gameId: 'demo-game', markdown: spec('1', ROWS) }], tests)).toEqual({ problems: [], checked: 3 });
  });

  it('fails for a missing tag, a tag in another game file, and Pass 2 once it is in progress', () => {
    const tests = [
      { path: 'tests/e2e/demo-game.spec.ts', source: "test('[AC-01] opens', () => {});" },
      { path: 'tests/unit/other-game.test.ts', source: "it('[AC-02] rises', () => {}); it('[AC-05] x', () => {});" },
    ];
    const { problems } = checkCoverage([{ gameId: 'demo-game', markdown: spec('2', ROWS) }], tests);
    expect(problems.map((p) => p.match(/AC-\d+/)?.[0])).toEqual(['AC-02', 'AC-05', 'AC-06']);
  });

  it('enforces nothing while Pass in progress is none', () => {
    expect(checkCoverage([{ gameId: 'demo-game', markdown: spec('none', ROWS) }], [])).toEqual({ problems: [], checked: 0 });
  });

  it('reports malformed specs', () => {
    const bad = spec('1', [
      '| AC-01 | A | 1 | manual | both | — |',
      '| AC-01 | B | 3 | e2e | both | — |',
    ]);
    const { problems } = checkCoverage([{ gameId: 'demo-game', markdown: bad }], []);
    expect(problems.some((p) => p.includes('unknown "Verified by"'))).toBe(true);
    expect(problems.some((p) => p.includes('"Pass" must be 1 or 2'))).toBe(true);
    expect(problems.some((p) => p.includes('duplicate id'))).toBe(true);
    expect(checkCoverage([{ gameId: 'demo-game', markdown: '# no status' }], []).problems[0]).toContain('Pass in progress');
  });

  it('parses the spec template without errors', () => {
    const template = fs.readFileSync(path.resolve(__dirname, '../../docs/specs/TEMPLATE.md'), 'utf8');
    expect(parsePassInProgress(template)).toBe(0);
    const { criteria, errors } = parseAcceptanceCriteria(template);
    expect(errors).toEqual([]);
    expect(criteria.length).toBeGreaterThan(0);
  });

  it('passes on the repository as it is', () => {
    const root = path.resolve(__dirname, '../..');
    const { specs, testFiles } = loadRepo(root);
    expect(specs.map((s) => s.gameId)).not.toContain('TEMPLATE');
    expect(checkCoverage(specs, testFiles).problems).toEqual([]);
  });
});

#!/usr/bin/env node
// Acceptance-criteria coverage check (see docs/PROCESS.md, "Acceptance criteria and test mapping").
//
// For every game spec docs/specs/<game-id>.md (not TEMPLATE.md, not *.progress.md, not *.assets.md), each
// acceptance criterion in the "Acceptance criteria" table that is
//   - not struck through (~~AC-07~~),
//   - verified by unit, e2e, or e2e+seed (device-only criteria are exempt), and
//   - in a pass at or below the spec's "Pass in progress" (none | 1 | 2),
// must have at least one non-skipped test whose title contains "[AC-xx]", in a test file
// under tests/ that belongs to that game: the file name starts with <game-id> or the file
// sits in a folder named <game-id>. AC ids are per spec, so the game id disambiguates them.
//
// No dependencies beyond Node. Exit code 1 lists every uncovered or malformed criterion.

import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';

export const AUTOMATED_METHODS = ['unit', 'e2e', 'e2e+seed'];
export const KNOWN_METHODS = [...AUTOMATED_METHODS, 'device'];

const TEST_FILE_RE = /\.(test|spec)\.(ts|tsx|js|mjs|cjs)$/;

function splitRow(line) {
  const trimmed = line.trim().replace(/^\|/, '').replace(/\|$/, '');
  return trimmed.split('|').map((cell) => cell.trim());
}

function normalizeHeader(cell) {
  return cell.toLowerCase().replace(/[^a-z0-9+]/g, '');
}

/** Reads "Pass in progress: **1**" from a spec. Returns 0 for none, 1 or 2, or null if missing. */
export function parsePassInProgress(markdown) {
  const match = markdown.match(/^\s*Pass in progress:\s*\**\s*([A-Za-z0-9]+)/im);
  if (!match) return null;
  const value = match[1].toLowerCase();
  if (value === 'none' || value === '0') return 0;
  if (value === '1' || value === '2') return Number(value);
  return Number.NaN;
}

/**
 * Parses the acceptance-criteria table of one spec.
 * Returns { criteria: [{ id, struck, pass, methods }], errors: string[] }.
 */
export function parseAcceptanceCriteria(markdown) {
  const lines = markdown.split(/\r?\n/);
  const criteria = [];
  const errors = [];
  let columns = null;

  for (const line of lines) {
    if (!line.trim().startsWith('|')) {
      columns = null;
      continue;
    }
    const cells = splitRow(line);
    const headers = cells.map(normalizeHeader);
    if (headers[0] === 'id' && headers.includes('verifiedby')) {
      columns = { verifiedBy: headers.indexOf('verifiedby'), pass: headers.indexOf('pass') };
      continue;
    }
    if (!columns || cells.every((c) => /^:?-{2,}:?$/.test(c))) continue;

    const idCell = cells[0];
    const idMatch = idCell.match(/AC-\d{2,}/);
    if (!idMatch) continue;
    const id = idMatch[0];
    const struck = /~~\s*AC-\d+\s*~~/.test(idCell);
    if (struck) {
      criteria.push({ id, struck: true, pass: null, methods: [] });
      continue;
    }

    const methods = (cells[columns.verifiedBy] ?? '')
      .toLowerCase()
      .replace(/`/g, '')
      .split(/[,/;]|\s+and\s+|\s+/)
      .map((m) => m.trim())
      .filter(Boolean);
    const unknown = methods.filter((m) => !KNOWN_METHODS.includes(m));
    if (methods.length === 0) errors.push(`${id}: "Verified by" is empty`);
    if (unknown.length > 0) {
      errors.push(`${id}: unknown "Verified by" value(s): ${unknown.join(', ')} (use ${KNOWN_METHODS.join(', ')})`);
    }

    let pass = null;
    if (columns.pass >= 0) {
      const raw = (cells[columns.pass] ?? '').replace(/[^0-9]/g, '');
      pass = raw === '1' || raw === '2' ? Number(raw) : null;
      if (pass === null) errors.push(`${id}: "Pass" must be 1 or 2`);
    } else {
      errors.push(`${id}: the acceptance-criteria table has no "Pass" column`);
    }
    criteria.push({ id, struck: false, pass, methods });
  }

  const seen = new Set();
  for (const c of criteria) {
    if (seen.has(c.id)) errors.push(`${c.id}: duplicate id (ids are never reused or renumbered)`);
    seen.add(c.id);
  }
  return { criteria, errors };
}

/** Extracts titles of non-skipped test()/it() calls from a test file's source. */
export function extractTestTitles(source) {
  const titles = [];
  const re = /\b(?:test|it)(\.(?:only|skip|fixme|todo|fail|concurrent|slow|serial))?\s*\(\s*(['"`])((?:\\.|(?!\2)[\s\S])*?)\2/g;
  let m;
  while ((m = re.exec(source)) !== null) {
    const modifier = m[1] ?? '';
    if (/skip|fixme|todo/.test(modifier)) continue;
    titles.push(m[3]);
  }
  return titles;
}

/** True when a test file (path relative to the repo root) belongs to the given game. */
export function testFileBelongsToGame(relPath, gameId) {
  const parts = relPath.split(/[\\/]/);
  const base = parts[parts.length - 1];
  return parts.slice(0, -1).includes(gameId) || base === gameId || base.startsWith(`${gameId}.`) || base.startsWith(`${gameId}-`);
}

/**
 * Core check, independent of the file system.
 * specs: [{ gameId, markdown }]; testFiles: [{ path, source }] (paths relative to the repo root).
 * Returns { problems: string[], checked: number }.
 */
export function checkCoverage(specs, testFiles) {
  const problems = [];
  let checked = 0;
  for (const spec of specs) {
    const where = `docs/specs/${spec.gameId}.md`;
    const passInProgress = parsePassInProgress(spec.markdown);
    if (passInProgress === null) {
      problems.push(`${where}: missing "Pass in progress: none | 1 | 2" line`);
      continue;
    }
    if (Number.isNaN(passInProgress)) {
      problems.push(`${where}: "Pass in progress" must be none, 1, or 2`);
      continue;
    }
    const { criteria, errors } = parseAcceptanceCriteria(spec.markdown);
    for (const e of errors) problems.push(`${where}: ${e}`);

    const titles = testFiles
      .filter((f) => testFileBelongsToGame(f.path, spec.gameId))
      .flatMap((f) => extractTestTitles(f.source));

    for (const c of criteria) {
      if (c.struck || c.pass === null || c.pass > passInProgress) continue;
      if (!c.methods.some((m) => AUTOMATED_METHODS.includes(m))) continue;
      checked += 1;
      if (!titles.some((t) => t.includes(`[${c.id}]`))) {
        problems.push(
          `${where}: ${c.id} (${c.methods.join(', ')}) has no test titled "[${c.id}] ..." in tests/**/${spec.gameId}*`,
        );
      }
    }
  }
  return { problems, checked };
}

function listFiles(dir) {
  if (!fs.existsSync(dir)) return [];
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((entry) => {
    const full = path.join(dir, entry.name);
    if (entry.isDirectory()) return entry.name === 'node_modules' ? [] : listFiles(full);
    return [full];
  });
}

export function loadRepo(root) {
  const specsDir = path.join(root, 'docs', 'specs');
  const specs = listFiles(specsDir)
    .filter((f) => path.dirname(f) === specsDir && f.endsWith('.md'))
    .filter((f) => path.basename(f) !== 'TEMPLATE.md' && !f.endsWith('.progress.md') && !f.endsWith('.assets.md'))
    .map((f) => ({ gameId: path.basename(f, '.md'), markdown: fs.readFileSync(f, 'utf8') }));
  const testFiles = listFiles(path.join(root, 'tests'))
    .filter((f) => TEST_FILE_RE.test(f))
    .map((f) => ({ path: path.relative(root, f).split(path.sep).join('/'), source: fs.readFileSync(f, 'utf8') }));
  return { specs, testFiles };
}

function main() {
  const root = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '..');
  const { specs, testFiles } = loadRepo(root);
  if (specs.length === 0) {
    console.log('AC coverage: no game specs in docs/specs/ yet; nothing to check.');
    return 0;
  }
  const { problems, checked } = checkCoverage(specs, testFiles);
  if (problems.length > 0) {
    console.error(`AC coverage: ${problems.length} problem(s):`);
    for (const p of problems) console.error(`  - ${p}`);
    return 1;
  }
  console.log(`AC coverage: ${checked} automated criteria across ${specs.length} spec(s) are covered.`);
  return 0;
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  process.exitCode = main();
}

#!/usr/bin/env node
// Decides how CI runs unit tests (see docs/PROCESS.md, "CI: affected tests").
//
//   changed  the diff base is usable: `vitest run --changed <base>` (related tests only);
//   full     the base is empty, all zeros, or not a fetchable commit: run the FULL unit suite
//            (never a vacuous pass) and print a `::warning::` annotation.
//
// Usage: node scripts/unit-tests-mode.mjs "$BASE_SHA"
// Prints `full` or `changed` on stdout; the warning goes to stderr. No dependencies beyond Node.

import path from 'node:path';
import { execFileSync } from 'node:child_process';
import { fileURLToPath } from 'node:url';

const ZERO_SHA = /^0+$/;

/**
 * @param {string | undefined} baseSha
 * @param {{ commitExists: (sha: string) => boolean }} deps `commitExists` may throw (treated as missing).
 * @returns {{ mode: 'full' | 'changed', warning: string | null }}
 */
export function unitTestsMode(baseSha, { commitExists }) {
  const sha = (baseSha ?? '').trim();
  const full = (why) => ({
    mode: 'full',
    warning: `::warning::Diff base was unusable (${why}); running the full unit suite instead of only related tests.`,
  });
  if (!sha) return full('empty');
  if (ZERO_SHA.test(sha)) return full('all zeros');
  let exists = false;
  try {
    exists = commitExists(sha);
  } catch {
    exists = false;
  }
  if (!exists) return full(`commit ${sha} not available in this checkout`);
  return { mode: 'changed', warning: null };
}

function gitCommitExists(sha) {
  try {
    execFileSync('git', ['cat-file', '-e', `${sha}^{commit}`], { stdio: 'ignore' });
    return true;
  } catch {
    return false;
  }
}

if (process.argv[1] && path.resolve(process.argv[1]) === fileURLToPath(import.meta.url)) {
  const { mode, warning } = unitTestsMode(process.argv[2], { commitExists: gitCommitExists });
  if (warning) console.error(warning);
  console.log(mode);
}

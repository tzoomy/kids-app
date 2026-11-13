#!/usr/bin/env node
/**
 * PreToolUse hook for Bash: block git push to main/master and any force push
 * (--force, -f, --force-with-lease, and `+refspec`).
 *
 * Official hooks reference (https://code.claude.com/docs/en/hooks):
 * exit 2 + a reason on stderr blocks the tool call; exit 0 leaves the
 * normal permission flow in place.
 *
 * Failure policy (deliberate):
 * - FAILS OPEN (exit 0) when the hook input itself is unusable: empty or
 *   invalid stdin, a tool other than Bash, or a command that is not a git push.
 *   The guard must never break unrelated tool calls.
 * - FAILS CLOSED (exit 2 with a clear reason) once a `git push` is present but
 *   cannot be analysed: unterminated quotes, shell expansion ($VAR, $(...),
 *   backticks) in the push, an undeterminable current branch for a bare push,
 *   or any internal error while analysing the push.
 *
 * The current branch is resolved from `git -C <dir>` and from a preceding
 * `cd <dir> &&` / `cd <dir>;` (relative to the hook input `cwd`), otherwise
 * from the hook input `cwd`. `bash -c` / `sh -c` strings are analysed
 * recursively. This is a best-effort policy check, not a security boundary.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

const PROTECTED = new Set(['main', 'master']);
const SHELLS = new Set(['bash', 'sh', 'zsh', 'dash', 'ksh']);

/** A git push is present but cannot be analysed (fail closed). */
class ParseError extends Error {}

const BLOCK = {
  protectedBranch:
    'Blocked: git push to main or master is not allowed. Push a feature branch and open a pull request instead.',
  force:
    'Blocked: force push (--force, -f, --force-with-lease, or a +refspec) is not allowed.',
  allOrMirror:
    'Blocked: git push --all/--mirror can update main or master and is not allowed.',
};

function readStdin() {
  try {
    return readFileSync(0, 'utf8');
  } catch {
    return '';
  }
}

/** Parse the hook input; null when it is empty, invalid, or not a Bash call. */
function parseHookInput(raw) {
  if (!raw.trim()) return null;
  try {
    const data = JSON.parse(raw);
    if (!data || typeof data !== 'object') return null;
    if (data.tool_name && data.tool_name !== 'Bash') return null;
    return {
      command: String(data?.tool_input?.command ?? ''),
      cwd: typeof data.cwd === 'string' && data.cwd ? data.cwd : process.cwd(),
    };
  } catch {
    return null;
  }
}

/** Split a shell command into roughly quoted tokens. Good enough for hook policy. */
function tokenize(segment) {
  const tokens = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < segment.length; i += 1) {
    const ch = segment[i];
    if (quote) {
      if (ch === '\\' && quote === '"' && i + 1 < segment.length) {
        current += segment[i + 1];
        i += 1;
        continue;
      }
      if (ch === quote) {
        quote = null;
        continue;
      }
      current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      continue;
    }
    if (/\s/.test(ch)) {
      if (current) tokens.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current) tokens.push(current);
  return tokens;
}

/** Split a compound command into segments at top-level separators. */
function segments(command) {
  const parts = [];
  let current = '';
  let quote = null;
  for (let i = 0; i < command.length; i += 1) {
    const ch = command[i];
    const next = command[i + 1];
    if (quote) {
      if (ch === '\\' && quote === '"' && next) {
        current += ch + next;
        i += 1;
        continue;
      }
      if (ch === quote) quote = null;
      current += ch;
      continue;
    }
    if (ch === "'" || ch === '"') {
      quote = ch;
      current += ch;
      continue;
    }
    if (ch === '&' && next === '&') {
      parts.push(current);
      current = '';
      i += 1;
      continue;
    }
    if (ch === '|' && next === '|') {
      parts.push(current);
      current = '';
      i += 1;
      continue;
    }
    if (ch === ';' || ch === '\n' || ch === '|') {
      parts.push(current);
      current = '';
      continue;
    }
    current += ch;
  }
  if (current.trim()) parts.push(current);
  if (quote && /^\s*(?:\w+=\S*\s+)*git\b/.test(current)) {
    throw new ParseError('unterminated quote in a git command');
  }
  return parts.map((p) => p.trim()).filter(Boolean);
}

/** Parse `git [-C dir] [-c k=v] push ...`; returns { argv, dir } or null if not a push. */
function parseGitPush(tokens, baseDir) {
  let i = 0;
  while (i < tokens.length && /^\w+=/.test(tokens[i])) i += 1; // env assignments
  if (tokens[i] === 'git-push') return { argv: tokens.slice(i + 1), dir: baseDir };
  if (tokens[i] !== 'git') return null;
  i += 1;
  let dir = baseDir;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '-C') {
      if (i + 1 >= tokens.length) throw new ParseError('git -C without a directory');
      dir = path.resolve(dir, tokens[i + 1]);
      i += 2;
      continue;
    }
    if (t === '-c') {
      i += 2;
      continue;
    }
    if (t === 'push') return { argv: tokens.slice(i + 1), dir };
    // Other git subcommands are not a push.
    if (!t.startsWith('-')) return null;
    i += 1;
  }
  return null;
}

function isLongOption(arg) {
  return arg.startsWith('--');
}

function isForceFlag(arg) {
  if (arg === '--force' || arg.startsWith('--force-with-lease')) return true;
  if (isLongOption(arg)) return false;
  // Short cluster such as -f, -uf, -fu. Not --fast or -C.
  return /^-[a-zA-Z]*f[a-zA-Z]*$/.test(arg);
}

function destName(refspec) {
  const spec = refspec.replace(/^\+/, '');
  const colon = spec.lastIndexOf(':');
  const dest = colon === -1 ? spec : spec.slice(colon + 1);
  return dest.replace(/^refs\/heads\//, '');
}

function currentBranch(dir) {
  try {
    return execFileSync('git', ['-C', dir, 'symbolic-ref', '--short', '-q', 'HEAD'], {
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

/** Returns a block reason or null. Throws ParseError when a push cannot be analysed. */
function analyze(command, cwd, depth = 0) {
  if (depth > 5) throw new ParseError('shell wrappers nested too deeply');
  let dir = cwd;
  for (const segment of segments(command)) {
    const tokens = tokenize(segment);
    if (tokens[0] === 'cd' && tokens.length >= 2) {
      const target = tokens[1] === '--' ? tokens[2] : tokens[1];
      if (target) dir = path.resolve(dir, target);
      continue;
    }
    if (SHELLS.has(path.basename(tokens[0] ?? ''))) {
      const flag = tokens.findIndex((t, idx) => idx > 0 && /^-[a-zA-Z]*c[a-zA-Z]*$/.test(t));
      if (flag !== -1 && tokens[flag + 1] !== undefined) {
        const reason = analyze(tokens[flag + 1], dir, depth + 1);
        if (reason) return reason;
      }
      continue;
    }
    if (!/\bpush\b|git-push/.test(segment)) continue;
    const parsed = parseGitPush(tokens, dir);
    if (!parsed) continue;
    if (/[$`]/.test(segment)) {
      throw new ParseError('the push uses shell expansion ($VAR, $(...) or backticks)');
    }
    const reason = reasonToBlockPushArgs(parsed.argv, () => currentBranch(parsed.dir));
    if (reason) return reason;
  }
  return null;
}

export function reasonToBlock(command, cwd) {
  if (!command || !/\bgit\b/.test(command) || !/\bpush\b/.test(command)) return null;
  if (process.env.PUSH_GUARD_TEST_THROW === '1') throw new Error('simulated internal failure');
  return analyze(command, cwd || process.cwd());
}

/** `currentOrGetter` is the current branch name or a function resolving it lazily. */
export function reasonToBlockPushArgs(argv, currentOrGetter) {
  const current = () => {
    const value = typeof currentOrGetter === 'function' ? currentOrGetter() : currentOrGetter;
    if (!value) throw new ParseError('cannot determine the current branch for this push');
    return value;
  };
  const isProtectedName = (name) => PROTECTED.has(name === 'HEAD' || name === '' ? current() : name);

  const positionals = [];
  let endOfFlags = false;
  let allOrMirror = false;
  for (const arg of argv) {
    if (!endOfFlags && arg === '--') {
      endOfFlags = true;
      continue;
    }
    if (!endOfFlags && (arg === '--all' || arg === '--mirror')) {
      allOrMirror = true;
      continue;
    }
    if (!endOfFlags && isForceFlag(arg)) return BLOCK.force;
    if (!endOfFlags && arg.startsWith('-')) continue;
    positionals.push(arg);
  }
  // A leading + on a refspec forces the update.
  if (positionals.some((p) => p.startsWith('+'))) return BLOCK.force;
  if (allOrMirror) return BLOCK.allOrMirror;

  // git push [<repository>] [<refspec>...]
  let specs = positionals.slice(1);
  // When the only positional looks like a refspec (contains : or is a protected name
  // with no remote), treat it as a refspec. `git push main` is unusual but aims at main.
  if (positionals.length === 1) {
    const only = positionals[0];
    if (only.includes(':') || PROTECTED.has(destName(only)) || only === 'HEAD') {
      specs = [only];
    }
  }

  if (specs.length === 0) {
    // Plain `git push` or `git push origin` follows the current branch / its upstream.
    if (PROTECTED.has(current())) return BLOCK.protectedBranch;
    return null;
  }
  for (const spec of specs) {
    if (isProtectedName(destName(spec))) return BLOCK.protectedBranch;
  }
  return null;
}

function main() {
  const input = parseHookInput(readStdin());
  if (!input) process.exit(0); // fail open: nothing to analyse
  let reason;
  try {
    reason = reasonToBlock(input.command, input.cwd);
  } catch (err) {
    // Fail closed: a git push is present but could not be analysed.
    const why =
      err instanceof ParseError
        ? `Blocked: cannot analyse this git push (${err.message}). Run a simpler, explicit command.`
        : `Blocked: push-guard internal error while analysing a git push (${err?.message ?? err}).`;
    process.stderr.write(`${why}\n`);
    process.exit(2);
  }
  if (reason) {
    process.stderr.write(`${reason}\n`);
    process.exit(2);
  }
  process.exit(0);
}

const isDirectRun = Boolean(process.argv[1] && process.argv[1].endsWith('push-guard.mjs'));
if (isDirectRun && process.env.PUSH_GUARD_AS_LIB !== '1') {
  main();
}

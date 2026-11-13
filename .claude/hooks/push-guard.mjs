#!/usr/bin/env node
/**
 * PreToolUse hook for Bash: block git push to main/master and any force push.
 *
 * Official hooks reference (https://code.claude.com/docs/en/hooks):
 * exit 2 + a reason on stderr blocks the tool call; exit 0 leaves the
 * normal permission flow in place.
 */
import { execFileSync } from 'node:child_process';
import { readFileSync } from 'node:fs';

const PROTECTED = new Set(['main', 'master']);

const BLOCK = {
  protectedBranch:
    'Blocked: git push to main or master is not allowed. Push a feature branch and open a pull request instead.',
  force:
    'Blocked: force push (--force, -f, or --force-with-lease) is not allowed.',
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

function commandFromHookInput(raw) {
  if (!raw.trim()) return '';
  try {
    const data = JSON.parse(raw);
    return String(data?.tool_input?.command ?? '');
  } catch {
    return '';
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
    if (ch === '`' || (ch === '$' && next === '(')) {
      // Keep going; we still want to see git push inside $() or backticks.
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
  return parts.map((p) => p.trim()).filter(Boolean);
}

function skipGitPrefix(tokens) {
  // git [-C dir] [-c key=val ...] push ...
  let i = 0;
  if (tokens[i] !== 'git' && tokens[i] !== 'git-push') return null;
  if (tokens[i] === 'git-push') return tokens.slice(1);
  i += 1;
  while (i < tokens.length) {
    const t = tokens[i];
    if (t === '-C' || t === '-c' || t.startsWith('-c')) {
      if (t === '-C' || t === '-c') i += 2;
      else i += 1;
      continue;
    }
    if (t === 'push') return tokens.slice(i + 1);
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
  let spec = refspec.replace(/^\+/, '');
  const colon = spec.lastIndexOf(':');
  const dest = colon === -1 ? spec : spec.slice(colon + 1);
  return dest.replace(/^refs\/heads\//, '');
}

function isProtectedName(name, currentBranch) {
  const resolved = name === 'HEAD' || name === '' ? currentBranch : name;
  return PROTECTED.has(resolved);
}

function currentBranch(cwd) {
  try {
    return execFileSync('git', ['rev-parse', '--abbrev-ref', 'HEAD'], {
      cwd: cwd || process.cwd(),
      encoding: 'utf8',
      stdio: ['ignore', 'pipe', 'ignore'],
    }).trim();
  } catch {
    return '';
  }
}

export function reasonToBlock(command, cwd) {
  if (!command || !/\bgit(?:-|\s+)push\b/.test(command)) return null;
  const branch = currentBranch(cwd);
  for (const segment of segments(command)) {
    if (!/\bgit(?:-|\s+)push\b/.test(segment)) continue;
    const argv = skipGitPrefix(tokenize(segment));
    if (!argv) continue;
    const reason = reasonToBlockPushArgs(argv, branch);
    if (reason) return reason;
  }
  return null;
}

export function reasonToBlockPushArgs(argv, current) {
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
  if (allOrMirror) return BLOCK.allOrMirror;

  // git push [<repository>] [<refspec>...]
  const refspecs = positionals.length <= 1 ? positionals.slice(1) : positionals.slice(1);
  // When the only positional looks like a refspec (contains : or is a protected name
  // with no remote), treat it as a refspec. `git push main` is unusual but aims at main.
  let specs = refspecs;
  if (positionals.length === 1) {
    const only = positionals[0];
    if (only.includes(':') || PROTECTED.has(destName(only)) || only === 'HEAD') {
      specs = [only];
    }
  }

  if (specs.length === 0) {
    // Plain `git push` or `git push origin` follows the current branch / its upstream.
    if (PROTECTED.has(current)) return BLOCK.protectedBranch;
    return null;
  }
  for (const spec of specs) {
    if (isProtectedName(destName(spec), current)) return BLOCK.protectedBranch;
  }
  return null;
}

function main() {
  const raw = readStdin();
  const command = commandFromHookInput(raw);
  let cwd = process.cwd();
  try {
    cwd = JSON.parse(raw)?.cwd || cwd;
  } catch {
    // ignore
  }
  const reason = reasonToBlock(command, cwd);
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

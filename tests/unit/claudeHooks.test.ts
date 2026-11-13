import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
// HOOKS_DIR lets reviewers run the suite against staged copies; the default is the real location.
const hooksDir = process.env.HOOKS_DIR ? path.resolve(root, process.env.HOOKS_DIR) : path.join(root, '.claude/hooks');
const guard = path.join(hooksDir, 'push-guard.mjs');
const stopHook = path.join(hooksDir, 'check-changed-ts.sh');

function tmp(prefix: string): string {
  return fs.realpathSync(fs.mkdtempSync(path.join(os.tmpdir(), prefix)));
}

function git(dir: string, ...args: string[]) {
  return execFileSync('git', args, { cwd: dir, encoding: 'utf8' });
}

function initRepo(branch: string): string {
  const dir = tmp('hooks-repo-');
  git(dir, 'init', '-q', '-b', branch);
  git(dir, 'config', 'user.email', 'hook@test.local');
  git(dir, 'config', 'user.name', 'Hook Test');
  fs.writeFileSync(path.join(dir, 'README'), 'x\n');
  git(dir, 'add', 'README');
  git(dir, 'commit', '-q', '-m', 'init');
  return dir;
}

function guardRaw(stdin: string, cwd: string = root, env: Record<string, string> = {}) {
  return spawnSync(process.execPath, [guard], {
    input: stdin,
    encoding: 'utf8',
    cwd,
    env: { ...process.env, ...env },
  });
}

function guardCmd(command: string, hookCwd: string, env: Record<string, string> = {}) {
  return guardRaw(
    JSON.stringify({ hook_event_name: 'PreToolUse', tool_name: 'Bash', tool_input: { command }, cwd: hookCwd }),
    root,
    env,
  );
}

describe('push guard: + refspec force pushes (a)', () => {
  const dir = initRepo('feat/x');
  it.each([
    'git push origin +feat/x',
    'git push origin +HEAD:feat/x',
    'git push origin +main',
    'git push origin +feat/x:feat/x',
    'git push +feat/x',
  ])('blocks %s as force', (cmd) => {
    const r = guardCmd(cmd, dir);
    expect(r.status, r.stderr).toBe(2);
    expect(r.stderr).toMatch(/force/i);
  });
  it('still allows plain refspecs and names containing +-free text', () => {
    expect(guardCmd('git push origin feat/x', dir).status).toBe(0);
    expect(guardCmd('git commit -m "use +feat/x"', dir).status).toBe(0);
  });
});

describe('push guard: branch from git -C and cd (d)', () => {
  const main = initRepo('main');
  const feat = initRepo('feat/x');
  it('git -C <main-repo> push is blocked from a feature cwd', () => {
    expect(guardCmd(`git -C ${main} push`, feat).status).toBe(2);
  });
  it('cd <main-repo> && git push is blocked from a feature cwd', () => {
    expect(guardCmd(`cd ${main} && git push`, feat).status).toBe(2);
    expect(guardCmd(`cd ${main}; git push origin`, feat).status).toBe(2);
  });
  it('cd <feat-repo> && git push is allowed from a main cwd', () => {
    expect(guardCmd(`cd ${feat} && git push`, main).status).toBe(0);
    expect(guardCmd(`git -C ${feat} push`, main).status).toBe(0);
  });
  it('resolves relative -C and cd against the hook cwd', () => {
    const parent = tmp('hooks-parent-');
    const sub = path.join(parent, 'wt');
    fs.mkdirSync(sub);
    git(sub, 'init', '-q', '-b', 'main');
    git(sub, 'config', 'user.email', 'a@b.c');
    git(sub, 'config', 'user.name', 'n');
    fs.writeFileSync(path.join(sub, 'f'), 'x');
    git(sub, 'add', 'f');
    git(sub, 'commit', '-q', '-m', 'i');
    expect(guardCmd('cd wt && git push', parent).status).toBe(2);
    expect(guardCmd('git -C wt push', parent).status).toBe(2);
  });
});

describe('push guard: bash -c / sh -c wrappers (e)', () => {
  const dir = initRepo('feat/x');
  it.each([
    `bash -c "git push origin main"`,
    `sh -c 'git push --force origin feat/x'`,
    `bash -lc "git push origin HEAD:main"`,
    `sh -c "bash -c 'git push origin main'"`,
    `bash -c "npm test && git push origin +feat/x"`,
  ])('blocks %s', (cmd) => {
    expect(guardCmd(cmd, dir).status, cmd).toBe(2);
  });
  it('allows a wrapped safe push and wrapped non-push', () => {
    expect(guardCmd(`bash -c "git push origin feat/x"`, dir).status).toBe(0);
    expect(guardCmd(`sh -c 'echo hello'`, dir).status).toBe(0);
  });
});

describe('push guard: fail-open vs fail-closed (f)', () => {
  const dir = initRepo('feat/x');
  it('fails open for empty stdin, invalid JSON and non-Bash tools', () => {
    expect(guardRaw('').status).toBe(0);
    expect(guardRaw('not json{').status).toBe(0);
    const other = JSON.stringify({ tool_name: 'Read', tool_input: { command: 'git push origin main' }, cwd: dir });
    expect(guardRaw(other).status).toBe(0);
  });
  it('fails closed for a push it cannot parse (unterminated quote, shell expansion)', () => {
    for (const cmd of ['git push origin "main', 'git push origin $BRANCH', 'git push origin $(echo main)', 'git push origin `echo main`']) {
      const r = guardCmd(cmd, dir);
      expect(r.status, cmd).toBe(2);
      expect(r.stderr, cmd).toMatch(/cannot|could not|unable/i);
    }
  });
  it('fails closed for a bare push when the branch cannot be determined', () => {
    const notRepo = tmp('hooks-norepo-');
    const r = guardCmd('git push', notRepo);
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/branch/i);
  });
  it('fails closed on an internal error while analysing a push', () => {
    const r = guardCmd('git push origin feat/x', dir, { PUSH_GUARD_TEST_THROW: '1' });
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/internal error/i);
  });
  it('does not fail on an internal error when the command is not a push', () => {
    expect(guardCmd('echo hi', dir, { PUSH_GUARD_TEST_THROW: '1' }).status).toBe(0);
  });
  it('documents the policy in the header and CLAUDE.md', () => {
    expect(fs.readFileSync(guard, 'utf8')).toMatch(/fail(s)? closed/i);
    expect(fs.readFileSync(stopHook, 'utf8')).toMatch(/fail(s)? open/i);
    const doc = fs.readFileSync(path.join(root, 'CLAUDE.md'), 'utf8');
    expect(doc).toMatch(/fails? closed/i);
    expect(doc).toMatch(/fails? open/i);
  });
});

describe('Stop hook: check-changed-ts.sh', () => {
  /** Repo with fake local tsc/vitest that log their invocations. */
  function stopRepo(tscExit = 0) {
    const dir = initRepo('feat/x');
    fs.mkdirSync(path.join(dir, 'src'));
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a = 1;\n');
    fs.writeFileSync(path.join(dir, 'src/gone.ts'), 'export const g = 1;\n');
    fs.writeFileSync(path.join(dir, '.gitignore'), 'node_modules\nlog.txt\n');
    git(dir, 'add', '.');
    git(dir, 'commit', '-q', '-m', 'ts');
    const bin = path.join(dir, 'node_modules/.bin');
    fs.mkdirSync(bin, { recursive: true });
    const log = path.join(dir, 'log.txt');
    fs.writeFileSync(path.join(bin, 'tsc'), `#!/bin/sh\necho "tsc $*" >> "${log}"\nexit ${tscExit}\n`, { mode: 0o755 });
    fs.writeFileSync(path.join(bin, 'vitest'), `#!/bin/sh\necho "vitest $*" >> "${log}"\nexit 0\n`, { mode: 0o755 });
    return { dir, log: () => (fs.existsSync(log) ? fs.readFileSync(log, 'utf8') : '') };
  }
  function runStop(input: string | undefined, opts: { cwd?: string; env?: Record<string, string> } = {}) {
    return spawnSync('sh', [stopHook], {
      input: input ?? '',
      encoding: 'utf8',
      cwd: opts.cwd ?? root,
      env: { ...process.env, CLAUDE_PROJECT_DIR: '', ...opts.env },
      timeout: 20000,
    });
  }
  const stopInput = (cwd: string, extra: object = {}) => JSON.stringify({ hook_event_name: 'Stop', cwd, ...extra });

  it('(b) checks new untracked TS files', () => {
    const { dir, log } = stopRepo();
    fs.writeFileSync(path.join(dir, 'src/new.ts'), 'export const n: number = "x";\n');
    const r = runStop(stopInput(dir));
    expect(r.status, r.stderr).toBe(0);
    expect(log()).toMatch(/tsc --noEmit/);
    expect(log()).toMatch(/vitest related --run .*src\/new\.ts/);
  });

  it('(b) reports tsc failure for an untracked file with exit 2', () => {
    const { dir } = stopRepo(1);
    fs.writeFileSync(path.join(dir, 'src/new.ts'), 'export const n = 1;\n');
    const r = runStop(stopInput(dir));
    expect(r.status).toBe(2);
    expect(r.stderr).toMatch(/src\/new\.ts/);
  });

  it('(b) does not pass deleted paths to vitest related', () => {
    const { dir, log } = stopRepo();
    fs.rmSync(path.join(dir, 'src/gone.ts'));
    fs.writeFileSync(path.join(dir, 'src/a.ts'), 'export const a = 2;\n');
    const r = runStop(stopInput(dir));
    expect(r.status, r.stderr).toBe(0);
    expect(log()).toMatch(/vitest related --run .*src\/a\.ts/);
    expect(log()).not.toMatch(/gone\.ts/);
  });

  it('(b) skips vitest but still runs tsc when only deletions changed', () => {
    const { dir, log } = stopRepo();
    fs.rmSync(path.join(dir, 'src/gone.ts'));
    const r = runStop(stopInput(dir));
    expect(r.status, r.stderr).toBe(0);
    expect(log()).toMatch(/tsc --noEmit/);
    expect(log()).not.toMatch(/vitest/);
  });

  it('(c) exits 0 immediately when stop_hook_active is true', () => {
    const { dir, log } = stopRepo(1);
    fs.writeFileSync(path.join(dir, 'src/new.ts'), 'export const n = 1;\n');
    const r = runStop(stopInput(dir, { stop_hook_active: true }));
    expect(r.status).toBe(0);
    expect(log()).toBe('');
  });

  it('(c) does not hang or fail with empty or closed stdin', () => {
    const t0 = Date.now();
    const nonGit = tmp('hooks-empty-');
    const r = spawnSync('sh', [stopHook], { stdio: ['ignore', 'pipe', 'pipe'], encoding: 'utf8', cwd: nonGit, timeout: 20000, env: { ...process.env, CLAUDE_PROJECT_DIR: nonGit } });
    expect(r.status).toBe(0);
    expect(Date.now() - t0).toBeLessThan(15000);
    expect(runStop('', { env: { CLAUDE_PROJECT_DIR: nonGit } }).status).toBe(0);
  });

  it('(g) runs in the repo of the input cwd, not CLAUDE_PROJECT_DIR', () => {
    const target = stopRepo();
    const other = stopRepo();
    fs.writeFileSync(path.join(target.dir, 'src/new.ts'), 'export const n = 1;\n');
    const r = runStop(stopInput(path.join(target.dir, 'src')), { env: { CLAUDE_PROJECT_DIR: other.dir } });
    expect(r.status, r.stderr).toBe(0);
    expect(target.log()).toMatch(/tsc/);
    expect(other.log()).toBe('');
  });

  it('(g) falls back to CLAUDE_PROJECT_DIR when the input has no cwd', () => {
    const proj = stopRepo();
    fs.writeFileSync(path.join(proj.dir, 'src/new.ts'), 'export const n = 1;\n');
    const r = runStop('{}', { cwd: tmp('hooks-elsewhere-'), env: { CLAUDE_PROJECT_DIR: proj.dir } });
    expect(r.status, r.stderr).toBe(0);
    expect(proj.log()).toMatch(/tsc/);
  });

  it('(f) fails open on its own internal errors', () => {
    const { dir } = stopRepo();
    fs.writeFileSync(path.join(dir, 'src/new.ts'), 'export const n = 1;\n');
    const r = runStop(stopInput(dir), { env: { TMPDIR: '/nonexistent-dir-for-hook-test' } });
    expect(r.status, r.stderr).toBe(0);
    expect(runStop(stopInput(tmp('hooks-nogit-'))).status).toBe(0);
  });
});

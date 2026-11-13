import { execFileSync, spawnSync } from 'node:child_process';
import fs from 'node:fs';
import os from 'node:os';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

const root = path.resolve(__dirname, '../..');
const guard = path.join(root, '.claude/hooks/push-guard.mjs');

function hookInput(command: string, cwd?: string): string {
  return JSON.stringify({
    hook_event_name: 'PreToolUse',
    tool_name: 'Bash',
    tool_input: { command },
    cwd: cwd ?? root,
  });
}

function runGuard(command: string, cwd?: string) {
  return spawnSync(process.execPath, [guard], {
    input: hookInput(command, cwd),
    encoding: 'utf8',
    cwd: cwd ?? root,
  });
}

function initRepo(branch: string): string {
  const dir = fs.mkdtempSync(path.join(os.tmpdir(), 'push-guard-'));
  execFileSync('git', ['init', '-q', '-b', branch], { cwd: dir });
  execFileSync('git', ['config', 'user.email', 'hook@test.local'], { cwd: dir });
  execFileSync('git', ['config', 'user.name', 'Hook Test'], { cwd: dir });
  fs.writeFileSync(path.join(dir, 'README'), 'x\n');
  execFileSync('git', ['add', 'README'], { cwd: dir });
  execFileSync('git', ['commit', '-q', '-m', 'init'], { cwd: dir });
  return dir;
}

describe('Claude Code push guard hook', () => {
  it('exits 0 for a normal push of a feature branch', () => {
    const dir = initRepo('feat/topic');
    const result = runGuard('git push origin feat/topic', dir);
    expect(result.status, result.stderr).toBe(0);
    expect(result.stderr).toBe('');
  });

  it('exits 2 for an explicit HEAD:main refspec', () => {
    const dir = initRepo('feat/topic');
    const result = runGuard('git push origin HEAD:main', dir);
    expect(result.status).toBe(2);
    expect(result.stderr).toMatch(/main or master/i);
  });

  it('exits 2 for HEAD:master and a dest of refs/heads/main', () => {
    const dir = initRepo('feat/topic');
    expect(runGuard('git push origin HEAD:master', dir).status).toBe(2);
    expect(runGuard('git push origin feat/topic:refs/heads/main', dir).status).toBe(2);
    expect(runGuard('git push origin +HEAD:main', dir).status).toBe(2);
  });

  it('exits 2 for git push origin main or master', () => {
    const dir = initRepo('feat/topic');
    expect(runGuard('git push origin main', dir).status).toBe(2);
    expect(runGuard('git push origin master', dir).status).toBe(2);
  });

  it('exits 2 for a plain push while the current branch is main or master', () => {
    const onMain = initRepo('main');
    const plain = runGuard('git push origin', onMain);
    expect(plain.status, plain.stderr).toBe(2);
    expect(plain.stderr).toMatch(/main or master/i);
    expect(runGuard('git push', initRepo('master')).status).toBe(2);
    expect(runGuard('git push origin HEAD', onMain).status).toBe(2);
  });

  it('allows a plain push while the current branch is not main or master', () => {
    const dir = initRepo('feat/topic');
    expect(runGuard('git push origin', dir).status).toBe(0);
    expect(runGuard('git push origin HEAD', dir).status).toBe(0);
  });

  it('exits 2 for --force, -f, and --force-with-lease even on a feature branch', () => {
    const dir = initRepo('feat/topic');
    expect(runGuard('git push --force origin feat/topic', dir).status).toBe(2);
    expect(runGuard('git push -f origin feat/topic', dir).status).toBe(2);
    expect(runGuard('git push -uf origin feat/topic', dir).status).toBe(2);
    expect(runGuard('git push --force-with-lease origin feat/topic', dir).status).toBe(2);
    expect(runGuard('git push --force-with-lease=refs/heads/feat/topic origin feat/topic', dir).status).toBe(2);
    expect(runGuard('git push --force origin feat/topic', dir).stderr).toMatch(/force/i);
  });

  it('does not treat a branch name that merely contains "force" or "main" as forbidden', () => {
    const dir = initRepo('feat/topic');
    expect(runGuard('git push origin feat/force-retry', dir).status).toBe(0);
    expect(runGuard('git push origin feature-mainline', dir).status).toBe(0);
  });

  it('blocks a protected refspec hidden in a compound command', () => {
    const dir = initRepo('feat/topic');
    const result = runGuard('npm test && git push origin HEAD:main', dir);
    expect(result.status).toBe(2);
  });

  it('allows non-push git commands, including ones that use -f or mention main', () => {
    const dir = initRepo('main');
    expect(runGuard('git commit -m "work on main"', dir).status).toBe(0);
    expect(runGuard('git fetch origin main', dir).status).toBe(0);
    expect(runGuard('git log --follow README', dir).status).toBe(0);
  });

  it('blocks git push --all and --mirror', () => {
    const dir = initRepo('feat/topic');
    expect(runGuard('git push --all origin', dir).status).toBe(2);
    expect(runGuard('git push --mirror origin', dir).status).toBe(2);
  });
});

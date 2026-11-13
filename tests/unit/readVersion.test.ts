import { afterEach, beforeEach, describe, it, expect } from 'vitest';
import { mkdtempSync, rmSync, writeFileSync } from 'node:fs';
import { tmpdir } from 'node:os';
import path from 'node:path';
import pkg from '../../package.json';
import { readVersion } from '../../build/buildDefines';

describe('readVersion', () => {
  let dir: string;

  beforeEach(() => {
    dir = mkdtempSync(path.join(tmpdir(), 'readVersion-'));
  });

  afterEach(() => {
    rmSync(dir, { recursive: true, force: true });
  });

  const write = (content: string): string => {
    const file = path.join(dir, 'package.json');
    writeFileSync(file, content, 'utf8');
    return file;
  };

  it('returns 0.0.0 when the file is missing', () => {
    expect(readVersion(path.join(dir, 'nope.json'))).toBe('0.0.0');
  });

  it('returns 0.0.0 when the path is unreadable (a directory)', () => {
    expect(readVersion(dir)).toBe('0.0.0');
  });

  it('returns 0.0.0 for invalid JSON', () => {
    expect(readVersion(write('{ not json'))).toBe('0.0.0');
  });

  it('returns 0.0.0 when version is missing', () => {
    expect(readVersion(write('{"name":"x"}'))).toBe('0.0.0');
  });

  it('returns 0.0.0 when version is empty', () => {
    expect(readVersion(write('{"version":""}'))).toBe('0.0.0');
  });

  it('returns 0.0.0 when version is not a string', () => {
    expect(readVersion(write('{"version":1}'))).toBe('0.0.0');
    expect(readVersion(write('{"version":null}'))).toBe('0.0.0');
  });

  it('returns 0.0.0 when the JSON root is not an object', () => {
    expect(readVersion(write('null'))).toBe('0.0.0');
    expect(readVersion(write('[]'))).toBe('0.0.0');
  });

  it('returns the version from a valid file', () => {
    expect(readVersion(write('{"version":"1.2.3"}'))).toBe('1.2.3');
  });

  it('returns the real package.json version by default', () => {
    expect(readVersion()).toBe(pkg.version);
  });
});

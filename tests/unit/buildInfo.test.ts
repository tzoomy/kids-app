import { describe, it, expect } from 'vitest';
import pkg from '../../package.json';
import { APP_VERSION, GIT_SHA, BUILD_DATE, formatBuildInfo } from '../../src/buildInfo';

describe('buildInfo', () => {
  it('version matches package.json', () => {
    expect(APP_VERSION).toBe(pkg.version);
  });

  it('sha is "unknown" or a short hex sha', () => {
    expect(GIT_SHA).toMatch(/^(unknown|[0-9a-f]{7,12})$/);
  });

  it('build date is YYYY-MM-DD HH:mm', () => {
    expect(BUILD_DATE).toMatch(/^\d{4}-\d{2}-\d{2} \d{2}:\d{2}$/);
  });

  it('formatBuildInfo joins version, sha and date', () => {
    expect(formatBuildInfo()).toBe(`v${APP_VERSION} · ${GIT_SHA} · ${BUILD_DATE}`);
  });
});

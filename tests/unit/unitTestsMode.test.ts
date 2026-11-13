import { describe, expect, it } from 'vitest';
import { unitTestsMode } from '../../scripts/unit-tests-mode.mjs';

const SHA = '1a2b3c4d5e6f1a2b3c4d5e6f1a2b3c4d5e6f1a2b';

describe('related unit tests: mode decision', () => {
  it('a usable base that exists runs only the related tests', () => {
    expect(unitTestsMode(SHA, { commitExists: () => true })).toEqual({ mode: 'changed', warning: null });
  });

  it.each([
    ['empty', ''],
    ['undefined', undefined],
    ['whitespace', '  '],
    ['all zeros', '0000000000000000000000000000000000000000'],
  ])('a %s base runs the FULL suite with a warning and never probes git', (_n, base) => {
    const r = unitTestsMode(base as string | undefined, {
      commitExists: () => {
        throw new Error('must not probe git for an unusable base');
      },
    });
    expect(r.mode).toBe('full');
    expect(r.warning).toMatch(/^::warning::/);
    expect(r.warning).toMatch(/full unit suite/i);
  });

  it('an unfetchable base (commit missing) runs the FULL suite with a warning', () => {
    const r = unitTestsMode(SHA, { commitExists: () => false });
    expect(r.mode).toBe('full');
    expect(r.warning).toMatch(/^::warning::/);
  });

  it('a throwing commit probe is treated as unfetchable (full suite)', () => {
    const r = unitTestsMode(SHA, {
      commitExists: () => {
        throw new Error('git missing');
      },
    });
    expect(r.mode).toBe('full');
  });
});

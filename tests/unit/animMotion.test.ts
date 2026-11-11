import { describe, it, expect, afterEach, vi } from 'vitest';
import { amp, ampScale, ampCount, isReducedMotion, motionFactor, setMotionFactor } from '../../src/anim/motion';
import { ANIM_PROFILE } from '../../src/anim/profiles';
import { arcPoint } from '../../src/anim/arc';

afterEach(() => setMotionFactor(null));

describe('reduced-motion scaling', () => {
  it('is full motion by default', () => {
    setMotionFactor(null);
    expect(motionFactor()).toBe(1);
    expect(amp(20)).toBe(20);
    expect(ampScale(1.2)).toBeCloseTo(1.2);
    expect(isReducedMotion()).toBe(false);
  });

  it('scales amplitudes, scale deltas and particle counts', () => {
    setMotionFactor(ANIM_PROFILE.reducedMotionFactor);
    const f = ANIM_PROFILE.reducedMotionFactor;
    expect(isReducedMotion()).toBe(true);
    expect(amp(20)).toBeCloseTo(20 * f);
    expect(ampScale(1.2)).toBeCloseTo(1 + 0.2 * f);
    expect(ampScale(0.8)).toBeCloseTo(1 - 0.2 * f);
    expect(ampCount(10)).toBe(Math.round(10 * f));
    expect(ampCount(1)).toBe(1);
    expect(ampCount(0)).toBe(0);
  });

  it('clamps the factor to [0, 1]', () => {
    setMotionFactor(3);
    expect(motionFactor()).toBe(1);
    setMotionFactor(-1);
    expect(motionFactor()).toBe(0);
    expect(ampCount(5)).toBe(1);
  });

  it('follows prefers-reduced-motion when initialised', async () => {
    const original = window.matchMedia;
    window.matchMedia = ((q: string) => ({
      matches: q.includes('reduce'),
      media: q,
      addEventListener: () => undefined,
      removeEventListener: () => undefined,
    })) as unknown as typeof window.matchMedia;
    vi.resetModules();
    const mod = await import('../../src/anim/motion');
    mod.initMotionPreference();
    expect(mod.motionFactor()).toBe(ANIM_PROFILE.reducedMotionFactor);
    window.matchMedia = original;
  });
});

describe('arcPoint', () => {
  it('starts and ends at the endpoints and rises above both in between', () => {
    const out = { x: 0, y: 0 };
    arcPoint(0, 100, 500, 600, 300, 150, out);
    expect(out).toEqual({ x: 100, y: 500 });
    arcPoint(1, 100, 500, 600, 300, 150, out);
    expect(out.x).toBeCloseTo(600);
    expect(out.y).toBeCloseTo(300);
    arcPoint(0.5, 100, 500, 600, 300, 150, out);
    expect(out.x).toBeCloseTo(350);
    expect(out.y).toBeLessThan(300);
  });

  it('writes into the provided object (no allocation)', () => {
    const out = { x: 0, y: 0 };
    expect(arcPoint(0.3, 0, 0, 10, 10, 5, out)).toBe(out);
  });
});

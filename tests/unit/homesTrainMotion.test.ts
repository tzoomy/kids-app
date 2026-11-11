import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE } from '../../src/anim/profiles';

describe('homes and train animation knobs', () => {
  it('keeps walk-home and settle-in gentle and kid-friendly', () => {
    expect(ANIM_PROFILE.homes.walk.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.homes.walk.duration).toBeLessThanOrEqual(1200);
    expect(ANIM_PROFILE.homes.walk.bob).toBeGreaterThan(0);
    expect(ANIM_PROFILE.homes.walk.bob).toBeLessThanOrEqual(20);
    expect(ANIM_PROFILE.homes.settle.duration).toBeLessThanOrEqual(800);
    expect(ANIM_PROFILE.homes.settle.scale).toBeGreaterThan(0.7);
    expect(ANIM_PROFILE.homes.settle.scale).toBeLessThan(1);
  });

  it('keeps chug, arrive, and hand-out motions short', () => {
    expect(ANIM_PROFILE.train.chug.bob).toBeGreaterThan(0);
    expect(ANIM_PROFILE.train.chug.bob).toBeLessThanOrEqual(16);
    expect(ANIM_PROFILE.train.chug.duration).toBeLessThanOrEqual(400);
    expect(ANIM_PROFILE.train.arrive.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.train.arrive.duration).toBeLessThanOrEqual(1200);
    expect(ANIM_PROFILE.train.handOut.duration).toBeLessThanOrEqual(800);
    expect(ANIM_PROFILE.train.handOut.arcHeight).toBeGreaterThan(40);
    expect(ANIM_PROFILE.train.handOut.endScale).toBeGreaterThan(0.5);
    expect(ANIM_PROFILE.train.handOut.endScale).toBeLessThanOrEqual(1);
  });
});

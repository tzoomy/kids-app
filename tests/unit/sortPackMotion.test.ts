import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE } from '../../src/anim/profiles';

describe('sorting and suitcase animation knobs', () => {
  it('keeps drop and settle motions short and gentle', () => {
    expect(ANIM_PROFILE.sorting.drop.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.sorting.drop.duration).toBeLessThanOrEqual(800);
    expect(ANIM_PROFILE.sorting.drop.arcHeight).toBeGreaterThan(40);
    expect(ANIM_PROFILE.sorting.drop.endScale).toBeGreaterThan(0.7);
    expect(ANIM_PROFILE.sorting.drop.endScale).toBeLessThanOrEqual(1);
    expect(ANIM_PROFILE.sorting.settle.duration).toBeLessThanOrEqual(500);
    expect(ANIM_PROFILE.sorting.settle.squash).toBeGreaterThan(0.7);
    expect(ANIM_PROFILE.sorting.settle.squash).toBeLessThan(1);
    expect(ANIM_PROFILE.sorting.ruleSwitch.duration).toBeLessThanOrEqual(800);
  });

  it('keeps pack and bounce motions kid-friendly', () => {
    expect(ANIM_PROFILE.suitcase.pack.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.suitcase.pack.duration).toBeLessThanOrEqual(800);
    expect(ANIM_PROFILE.suitcase.pack.arcHeight).toBeGreaterThan(40);
    expect(ANIM_PROFILE.suitcase.pack.endScale).toBeGreaterThan(0.7);
    expect(ANIM_PROFILE.suitcase.pack.endScale).toBeLessThanOrEqual(1);
    expect(ANIM_PROFILE.suitcase.bounce.height).toBeGreaterThan(0);
    expect(ANIM_PROFILE.suitcase.bounce.height).toBeLessThanOrEqual(40);
    expect(ANIM_PROFILE.suitcase.bounce.duration).toBeLessThanOrEqual(800);
  });
});

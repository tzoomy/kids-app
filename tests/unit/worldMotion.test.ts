import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE } from '../../src/anim/profiles';

describe('hiding and orchestra animation knobs', () => {
  it('keeps rustle and peek motions gentle and kid-friendly', () => {
    expect(ANIM_PROFILE.hiding.rustle.angle).toBeGreaterThan(0);
    expect(ANIM_PROFILE.hiding.rustle.angle).toBeLessThanOrEqual(12);
    expect(ANIM_PROFILE.hiding.peek.rise).toBeLessThan(ANIM_PROFILE.hiding.reveal.rise);
    expect(ANIM_PROFILE.hiding.peek.duration).toBeLessThanOrEqual(800);
    expect(ANIM_PROFILE.hiding.reveal.duration).toBeLessThanOrEqual(800);
  });

  it('defines a visible but not blinding instrument glow', () => {
    expect(ANIM_PROFILE.orchestra.glow.alpha).toBeGreaterThan(0.5);
    expect(ANIM_PROFILE.orchestra.glow.alpha).toBeLessThanOrEqual(1);
    expect(ANIM_PROFILE.orchestra.glow.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.orchestra.glowPulse.duration).toBeGreaterThan(0);
  });
});

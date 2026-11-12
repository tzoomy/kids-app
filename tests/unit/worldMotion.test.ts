import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE } from '../../src/anim/profiles';

describe('orchestra animation knobs', () => {
  it('defines a visible but not blinding instrument glow', () => {
    expect(ANIM_PROFILE.orchestra.glow.alpha).toBeGreaterThan(0.5);
    expect(ANIM_PROFILE.orchestra.glow.alpha).toBeLessThanOrEqual(1);
    expect(ANIM_PROFILE.orchestra.glow.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.orchestra.glowPulse.duration).toBeGreaterThan(0);
  });
});

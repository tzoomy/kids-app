import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE, PARTICLE_KINDS } from '../../src/anim/profiles';
import { halfDurationFor } from '../../src/anim/transitionTiming';

function walk(obj: unknown, path: string, visit: (path: string, value: unknown) => void): void {
  if (obj && typeof obj === 'object') {
    for (const [k, v] of Object.entries(obj)) walk(v, `${path}.${k}`, visit);
  } else {
    visit(path, obj);
  }
}

describe('ANIM_PROFILE sanity', () => {
  it('has only finite, non-negative numbers (gravity may be signed)', () => {
    walk(ANIM_PROFILE, 'P', (path, v) => {
      if (typeof v === 'number') {
        expect(Number.isFinite(v), path).toBe(true);
        if (!/gravityY$/.test(path)) expect(v, path).toBeGreaterThanOrEqual(0);
      }
    });
  });

  it('keeps durations in a kid-friendly range', () => {
    walk(ANIM_PROFILE, 'P', (path, v) => {
      if (typeof v === 'number' && /duration$/i.test(path)) {
        expect(v, path).toBeGreaterThan(0);
        expect(v, path).toBeLessThanOrEqual(2500);
      }
    });
  });

  it('uses Phaser-style ease names', () => {
    walk(ANIM_PROFILE, 'P', (path, v) => {
      if (/\.(ease|\w+Ease)$/.test(path)) expect(String(v), path).toMatch(/^(Linear|(Quad|Cubic|Sine|Back|Bounce|Expo|Elastic)\.ease(In|Out|InOut))$/);
    });
  });

  it('keeps squash/stretch roughly volume-preserving and blink in 2-5 s', () => {
    const { squash, stretch } = ANIM_PROFILE;
    expect(squash.scaleX * squash.scaleY).toBeGreaterThan(0.9);
    expect(squash.scaleX * squash.scaleY).toBeLessThan(1.1);
    expect(stretch.scaleX * stretch.scaleY).toBeGreaterThan(0.9);
    expect(stretch.scaleX * stretch.scaleY).toBeLessThan(1.1);
    expect(ANIM_PROFILE.character.blink.minDelay).toBe(2000);
    expect(ANIM_PROFILE.character.blink.maxDelay).toBe(5000);
  });

  it('keeps the hmm reaction gentle (small angles, not a shake)', () => {
    expect(ANIM_PROFILE.character.hmm.headAngle).toBeLessThanOrEqual(15);
    expect(ANIM_PROFILE.character.hmm.bodyAngle).toBeLessThanOrEqual(8);
    expect(ANIM_PROFILE.reducedMotionFactor).toBeGreaterThan(0);
    expect(ANIM_PROFILE.reducedMotionFactor).toBeLessThan(1);
  });

  it('caps particles and defines every particle kind', () => {
    expect(ANIM_PROFILE.particles.maxPerEmitter).toBeLessThanOrEqual(64);
    for (const kind of PARTICLE_KINDS) {
      const p = ANIM_PROFILE.particles[kind];
      expect(p.count).toBeLessThanOrEqual(ANIM_PROFILE.particles.maxPerEmitter);
      expect(p.speedMax).toBeGreaterThanOrEqual(p.speedMin);
    }
  });

  it('keeps scene transitions under 400 ms in total', () => {
    expect(halfDurationFor(ANIM_PROFILE.transition.duration) * 2).toBeLessThan(400);
    expect(halfDurationFor(5000) * 2).toBeLessThan(400);
  });
});

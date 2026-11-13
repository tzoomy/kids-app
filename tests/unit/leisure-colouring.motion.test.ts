// Pure animation and a11y contract (AC-23, AC-24).
import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE } from '../../src/anim/profiles';
import { fillPulse } from '../../src/games/colouring/colouringMotion';
import { COLOURING_ARIA_LABELS, COLOURING_DIR, SELECTED_SWATCH_INDICATOR } from '../../src/games/colouring/chrome';

describe('leisure-colouring motion and chrome', () => {
  it('[AC-24] the fill pulse is a clipped brightness/alpha flash (~280 ms), never a scale, with plain knobs and no Phaser import', () => {
    expect(ANIM_PROFILE.colouring.fill).toEqual({ durationMs: 280, flashFrom: 0.7 });
    const pulse = fillPulse(false);
    expect(pulse.durationMs).toBe(280);
    expect(pulse.flashFrom).toBe(0.7);
    expect(pulse.flashTo).toBe(1);
    expect(pulse.scale).toBe(1);
    expect(pulse.clipped).toBe(true);
    const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../src/games/colouring/colouringMotion.ts'), 'utf8') as string;
    expect(source).not.toMatch(/from ['"]phaser['"]/);
    expect(source).not.toMatch(/particle|splash|burst/i);
  });

  it('[AC-23] selected swatch has a non-colour indicator; tools have Hebrew aria-labels; chrome is RTL; reduced motion skips the pulse', () => {
    expect(SELECTED_SWATCH_INDICATOR).toBe('ring');
    expect(COLOURING_DIR).toBe('rtl');
    expect(COLOURING_ARIA_LABELS).toEqual({
      undo: 'ביטול',
      clear: 'ניקוי',
      prev: 'הדף הקודם',
      next: 'הדף הבא',
      home: 'בית',
    });
    const reduced = fillPulse(true);
    expect(reduced.durationMs).toBe(0);
    expect(reduced.flashFrom).toBe(1);
    expect(reduced.flashTo).toBe(1);
    expect(reduced.scale).toBe(1);
  });
});

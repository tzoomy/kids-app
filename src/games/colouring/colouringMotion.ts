// Pure fill-pulse keyframes for Colouring Time (no Phaser). Spec AC-23 / AC-24.
import { ANIM_PROFILE } from '../../anim/profiles';

export interface FillPulse {
  durationMs: number;
  flashFrom: number;
  flashTo: number;
  /** Must stay 1: a scale pulse would push colour past the outline. */
  scale: 1;
  /** The flash is clipped to the region path. */
  clipped: true;
}

/** Keyframes for the fill flash. Reduced motion skips the pulse and applies the colour at once. */
export function fillPulse(reducedMotion: boolean): FillPulse {
  if (reducedMotion) {
    return { durationMs: 0, flashFrom: 1, flashTo: 1, scale: 1, clipped: true };
  }
  const knobs = ANIM_PROFILE.colouring.fill;
  return {
    durationMs: knobs.durationMs,
    flashFrom: knobs.flashFrom,
    flashTo: 1,
    scale: 1,
    clipped: true,
  };
}

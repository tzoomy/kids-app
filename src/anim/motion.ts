// Global reduced-motion factor. Pure (no Phaser): reads `prefers-reduced-motion`
// when a browser is present and exposes helpers that scale amplitudes.
import { ANIM_PROFILE } from './profiles';

let factor = 1;
let overridden = false;
let mediaQuery: MediaQueryList | null = null;

function fromMedia(): number {
  return mediaQuery?.matches ? ANIM_PROFILE.reducedMotionFactor : 1;
}

/** Starts following `prefers-reduced-motion`. Safe to call more than once and without a DOM. */
export function initMotionPreference(): void {
  if (mediaQuery || typeof window === 'undefined' || typeof window.matchMedia !== 'function') return;
  mediaQuery = window.matchMedia('(prefers-reduced-motion: reduce)');
  if (!overridden) factor = fromMedia();
  const onChange = () => {
    if (!overridden) factor = fromMedia();
  };
  if (typeof mediaQuery.addEventListener === 'function') mediaQuery.addEventListener('change', onChange);
}

/** 1 for full motion, `ANIM_PROFILE.reducedMotionFactor` when reduced motion is requested. */
export function motionFactor(): number {
  return factor;
}

export function isReducedMotion(): boolean {
  return factor < 1;
}

/** Forces a factor (tests, a future parent setting). Pass `null` to follow the OS again. */
export function setMotionFactor(value: number | null): void {
  if (value === null) {
    overridden = false;
    factor = fromMedia();
    return;
  }
  overridden = true;
  factor = Math.max(0, Math.min(1, value));
}

/** Scales a displacement/angle amplitude. */
export function amp(value: number): number {
  return value * factor;
}

/** Scales a scale value around 1 (e.g. 1.14 -> 1.042 at factor 0.3). */
export function ampScale(scale: number): number {
  return 1 + (scale - 1) * factor;
}

/** Scales a particle count, keeping at least one when the input is positive. */
export function ampCount(count: number): number {
  if (count <= 0) return 0;
  return Math.max(1, Math.round(count * factor));
}

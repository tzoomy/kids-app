import type { Rect as PageRect } from '../../testing/pageRect';

/** Read-only snapshot of the active Shadow Match trial for e2e (`getShadowInfo`, ?e2e=1 only). Rectangles are page CSS px. */
export interface ShadowInfo {
  level: number;
  language: string;
  skillKey: string;
  /** The cue: 'sound' or 'name'. */
  speak: 'sound' | 'name';
  targetId: string;
  promptText: string;
  shadows: Array<{ animalId: string; hit: PageRect; silhouette: boolean }>;
  replay: PageRect;
  tries: number;
  hinted: boolean;
  correctCount: number;
  /** Taps are accepted (all silhouettes popped in, trial not yet answered). */
  ready: boolean;
  /** The trial was answered correctly; the reveal is playing (info stays readable until the next trial). */
  done: boolean;
}

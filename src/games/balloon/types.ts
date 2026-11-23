import type { Rect as PageRect } from '../../testing/pageRect';

/** Read-only snapshot of the active Balloon Pop trial for e2e (`getBalloonInfo`, ?e2e=1 only). Rectangles are page CSS px. */
export interface BalloonInfo {
  /** 'color' (age-2 levels), 'digit' (age-5 numbers 0-20), or the age-5 stretch 'more' ("k more than n") / 'sum' ("a plus b"). */
  mode: 'color' | 'digit' | 'more' | 'sum';
  level: number;
  language: string;
  skillKey: string;
  targetItemId: string;
  promptText: string;
  balloons: Array<{ itemId: string; color: string; label: string | null; hit: PageRect }>;
  /** Speaker button that replays the request. */
  replay: PageRect;
  /** Wrong taps in this trial. */
  tries: number;
  /** True once the idle auto-hint marked this trial hinted. */
  hinted: boolean;
  /** Correct pops this visit. */
  correctCount: number;
  /** True once every balloon has risen into place and taps are accepted. */
  ready: boolean;
  /** True on a floating-stage trial: the balloons drift upward, so `hit` rectangles change every frame. */
  floating: boolean;
}

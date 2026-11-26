// Game shell slide player (docs/specs/game-shell.md AC-09, AC-12): the pure model of a tap-to-advance sequence of
// pictures, each with ordered voice lines (French hero line, then Hebrew robot line). No Phaser, no audio: the view
// (slideView.ts) shows the image and plays the lines. No video and no auto-advance.
import type { WorldId } from './worlds';

export interface SlideDef {
  id: string;
  /** Manifest art id of the picture (1280x800). */
  image: string;
  /** Manifest voice line ids, in the order they play. */
  lines: readonly string[];
}

/**
 * The intro: 4 beats (Gemini's contract): 1 the egg is found, 2 the robot's five empty hearts, 3 the friends promise to
 * help and build a nest, 4 the map and the goal. Clips per slide: the French hero line first, then a Hebrew line.
 */
export const INTRO_SLIDES: readonly SlideDef[] = [
  { id: 'intro-1', image: 'shell-intro-1', lines: ['vo-shell-intro-1-hero', 'vo-shell-intro-1-narr'] },
  { id: 'intro-2', image: 'shell-intro-2', lines: ['vo-shell-intro-2-hero', 'vo-shell-intro-2-robot'] },
  { id: 'intro-3', image: 'shell-intro-3', lines: ['vo-shell-intro-3-hero', 'vo-shell-intro-3-robot'] },
  { id: 'intro-4', image: 'shell-intro-4', lines: ['vo-shell-intro-4-hero', 'vo-shell-intro-4-narr'] },
];

/** World entry slides, shown on the first arrival per profile. Only the Workshop is open: 2 slides. */
export const ENTRY_SLIDES: Partial<Record<WorldId, readonly SlideDef[]>> = {
  workshop: [
    { id: 'workshop-1', image: 'shell-ws-1', lines: ['vo-shell-ws-1-hero', 'vo-shell-ws-1-narr'] },
    { id: 'workshop-2', image: 'shell-ws-2', lines: ['vo-shell-ws-2-robot'] },
  ],
};

export function entrySlides(world: WorldId): readonly SlideDef[] {
  return ENTRY_SLIDES[world] ?? [];
}

export type SlideState = 'playing' | 'ended' | 'skipped';
export type SlideOutcome = 'next' | 'ended' | 'skipped' | 'ignored';

export interface SlideStep {
  outcome: SlideOutcome;
  /** The sequence is over (ended or skipped). */
  finished: boolean;
}

export class SlidePlayer {
  private position = 0;
  private status: SlideState;

  constructor(private readonly slides: readonly SlideDef[]) {
    this.status = slides.length === 0 ? 'ended' : 'playing';
  }

  get count(): number {
    return this.slides.length;
  }

  get index(): number {
    return this.position;
  }

  get state(): SlideState {
    return this.status;
  }

  get current(): SlideDef | null {
    return this.status === 'playing' ? (this.slides[this.position] ?? null) : null;
  }

  /** A tap: the next slide, or the end after the last one. */
  advance(): SlideStep {
    if (this.status !== 'playing') return { outcome: 'ignored', finished: true };
    this.position++;
    if (this.position >= this.slides.length) {
      this.status = 'ended';
      return { outcome: 'ended', finished: true };
    }
    return { outcome: 'next', finished: false };
  }

  /** The skip button: the whole sequence is over at once. */
  skip(): SlideStep {
    if (this.status !== 'playing') return { outcome: 'ignored', finished: true };
    this.status = 'skipped';
    return { outcome: 'skipped', finished: true };
  }
}

/**
 * Pause between the French hero clip and the Hebrew clip of a two-clip slide. The clips play at their natural 1.0x length
 * (PR #115): the intro speaks 26.06 s (27.66 s with its four gaps), the Workshop entry 11.77 s (12.17 s). Nothing here assumes
 * a total: each clip is awaited to its end and a slide only advances on a tap.
 */
export const SLIDE_LINE_GAP_MS = 400;

export interface SlideVoiceDeps {
  /** Plays one clip; resolves when it ends (or is cut). */
  play(lineId: string): Promise<unknown>;
  /** Runs `fn` after `ms`; returns a cancel function. */
  schedule(fn: () => void, ms: number): () => void;
}

/**
 * Plays one slide's clips in order with a short gap, and can be stopped at any moment: a stop (or a newer `start`)
 * also cancels a pending second clip, so a late callback of an old slide never plays. Pure logic over injected
 * `play` and `schedule`.
 */
export class SlideVoice {
  private token = 0;
  private cancelGap: (() => void) | null = null;

  constructor(private readonly deps: SlideVoiceDeps) {}

  start(lines: readonly string[]): void {
    this.stop();
    this.playFrom(lines, 0, this.token);
  }

  stop(): void {
    this.token++;
    this.cancelGap?.();
    this.cancelGap = null;
  }

  private playFrom(lines: readonly string[], i: number, token: number): void {
    if (token !== this.token || i >= lines.length) return;
    void this.deps.play(lines[i]).then(() => {
      if (token !== this.token || i + 1 >= lines.length) return;
      this.cancelGap = this.deps.schedule(() => {
        this.cancelGap = null;
        this.playFrom(lines, i + 1, token);
      }, SLIDE_LINE_GAP_MS);
    });
  }
}

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

/** The intro: 4 slides from the film scenes 1 (egg found), 2 (the robot's empty heart), 4 (the map), 5 (the goal). */
export const INTRO_SLIDES: readonly SlideDef[] = [1, 2, 3, 4].map((n) => ({
  id: `intro-${n}`,
  image: `slide-intro-${n}`,
  lines: [`vo-fr-intro-${n}`, `vo-he-intro-${n}`],
}));

/** World entry slides, shown on the first arrival per profile. Only the Workshop is open: its scenes 1 and 4. */
export const ENTRY_SLIDES: Partial<Record<WorldId, readonly SlideDef[]>> = {
  workshop: [1, 2].map((n) => ({
    id: `workshop-${n}`,
    image: `slide-workshop-${n}`,
    lines: [`vo-fr-workshop-entry-${n}`, `vo-he-workshop-entry-${n}`],
  })),
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

// Mystery Egg: the French story and request lines of mission 1.1 as a small pure state machine (no Phaser, no audio).
// Spec: docs/specs/mystery-egg.md (AC-18, AC-19, AC-20). The scene turns the returned actions into audio calls.
//
// Rules:
//  - The intro starts with the story line; when it ends the request (`vo-fr-instruction`) follows, once.
//  - Go tapped before the story ended cuts the story and plays the request as the build starts, once.
//  - The request plays once by itself per mission; only the bunny replays it (cutting whatever is playing first).
//  - Cutting a line settles its promise, so a late "story ended" callback must never chain a second request.
//  - Any other voice (the ear's Hebrew help, a hint) that takes over also silences the story's late callback.

export type VoiceAction = { type: 'stop' } | { type: 'speak'; lineId: 'vo-fr-story' | 'vo-fr-instruction' };

const SPEAK_STORY: VoiceAction = { type: 'speak', lineId: 'vo-fr-story' };
const SPEAK_INSTRUCTION: VoiceAction = { type: 'speak', lineId: 'vo-fr-instruction' };
const STOP: VoiceAction = { type: 'stop' };

export class IntroVoice {
  private instructionRequested = false;
  private storyDone = false;
  private requests = 0;

  /** How many times the request has been requested so far (automatic once, plus one per bunny tap). */
  get instructionCount(): number {
    return this.requests;
  }

  private requestInstruction(): void {
    this.instructionRequested = true;
    this.requests++;
  }

  /** The intro opens: the story line plays. */
  start(): VoiceAction[] {
    this.instructionRequested = false;
    this.storyDone = false;
    this.requests = 0;
    return [SPEAK_STORY];
  }

  /** The story line's promise settled (it ended, or something cut it). Chains the request only on a natural end. */
  storyEnded(): VoiceAction[] {
    if (this.storyDone || this.instructionRequested) {
      this.storyDone = true;
      return [];
    }
    this.storyDone = true;
    this.requestInstruction();
    return [SPEAK_INSTRUCTION];
  }

  /** Go was tapped: the build starts. The request must have been requested by now; if not, cut the story and play it. */
  goTapped(): VoiceAction[] {
    if (this.instructionRequested) return [];
    this.storyDone = true;
    this.requestInstruction();
    return [STOP, SPEAK_INSTRUCTION];
  }

  /** The bunny was tapped: cut whatever plays and replay the request. Always allowed. */
  bunnyTapped(): VoiceAction[] {
    this.storyDone = true;
    this.requestInstruction();
    return [STOP, SPEAK_INSTRUCTION];
  }

  /** Another voice (the ear's Hebrew help, a hint, the near-miss line) took over: the story must not chain the request. */
  otherVoice(): void {
    this.storyDone = true;
  }
}

// Slide speech bubble timing (docs/specs/game-shell.md AC-31). Pure logic over an injected clock and scheduler, no Phaser.
// Team-lead default, Maor can override (docs/PENDING-DECISIONS.md): the bubble stays up while its clip plays.

/** How long a bubble stays when there is no clip to follow (a missing file: the chime plays and the line settles at once). */
export const CUE_FALLBACK_MS = 1800;

/** How much longer the bubble stays after its line settled: nothing after a real clip, the rest of 1.8 s after a chime. */
export function cueRemainingMs(s: { elapsedMs: number; chimed: boolean }): number {
  return s.chimed ? Math.max(0, CUE_FALLBACK_MS - s.elapsedMs) : 0;
}

export interface CueDeps {
  now(): number;
  /** Whether the line that just settled was the missing-file chime rather than a recorded clip. */
  chimed(): boolean;
  schedule(fn: () => void, ms: number): () => void;
  hide(): void;
}

/**
 * Hides the bubble when its clip ends (a rejected line counts as ended), or 1.8 s after it appeared when there was no clip.
 * Returns a cancel: a tap that advances the slide drops the bubble itself and nothing is hidden twice.
 */
export function holdCueWhilePlaying(play: Promise<unknown>, deps: CueDeps): () => void {
  const started = deps.now();
  let cancelled = false;
  let cancelTimer: (() => void) | null = null;
  const settled = (): void => {
    if (cancelled) return;
    const rest = cueRemainingMs({ elapsedMs: deps.now() - started, chimed: deps.chimed() });
    if (rest <= 0) deps.hide();
    else
      cancelTimer = deps.schedule(() => {
        cancelTimer = null;
        if (!cancelled) deps.hide();
      }, rest);
  };
  play.then(settled, settled);
  return () => {
    cancelled = true;
    cancelTimer?.();
    cancelTimer = null;
  };
}

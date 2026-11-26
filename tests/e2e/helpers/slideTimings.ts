// Real 1.0x durations (seconds) of the game-shell slide voice-over clips (Gemini's PR #115, the natural-speed r2 takes).
// Shared by the unit test that pins the totals and by the e2e waits, so a wait is sized from the table, never guessed.
// Not a test file (no .spec/.test suffix). Re-measure when Gemini re-delivers a clip.
export const SLIDE_GAP_S = 0.4;

export const SLIDE_CLIP_SECONDS: Readonly<Record<string, number>> = {
  'vo-shell-intro-1-hero': 1.53,
  'vo-shell-intro-1-narr': 2.15,
  'vo-shell-intro-2-hero': 2.63,
  'vo-shell-intro-2-robot': 3.21,
  'vo-shell-intro-3-hero': 1.72,
  'vo-shell-intro-3-robot': 4.31,
  'vo-shell-intro-4-hero': 3.61,
  'vo-shell-intro-4-narr': 6.91,
  'vo-shell-ws-1-hero': 2.86,
  'vo-shell-ws-1-narr': 3.41,
  'vo-shell-ws-2-robot': 5.51,
};

/** Seconds a slide's clips take to play out: the clips plus one gap between consecutive clips. */
export function slideSeconds(lines: readonly string[]): number {
  const clips = lines.reduce((sum, id) => sum + (SLIDE_CLIP_SECONDS[id] ?? 0), 0);
  return clips + Math.max(0, lines.length - 1) * SLIDE_GAP_S;
}

/** A Playwright wait (ms) for a slide to play out: its real duration with generous margin (x1.5 + 4 s for load and polling). */
export function slideWaitMs(lines: readonly string[]): number {
  return Math.ceil(slideSeconds(lines) * 1.5 + 4) * 1000;
}

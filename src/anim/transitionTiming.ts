// Pure timing for scene transitions (kept separate so it can be unit-tested).

/** Half of a transition (out or in). Clamped so the whole transition stays under 400 ms. */
export function halfDurationFor(totalMs: number): number {
  return Math.max(60, Math.min(195, Math.round(totalMs / 2)));
}

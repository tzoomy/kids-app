// Real 1.0x durations of the slide voice-over (Gemini's PR #115): the totals the docs state, the waits the e2e uses, and the
// code's own safety caps (docs/specs/game-shell.md AC-09, AC-27).
import { describe, expect, it } from 'vitest';
import { ENTRY_SLIDES, INTRO_SLIDES, SLIDE_LINE_GAP_MS } from '../../src/games/mysteryEgg/slides';
import { VOICE_CLIP_TIMEOUT_MS } from '../../src/games/mysteryEgg/voiceProvider';
import { SLIDE_CLIP_SECONDS, SLIDE_GAP_S, slideSeconds, slideWaitMs } from '../e2e/helpers/slideTimings';

const intro = INTRO_SLIDES.map((s) => s.lines);
const workshop = (ENTRY_SLIDES.workshop ?? []).map((s) => s.lines);
const sum = (rows: readonly (readonly string[])[], f: (l: readonly string[]) => number) => rows.reduce((a, l) => a + f(l), 0);
const clipsOnly = (l: readonly string[]) => l.reduce((a, id) => a + SLIDE_CLIP_SECONDS[id], 0);

describe('game-shell slide durations at 1.0x', () => {
  it('[AC-27] the table covers exactly the 11 slide clips of the intro and the Workshop entry', () => {
    const ids = [...intro, ...workshop].flat();
    expect(ids).toHaveLength(11);
    expect(Object.keys(SLIDE_CLIP_SECONDS).sort()).toEqual([...ids].sort());
    expect(SLIDE_GAP_S * 1000).toBe(SLIDE_LINE_GAP_MS);
  });

  // The per-clip figures are rounded to 10 ms, so their sums differ from Gemini's unrounded totals by up to 0.02 s.
  const near = (actual: number, expected: number) => expect(Math.abs(actual - expected)).toBeLessThanOrEqual(0.02);

  it('[AC-27] the intro speaks 26.06 s (27.66 s with the four 400 ms gaps) and the Workshop entry 11.77 s (12.17 s with its one gap)', () => {
    near(sum(intro, clipsOnly), 26.06);
    near(sum(intro, slideSeconds), 27.66);
    near(sum(workshop, clipsOnly), 11.77);
    near(sum(workshop, slideSeconds), 12.17);
  });

  it('[AC-27] slide 4 of the intro needs at least 3.61 + 0.4 + 6.91 s, and the e2e wait for it is well above that', () => {
    expect(slideSeconds(intro[3])).toBeCloseTo(10.92, 2);
    expect(slideWaitMs(intro[3])).toBeGreaterThanOrEqual(15_000);
  });

  it('[AC-27] no clip is longer than the voice provider\'s per-clip safety cap (the cap must never cut a real clip)', () => {
    expect(VOICE_CLIP_TIMEOUT_MS).toBeGreaterThanOrEqual(Math.max(...Object.values(SLIDE_CLIP_SECONDS)) * 1000 * 1.5);
  });
});

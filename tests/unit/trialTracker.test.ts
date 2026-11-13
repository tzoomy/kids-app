import { describe, expect, it } from 'vitest';
import { TrialTracker, nextRoundLanguage } from '@/games/restaurant/trialTracker';

describe('TrialTracker', () => {
  it('records exactly once: the first plate tap wins, later taps yield null', () => {
    const t = new TrialTracker('apple', 'en');
    expect(t.onPlateTap(false)).toEqual({ itemId: 'apple', firstTryCorrect: false, hinted: false });
    expect(t.onPlateTap(true)).toBeNull();
    expect(t.onPlateTap(false)).toBeNull();
  });

  it('an idle auto-hint before the first tap marks the trial as hinted', () => {
    const t = new TrialTracker('apple', 'fr');
    t.onHint();
    expect(t.onPlateTap(true)).toEqual({ itemId: 'apple', firstTryCorrect: true, hinted: true });
  });

  it('a hint after the first tap changes nothing', () => {
    const t = new TrialTracker('apple', 'en');
    const first = t.onPlateTap(false);
    t.onHint();
    expect(first?.hinted).toBe(false);
    expect(t.onPlateTap(true)).toBeNull();
  });

  it('a voluntary replay (animal or bubble tap) never calls onHint, so the trial stays clean', () => {
    const t = new TrialTracker('apple', 'en');
    // Replays do not touch the tracker; only the idle timer calls onHint.
    expect(t.onPlateTap(true)?.hinted).toBe(false);
  });

  it('keeps the language it was created with', () => {
    expect(new TrialTracker('apple', 'fr').language).toBe('fr');
  });
});

describe('nextRoundLanguage', () => {
  it('keeps the current language until the round boundary', () => {
    expect(nextRoundLanguage('fr', false, 'both', () => 0)).toBe('fr');
    expect(nextRoundLanguage('en', false, 'both', () => 0.9)).toBe('en');
  });

  it('re-picks at the boundary and on the first round', () => {
    expect(nextRoundLanguage('fr', true, 'both', () => 0)).toBe('en');
    expect(nextRoundLanguage(null, false, 'both', () => 0.9)).toBe('fr');
  });

  it('re-picks mid-round when the parent disabled the current language', () => {
    expect(nextRoundLanguage('fr', false, 'en')).toBe('en');
  });

  it('a single-language setting always wins', () => {
    expect(nextRoundLanguage(null, true, 'fr')).toBe('fr');
  });
});

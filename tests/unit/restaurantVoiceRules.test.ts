import { describe, it, expect } from 'vitest';
import { shouldPraise, shouldSayRetry, crossedWholeMinute } from '../../src/games/restaurant/voiceRules';
import { heLine, heVariant } from '../../src/content/voiceLines';

describe('restaurant voice rules', () => {
  it('praises only every 3rd correct answer', () => {
    expect([1, 2, 3, 4, 5, 6, 7].map(shouldPraise)).toEqual([false, false, true, false, false, true, false]);
    expect(shouldPraise(0)).toBe(false);
  });
  it('says the retry line only on the first wrong try', () => {
    expect([0, 1, 2, 3].map(shouldSayRetry)).toEqual([false, true, false, false]);
  });
  it('detects whole-minute gains', () => {
    expect(crossedWholeMinute(59, 60)).toBe(true);
    expect(crossedWholeMinute(60, 61)).toBe(false);
    expect(crossedWholeMinute(30, 29)).toBe(false);
    expect(crossedWholeMinute(119, 181)).toBe(true);
  });
  it('builds Hebrew requests with he.* line ids', () => {
    expect(heLine('restaurant.intro').lineId).toBe('he.restaurant.intro');
    expect(heVariant('retry', () => 0).lineId).toBe('he.retry.0');
    expect(heVariant('praise', () => 0.99).lineId).toBe('he.praise.2');
  });
});

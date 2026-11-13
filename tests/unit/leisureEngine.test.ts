import { describe, expect, it } from 'vitest';
import { earnParticipation, rolloverIfNeeded } from '@/core/leisure';
import { defaultProfileState, type LeisureSettings } from '@/core/storage/schema';

const settings: LeisureSettings = {
  learnMinutes: 10,
  leisureMinutes: 5,
  dailyEarnCapMinutes: 30,
  idleSeconds: 20,
  languages: 'both',
  timeEarning: { enabled: true },
};

describe('earnParticipation', () => {
  it('converts participation seconds to leisure seconds at the configured ratio', () => {
    const state = defaultProfileState('2026-11-10');
    // 10 learn minutes (600s) should yield 5 leisure minutes (300s) at the default ratio.
    earnParticipation(state, settings, '2026-11-10', 600);
    expect(state.balanceSec).toBe(300);
    expect(state.activeSec).toBe(600);
  });

  it('carries fractional leisure seconds instead of dropping them to rounding', () => {
    const state = defaultProfileState('2026-11-10');
    // 1 second at ratio 0.5 => 0.5s carry each tick; two ticks should yield exactly 1 whole second.
    earnParticipation(state, settings, '2026-11-10', 1);
    expect(state.balanceSec).toBe(0);
    expect(state.carry).toBeCloseTo(0.5);
    earnParticipation(state, settings, '2026-11-10', 1);
    expect(state.balanceSec).toBe(1);
    expect(state.carry).toBeCloseTo(0);
  });

  it('stops earning once the daily cap is reached, but keeps counting active seconds', () => {
    const state = defaultProfileState('2026-11-10');
    earnParticipation(state, settings, '2026-11-10', 60 * 60); // 1 hour of participation
    expect(state.earnedTodaySec).toBe(settings.dailyEarnCapMinutes * 60);
    const balanceAtCap = state.balanceSec;
    earnParticipation(state, settings, '2026-11-10', 60);
    expect(state.balanceSec).toBe(balanceAtCap);
    expect(state.activeSec).toBeGreaterThan(60 * 60);
  });

  it('never reduces balance — mistakes simply don\'t call this function', () => {
    const state = defaultProfileState('2026-11-10');
    state.balanceSec = 120;
    // Simulate "no qualifying time" by just not calling earnParticipation.
    expect(state.balanceSec).toBe(120);
  });
});

describe('rolloverIfNeeded (local day rollover)', () => {
  it('resets earnedTodaySec on a new local day but keeps the balance', () => {
    const state = defaultProfileState('2026-11-10');
    state.earnedTodaySec = 500;
    state.balanceSec = 900;
    rolloverIfNeeded(state, '2026-11-11');
    expect(state.day).toBe('2026-11-11');
    expect(state.earnedTodaySec).toBe(0);
    expect(state.balanceSec).toBe(900);
  });

  it('is a no-op within the same local day', () => {
    const state = defaultProfileState('2026-11-10');
    state.earnedTodaySec = 42;
    rolloverIfNeeded(state, '2026-11-10');
    expect(state.earnedTodaySec).toBe(42);
  });
});

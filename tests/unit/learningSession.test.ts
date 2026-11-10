import { describe, expect, it } from 'vitest';
import { LearningSession } from '@/core/leisure';
import { defaultProfileState, type LeisureSettings } from '@/core/storage/schema';

const settings: LeisureSettings = {
  learnMinutes: 10,
  leisureMinutes: 5,
  dailyEarnCapMinutes: 30,
  idleSeconds: 20,
  languages: 'both',
};

function makeClock(startMs: number) {
  let now = startMs;
  return { now: () => now, advance: (ms: number) => (now += ms) };
}

describe('LearningSession', () => {
  it('earns while interacting within the idle window', () => {
    const state = defaultProfileState('2026-11-10');
    const clock = makeClock(0);
    const session = new LearningSession(state, settings, clock.now);
    session.start();
    for (let i = 0; i < 10; i++) {
      clock.advance(1000);
      session.tick(1);
    }
    expect(state.activeSec).toBe(10);
    expect(state.balanceSec).toBeGreaterThan(0);
  });

  it('stops earning once idle beyond the idle threshold, without any touch', () => {
    const state = defaultProfileState('2026-11-10');
    const clock = makeClock(0);
    const session = new LearningSession(state, settings, clock.now);
    session.start();
    clock.advance(settings.idleSeconds * 1000 + 1000); // well past idle threshold, no interaction
    session.tick(1);
    expect(state.activeSec).toBe(0);
  });

  it('keeps earning while listening, even with no touch (listening is not idle)', () => {
    const state = defaultProfileState('2026-11-10');
    const clock = makeClock(0);
    const session = new LearningSession(state, settings, clock.now);
    session.start();
    session.reportListening(true);
    clock.advance(settings.idleSeconds * 1000 + 5000);
    session.tick(1);
    expect(state.activeSec).toBe(1);
  });

  it('keeps earning while celebrating a success animation', () => {
    const state = defaultProfileState('2026-11-10');
    const clock = makeClock(0);
    const session = new LearningSession(state, settings, clock.now);
    session.start();
    session.complete(); // sets celebrating = true
    clock.advance(settings.idleSeconds * 1000 + 5000);
    session.tick(1);
    expect(state.activeSec).toBe(1);
  });

  it('does not earn while the tab is hidden, even if recently interacted with', () => {
    const state = defaultProfileState('2026-11-10');
    const clock = makeClock(0);
    const session = new LearningSession(state, settings, clock.now);
    session.start();
    session.reportInteraction();
    session.setHidden(true);
    session.tick(1);
    expect(state.activeSec).toBe(0);
  });

  it('a wrong-choice interaction still counts as participation (no penalty for mistakes)', () => {
    const state = defaultProfileState('2026-11-10');
    const clock = makeClock(0);
    const session = new LearningSession(state, settings, clock.now);
    session.start();
    state.balanceSec = 50;
    session.reportInteraction(); // represents tapping a wrong choice
    clock.advance(1000);
    session.tick(1);
    expect(state.activeSec).toBe(1);
    expect(state.balanceSec).toBe(50); // unchanged by the mistake
  });
});

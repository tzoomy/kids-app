import { isTimeEarningEnabled, type LeisureSettings, type ProfileState } from '../storage/schema';
import { localDayKey } from '../storage/dayKey';

/** Resets today's earned counter when the local calendar day has rolled over. Unredeemed balance carries. */
export function rolloverIfNeeded(state: ProfileState, day: string): void {
  if (state.day !== day) {
    state.day = day;
    state.earnedTodaySec = 0;
  }
}

/**
 * Accrues qualifying participation time and converts it to leisure balance at the
 * configured ratio, up to the daily earning cap. Fractional leisure seconds carry
 * forward instead of being dropped by rounding. Mistakes never reduce balance here —
 * callers simply never call this during non-qualifying time.
 */
export function earnParticipation(
  state: ProfileState,
  settings: LeisureSettings,
  day: string,
  dtSec: number,
): void {
  if (!isTimeEarningEnabled(settings)) return;
  rolloverIfNeeded(state, day);
  state.activeSec += dtSec;

  const capSec = settings.dailyEarnCapMinutes * 60;
  if (state.earnedTodaySec >= capSec) return;

  const ratio = settings.leisureMinutes / settings.learnMinutes;
  state.carry += dtSec * ratio;
  const whole = Math.floor(state.carry);
  if (whole <= 0) return;

  const add = Math.min(whole, capSec - state.earnedTodaySec);
  state.balanceSec += add;
  state.earnedTodaySec += add;
  state.carry -= whole;
}

export function dayKeyFromMs(nowMs: number): string {
  return localDayKey(new Date(nowMs));
}

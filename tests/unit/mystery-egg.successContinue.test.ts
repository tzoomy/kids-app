// Mission 1.1 success flow: the Continue button appears only after the Bravo line (`vo-fr-success`) has finished, with a safe
// fallback when the clip never ends (docs/specs/mystery-egg.md AC-26). Pure timing helper, fake timers.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import {
  CONTINUE_AFTER_VO_MS,
  CONTINUE_MIN_DELAY_MS,
  SUCCESS_VO_CAP_MS,
  showContinueAfterVoice,
} from '../../src/games/mysteryEgg/successTiming';

beforeEach(() => vi.useFakeTimers());
afterEach(() => vi.useRealTimers());

function start(voice: Promise<unknown>) {
  const show = vi.fn();
  showContinueAfterVoice(voice, show);
  return show;
}
const deferred = () => {
  let resolve!: (v: boolean) => void;
  const promise = new Promise<boolean>((r) => (resolve = r));
  return { promise, resolve };
};

describe('mystery-egg success Continue timing', () => {
  it('[AC-26] the constants: a quick minimum (0.7 s), a short margin after the line ends, and a fixed cap of 8 s', () => {
    expect(CONTINUE_MIN_DELAY_MS).toBe(700);
    expect(CONTINUE_AFTER_VO_MS).toBeGreaterThan(0);
    expect(CONTINUE_AFTER_VO_MS).toBeLessThan(700);
    expect(SUCCESS_VO_CAP_MS).toBe(8000);
  });

  it('[AC-26] Continue is not shown while the Bravo line is still playing, however long the minimum delay has passed', async () => {
    const v = deferred();
    const show = start(v.promise);
    await vi.advanceTimersByTimeAsync(CONTINUE_MIN_DELAY_MS + 3000);
    expect(show).not.toHaveBeenCalled();
  });

  it('[AC-26] it appears a short margin after the line ends (and never before the minimum delay)', async () => {
    const v = deferred();
    const show = start(v.promise);
    await vi.advanceTimersByTimeAsync(3000);
    v.resolve(true);
    await vi.advanceTimersByTimeAsync(CONTINUE_AFTER_VO_MS - 1);
    expect(show).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('[AC-26] the chime / placeholder path stays quick: a line that settles at once shows Continue at the minimum delay', async () => {
    const show = start(Promise.resolve(true));
    await vi.advanceTimersByTimeAsync(CONTINUE_MIN_DELAY_MS - 1);
    expect(show).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('[AC-26] a line that fails (rejected) counts as finished', async () => {
    const show = start(Promise.reject(new Error('boom')));
    await vi.advanceTimersByTimeAsync(CONTINUE_MIN_DELAY_MS + 2);
    expect(show).toHaveBeenCalledTimes(1);
  });

  it('[AC-26] a line that never ends cannot trap the child: Continue appears at the 8 s cap, exactly once', async () => {
    const v = deferred();
    const show = start(v.promise);
    await vi.advanceTimersByTimeAsync(SUCCESS_VO_CAP_MS - 1);
    expect(show).not.toHaveBeenCalled();
    await vi.advanceTimersByTimeAsync(2);
    expect(show).toHaveBeenCalledTimes(1);
    v.resolve(true); // a late end changes nothing
    await vi.advanceTimersByTimeAsync(5000);
    expect(show).toHaveBeenCalledTimes(1);
  });
});

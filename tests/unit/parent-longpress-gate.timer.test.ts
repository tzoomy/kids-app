// Hold-timer state machine for the 3-second parent long-press (docs/specs/parent-longpress-gate.md).
// Pure module: no DOM, fake timers only.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { createHoldTimer, HOLD_DURATION_MS, type HoldCancelReason } from '../../src/ui/longPress';

function setup() {
  const onProgress = vi.fn<(fraction: number) => void>();
  const onComplete = vi.fn<() => void>();
  const onCancel = vi.fn<(info: { reason: HoldCancelReason; heldMs: number }) => void>();
  const timer = createHoldTimer({
    durationMs: 3000,
    onProgress,
    onComplete,
    onCancel,
    now: () => Date.now(),
  });
  const lastProgress = (): number => onProgress.mock.calls[onProgress.mock.calls.length - 1]?.[0] ?? Number.NaN;
  return { timer, onProgress, onComplete, onCancel, lastProgress };
}

describe('parent long-press hold timer', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
  });

  it('the default hold duration is 3 seconds', () => {
    expect(HOLD_DURATION_MS).toBe(3000);
  });

  it('[AC-01] start(pointerId) begins a hold: holding, not completed, progress 0, nothing fired', () => {
    const { timer, onComplete, onCancel, lastProgress } = setup();
    expect(timer.isHolding).toBe(false);
    expect(timer.completed).toBe(false);

    expect(timer.start(1)).toBe(true);

    expect(timer.isHolding).toBe(true);
    expect(timer.completed).toBe(false);
    expect(lastProgress()).toBe(0);
    expect(onComplete).not.toHaveBeenCalled();
    expect(onCancel).not.toHaveBeenCalled();
  });

  it('[AC-01] progress rises with time: about half way at 1500 ms and never goes backwards', () => {
    const { timer, onProgress, lastProgress } = setup();
    timer.start(1);

    vi.advanceTimersByTime(1500);
    expect(lastProgress()).toBeCloseTo(0.5, 1);

    vi.advanceTimersByTime(900); // 2400 ms
    expect(lastProgress()).toBeGreaterThan(0.5);
    expect(lastProgress()).toBeLessThan(1);

    const values = onProgress.mock.calls.map(([f]) => f);
    expect(values.length).toBeGreaterThan(5); // reports several times, not only at the ends
    for (let i = 1; i < values.length; i++) expect(values[i]).toBeGreaterThanOrEqual(values[i - 1]);
    for (const v of values) {
      expect(v).toBeGreaterThanOrEqual(0);
      expect(v).toBeLessThanOrEqual(1);
    }
  });

  it('[AC-02] an early release cancels with no completion and resets progress to 0', () => {
    const { timer, onComplete, onCancel, lastProgress } = setup();
    timer.start(1);
    vi.advanceTimersByTime(1500);

    timer.cancel('release');

    expect(timer.isHolding).toBe(false);
    expect(timer.completed).toBe(false);
    expect(lastProgress()).toBe(0);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith({ reason: 'release', heldMs: 1500 });

    vi.advanceTimersByTime(10_000); // the old hold must not complete later
    expect(onComplete).not.toHaveBeenCalled();
  });

  it('[AC-02] there is no lockout: a new hold can start right after a cancel and completes on its own clock', () => {
    const { timer, onComplete } = setup();
    timer.start(1);
    vi.advanceTimersByTime(2000);
    timer.cancel('release');

    expect(timer.start(2)).toBe(true);
    expect(timer.isHolding).toBe(true);

    vi.advanceTimersByTime(2999); // 2999 ms since the NEW start, 4999 ms since the first
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('[AC-02] cancel() while idle is a harmless no-op', () => {
    const { timer, onCancel } = setup();
    expect(() => timer.cancel('release')).not.toThrow();
    expect(onCancel).not.toHaveBeenCalled();
    expect(timer.isHolding).toBe(false);
  });

  it.each<HoldCancelReason>(['pointercancel', 'pointerleave', 'lostpointercapture', 'blur'])(
    '[AC-03] %s cancels the hold: no completion, progress reset, reason reported',
    (reason) => {
      const { timer, onComplete, onCancel, lastProgress } = setup();
      timer.start(1);
      vi.advanceTimersByTime(1000);

      timer.cancel(reason);

      expect(timer.isHolding).toBe(false);
      expect(lastProgress()).toBe(0);
      expect(onCancel).toHaveBeenCalledWith({ reason, heldMs: 1000 });
      vi.advanceTimersByTime(10_000);
      expect(onComplete).not.toHaveBeenCalled();
      expect(timer.completed).toBe(false);
    },
  );

  it('[AC-04] completes at exactly 3000 ms and not at 2999 ms', () => {
    const { timer, onComplete } = setup();
    timer.start(1);

    vi.advanceTimersByTime(2999);
    expect(onComplete).not.toHaveBeenCalled();
    expect(timer.isHolding).toBe(true);
    expect(timer.completed).toBe(false);

    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(timer.isHolding).toBe(false);
    expect(timer.completed).toBe(true);
  });

  it('[AC-04] onComplete fires once: no repeat while time keeps passing, none from a late cancel', () => {
    const { timer, onComplete, onCancel, lastProgress } = setup();
    timer.start(1);
    vi.advanceTimersByTime(3000);
    expect(lastProgress()).toBe(1);

    vi.advanceTimersByTime(30_000);
    timer.cancel('release'); // the finger lifts after the hold already completed

    expect(onComplete).toHaveBeenCalledTimes(1);
    expect(onCancel).not.toHaveBeenCalled();
    expect(timer.completed).toBe(true);
  });

  it('[AC-04] after a completion a new hold works and resets completed', () => {
    const { timer, onComplete } = setup();
    timer.start(1);
    vi.advanceTimersByTime(3000);
    expect(timer.completed).toBe(true);

    expect(timer.start(1)).toBe(true);
    expect(timer.completed).toBe(false);
    expect(timer.isHolding).toBe(true);
    vi.advanceTimersByTime(3000);
    expect(onComplete).toHaveBeenCalledTimes(2);
  });

  it('[AC-04] honours a custom duration', () => {
    const onComplete = vi.fn();
    const timer = createHoldTimer({ durationMs: 1000, onComplete, now: () => Date.now() });
    timer.start(1);
    vi.advanceTimersByTime(999);
    expect(onComplete).not.toHaveBeenCalled();
    vi.advanceTimersByTime(1);
    expect(onComplete).toHaveBeenCalledTimes(1);
  });

  it('[AC-05] a second pointer cancels the hold: start() returns false and nothing ever completes', () => {
    const { timer, onComplete, onCancel, lastProgress } = setup();
    timer.start(1);
    vi.advanceTimersByTime(1000);

    expect(timer.start(2)).toBe(false);

    expect(timer.isHolding).toBe(false);
    expect(lastProgress()).toBe(0);
    expect(onCancel).toHaveBeenCalledTimes(1);
    expect(onCancel).toHaveBeenCalledWith({ reason: 'multi-touch', heldMs: 1000 });
    vi.advanceTimersByTime(10_000);
    expect(onComplete).not.toHaveBeenCalled();
    expect(timer.completed).toBe(false);
  });

  it('[AC-05] a repeated start() of the same pointer is not multi-touch and does not restart the clock', () => {
    const { timer, onComplete, onCancel } = setup();
    timer.start(7);
    vi.advanceTimersByTime(2000);

    expect(timer.start(7)).toBe(true);
    expect(onCancel).not.toHaveBeenCalled();

    vi.advanceTimersByTime(1000); // 3000 ms since the first start
    expect(onComplete).toHaveBeenCalledTimes(1);
  });
});

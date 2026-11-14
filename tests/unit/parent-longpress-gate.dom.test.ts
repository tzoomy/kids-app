// @vitest-environment jsdom
// DOM binder of the 3-second parent long-press (docs/specs/parent-longpress-gate.md): pointer events on a
// real button, the progress element, and trailing-click suppression. Fake timers drive the clock.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { attachLongPress } from '../../src/ui/longPress';

type PointerInit = { pointerId?: number; isPrimary?: boolean; button?: number; clientX?: number; clientY?: number };

/** Dispatches a pointer event; falls back to a MouseEvent carrying pointer fields if PointerEvent is missing. */
function firePointer(target: EventTarget, type: string, init: PointerInit = {}): void {
  const { pointerId = 1, isPrimary = true, button = 0, clientX = 100, clientY = 100 } = init;
  const base = { bubbles: true, cancelable: true, button, clientX, clientY };
  let event: Event;
  if (typeof PointerEvent !== 'undefined') {
    event = new PointerEvent(type, { ...base, pointerId, isPrimary, pointerType: 'touch' });
  } else {
    event = new MouseEvent(type, base);
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    Object.defineProperty(event, 'isPrimary', { value: isPrimary });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
  }
  target.dispatchEvent(event);
}

function fireClick(button: HTMLElement): void {
  button.dispatchEvent(new MouseEvent('click', { bubbles: true, cancelable: true }));
}

function setup() {
  const button = document.createElement('button');
  button.dataset.testid = 'parent-gate-btn';
  document.body.appendChild(button);
  const onTap = vi.fn();
  const onLongPress = vi.fn();
  const detach = attachLongPress(button, { onTap, onLongPress });
  const progress = (): HTMLElement | null => button.querySelector('[data-testid="parent-gate-progress"]');
  return { button, onTap, onLongPress, detach, progress };
}

describe('attachLongPress (DOM binder)', () => {
  beforeEach(() => {
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('[AC-01] shows a progress bar on the button only while held, and its value rises with the hold', () => {
    const { button, progress } = setup();
    expect(progress()).toBeNull();

    firePointer(button, 'pointerdown');
    const bar = progress();
    expect(bar).not.toBeNull();
    expect(bar!.getAttribute('role')).toBe('progressbar');
    expect(Number(bar!.getAttribute('aria-valuenow'))).toBe(0);

    vi.advanceTimersByTime(1500);
    const half = Number(progress()!.getAttribute('aria-valuenow'));
    expect(half).toBeGreaterThanOrEqual(40);
    expect(half).toBeLessThanOrEqual(60);

    vi.advanceTimersByTime(900);
    expect(Number(progress()!.getAttribute('aria-valuenow'))).toBeGreaterThan(half);

    firePointer(button, 'pointerup');
    expect(progress()).toBeNull();
  });

  it('[AC-04] a continuous 3 s hold calls onLongPress once (not at 2999 ms) and removes the progress bar', () => {
    const { button, onLongPress, onTap, progress } = setup();
    firePointer(button, 'pointerdown');

    vi.advanceTimersByTime(2999);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(progress()).not.toBeNull();

    vi.advanceTimersByTime(1);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(progress()).toBeNull();

    vi.advanceTimersByTime(10_000);
    expect(onLongPress).toHaveBeenCalledTimes(1);
    expect(onTap).not.toHaveBeenCalled();
  });

  it.each(['pointerleave', 'pointercancel', 'lostpointercapture'])(
    '[AC-03] %s on the button cancels the hold: no long-press, progress removed, no click action',
    (type) => {
      const { button, onLongPress, onTap, progress } = setup();
      firePointer(button, 'pointerdown');
      vi.advanceTimersByTime(1000);

      firePointer(button, type);

      expect(progress()).toBeNull();
      // If the pointer comes back and is released on the button, the browser may still send a click right away
      // (inside the 300 ms suppression window): it must not open anything.
      fireClick(button);
      expect(onTap).not.toHaveBeenCalled();
      vi.advanceTimersByTime(10_000);
      expect(onLongPress).not.toHaveBeenCalled();
    },
  );

  it('[AC-03] window blur cancels the hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(1000);

    window.dispatchEvent(new Event('blur'));

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-03] blur on the button cancels the hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(1000);

    button.dispatchEvent(new Event('blur')); // focus moves away; blur does not bubble

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-03] after pointercancel with every pointer up, a keyboard or assistive click 400 ms later is a plain tap', () => {
    const { button, onTap, onLongPress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(1000);
    firePointer(button, 'pointercancel');

    vi.advanceTimersByTime(400);
    fireClick(button);

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-03] the context menu is blocked on the button while a pointer is down', () => {
    const { button } = setup();
    firePointer(button, 'pointerdown');
    const event = new Event('contextmenu', { bubbles: true, cancelable: true });
    button.dispatchEvent(event);
    expect(event.defaultPrevented).toBe(true);
  });

  it('[AC-05] a second pointer going down cancels the hold and it never completes', () => {
    const { button, onLongPress, onTap, progress } = setup();
    firePointer(button, 'pointerdown', { pointerId: 1 });
    vi.advanceTimersByTime(1000);

    firePointer(button, 'pointerdown', { pointerId: 2, isPrimary: false });

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();

    firePointer(button, 'pointerup', { pointerId: 2, isPrimary: false });
    firePointer(button, 'pointerup', { pointerId: 1 });
    fireClick(button);
    expect(onTap).not.toHaveBeenCalled(); // a two-finger grab is not a tap
  });

  it('[AC-05] the first finger staying down does not restart the hold; a fresh press after all pointers are up does', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown', { pointerId: 1 });
    firePointer(button, 'pointerdown', { pointerId: 2, isPrimary: false });
    firePointer(button, 'pointerup', { pointerId: 2, isPrimary: false });

    // Pointer 1 is still down: nothing restarts, even if a third pointer lands and lifts.
    firePointer(button, 'pointerdown', { pointerId: 3, isPrimary: false });
    firePointer(button, 'pointerup', { pointerId: 3, isPrimary: false });
    expect(progress()).toBeNull();
    vi.advanceTimersByTime(5000);
    expect(onLongPress).not.toHaveBeenCalled();

    firePointer(button, 'pointerup', { pointerId: 1 });
    vi.advanceTimersByTime(400); // let click suppression expire

    firePointer(button, 'pointerdown', { pointerId: 4 });
    expect(progress()).not.toBeNull();
    vi.advanceTimersByTime(3000);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('[AC-05] a second pointer going down OFF the button cancels the hold: it never completes and the trailing click is not a tap', () => {
    const { button, onLongPress, onTap, progress } = setup();
    firePointer(button, 'pointerdown', { pointerId: 1 });
    vi.advanceTimersByTime(1000);

    // A resting palm / second finger lands on the canvas, not on the button.
    firePointer(document.body, 'pointerdown', { pointerId: 2, isPrimary: false });

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();

    firePointer(document.body, 'pointerup', { pointerId: 2, isPrimary: false });
    firePointer(button, 'pointerup', { pointerId: 1 });
    fireClick(button);
    expect(onTap).not.toHaveBeenCalled();
  });

  it('[AC-05] a pointer already down elsewhere (a resting palm) means a non-primary finger on the button never starts a hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(document.body, 'pointerdown', { pointerId: 1 });
    firePointer(button, 'pointerdown', { pointerId: 2, isPrimary: false });

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-05] a pointerdown with isPrimary false never starts a hold, even when it is the only pointer', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown', { pointerId: 1, isPrimary: false });

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it.each(['pointerup', 'pointercancel'])(
    '[AC-05] hardening: an off-button %s whose bubble is stopped still untracks its pointer, so a later tap and a fresh 3 s hold both work',
    (endType) => {
      const { button, onTap, onLongPress, progress } = setup();

      // Some element between the target and window swallows the end event's bubble (stopPropagation).
      const swallowBubble = (e: Event): void => e.stopPropagation();
      document.body.addEventListener(endType, swallowBubble);
      try {
        // A touch lands off the button: the capture-phase window tracker records its pointerId in `down`.
        firePointer(document.body, 'pointerdown', { pointerId: 2 });
        // It lifts (or is cancelled) off the button, but the bubble stops at body and never reaches window.
        // Only a capture-phase window listener can still see this event and untrack pointer 2.
        firePointer(document.body, endType, { pointerId: 2 });
        vi.advanceTimersByTime(400); // let any click suppression expire

        // Touch pointer ids are never reused. If id 2 is stuck in `down`, every later press looks like multi-touch.
        firePointer(button, 'pointerdown', { pointerId: 3 });
        vi.advanceTimersByTime(100);
        firePointer(button, 'pointerup', { pointerId: 3 });
        fireClick(button);
        expect(onTap).toHaveBeenCalledTimes(1);
        expect(onLongPress).not.toHaveBeenCalled();
        vi.advanceTimersByTime(400); // let click suppression expire

        firePointer(button, 'pointerdown', { pointerId: 4 });
        expect(progress()).not.toBeNull();
        vi.advanceTimersByTime(3000);
        expect(onLongPress).toHaveBeenCalledTimes(1);
      } finally {
        document.body.removeEventListener(endType, swallowBubble);
      }
    },
  );

  it('[AC-05] two-finger press: the trailing click is not a tap even when finger 1 lifts more than 300 ms after finger 2', () => {
    const { button, onTap, onLongPress } = setup();
    firePointer(button, 'pointerdown', { pointerId: 1 });
    vi.advanceTimersByTime(1000);
    firePointer(button, 'pointerdown', { pointerId: 2, isPrimary: false }); // cancels the hold and suppresses the click
    firePointer(button, 'pointerup', { pointerId: 2, isPrimary: false });

    vi.advanceTimersByTime(400); // finger 1 is still down: the suppression must outlive this delay
    firePointer(button, 'pointerup', { pointerId: 1 });
    fireClick(button);

    expect(onTap).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-03] removing the button mid-hold (detach not called) cancels the hold: onLongPress never fires', () => {
    const { button, onLongPress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(1000);

    button.remove(); // a re-render or screen change drops the button without calling detach()

    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-06] after a completed hold the trailing click does not open the multiplication gate', () => {
    const { button, onTap, onLongPress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(3000);
    expect(onLongPress).toHaveBeenCalledTimes(1);

    firePointer(button, 'pointerup'); // the finger lifts after the hold completed
    fireClick(button); // ...and the browser fires its click

    expect(onTap).not.toHaveBeenCalled();
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('[AC-06] a completed hold does not break the next press: a fresh short tap still reaches onTap', () => {
    const { button, onTap } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(3000);
    firePointer(button, 'pointerup');
    fireClick(button);
    expect(onTap).not.toHaveBeenCalled();

    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(100);
    firePointer(button, 'pointerup');
    fireClick(button);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('[AC-07] a quick tap (under 500 ms) lets the click through to onTap and never starts a long-press', () => {
    const { button, onTap, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(120);
    firePointer(button, 'pointerup');
    fireClick(button);

    expect(onTap).toHaveBeenCalledTimes(1);
    expect(onLongPress).not.toHaveBeenCalled();
    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-07] the tap boundary: released at 499 ms is a tap, at 500 ms is a cancelled hold', () => {
    const tap = setup();
    firePointer(tap.button, 'pointerdown');
    vi.advanceTimersByTime(499);
    firePointer(tap.button, 'pointerup');
    fireClick(tap.button);
    expect(tap.onTap).toHaveBeenCalledTimes(1);
    document.body.replaceChildren();

    const hold = setup();
    firePointer(hold.button, 'pointerdown');
    vi.advanceTimersByTime(500);
    firePointer(hold.button, 'pointerup');
    fireClick(hold.button);
    expect(hold.onTap).not.toHaveBeenCalled();
    expect(hold.onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-07] releasing between 500 ms and 3 s is a cancelled hold: the click opens nothing, and there is no lockout', () => {
    const { button, onTap, onLongPress } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(1500);
    firePointer(button, 'pointerup');
    fireClick(button);
    expect(onTap).not.toHaveBeenCalled();
    expect(onLongPress).not.toHaveBeenCalled();

    // Immediately afterwards a short tap works as normal.
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(100);
    firePointer(button, 'pointerup');
    fireClick(button);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('[AC-07] a keyboard or assistive click with no pointer sequence is a plain tap', () => {
    const { button, onTap } = setup();
    fireClick(button);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('[AC-07] click suppression expires: a stray keyboard click 300 ms after a cancelled hold is not swallowed', () => {
    const { button, onTap } = setup();
    firePointer(button, 'pointerdown');
    vi.advanceTimersByTime(1500);
    firePointer(button, 'pointerup'); // no click follows (for example the pointer was released elsewhere)

    vi.advanceTimersByTime(400);
    fireClick(button);
    expect(onTap).toHaveBeenCalledTimes(1);
  });

  it('[AC-08] moving more than 12 px from the press point cancels the hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown', { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(1000);

    firePointer(button, 'pointermove', { clientX: 100, clientY: 114 });

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-08] move tolerance boundary: exactly 12 px does not cancel the hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown', { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(1000);

    firePointer(button, 'pointermove', { clientX: 100, clientY: 112 });

    expect(progress()).not.toBeNull();
    vi.advanceTimersByTime(2000);
    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('[AC-08] move tolerance boundary: 13 px cancels the hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown', { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(1000);

    firePointer(button, 'pointermove', { clientX: 100, clientY: 113 });

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-08] small finger jitter (within 12 px) does not cancel the hold', () => {
    const { button, onLongPress } = setup();
    firePointer(button, 'pointerdown', { clientX: 100, clientY: 100 });
    vi.advanceTimersByTime(1000);
    firePointer(button, 'pointermove', { clientX: 105, clientY: 96 });
    vi.advanceTimersByTime(1000);
    firePointer(button, 'pointermove', { clientX: 94, clientY: 104 });
    vi.advanceTimersByTime(1000);

    expect(onLongPress).toHaveBeenCalledTimes(1);
  });

  it('[AC-08] a right or middle mouse button never starts a hold', () => {
    const { button, onLongPress, progress } = setup();
    firePointer(button, 'pointerdown', { button: 2 });
    expect(progress()).toBeNull();
    firePointer(button, 'pointerup', { button: 2 });
    firePointer(button, 'pointerdown', { button: 1 });
    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
  });

  it('[AC-08] detach() removes every listener and any progress bar', () => {
    const { button, onTap, onLongPress, detach, progress } = setup();
    firePointer(button, 'pointerdown');
    expect(progress()).not.toBeNull();

    detach();

    expect(progress()).toBeNull();
    vi.advanceTimersByTime(10_000);
    expect(onLongPress).not.toHaveBeenCalled();
    fireClick(button);
    expect(onTap).not.toHaveBeenCalled();
  });
});

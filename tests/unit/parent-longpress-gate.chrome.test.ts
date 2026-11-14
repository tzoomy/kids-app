// @vitest-environment jsdom
// Re-rendering the chrome that owns the parent button (docs/specs/parent-longpress-gate.md): `renderMapChrome`
// (resize / paintChrome) and `renderProfileSelect` replace the button, and callers never keep the `detach` that
// `attachLongPress` returns. A hold started on the old button must not complete on the old callback, and the
// new button must not inherit it.
import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import { renderMapChrome, type MapChromeOptions } from '../../src/ui/hud';
import { renderProfileSelect, type ProfileSelectEntry } from '../../src/ui/profileSelect';

const GATE_BTN = '[data-testid="parent-gate-btn"]';
const PROGRESS = '[data-testid="parent-gate-progress"]';

/** Dispatches a primary touch pointer event; falls back to a MouseEvent carrying pointer fields. */
function firePointer(target: EventTarget, type: string, pointerId = 1): void {
  const base = { bubbles: true, cancelable: true, button: 0, clientX: 100, clientY: 100 };
  let event: Event;
  if (typeof PointerEvent !== 'undefined') {
    event = new PointerEvent(type, { ...base, pointerId, isPrimary: true, pointerType: 'touch' });
  } else {
    event = new MouseEvent(type, base);
    Object.defineProperty(event, 'pointerId', { value: pointerId });
    Object.defineProperty(event, 'isPrimary', { value: true });
    Object.defineProperty(event, 'pointerType', { value: 'touch' });
  }
  target.dispatchEvent(event);
}

function parentButton(root: HTMLElement): HTMLElement {
  const button = root.querySelector<HTMLElement>(GATE_BTN);
  if (!button) throw new Error('parent button not rendered');
  return button;
}

function mapOptions(onParentLongPress: () => void): MapChromeOptions {
  const canvas = document.createElement('canvas');
  document.body.appendChild(canvas);
  return {
    title: 'map',
    balanceSec: 0,
    onParent: vi.fn(),
    onParentLongPress,
    onSwitchProfile: vi.fn(),
    pins: [],
    canvas,
    gameWidth: 1280,
    gameHeight: 800,
  };
}

const ENTRIES: ProfileSelectEntry[] = [
  {
    profile: { id: 'a', name: 'A', avatar: 'bunny', ageTrack: 'age2' },
    state: { activeSec: 0, balanceSec: 0, earnedTodaySec: 0, carry: 0, day: '2026-01-01', stars: 0 },
  },
];

describe('parent long-press survives chrome re-renders', () => {
  let root: HTMLElement;

  beforeEach(() => {
    vi.useFakeTimers();
    root = document.createElement('div');
    document.body.appendChild(root);
  });
  afterEach(() => {
    vi.useRealTimers();
    document.body.replaceChildren();
  });

  it('[AC-03] re-rendering the map chrome mid-hold cancels it: the old callback never fires and the new button does not inherit the hold', () => {
    const first = vi.fn();
    const second = vi.fn();
    renderMapChrome(root, mapOptions(first));
    firePointer(parentButton(root), 'pointerdown');
    vi.advanceTimersByTime(1000);

    // What a resize / paintChrome does: clear(root) and build a fresh button with a fresh callback.
    renderMapChrome(root, mapOptions(second));

    vi.advanceTimersByTime(10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(root.querySelector(PROGRESS)).toBeNull();
  });

  it('[AC-03] re-rendering the profile select mid-hold cancels it: the old callback never fires and the new button does not inherit the hold', () => {
    const first = vi.fn();
    const second = vi.fn();
    renderProfileSelect(root, ENTRIES, vi.fn(), vi.fn(), first);
    firePointer(parentButton(root), 'pointerdown');
    vi.advanceTimersByTime(1000);

    renderProfileSelect(root, ENTRIES, vi.fn(), vi.fn(), second);

    vi.advanceTimersByTime(10_000);
    expect(first).not.toHaveBeenCalled();
    expect(second).not.toHaveBeenCalled();
    expect(root.querySelector(PROGRESS)).toBeNull();
  });
});

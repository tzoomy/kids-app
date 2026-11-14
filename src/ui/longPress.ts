// 3-second long-press for the parent-area button (docs/specs/parent-longpress-gate.md).
// `createHoldTimer` is DOM-free (a hold state machine); `attachLongPress` binds it to a real button.

export const HOLD_DURATION_MS = 3000;
export const TAP_MAX_MS = 500;
export const MOVE_TOLERANCE_PX = 12;
/** How long the click that trails a cancelled or completed hold stays suppressed after the pointer is released. */
const CLICK_SUPPRESS_MS = 300;
const DEFAULT_TICK_MS = 50;

export type HoldCancelReason =
  | 'release'
  | 'pointercancel'
  | 'pointerleave'
  | 'lostpointercapture'
  | 'blur'
  | 'multi-touch'
  | 'moved'
  | 'cancel';

export interface HoldSchedule {
  setTimeout: (fn: () => void, ms: number) => unknown;
  clearTimeout: (handle: unknown) => void;
  setInterval: (fn: () => void, ms: number) => unknown;
  clearInterval: (handle: unknown) => void;
}

export interface HoldTimerOptions {
  durationMs?: number;
  /** Progress resolution. */
  tickMs?: number;
  /** 0..1; called with 0 on start, 1 on completion, 0 on cancel. */
  onProgress?: (fraction: number) => void;
  /** Fires once, via a single timeout at exactly `durationMs`. */
  onComplete: () => void;
  onCancel?: (info: { reason: HoldCancelReason; heldMs: number }) => void;
  now?: () => number;
  schedule?: HoldSchedule;
}

export interface HoldTimer {
  /** Returns false when it cancels instead (a second pointer while holding). */
  start(pointerId: number): boolean;
  cancel(reason?: HoldCancelReason): void;
  readonly isHolding: boolean;
  /** True after a completion, reset by the next `start()`. */
  readonly completed: boolean;
}

// Resolve the globals at call time so fake timers installed after import still apply.
const globalSchedule: HoldSchedule = {
  setTimeout: (fn, ms) => globalThis.setTimeout(fn, ms),
  clearTimeout: (handle) => globalThis.clearTimeout(handle as ReturnType<typeof setTimeout>),
  setInterval: (fn, ms) => globalThis.setInterval(fn, ms),
  clearInterval: (handle) => globalThis.clearInterval(handle as ReturnType<typeof setInterval>),
};

export function createHoldTimer(options: HoldTimerOptions): HoldTimer {
  const durationMs = options.durationMs ?? HOLD_DURATION_MS;
  const tickMs = options.tickMs ?? DEFAULT_TICK_MS;
  const now = options.now ?? (() => Date.now());
  const schedule = options.schedule ?? globalSchedule;

  let holding = false;
  let completed = false;
  let pointerId: number | null = null;
  let startedAt = 0;
  let timeoutHandle: unknown = null;
  let intervalHandle: unknown = null;

  const clearHandles = (): void => {
    if (timeoutHandle !== null) schedule.clearTimeout(timeoutHandle);
    if (intervalHandle !== null) schedule.clearInterval(intervalHandle);
    timeoutHandle = null;
    intervalHandle = null;
  };

  const fraction = (): number => Math.min(1, Math.max(0, (now() - startedAt) / durationMs));

  const cancel = (reason: HoldCancelReason = 'cancel'): void => {
    if (!holding) return;
    const heldMs = now() - startedAt;
    clearHandles();
    holding = false;
    pointerId = null;
    options.onProgress?.(0);
    options.onCancel?.({ reason, heldMs });
  };

  return {
    start(id: number): boolean {
      if (holding) {
        if (id === pointerId) return true;
        cancel('multi-touch');
        return false;
      }
      holding = true;
      completed = false;
      pointerId = id;
      startedAt = now();
      options.onProgress?.(0);
      intervalHandle = schedule.setInterval(() => {
        if (holding) options.onProgress?.(fraction());
      }, tickMs);
      timeoutHandle = schedule.setTimeout(() => {
        clearHandles();
        holding = false;
        pointerId = null;
        completed = true;
        options.onProgress?.(1);
        options.onComplete();
      }, durationMs);
      return true;
    },
    cancel,
    get isHolding() {
      return holding;
    },
    get completed() {
      return completed;
    },
  };
}

export interface LongPressOptions {
  /** A short tap, or a keyboard / assistive click: opens the multiplication gate. */
  onTap: () => void;
  /** A continuous hold of `durationMs`. */
  onLongPress: () => void;
  durationMs?: number;
  tapMaxMs?: number;
  moveTolerancePx?: number;
}

/** Binds the long-press to a button. It owns the button's `click` listener. Returns a detach function. */
export function attachLongPress(button: HTMLElement, options: LongPressOptions): () => void {
  const tapMaxMs = options.tapMaxMs ?? TAP_MAX_MS;
  const tolerance = options.moveTolerancePx ?? MOVE_TOLERANCE_PX;

  const down = new Set<number>();
  let holdPointerId: number | null = null;
  let startX = 0;
  let startY = 0;
  let suppressClick = false;
  let suppressTimer: ReturnType<typeof setTimeout> | null = null;
  let progressEl: HTMLElement | null = null;
  let fillEl: HTMLElement | null = null;
  let detached = false;

  const removeProgress = (): void => {
    progressEl?.remove();
    progressEl = null;
    fillEl = null;
  };

  const showProgress = (fraction: number): void => {
    if (!progressEl) {
      progressEl = document.createElement('div');
      progressEl.className = 'shell-hold-progress';
      progressEl.dataset.testid = 'parent-gate-progress';
      progressEl.setAttribute('role', 'progressbar');
      progressEl.setAttribute('aria-valuemin', '0');
      progressEl.setAttribute('aria-valuemax', '100');
      fillEl = document.createElement('div');
      progressEl.appendChild(fillEl);
      button.appendChild(progressEl);
    }
    const percent = Math.round(fraction * 100);
    progressEl.setAttribute('aria-valuenow', String(percent));
    if (fillEl) fillEl.style.width = `${percent}%`;
  };

  const clearSuppressTimer = (): void => {
    if (suppressTimer !== null) clearTimeout(suppressTimer);
    suppressTimer = null;
  };

  const suppress = (): void => {
    suppressClick = true;
    clearSuppressTimer(); // the expiry starts when the pointer is released
  };

  const armSuppressExpiry = (): void => {
    if (!suppressClick) return;
    clearSuppressTimer();
    suppressTimer = setTimeout(() => {
      suppressClick = false;
      suppressTimer = null;
    }, CLICK_SUPPRESS_MS);
  };

  const clearSuppress = (): void => {
    suppressClick = false;
    clearSuppressTimer();
  };

  const timer = createHoldTimer({
    durationMs: options.durationMs,
    onProgress: (fraction) => {
      if (fraction > 0 || timer.isHolding) showProgress(fraction);
    },
    onComplete: () => {
      removeProgress();
      suppress(); // the click that follows the release must not open the multiplication gate
      options.onLongPress();
    },
    onCancel: ({ reason, heldMs }) => {
      removeProgress();
      holdPointerId = null;
      // A quick release is a tap: let its click through. Every other cancel swallows the trailing click.
      if (!(reason === 'release' && heldMs < tapMaxMs)) suppress();
    },
  });

  const onPointerDown = (e: PointerEvent): void => {
    if (e.button !== 0) return;
    clearSuppress();
    if (down.has(e.pointerId)) {
      // Stale entry (its pointerup went elsewhere): this is a fresh press of the same pointer.
      timer.cancel('cancel');
      down.delete(e.pointerId);
    }
    if (down.size > 0) {
      // Another pointer is already down: never start, and cancel the hold in progress.
      down.add(e.pointerId);
      timer.cancel('multi-touch');
      suppress();
      return;
    }
    down.add(e.pointerId);
    holdPointerId = e.pointerId;
    startX = e.clientX;
    startY = e.clientY;
    timer.start(e.pointerId);
  };

  const onPointerMove = (e: PointerEvent): void => {
    if (!timer.isHolding || e.pointerId !== holdPointerId) return;
    if (Math.hypot(e.clientX - startX, e.clientY - startY) > tolerance) timer.cancel('moved');
  };

  const onPointerUp = (e: PointerEvent): void => {
    if (!down.delete(e.pointerId)) return;
    if (e.pointerId === holdPointerId) timer.cancel('release');
    holdPointerId = null;
    armSuppressExpiry();
  };

  const cancelWith = (reason: HoldCancelReason) => (): void => {
    timer.cancel(reason);
  };

  const onPointerCancel = (e: PointerEvent): void => {
    timer.cancel('pointercancel');
    down.delete(e.pointerId); // a cancelled pointer sends no click; suppression ends at the next pointerdown
  };

  const onContextMenu = (e: Event): void => {
    if (down.size > 0 || timer.isHolding) e.preventDefault();
  };

  const onClick = (e: Event): void => {
    if (suppressClick) {
      clearSuppress();
      e.preventDefault();
      e.stopImmediatePropagation();
      return;
    }
    options.onTap();
  };

  // The release may land outside the button (mouse) or the window may lose focus: clean up from the window.
  const onWindowPointerEnd = (e: PointerEvent): void => {
    if (!button.isConnected) return detach();
    down.delete(e.pointerId);
    if (e.type === 'pointerup') armSuppressExpiry();
  };

  const onWindowBlur = (): void => {
    if (!button.isConnected) return detach();
    timer.cancel('blur');
    down.clear();
    armSuppressExpiry();
  };

  const onButtonBlur = (): void => {
    timer.cancel('blur');
  };

  const onPointerLeave = cancelWith('pointerleave');
  const onLostCapture = cancelWith('lostpointercapture');

  button.classList.add('shell-holdable');
  button.addEventListener('pointerdown', onPointerDown);
  button.addEventListener('pointermove', onPointerMove);
  button.addEventListener('pointerup', onPointerUp);
  button.addEventListener('pointercancel', onPointerCancel);
  button.addEventListener('pointerleave', onPointerLeave);
  button.addEventListener('lostpointercapture', onLostCapture);
  button.addEventListener('blur', onButtonBlur);
  button.addEventListener('contextmenu', onContextMenu);
  button.addEventListener('click', onClick);
  window.addEventListener('pointerup', onWindowPointerEnd);
  window.addEventListener('pointercancel', onWindowPointerEnd);
  window.addEventListener('blur', onWindowBlur);

  function detach(): void {
    if (detached) return;
    detached = true;
    timer.cancel('cancel');
    clearSuppress();
    removeProgress();
    button.removeEventListener('pointerdown', onPointerDown);
    button.removeEventListener('pointermove', onPointerMove);
    button.removeEventListener('pointerup', onPointerUp);
    button.removeEventListener('pointercancel', onPointerCancel);
    button.removeEventListener('pointerleave', onPointerLeave);
    button.removeEventListener('lostpointercapture', onLostCapture);
    button.removeEventListener('blur', onButtonBlur);
    button.removeEventListener('contextmenu', onContextMenu);
    button.removeEventListener('click', onClick);
    window.removeEventListener('pointerup', onWindowPointerEnd);
    window.removeEventListener('pointercancel', onWindowPointerEnd);
    window.removeEventListener('blur', onWindowBlur);
    button.classList.remove('shell-holdable');
  }

  return detach;
}

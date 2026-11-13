/**
 * Pure decision helpers for when a waiting service-worker update may reload the page.
 * Kept free of `virtual:pwa-register` so unit tests can import this module in isolation.
 */

/** Screens the child (or parent) can be on. */
export type AppScreen = 'profile' | 'map' | 'restaurant' | 'hiding' | 'bubbles' | 'orchestra' | 'sorting' | 'colouring' | 'stickers' | 'parent' | 'loading';

/** sessionStorage key written just before a PWA-driven reload, to prevent a reload loop. */
export const PWA_RELOAD_GUARD_KEY = 'kids-app-pwa-reloaded';

/** How often an open app asks the browser to check for a new service worker. */
export const PWA_UPDATE_INTERVAL_MS = 30 * 60 * 1000;

/**
 * After a PWA reload, ignore a spurious `onNeedRefresh` for this long so the newly
 * activated worker is not mistaken for another waiting update.
 */
export const PWA_STARTUP_GUARD_MS = 5_000;

export type PwaUpdateDecision = 'apply' | 'defer' | 'skip';

export interface PwaUpdateState {
  /** A new service worker is waiting to activate. */
  updateAvailable: boolean;
  screen: AppScreen;
  /** True during the short window after this page load was itself a PWA reload. */
  startupGuardActive: boolean;
  /** An apply/reload is already in flight. */
  applyInFlight: boolean;
}

/** Profile select and the world map are safe; games, parent area, and loading are not. */
export function isSafeToApplyUpdate(screen: AppScreen): boolean {
  return screen === 'profile' || screen === 'map';
}

/**
 * Decide what to do when we know (or have just learned) that an update is waiting.
 * - `apply`: reload now (caller persists first).
 * - `defer`: wait until the user returns to a safe screen.
 * - `skip`: do nothing (no update, already reloading, or just finished a PWA reload).
 */
export function decidePwaUpdate(state: PwaUpdateState): PwaUpdateDecision {
  if (!state.updateAvailable || state.startupGuardActive || state.applyInFlight) return 'skip';
  return isSafeToApplyUpdate(state.screen) ? 'apply' : 'defer';
}

export function readReloadGuard(
  storage: Pick<Storage, 'getItem' | 'removeItem'>,
  nowMs: number,
  guardMs: number = PWA_STARTUP_GUARD_MS,
): number {
  if (storage.getItem(PWA_RELOAD_GUARD_KEY) !== '1') return 0;
  storage.removeItem(PWA_RELOAD_GUARD_KEY);
  return nowMs + guardMs;
}

export function writeReloadGuard(storage: Pick<Storage, 'setItem'>): void {
  storage.setItem(PWA_RELOAD_GUARD_KEY, '1');
}

export function isStartupGuardActive(guardUntilMs: number, nowMs: number): boolean {
  return nowMs < guardUntilMs;
}

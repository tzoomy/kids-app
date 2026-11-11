import { registerSW } from 'virtual:pwa-register';
import { PwaAutoUpdate } from './pwa/autoUpdate';
import type { AppScreen } from './pwa/updatePolicy';

export type { AppScreen } from './pwa/updatePolicy';

const controller = new PwaAutoUpdate({
  registerSW,
  storage: sessionStorage,
  document,
  setInterval: (handler, timeout) => window.setInterval(handler, timeout),
  clearInterval: (id) => window.clearInterval(id as number),
  now: () => Date.now(),
});

/** Register a persist hook so balances and progress are flushed before a reload. */
export function setPersistBeforePwaUpdate(fn: () => void): void {
  controller.setPersist(fn);
}

/** Register the service worker and start auto-update checks. */
export function initPwa(): void {
  controller.init();
}

/** Tell the update controller which screen is visible so it can apply or defer. */
export function setAppScreen(screen: AppScreen): void {
  controller.setScreen(screen);
}

export function pwaNeedsRefresh(): boolean {
  return controller.needsRefresh();
}

/** Parent-area fallback: apply a waiting update immediately, even from the parent screen. */
export async function applyPwaUpdate(): Promise<void> {
  await controller.applyUpdate();
}

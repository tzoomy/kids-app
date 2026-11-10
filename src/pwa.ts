import { registerSW } from 'virtual:pwa-register';

let needsRefresh = false;
let updateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;

/** Register the service worker and remember when a new version is waiting (no mid-game skipWaiting). */
export function initPwa(): void {
  updateFn = registerSW({
    immediate: true,
    onNeedRefresh() {
      needsRefresh = true;
    },
  });
}

export function pwaNeedsRefresh(): boolean {
  return needsRefresh;
}

export async function applyPwaUpdate(): Promise<void> {
  await updateFn?.(true);
}

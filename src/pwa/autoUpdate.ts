import {
  decidePwaUpdate,
  isStartupGuardActive,
  readReloadGuard,
  writeReloadGuard,
  PWA_RELOAD_GUARD_KEY,
  PWA_UPDATE_INTERVAL_MS,
  type AppScreen,
} from './updatePolicy';

export type RegisterSW = (options: {
  immediate?: boolean;
  onNeedRefresh?: () => void;
  onRegisteredSW?: (swScriptUrl: string, registration?: ServiceWorkerRegistration) => void;
}) => (reloadPage?: boolean) => Promise<void>;

export interface PwaAutoUpdateDeps {
  registerSW: RegisterSW;
  storage: Pick<Storage, 'getItem' | 'setItem' | 'removeItem'>;
  document: Pick<Document, 'visibilityState' | 'addEventListener' | 'removeEventListener'>;
  setInterval: (handler: () => void, timeout: number) => unknown;
  clearInterval: (id: unknown) => void;
  now: () => number;
  updateIntervalMs?: number;
}

/**
 * Coordinates service-worker updates: apply immediately on a safe screen, otherwise
 * defer until the child returns to the profile or map screen. Never reloads mid-game.
 */
export class PwaAutoUpdate {
  private updateAvailable = false;
  private applyInFlight = false;
  private screen: AppScreen = 'profile';
  private guardUntilMs = 0;
  private updateFn: ((reloadPage?: boolean) => Promise<void>) | null = null;
  private persist: () => void = () => undefined;
  private registration: ServiceWorkerRegistration | undefined;
  private intervalId: unknown = null;
  private started = false;
  private readonly visibilityHandler: () => void;
  private readonly deps: PwaAutoUpdateDeps;
  private readonly updateIntervalMs: number;

  constructor(deps: PwaAutoUpdateDeps) {
    this.deps = deps;
    this.updateIntervalMs = deps.updateIntervalMs ?? PWA_UPDATE_INTERVAL_MS;
    this.visibilityHandler = () => {
      if (this.deps.document.visibilityState !== 'visible') return;
      void this.registration?.update();
      void this.tryApply();
    };
  }

  setPersist(fn: () => void): void {
    this.persist = fn;
  }

  init(): void {
    if (this.started) return;
    this.started = true;
    this.guardUntilMs = readReloadGuard(this.deps.storage, this.deps.now());

    this.updateFn = this.deps.registerSW({
      immediate: true,
      onNeedRefresh: () => {
        if (isStartupGuardActive(this.guardUntilMs, this.deps.now())) {
          // Spurious event from the worker we just activated — do not arm a second reload.
          return;
        }
        this.updateAvailable = true;
        void this.tryApply();
      },
      onRegisteredSW: (_url, registration) => {
        this.registration = registration;
        this.startPolling();
      },
    });

    this.deps.document.addEventListener('visibilitychange', this.visibilityHandler);
  }

  setScreen(screen: AppScreen): void {
    this.screen = screen;
    void this.tryApply();
  }

  needsRefresh(): boolean {
    return this.updateAvailable && !isStartupGuardActive(this.guardUntilMs, this.deps.now());
  }

  /** Manual apply (parent-area button). Ignores the current screen but still uses the loop guard. */
  async applyUpdate(): Promise<void> {
    if (!this.updateAvailable || this.applyInFlight) return;
    if (isStartupGuardActive(this.guardUntilMs, this.deps.now())) return;
    await this.reloadNow();
  }

  dispose(): void {
    if (this.intervalId !== null) {
      this.deps.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    this.deps.document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

  private startPolling(): void {
    if (this.intervalId !== null) {
      this.deps.clearInterval(this.intervalId);
      this.intervalId = null;
    }
    if (!this.registration) return;
    this.intervalId = this.deps.setInterval(() => {
      void this.registration?.update();
    }, this.updateIntervalMs);
  }

  private decision() {
    return decidePwaUpdate({
      updateAvailable: this.updateAvailable,
      screen: this.screen,
      startupGuardActive: isStartupGuardActive(this.guardUntilMs, this.deps.now()),
      applyInFlight: this.applyInFlight,
    });
  }

  private async tryApply(): Promise<void> {
    if (this.decision() !== 'apply') return;
    await this.reloadNow();
  }

  private async reloadNow(): Promise<void> {
    if (this.applyInFlight) return;
    this.applyInFlight = true;
    try {
      this.persist();
      writeReloadGuard(this.deps.storage);
      await this.updateFn?.(true);
    } catch {
      this.applyInFlight = false;
      // Leave the guard in place only if we actually asked the SW to skip waiting.
      // If the update call failed before a reload, drop the guard so a later attempt can proceed.
      this.deps.storage.removeItem(PWA_RELOAD_GUARD_KEY);
    }
  }
}

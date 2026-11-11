import { describe, expect, it, vi, afterEach } from 'vitest';
import { PwaAutoUpdate, type RegisterSW } from '@/pwa/autoUpdate';
import { PWA_RELOAD_GUARD_KEY, PWA_STARTUP_GUARD_MS } from '@/pwa/updatePolicy';

interface Harness {
  controller: PwaAutoUpdate;
  persist: ReturnType<typeof vi.fn>;
  updateFn: ReturnType<typeof vi.fn>;
  registration: { update: ReturnType<typeof vi.fn> };
  fireNeedRefresh: () => void;
  storage: Storage;
  document: Document;
  setNow: (ms: number) => void;
  intervalHandler: (() => void) | null;
}

function memoryStorage(initial: Record<string, string> = {}): Storage {
  const map = new Map(Object.entries(initial));
  return {
    get length() {
      return map.size;
    },
    clear: () => map.clear(),
    getItem: (key) => map.get(key) ?? null,
    setItem: (key, value) => {
      map.set(key, value);
    },
    removeItem: (key) => {
      map.delete(key);
    },
    key: (index) => [...map.keys()][index] ?? null,
  };
}

function createHarness(opts: { guard?: boolean; now?: number } = {}): Harness {
  let now = opts.now ?? 10_000;
  const storage = memoryStorage(opts.guard ? { [PWA_RELOAD_GUARD_KEY]: '1' } : {});
  const persist = vi.fn();
  const updateFn = vi.fn().mockResolvedValue(undefined);
  const registration = { update: vi.fn().mockResolvedValue(undefined) };
  const hooks = {
    fireNeedRefresh: (): void => undefined,
    fireRegistered: (_reg: typeof registration): void => undefined,
  };
  let intervalHandler: (() => void) | null = null;

  const registerSW: RegisterSW = (options) => {
    hooks.fireNeedRefresh = () => options.onNeedRefresh?.();
    hooks.fireRegistered = (reg) => options.onRegisteredSW?.('/sw.js', reg as unknown as ServiceWorkerRegistration);
    return updateFn;
  };

  const controller = new PwaAutoUpdate({
    registerSW,
    storage,
    document,
    setInterval: (handler) => {
      intervalHandler = handler;
      return 1;
    },
    clearInterval: vi.fn(),
    now: () => now,
    updateIntervalMs: 30 * 60 * 1000,
  });
  controller.setPersist(persist);
  controller.init();
  hooks.fireRegistered(registration);

  return {
    controller,
    persist,
    updateFn,
    registration,
    fireNeedRefresh: () => hooks.fireNeedRefresh(),
    storage,
    document,
    setNow: (ms) => {
      now = ms;
    },
    intervalHandler,
  };
}

afterEach(() => {
  vi.restoreAllMocks();
});

describe('PwaAutoUpdate', () => {
  it('applies immediately when an update arrives on the profile or map screen', async () => {
    const h = createHarness();
    h.controller.setScreen('profile');
    h.fireNeedRefresh();
    await vi.waitFor(() => expect(h.updateFn).toHaveBeenCalledWith(true));
    expect(h.persist).toHaveBeenCalled();
    expect(h.storage.getItem(PWA_RELOAD_GUARD_KEY)).toBe('1');
    h.controller.dispose();
  });

  it('defers while in the restaurant and applies when the user returns to the map', async () => {
    const h = createHarness();
    h.controller.setScreen('restaurant');
    h.fireNeedRefresh();
    await Promise.resolve();
    expect(h.updateFn).not.toHaveBeenCalled();
    expect(h.controller.needsRefresh()).toBe(true);

    h.controller.setScreen('map');
    await vi.waitFor(() => expect(h.updateFn).toHaveBeenCalledWith(true));
    expect(h.persist).toHaveBeenCalled();
    h.controller.dispose();
  });

  it('defers during bubbles and the parent area until the profile screen', async () => {
    const h = createHarness();
    h.controller.setScreen('bubbles');
    h.fireNeedRefresh();
    await Promise.resolve();
    expect(h.updateFn).not.toHaveBeenCalled();

    h.controller.setScreen('parent');
    await Promise.resolve();
    expect(h.updateFn).not.toHaveBeenCalled();

    h.controller.setScreen('profile');
    await vi.waitFor(() => expect(h.updateFn).toHaveBeenCalledTimes(1));
    h.controller.dispose();
  });

  it('does not auto-reload on the first launch after an update (startup guard)', async () => {
    const h = createHarness({ guard: true, now: 1_000 });
    h.controller.setScreen('profile');
    h.fireNeedRefresh();
    await Promise.resolve();
    expect(h.updateFn).not.toHaveBeenCalled();
    expect(h.controller.needsRefresh()).toBe(false);
    expect(h.storage.getItem(PWA_RELOAD_GUARD_KEY)).toBeNull();

    // After the guard expires, a later genuine update can still apply.
    h.setNow(1_000 + PWA_STARTUP_GUARD_MS);
    h.fireNeedRefresh();
    await vi.waitFor(() => expect(h.updateFn).toHaveBeenCalledWith(true));
    h.controller.dispose();
  });

  it('manual parent-area apply works even on the parent screen, after persist', async () => {
    const h = createHarness();
    h.controller.setScreen('parent');
    h.fireNeedRefresh();
    await Promise.resolve();
    expect(h.updateFn).not.toHaveBeenCalled();

    await h.controller.applyUpdate();
    expect(h.persist).toHaveBeenCalled();
    expect(h.updateFn).toHaveBeenCalledWith(true);
    h.controller.dispose();
  });

  it('does not apply twice while a reload is in flight', async () => {
    let release: () => void = () => undefined;
    const h = createHarness();
    h.updateFn.mockReturnValue(new Promise<void>((resolve) => {
      release = resolve;
    }));
    h.controller.setScreen('profile');
    h.fireNeedRefresh();
    h.controller.setScreen('map');
    await Promise.resolve();
    expect(h.updateFn).toHaveBeenCalledTimes(1);
    release();
    await Promise.resolve();
    h.controller.dispose();
  });

  it('checks for updates when the app becomes visible and on the periodic interval', async () => {
    const h = createHarness();
    h.controller.setScreen('restaurant');
    document.dispatchEvent(new Event('visibilitychange'));
    // jsdom visibilityState stays 'visible' by default
    expect(h.registration.update).toHaveBeenCalled();

    h.registration.update.mockClear();
    h.intervalHandler?.();
    expect(h.registration.update).toHaveBeenCalled();
    h.controller.dispose();
  });

  it('persists balances before reload so a mid-session tick is not lost', async () => {
    const h = createHarness();
    let persisted = false;
    h.controller.setPersist(() => {
      persisted = true;
    });
    h.updateFn.mockImplementation(async () => {
      expect(persisted).toBe(true);
    });
    h.controller.setScreen('map');
    h.fireNeedRefresh();
    await vi.waitFor(() => expect(h.updateFn).toHaveBeenCalled());
    h.controller.dispose();
  });
});

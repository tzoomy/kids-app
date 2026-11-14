// The early ?e2e=1 hooks exist before the engine chunk (Phaser, createGame) has loaded. The e2e helpers poll
// window.__testHooks__.getActiveScenes() right after a profile tap, so it must exist and say "no scene yet".
import { afterEach, describe, expect, it, vi } from 'vitest';
import { installEarlyTimeEarningHook } from '../../src/game/e2eBoot';
import type { Store } from '../../src/core/storage/store';

function fakeStore() {
  const state = { settings: { timeEarning: { enabled: false } } };
  const persist = vi.fn();
  return { store: { getState: () => state, persist } as unknown as Store, state, persist };
}

function setQuery(search: string): void {
  window.history.replaceState(null, '', `/${search}`);
}

afterEach(() => {
  delete window.__testHooks__;
  setQuery('');
});

describe('installEarlyTimeEarningHook (pre-engine e2e hooks)', () => {
  it('installs nothing without ?e2e=1', () => {
    setQuery('');
    installEarlyTimeEarningHook(fakeStore().store);
    expect(window.__testHooks__).toBeUndefined();
  });

  it('with ?e2e=1, getActiveScenes already exists and reports no active scene while the engine is not loaded', () => {
    setQuery('?e2e=1');
    installEarlyTimeEarningHook(fakeStore().store);
    expect(typeof window.__testHooks__?.getActiveScenes).toBe('function');
    expect(window.__testHooks__?.getActiveScenes()).toEqual([]);
  });

  it('keeps seedTimeEarningEnabled and seedWardrobeStateForProfile working before the engine loads', () => {
    setQuery('?e2e=1');
    const { store, state, persist } = fakeStore();
    installEarlyTimeEarningHook(store);
    window.__testHooks__?.seedTimeEarningEnabled(true);
    expect(state.settings.timeEarning).toEqual({ enabled: true });
    expect(persist).toHaveBeenCalledTimes(1);
    expect(typeof window.__testHooks__?.seedWardrobeStateForProfile).toBe('function');
  });

  it('does not replace a real getActiveScenes that is already installed', () => {
    setQuery('?e2e=1');
    const real = () => ['MapScene'];
    window.__testHooks__ = { getActiveScenes: real } as unknown as NonNullable<Window['__testHooks__']>;
    installEarlyTimeEarningHook(fakeStore().store);
    expect(window.__testHooks__?.getActiveScenes()).toEqual(['MapScene']);
  });
});

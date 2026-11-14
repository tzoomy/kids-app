import { describe, expect, it } from 'vitest';
import {
  decidePwaUpdate,
  isSafeToApplyUpdate,
  isStartupGuardActive,
  readReloadGuard,
  writeReloadGuard,
  PWA_RELOAD_GUARD_KEY,
  PWA_STARTUP_GUARD_MS,
  type AppScreen,
  type PwaUpdateState,
} from '@/pwa/updatePolicy';

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

const base: PwaUpdateState = {
  updateAvailable: true,
  screen: 'profile',
  startupGuardActive: false,
  applyInFlight: false,
};

describe('isSafeToApplyUpdate', () => {
  const cases: Array<[AppScreen, boolean]> = [
    ['profile', true],
    ['map', true],
    ['restaurant', false],
    ['bubbles', false],
    ['orchestra', false],
    ['hiding', false],
    ['sorting', false],
    ['picnic', false],
    ['habitat', false],
    ['colouring', false],
    ['shadow', false],
    ['letter-monster', false],
    ['balloon', false],
    ['magic-magnet', false],
    ['travel-suitcase', false],
    ['seed-flower', false],
    ['potion-lab', false],
    ['wardrobe', false],
    ['sink-or-float', false],
    ['parent', false],
    ['loading', false],
  ];

  it.each(cases)('%s → %s', (screen, expected) => {
    expect(isSafeToApplyUpdate(screen)).toBe(expected);
  });
});

describe('decidePwaUpdate', () => {
  it('applies on the profile-select screen or the world map', () => {
    expect(decidePwaUpdate({ ...base, screen: 'profile' })).toBe('apply');
    expect(decidePwaUpdate({ ...base, screen: 'map' })).toBe('apply');
  });

  it('defers while inside a game, the parent area, or loading', () => {
    expect(decidePwaUpdate({ ...base, screen: 'restaurant' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'bubbles' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'orchestra' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'hiding' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'sorting' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'picnic' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'habitat' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'colouring' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'letter-monster' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'balloon' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'potion-lab' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'sink-or-float' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'magic-magnet' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'travel-suitcase' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'parent' })).toBe('defer');
    expect(decidePwaUpdate({ ...base, screen: 'loading' })).toBe('defer');
  });

  it('skips when no update is waiting', () => {
    expect(decidePwaUpdate({ ...base, updateAvailable: false, screen: 'profile' })).toBe('skip');
    expect(decidePwaUpdate({ ...base, updateAvailable: false, screen: 'restaurant' })).toBe('skip');
    expect(decidePwaUpdate({ ...base, updateAvailable: false, screen: 'hiding' })).toBe('skip');
  });

  it('skips during the post-reload startup guard so the first launch does not loop', () => {
    expect(decidePwaUpdate({ ...base, screen: 'profile', startupGuardActive: true })).toBe('skip');
    expect(decidePwaUpdate({ ...base, screen: 'map', startupGuardActive: true })).toBe('skip');
  });

  it('skips when an apply is already in flight', () => {
    expect(decidePwaUpdate({ ...base, applyInFlight: true })).toBe('skip');
  });
});

describe('reload guard', () => {
  it('writes, then reads once and starts a startup window', () => {
    const storage = memoryStorage();
    writeReloadGuard(storage);
    expect(storage.getItem(PWA_RELOAD_GUARD_KEY)).toBe('1');

    const until = readReloadGuard(storage, 1_000);
    expect(until).toBe(1_000 + PWA_STARTUP_GUARD_MS);
    expect(storage.getItem(PWA_RELOAD_GUARD_KEY)).toBeNull();
    expect(isStartupGuardActive(until, 1_000)).toBe(true);
    expect(isStartupGuardActive(until, until - 1)).toBe(true);
    expect(isStartupGuardActive(until, until)).toBe(false);
  });

  it('returns 0 when no guard is present', () => {
    expect(readReloadGuard(memoryStorage(), 5_000)).toBe(0);
    expect(isStartupGuardActive(0, 5_000)).toBe(false);
  });
});

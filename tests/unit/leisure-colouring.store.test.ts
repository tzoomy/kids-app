// Autosave store contract (AC-19) and seed-hook writer (AC-28).
import { describe, it, expect } from 'vitest';
import { loadColouringState, saveColouringState, colouringKey, COLOURING_KEY_PREFIX } from '../../src/core/colouring/store';
import { writeColouringSeed } from '../../src/core/colouring/seed';

class MemoryStorage {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  keys(): string[] {
    return [...this.data.keys()];
  }
}

describe('leisure-colouring store', () => {
  it('[AC-19] the store reads and writes only kids-app-colouring:<profileId> in { v: 1, currentPageId, pages } form; no ProfileState key; no cross-profile leak; corrupt or unknown-version or unknown region ids load as empty without throwing', () => {
    const storage = new MemoryStorage();
    const profile = 'profile-a';
    const other = 'profile-b';
    expect(colouringKey(profile)).toBe(`${COLOURING_KEY_PREFIX}${profile}`);

    saveColouringState(storage, profile, {
      v: 1,
      currentPageId: 'cat',
      pages: { cat: { 'cat-body': 'red', 'unknown-region': 'blue' } },
    });
    expect(storage.keys()).toEqual([colouringKey(profile)]);
    expect(storage.keys().some((k) => k.includes('kids-app-state-v2'))).toBe(false);

    const loaded = loadColouringState(storage, profile);
    expect(loaded.v).toBe(1);
    expect(loaded.currentPageId).toBe('cat');
    expect(loaded.pages.cat).toEqual({ 'cat-body': 'red' }); // unknown region dropped
    expect(loadColouringState(storage, other)).toEqual({ v: 1, currentPageId: expect.any(String), pages: {} });

    storage.setItem(colouringKey(profile), '{not json');
    expect(() => loadColouringState(storage, profile)).not.toThrow();
    expect(loadColouringState(storage, profile).pages).toEqual({});

    storage.setItem(colouringKey(profile), JSON.stringify({ v: 99, currentPageId: 'cat', pages: { cat: { 'cat-body': 'red' } } }));
    expect(() => loadColouringState(storage, profile)).not.toThrow();
    expect(loadColouringState(storage, profile).pages).toEqual({});
  });

  it('[AC-28] writeColouringSeed writes only the autosave key and does not navigate or touch the balance', () => {
    const storage = new MemoryStorage();
    writeColouringSeed(storage, 'profile-a', { pageId: 'dog', fills: { 'dog-body': 'blue' } });
    expect(storage.keys()).toEqual([colouringKey('profile-a')]);
    const parsed = JSON.parse(storage.getItem(colouringKey('profile-a'))!) as { v: number; currentPageId: string; pages: Record<string, Record<string, string>> };
    expect(parsed).toEqual({ v: 1, currentPageId: 'dog', pages: { dog: { 'dog-body': 'blue' } } });
  });
});

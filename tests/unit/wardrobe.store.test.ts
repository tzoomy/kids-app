// Wardrobe persistence (docs/specs/wardrobe.md, AC-04). Injectable StorageDriver, no Phaser.
// RED until src/core/wardrobe/store.ts and model.ts exist.
import { describe, expect, it } from 'vitest';
import {
  WARDROBE_KEY_PREFIX,
  loadWardrobeState,
  recordRoundAndSave,
  saveWardrobeState,
  wardrobeKey,
} from '@/core/wardrobe/store';
import { createWardrobeState, equipItem } from '@/core/wardrobe/model';
import type { StorageDriver } from '@/core/storage/store';

class MemoryStorage implements StorageDriver {
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

describe('wardrobe store', () => {
  it('[AC-04] the key is kids-app-wardrobe:<profileId> and a missing payload loads the defaults', () => {
    const storage = new MemoryStorage();
    expect(wardrobeKey('a')).toBe(`${WARDROBE_KEY_PREFIX}a`);
    expect(WARDROBE_KEY_PREFIX).toBe('kids-app-wardrobe:');
    expect(loadWardrobeState(storage, 'a')).toEqual(createWardrobeState());
    expect(loadWardrobeState(storage, 'a').unlocked).toEqual(['flower-clip']);
    expect(loadWardrobeState(storage, 'a').outfit).toEqual({});
  });

  it('[AC-04] unlocks, worn outfit and history round-trip, and only the wardrobe key is written', () => {
    const storage = new MemoryStorage();
    const first = recordRoundAndSave(storage, 'a', 'age5', { worldId: 'language-house', gameId: 'animal-restaurant' });
    expect(first.newlyUnlocked).toEqual(['beanie']);
    saveWardrobeState(storage, 'a', equipItem(first.state, 'age5', 'beanie'));

    expect(storage.keys()).toEqual([wardrobeKey('a')]);
    const loaded = loadWardrobeState(storage, 'a');
    expect([...loaded.unlocked].sort()).toEqual(['beanie', 'flower-clip']);
    expect(loaded.outfit).toEqual({ head: 'beanie' });
    expect(loaded.completed).toEqual({ 'language-house': ['animal-restaurant'] });
  });

  it('[AC-04] recordRoundAndSave persists the progress so a later load still has sun-hat history', () => {
    const storage = new MemoryStorage();
    recordRoundAndSave(storage, 'b', 'age5', { worldId: 'language-house', gameId: 'animal-restaurant' });
    recordRoundAndSave(storage, 'b', 'age5', { worldId: 'language-house', gameId: 'kitchen-orchestra' });
    const third = recordRoundAndSave(storage, 'b', 'age5', { worldId: 'language-house', gameId: 'letter-monster' });
    expect(third.newlyUnlocked).toEqual(['sun-hat']);
    expect(loadWardrobeState(storage, 'b').unlocked).toContain('sun-hat');
  });

  it('[AC-04] profiles never mix: another profile keeps the defaults', () => {
    const storage = new MemoryStorage();
    recordRoundAndSave(storage, 'a', 'age2', { worldId: 'number-garden', gameId: 'sorting-beds' });
    saveWardrobeState(storage, 'a', equipItem(loadWardrobeState(storage, 'a'), 'age2', 'scarf'));

    expect(loadWardrobeState(storage, 'a').unlocked).toContain('scarf');
    expect(loadWardrobeState(storage, 'b')).toEqual(createWardrobeState());
    expect(storage.keys()).toEqual([wardrobeKey('a')]);

    recordRoundAndSave(storage, 'b', 'age5', { worldId: 'language-house', gameId: 'animal-restaurant' });
    expect(loadWardrobeState(storage, 'a').unlocked).not.toContain('beanie');
    expect(loadWardrobeState(storage, 'a').outfit).toEqual({ neck: 'scarf' });
    expect(storage.keys().sort()).toEqual([wardrobeKey('a'), wardrobeKey('b')]);
  });

  it('[AC-04] never touches the leisure or adaptive keys', () => {
    const storage = new MemoryStorage();
    recordRoundAndSave(storage, 'a', 'age5', { worldId: 'nature-lab', gameId: 'who-is-hiding' });
    expect(storage.keys().every((k) => k.startsWith(WARDROBE_KEY_PREFIX))).toBe(true);
  });

  it('[AC-04] corrupt JSON, a non-object payload and an unknown version load the defaults without throwing', () => {
    const storage = new MemoryStorage();
    for (const raw of ['{not json', '42', 'null', '"text"', JSON.stringify({ v: 99, unlocked: ['beanie'] }), JSON.stringify({ unlocked: ['beanie'] })]) {
      storage.setItem(wardrobeKey('a'), raw);
      expect(() => loadWardrobeState(storage, 'a'), raw).not.toThrow();
      expect(loadWardrobeState(storage, 'a'), raw).toEqual(createWardrobeState());
    }
  });

  it('[AC-04] a partly invalid payload keeps the valid fields and drops the rest: unknown ids, wrong slots, locked worn items, the starter is always unlocked', () => {
    const storage = new MemoryStorage();
    storage.setItem(
      wardrobeKey('a'),
      JSON.stringify({
        v: 1,
        unlocked: ['beanie', 'top-hat', 42, 'beanie'],
        outfit: { head: 'beanie', headSide: 'beanie', eyes: 'glasses', neck: 'nope', bogusSlot: 'scarf' },
        completed: { 'language-house': ['animal-restaurant', 7, 'animal-restaurant'], 'leisure-corner': ['bubbles'] },
      }),
    );
    const loaded = loadWardrobeState(storage, 'a');
    expect([...loaded.unlocked].sort()).toEqual(['beanie', 'flower-clip']);
    // head: beanie is unlocked and fits the slot. headSide: beanie is the wrong slot. eyes: glasses is locked. neck/bogusSlot: unknown.
    expect(loaded.outfit).toEqual({ head: 'beanie' });
    expect(loaded.completed['language-house']).toEqual(['animal-restaurant']);
    expect(loaded.completed['leisure-corner'] ?? []).toEqual([]);
  });

  it('[AC-04] a payload without the starter still loads with flower-clip unlocked', () => {
    const storage = new MemoryStorage();
    storage.setItem(wardrobeKey('a'), JSON.stringify({ v: 1, unlocked: [], outfit: {}, completed: {} }));
    expect(loadWardrobeState(storage, 'a').unlocked).toEqual(['flower-clip']);
  });

  it('[AC-04] saving a state with unknown ids writes only known ones (sanitised on save)', () => {
    const storage = new MemoryStorage();
    const state = { ...createWardrobeState(), unlocked: ['flower-clip', 'ghost'], outfit: { head: 'ghost' } };
    saveWardrobeState(storage, 'a', state);
    const raw = JSON.parse(storage.getItem(wardrobeKey('a'))!) as { v: number; unlocked: string[]; outfit: Record<string, string> };
    expect(raw.v).toBe(1);
    expect(raw.unlocked).toEqual(['flower-clip']);
    expect(raw.outfit).toEqual({});
  });
});

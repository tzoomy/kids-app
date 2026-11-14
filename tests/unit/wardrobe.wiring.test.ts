// Round-completion hook (docs/specs/wardrobe.md, AC-13): AppContext.recordCompletedRound(world, gameId).
// RED until AppContext.recordCompletedRound and src/core/wardrobe exist. No Phaser; the shell and audio are stubs.
import { beforeEach, describe, expect, it, vi } from 'vitest';
import { AppContext } from '@/game/appContext';
import { Store, type StorageDriver } from '@/core/storage/store';
import { loadWardrobeState } from '@/core/wardrobe/store';

class MemoryStorage implements StorageDriver {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
}

/** Any shell method is a harmless spy (the unlock toast lives in the shell). */
function stubShell(): never {
  return new Proxy({}, { get: () => vi.fn() }) as never;
}

function makeContext(driver: StorageDriver) {
  const yay = vi.fn();
  const context = new AppContext(
    new Store(driver),
    {} as never,
    { yay } as never,
    {} as never,
    stubShell(),
    () => Date.now(),
    driver,
  );
  return { context, yay };
}

describe('wardrobe round-completion hook', () => {
  beforeEach(() => {
    localStorage.clear();
  });

  it('[AC-13] records a completed round for the current profile, persists it, and returns the newly unlocked ids', () => {
    const { context } = makeContext(new MemoryStorage());
    context.currentProfileId = 'b'; // age5
    const unlockedNow = context.recordCompletedRound('language-house', 'animal-restaurant');
    expect(unlockedNow).toEqual(['beanie']);
    // The store is read from the same place the Wardrobe scene reads it.
    const saved = loadWardrobeState(localStorage, 'b');
    expect(saved.unlocked).toContain('beanie');
    expect(saved.completed['language-house']).toEqual(['animal-restaurant']);
  });

  it('[AC-13] age 5 unlocks hair-bow after a completed Sticker Board (Art Studio) round', () => {
    const { context } = makeContext(new MemoryStorage());
    context.currentProfileId = 'b'; // age5
    expect(context.recordCompletedRound('art-studio', 'sticker-board')).toEqual(['hair-bow']);
    expect(loadWardrobeState(localStorage, 'b').unlocked).toContain('hair-bow');
    expect(loadWardrobeState(localStorage, 'b').completed['art-studio']).toEqual(['sticker-board']);
  });

  it('[AC-13] uses the current profile age track: age 2 does not get age-5 items from the same event', () => {
    const { context } = makeContext(new MemoryStorage());
    context.currentProfileId = 'a'; // age2
    expect(context.recordCompletedRound('art-studio', 'sticker-board')).toEqual([]);
    expect(context.recordCompletedRound('science-world', 'potion-lab')).toEqual([]);
    expect(loadWardrobeState(localStorage, 'a').unlocked).toEqual(['flower-clip']);
  });

  it('[AC-13] plays the yay sound only when something new unlocked', () => {
    const { context, yay } = makeContext(new MemoryStorage());
    context.currentProfileId = 'a';
    context.recordCompletedRound('number-garden', 'sorting-beds');
    expect(yay).toHaveBeenCalledTimes(1);
    context.recordCompletedRound('number-garden', 'sorting-beds'); // already unlocked
    context.recordCompletedRound('leisure-corner', 'bubbles'); // never counts
    expect(yay).toHaveBeenCalledTimes(1);
  });

  it('[AC-13] never mixes profiles', () => {
    const { context } = makeContext(new MemoryStorage());
    context.currentProfileId = 'a';
    context.recordCompletedRound('nature-lab', 'who-is-hiding');
    expect(loadWardrobeState(localStorage, 'a').unlocked).toContain('party-hat');
    expect(loadWardrobeState(localStorage, 'b').unlocked).toEqual(['flower-clip']);
  });

  it('[AC-13] needs a selected profile, like the other session factories', () => {
    const { context } = makeContext(new MemoryStorage());
    expect(() => context.recordCompletedRound('language-house', 'animal-restaurant')).toThrow(/profile/i);
  });
});

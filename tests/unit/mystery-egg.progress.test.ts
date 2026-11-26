import { describe, expect, it } from 'vitest';
import {
  HEART_SLOT_COUNT,
  MYSTERY_EGG_SAVE_VERSION,
  completeMission,
  createProgress,
  eggLevel,
  litHearts,
  loadProgress,
  mysteryEggKey,
  nestTreasures,
  recordMissionAndSave,
  saveProgress,
} from '../../src/games/mysteryEgg/progress';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return {
    getItem: (k: string) => data.get(k) ?? null,
    setItem: (k: string, v: string) => void data.set(k, v),
    removeItem: (k: string) => void data.delete(k),
    data,
  };
}

describe('mystery-egg progress', () => {
  it('[AC-04] a new child has 5 empty heart slots, no treasure and a dim egg', () => {
    const p = createProgress();
    expect(HEART_SLOT_COUNT).toBe(5);
    expect(litHearts(p)).toEqual([]);
    expect(nestTreasures(p)).toEqual([]);
    expect(eggLevel(p)).toBe(0);
  });

  it('[AC-04] save then load round-trips under a versioned per-profile key', () => {
    const storage = memoryStorage();
    const done = completeMission(createProgress(), '1.1').progress;
    saveProgress(storage, 'profile-a', done);
    const raw = storage.getItem(mysteryEggKey('profile-a'));
    expect(raw).not.toBeNull();
    expect(JSON.parse(raw as string).v).toBe(MYSTERY_EGG_SAVE_VERSION);
    expect(loadProgress(storage, 'profile-a')).toEqual(done);
    // Another profile has its own, empty state.
    expect(loadProgress(storage, 'profile-b')).toEqual(createProgress());
    expect(mysteryEggKey('profile-a')).not.toBe(mysteryEggKey('profile-b'));
    expect(mysteryEggKey('profile-a')).toMatch(/mystery-egg/);
  });

  it('[AC-05] missing, corrupt, non-object, and wrong-version data falls back to the empty state without throwing', () => {
    const key = mysteryEggKey('p');
    for (const raw of [null, '', '{not json', 'null', '[]', '42', '"x"', JSON.stringify({ v: 99, completed: ['1.1'] }), JSON.stringify({ completed: ['1.1'] })]) {
      const storage = memoryStorage(raw === null ? {} : { [key]: raw });
      expect(loadProgress(storage, 'p'), String(raw)).toEqual(createProgress());
    }
  });

  it('[AC-05] wrong field types and unknown mission ids are repaired, keeping what is valid', () => {
    const key = mysteryEggKey('p');
    const storage = memoryStorage({ [key]: JSON.stringify({ v: 1, completed: ['1.1', '9.9', 7, null, '1.1', {}] }) });
    expect(loadProgress(storage, 'p').worlds.workshop.completed).toEqual([1]);
    const storage2 = memoryStorage({ [key]: JSON.stringify({ v: 1, completed: 'nope' }) });
    expect(loadProgress(storage2, 'p')).toEqual(createProgress());
  });

  it('[AC-05] a storage that throws never breaks load or save', () => {
    const broken = {
      getItem: () => {
        throw new Error('denied');
      },
      setItem: () => {
        throw new Error('quota');
      },
    };
    expect(loadProgress(broken, 'p')).toEqual(createProgress());
    expect(() => saveProgress(broken, 'p', createProgress())).not.toThrow();
  });

  it('[AC-06] completing mission 1.1 lights exactly 1 heart and one feather, and brightens the egg to level 1', () => {
    const res = completeMission(createProgress(), '1.1');
    expect(res.newlyCompleted).toBe(true);
    expect(litHearts(res.progress)).toEqual([0]);
    expect(nestTreasures(res.progress)).toEqual(['feather']);
    expect(eggLevel(res.progress)).toBe(1);
  });

  it('[AC-06] completing it again is idempotent: still 1 heart, same treasure and egg level', () => {
    const once = completeMission(createProgress(), '1.1').progress;
    const twice = completeMission(once, '1.1');
    expect(twice.newlyCompleted).toBe(false);
    expect(litHearts(twice.progress)).toEqual([0]);
    expect(twice.progress).toEqual(once);
  });

  it('[AC-06] recordMissionAndSave persists once and stays at 1 heart on replay', () => {
    const storage = memoryStorage();
    expect(recordMissionAndSave(storage, 'p', '1.1').newlyCompleted).toBe(true);
    expect(recordMissionAndSave(storage, 'p', '1.1').newlyCompleted).toBe(false);
    expect(litHearts(loadProgress(storage, 'p'))).toEqual([0]);
  });

  it('[AC-06] an unknown mission id lights nothing', () => {
    const res = completeMission(createProgress(), '9.9');
    expect(res.newlyCompleted).toBe(false);
    expect(litHearts(res.progress)).toEqual([]);
  });
});

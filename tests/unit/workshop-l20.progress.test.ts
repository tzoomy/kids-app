// Workshop L20 progress (v4 L20-AC3): the egg piece is the FINAL SHELL PIECE that completes the egg. It is set once, lives
// beside the five world pieces, and leaves the feather of older saves untouched. Additive field on the v2 save.
import { describe, expect, it } from 'vitest';
import {
  MAX_EGG_LEVEL,
  createProgress,
  eggComplete,
  eggLevel,
  loadProgress,
  migrateProgress,
  mysteryEggKey,
  recordEggPiece,
  recordEggPieceAndSave,
  repairProgress,
  seedToSave,
} from '../../src/games/mysteryEgg/progress';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = { ...initial };
  let writes = 0;
  return {
    getItem: (k: string) => data[k] ?? null,
    setItem: (k: string, v: string) => {
      data[k] = v;
      writes++;
    },
    get writes() {
      return writes;
    },
    data,
  };
}

describe('workshop L20 egg piece (progress)', () => {
  it('[AC-03] a fresh profile has no egg piece and an incomplete egg', () => {
    const p = createProgress();
    expect(p.eggPiece).toBeUndefined();
    expect(eggComplete(p)).toBe(false);
    expect(eggLevel(p)).toBe(0);
  });

  it('[AC-03] recording the egg piece sets it once; a second win changes nothing', () => {
    const first = recordEggPiece(createProgress());
    expect(first.newlyEarned).toBe(true);
    expect(first.progress.eggPiece).toBe(true);
    const second = recordEggPiece(first.progress);
    expect(second.newlyEarned).toBe(false);
    expect(second.progress).toEqual(first.progress);
  });

  it('[AC-03] the egg piece completes the egg: full glow level, even with no world piece', () => {
    const p = recordEggPiece(createProgress()).progress;
    expect(eggComplete(p)).toBe(true);
    expect(eggLevel(p)).toBe(MAX_EGG_LEVEL);
  });

  it('[AC-03] the feather of an older save is untouched, and so are its completed levels', () => {
    const older = { v: 2, worlds: { workshop: { level: 1, completed: [1] } }, pieces: ['feather'], introSeen: true, introSeenVersion: 2, entrySeen: ['workshop'] };
    const before = migrateProgress(older);
    const after = recordEggPiece(before).progress;
    expect(after.pieces).toEqual(['feather']);
    expect(after.worlds).toEqual(before.worlds);
    expect(after.entrySeen).toEqual(['workshop']);
    expect(after.eggPiece).toBe(true);
  });

  it('[AC-03] recordEggPieceAndSave persists it once for that profile and writes nothing on a repeat', () => {
    const storage = memoryStorage();
    expect(recordEggPieceAndSave(storage, 'kid').newlyEarned).toBe(true);
    expect(JSON.parse(storage.data[mysteryEggKey('kid')]).eggPiece).toBe(true);
    expect(storage.writes).toBe(1);
    expect(recordEggPieceAndSave(storage, 'kid').newlyEarned).toBe(false);
    expect(storage.writes).toBe(1);
    expect(loadProgress(storage, 'kid').eggPiece).toBe(true);
    expect(loadProgress(storage, 'other').eggPiece).toBeUndefined();
  });

  it('[AC-03] a saved egg piece survives repair, a non-boolean one is dropped, and the e2e seed can set it', () => {
    expect(repairProgress({ v: 2, eggPiece: true }).eggPiece).toBe(true);
    expect(repairProgress({ v: 2, eggPiece: 'yes' }).eggPiece).toBeUndefined();
    expect(repairProgress({ v: 2, eggPiece: false }).eggPiece).toBeUndefined();
    expect((seedToSave({ v: 2, eggPiece: true }) as { eggPiece?: boolean }).eggPiece).toBe(true);
  });
});

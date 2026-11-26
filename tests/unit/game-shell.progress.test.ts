// Game shell progression, hearts, pieces, persistence and migration (docs/specs/game-shell.md AC-13..AC-15). Pure TS.
import { describe, expect, it } from 'vitest';
import {
  HEART_SLOT_COUNT,
  MYSTERY_EGG_SAVE_VERSION,
  PIECE_LEVELS,
  completeMission,
  createProgress,
  earnedPieces,
  eggLevel,
  gearFill,
  litHearts,
  loadProgress,
  markEntrySeen,
  markIntroSeen,
  migrateProgress,
  mysteryEggKey,
  newPieces,
  nestTreasures,
  pieceThreshold,
  readyToHatch,
  recordLevel,
  recordMissionAndSave,
  saveProgress,
  worldLevel,
} from '../../src/games/mysteryEgg/progress';
import { WORLDS, type WorldDef } from '../../src/games/mysteryEgg/worlds';

function memoryStorage(initial: Record<string, string> = {}) {
  const data = new Map(Object.entries(initial));
  return { getItem: (k: string) => data.get(k) ?? null, setItem: (k: string, v: string) => void data.set(k, v), data };
}

/** The same worlds, but the Workshop has 5 levels (a later release adds levels). */
const MORE_LEVELS: readonly WorldDef[] = WORLDS.map((w) => (w.id === 'workshop' ? { ...w, levels: 5 } : { ...w, open: true, levels: 3 }));

describe('game-shell progression model', () => {
  it('[AC-13] a fresh child is on level 1 of every world with nothing completed, nothing earned, intro unseen', () => {
    const p = createProgress();
    expect(p.v).toBe(2);
    expect(MYSTERY_EGG_SAVE_VERSION).toBe(2);
    for (const w of WORLDS) expect(p.worlds[w.id]).toEqual({ level: 1, completed: [] });
    expect(p.pieces).toEqual([]);
    expect(p.introSeen).toBe(false);
    expect(p.entrySeen).toEqual([]);
    expect(worldLevel(p, 'workshop')).toBe(1);
  });

  it('[AC-13] a success records the level and raises the world to the next level, capped at the last level', () => {
    let p = createProgress();
    p = recordLevel(p, 'workshop', 1, MORE_LEVELS).progress;
    expect(p.worlds.workshop).toEqual({ level: 2, completed: [1] });
    p = recordLevel(p, 'workshop', 2, MORE_LEVELS).progress;
    expect(worldLevel(p, 'workshop', MORE_LEVELS)).toBe(3);
    for (const l of [3, 4, 5]) p = recordLevel(p, 'workshop', l, MORE_LEVELS).progress;
    expect(p.worlds.workshop.completed).toEqual([1, 2, 3, 4, 5]);
    expect(p.worlds.workshop.level).toBe(5);
    // With the real table the Workshop has one level, so the level stays at 1.
    const real = recordLevel(createProgress(), 'workshop', 1).progress;
    expect(real.worlds.workshop).toEqual({ level: 1, completed: [1] });
  });

  it('[AC-13] replaying a level is idempotent and replaying an earlier level never lowers the world level', () => {
    const first = recordLevel(recordLevel(createProgress(), 'workshop', 1, MORE_LEVELS).progress, 'workshop', 2, MORE_LEVELS).progress;
    const again = recordLevel(first, 'workshop', 2, MORE_LEVELS);
    expect(again.newlyCompleted).toBe(false);
    expect(again.progress).toEqual(first);
    const earlier = recordLevel(first, 'workshop', 1, MORE_LEVELS);
    expect(earlier.newlyCompleted).toBe(false);
    expect(earlier.progress.worlds.workshop.level).toBe(3);
  });

  it('[AC-13] an unknown world, a level out of range or a non-integer level changes nothing', () => {
    const p = createProgress();
    for (const [w, l] of [['nope', 1], ['workshop', 0], ['workshop', 2], ['workshop', 1.5], ['workshop', -1], ['workshop', Number.NaN]] as const) {
      const res = recordLevel(p, w as never, l);
      expect(res.newlyCompleted, `${w} ${l}`).toBe(false);
      expect(res.progress, `${w} ${l}`).toEqual(p);
    }
  });

  it('[AC-13] mission 1.1 is Workshop level 1; an unknown mission lights nothing; recordMissionAndSave persists once', () => {
    const res = completeMission(createProgress(), '1.1');
    expect(res.newlyCompleted).toBe(true);
    expect(res.progress.worlds.workshop.completed).toEqual([1]);
    expect(completeMission(createProgress(), '9.9').newlyCompleted).toBe(false);
    const storage = memoryStorage();
    expect(recordMissionAndSave(storage, 'p', '1.1').newlyCompleted).toBe(true);
    expect(recordMissionAndSave(storage, 'p', '1.1').newlyCompleted).toBe(false);
    expect(loadProgress(storage, 'p').worlds.workshop.completed).toEqual([1]);
  });
});

describe('game-shell hearts, pieces and the egg', () => {
  it('[AC-14] the threshold is min(PIECE_LEVELS, levels in the world), PIECE_LEVELS is 3', () => {
    expect(PIECE_LEVELS).toBe(3);
    expect(pieceThreshold(1)).toBe(1);
    expect(pieceThreshold(2)).toBe(2);
    expect(pieceThreshold(3)).toBe(3);
    expect(pieceThreshold(9)).toBe(3);
    expect(pieceThreshold(0)).toBe(0);
  });

  it('[AC-14] the first success in a world lights that world\'s own heart slot, once', () => {
    expect(HEART_SLOT_COUNT).toBe(5);
    let p = createProgress();
    expect(litHearts(p)).toEqual([]);
    p = recordLevel(p, 'workshop', 1).progress;
    expect(litHearts(p)).toEqual([0]);
    // A world with three levels lights its slot at the first success; garden = slot 4.
    p = recordLevel(p, 'garden', 1, MORE_LEVELS).progress;
    expect(litHearts(p, MORE_LEVELS)).toEqual([0, 4]);
    p = recordLevel(p, 'garden', 1, MORE_LEVELS).progress;
    expect(litHearts(p, MORE_LEVELS)).toEqual([0, 4]);
  });

  it('[AC-14] the gear fill is completed / threshold, capped at 1; the Workshop gear is full after its one level', () => {
    let p = createProgress();
    expect(gearFill(p, 'workshop')).toBe(0);
    p = recordLevel(p, 'workshop', 1).progress;
    expect(gearFill(p, 'workshop')).toBe(1);
    let q = recordLevel(createProgress(), 'bakery', 1, MORE_LEVELS).progress;
    expect(gearFill(q, 'bakery', MORE_LEVELS)).toBeCloseTo(1 / 3, 5);
    q = recordLevel(q, 'bakery', 2, MORE_LEVELS).progress;
    expect(gearFill(q, 'bakery', MORE_LEVELS)).toBeCloseTo(2 / 3, 5);
    q = recordLevel(q, 'bakery', 3, MORE_LEVELS).progress;
    expect(gearFill(q, 'bakery', MORE_LEVELS)).toBe(1);
  });

  it('[AC-14] a piece is earned after min(PIECE_LEVELS, levels) distinct levels and reported once as new', () => {
    let p = createProgress();
    const first = recordLevel(p, 'workshop', 1);
    expect(first.newPiece).toBe('feather');
    expect(first.progress.pieces).toEqual(['feather']);
    // Three levels needed in a world with 5 levels.
    p = createProgress();
    const r1 = recordLevel(p, 'workshop', 1, MORE_LEVELS);
    const r2 = recordLevel(r1.progress, 'workshop', 2, MORE_LEVELS);
    expect([r1.newPiece, r2.newPiece]).toEqual([null, null]);
    const r3 = recordLevel(r2.progress, 'workshop', 3, MORE_LEVELS);
    expect(r3.newPiece).toBe('feather');
    expect(recordLevel(r3.progress, 'workshop', 4, MORE_LEVELS).newPiece).toBeNull();
    expect(recordLevel(first.progress, 'workshop', 1).newPiece).toBeNull();
  });

  it('[AC-14] an earned piece is persisted and never lost when levels are added later', () => {
    const storage = memoryStorage();
    recordMissionAndSave(storage, 'p', '1.1');
    // Later release: the Workshop now has 5 levels, so the old threshold (1) would no longer be met by the table.
    const loaded = loadProgress(storage, 'p');
    expect(earnedPieces(loaded, MORE_LEVELS)).toEqual(['feather']);
    expect(nestTreasures(loaded)).toEqual(['feather']);
    expect(eggLevel(loaded, MORE_LEVELS)).toBe(1);
    // And it survives a repair round trip under the bigger table.
    saveProgress(storage, 'p', loaded);
    expect(loadProgress(storage, 'p').pieces).toEqual(['feather']);
  });

  it('[AC-14] egg glow level = pieces earned (0..5); five pieces = ready to hatch', () => {
    let p = createProgress();
    expect(eggLevel(p)).toBe(0);
    expect(readyToHatch(p)).toBe(false);
    const order = ['workshop', 'bakery', 'owl-house', 'jungle', 'garden'] as const;
    order.forEach((id, i) => {
      for (const l of [1, 2, 3]) p = recordLevel(p, id, l, MORE_LEVELS).progress;
      expect(eggLevel(p, MORE_LEVELS)).toBe(Math.min(5, i + 1));
    });
    expect(p.pieces).toEqual(['feather', 'knit-square', 'pebble', 'leaf', 'flower']);
    expect(readyToHatch(p)).toBe(true);
    expect(litHearts(p, MORE_LEVELS)).toEqual([0, 1, 2, 3, 4]);
  });

  it('[AC-14] newPieces lists the earned pieces the map has not shown yet', () => {
    const p = recordLevel(createProgress(), 'workshop', 1).progress;
    expect(newPieces(p, [])).toEqual(['feather']);
    expect(newPieces(p, ['feather'])).toEqual([]);
    expect(newPieces(createProgress(), [])).toEqual([]);
  });
});

describe('game-shell persistence and migration', () => {
  it('[AC-15] a v2 save round-trips under the per-profile key, and profiles stay apart', () => {
    const storage = memoryStorage();
    let p = recordLevel(createProgress(), 'workshop', 1).progress;
    p = markEntrySeen(markIntroSeen(p), 'workshop');
    saveProgress(storage, 'profile-a', p);
    const raw = JSON.parse(storage.getItem(mysteryEggKey('profile-a')) as string);
    expect(raw.v).toBe(2);
    expect(raw.introSeen).toBe(true);
    expect(raw.entrySeen).toEqual(['workshop']);
    expect(raw.pieces).toEqual(['feather']);
    expect(raw.worlds.workshop).toEqual({ level: 1, completed: [1] });
    expect(loadProgress(storage, 'profile-a')).toEqual(p);
    expect(loadProgress(storage, 'profile-b')).toEqual(createProgress());
    expect(mysteryEggKey('profile-a')).toBe('kids-app-mystery-egg:profile-a');
  });

  it('[AC-15] a v1 save migrates without loss: 1.1 = Workshop level 1, heart slot 0, the feather, egg level 1', () => {
    const storage = memoryStorage({ [mysteryEggKey('p')]: JSON.stringify({ v: 1, completed: ['1.1'] }) });
    const p = loadProgress(storage, 'p');
    expect(p.v).toBe(2);
    expect(p.worlds.workshop).toEqual({ level: 1, completed: [1] });
    expect(litHearts(p)).toEqual([0]);
    expect(p.pieces).toEqual(['feather']);
    expect(nestTreasures(p)).toEqual(['feather']);
    expect(eggLevel(p)).toBe(1);
    expect(p.introSeen).toBe(false);
    expect(p.entrySeen).toEqual([]);
  });

  it('[AC-15] migrating is idempotent and replaying the mission after a migration changes nothing', () => {
    const v1 = { v: 1, completed: ['1.1'] };
    const once = migrateProgress(v1);
    expect(migrateProgress(once)).toEqual(once);
    expect(migrateProgress(JSON.parse(JSON.stringify(once)))).toEqual(once);
    const storage = memoryStorage({ [mysteryEggKey('p')]: JSON.stringify(v1) });
    const replay = recordMissionAndSave(storage, 'p', '1.1');
    expect(replay.newlyCompleted).toBe(false);
    expect(replay.progress).toEqual(once);
    // An empty v1 save migrates to a fresh v2 state.
    expect(migrateProgress({ v: 1, completed: [] })).toEqual(createProgress());
  });

  it('[AC-15] missing, corrupt, non-object and unknown-version data fall back to a fresh state without throwing', () => {
    const key = mysteryEggKey('p');
    for (const raw of [null, '', '{not json', 'null', '[]', '42', '"x"', JSON.stringify({ v: 99, worlds: {} }), JSON.stringify({ v: 3 }), JSON.stringify({ completed: ['1.1'] }), JSON.stringify({ v: 0 })]) {
      const storage = memoryStorage(raw === null ? {} : { [key]: raw });
      expect(loadProgress(storage, 'p'), String(raw)).toEqual(createProgress());
    }
  });

  it('[AC-15] wrong field types and unknown ids are repaired field by field, keeping what is valid', () => {
    const key = mysteryEggKey('p');
    const messy = {
      v: 2,
      worlds: { workshop: { level: 'x', completed: [1, 1, 2, 'a', null, 0] }, nowhere: { level: 3, completed: [1] }, bakery: 'bad', jungle: { level: 99, completed: [] } },
      pieces: ['feather', 'feather', 'unicorn', 7],
      introSeen: 'yes',
      entrySeen: ['workshop', 'workshop', 'nowhere', 3],
    };
    const p = loadProgress(memoryStorage({ [key]: JSON.stringify(messy) }), 'p');
    expect(p.worlds.workshop).toEqual({ level: 1, completed: [1] });
    expect(p.worlds.bakery).toEqual({ level: 1, completed: [] });
    expect(p.worlds.jungle.level).toBeLessThanOrEqual(3);
    expect(Object.keys(p.worlds)).toEqual(['workshop', 'bakery', 'owl-house', 'jungle', 'garden']);
    expect(p.pieces).toEqual(['feather']);
    expect(p.introSeen).toBe(false);
    expect(p.entrySeen).toEqual(['workshop']);
    expect(loadProgress(memoryStorage({ [key]: JSON.stringify({ v: 2, worlds: 'nope', pieces: 5 }) }), 'p')).toEqual(createProgress());
  });

  it('[AC-15] a storage that throws never breaks load or save', () => {
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

  it('[AC-15] introSeen and entrySeen are marked once and persist; marking twice changes nothing', () => {
    const storage = memoryStorage();
    let p = createProgress();
    p = markIntroSeen(markIntroSeen(p));
    p = markEntrySeen(markEntrySeen(p, 'workshop'), 'workshop');
    expect(p.introSeen).toBe(true);
    expect(p.entrySeen).toEqual(['workshop']);
    expect(markEntrySeen(p, 'nowhere' as never)).toEqual(p);
    saveProgress(storage, 'p', p);
    const back = loadProgress(storage, 'p');
    expect(back.introSeen).toBe(true);
    expect(back.entrySeen).toEqual(['workshop']);
  });
});

import { describe, expect, it } from 'vitest';
import { ALBUM_CAP, addToAlbum, loadStickerBoardState, saveStickerBoardState, stickersKey } from '@/core/stickers/store';
import { addSticker, createEmptyBoard, startStroke, extendStroke } from '@/games/stickers/board';
import { runTeardown } from '@/games/stickers/teardown';

function memoryStorage(): Storage {
  const data = new Map<string, string>();
  return {
    get length() {
      return data.size;
    },
    clear: () => data.clear(),
    getItem: (k) => data.get(k) ?? null,
    key: (i) => [...data.keys()][i] ?? null,
    removeItem: (k) => void data.delete(k),
    setItem: (k, v) => void data.set(k, String(v)),
  };
}

describe('sticker-board store', () => {
  it('[AC-12] saves and restores the current board under kids-app-stickers:<profileId>', () => {
    const storage = memoryStorage();
    const board = startStroke(addSticker(createEmptyBoard('jungle'), 'banana', { x: 0.4, y: 0.5 }), 'green', 0.1, 0.2);
    saveStickerBoardState(storage, 'b', { v: 1, current: board, album: [] });
    expect(stickersKey('b')).toBe('kids-app-stickers:b');
    expect(storage.getItem('kids-app-stickers:b')).not.toBeNull();
    expect(loadStickerBoardState(storage, 'b').current).toEqual(board);
  });

  it('[AC-12] profiles are isolated', () => {
    const storage = memoryStorage();
    saveStickerBoardState(storage, 'a', { v: 1, current: addSticker(createEmptyBoard('space'), 'rocket'), album: [] });
    const before = storage.getItem(stickersKey('a'));
    saveStickerBoardState(storage, 'b', { v: 1, current: addSticker(createEmptyBoard('beach'), 'ball'), album: [] });
    expect(storage.getItem(stickersKey('a'))).toBe(before);
    expect(loadStickerBoardState(storage, 'a').current.stickers[0].stickerId).toBe('rocket');
  });

  it('[AC-12] loading is defensive and never throws', () => {
    const storage = memoryStorage();
    storage.setItem(stickersKey('a'), '{not json');
    expect(loadStickerBoardState(storage, 'a').current.stickers).toEqual([]);
    storage.setItem(stickersKey('a'), JSON.stringify({ v: 2, current: {}, album: [] }));
    expect(loadStickerBoardState(storage, 'a').album).toEqual([]);
    storage.setItem(
      stickersKey('a'),
      JSON.stringify({
        v: 1,
        current: {
          backgroundId: 'moon-base',
          stickers: [
            { stickerId: 'dragon', x: 0.5, y: 0.5 },
            { stickerId: 'rocket', x: 7, y: 0.5 },
            { stickerId: 'moon', x: 0.2, y: 0.3 },
          ],
          strokes: [{ colorId: 'gold', points: [0.1, 0.1] }, { colorId: 'red', points: [0.1, 0.1, 'x', 2, 0.3, 0.3] }],
        },
        album: 'nope',
      }),
    );
    const loaded = loadStickerBoardState(storage, 'a');
    expect(loaded.current.backgroundId).toBe('space');
    expect(loaded.current.stickers).toEqual([{ stickerId: 'moon', x: 0.2, y: 0.3 }]);
    expect(loaded.current.strokes).toEqual([{ colorId: 'red', points: [0.1, 0.1, 0.3, 0.3] }]);
    expect(loaded.album).toEqual([]);
    expect(loadStickerBoardState(memoryStorage(), 'zzz').current.stickers).toEqual([]);
  });

  it('[AC-11] save adds the board to the album, newest first, capped at 12', () => {
    let state = { v: 1 as const, current: createEmptyBoard('space'), album: [] as ReturnType<typeof createEmptyBoard>[] };
    for (let i = 0; i < ALBUM_CAP + 3; i++) {
      state = addToAlbum(state, addSticker(createEmptyBoard('beach'), i === ALBUM_CAP + 2 ? 'shell' : 'ball'));
    }
    expect(ALBUM_CAP).toBe(12);
    expect(state.album).toHaveLength(12);
    expect(state.album[0].stickers[0].stickerId).toBe('shell');
    // The album keeps a copy, not the live board.
    const live = addSticker(createEmptyBoard('space'), 'rocket');
    const next = addToAlbum(state, live);
    live.stickers[0].stickerId = 'moon';
    expect(next.album[0].stickers[0].stickerId).toBe('rocket');
  });

  it('[AC-12] a throwing storage (QuotaExceededError) does not throw and returns false', () => {
    const quotaError = Object.assign(new Error('QuotaExceededError'), { name: 'QuotaExceededError' });
    const throwingStorage: Pick<Storage, 'setItem'> = {
      setItem: () => {
        throw quotaError;
      },
    };
    const board = addSticker(createEmptyBoard('space'), 'rocket', { x: 0.5, y: 0.5 });
    expect(saveStickerBoardState(throwingStorage, 'b', { v: 1, current: board, album: [] })).toBe(false);
    expect(saveStickerBoardState(memoryStorage(), 'b', { v: 1, current: board, album: [] })).toBe(true);
  });

  it('[AC-12] rounds stored coordinates to 3 decimals on serialisation without mutating the in-memory board', () => {
    const storage = memoryStorage();
    let board = addSticker(createEmptyBoard('beach'), 'shell', { x: 0.123456, y: 0.65489 });
    board = extendStroke(startStroke(board, 'blue', 0.11111, 0.22269), 0.99991, 0.0004);
    expect(saveStickerBoardState(storage, 'b', { v: 1, current: board, album: [board] })).toBe(true);

    // In-memory board remains untouched.
    expect(board.stickers[0]).toEqual({ stickerId: 'shell', x: 0.123456, y: 0.65489 });
    expect(board.strokes[0].points).toEqual([0.11111, 0.22269, 0.99991, 0.0004]);

    const loaded = loadStickerBoardState(storage, 'b');
    expect(loaded.current.stickers[0]).toEqual({ stickerId: 'shell', x: 0.123, y: 0.655 });
    expect(loaded.current.strokes[0].points).toEqual([0.111, 0.223, 1, 0]);
    expect(loaded.album[0].stickers[0]).toEqual({ stickerId: 'shell', x: 0.123, y: 0.655 });
  });

  it('[AC-12] runTeardown executes all steps and persist even when steps or persist throw', () => {
    const ran: string[] = [];
    expect(() =>
      runTeardown(
        [
          () => ran.push('timer'),
          () => {
            ran.push('throwing-step');
            throw new Error('boom');
          },
          () => ran.push('listeners'),
          () => ran.push('chrome'),
        ],
        () => {
          ran.push('persist');
          throw new Error('QuotaExceededError');
        },
      ),
    ).not.toThrow();
    expect(ran).toEqual(['timer', 'throwing-step', 'listeners', 'chrome', 'persist']);
  });
});

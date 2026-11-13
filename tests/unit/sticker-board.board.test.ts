import { describe, expect, it } from 'vitest';
import {
  MAX_POINTS,
  MAX_STICKERS,
  MAX_STROKES,
  UNDO_CAP,
  UndoStack,
  addSticker,
  clearBoard,
  createEmptyBoard,
  extendStroke,
  hitSticker,
  moveSticker,
  nextSlot,
  startStroke,
} from '@/games/stickers/board';

describe('sticker-board board logic', () => {
  it('[AC-02] a tray tap places the sticker at the next free slot inside the board, deterministically', () => {
    let board = createEmptyBoard('space');
    const first = nextSlot(board);
    board = addSticker(board, 'rocket');
    expect(board.stickers).toEqual([{ stickerId: 'rocket', x: first.x, y: first.y }]);
    board = addSticker(board, 'moon');
    const [a, b] = board.stickers;
    expect(a.x !== b.x || a.y !== b.y).toBe(true);
    for (const s of board.stickers) {
      expect(s.x).toBeGreaterThan(0);
      expect(s.x).toBeLessThan(1);
      expect(s.y).toBeGreaterThan(0);
      expect(s.y).toBeLessThan(1);
    }
    // Same inputs, same result.
    expect(addSticker(addSticker(createEmptyBoard('space'), 'rocket'), 'moon')).toEqual(board);
  });

  it('[AC-02] the 31st sticker drops the oldest', () => {
    let board = createEmptyBoard('space');
    for (let i = 0; i < MAX_STICKERS; i++) board = addSticker(board, i === 0 ? 'rocket' : 'star');
    expect(board.stickers).toHaveLength(30);
    board = addSticker(board, 'ball');
    expect(board.stickers).toHaveLength(30);
    expect(board.stickers.some((s) => s.stickerId === 'rocket')).toBe(false);
    expect(board.stickers[board.stickers.length - 1].stickerId).toBe('ball');
  });

  it('[AC-03] hit-test picks the topmost sticker; a move clamps to the board and brings it to the top', () => {
    let board = createEmptyBoard('space');
    board = addSticker(board, 'rocket', { x: 0.5, y: 0.5 });
    board = addSticker(board, 'moon', { x: 0.52, y: 0.5 });
    expect(hitSticker(board, 0.51, 0.5, 0.05, 0.05)).toBe(1);
    expect(hitSticker(board, 0.9, 0.9, 0.05, 0.05)).toBe(-1);
    board = moveSticker(board, 0, 2, -1, 0.05, 0.05);
    const top = board.stickers[board.stickers.length - 1];
    expect(top.stickerId).toBe('rocket');
    expect(top.x).toBeCloseTo(0.95);
    expect(top.y).toBeCloseTo(0.05);
    expect(moveSticker(board, 9, 0.1, 0.1)).toBe(board);
  });

  it('[AC-04] a stroke keeps its colour; caps at 80 strokes and 400 points per stroke', () => {
    let board = startStroke(createEmptyBoard('beach'), 'blue', 0.1, 0.1);
    board = extendStroke(board, 0.2, 0.2);
    expect(board.strokes).toEqual([{ colorId: 'blue', points: [0.1, 0.1, 0.2, 0.2] }]);
    for (let i = 0; i < MAX_POINTS + 50; i++) board = extendStroke(board, 0.3, i / 1000);
    expect(board.strokes[0].points.length).toBe(MAX_POINTS * 2);
    for (let i = 0; i < MAX_STROKES + 5; i++) board = startStroke(board, i === 0 ? 'red' : 'green', 0.5, 0.5);
    expect(board.strokes).toHaveLength(80);
    expect(board.strokes.some((s) => s.colorId === 'blue')).toBe(false);
    // Out-of-range points are clamped into the board.
    const clamped = startStroke(createEmptyBoard('beach'), 'red', -2, 3);
    expect(clamped.strokes[0].points).toEqual([0, 1]);
  });

  it('[AC-07] undo restores the previous board (cap 30); clear empties the board in one step', () => {
    const undo = new UndoStack();
    let board = addSticker(createEmptyBoard('jungle'), 'leaf');
    undo.push(board);
    board = clearBoard(board);
    expect(board.stickers).toHaveLength(0);
    expect(board.strokes).toHaveLength(0);
    expect(board.backgroundId).toBe('jungle');
    const restored = undo.pop();
    expect(restored?.stickers.map((s) => s.stickerId)).toEqual(['leaf']);
    expect(undo.isEmpty).toBe(true);
    expect(undo.pop()).toBeUndefined();
    for (let i = 0; i < UNDO_CAP + 10; i++) undo.push(createEmptyBoard('space'));
    expect(undo.length).toBe(30);
    // Snapshots are copies: changing the live board never changes a stored step.
    const live = addSticker(createEmptyBoard('space'), 'ball');
    const stack = new UndoStack();
    stack.push(live);
    live.stickers[0].x = 0.99;
    expect(stack.pop()?.stickers[0].x).not.toBe(0.99);
  });
});

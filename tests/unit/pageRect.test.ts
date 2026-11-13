import { describe, expect, it } from 'vitest';
import { gameRectToPageRect } from '@/testing/pageRect';

describe('gameRectToPageRect', () => {
  const rect = { x: 100, y: 200, width: 360, height: 360 };

  it('is the identity plus the canvas offset when the canvas shows the game at 1:1', () => {
    const out = gameRectToPageRect(rect, { x: 0, y: 0, width: 1280, height: 800 }, { width: 1280, height: 800 });
    expect(out).toEqual(rect);
  });

  it('scales a landscape game shown smaller, and offsets by the canvas position (centred canvas)', () => {
    // 1280x800 game fitted into a 1000x625 canvas that is centred horizontally on a wider page.
    const out = gameRectToPageRect(rect, { x: 140, y: 10, width: 1000, height: 625 }, { width: 1280, height: 800 });
    const s = 1000 / 1280;
    expect(out.x).toBeCloseTo(140 + 100 * s);
    expect(out.y).toBeCloseTo(10 + 200 * s);
    expect(out.width).toBeCloseTo(360 * s);
    expect(out.height).toBeCloseTo(360 * s);
  });

  it('handles a portrait game (800x1280) scaled up', () => {
    const out = gameRectToPageRect({ x: 10, y: 20, width: 100, height: 200 }, { x: 5, y: 0, width: 1600, height: 2560 }, { width: 800, height: 1280 });
    expect(out).toEqual({ x: 5 + 20, y: 40, width: 200, height: 400 });
  });

  it('adds the letterbox offset when the canvas box is wider than the drawn game', () => {
    // 1280x800 game in a 1600x800 box: scale 1, drawn 1280 wide, 160 px bars left and right.
    const out = gameRectToPageRect(rect, { x: 0, y: 0, width: 1600, height: 800 }, { width: 1280, height: 800 });
    expect(out).toEqual({ x: 260, y: 200, width: 360, height: 360 });
  });

  it('adds the letterbox offset when the canvas box is taller than the drawn game (portrait bars top and bottom)', () => {
    // 800x1280 game in a 800x1600 box: scale 1, 160 px bars top and bottom.
    const out = gameRectToPageRect({ x: 50, y: 100, width: 10, height: 10 }, { x: 20, y: 30, width: 800, height: 1600 }, { width: 800, height: 1280 });
    expect(out).toEqual({ x: 70, y: 30 + 160 + 100, width: 10, height: 10 });
  });

  it('maps the rectangle centre consistently', () => {
    const canvas = { x: 37, y: 11, width: 640, height: 400 };
    const out = gameRectToPageRect({ x: 600, y: 300, width: 100, height: 60 }, canvas, { width: 1280, height: 800 });
    expect(out.x + out.width / 2).toBeCloseTo(37 + 650 * 0.5);
    expect(out.y + out.height / 2).toBeCloseTo(11 + 330 * 0.5);
  });
});

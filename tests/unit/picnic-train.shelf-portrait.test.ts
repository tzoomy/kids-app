// Regression for portrait audit H4 (2026-11-16): on a portrait phone the age-5 cargo shelf (load task) had ten 69 px slots
// in one row, which FIT-scale to 31x31 CSS px at 360x800 and 36x36 at 412x915. The portrait shelf now wraps to two
// rows, so every slot is at least 48 CSS px on both phones; the landscape shelf is unchanged.
// Spec: docs/specs/picnic-train.md (AC-11 tap targets, AC-21 layout). Pure module: no Phaser.
import { describe, expect, it } from 'vitest';
import { MAX_LOAD } from '@/games/picnic/picnicLogic';
import { computePicnicLayout, shelfSlotRects, trainBand, type LayoutRect } from '@/games/picnic/picnicLayout';

/** The game is FIT-scaled from its design size (src/game/createGame.ts): 800x1280 in portrait, 1280x800 in landscape. */
const PORTRAIT = { width: 800, height: 1280 };
const LANDSCAPE = { width: 1280, height: 800 };
const PHONES = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
] as const;
const MIN_PHONE_SLOT_CSS = 48;

function fitScale(viewport: { width: number; height: number }, design: { width: number; height: number }): number {
  return Math.min(viewport.width / design.width, viewport.height / design.height);
}

function overlaps(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

function inside(r: LayoutRect, width: number, height: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= width && r.y + r.height <= height;
}

describe('picnic-train: portrait cargo shelf (H4 regression)', () => {
  it('[AC-11] every portrait cargo slot is at least 48 CSS px on a 360x800 and a 412x915 phone', () => {
    const slots = shelfSlotRects(PORTRAIT.width, PORTRAIT.height);
    expect(slots).toHaveLength(MAX_LOAD);
    for (const phone of PHONES) {
      const scale = fitScale(phone, PORTRAIT);
      for (const [i, s] of slots.entries()) {
        expect(s.width * scale, `${phone.width}x${phone.height} slot ${i} width`).toBeGreaterThanOrEqual(MIN_PHONE_SLOT_CSS);
        expect(s.height * scale, `${phone.width}x${phone.height} slot ${i} height`).toBeGreaterThanOrEqual(MIN_PHONE_SLOT_CSS);
      }
    }
  });

  it('[AC-11] portrait cargo slots do not overlap each other, the basket or the go flag, and stay inside the screen below the train', () => {
    const layout = computePicnicLayout(PORTRAIT.width, PORTRAIT.height, { seatCount: 6, focusSeat: 0 });
    const slots = layout.shelf.slots;
    expect(slots).toEqual(shelfSlotRects(PORTRAIT.width, PORTRAIT.height));
    const { below } = trainBand(PORTRAIT.width, PORTRAIT.height);
    for (let i = 0; i < slots.length; i++) {
      expect(inside(slots[i], PORTRAIT.width, PORTRAIT.height), `slot ${i} ${JSON.stringify(slots[i])}`).toBe(true);
      expect(slots[i].y, `slot ${i} below the train`).toBeGreaterThanOrEqual(below);
      expect(overlaps(slots[i], layout.basket.hit), `slot ${i} vs basket`).toBe(false);
      expect(overlaps(slots[i], layout.go.hit), `slot ${i} vs go`).toBe(false);
      for (let j = i + 1; j < slots.length; j++) expect(overlaps(slots[i], slots[j]), `slot ${i} vs ${j}`).toBe(false);
    }
  });

  it('portrait cargo slots wrap to two rows of five, filled left to right, top row first', () => {
    const slots = shelfSlotRects(PORTRAIT.width, PORTRAIT.height);
    const rows = [...new Set(slots.map((s) => s.y))];
    expect(rows).toHaveLength(2);
    expect(slots.slice(0, 5).every((s) => s.y === rows[0])).toBe(true);
    expect(slots.slice(5).every((s) => s.y === rows[1])).toBe(true);
    expect(rows[1]).toBeGreaterThan(rows[0]);
    for (let i = 1; i < 5; i++) {
      expect(slots[i].x).toBeGreaterThan(slots[i - 1].x);
      expect(slots[i + 5].x).toBeGreaterThan(slots[i + 4].x);
    }
    for (let i = 0; i < 5; i++) expect(slots[i + 5].x).toBe(slots[i].x);
  });

  it('the landscape cargo shelf is unchanged: one row of ten 76 px slots, 6 px apart, centred below the train', () => {
    const { below } = trainBand(LANDSCAPE.width, LANDSCAPE.height);
    const expected = Array.from({ length: MAX_LOAD }, (_, i) => ({ x: 233 + i * 82, y: below, width: 76, height: 76 }));
    expect(shelfSlotRects(LANDSCAPE.width, LANDSCAPE.height)).toEqual(expected);
    expect(computePicnicLayout(LANDSCAPE.width, LANDSCAPE.height, { seatCount: 6, focusSeat: 0 }).shelf.slots).toEqual(expected);
  });
});

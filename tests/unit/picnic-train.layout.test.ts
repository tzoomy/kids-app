// Picnic Train Pass 1, TDD step 1: train screen layout in both orientations (AC-21, plus the AC-11 tap-target size rule).
// Spec: docs/specs/picnic-train.md. Pure module: no Phaser.
import { describe, expect, it } from 'vitest';
import { TRAIN_LAYOUT } from '@/anim/trainLayout';
import { MIN_TAP, cardRects, computePicnicLayout, type LayoutRect } from '@/games/picnic/picnicLayout';

const SIZES: Array<[number, number]> = [
  [1280, 800],
  [800, 1280],
];

function inside(r: LayoutRect, width: number, height: number): boolean {
  return r.x >= 0 && r.y >= 0 && r.x + r.width <= width + 0.5 && r.y + r.height <= height + 0.5;
}

function overlaps(a: LayoutRect, b: LayoutRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

describe('picnic-train: train layout (AC-21)', () => {
  it('[AC-21] a passenger is never shown smaller than the minimum height, for 2..10 seats in both orientations', () => {
    for (const [w, h] of SIZES) {
      for (let seats = 2; seats <= 10; seats++) {
        const layout = computePicnicLayout(w, h, { seatCount: seats, focusSeat: 0 });
        expect(layout.passengerHeight, `${w}x${h} ${seats} seats`).toBeGreaterThanOrEqual(TRAIN_LAYOUT.minPassengerHeight);
      }
    }
  });

  it('[AC-21] every seat can be brought into view: the focus seat tap rectangle is inside the screen and at least 64 px', () => {
    for (const [w, h] of SIZES) {
      for (let seats = 2; seats <= 10; seats++) {
        for (let focus = 0; focus < seats; focus++) {
          const layout = computePicnicLayout(w, h, { seatCount: seats, focusSeat: focus });
          const seat = layout.seats[focus];
          expect(seat.visible, `${w}x${h} ${seats} seats focus ${focus}`).toBe(true);
          expect(inside(seat.hit, w, h), `${w}x${h} ${seats} seats focus ${focus} hit ${JSON.stringify(seat.hit)}`).toBe(true);
          expect(seat.hit.width).toBeGreaterThanOrEqual(MIN_TAP);
          expect(seat.hit.height).toBeGreaterThanOrEqual(MIN_TAP);
        }
      }
    }
  });

  it('[AC-21] the train fits without a pan when it is short, and pans (never shrinks) when it is long', () => {
    const [w, h] = SIZES[0];
    const short = computePicnicLayout(w, h, { seatCount: 3, focusSeat: 2 });
    expect(short.offsetX).toBe(0);
    const long = computePicnicLayout(SIZES[1][0], SIZES[1][1], { seatCount: 10, focusSeat: 9 });
    expect(long.offsetX).toBeGreaterThan(0);
    expect(long.scale).toBe(computePicnicLayout(SIZES[1][0], SIZES[1][1], { seatCount: 10, focusSeat: 0 }).scale);
  });

  it('[AC-21] a pan that already shows the focus seat is kept, so the camera does not jitter', () => {
    const [w, h] = SIZES[1];
    const a = computePicnicLayout(w, h, { seatCount: 10, focusSeat: 8 });
    const b = computePicnicLayout(w, h, { seatCount: 10, focusSeat: 7, currentOffsetX: a.offsetX });
    expect(b.offsetX).toBe(a.offsetX);
    expect(b.seats[7].visible).toBe(true);
  });

  it('[AC-21] seat tap rectangles do not overlap each other', () => {
    for (const [w, h] of SIZES) {
      const layout = computePicnicLayout(w, h, { seatCount: 10, focusSeat: 0 });
      for (let i = 0; i < layout.seats.length; i++) {
        for (let j = i + 1; j < layout.seats.length; j++) {
          expect(overlaps(layout.seats[i].hit, layout.seats[j].hit), `${i} vs ${j}`).toBe(false);
        }
      }
    }
  });

  it('[AC-21] basket, go flag, cargo slots and number cards are at least 64 px, inside the screen, and clear of each other', () => {
    for (const [w, h] of SIZES) {
      const layout = computePicnicLayout(w, h, { seatCount: 6, focusSeat: 0 });
      const targets: Array<[string, LayoutRect]> = [
        ['basket', layout.basket.hit],
        ['go', layout.go.hit],
        ...layout.shelf.slots.map((s, i): [string, LayoutRect] => [`slot-${i}`, s]),
        ...cardRects(w, h, 9).map((c, i): [string, LayoutRect] => [`card-${i + 1}`, c]),
      ];
      for (const [name, r] of targets) {
        expect(r.width, `${w}x${h} ${name} width`).toBeGreaterThanOrEqual(MIN_TAP);
        expect(r.height, `${w}x${h} ${name} height`).toBeGreaterThanOrEqual(MIN_TAP);
        expect(inside(r, w, h), `${w}x${h} ${name} ${JSON.stringify(r)}`).toBe(true);
      }
      expect(layout.shelf.slots).toHaveLength(10);
      expect(overlaps(layout.basket.hit, layout.go.hit)).toBe(false);
      const cards = cardRects(w, h, 9);
      for (let i = 0; i < cards.length; i++) {
        for (let j = i + 1; j < cards.length; j++) expect(overlaps(cards[i], cards[j])).toBe(false);
        expect(overlaps(cards[i], layout.basket.hit)).toBe(false);
        expect(overlaps(cards[i], layout.go.hit)).toBe(false);
      }
    }
  });

  it('[AC-21] the train band stays below the HUD, and the basket sits below the train', () => {
    for (const [w, h] of SIZES) {
      const layout = computePicnicLayout(w, h, { seatCount: 4, focusSeat: 0 });
      expect(layout.trainTop).toBeGreaterThanOrEqual(128);
      expect(layout.basket.hit.y).toBeGreaterThan(layout.trainTop + layout.trainHeight);
    }
  });
});

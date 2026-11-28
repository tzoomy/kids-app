// Workshop L20 touch targets (docs/specs/workshop-l20.md AC-18): every interactive hit area is at least 48 CSS px on its shortest
// side at every supported viewport; the hit size is computed from the board scale; overlapping zones resolve to the nearest centre.
import { describe, expect, it } from 'vitest';
import { L20_SOCKETS } from '../../src/games/mysteryEgg/workshop/l20Level';
import { resolveL20Drop, socketZoneSize } from '../../src/games/mysteryEgg/workshop/l20Sockets';
import { MIN_TOUCH_CSS, hitSide, minHitWorld, nearestHit } from '../../src/games/mysteryEgg/workshop/l20Touch';

describe('workshop L20 touch targets', () => {
  it('[AC-18] the hit size in world px is 48 CSS px divided by the board scale (CSS px per world px), rounded up with a margin', () => {
    expect(MIN_TOUCH_CSS).toBe(48);
    expect(minHitWorld(1)).toBeGreaterThanOrEqual(48);
    expect(minHitWorld(1)).toBeLessThanOrEqual(50);
    for (const s of [1, 0.92, 0.64, 0.576, 0.5, 0.35]) expect(minHitWorld(s) * s).toBeGreaterThanOrEqual(48);
    // A smaller board scale needs a bigger world hit; garbage scales do not blow up.
    expect(minHitWorld(0.5)).toBeGreaterThan(minHitWorld(1));
    expect(Number.isFinite(minHitWorld(0))).toBe(true);
    expect(Number.isFinite(minHitWorld(Number.NaN))).toBe(true);
  });

  it('[AC-18] a hit side is the largest of the art, the per-part floor and the 48 CSS px minimum', () => {
    expect(hitSide(28, 56, 49)).toBe(56);
    expect(hitSide(28, 56, 84)).toBe(84);
    expect(hitSide(200, 80, 84)).toBe(200);
  });

  it('[AC-18] overlapping hit rects resolve to the nearest centre (placed dominoes only 40 px apart)', () => {
    const wide = 84;
    const cands = [460, 500, 580].map((x) => ({ id: `d${x}`, x, y: 505, w: wide, h: wide }));
    expect(nearestHit(cands, { x: 460, y: 505 })).toBe('d460');
    expect(nearestHit(cands, { x: 500, y: 505 })).toBe('d500');
    expect(nearestHit(cands, { x: 478, y: 505 })).toBe('d460');
    expect(nearestHit(cands, { x: 482, y: 505 })).toBe('d500');
    expect(nearestHit(cands, { x: 540, y: 505 })).toBe('d500');
    expect(nearestHit(cands, { x: 541, y: 505 })).toBe('d580');
    expect(nearestHit(cands, { x: 700, y: 505 })).toBeNull();
    expect(nearestHit([], { x: 1, y: 1 })).toBeNull();
  });

  it('[AC-18] socket drop zones grow with the minimum hit: at least 48 CSS px per side, never smaller than before', () => {
    for (const s of [1, 0.64, 0.576]) {
      const min = minHitWorld(s);
      for (const socket of L20_SOCKETS) {
        const z = socketZoneSize(socket.type, min);
        expect(Math.min(z.w, z.h) * s, socket.id).toBeGreaterThanOrEqual(48);
      }
    }
    expect(socketZoneSize('ramp', 49)).toEqual({ w: 240, h: 140 });
    expect(socketZoneSize('strip', 49)).toEqual({ w: 60, h: 60 });
    expect(socketZoneSize('strip', 84)).toEqual({ w: 84, h: 84 });
  });

  it('[AC-18] dropping a domino on each strip slot centre lands in that slot, at every board scale (no mis-snap from the wider zones)', () => {
    for (const s of [1, 0.92, 0.64, 0.576]) {
      const min = minHitWorld(s);
      for (const socket of L20_SOCKETS.filter((q) => q.type === 'strip')) {
        const drop = resolveL20Drop('domino', { x: socket.x, y: socket.y }, new Set(), L20_SOCKETS, min);
        expect(drop, `${socket.id} @${s}`).toMatchObject({ accepted: true, socketId: socket.id });
        // Within a few px of the centre the nearest slot still wins.
        const off = resolveL20Drop('domino', { x: socket.x + 15, y: socket.y + 5 }, new Set(), L20_SOCKETS, min);
        expect(off, `${socket.id} +15 @${s}`).toMatchObject({ accepted: true, socketId: socket.id });
      }
    }
  });

  it('[AC-18] wider zones do not change which part type a socket takes: a domino on R1 or the strings still springs back', () => {
    const min = minHitWorld(0.576);
    expect(resolveL20Drop('domino', { x: 205, y: 445 }, new Set(), L20_SOCKETS, min)).toEqual({ accepted: false, reason: 'wrong-part' });
    expect(resolveL20Drop('domino', { x: 860, y: 112 }, new Set(), L20_SOCKETS, min)).toEqual({ accepted: false, reason: 'wrong-part' });
    expect(resolveL20Drop('domino', { x: 700, y: 330 }, new Set(), L20_SOCKETS, min)).toEqual({ accepted: false, reason: 'too-far' });
  });
});

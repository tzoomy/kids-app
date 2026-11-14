import { describe, expect, it } from 'vitest';
import { computeShadowLayout } from '@/games/hiding/shadowLayout';

const SIZES: Array<[number, number]> = [
  [1280, 800],
  [800, 1280],
  [1024, 768],
  [390, 844],
];
const HUD_BOTTOM = 160;

describe('shadow-match: layout (AC-16)', () => {
  for (const [w, h] of SIZES) {
    for (let n = 2; n <= 6; n++) {
      it(`[AC-16] ${n} silhouettes at ${w}x${h} stay on screen, under the HUD, apart, and clear of the speaker`, () => {
        const layout = computeShadowLayout(w, h, n);
        expect(layout.slots).toHaveLength(n);
        const { replay } = layout;
        for (const s of layout.slots) {
          expect(s.hit.left).toBeGreaterThanOrEqual(0);
          expect(s.hit.right).toBeLessThanOrEqual(w);
          expect(s.hit.top).toBeGreaterThanOrEqual(HUD_BOTTOM);
          expect(s.hit.bottom).toBeLessThanOrEqual(h);
          expect(s.hit.right - s.hit.left).toBeGreaterThanOrEqual(64);
          expect(s.hit.bottom - s.hit.top).toBeGreaterThanOrEqual(64);
          const nx = Math.max(s.hit.left, Math.min(replay.x, s.hit.right));
          const ny = Math.max(s.hit.top, Math.min(replay.y, s.hit.bottom));
          expect(Math.hypot(nx - replay.x, ny - replay.y)).toBeGreaterThan(replay.radius);
        }
        for (let i = 0; i < n; i++) {
          for (let j = i + 1; j < n; j++) {
            const a = layout.slots[i].hit;
            const b = layout.slots[j].hit;
            const overlap = a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;
            expect(overlap).toBe(false);
          }
        }
      });
    }
  }
});

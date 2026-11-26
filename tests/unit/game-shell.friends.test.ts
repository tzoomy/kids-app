// Game shell friends (docs/specs/game-shell.md AC-23, AC-24): display sizes from Gemini's real sprites, feet alignment between
// the idle art and the walk strip, resting spots, and the spacing of the walk. Pure modules only.
import { describe, expect, it } from 'vitest';
import gameShellAssets from '../../src/content/gameShellAssets.json';
import { FRIEND_SPRITES, displayedVisibleWidth, footprintWidth, friendArtY, friendBoxScale } from '../../src/games/mysteryEgg/friendSprites';
import { ARRIVAL_GAP_PX, WALK_OPTIONS, planWalk, walkFrame } from '../../src/games/mysteryEgg/walk';
import { FRIEND_HOMES, MAP_FRIENDS, WORLDS, type FriendId } from '../../src/games/mysteryEgg/worlds';

const manifest = gameShellAssets as unknown as Record<string, { w: number; h: number; frames?: number }>;
/** Displayed visible height of the idle art (board px): visible canvas px x the box scale x the 1x box / 2x canvas ratio. */
const H = (id: FriendId) => (FRIEND_SPRITES[id].visible * FRIEND_SPRITES[id].box.h * friendBoxScale(id)) / FRIEND_SPRITES[id].canvas.h;

describe('game-shell friend sizes', () => {
  it('[AC-23] the size table matches the manifest: the 2x canvas is twice the 1x box, for the idle art and the walk frames', () => {
    for (const id of MAP_FRIENDS) {
      const s = FRIEND_SPRITES[id];
      for (const state of ['idle', 'walk'] as const) {
        const e = manifest[`map-${id}-${state}`];
        expect(s.box, `${id} ${state}`).toEqual({ w: e.w, h: e.h });
      }
      expect(s.canvas, id).toEqual({ w: s.box.w * 2, h: s.box.h * 2 });
    }
  });

  it('[AC-23] displayed heights: frog clearly the smallest, then robot, the capybara about the bunny\'s height; the bunny is about 190 px as in the map mock', () => {
    expect(H('bunny')).toBeGreaterThanOrEqual(180);
    expect(H('bunny')).toBeLessThanOrEqual(200);
    expect(H('capybara')).toBeGreaterThanOrEqual(0.9 * H('bunny'));
    expect(H('capybara')).toBeLessThanOrEqual(H('bunny'));
    expect(H('robot')).toBeGreaterThanOrEqual(0.7 * H('bunny'));
    expect(H('robot')).toBeLessThanOrEqual(0.9 * H('bunny'));
    expect(H('frog')).toBeGreaterThanOrEqual(100);
    expect(H('frog')).toBeLessThanOrEqual(0.7 * H('bunny'));
    expect(H('frog')).toBeLessThan(H('robot'));
    expect(H('robot')).toBeLessThan(H('capybara'));
  });

  it('[AC-23] on the idle <-> walk swap every friend\'s displayed visible height stays within 5% (measured heights), and the feet stay level', () => {
    for (const id of MAP_FRIENDS) {
      const sp = FRIEND_SPRITES[id];
      const shown = (state: 'idle' | 'walk') => ((state === 'idle' ? sp.visible : sp.walkVisible) * sp.box.h * friendBoxScale(id, state)) / sp.canvas.h;
      expect(Math.abs(shown('walk') / shown('idle') - 1), `${id} swap`).toBeLessThanOrEqual(0.05);
      expect(shown('idle'), id).toBeCloseTo(sp.height, 5);
      // The art box is placed so the lowest visible pixel (the feet) is `height / 2` below the friend's root, in both states.
      for (const state of ['idle', 'walk'] as const) {
        const feet = friendArtY(id, state) + (sp.feet / sp.canvas.h - 0.5) * sp.box.h * friendBoxScale(id, state);
        expect(feet, `${id} ${state} feet`).toBeCloseTo(sp.height / 2, 5);
      }
    }
  });

  it('[AC-23] only a friend whose walk frames differ by more than 5% from the idle art gets its own walk scale (the frog: 174 vs 228 visible px)', () => {
    for (const id of MAP_FRIENDS) {
      const sp = FRIEND_SPRITES[id];
      const differs = Math.abs(sp.walkVisible / sp.visible - 1) > 0.05;
      expect(friendBoxScale(id, 'walk') === friendBoxScale(id, 'idle'), id).toBe(!differs);
    }
    expect(FRIEND_SPRITES.frog.walkVisible).toBe(174);
    expect(friendBoxScale('frog', 'walk') / friendBoxScale('frog', 'idle')).toBeCloseTo(228 / 174, 5);
  });

  it('[AC-23] a placeholder (missing file) keeps the idle size: the box scale is the same number the real art would use', () => {
    for (const id of MAP_FRIENDS) {
      const s = FRIEND_SPRITES[id];
      expect(friendBoxScale(id) * s.box.h, id).toBeGreaterThan(H(id));
      expect(friendBoxScale(id) * s.box.h, id).toBeLessThan(H(id) * 1.2);
    }
  });
});

const rectOf = (id: FriendId, c: { x: number; y: number }) => ({
  x0: c.x - displayedVisibleWidth(id) / 2,
  x1: c.x + displayedVisibleWidth(id) / 2,
  y0: c.y - H(id) / 2,
  y1: c.y + H(id) / 2,
});

describe('game-shell friend homes', () => {
  it('[AC-24] at rest the friends stand in front of and beside the nest: no body covers the painted egg, the heart panel or each other', () => {
    // The painted egg of the final map-nest-home at (640,420): x 554..738, y 284..455 (re-measure if the art changes); the heart panel starts at y 715.
    for (const id of MAP_FRIENDS) {
      const r = rectOf(id, FRIEND_HOMES[id]);
      const overEgg = r.x1 > 554 && r.x0 < 738 && r.y1 > 284 && r.y0 < 455;
      expect(overEgg, `${id} covers the egg`).toBe(false);
      expect(r.y1, `${id} reaches the heart panel`).toBeLessThanOrEqual(705);
      expect(r.x0, id).toBeGreaterThanOrEqual(40);
      expect(r.x1, id).toBeLessThanOrEqual(1240);
    }
    for (let i = 0; i < MAP_FRIENDS.length; i++) {
      for (let j = i + 1; j < MAP_FRIENDS.length; j++) {
        const a = rectOf(MAP_FRIENDS[i], FRIEND_HOMES[MAP_FRIENDS[i]]);
        const b = rectOf(MAP_FRIENDS[j], FRIEND_HOMES[MAP_FRIENDS[j]]);
        const overlap = a.x0 < b.x1 && a.x1 > b.x0 && a.y0 < b.y1 && a.y1 > b.y0;
        expect(overlap, `${MAP_FRIENDS[i]} overlaps ${MAP_FRIENDS[j]} at rest`).toBe(false);
      }
    }
  });
});

describe('game-shell walk spacing', () => {
  /**
   * Smallest centre distance between any two friends over the whole walk (every 20 ms) and at the end, and the smallest
   * margin against their footprints (the walking frog is wider than the idle one): distance - 0.8 x (width a + width b) / 2.
   */
  function spacing(worldId: string) {
    const world = WORLDS.find((w) => w.id === worldId);
    if (!world) throw new Error(worldId);
    const plan = planWalk(FRIEND_HOMES, MAP_FRIENDS, world);
    let minMid = Infinity;
    let minEnd = Infinity;
    let footMargin = Infinity;
    let end = 0;
    for (let t = 0; t < 40_000; t += 20) {
      const frame = walkFrame(plan.routes, t, WALK_OPTIONS);
      for (let i = 0; i < frame.friends.length; i++) {
        for (let j = i + 1; j < frame.friends.length; j++) {
          const d = Math.hypot(frame.friends[i].x - frame.friends[j].x, frame.friends[i].y - frame.friends[j].y);
          if (frame.done) minEnd = Math.min(minEnd, d);
          else minMid = Math.min(minMid, d);
          footMargin = Math.min(footMargin, d - (0.8 * (footprintWidth(plan.ids[i]) + footprintWidth(plan.ids[j]))) / 2);
        }
      }
      if (frame.done) { end = t; break; }
    }
    return { plan, minMid, minEnd, footMargin, end };
  }

  it('[AC-24] on every route consecutive friends stay at least about one friend width apart while walking, and keep a gap when they arrive', () => {
    for (const w of WORLDS) {
      const { minMid, minEnd, footMargin, end } = spacing(w.id);
      expect(end, `${w.id} never finished`).toBeGreaterThan(0);
      expect(minMid, `${w.id} mid-walk`).toBeGreaterThanOrEqual(95);
      expect(minEnd, `${w.id} on arrival`).toBeGreaterThanOrEqual(95);
      expect(footMargin, `${w.id}: footprints (walking frog included) overlap`).toBeGreaterThanOrEqual(0);
    }
  });

  it('[AC-24] the walk plan starts the friend with the shortest route first (the leader), truncates followers behind it and the leader ends at the door', () => {
    for (const w of WORLDS) {
      const plan = planWalk(FRIEND_HOMES, MAP_FRIENDS, w);
      expect([...plan.ids].sort()).toEqual([...MAP_FRIENDS].sort());
      const end = plan.routes[0][plan.routes[0].length - 1];
      expect(end, w.id).toEqual(w.door);
      // Followers stop short of the door by whole arrival gaps, in a line on the path.
      plan.routes.forEach((route, i) => {
        const last = route[route.length - 1];
        const d = Math.hypot(last.x - w.door.x, last.y - w.door.y);
        expect(d, `${w.id} friend ${i}`).toBeGreaterThanOrEqual(i === 0 ? 0 : 0.5 * ARRIVAL_GAP_PX * i);
        expect(d, `${w.id} friend ${i}`).toBeLessThanOrEqual(ARRIVAL_GAP_PX * i + 1);
      });
    }
  });
});

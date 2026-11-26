// Game shell (docs/specs/game-shell.md): the world table, path geometry, friends and the walk. Pure modules only.
import { describe, expect, it } from 'vitest';
import { FRIEND_HOMES, MAP_FRIENDS, NEST, PIECE_NEST_SPOTS, WORLDS, WORLD_IDS, worldArtId, worldDef } from '../../src/games/mysteryEgg/worlds';
import { friendRoute, pointAtDistance, polylineLength, walkFrame } from '../../src/games/mysteryEgg/walk';


/**
 * The painted nest of `map-nest-home` as drawn at the nest anchor (art 360x300 at (640,420)): the egg tops out at y 278 and is
 * widest (x 547..739) near y 370, the bowl is widest (x 482..798) at y 450..500. Rows are [y, xMin, xMax] in board px, measured
 * on the 2x file (alpha > 60) every 10 px; the keep-out is that silhouette plus `margin` px on every side.
 */
const NEST_ROWS: readonly (readonly [number, number, number])[] = [
  [280, 616, 660], [290, 594, 684], [300, 580, 697], [310, 571, 707], [320, 564, 714], [330, 558, 720], [340, 553, 724], [350, 550, 727],
  [360, 548, 728], [370, 547, 739], [380, 520, 748], [390, 510, 770], [400, 497, 782], [410, 492, 784], [420, 485, 793], [430, 484, 794],
  [440, 484, 797], [450, 482, 798], [460, 482, 797], [470, 482, 795], [480, 483, 798], [490, 486, 798], [500, 482, 794],
];

function inNestKeepOut(p: { x: number; y: number }, margin = 10): boolean {
  const top = NEST_ROWS[0];
  const bottom = NEST_ROWS[NEST_ROWS.length - 1];
  if (p.y < top[0] - margin || p.y > bottom[0]) return false;
  if (p.y < top[0]) return Math.abs(p.x - (top[1] + top[2]) / 2) <= (top[2] - top[1]) / 2 + margin;
  let k = NEST_ROWS.findIndex((r) => r[0] >= p.y);
  if (k <= 0) k = 1;
  const a = NEST_ROWS[k - 1];
  const b = NEST_ROWS[k];
  const t = (p.y - a[0]) / (b[0] - a[0]);
  const xMin = a[1] + (b[1] - a[1]) * t;
  const xMax = a[2] + (b[2] - a[2]) * t;
  return p.x >= xMin - margin && p.x <= xMax + margin;
}

describe('game-shell world table', () => {
  it('[AC-02] five worlds with distinct ids and heart slots 0..4; the Workshop is the only open one and has slot 0', () => {
    expect(WORLD_IDS).toEqual(['workshop', 'bakery', 'detective', 'jungle', 'garden']);
    expect(new Set(WORLDS.map((w) => w.id)).size).toBe(5);
    expect(WORLDS.map((w) => w.heartSlot)).toEqual([0, 1, 2, 3, 4]);
    expect(WORLDS.filter((w) => w.open).map((w) => w.id)).toEqual(['workshop']);
    expect(worldDef('workshop').piece).toBe('feather');
    expect(WORLDS.map((w) => w.piece)).toEqual(['feather', 'knit-square', 'pebble', 'leaf', 'flower']);
  });

  it('[AC-02] every path starts at the nest and ends at the door of its world, with at least 2 points', () => {
    for (const w of WORLDS) {
      expect(w.path.length, w.id).toBeGreaterThanOrEqual(2);
      expect(w.path[0], w.id).toEqual(NEST);
      expect(w.path[w.path.length - 1], w.id).toEqual(w.door);
      expect(polylineLength(w.path), w.id).toBeGreaterThan(100);
      // The door is on the world's art, near its bottom half.
      expect(Math.abs(w.door.x - w.x), w.id).toBeLessThanOrEqual(w.artW / 2);
      expect(Math.abs(w.door.y - w.y), w.id).toBeLessThanOrEqual(w.artH / 2 + 40);
    }
  });

  it('[AC-02] every tap area is at least 96 px, inside the 1280x800 board, and covers its tile\'s ground (the door is inside it or within 60 px)', () => {
    for (const w of WORLDS) {
      expect(w.hit.w, w.id).toBeGreaterThanOrEqual(96);
      expect(w.hit.h, w.id).toBeGreaterThanOrEqual(96);
      expect(w.hit.x - w.hit.w / 2, w.id).toBeGreaterThanOrEqual(0);
      expect(w.hit.x + w.hit.w / 2, w.id).toBeLessThanOrEqual(1280);
      expect(w.hit.y - w.hit.h / 2, w.id).toBeGreaterThanOrEqual(0);
      expect(w.hit.y + w.hit.h / 2, w.id).toBeLessThanOrEqual(800);
      const dx = Math.max(Math.abs(w.door.x - w.hit.x) - w.hit.w / 2, 0);
      const dy = Math.max(Math.abs(w.door.y - w.hit.y) - w.hit.h / 2, 0);
      expect(Math.hypot(dx, dy), w.id).toBeLessThanOrEqual(60);
      // The tap area lies on the tile's own art box (320x260 around the anchor).
      expect(Math.abs(w.hit.x - w.x) + w.hit.w / 2, w.id).toBeLessThanOrEqual(w.artW / 2 + 1);
      expect(Math.abs(w.hit.y - w.y) + w.hit.h / 2, w.id).toBeLessThanOrEqual(w.artH / 2 + 1);
    }
  });

  it('[AC-02] the five tap areas do not overlap each other, nor the back button (22..118 px)', () => {
    const rects = [...WORLDS.map((w) => ({ id: w.id, ...w.hit })), { id: 'back', x: 70, y: 70, w: 96, h: 96 }];
    for (let i = 0; i < rects.length; i++) {
      for (let j = i + 1; j < rects.length; j++) {
        const a = rects[i];
        const b = rects[j];
        const overlap = Math.abs(a.x - b.x) < (a.w + b.w) / 2 && Math.abs(a.y - b.y) < (a.h + b.h) / 2;
        expect(overlap, `${a.id} vs ${b.id}`).toBe(false);
      }
    }
  });

  it('[AC-02] friends stand beside the nest, never on the egg, and nest pieces rest on the nest rim (inside the board)', () => {
    // map-nest-home art 360x300 at (640,420); the painted egg is about x 550..730, y 300..475.
    for (const id of MAP_FRIENDS) {
      const f = FRIEND_HOMES[id];
      const onEgg = f.x > 550 && f.x < 730 && f.y > 300 && f.y < 475;
      expect(onEgg, id).toBe(false);
      expect(f.x, id).toBeGreaterThan(80);
      expect(f.x, id).toBeLessThan(1200);
      expect(f.y, id).toBeLessThan(700);
    }
    for (const [piece, spot] of Object.entries(PIECE_NEST_SPOTS)) {
      expect(Math.abs(spot.x - NEST.x), piece).toBeLessThanOrEqual(180);
      expect(Math.abs(spot.y - NEST.y), piece).toBeLessThanOrEqual(150);
    }
  });
});

describe('game-shell friends and tiles', () => {
  it('[AC-04] the map shows the same four friends for every profile: bunny, robot, capybara and the frog', () => {
    expect(MAP_FRIENDS).toEqual(['bunny', 'robot', 'capybara', 'frog']);
  });

  it('[AC-02] anchors follow Gemini\'s layout table: nest (640,420), workshop (220,230), bakery (640,180), detective (1060,230), jungle (220,650), garden (1060,650)', () => {
    expect(NEST).toEqual({ x: 640, y: 420 });
    expect(WORLDS.map((w) => [w.id, w.x, w.y])).toEqual([
      ['workshop', 220, 230], ['bakery', 640, 180], ['detective', 1060, 230], ['jungle', 220, 650], ['garden', 1060, 650],
    ]);
  });

  it('[AC-02] tile art is map-world-<id>-open for the open Workshop and map-world-<id>-closed for the four others', () => {
    expect(WORLDS.map(worldArtId)).toEqual([
      'map-world-workshop-open', 'map-world-bakery-closed', 'map-world-detective-closed', 'map-world-jungle-closed', 'map-world-garden-closed',
    ]);
    expect(WORLDS.every((w) => w.artW === 320 && w.artH === 260)).toBe(true);
  });
});

describe('game-shell walk geometry', () => {
  const line = [{ x: 0, y: 0 }, { x: 100, y: 0 }, { x: 100, y: 100 }];

  it('[AC-06] polyline length and the point at a distance (clamped at both ends) with the heading', () => {
    expect(polylineLength(line)).toBe(200);
    expect(pointAtDistance(line, 0)).toMatchObject({ x: 0, y: 0 });
    expect(pointAtDistance(line, 50)).toMatchObject({ x: 50, y: 0, angle: 0 });
    const turn = pointAtDistance(line, 150);
    expect(turn.x).toBe(100);
    expect(turn.y).toBe(50);
    expect(turn.angle).toBeCloseTo(Math.PI / 2, 5);
    expect(pointAtDistance(line, -20)).toMatchObject({ x: 0, y: 0 });
    expect(pointAtDistance(line, 999)).toMatchObject({ x: 100, y: 100 });
    expect(polylineLength([{ x: 1, y: 1 }])).toBe(0);
  });

  it('[AC-06] a friend route starts at its home spot, goes round the nest through the world\'s approach points, then follows the painted path to the door', () => {
    const w = worldDef('workshop');
    const route = friendRoute({ x: 500, y: 600 }, w);
    expect(route[0]).toEqual({ x: 500, y: 600 });
    expect(route.slice(1, 1 + w.approach.length)).toEqual(w.approach);
    expect(route[route.length - 1]).toEqual(w.door);
    expect(route.slice(1 + w.approach.length)).toEqual(w.path.slice(2));
  });

  it('[AC-06] no friend walks across the painted egg or the nest on the way to any world (every route sampled every 4 px, 10 px margin)', () => {
    for (const w of WORLDS) {
      for (const id of MAP_FRIENDS) {
        const route = friendRoute(FRIEND_HOMES[id], w);
        const len = polylineLength(route);
        for (let d = 0; d <= len; d += 4) {
          const p = pointAtDistance(route, d);
          expect(inNestKeepOut(p), `${id} to ${w.id} at ${Math.round(d)} px: (${Math.round(p.x)}, ${Math.round(p.y)})`).toBe(false);
        }
      }
    }
  });

  it('[AC-06] the door of every world is outside the painted egg and nest (the bakery door sits beside the egg top, not on it)', () => {
    for (const w of WORLDS) expect(inNestKeepOut(w.door), w.id).toBe(false);
  });

  it('[AC-06] followers start later, trail the leader and everyone ends exactly at the door', () => {
    const w = worldDef('workshop');
    const homes = [{ x: 480, y: 590 }, { x: 570, y: 620 }, { x: 800, y: 590 }, { x: 700, y: 630 }];
    const routes = homes.map((h) => friendRoute(h, w));
    const opts = { speed: 300, staggerMs: 250 };
    const start = walkFrame(routes, 0, opts);
    expect(start.done).toBe(false);
    expect(start.friends.map((f) => f.moving)).toEqual([true, false, false, false]);
    // Friend 0 is at home, so are the others, right at the start.
    expect(start.friends[2]).toMatchObject({ x: homes[2].x, y: homes[2].y });

    const mid = walkFrame(routes, 600, opts);
    const progressed = mid.friends.map((f, i) => Math.hypot(f.x - homes[i].x, f.y - homes[i].y));
    expect(progressed[0]).toBeGreaterThan(progressed[1]);
    expect(progressed[1]).toBeGreaterThan(0);
    expect(mid.friends[0].moving).toBe(true);

    const end = walkFrame(routes, 60_000, opts);
    expect(end.done).toBe(true);
    // Small sideways offsets only: everyone ends within a few px of the door, nobody exactly on another.
    end.friends.forEach((f) => {
      expect(Math.hypot(f.x - w.door.x, f.y - w.door.y)).toBeLessThan(40);
      expect(f.moving).toBe(false);
      expect(f.bob).toBe(0);
    });
  });

  it('[AC-06] the walk bob moves only while walking, and the walk lasts the longest route plus the stagger', () => {
    const w = worldDef('bakery');
    const routes = [friendRoute({ x: 500, y: 600 }, w), friendRoute({ x: 560, y: 630 }, w)];
    const opts = { speed: 400, staggerMs: 300 };
    const bobs = new Set<number>();
    for (let t = 50; t < 1000; t += 37) bobs.add(Math.round(walkFrame(routes, t, opts).friends[0].bob * 100));
    expect(bobs.size).toBeGreaterThan(3);
    const longest = Math.max(...routes.map(polylineLength));
    const duration = (longest / opts.speed) * 1000 + opts.staggerMs;
    expect(walkFrame(routes, duration - 200, opts).done).toBe(false);
    expect(walkFrame(routes, duration + 1, opts).done).toBe(true);
  });
});

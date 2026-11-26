// Game shell (docs/specs/game-shell.md): the world table, path geometry, friends and the walk. Pure modules only.
import { describe, expect, it } from 'vitest';
import { MAP_FRIENDS, NEST, WORLDS, WORLD_IDS, worldArtId, worldDef } from '../../src/games/mysteryEgg/worlds';
import { friendRoute, pointAtDistance, polylineLength, walkFrame } from '../../src/games/mysteryEgg/walk';

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
      expect(polylineLength(w.path), w.id).toBeGreaterThan(200);
      // The door is on the world's art, near its bottom half.
      expect(Math.abs(w.door.x - w.x), w.id).toBeLessThanOrEqual(w.artW / 2);
      expect(Math.abs(w.door.y - w.y), w.id).toBeLessThanOrEqual(w.artH / 2 + 40);
    }
  });

  it('[AC-02] every tap area is at least 96 px and inside the 1280x800 board', () => {
    for (const w of WORLDS) {
      expect(w.hit.w, w.id).toBeGreaterThanOrEqual(96);
      expect(w.hit.h, w.id).toBeGreaterThanOrEqual(96);
      expect(w.x - w.hit.w / 2, w.id).toBeGreaterThanOrEqual(0);
      expect(w.x + w.hit.w / 2, w.id).toBeLessThanOrEqual(1280);
      expect(w.y - w.hit.h / 2, w.id).toBeGreaterThanOrEqual(0);
      expect(w.y + w.hit.h / 2, w.id).toBeLessThanOrEqual(800);
    }
  });

  it('[AC-02] the five tap areas do not overlap each other', () => {
    for (let i = 0; i < WORLDS.length; i++) {
      for (let j = i + 1; j < WORLDS.length; j++) {
        const a = WORLDS[i];
        const b = WORLDS[j];
        const overlap = Math.abs(a.x - b.x) < (a.hit.w + b.hit.w) / 2 && Math.abs(a.y - b.y) < (a.hit.h + b.hit.h) / 2;
        expect(overlap, `${a.id} vs ${b.id}`).toBe(false);
      }
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

  it('[AC-06] a friend route starts at its home spot, joins the path after the nest point and ends at the door', () => {
    const w = worldDef('workshop');
    const route = friendRoute({ x: 500, y: 600 }, w.path);
    expect(route[0]).toEqual({ x: 500, y: 600 });
    expect(route[route.length - 1]).toEqual(w.door);
    expect(route).toHaveLength(w.path.length);
  });

  it('[AC-06] followers start later, trail the leader and everyone ends exactly at the door', () => {
    const w = worldDef('workshop');
    const homes = [{ x: 480, y: 590 }, { x: 570, y: 620 }, { x: 800, y: 590 }, { x: 700, y: 630 }];
    const routes = homes.map((h) => friendRoute(h, w.path));
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
    const routes = [friendRoute({ x: 500, y: 600 }, w.path), friendRoute({ x: 560, y: 630 }, w.path)];
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

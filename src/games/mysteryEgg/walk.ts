// Game shell walk geometry (docs/specs/game-shell.md AC-06): points along a polyline and the follow-the-leader walk.
// Pure functions of elapsed time, so the scene only applies the numbers and the tests need no Phaser.
import type { Point2 } from './layout';

export interface PathPoint extends Point2 {
  /** Heading of the segment (radians, 0 = to the right, y down). */
  angle: number;
}

export function polylineLength(points: readonly Point2[]): number {
  let total = 0;
  for (let i = 1; i < points.length; i++) total += Math.hypot(points[i].x - points[i - 1].x, points[i].y - points[i - 1].y);
  return total;
}

/** The point `distance` px along the polyline (clamped to both ends), with the heading of its segment. */
export function pointAtDistance(points: readonly Point2[], distance: number): PathPoint {
  if (points.length === 0) return { x: 0, y: 0, angle: 0 };
  if (points.length === 1) return { ...points[0], angle: 0 };
  let left = Math.max(0, distance);
  for (let i = 1; i < points.length; i++) {
    const a = points[i - 1];
    const b = points[i];
    const len = Math.hypot(b.x - a.x, b.y - a.y);
    const angle = Math.atan2(b.y - a.y, b.x - a.x);
    if (left <= len && len > 0) {
      const k = left / len;
      return { x: a.x + (b.x - a.x) * k, y: a.y + (b.y - a.y) * k, angle };
    }
    left -= len;
  }
  const last = points[points.length - 1];
  const prev = points[points.length - 2];
  return { x: last.x, y: last.y, angle: Math.atan2(last.y - prev.y, last.x - prev.x) };
}

/**
 * A friend's route: its resting spot, then the world's approach waypoints (round the nest, never across the egg), then the
 * painted path after its nest-edge point (`path[0]` is the nest centre, `path[1]` is replaced by the approach). A leading
 * approach waypoint that is farther from the next point than the friend already is would only make it double back, so a
 * friend that starts on the right side of the nest skips it.
 */
export function friendRoute(home: Point2, world: { path: readonly Point2[]; approach: readonly Point2[] }): Point2[] {
  const rest = world.path.slice(2);
  const approach = [...world.approach];
  while (approach.length > 0) {
    const next = approach[1] ?? rest[0];
    if (!next || Math.hypot(home.x - next.x, home.y - next.y) >= Math.hypot(approach[0].x - next.x, approach[0].y - next.y)) break;
    approach.shift();
  }
  return [home, ...approach, ...rest];
}

export interface WalkOptions {
  /** px per second. */
  speed: number;
  /** Delay between one friend's start and the next one's. */
  staggerMs: number;
}

export interface WalkerFrame extends Point2 {
  angle: number;
  /** Vertical hop (px, <= 0) of the walk bob; 0 when not walking. */
  bob: number;
  moving: boolean;
}

export interface WalkFrame {
  friends: WalkerFrame[];
  done: boolean;
}

/** Sideways offsets of the followers (px): small, so they walk in a loose line behind the leader. */
const LATERAL = [0, 40, -40, 30] as const;
const BOB_PX = 6;
const BOB_HZ = 3.2;
const OFFSET_EASE_PX = 60;

/** Friend `i` starts `i * staggerMs` after the leader and follows the same kind of route at the same speed. */
export function walkFrame(routes: readonly (readonly Point2[])[], elapsedMs: number, opts: WalkOptions): WalkFrame {
  let done = true;
  const friends = routes.map((route, i): WalkerFrame => {
    const len = polylineLength(route);
    const local = elapsedMs - i * opts.staggerMs;
    const travelled = Math.min(len, Math.max(0, (opts.speed * local) / 1000));
    const arrived = local >= 0 && travelled >= len;
    const moving = local >= 0 && !arrived;
    if (!arrived) done = false;
    const p = pointAtDistance(route, travelled);
    // The sideways offset eases in over the first px, so a friend leaves its spot smoothly and ends beside the door.
    const side = (LATERAL[i % LATERAL.length] ?? 0) * Math.min(1, travelled / OFFSET_EASE_PX);
    return {
      x: p.x - Math.sin(p.angle) * side,
      y: p.y + Math.cos(p.angle) * side,
      angle: p.angle,
      bob: moving ? -Math.abs(Math.sin(local / 1000 * Math.PI * BOB_HZ)) * BOB_PX : 0,
      moving,
    };
  });
  return { friends, done };
}

/** Time until every friend has arrived. */
export function walkDurationMs(routes: readonly (readonly Point2[])[], opts: WalkOptions): number {
  return Math.max(0, ...routes.map((r, i) => (polylineLength(r) / opts.speed) * 1000 + i * opts.staggerMs));
}

/**
 * Which way a friend faces (the art faces right): a walking friend turns to its heading and keeps its side while the heading
 * is nearly vertical; a friend that is not walking always goes back to the default side (1), so nobody stays flipped.
 */
export function facingFor(s: { moving: boolean; angle: number; current: 1 | -1 }): 1 | -1 {
  if (!s.moving) return 1;
  const c = Math.cos(s.angle);
  if (c < -0.2) return -1;
  if (c > 0.2) return 1;
  return s.current;
}

/** The scene's walk: px per second and the delay between one friend's start and the next one's (a follow distance of 150 px). */
export const WALK_OPTIONS: WalkOptions = { speed: 300, staggerMs: 500 };
/** Followers stop this far (px along their route) behind the one in front of them, so they queue up at the door. */
export const ARRIVAL_GAP_PX = 130;

/** The route without its last `cut` px (clamped so at least a quarter of it stays). */
export function truncateRoute(route: readonly Point2[], cut: number): Point2[] {
  const len = polylineLength(route);
  const keep = Math.max(len * 0.25, len - cut);
  if (keep >= len) return [...route];
  const out: Point2[] = [route[0]];
  let left = keep;
  for (let i = 1; i < route.length; i++) {
    const seg = Math.hypot(route[i].x - route[i - 1].x, route[i].y - route[i - 1].y);
    if (left <= seg) {
      const k = seg > 0 ? left / seg : 0;
      out.push({ x: route[i - 1].x + (route[i].x - route[i - 1].x) * k, y: route[i - 1].y + (route[i].y - route[i - 1].y) * k });
      return out;
    }
    left -= seg;
    out.push(route[i]);
  }
  return out;
}

/**
 * Who walks in which order and where each one stops: the friend with the shortest route leads (it ends at the door), the
 * others start one stagger later each and stop `ARRIVAL_GAP_PX` further back, so nobody overtakes or stands on another.
 */
export function planWalk<Id extends string>(
  homes: Readonly<Record<Id, Point2>>,
  ids: readonly Id[],
  world: { path: readonly Point2[]; approach: readonly Point2[] },
): { ids: Id[]; routes: Point2[][] } {
  const full = ids.map((id) => ({ id, route: friendRoute(homes[id], world) }));
  full.sort((a, b) => polylineLength(a.route) - polylineLength(b.route));
  return { ids: full.map((f) => f.id), routes: full.map((f, rank) => truncateRoute(f.route, rank * ARRIVAL_GAP_PX)) };
}

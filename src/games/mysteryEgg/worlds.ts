// Game shell world table (docs/specs/game-shell.md): the five worlds of the Mystery Egg map, their cobblestone paths
// from the nest, their robot-heart slots and nest pieces, and which friends walk with each child. Pure data, no Phaser.
// World ids follow Gemini's media contract (game-shell/plan.md); names and placement are pending Maor (docs/PENDING-DECISIONS.md).
import type { Point2 } from './layout';

export type WorldId = 'workshop' | 'bakery' | 'detective' | 'jungle' | 'garden';
export type FriendId = 'bunny' | 'robot' | 'capybara' | 'frog';

export interface WorldDef {
  id: WorldId;
  /** Open worlds can be entered; the others show the cute locked feedback. */
  open: boolean;
  /** Levels of the world's one game (locked worlds list the planned count). */
  levels: number;
  /** Robot heart slot (0-based) this world owns. */
  heartSlot: number;
  /** Nest piece (art id suffix: `feather`, or `piece-<id>`) the world earns. */
  piece: string;
  /** Centre of the world's art on the 1280x800 board, and the art's display size. */
  x: number;
  y: number;
  artW: number;
  artH: number;
  /** Tap area (board px, centre and size): the visible art of the tile (Gemini's PR #112 art), at least 96 px. */
  hit: { x: number; y: number; w: number; h: number };
  /** Where the friends stop: the door. */
  door: Point2;
  /** Polyline from the nest (first point) to the door (last point), following the cobblestones painted in `map-bg`. */
  path: readonly Point2[];
  /** Waypoints that walkers take instead of `path[1]`: round the nest (never across the egg) onto the painted path. */
  approach: readonly Point2[];
  /** Scene started when the world's game opens (open worlds only). */
  gameScene?: 'MysteryEggBuildScene';
}

/** The nest (home), the centre of the map (Gemini's layout anchor): the first point of every path. */
export const NEST: Point2 = { x: 640, y: 420 };

const ART = { w: 320, h: 260 } as const;

/**
 * Paths follow the cobblestones PAINTED in `map-bg` (Gemini's PR #112): each starts at the nest centre (hidden under the
 * nest art), leaves the nest on its painted branch and ends in front of the tile's door on the clearing.
 */
const WORKSHOP_PATH: readonly Point2[] = [NEST, { x: 540, y: 395 }, { x: 470, y: 368 }, { x: 385, y: 362 }, { x: 305, y: 345 }, { x: 275, y: 335 }];
// The painted cobbles to the bakery run straight over the top of the egg, so the walk leaves the nest on its left side and
// reaches the shop's door panel from the left (the door stands beside the egg top, never on it; see the keep-out test).
const BAKERY_PATH: readonly Point2[] = [NEST, { x: 540, y: 395 }, { x: 518, y: 335 }, { x: 545, y: 305 }, { x: 560, y: 298 }];
const DETECTIVE_PATH: readonly Point2[] = [NEST, { x: 745, y: 392 }, { x: 830, y: 380 }, { x: 920, y: 362 }, { x: 985, y: 345 }, { x: 1025, y: 340 }];
const JUNGLE_PATH: readonly Point2[] = [NEST, { x: 540, y: 490 }, { x: 485, y: 530 }, { x: 430, y: 585 }, { x: 385, y: 630 }, { x: 320, y: 690 }];
const GARDEN_PATH: readonly Point2[] = [NEST, { x: 740, y: 500 }, { x: 800, y: 540 }, { x: 860, y: 590 }, { x: 900, y: 640 }, { x: 975, y: 700 }];

const last = (path: readonly Point2[]): Point2 => path[path.length - 1];

/**
 * Tile anchors (centres) are Gemini's table: workshop (220,230), bakery (640,180), detective (1060,230), jungle (220,650),
 * garden (1060,650); they sit on the painted clearings. Tap areas are the tiles' visible art (measured on the 2x files).
 */
export const WORLDS: readonly WorldDef[] = [
  { id: 'workshop', open: true, levels: 1, heartSlot: 0, piece: 'feather', x: 220, y: 230, artW: ART.w, artH: ART.h, hit: { x: 221, y: 250, w: 201, h: 204 }, door: last(WORKSHOP_PATH), path: WORKSHOP_PATH, approach: [{ x: 455, y: 600 }, { x: 455, y: 430 }], gameScene: 'MysteryEggBuildScene' },
  { id: 'bakery', open: false, levels: 3, heartSlot: 1, piece: 'knit-square', x: 640, y: 180, artW: ART.w, artH: ART.h, hit: { x: 640, y: 214, w: 210, h: 174 }, door: last(BAKERY_PATH), path: BAKERY_PATH, approach: [{ x: 455, y: 600 }, { x: 455, y: 430 }, { x: 495, y: 372 }] },
  { id: 'detective', open: false, levels: 3, heartSlot: 2, piece: 'pebble', x: 1060, y: 230, artW: ART.w, artH: ART.h, hit: { x: 1059, y: 262, w: 220, h: 178 }, door: last(DETECTIVE_PATH), path: DETECTIVE_PATH, approach: [{ x: 825, y: 600 }, { x: 825, y: 430 }] },
  { id: 'jungle', open: false, levels: 3, heartSlot: 3, piece: 'leaf', x: 220, y: 650, artW: ART.w, artH: ART.h, hit: { x: 220, y: 649, w: 234, h: 244 }, door: last(JUNGLE_PATH), path: JUNGLE_PATH, approach: [{ x: 600, y: 610 }] },
  { id: 'garden', open: false, levels: 3, heartSlot: 4, piece: 'flower', x: 1060, y: 650, artW: ART.w, artH: ART.h, hit: { x: 1061, y: 666, w: 244, h: 210 }, door: last(GARDEN_PATH), path: GARDEN_PATH, approach: [{ x: 680, y: 610 }] },
];

export const WORLD_IDS: readonly WorldId[] = WORLDS.map((w) => w.id);

export function isWorldId(id: unknown): id is WorldId {
  return typeof id === 'string' && WORLDS.some((w) => w.id === id);
}

export function worldDef(id: WorldId): WorldDef {
  const def = WORLDS.find((w) => w.id === id);
  if (!def) throw new Error(`Unknown Mystery Egg world: ${id}`);
  return def;
}

/** Art id of a world tile on the map: the open look for an open world, the closed look for the others. */
export function worldArtId(def: Pick<WorldDef, 'id' | 'open'>): string {
  return `map-world-${def.id}-${def.open ? 'open' : 'closed'}`;
}

/** Nest piece placeholders: only the feather has art (`feather`, Mystery Egg); the other pieces are drawn shapes. */
export const PIECE_ART: Readonly<Record<string, string | null>> = { feather: 'feather', 'knit-square': null, pebble: null, leaf: null, flower: null };

/** Where each earned piece rests on the nest rim of `map-nest-home` (board px, degrees); the painted blanket and feather stay. */
export const PIECE_NEST_SPOTS: Readonly<Record<string, { x: number; y: number; angle: number }>> = {
  feather: { x: 700, y: 512, angle: -35 },
  'knit-square': { x: 565, y: 505, angle: 8 },
  pebble: { x: 632, y: 535, angle: 0 },
  leaf: { x: 775, y: 470, angle: -20 },
  flower: { x: 508, y: 465, angle: 15 },
};

/** The friends on the shared map, for every profile (the frog included; pending Maor decision). The bunny leads the walk. */
export const MAP_FRIENDS: readonly FriendId[] = ['bunny', 'robot', 'capybara', 'frog'];

/** Where each friend stands: in front of and beside the nest, never on the egg (the bunny as in Gemini's map mock). */
export const FRIEND_HOMES: Readonly<Record<FriendId, Point2>> = {
  bunny: { x: 462, y: 560 },
  robot: { x: 550, y: 640 },
  capybara: { x: 825, y: 575 },
  frog: { x: 735, y: 640 },
};

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
  /** Tap area (centred on x, y): 80% of the art, at least 96 px. */
  hit: { w: number; h: number };
  /** Where the friends stop: the door. */
  door: Point2;
  /** Polyline from the nest (first point) to the door (last point). */
  path: readonly Point2[];
  /** Scene started when the world's game opens (open worlds only). */
  gameScene?: 'MysteryEggBuildScene';
}

/** The nest (home), the centre of the map (Gemini's layout anchor): the first point of every path. */
export const NEST: Point2 = { x: 640, y: 420 };

const ART = { w: 320, h: 260 } as const;
const HIT = { w: 256, h: 208 } as const;

const mirror = (p: Point2): Point2 => ({ x: 1280 - p.x, y: p.y });
const mirrored = (path: readonly Point2[]): Point2[] => path.map((p, i) => (i === 0 ? p : mirror(p)));

const WORKSHOP_PATH: readonly Point2[] = [NEST, { x: 560, y: 410 }, { x: 470, y: 380 }, { x: 370, y: 350 }, { x: 270, y: 320 }];
const JUNGLE_PATH: readonly Point2[] = [NEST, { x: 560, y: 470 }, { x: 470, y: 520 }, { x: 370, y: 555 }, { x: 270, y: 570 }];

/** Tile anchors (centres) are Gemini's table: workshop (220,230), bakery (640,180), detective (1060,230), jungle (220,650), garden (1060,650). */
export const WORLDS: readonly WorldDef[] = [
  { id: 'workshop', open: true, levels: 1, heartSlot: 0, piece: 'feather', x: 220, y: 230, artW: ART.w, artH: ART.h, hit: HIT, door: { x: 270, y: 320 }, path: WORKSHOP_PATH, gameScene: 'MysteryEggBuildScene' },
  { id: 'bakery', open: false, levels: 3, heartSlot: 1, piece: 'knit-square', x: 640, y: 180, artW: ART.w, artH: ART.h, hit: HIT, door: { x: 640, y: 290 }, path: [NEST, { x: 565, y: 385 }, { x: 550, y: 335 }, { x: 585, y: 300 }, { x: 640, y: 290 }] },
  { id: 'detective', open: false, levels: 3, heartSlot: 2, piece: 'pebble', x: 1060, y: 230, artW: ART.w, artH: ART.h, hit: HIT, door: mirror({ x: 270, y: 320 }), path: mirrored(WORKSHOP_PATH) },
  { id: 'jungle', open: false, levels: 3, heartSlot: 3, piece: 'leaf', x: 220, y: 650, artW: ART.w, artH: ART.h, hit: HIT, door: { x: 270, y: 570 }, path: JUNGLE_PATH },
  { id: 'garden', open: false, levels: 3, heartSlot: 4, piece: 'flower', x: 1060, y: 650, artW: ART.w, artH: ART.h, hit: HIT, door: mirror({ x: 270, y: 570 }), path: mirrored(JUNGLE_PATH) },
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

/** Where each earned piece rests around the nest (board px, degrees). */
export const PIECE_NEST_SPOTS: Readonly<Record<string, { x: number; y: number; angle: number }>> = {
  feather: { x: 740, y: 470, angle: -35 },
  'knit-square': { x: 560, y: 490, angle: 8 },
  pebble: { x: 690, y: 520, angle: 0 },
  leaf: { x: 548, y: 440, angle: -20 },
  flower: { x: 745, y: 410, angle: 15 },
};

/** The friends on the shared map, for every profile (the frog included; pending Maor decision). The bunny leads the walk. */
export const MAP_FRIENDS: readonly FriendId[] = ['bunny', 'robot', 'capybara', 'frog'];

/** Where each friend stands by the nest (board px). */
export const FRIEND_HOMES: Readonly<Record<FriendId, Point2>> = {
  bunny: { x: 480, y: 540 },
  robot: { x: 570, y: 590 },
  capybara: { x: 800, y: 545 },
  frog: { x: 710, y: 600 },
};

// Game shell world table (docs/specs/game-shell.md): the five worlds of the Mystery Egg map, their cobblestone paths
// from the nest, their robot-heart slots and nest pieces, and which friends walk with each child. Pure data, no Phaser.
// World ids, names and placement are placeholders (docs/PENDING-DECISIONS.md, 2026-11-26).
import type { Point2 } from './layout';

export type WorldId = 'workshop' | 'bakery' | 'owl-house' | 'jungle' | 'garden';
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

/** The nest (home): the first point of every path. */
export const NEST: Point2 = { x: 640, y: 440 };

const ART = { w: 340, h: 280 } as const;
const HIT = { w: 272, h: 224 } as const;

const mirror = (p: Point2): Point2 => ({ x: 1280 - p.x, y: p.y });

const WORKSHOP_PATH: readonly Point2[] = [NEST, { x: 540, y: 430 }, { x: 440, y: 400 }, { x: 350, y: 372 }, { x: 270, y: 345 }];
const JUNGLE_PATH: readonly Point2[] = [NEST, { x: 560, y: 490 }, { x: 470, y: 525 }, { x: 380, y: 525 }, { x: 300, y: 510 }];

export const WORLDS: readonly WorldDef[] = [
  { id: 'workshop', open: true, levels: 1, heartSlot: 0, piece: 'feather', x: 250, y: 235, artW: ART.w, artH: ART.h, hit: HIT, door: { x: 270, y: 345 }, path: WORKSHOP_PATH, gameScene: 'MysteryEggBuildScene' },
  { id: 'bakery', open: false, levels: 3, heartSlot: 1, piece: 'knit-square', x: 640, y: 140, artW: ART.w, artH: ART.h, hit: HIT, door: { x: 640, y: 262 }, path: [NEST, { x: 560, y: 390 }, { x: 555, y: 320 }, { x: 600, y: 275 }, { x: 640, y: 262 }] },
  { id: 'owl-house', open: false, levels: 3, heartSlot: 2, piece: 'pebble', x: 1030, y: 235, artW: ART.w, artH: ART.h, hit: HIT, door: mirror({ x: 270, y: 345 }), path: WORKSHOP_PATH.map((p, i) => (i === 0 ? p : mirror(p))) },
  { id: 'jungle', open: false, levels: 3, heartSlot: 3, piece: 'leaf', x: 250, y: 590, artW: ART.w, artH: ART.h, hit: HIT, door: { x: 300, y: 510 }, path: JUNGLE_PATH },
  { id: 'garden', open: false, levels: 3, heartSlot: 4, piece: 'flower', x: 1030, y: 590, artW: ART.w, artH: ART.h, hit: HIT, door: mirror({ x: 300, y: 510 }), path: JUNGLE_PATH.map((p, i) => (i === 0 ? p : mirror(p))) },
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

/** Art id of a world on the map: the open look, or the locked look for a closed world. */
export function worldArtId(def: Pick<WorldDef, 'id' | 'open'>): string {
  return def.open ? `world-${def.id}` : `world-${def.id}-locked`;
}

/** Art id of a nest piece (`feather` is the prototype's own art). */
export function pieceArtId(piece: string): string {
  return piece === 'feather' ? 'feather' : `piece-${piece}`;
}

/** Where each earned piece rests in the nest (board px, degrees). */
export const PIECE_NEST_SPOTS: Readonly<Record<string, { x: number; y: number; angle: number }>> = {
  feather: { x: 722, y: 470, angle: -35 },
  'knit-square': { x: 568, y: 498, angle: 8 },
  pebble: { x: 690, y: 522, angle: 0 },
  leaf: { x: 556, y: 452, angle: -20 },
  flower: { x: 730, y: 430, angle: 15 },
};

export type AgeTrackLike = 'age2' | 'age5';

/** Friends that walk with the child: bunny, robot, capybara, and the baby frog on the younger (age-2) profile. */
export function friendsFor(profile: { ageTrack: AgeTrackLike }): FriendId[] {
  const friends: FriendId[] = ['bunny', 'robot', 'capybara'];
  if (profile.ageTrack === 'age2') friends.push('frog');
  return friends;
}

/** Where each friend stands by the nest (board px). The bunny leads the walk. */
export const FRIEND_HOMES: Readonly<Record<FriendId, Point2>> = {
  bunny: { x: 490, y: 585 },
  robot: { x: 578, y: 628 },
  capybara: { x: 800, y: 590 },
  frog: { x: 705, y: 632 },
};

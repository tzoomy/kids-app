// Mystery Egg: shapes shared by the scenes and the ?e2e=1 read hook. Types only.
import type { PartKind } from './snap';
import type { ProgressSeed } from './progress';
import type { FriendId, WorldId } from './worlds';

export interface EggPageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Map scene phases (game shell): `intro` = the intro slides, `map` = the interactive map, `walking` = the friends walk
 * to an open world (input locked), `entry` = the world's entry slides, `hub` = the map is not tappable yet: its assets are loading, or
 * a nest piece is flying into the nest on the return from a game (input locked). Build scene phases: `intro` (the Workshop goal card), `build`, `playing`, `success`.
 */
export type EggPhase = 'hub' | 'map' | 'walking' | 'entry' | 'intro' | 'build' | 'playing' | 'success';

export type WorldTarget = `world-${WorldId}`;

export type EggTarget =
  | WorldTarget
  | 'skipBtn'
  | 'slideTap'
  | 'backBtn'
  | 'goBtn'
  | 'playBtn'
  | 'earBtn'
  | 'bunny'
  | 'continueBtn'
  | 'slot'
  | 'partBall'
  | 'partRamp'
  | 'partBell';

/** Per world, on the map (read hook). */
export interface WorldInfo {
  open: boolean;
  /** The level to play next. */
  level: number;
  completed: number[];
  /** Gear fill 0..1. */
  fill: number;
}

export interface SlideInfo {
  kind: 'intro' | 'entry';
  world: WorldId | null;
  index: number;
  count: number;
}

/** Map-only fields of the snapshot (absent in the build scene). */
export interface MapInfo {
  heartFill: number[];
  pieces: string[];
  readyToHatch: boolean;
  friends: FriendId[];
  /** Board px of each friend on screen (they move while walking). */
  friendPositions: Partial<Record<FriendId, { x: number; y: number }>>;
  worlds: Record<WorldId, WorldInfo>;
  slide: SlideInfo | null;
  introSeen: boolean;
  entrySeen: WorldId[];
  walkingTo: WorldId | null;
  /** Taps on a locked world so far in this scene. */
  lockedTaps: number;
  /** Pieces that flew into the nest in this scene (on the return from a game). */
  pieceFlights: string[];
}

/** Read-only snapshot for the e2e hook `getMysteryEggInfo` (page CSS px rectangles; a target that is not on screen is absent). */
export interface MysteryEggInfo {
  scene: 'MysteryEggScene' | 'MysteryEggBuildScene';
  phase: EggPhase;
  /** The scene finished loading its assets and drew its view. */
  ready: boolean;
  /** Persisted: lit robot heart slots, egg glow level. */
  heartsLit: number[];
  eggLevel: number;
  /** What the view shows right now (hub only; the build view shows the success state in `phase`). */
  featherInNest: boolean;
  failedRuns: number;
  hintsGiven: number;
  /** A pointer is pulsing at the empty slot. */
  hintVisible: boolean;
  slotFilled: boolean;
  /** Ball is parked on the shelf (not rolling). */
  ballAtStart: boolean;
  partsInTray: PartKind[];
  rects: Partial<Record<EggTarget, EggPageRect>>;
  /** Present on the map scene only. */
  map?: MapInfo;
}

/** Seed for `seedMysteryEggProgress`: a v1 save (mission ids) or a v2 save (all fields optional; repaired on write). */
export type MysteryEggSeed = ProgressSeed;

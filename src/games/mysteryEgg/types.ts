// Mystery Egg: shapes shared by the scenes and the ?e2e=1 read hook. Types only.
import type { PartKind } from './snap';
import type { ProgressSeed } from './progress';
import type { FriendId, WorldId } from './worlds';
import type { L20Config, L20PartKind, SleeperId } from './workshop/l20Level';
import type { L20Event, L20Run } from './workshop/l20World';

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
 * Workshop L20 phases: `build`, `playing`, `feedback` (a failed run is being shown, input locked, then the board resets to `build`), `success`.
 */
export type EggPhase = 'hub' | 'map' | 'walking' | 'entry' | 'intro' | 'build' | 'playing' | 'feedback' | 'success';

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
  | 'partBell'
  | 'partDomino1'
  | 'partDomino2'
  | 'partScissors'
  | `socket-${string}`;

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
  /** Which way each friend faces: 1 = default (right), -1 = flipped while walking left; always 1 when not walking. */
  friendFacing: Partial<Record<FriendId, 1 | -1>>;
  worlds: Record<WorldId, WorldInfo>;
  /** Current rotation (degrees) of each world's tile art: 0 at rest, never accumulates over repeated taps. */
  worldAngles: Record<WorldId, number>;
  /**
   * Wiggle tweens still running (tiles, friends, nest). An angle of 0 does NOT mean at rest: a wiggle swings through 0 and
   * starts from 0 until its first frame. `wiggling === 0` together with angles of 0 means every wiggle has finished.
   */
  wiggling: number;
  slide: SlideInfo | null;
  /** The current intro was seen (`introSeenVersion >= INTRO_VERSION`). */
  introSeen: boolean;
  /** The intro version last seen (0 = never). */
  introSeenVersion: number;
  entrySeen: WorldId[];
  walkingTo: WorldId | null;
  /** Taps on a locked world so far in this scene. */
  lockedTaps: number;
  /** Pieces that flew into the nest in this scene (on the return from a game). */
  pieceFlights: string[];
  /** Taps on a friend / on the nest that counted (only in phase `map`) so far in this scene. */
  friendTaps: number;
  nestTaps: number;
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

/** Read-only snapshot of the Workshop L20 scene (`getMysteryEggInfo()` returns it while `WorkshopL20Scene` is active). Rectangles are page CSS px. */
export interface WorkshopL20Info {
  scene: 'WorkshopL20Scene';
  level: 20;
  phase: EggPhase;
  ready: boolean;
  /** The intro voice (story, then the goal hint) finished or was cut. */
  introDone: boolean;
  failedRuns: number;
  hintsGiven: number;
  /** Persisted: the final shell piece is earned. */
  eggPiece: boolean;
  eggLevel: number;
  /** What the placements make right now (the physics config the next Play uses). */
  config: L20Config;
  /** Every typed socket: its type, what it accepts, centre (world px), what sits in it, and its page rectangle. */
  sockets: Array<{ id: string; type: 'ramp' | 'strip' | 'string'; accepts: L20PartKind; x: number; y: number; occupiedBy: string | null; glowing: boolean; rect: EggPageRect }>;
  /** Every tray part: where it is (world px), which socket holds it, the ramp's direction. */
  parts: Array<{ id: string; kind: L20PartKind; x: number; y: number; socketId: string | null; inTray: boolean; flipped: boolean; rect: EggPageRect }>;
  /** The last drop result: `{accepted, reason}` for a part that did not snap. */
  lastDrop: { part: string; accepted: boolean; reason: string | null; socketId: string | null } | null;
  run: L20Run;
  /** Events of the current/last run (v4 §1.9): snip:A|B, domino:<x>:fallen, bell:coco:<body>, bell:morning:<body>, ... */
  events: L20Event[];
  /** Each friend's window state and the states it went through. */
  sleepers: Record<SleeperId, { state: 'asleep' | 'awake'; history: string[] }>;
  /** Which background shows: `morning` once the town woke. */
  background: 'dawn' | 'morning';
  capybara: 'idle' | 'ring' | 'facepalm' | 'cheer';
  /** The last failed run's feedback (null before any): the friends who woke and fell asleep again, the mime, the voice lines. */
  feedback: { kind: 'one-bell' | 'no-bell'; sleepersFallAsleep: SleeperId[]; capybara: string; sfx: string | null; voices: string[] } | null;
  /** The glowing socket of the hint ladder (rung 3), or null. */
  hintGlow: string | null;
  /** The highest hint rung reached (the failed-run count up to 5): 3 glowing socket, 4 ghost part, 5 Bip places one part. */
  hintRung: number;
  /** Rung 4: the translucent ghost of the next needed part (part id, socket, orientation) until it is placed, or null. */
  ghost: { part: string; socketId: string; orientation: 'down-right' | 'upright' } | null;
  /** Rung 5: the parts Bip placed, one per rung-5 failure (`run` = the failed-run count that triggered it). */
  bipPlaced: Array<{ part: string; socketId: string; run: number }>;
  /** The pulsing circle where the chain first stopped after a failed run (hidden once the board is touched or Play is tapped). */
  breakPoint: { x: number; y: number; kind: 'ramp' | 'domino-gap' | 'coco-bell' | 'string' | 'morning-bell' } | null;
  /** The egg piece flew to the nest and the egg glows (the win finale reached its end). */
  eggPieceInNest: boolean;
  partsInTrayCount: number;
  rects: Partial<Record<EggTarget, EggPageRect>>;
}

/** Seed for `seedMysteryEggProgress`: a v1 save (mission ids) or a v2 save (all fields optional; repaired on write). */
export type MysteryEggSeed = ProgressSeed;

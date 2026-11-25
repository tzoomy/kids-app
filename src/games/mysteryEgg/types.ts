// Mystery Egg: shapes shared by the scenes and the ?e2e=1 read hook. Types only.
import type { PartKind } from './snap';

export interface EggPageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type EggPhase = 'hub' | 'intro' | 'build' | 'playing' | 'success';

export type EggTarget = 'workshopBtn' | 'backBtn' | 'goBtn' | 'playBtn' | 'earBtn' | 'bunny' | 'continueBtn' | 'slot' | 'partBall' | 'partRamp' | 'partBell';

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
}

/** Seed for `seedMysteryEggProgress`: mission ids to mark completed (unknown ids are dropped by the loader's repair). */
export interface MysteryEggSeed {
  completed: string[];
}

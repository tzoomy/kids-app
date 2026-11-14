// Hook types for Who Lives Here? (spec: docs/specs/who-lives-here.md, "Player journey from the map").
// These types are part of the test contract: tests/e2e/who-lives-here*.spec.ts depends on them. Do not rename or
// reshape them without a spec change (and a changelog line). No Phaser here, so unit tests may import this file.
import type { PageRect } from '../sorting/types';

export type { PageRect };

export type HabitatRequest = 'noun' | 'riddle';

export interface HabitatHomeInfo {
  /** Home id from the content (also the art key suffix `home-<id>-back|front`). */
  id: string;
  family: string;
  /** Animals that have settled in this home this round. */
  count: number;
  /** The soft "look here" glow of the level-1 scaffold, or the pulse after a wrong tap, is showing. */
  glowing: boolean;
  /** Tap rectangle in page CSS px. */
  hit: PageRect;
}

export interface HabitatCurrentAnimal {
  id: string;
  /** The home it lives in (the correct tap). */
  homeId: string;
  /** Home taps on this animal that were not swallowed by the 400 ms lock. */
  tries: number;
  /** An idle hint fired before the trial was recorded. */
  hinted: boolean;
  /** The animal on the path (tap = replay the request). */
  hit: PageRect;
}

export interface HabitatInfo {
  /** 1..8, the level of the active round. */
  level: number;
  /** Learning-token language of this round (Hebrew guidance is always 'he'). */
  lang: 'en' | 'fr';
  request: HabitatRequest;
  /** The Hebrew prompt bubble is shown (false on the audio-only level). */
  textBubble: boolean;
  homes: HabitatHomeInfo[];
  /** null between animals, during animations, and after the round. */
  currentAnimal: HabitatCurrentAnimal | null;
  round: {
    /** 0-based index of the round within this visit; changes when the next round starts. */
    index: number;
    /** Animals in the round (the engine's trialsPerRound). */
    total: number;
    /** Animals that have settled in a home so far this round. */
    placed: number;
  };
  /** The current animal is on the path and home taps are accepted. */
  ready: boolean;
}

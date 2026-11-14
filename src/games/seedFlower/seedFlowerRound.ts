// Pure helpers for Seed to Flower (docs/specs/seed-to-flower.md): level plan, adaptive trials and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, SeedToFlowerContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import { parseOrderMode, parseStages, type OrderMode, type PlantEvent, type StageId } from './seedFlowerMachine';

export type NamingMode = 'bloom' | 'all';

export interface SeedFlowerPlan {
  stages: StageId[];
  mode: OrderMode;
  naming: NamingMode;
  /** L5: no visual pulse on the next tool; the idle hint is spoken instead. */
  audioOnly: boolean;
}

/** Reads the game-specific levers of one level (`extra.stages`, `extra.order`, `extra.naming`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): SeedFlowerPlan {
  const rawStages = level?.extra?.stages;
  return {
    stages: parseStages(typeof rawStages === 'string' ? rawStages.split(',') : undefined),
    mode: parseOrderMode(level?.extra?.order),
    naming: level?.extra?.naming === 'all' ? 'all' : 'bloom',
    audioOnly: level?.support === 'audio-only',
  };
}

/** One adaptive trial per growth step: the stage grown into, clean unless sun came before water. */
export function trialForGrowth(event: Extract<PlantEvent, { kind: 'grew' }>, hinted: boolean): TrialResult {
  return { itemId: event.to, firstTryCorrect: !event.stepOutOfOrder, hinted };
}

/** Whether a stage is spoken on this level: every stage (the seed at plant start) on naming levels, else only the flower. */
export function speaksStage(plan: SeedFlowerPlan, stage: StageId): boolean {
  return plan.naming === 'all' || stage === 'flower';
}

/** Stage name in the learning language, device TTS in Pass 1. */
export function stageLine(content: SeedToFlowerContent, stage: StageId, lang: Lang): SpeechRequest {
  return { lineId: `seed.stage.${stage}.${lang}`, lang, text: content.stageNames[stage][lang] };
}

export type SeedHeLine = 'intro.free' | 'intro.ordered' | 'help' | 'needWater' | 'needSun';

/** Hebrew guidance, device TTS in Pass 1 (ids without the `he.` prefix, so no recorded clip is expected). */
export function seedHeLine(content: SeedToFlowerContent, key: SeedHeLine): SpeechRequest {
  const text =
    key === 'intro.free' ? content.linesHe.introFree
    : key === 'intro.ordered' ? content.linesHe.introOrdered
    : key === 'help' ? content.helpTextHe
    : key === 'needWater' ? content.linesHe.needWater
    : content.linesHe.needSun;
  return { lineId: `seed.${key}.he`, lang: 'he', text };
}

/** Bloom art for the n-th plant of a visit (existing `art/flowers/bloom-<id>.svg`), in turn. */
export function bloomFor(content: SeedToFlowerContent, plantIndex: number): string {
  return content.blooms[((plantIndex % content.blooms.length) + content.blooms.length) % content.blooms.length];
}

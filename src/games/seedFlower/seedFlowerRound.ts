// Pure helpers for Seed to Flower (docs/specs/seed-to-flower.md): level plan, adaptive trials and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, SeedToFlowerContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { TaskLang } from '../../core/audio/taskInstruction';
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

export type SeedTaskKey = 'intro.free' | 'intro.ordered';

const SEED_INTRO_TEXT: Record<'en' | 'fr', Record<SeedTaskKey, string>> = {
  en: {
    'intro.free': "Let's grow a flower! Tap the water or the sun, and watch it grow.",
    'intro.ordered': "Let's grow a flower! First we water it, then the sun warms it.",
  },
  fr: {
    'intro.free': "Faisons pousser une fleur ! Appuie sur l'eau ou sur le soleil, et regarde-la grandir.",
    'intro.ordered': "Faisons pousser une fleur ! D'abord on l'arrose, ensuite le soleil la réchauffe.",
  },
};

/**
 * Task intro in the task-instruction language: Hebrew (`seedHeLine`) for age 2, the round's learning language for age 5.
 * Miss and help lines (`needWater`, `needSun`, `help`) stay Hebrew on both tracks and keep using `seedHeLine`.
 */
export function seedTaskLine(content: SeedToFlowerContent, key: SeedTaskKey, lang: TaskLang = 'he'): SpeechRequest {
  if (lang === 'he') return seedHeLine(content, key);
  return { lineId: `seed.${key}.${lang}`, lang, text: SEED_INTRO_TEXT[lang][key] };
}

/** Bloom art for the n-th plant of a visit (existing `art/flowers/bloom-<id>.svg`), in turn. */
export function bloomFor(content: SeedToFlowerContent, plantIndex: number): string {
  return content.blooms[((plantIndex % content.blooms.length) + content.blooms.length) % content.blooms.length];
}

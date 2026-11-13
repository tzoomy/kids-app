// Pure helpers for Sink or Float (docs/specs/sink-or-float.md): level plan, adaptive trials and voice lines.
// No Phaser, no DOM, so unit tests import this module directly.
import type { LevelDescriptor, SinkOrFloatContent } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { FloatObjectId, FloatOutcome, SinkFloatEvent, SinkFloatMode } from './sinkFloatMachine';

export interface SinkFloatPlan {
  mode: SinkFloatMode;
  dropsPerStar: number;
  /** L3: the question is only spoken; prediction buttons stay visible but do not pulse on idle hint. */
  audioOnly: boolean;
  /** L2: idle hint pulses both prediction buttons; L3: no button pulse. */
  hintPulse: boolean;
}

const DEFAULT_DROPS_PER_STAR = 3;

/** Reads the game-specific levers of one level (`extra.mode`, `extra.dropsPerStar`, `extra.hintPulse`, `support`). */
export function planForLevel(level: LevelDescriptor | undefined): SinkFloatPlan {
  const mode: SinkFloatMode = level?.extra?.mode === 'predict' ? 'predict' : 'free';
  const rawDrops = level?.extra?.dropsPerStar;
  const dropsPerStar =
    typeof rawDrops === 'number' && Number.isInteger(rawDrops) && rawDrops >= 1 ? rawDrops : DEFAULT_DROPS_PER_STAR;
  const audioOnly = level?.support === 'audio-only';
  const hintPulse = !audioOnly && level?.extra?.hintPulse !== false;
  return { mode, dropsPerStar, audioOnly, hintPulse };
}

/** Free-mode adaptive trial: every drop is one clean exposure trial for the object. */
export function trialForDrop(event: Extract<SinkFloatEvent, { kind: 'dropped' }>): TrialResult {
  return { itemId: event.objectId, firstTryCorrect: true, hinted: false };
}

/** Predict-mode adaptive trial: clean only when the prediction was right and unhinted. */
export function trialForPrediction(
  event: Extract<SinkFloatEvent, { kind: 'revealed' }>,
  hinted: boolean,
): TrialResult {
  return {
    itemId: event.objectId,
    firstTryCorrect: event.correct,
    hinted,
  };
}

function findObject(content: SinkOrFloatContent, objectId: FloatObjectId) {
  const entry = content.objects.find((o) => o.id === objectId);
  if (!entry) throw new Error(`Unknown sink-or-float object in content: ${objectId}`);
  return entry;
}

/** Hebrew intro line for the start of a visit in free or predict mode. */
export function introLine(content: SinkOrFloatContent, mode: SinkFloatMode): SpeechRequest {
  return mode === 'predict'
    ? { lineId: 'sinkFloat.intro.predict.he', lang: 'he', text: content.linesHe.introPredict }
    : { lineId: 'sinkFloat.intro.free.he', lang: 'he', text: content.linesHe.introFree };
}

/** Hebrew question spoken after selecting an object in predict mode. */
export function askLine(content: SinkOrFloatContent): SpeechRequest {
  return {
    lineId: 'sinkFloat.ask.he',
    lang: 'he',
    text: content.linesHe.ask,
  };
}

/** Gentle Hebrew line spoken before revealing the outcome after a wrong prediction. */
export function letsSeeLine(content: SinkOrFloatContent): SpeechRequest {
  return {
    lineId: 'sinkFloat.letsSee.he',
    lang: 'he',
    text: content.linesHe.letsSee,
  };
}

/** Hebrew result sentence for one object ("התפוח צף!" / "האבן שוקעת!"). */
export function resultHeLine(content: SinkOrFloatContent, objectId: FloatObjectId): SpeechRequest {
  const entry = findObject(content, objectId);
  return {
    lineId: `sinkFloat.result.${objectId}.he`,
    lang: 'he',
    text: entry.resultHe,
  };
}

/** Result phrase in the active learning language (`en` or `fr`). */
export function resultLearningLine(
  content: SinkOrFloatContent,
  outcome: FloatOutcome,
  lang: Lang,
): SpeechRequest {
  return {
    lineId: `sinkFloat.result.${outcome}.${lang}`,
    lang,
    text: content.outcomes[outcome][lang],
  };
}

/** Naming sequence for an outcome: Hebrew first, then the round's active learning language. */
export function namingLines(
  content: SinkOrFloatContent,
  objectId: FloatObjectId,
  learningLang: Lang,
): [SpeechRequest, SpeechRequest] {
  const entry = findObject(content, objectId);
  const outcome: FloatOutcome = entry.floats ? 'floats' : 'sinks';
  return [resultHeLine(content, objectId), resultLearningLine(content, outcome, learningLang)];
}

// Pure helpers for Travel Suitcase (docs/specs/travel-suitcase.md):
// level plans, request/case selection, adaptive trials, and voice lines.
import type {
  LevelDescriptor,
  SuitcaseColorVariant,
  SuitcaseItem,
  SuitcaseRequestKind,
  TravelSuitcaseContent,
} from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import type { SuitcaseChoice } from './suitcaseMachine';

export interface SuitcasePlan {
  request: SuitcaseRequestKind;
  choiceCount: number;
  requestsPerCase: number;
  audioOnly: boolean;
  hintPulse: boolean;
}

export interface BuiltRequestSpec {
  readonly kind: SuitcaseRequestKind;
  readonly key: string;
  readonly itemId: string;
  readonly targets: readonly string[];
  readonly needed: number;
  readonly targetItemIds: readonly string[];
  readonly excludedColor?: string;
}

export interface BuiltRequest {
  readonly choices: SuitcaseChoice[];
  readonly request: BuiltRequestSpec;
  readonly lineText: string;
}

export interface BuiltCase {
  readonly requests: BuiltRequest[];
  readonly requestsPerCase: number;
}

const DEFAULT_CHOICE_COUNT = 2;
const DEFAULT_REQUESTS_PER_CASE = 3;

/** Reads the game-specific levers of one level (`choiceCount`, `support`, `extra.*`). */
export function planForLevel(level: LevelDescriptor | undefined): SuitcasePlan {
  const rawReq = level?.extra?.request;
  const request: SuitcaseRequestKind =
    rawReq === 'two' || rawReq === 'attribute' || rawReq === 'negation' ? rawReq : 'noun';
  const rawChoice = level?.choiceCount;
  const choiceCount =
    typeof rawChoice === 'number' && Number.isInteger(rawChoice) && rawChoice >= 2
      ? rawChoice
      : DEFAULT_CHOICE_COUNT;
  const rawPerCase = level?.extra?.requestsPerCase;
  const requestsPerCase =
    typeof rawPerCase === 'number' && Number.isInteger(rawPerCase) && rawPerCase >= 1
      ? rawPerCase
      : DEFAULT_REQUESTS_PER_CASE;
  const audioOnly = level?.support === 'audio-only';
  return {
    request,
    choiceCount,
    requestsPerCase,
    audioOnly,
    hintPulse: !audioOnly,
  };
}

function randIndex(length: number, rng: () => number): number {
  const raw = Math.floor(Math.max(0, Math.min(0.999999999999, rng())) * length);
  return Math.min(length - 1, raw);
}

function shuffle<T>(items: readonly T[], rng: () => number): T[] {
  const copy = [...items];
  for (let i = copy.length - 1; i > 0; i--) {
    const j = randIndex(i + 1, rng);
    const tmp = copy[i];
    copy[i] = copy[j];
    copy[j] = tmp;
  }
  return copy;
}

function lookupChoice(
  content: TravelSuitcaseContent,
  choiceId: string,
): { item: SuitcaseItem; variant: SuitcaseColorVariant | null } {
  const direct = content.items.find((i) => i.id === choiceId);
  if (direct) return { item: direct, variant: null };

  for (const item of content.items) {
    if (!item.colors) continue;
    for (const v of item.colors) {
      if (`${item.id}-${v.color}` === choiceId) {
        return { item, variant: v };
      }
    }
  }
  throw new Error(`Unknown travel-suitcase choice id: ${String(choiceId)}`);
}

/** Resolves the manifest art key for a choice id (e.g. "hat" or "hat-blue"). */
export function artKeyForChoice(content: TravelSuitcaseContent, choiceId: string): string {
  const { item, variant } = lookupChoice(content, choiceId);
  return variant ? variant.art : item.art;
}

/** Formats the learning-language request line (`suitcase.req.<kind>.<key>.<lang>`). */
export function requestLine(
  content: TravelSuitcaseContent,
  req: BuiltRequestSpec,
  lang: Lang,
): SpeechRequest {
  const lineId = `suitcase.req.${req.kind}.${req.key}.${lang}`;
  const f = content.frames[lang];

  if (req.kind === 'noun') {
    const { item } = lookupChoice(content, req.targets[0]);
    return { lineId, lang, text: f.put.replace('{the}', item[lang].the) };
  }
  if (req.kind === 'two') {
    const a = lookupChoice(content, req.targets[0]).item;
    const b = lookupChoice(content, req.targets[1]).item;
    return {
      lineId,
      lang,
      text: f.two.replace('{a}', a[lang].the).replace('{b}', b[lang].the),
    };
  }
  if (req.kind === 'attribute') {
    const { variant } = lookupChoice(content, req.targets[0]);
    if (!variant) throw new Error(`Attribute request target "${req.targets[0]}" has no colour variant`);
    return { lineId, lang, text: f.put.replace('{the}', variant[lang]) };
  }

  const excludedId = req.key;
  const { item, variant } = lookupChoice(content, excludedId);
  if (!variant) throw new Error(`Negation request key "${excludedId}" has no colour variant`);
  const onePhrase = lang === 'en' ? variant.enOne : variant.frOne;
  return {
    lineId,
    lang,
    text: f.not.replace('{a}', item[lang].a).replace('{one}', onePhrase),
  };
}

/** Capitalises the first character and builds `suitcase.name.<choiceId>.<lang>`. */
export function nameLine(content: TravelSuitcaseContent, choiceId: string, lang: Lang): SpeechRequest {
  const { item, variant } = lookupChoice(content, choiceId);
  const thePhrase = variant ? variant[lang] : item[lang].the;
  const capitalised = thePhrase.charAt(0).toUpperCase() + thePhrase.slice(1);
  return {
    lineId: `suitcase.name.${choiceId}.${lang}`,
    lang,
    text: content.frames[lang].name.replace('{The}', capitalised),
  };
}

/** Gentle redirect in the learning language: `suitcase.other.<choiceId>.<lang>`. */
export function otherLine(content: TravelSuitcaseContent, choiceId: string, lang: Lang): SpeechRequest {
  const { item, variant } = lookupChoice(content, choiceId);
  const thePhrase = variant ? variant[lang] : item[lang].the;
  return {
    lineId: `suitcase.other.${choiceId}.${lang}`,
    lang,
    text: content.frames[lang].other.replace('{the}', thePhrase),
  };
}

/** Hebrew intro line for the start of a visit: `suitcase.intro.he`. */
export function introLine(content: TravelSuitcaseContent): SpeechRequest {
  return { lineId: 'suitcase.intro.he', lang: 'he', text: content.linesHe.intro };
}

/** Hebrew celebration line when the suitcase is full: `suitcase.closed.he`. */
export function closedLine(content: TravelSuitcaseContent): SpeechRequest {
  return { lineId: 'suitcase.closed.he', lang: 'he', text: content.linesHe.closed };
}

/**
 * Adaptive trial result for one completed request.
 * Clean only with zero `other` picks (`tries === 0`) and no idle hint (`!hinted`).
 */
export function trialForRequest(tries: number, hinted: boolean, itemId = 'request'): TrialResult {
  return {
    itemId,
    firstTryCorrect: tries === 0,
    hinted,
  };
}

function uncoloredChoice(item: SuitcaseItem): SuitcaseChoice {
  return { id: item.id, itemId: item.id, color: null };
}

function coloredChoice(item: SuitcaseItem, variant: SuitcaseColorVariant): SuitcaseChoice {
  return { id: `${item.id}-${variant.color}`, itemId: item.id, color: variant.color };
}

/**
 * Builds one request with `choices` laid out for the floor, never repeating `previousKey`.
 * `excludeItemIds` keeps items already packed inside the open suitcase off the floor.
 */
export function buildRequest(
  content: TravelSuitcaseContent,
  plan: SuitcasePlan,
  previousKey: string | null = null,
  rng: () => number = Math.random,
  excludeItemIds: readonly string[] = [],
  lang: Lang = 'en',
): BuiltRequest {
  const excluded = new Set(excludeItemIds);
  const floorItems = content.items.filter((i) => !excluded.has(i.id));

  let choices: SuitcaseChoice[];
  let request: BuiltRequestSpec;

  if (plan.request === 'noun') {
    const pool = floorItems.length >= plan.choiceCount ? floorItems : content.items;
    const eligible = previousKey && pool.length > 1 ? pool.filter((i) => i.id !== previousKey) : pool;
    const targetPool = eligible.length > 0 ? eligible : pool;
    const target = targetPool[randIndex(targetPool.length, rng)];
    const distractors = shuffle(
      pool.filter((i) => i.id !== target.id),
      rng,
    ).slice(0, plan.choiceCount - 1);
    choices = shuffle([target, ...distractors], rng).map(uncoloredChoice);
    request = {
      kind: 'noun',
      key: target.id,
      itemId: target.id,
      targets: [target.id],
      needed: 1,
      targetItemIds: [target.id],
    };
  } else if (plan.request === 'two') {
    const pool = floorItems.length >= plan.choiceCount ? floorItems : content.items;
    const ordered = shuffle(pool, rng);
    let pair: [SuitcaseItem, SuitcaseItem] = [ordered[0], ordered[1]];
    if (previousKey && pool.length >= 3) {
      const candidates: Array<[SuitcaseItem, SuitcaseItem]> = [];
      for (let i = 0; i < ordered.length; i++) {
        for (let j = i + 1; j < ordered.length; j++) {
          const a = ordered[i];
          const b = ordered[j];
          const key = `${a.id}-${b.id}`;
          const rev = `${b.id}-${a.id}`;
          if (key !== previousKey && rev !== previousKey) {
            candidates.push([a, b]);
          }
        }
      }
      if (candidates.length > 0) {
        pair = candidates[randIndex(candidates.length, rng)];
      }
    }
    const [a, b] = pair;
    const distractors = shuffle(
      pool.filter((i) => i.id !== a.id && i.id !== b.id),
      rng,
    ).slice(0, plan.choiceCount - 2);
    choices = shuffle([a, b, ...distractors], rng).map(uncoloredChoice);
    const key = `${a.id}-${b.id}`;
    const itemId = [a.id, b.id].sort().join('+');
    request = {
      kind: 'two',
      key,
      itemId,
      targets: [a.id, b.id],
      needed: 2,
      targetItemIds: [a.id, b.id],
    };
  } else {
    const coloredFloor = floorItems.filter((i) => i.colors && i.colors.length === 3);
    const coloredAll = content.items.filter((i) => i.colors && i.colors.length === 3);
    const coloredPool = coloredFloor.length > 0 ? coloredFloor : coloredAll;
    if (coloredPool.length === 0) {
      throw new Error(`Travel Suitcase ${plan.request} level requires coloured items`);
    }

    const prevItemId = previousKey ? previousKey.split('-')[0] : null;
    const diffItem = prevItemId && coloredPool.length > 1 ? coloredPool.filter((i) => i.id !== prevItemId) : coloredPool;
    const itemPool = diffItem.length > 0 ? diffItem : coloredPool;

    const pairs: Array<{ item: SuitcaseItem; variant: SuitcaseColorVariant; key: string }> = [];
    for (const item of itemPool) {
      for (const variant of item.colors!) {
        const key = `${item.id}-${variant.color}`;
        if (key !== previousKey) pairs.push({ item, variant, key });
      }
    }
    const chosen =
      pairs.length > 0
        ? pairs[randIndex(pairs.length, rng)]
        : { item: itemPool[0], variant: itemPool[0].colors![0], key: `${itemPool[0].id}-${itemPool[0].colors![0].color}` };

    const otherCandidates = floorItems.filter((i) => i.id !== chosen.item.id);
    const otherPool =
      otherCandidates.length > 0 ? otherCandidates : content.items.filter((i) => i.id !== chosen.item.id);
    const other = otherPool[randIndex(otherPool.length, rng)];

    choices = shuffle(
      [...chosen.item.colors!.map((v) => coloredChoice(chosen.item, v)), uncoloredChoice(other)],
      rng,
    );

    if (plan.request === 'attribute') {
      request = {
        kind: 'attribute',
        key: chosen.key,
        itemId: chosen.key,
        targets: [chosen.key],
        needed: 1,
        targetItemIds: [chosen.item.id],
      };
    } else {
      const rightTargets = chosen.item.colors!
        .filter((v) => v.color !== chosen.variant.color)
        .map((v) => `${chosen.item.id}-${v.color}`);
      request = {
        kind: 'negation',
        key: chosen.key,
        itemId: `${chosen.item.id}-not-${chosen.variant.color}`,
        targets: rightTargets,
        needed: 1,
        targetItemIds: [chosen.item.id],
        excludedColor: chosen.variant.color,
      };
    }
  }

  return {
    choices,
    request,
    lineText: requestLine(content, request, lang).text,
  };
}

/**
 * Builds a complete multi-request case where packed items stay off the floor for subsequent
 * requests and consecutive requests never repeat `previousKey`.
 */
export function buildCase(
  content: TravelSuitcaseContent,
  plan: SuitcasePlan,
  previousKey: string | null = null,
  rng: () => number = Math.random,
  lang: Lang = 'en',
): BuiltCase {
  const requests: BuiltRequest[] = [];
  const usedItemIds: string[] = [];
  let prev = previousKey;

  for (let i = 0; i < plan.requestsPerCase; i++) {
    const built = buildRequest(content, plan, prev, rng, usedItemIds, lang);
    requests.push(built);
    prev = built.request.key;
    for (const id of built.request.targetItemIds) usedItemIds.push(id);
  }

  return { requests, requestsPerCase: plan.requestsPerCase };
}

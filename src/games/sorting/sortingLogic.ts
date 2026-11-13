// Pure Sorting Beds logic (no Phaser, no DOM). Spec: docs/specs/sorting-beds.md. Contract: docs/contracts/sorting-beds.md.
//
// TDD step 2: every exported algorithm is real; the signatures are unchanged from the step-1 stub.
// Two owner decisions (2026-11-13) are isolated in L8_SWITCHED_WORDS and L8_POST_SWITCH_COLOR_VARIES below.
import type { LevelDescriptor } from '../../content/schema';
import type { TrialResult } from '../../core/adaptive';
import type { Lang } from '../templates/choiceServe';
import type { FlowerColor, FlowerShape, FlowerSize, SortAttribute, SortRule, SortingBedInfo } from './types';

/** Values per attribute, in the order the art and the voice table use them. */
export const ATTRIBUTE_VALUES = {
  color: ['red', 'yellow', 'blue'],
  shape: ['tulip', 'daisy', 'round'],
  size: ['small', 'large'],
} as const satisfies Record<SortAttribute, readonly string[]>;

/** Visit attribute order for `extra.attributes: 1` levels (colour, then shape, then size, then again). */
export const VISIT_ATTRIBUTE_CYCLE: readonly SortAttribute[] = ['color', 'shape', 'size'];

/** After a wrong bed tap, bed taps are ignored for this long (same value as the restaurant). */
export const WRONG_TAP_LOCK_MS = 400;

/** L8: the rule switches after this many placements of the round (1 flower before, 2 after). */
export const RULE_SWITCH_AFTER_PLACEMENTS = 1;

export interface FlowerSpec {
  shape: FlowerShape;
  color: FlowerColor;
  size: FlowerSize;
}

export type BedAccepts = SortingBedInfo['accepts'];

/** Item id of a flower variant: '<shape>-<color>-<size>' (18 items). */
export function flowerId(flower: FlowerSpec): string {
  return `${flower.shape}-${flower.color}-${flower.size}`;
}

/** The levers Sorting Beds reads from a content level descriptor. */
export interface LevelLevers {
  choiceCount: number;
  attributes: 1 | 2;
  vary: 0 | 1 | 2;
  scaffold: 'outline' | 'symbol' | 'none' | null;
  pictureAudio: boolean;
  ruleSwitch: boolean;
}

/** Reads the levers from a validated level (see SortingBedsContentSchema). Real: it only maps content fields. */
export function levelLevers(level: LevelDescriptor): LevelLevers {
  return {
    choiceCount: level.choiceCount ?? 2,
    attributes: level.extra?.attributes === 2 ? 2 : 1,
    vary: level.extra?.vary === 2 ? 2 : level.extra?.vary === 1 ? 1 : 0,
    scaffold: level.scaffold ?? null,
    pictureAudio: level.support === 'picture-audio',
    ruleSwitch: level.request === 'rule-switch',
  };
}

// ---------------------------------------------------------------------------------------------
// AC-21: rule per round
// ---------------------------------------------------------------------------------------------

/**
 * Attribute that defines the beds for a whole visit at `extra.attributes: 1` levels.
 * Cycles colour -> shape -> size across visits (`visitIndex` 0, 1, 2, 3, ...). Size has 2 values, so it is
 * never chosen when `choiceCount >= 3`; at 3+ beds the visit falls back to colour or shape.
 */
export function visitAttribute(visitIndex: number, choiceCount: number): SortAttribute {
  const n = VISIT_ATTRIBUTE_CYCLE.length;
  const index = ((Math.floor(visitIndex) % n) + n) % n;
  const attr = VISIT_ATTRIBUTE_CYCLE[index];
  if (attr === 'size' && choiceCount > ATTRIBUTE_VALUES.size.length) {
    // Size has 2 values: at 3+ beds fall back to the next of colour or shape in the cycle.
    return VISIT_ATTRIBUTE_CYCLE[(index + 1) % n] === 'size' ? 'color' : VISIT_ATTRIBUTE_CYCLE[(index + 1) % n];
  }
  return attr;
}

function valuesOf(attr: SortAttribute): readonly string[] {
  return ATTRIBUTE_VALUES[attr];
}

export interface RuleForRound {
  rule: SortRule;
  /** Beds shown: min(choiceCount, values(attribute)) for one attribute, 4 for conjunction rounds. */
  bedCount: number;
}

/**
 * The rule and bed count of round `roundIndex` (0-based within the visit).
 * - attributes 1: the visit attribute for every round; beds = min(choiceCount, values).
 * - attributes 2 with choiceCount < 4 (L5): rounds alternate colour (round 0), size, colour, ...; beds = min(choiceCount, values).
 * - attributes 2 with choiceCount >= 4 (L6-L8): 'size+color' with 4 beds.
 */
export function ruleForRound(levers: LevelLevers, roundIndex: number, visitAttr: SortAttribute): RuleForRound {
  if (levers.attributes === 1) {
    return { rule: visitAttr, bedCount: Math.min(levers.choiceCount, valuesOf(visitAttr).length) };
  }
  if (levers.choiceCount < 4) {
    const attr: SortAttribute = roundIndex % 2 === 0 ? 'color' : 'size';
    return { rule: attr, bedCount: Math.min(levers.choiceCount, valuesOf(attr).length) };
  }
  return { rule: 'size+color', bedCount: 4 };
}

function pickIndex(random: () => number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

function pick<T>(random: () => number, items: readonly T[]): T {
  return items[pickIndex(random, items.length)];
}

function shuffled<T>(random: () => number, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(random, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** Picks 2 distinct colours of the 3 for a conjunction round. */
export function pickConjunctionColors(random: () => number): [FlowerColor, FlowerColor] {
  const colors = ATTRIBUTE_VALUES.color;
  const first = pickIndex(random, colors.length);
  const second = (first + 1 + pickIndex(random, colors.length - 1)) % colors.length;
  return [colors[first], colors[second]];
}

/** The 4 size x colour beds of a conjunction round: small and large of each of the 2 colours. */
export function conjunctionBeds(colors: readonly [FlowerColor, FlowerColor]): BedAccepts[] {
  return colors.flatMap((color) => ATTRIBUTE_VALUES.size.map((size): BedAccepts => ({ size, color })));
}

// ---------------------------------------------------------------------------------------------
// AC-22: bed labels and scaffolds per level
// ---------------------------------------------------------------------------------------------

export interface BedPresentation {
  /** `picture` L1-L3, `symbol` L4-L6, `none` L7-L8. */
  label: SortingBedInfo['label'];
  /** Scaffold 'outline' (L2-L3). */
  ghostSlots: boolean;
  /** One pre-planted example flower per bed (L7-L8). */
  exampleFlowers: boolean;
}

/** Presentation of a level's beds (from its `support` and `scaffold`). */
export function bedPresentation(level: LevelDescriptor): BedPresentation {
  if (level.scaffold === 'none') return { label: 'none', ghostSlots: false, exampleFlowers: true };
  if (level.scaffold === 'symbol') return { label: 'symbol', ghostSlots: false, exampleFlowers: false };
  if (level.support === 'picture-audio') {
    return { label: 'picture', ghostSlots: level.scaffold === 'outline', exampleFlowers: false };
  }
  return { label: 'symbol', ghostSlots: false, exampleFlowers: false };
}

// ---------------------------------------------------------------------------------------------
// AC-32: round composition
// ---------------------------------------------------------------------------------------------

export interface BuildRoundParams {
  levers: LevelLevers;
  roundIndex: number;
  visitAttribute: SortAttribute;
  /** Flowers in the round (the adaptive `trialsPerRound`, 3). */
  flowerCount: number;
  random: () => number;
  /** Optional flower id (shape-color-size) the round should start with (the engine's known item). */
  preferredFirst?: string;
}

export interface RoundBedPlan {
  id: string;
  /** Under the rule the round starts with. */
  accepts: BedAccepts;
  /** L8 only: what the bed accepts after the switch (size x shape); null otherwise. */
  acceptsAfterSwitch: BedAccepts | null;
  /** Pre-planted example flower (L7-L8), else null. Never counts toward capacity. */
  example: FlowerSpec | null;
  /** Round flowers that belong to this bed under the rule in force when each is the current item. */
  capacity: number;
}

export interface RoundFlowerPlan extends FlowerSpec {
  id: string;
  /** The bed it belongs to under the rule in force when this flower is the current item. */
  targetBedId: string;
}

export interface RoundPlan {
  rule: SortRule;
  /** 'size+shape' on L8 rounds, else null. */
  ruleAfterSwitch: SortRule | null;
  /** Placements before the switch (1) on L8 rounds, else null. */
  switchAfter: number | null;
  beds: RoundBedPlan[];
  flowers: RoundFlowerPlan[];
}

/**
 * Builds one round: beds, example flowers (L7-L8) and `flowerCount` flowers such that
 * - the flowers target at least 2 different beds, each flower matches exactly one bed under the rule in force;
 * - a bed's capacity equals the flowers that target it (examples excluded);
 * - non-rule attributes vary per `levers.vary`, capped at the attributes left (conjunction rounds: only shape is left);
 * - L8: the four examples are distinct under 'size+color' and under 'size+shape'; flower 0 is placed under the
 *   first rule and flowers 1.. under the switched rule.
 */
export function buildRound(params: BuildRoundParams): RoundPlan {
  const { levers, roundIndex, random } = params;
  const flowerCount = Math.max(0, Math.floor(params.flowerCount));
  const { rule, bedCount } = ruleForRound(levers, roundIndex, params.visitAttribute);
  const ruleSwitch = levers.ruleSwitch && rule === 'size+color';
  const withExamples = levers.scaffold === 'none';
  const preferred = parseFlowerId(params.preferredFirst);

  // Beds under the starting rule.
  let accepts: BedAccepts[];
  if (rule === 'size+color') {
    const colors = pickConjunctionColors(random);
    if (preferred && !colors.includes(preferred.color)) colors[1] = preferred.color;
    accepts = conjunctionBeds(colors);
  } else {
    const attr = rule as SortAttribute;
    const values = valuesOf(attr);
    const chosen = bedCount >= values.length ? values.slice() : shuffled(random, values).slice(0, bedCount);
    // The preferred first flower needs a bed: make sure its value is one of the chosen beds.
    if (preferred && !chosen.includes(preferred[attr])) chosen[chosen.length - 1] = preferred[attr];
    // Keep the art/voice order of the values so beds read left to right consistently.
    chosen.sort((a, b) => values.indexOf(a) - values.indexOf(b));
    accepts = chosen.map((value): BedAccepts => ({ [attr]: value }) as BedAccepts);
  }

  // L8: post-switch shapes. Per size the two colour beds get two different shapes, so the four examples are
  // distinct under size x colour and under size x shape.
  let switchShapes: FlowerShape[] | null = null;
  if (ruleSwitch) {
    const [s1, s2] = shuffled(random, ATTRIBUTE_VALUES.shape);
    const [l1, l2] = shuffled(random, ATTRIBUTE_VALUES.shape);
    // accepts order from conjunctionBeds: [small c1, large c1, small c2, large c2]
    switchShapes = [s1, l1, s2, l2];
  }

  const beds: RoundBedPlan[] = accepts.map((bedAccepts, i) => {
    const afterSwitch: BedAccepts | null = switchShapes ? { size: bedAccepts.size, shape: switchShapes[i] } : null;
    let example: FlowerSpec | null = null;
    if (withExamples) {
      example = {
        shape: afterSwitch?.shape ?? bedAccepts.shape ?? pick(random, ATTRIBUTE_VALUES.shape),
        color: bedAccepts.color ?? pick(random, ATTRIBUTE_VALUES.color),
        size: bedAccepts.size ?? pick(random, ATTRIBUTE_VALUES.size),
      };
    }
    return { id: `bed-${i}`, accepts: bedAccepts, acceptsAfterSwitch: afterSwitch, example, capacity: 0 };
  });

  // Targets: at least 2 different beds over the round (when there are 2+ flowers).
  const targets: number[] = [];
  if (beds.length > 0) {
    const order = shuffled(random, beds.map((_, i) => i));
    const preferredBed = preferred ? beds.findIndex((b) => flowerMatches(b.accepts, preferred)) : -1;
    if (preferredBed >= 0) {
      order.splice(order.indexOf(preferredBed), 1);
      order.unshift(preferredBed);
    }
    for (let i = 0; i < flowerCount; i++) {
      targets.push(i < Math.min(2, order.length) ? order[i] : pickIndex(random, beds.length));
    }
  }
  const targetOrder = shuffled(random, targets);
  if (preferred && targetOrder.length > 0) {
    const at = targetOrder.indexOf(beds.findIndex((b) => flowerMatches(b.accepts, preferred)));
    if (at > 0) [targetOrder[0], targetOrder[at]] = [targetOrder[at], targetOrder[0]];
  }

  const switchAfter = ruleSwitch ? RULE_SWITCH_AFTER_PLACEMENTS : null;
  const ruleAt = (index: number): SortRule => (switchAfter !== null && index >= switchAfter ? 'size+shape' : rule);

  // Non-rule attributes: which ones vary this round (per extra.vary, capped at what is left), and constants for the rest.
  const allAttrs: SortAttribute[] = ['color', 'shape', 'size'];
  const nonRuleStart = allAttrs.filter((a) => !rulesAttributes(rule).includes(a));
  const varyCount = Math.min(levers.vary, nonRuleStart.length);
  const varying = new Set(shuffled(random, nonRuleStart).slice(0, varyCount));
  if (switchAfter !== null && L8_POST_SWITCH_COLOR_VARIES) varying.add('color'); // only read after the switch
  const constants: FlowerSpec = {
    color: pick(random, accepts[0]?.color ? accepts.map((a) => a.color as FlowerColor) : ATTRIBUTE_VALUES.color),
    shape: pick(random, ATTRIBUTE_VALUES.shape),
    size: pick(random, ATTRIBUTE_VALUES.size),
  };
  if (preferred) Object.assign(constants, preferred); // non-varying attributes stay constant, at the preferred flower's values
  const roundColors = rule === 'size+color' ? Array.from(new Set(accepts.map((a) => a.color as FlowerColor))) : null;

  const specs: FlowerSpec[] = targetOrder.map((bedIndex, index) => {
    const bed = beds[bedIndex];
    const bedRule = ruleAt(index);
    const bedAccepts = bedRule === 'size+shape' ? (bed.acceptsAfterSwitch as BedAccepts) : bed.accepts;
    const free = (attr: SortAttribute): string => {
      if (!varying.has(attr)) return constants[attr];
      if (attr === 'color' && roundColors) return pick(random, roundColors);
      return pick(random, valuesOf(attr));
    };
    return {
      color: (bedAccepts.color ?? free('color')) as FlowerColor,
      shape: (bedAccepts.shape ?? free('shape')) as FlowerShape,
      size: (bedAccepts.size ?? free('size')) as FlowerSize,
    };
  });

  if (preferred && specs.length > 0) specs[0] = { ...preferred };

  // A varying attribute must really vary: if all flowers drew the same value, change one free flower.
  for (const attr of varying) {
    const freeIdx = specs.map((_, i) => i).filter((i) => !rulesAttributes(ruleAt(i)).includes(attr));
    if (freeIdx.length < 2) continue;
    const seen = new Set(freeIdx.map((i) => specs[i][attr]));
    if (seen.size > 1) continue;
    const pool = attr === 'color' && roundColors ? roundColors : valuesOf(attr);
    const other = pool.find((v) => !seen.has(v as never));
    const last = freeIdx[freeIdx.length - 1];
    if (other !== undefined) specs[last] = { ...specs[last], [attr]: other } as FlowerSpec;
  }

  const flowers: RoundFlowerPlan[] = specs.map((spec, index) => ({
    ...spec,
    id: flowerId(spec),
    targetBedId: beds[targetOrder[index]].id,
  }));
  for (const bed of beds) bed.capacity = flowers.filter((f) => f.targetBedId === bed.id).length;

  return {
    rule,
    ruleAfterSwitch: ruleSwitch ? 'size+shape' : null,
    switchAfter,
    beds,
    flowers,
  };
}

/** The part of SkillSession the first-flower choice needs. */
export interface FirstFlowerSkills {
  selectNextItem(lang: string, candidates: readonly string[]): string;
}

/** All 18 flower ids ('<shape>-<color>-<size>'). */
export const ALL_FLOWER_IDS: readonly string[] = ATTRIBUTE_VALUES.shape.flatMap((shape) =>
  ATTRIBUTE_VALUES.color.flatMap((color) => ATTRIBUTE_VALUES.size.map((size) => `${shape}-${color}-${size}`)),
);

/** Parses a flower id; null when it is missing or not one of the 18 variants. */
export function parseFlowerId(id: string | undefined): FlowerSpec | null {
  if (!id || !ALL_FLOWER_IDS.includes(id)) return null;
  const [shape, color, size] = id.split('-') as [FlowerShape, FlowerColor, FlowerSize];
  return { shape, color, size };
}

/**
 * The flower a round starts with, chosen by the engine like the restaurant's food. `selectNextItem` over all 18
 * flowers returns a known (mastered) flower right after a level drop and clears the after-drop flag; otherwise it
 * schedules due, retry, new and seen flowers. Only the first flower of a round is engine-chosen (the others must
 * target the round's beds). `familiarItemIds` is not needed: there is no secondary slot, and the engine already
 * restricts the after-drop choice to known items. Feed the result to `buildRound({ preferredFirst })`.
 */
export function chooseFirstFlower(skills: FirstFlowerSkills, lang: string): string {
  return skills.selectNextItem(lang, ALL_FLOWER_IDS);
}

/** Attributes a rule sorts by. */
export function rulesAttributes(rule: SortRule): SortAttribute[] {
  if (rule === 'size+color') return ['size', 'color'];
  if (rule === 'size+shape') return ['size', 'shape'];
  return [rule];
}

/** Does a flower belong in a bed with these accepts? */
export function flowerMatches(accepts: BedAccepts, flower: FlowerSpec): boolean {
  return (
    (accepts.color === undefined || accepts.color === flower.color) &&
    (accepts.shape === undefined || accepts.shape === flower.shape) &&
    (accepts.size === undefined || accepts.size === flower.size)
  );
}

/**
 * Owner decision (2026-11-13, ambiguity 2): `extra.vary: 2` also applies at L8. Before the switch only shape is left,
 * so shape varies; after the switch only colour is left, so colour varies too (drawn from the round's two colours).
 * Flip to false to hold colour constant after the switch.
 */
export const L8_POST_SWITCH_COLOR_VARIES = true;

// ---------------------------------------------------------------------------------------------
// AC-24 / AC-27: one result per trial
// ---------------------------------------------------------------------------------------------

/**
 * Per-trial bookkeeping, same semantics as the restaurant `TrialTracker`:
 * - `onHint()` (idle hint) marks the trial hinted until the trial is recorded;
 * - `onBedTap(correct)` yields the result to record at most once per trial (first tap wins), else null;
 * - `onReplay()` (tap on the basket flower) is a voluntary replay and never a hint.
 */
export class SortingTrialTracker {
  constructor(
    readonly itemId: string,
    readonly language: Lang,
  ) {}

  private hinted = false;
  private recorded = false;

  onHint(): void {
    if (!this.recorded) this.hinted = true;
  }

  onBedTap(correct: boolean): TrialResult | null {
    if (this.recorded) return null;
    this.recorded = true;
    return { itemId: this.itemId, firstTryCorrect: correct, hinted: this.hinted };
  }

  /** A voluntary replay of the rule line: never a hint. */
  onReplay(): void {}

  get isHinted(): boolean {
    return this.hinted;
  }

  get isRecorded(): boolean {
    return this.recorded;
  }
}

// ---------------------------------------------------------------------------------------------
// AC-09 / AC-31: voice lines
// ---------------------------------------------------------------------------------------------

export interface LineRequest {
  lineId: string;
  lang: 'he' | Lang;
}

/**
 * Round-start rule line: `sorting.rule.<attribute>.he`, or `sorting.rule.two-attr.he` for 'size+color'.
 * After the L8 switch ('size+shape') the rule in force is described by the switch line, so a replay repeats that.
 */
export function ruleLine(rule: SortRule): LineRequest {
  if (rule === 'size+color') return { lineId: 'sorting.rule.two-attr.he', lang: 'he' };
  if (rule === 'size+shape') return switchLine(rule);
  return { lineId: `sorting.rule.${rule}.he`, lang: 'he' };
}

/** L8 switch line: `sorting.switch.shape.he` when the new rule is 'size+shape'. */
export function switchLine(newRule: SortRule): LineRequest {
  const attr = newRule === 'size+shape' ? 'shape' : newRule === 'size+color' ? 'color' : newRule;
  return { lineId: `sorting.switch.${attr}.he`, lang: 'he' };
}

/**
 * Owner decision (2026-11-13, ambiguity 1): after the L8 switch to size x shape, Pass 1 speaks only the size token.
 * The shape is shown only visually (the example flower in each bed); Pass 1 has no shape words.
 */
export const L8_SWITCHED_WORDS: readonly SortAttribute[] = ['size'];

/**
 * English or French learning tokens spoken after a correct placement, one request per token:
 * colour rule -> colour word; size rule -> size word ('large' is spoken as `big`); 'size+color' -> size word then colour word;
 * shape rule -> none (Pass 1 has no shape words). Line id: `sorting.word.<value>.<lang>`.
 */
export function placementWordLines(rule: SortRule, flower: FlowerSpec, lang: Lang): LineRequest[] {
  const word = (attr: SortAttribute): LineRequest | null => {
    if (attr === 'color') return { lineId: `sorting.word.${flower.color}.${lang}`, lang };
    if (attr === 'size') return { lineId: `sorting.word.${flower.size === 'large' ? 'big' : 'small'}.${lang}`, lang };
    return null; // no shape words in Pass 1
  };
  const attrs: readonly SortAttribute[] = rule === 'size+shape' ? L8_SWITCHED_WORDS : rulesAttributes(rule);
  return attrs.map(word).filter((l): l is LineRequest => l !== null);
}

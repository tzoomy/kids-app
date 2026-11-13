// Pure Sorting Beds logic (no Phaser, no DOM). Spec: docs/specs/sorting-beds.md. Contract: docs/contracts/sorting-beds.md.
//
// TDD step 1: the CONSTANTS and the trivial data helpers below are real. Every function marked STUB
// returns a deliberately empty or incorrect result so the Pass 1 AC unit tests fail on assertions.
// Step 2 replaces the STUB bodies with the real algorithms and keeps every signature stable.
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
 * STUB. Attribute that defines the beds for a whole visit at `extra.attributes: 1` levels.
 * Cycles colour -> shape -> size across visits (`visitIndex` 0, 1, 2, 3, ...). Size has 2 values, so it is
 * never chosen when `choiceCount >= 3`; at 3+ beds the visit falls back to colour or shape.
 */
export function visitAttribute(_visitIndex: number, _choiceCount: number): SortAttribute {
  return 'color';
}

export interface RuleForRound {
  rule: SortRule;
  /** Beds shown: min(choiceCount, values(attribute)) for one attribute, 4 for conjunction rounds. */
  bedCount: number;
}

/**
 * STUB. The rule and bed count of round `roundIndex` (0-based within the visit).
 * - attributes 1: the visit attribute for every round; beds = min(choiceCount, values).
 * - attributes 2 with choiceCount < 4 (L5): rounds alternate colour (round 0), size, colour, ...; beds = min(choiceCount, values).
 * - attributes 2 with choiceCount >= 4 (L6-L8): 'size+color' with 4 beds.
 */
export function ruleForRound(_levers: LevelLevers, _roundIndex: number, _visitAttr: SortAttribute): RuleForRound {
  return { rule: 'color', bedCount: 0 };
}

/** STUB. Picks 2 distinct colours of the 3 for a conjunction round. */
export function pickConjunctionColors(_random: () => number): [FlowerColor, FlowerColor] {
  return ['red', 'red'];
}

/** STUB. The 4 size x colour beds of a conjunction round: small and large of each of the 2 colours. */
export function conjunctionBeds(_colors: readonly [FlowerColor, FlowerColor]): BedAccepts[] {
  return [];
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

/** STUB. Presentation of a level's beds (from its `support` and `scaffold`). */
export function bedPresentation(_level: LevelDescriptor): BedPresentation {
  return { label: 'none', ghostSlots: false, exampleFlowers: false };
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
 * STUB. Builds one round: beds, example flowers (L7-L8) and `flowerCount` flowers such that
 * - the flowers target at least 2 different beds, each flower matches exactly one bed under the rule in force;
 * - a bed's capacity equals the flowers that target it (examples excluded);
 * - non-rule attributes vary per `levers.vary`, capped at the attributes left (conjunction rounds: only shape is left);
 * - L8: the four examples are distinct under 'size+color' and under 'size+shape'; flower 0 is placed under the
 *   first rule and flowers 1.. under the switched rule.
 */
export function buildRound(_params: BuildRoundParams): RoundPlan {
  return { rule: 'color', ruleAfterSwitch: null, switchAfter: null, beds: [], flowers: [] };
}

// ---------------------------------------------------------------------------------------------
// AC-24 / AC-27: one result per trial
// ---------------------------------------------------------------------------------------------

/**
 * STUB. Per-trial bookkeeping, same semantics as the restaurant `TrialTracker`:
 * - `onHint()` (idle hint) marks the trial hinted until the trial is recorded;
 * - `onBedTap(correct)` yields the result to record at most once per trial (first tap wins), else null;
 * - `onReplay()` (tap on the basket flower) is a voluntary replay and never a hint.
 */
export class SortingTrialTracker {
  constructor(
    readonly itemId: string,
    readonly language: Lang,
  ) {}

  onHint(): void {}

  onBedTap(_correct: boolean): TrialResult | null {
    return null;
  }

  onReplay(): void {}
}

// ---------------------------------------------------------------------------------------------
// AC-09 / AC-31: voice lines
// ---------------------------------------------------------------------------------------------

export interface LineRequest {
  lineId: string;
  lang: 'he' | Lang;
}

/** STUB. Round-start rule line: `sorting.rule.<attribute>.he`, or `sorting.rule.two-attr.he` for 'size+color'. */
export function ruleLine(_rule: SortRule): LineRequest {
  return { lineId: '', lang: 'he' };
}

/** STUB. L8 switch line: `sorting.switch.shape.he` when the new rule is 'size+shape'. */
export function switchLine(_newRule: SortRule): LineRequest {
  return { lineId: '', lang: 'he' };
}

/**
 * STUB. English or French learning tokens spoken after a correct placement, one request per token:
 * colour rule -> colour word; size rule -> size word ('large' is spoken as `big`); 'size+color' -> size word then colour word;
 * shape rule -> none (Pass 1 has no shape words). Line id: `sorting.word.<value>.<lang>`.
 */
export function placementWordLines(_rule: SortRule, _flower: FlowerSpec, _lang: Lang): LineRequest[] {
  return [];
}

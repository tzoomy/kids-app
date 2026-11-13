// Sorting Beds Pass 1, TDD step 1: content, language selection, voice lines and bed presentation (AC-09, AC-22).
import { describe, expect, it } from 'vitest';
import { loadSortingBeds } from '@/content/loadContent';
import { SortingBedsContentSchema } from '@/content/schema';
import { skillKey } from '@/core/adaptive';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';
import {
  bedPresentation,
  placementWordLines,
  ruleLine,
  switchLine,
  type FlowerSpec,
} from '@/games/sorting/sortingLogic';
import sortingBedsJson from '@/content/games/sorting-beds.json';

const content = loadSortingBeds();
const levels = content.adaptive.levels;

function clonedJson(): Record<string, unknown> {
  return JSON.parse(JSON.stringify(sortingBedsJson)) as Record<string, unknown>;
}

/** The content JSON with one level patched, parsed through the real schema. */
function parseWithLevel(index: number, patch: Record<string, unknown>) {
  const json = clonedJson() as { adaptive: { levels: Array<Record<string, unknown>> } };
  json.adaptive.levels[index] = { ...json.adaptive.levels[index], ...patch };
  return SortingBedsContentSchema.safeParse(json);
}

describe('sorting-beds: content and language selection (AC-09)', () => {
  it('[AC-09] the content file is Number Garden, sorting-beds, in English and French, with the decided age tracks', () => {
    expect(content.world).toBe('number-garden');
    expect(content.id).toBe('sorting-beds');
    expect(content.languages).toEqual(['en', 'fr']);
    expect(content.ageTracks.age2).toEqual({ hintMode: 'demonstrate', hintDelayMs: 6000 });
    expect(content.ageTracks.age5).toEqual({ hintMode: 'repeat-then-demonstrate', hintDelayMs: 8000 });
  });

  it('[AC-09] each language feeds its own skill, keyed number-garden.sorting-beds.<lang>', () => {
    expect(skillKey(content.world, content.id, 'en')).toBe('number-garden.sorting-beds.en');
    expect(skillKey(content.world, content.id, 'fr')).toBe('number-garden.sorting-beds.fr');
  });

  it('[AC-09] the round language comes from the parent setting and stays fixed for the round', () => {
    expect(nextRoundLanguage(null, true, 'en')).toBe('en');
    expect(nextRoundLanguage(null, true, 'fr')).toBe('fr');
    // Mid-round with both languages enabled: keep the round language whatever the dice say.
    expect(nextRoundLanguage('fr', false, 'both', () => 0)).toBe('fr');
    expect(nextRoundLanguage('en', false, 'both', () => 0.99)).toBe('en');
    // The parent disabled the current language mid-round: re-pick.
    expect(nextRoundLanguage('en', false, 'fr')).toBe('fr');
  });

  it('[AC-09] the rule line is Hebrew: one attribute rounds name it, conjunction rounds use the two-attribute line', () => {
    expect(ruleLine('color')).toEqual({ lineId: 'sorting.rule.color.he', lang: 'he' });
    expect(ruleLine('shape')).toEqual({ lineId: 'sorting.rule.shape.he', lang: 'he' });
    expect(ruleLine('size')).toEqual({ lineId: 'sorting.rule.size.he', lang: 'he' });
    expect(ruleLine('size+color')).toEqual({ lineId: 'sorting.rule.two-attr.he', lang: 'he' });
  });

  it('[AC-09] the L8 switch is announced with the shape switch line', () => {
    expect(switchLine('size+shape')).toEqual({ lineId: 'sorting.switch.shape.he', lang: 'he' });
  });

  it('[AC-09] a colour round speaks the colour token in the round language, for every flower of the round', () => {
    const flowers: FlowerSpec[] = [
      { shape: 'tulip', color: 'red', size: 'small' },
      { shape: 'daisy', color: 'yellow', size: 'large' },
      { shape: 'round', color: 'blue', size: 'small' },
    ];
    const expectedIds = ['sorting.word.red.fr', 'sorting.word.yellow.fr', 'sorting.word.blue.fr'];
    flowers.forEach((flower, i) => {
      expect(placementWordLines('color', flower, 'fr')).toEqual([{ lineId: expectedIds[i], lang: 'fr' }]);
    });
    expect(placementWordLines('color', flowers[0], 'en')).toEqual([{ lineId: 'sorting.word.red.en', lang: 'en' }]);
  });

  it('[AC-09] a size round speaks the size token (large is spoken as big), a shape round speaks no token', () => {
    const large: FlowerSpec = { shape: 'daisy', color: 'red', size: 'large' };
    const small: FlowerSpec = { shape: 'daisy', color: 'red', size: 'small' };
    expect(placementWordLines('size', large, 'en')).toEqual([{ lineId: 'sorting.word.big.en', lang: 'en' }]);
    expect(placementWordLines('size', small, 'fr')).toEqual([{ lineId: 'sorting.word.small.fr', lang: 'fr' }]);
    expect(placementWordLines('shape', large, 'en')).toEqual([]);
  });

  it('[AC-09] a conjunction round speaks the size token, then the colour token, as two separate line requests', () => {
    const flower: FlowerSpec = { shape: 'tulip', color: 'yellow', size: 'large' };
    expect(placementWordLines('size+color', flower, 'fr')).toEqual([
      { lineId: 'sorting.word.big.fr', lang: 'fr' },
      { lineId: 'sorting.word.yellow.fr', lang: 'fr' },
    ]);
  });

  it('[AC-09] after the L8 switch to size x shape, Pass 1 speaks only the size token; no shape word', () => {
    const large: FlowerSpec = { shape: 'tulip', color: 'yellow', size: 'large' };
    const small: FlowerSpec = { shape: 'daisy', color: 'red', size: 'small' };
    expect(placementWordLines('size+shape', large, 'en')).toEqual([{ lineId: 'sorting.word.big.en', lang: 'en' }]);
    expect(placementWordLines('size+shape', small, 'fr')).toEqual([{ lineId: 'sorting.word.small.fr', lang: 'fr' }]);
    // Shape is carried visually by the example flower; Pass 1 never requests a shape-word line.
    for (const flower of [large, small]) {
      const ids = placementWordLines('size+shape', flower, 'en').map((l) => l.lineId);
      expect(ids.some((id) => /tulip|daisy|round|shape/.test(id))).toBe(false);
      expect(ids).toHaveLength(1);
    }
  });
});

describe('sorting-beds: bed labels, scaffolds and content validation (AC-22)', () => {
  it('[AC-22] the level table encodes support, scaffold and extra per level', () => {
    expect(levels).toHaveLength(8);
    const table = levels.map((l) => ({
      beds: l.choiceCount,
      support: l.support ?? null,
      scaffold: l.scaffold ?? null,
      attributes: l.extra?.attributes,
      vary: l.extra?.vary,
      request: l.request ?? null,
    }));
    expect(table).toEqual([
      { beds: 2, support: 'picture-audio', scaffold: null, attributes: 1, vary: 0, request: null },
      { beds: 2, support: 'picture-audio', scaffold: 'outline', attributes: 1, vary: 1, request: null },
      { beds: 3, support: 'picture-audio', scaffold: 'outline', attributes: 1, vary: 2, request: null },
      { beds: 3, support: null, scaffold: 'symbol', attributes: 1, vary: 2, request: null },
      { beds: 3, support: null, scaffold: 'symbol', attributes: 2, vary: 2, request: null },
      { beds: 4, support: null, scaffold: 'symbol', attributes: 2, vary: 2, request: null },
      { beds: 4, support: null, scaffold: 'none', attributes: 2, vary: 2, request: null },
      { beds: 4, support: null, scaffold: 'none', attributes: 2, vary: 2, request: 'rule-switch' },
    ]);
  });

  it('[AC-22] L1-L3 show picture labels; only L2-L3 add ghost slots', () => {
    const shown = [0, 1, 2].map((i) => bedPresentation(levels[i]));
    expect(shown.map((p) => p.label)).toEqual(['picture', 'picture', 'picture']);
    expect(shown.map((p) => p.ghostSlots)).toEqual([false, true, true]);
    expect(shown.map((p) => p.exampleFlowers)).toEqual([false, false, false]);
  });

  it('[AC-22] L4-L6 show the symbol on the plaque only: no ghost slots, no example flowers', () => {
    for (const i of [3, 4, 5]) {
      expect(bedPresentation(levels[i])).toEqual({ label: 'symbol', ghostSlots: false, exampleFlowers: false });
    }
  });

  it('[AC-22] L7-L8 have blank plaques and one example flower per bed', () => {
    for (const i of [6, 7]) {
      expect(bedPresentation(levels[i])).toEqual({ label: 'none', ghostSlots: false, exampleFlowers: true });
    }
  });

  it('[AC-22] the schema accepts the shipped content', () => {
    expect(SortingBedsContentSchema.safeParse(clonedJson()).success).toBe(true);
  });

  it('[AC-22] the schema rejects any support other than picture-audio', () => {
    for (const support of ['audio-only', 'lit', 'flash', 'clue', 'partial-reveal', 'audio-first']) {
      expect(parseWithLevel(0, { support }).success, support).toBe(false);
    }
  });

  it('[AC-22] the schema rejects any request other than rule-switch', () => {
    for (const request of ['noun', 'quantity', 'sequence', 'riddle', 'negation']) {
      expect(parseWithLevel(0, { request }).success, request).toBe(false);
    }
    expect(parseWithLevel(0, { request: 'rule-switch' }).success).toBe(true);
  });

  it('[AC-22] the schema requires extra.attributes in {1, 2} and extra.vary in {0, 1, 2}', () => {
    expect(parseWithLevel(0, { extra: { attributes: 3, vary: 0 } }).success).toBe(false);
    expect(parseWithLevel(0, { extra: { attributes: 0, vary: 0 } }).success).toBe(false);
    expect(parseWithLevel(0, { extra: { attributes: 1, vary: 3 } }).success).toBe(false);
    expect(parseWithLevel(0, { extra: { attributes: 1, vary: -1 } }).success).toBe(false);
    expect(parseWithLevel(0, { extra: { attributes: 1 } }).success).toBe(false);
    expect(parseWithLevel(0, { extra: { vary: 1 } }).success).toBe(false);
    expect(parseWithLevel(0, { extra: { attributes: 2, vary: 2 } }).success).toBe(true);
  });
});

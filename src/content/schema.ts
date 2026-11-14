import { z } from 'zod';
import { PALETTE } from '../assets/colors';

export const WorldStatusSchema = z.enum(['open', 'locked', 'leisure']);

export const WorldSchema = z.object({
  id: z.string().min(1),
  nameHe: z.string().min(1),
  status: WorldStatusSchema,
  earnsLeisure: z.boolean(),
  entryGameId: z.string().min(1).optional(),
});

export const WorldsFileSchema = z.object({
  worlds: z.array(WorldSchema).min(1),
});

export type World = z.infer<typeof WorldSchema>;
export type WorldsFile = z.infer<typeof WorldsFileSchema>;

const CountedPromptsSchema = z
  .object({ '1': z.string().min(1), '2': z.string().min(1).optional(), '3': z.string().min(1).optional() })
  .refine((p) => Boolean(p['1']), { message: 'count "1" prompt is required' });

const VariantPromptsSchema = z.object({
  /** Attribute request naming this colour, e.g. "I want the red apple, please!". */
  pick: z.string().min(1),
  /** Negation request excluding this colour; the answer is the item's other variant. */
  not: z.string().min(1),
});

/** One colour version of an item (used by the attribute and negation requests). */
export const ItemVariantSchema = z.object({
  color: z.string().min(1),
  en: VariantPromptsSchema,
  fr: VariantPromptsSchema,
});

export const RestaurantItemSchema = z.object({
  id: z.string().min(1),
  he: z.string().min(1),
  color: z.string().min(1),
  shape: z.string().min(1),
  /** Noun phrase with its article, used to compose two-item requests ("an apple", "une pomme"). */
  phrase: z.object({ en: z.string().min(1), fr: z.string().min(1) }),
  /** Exactly two colour versions, so a negation has a single answer. Optional. */
  variants: z.array(ItemVariantSchema).length(2).optional(),
  prompts: z.object({
    en: CountedPromptsSchema,
    fr: CountedPromptsSchema,
  }),
});

/** Request types the restaurant knows how to build and check. */
export const RESTAURANT_REQUESTS = ['noun', 'quantity', 'attribute', 'two-step', 'negation'] as const;
export type RestaurantRequest = (typeof RESTAURANT_REQUESTS)[number];

export const LevelDescriptorSchema = z
  .object({
    choiceCount: z.number().int().min(1).max(8).optional(),
    counts: z.array(z.number().int().min(1).max(10)).min(1).optional(),
    setSize: z.number().int().min(1).max(10).optional(),
    distractor: z.enum(['far', 'near', 'same-category', 'same-item-variant']).optional(),
    request: z
      .enum(['noun', 'quantity', 'attribute', 'two-step', 'negation', 'sequence', 'riddle', 'rule-switch'])
      .optional(),
    sequenceLength: z.number().int().min(1).max(6).optional(),
    support: z.enum(['picture-audio', 'partial-reveal', 'audio-first', 'audio-only', 'clue', 'lit', 'flash']).optional(),
    scaffold: z.enum(['outline', 'symbol', 'none']).optional(),
    speed: z.number().positive().optional(),
    extra: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(),
  })
  .strict();

export const TrackLevelsSchema = z.object({
  start: z.number().int().min(1),
  min: z.number().int().min(1).default(1),
  max: z.number().int().min(1),
});

export const AdaptiveRulesSchema = z
  .object({
    upCleanStreak: z.number().int().min(1),
    downMisses: z.number().int().min(1),
    downWindow: z.number().int().min(1),
    trialsPerRound: z.number().int().min(1),
    maxChangesPerRound: z.number().int().min(1),
    retryAfterTrials: z.number().int().min(1),
    masteredBox: z.number().int().min(2).max(5),
  })
  .partial();

export const GameAdaptiveSchema = z
  .object({
    tracks: z.object({ age2: TrackLevelsSchema, age5: TrackLevelsSchema }),
    rules: AdaptiveRulesSchema.optional(),
    levels: z.array(LevelDescriptorSchema).min(1),
  })
  .superRefine((value, ctx) => {
    for (const track of ['age2', 'age5'] as const) {
      const t = value.tracks[track];
      if (!(1 <= t.min && t.min <= t.start && t.start <= t.max && t.max <= value.levels.length)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['tracks', track],
          message: `track bounds must satisfy 1 <= min <= start <= max <= levels.length (${value.levels.length})`,
        });
      }
    }
  });

export const AgeTrackConfigSchema = z.object({
  hintMode: z.enum(['demonstrate', 'repeat-then-demonstrate']),
  hintDelayMs: z.number().int().positive(),
});

export const AnimalRestaurantContentSchema = z
  .object({
    id: z.literal('animal-restaurant'),
    world: z.string().min(1),
    template: z.literal('choice-serve'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({
      age2: AgeTrackConfigSchema,
      age5: AgeTrackConfigSchema,
    }),
    thanks: z.object({
      en: z.array(z.string().min(1)).min(1),
      fr: z.array(z.string().min(1)).min(1),
    }),
    helpTextHe: z.string().min(1),
    /** Frames for two-item requests; `{a}` and `{b}` are replaced by the items' noun phrases. */
    twoStepFrames: z.object({ en: z.string().min(1), fr: z.string().min(1) }),
    items: z.array(RestaurantItemSchema).min(1),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    for (const lang of ['en', 'fr'] as const) {
      const frame = value.twoStepFrames[lang];
      if (!frame.includes('{a}') || !frame.includes('{b}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['twoStepFrames', lang], message: 'frame needs {a} and {b}' });
      }
    }
    value.items.forEach((item, i) => {
      if (item.variants && item.variants.length === 2 && item.variants[0].color === item.variants[1].color) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['items', i, 'variants'], message: 'variant colours must differ' });
      }
      item.variants?.forEach((variant, v) => {
        if (!(variant.color in PALETTE) || variant.color === 'outline') {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', i, 'variants', v, 'color'],
            message: `variant colour "${variant.color}" is not in the shared palette`,
          });
        }
      });
    });
    const variantItems = value.items.filter((i) => i.variants).length;
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      if (level.request !== undefined && !(RESTAURANT_REQUESTS as readonly string[]).includes(level.request)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `restaurant does not support request "${level.request}"` });
      }
      if (level.support !== undefined && level.support !== 'audio-only') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'restaurant only supports support "audio-only"' });
      }
      if ((level.request === 'attribute' || level.request === 'negation') && variantItems < 1) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: `request "${level.request}" needs at least one item with colour variants` });
      }
      if (level.request === 'two-step' && ((level.choiceCount ?? 0) < 3 || value.items.length < 3)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'a two-item request needs choiceCount of at least 3 (one wrong plate) and 3+ items' });
      }
      if (level.choiceCount === undefined) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'restaurant levels require choiceCount' });
      } else if (level.choiceCount < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'restaurant levels require choiceCount of at least 2' });
      } else if (level.choiceCount > value.items.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'choiceCount exceeds the number of items' });
      }
      if (level.counts === undefined || level.counts.some((c) => c > 3)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'restaurant levels require counts within 1..3' });
      }
    });
  });

export type ItemVariant = z.infer<typeof ItemVariantSchema>;
export type RestaurantItem = z.infer<typeof RestaurantItemSchema>;
export type LevelDescriptor = z.infer<typeof LevelDescriptorSchema>;
export type GameAdaptive = z.infer<typeof GameAdaptiveSchema>;
export type AgeTrackConfig = z.infer<typeof AgeTrackConfigSchema>;
export type AnimalRestaurantContent = z.infer<typeof AnimalRestaurantContentSchema>;

export const ORCHESTRA_INSTRUMENT_IDS = ['pot', 'pan', 'glass-low', 'glass-mid', 'glass-high'] as const;
export type OrchestraInstrumentId = (typeof ORCHESTRA_INSTRUMENT_IDS)[number];
export const ORCHESTRA_SUPPORTS = ['lit', 'flash', 'audio-only'] as const;
export type OrchestraSupport = (typeof ORCHESTRA_SUPPORTS)[number];

export const OrchestraInstrumentSchema = z.object({
  id: z.enum(ORCHESTRA_INSTRUMENT_IDS),
  he: z.string().min(1),
  name: z.object({ en: z.string().min(1), fr: z.string().min(1) }),
  prompts: z.object({
    en: z.string().min(1),
    fr: z.string().min(1),
  }),
});

export const KitchenOrchestraContentSchema = z
  .object({
    id: z.literal('kitchen-orchestra'),
    world: z.literal('language-house'),
    template: z.literal('ordered-steps'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({
      age2: AgeTrackConfigSchema,
      age5: AgeTrackConfigSchema,
    }),
    thanks: z.object({
      en: z.array(z.string().min(1)).min(1),
      fr: z.array(z.string().min(1)).min(1),
    }),
    listenPrompt: z.object({ en: z.string().min(1), fr: z.string().min(1) }),
    yourTurnPrompt: z.object({ en: z.string().min(1), fr: z.string().min(1) }),
    retryPrompt: z.object({ en: z.string().min(1), fr: z.string().min(1) }),
    helpTextHe: z.string().min(1),
    instruments: z.array(OrchestraInstrumentSchema).min(3),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const ids = value.instruments.map((i) => i.id);
    if (new Set(ids).size !== ids.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['instruments'], message: 'instrument ids must be unique' });
    }
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      if (level.sequenceLength == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'orchestra levels need sequenceLength' });
      }
      if (level.choiceCount == null) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'orchestra levels need choiceCount' });
      } else if (level.choiceCount > value.instruments.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'choiceCount cannot exceed the instrument list' });
      } else if (level.choiceCount < 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'choiceCount must be at least 2' });
      }
      if (level.speed == null || level.speed <= 0) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'orchestra levels need a positive speed' });
      }
      if (level.support !== undefined && !ORCHESTRA_SUPPORTS.includes(level.support as OrchestraSupport)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'orchestra support must be lit, flash, or audio-only' });
      }
    });
  });

export type OrchestraInstrument = z.infer<typeof OrchestraInstrumentSchema>;
export type KitchenOrchestraContent = z.infer<typeof KitchenOrchestraContentSchema>;

/** Sorting Beds (docs/specs/sorting-beds.md): per-level extras are `attributes` (1|2) and `vary` (0|1|2). */
export const SortingBedsContentSchema = z
  .object({
    id: z.literal('sorting-beds'),
    world: z.literal('number-garden'),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    ageTracks: z.object({
      age2: AgeTrackConfigSchema,
      age5: AgeTrackConfigSchema,
    }),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      if (level.support !== undefined && level.support !== 'picture-audio') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'sorting beds only supports support "picture-audio"' });
      }
      if (level.request !== undefined && level.request !== 'rule-switch') {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'sorting beds only supports request "rule-switch"' });
      }
      if (level.choiceCount === undefined || level.choiceCount < 2 || level.choiceCount > 4) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'sorting beds levels require choiceCount within 2..4' });
      }
      const attributes = level.extra?.attributes;
      if (attributes !== 1 && attributes !== 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'sorting beds levels require extra.attributes of 1 or 2' });
      }
      const vary = level.extra?.vary;
      if (vary !== 0 && vary !== 1 && vary !== 2) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path, message: 'sorting beds levels require extra.vary of 0, 1, or 2' });
      }
    });
  });

export type SortingBedsContent = z.infer<typeof SortingBedsContentSchema>;



// ---------------------------------------------------------------------------
// Who's Hiding? (Nature Lab). Same choice/serve family as the restaurant: the child picks one of
// several bushes instead of a plate. Shares the generic level descriptor and adaptive block.
// ---------------------------------------------------------------------------

const LangPairSchema = z.object({ en: z.string().min(1), fr: z.string().min(1) });

/** What the spoken request contains: the name and the animal's sound, the name alone, or the sound alone. */
export const HIDING_SPEAK_MODES = ['name-sound', 'name', 'sound'] as const;
export type HidingSpeakMode = (typeof HIDING_SPEAK_MODES)[number];

export const HidingAnimalSchema = z.object({
  id: z.string().min(1),
  /** Registered animal rig / art kind (public/art/animals/<kind>). */
  kind: z.string().min(1),
  /** Look-alike group: `same-category` distractors come from the target's group first. */
  group: z.string().min(1),
  /** Noun phrase with its article ("the cat", "le chat"), spoken in the request. */
  name: LangPairSchema,
  /** Spoken sound word(s); device TTS reads them. */
  sound: LangPairSchema,
  /** Shorter sound used by levels with `extra.soundMs` (the last, hardest level). */
  soundShort: LangPairSchema,
  /** Descriptive clue, spoken as part of an audio-only hint. */
  clue: LangPairSchema,
});

export const WhosHidingContentSchema = z
  .object({
    id: z.literal('who-is-hiding'),
    world: z.string().min(1),
    template: z.literal('choice-serve'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    /** Request frames per speak mode; `{name}` and `{sound}` are replaced from the animal. */
    promptFrames: z.object({ 'name-sound': LangPairSchema, name: LangPairSchema, sound: LangPairSchema }),
    /** "Peekaboo!" lines spoken when the animal pops out. */
    found: z.object({ en: z.array(z.string().min(1)).min(1), fr: z.array(z.string().min(1)).min(1) }),
    helpTextHe: z.string().min(1),
    animals: z.array(HidingAnimalSchema).min(2),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const frames = value.promptFrames;
    for (const lang of ['en', 'fr'] as const) {
      if (!frames['name-sound'][lang].includes('{name}') || !frames['name-sound'][lang].includes('{sound}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptFrames', 'name-sound', lang], message: 'frame needs {name} and {sound}' });
      }
      if (!frames.name[lang].includes('{name}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptFrames', 'name', lang], message: 'frame needs {name}' });
      }
      if (!frames.sound[lang].includes('{sound}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptFrames', 'sound', lang], message: 'frame needs {sound}' });
      }
    }
    const ids = new Set<string>();
    value.animals.forEach((a, i) => {
      if (ids.has(a.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['animals', i, 'id'], message: `duplicate animal id "${a.id}"` });
      ids.add(a.id);
    });
    const groupSizes = new Map<string, number>();
    for (const a of value.animals) groupSizes.set(a.group, (groupSizes.get(a.group) ?? 0) + 1);
    const hasPair = [...groupSizes.values()].some((n) => n >= 2);
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      if (level.choiceCount === undefined || level.choiceCount < 2) issue('levels require choiceCount of at least 2');
      else if (level.choiceCount > value.animals.length) issue('choiceCount exceeds the number of animals');
      if (level.distractor !== undefined && level.distractor !== 'far' && level.distractor !== 'same-category') {
        issue('who-is-hiding supports distractor "far" or "same-category"');
      }
      if (level.distractor === 'same-category' && !hasPair) issue('same-category needs a group with at least two animals');
      if (level.support !== 'partial-reveal' && level.support !== 'audio-only') {
        issue('who-is-hiding supports support "partial-reveal" or "audio-only"');
      }
      const reveal = level.extra?.reveal;
      if (typeof reveal !== 'number' || !(reveal > 0 && reveal <= 1)) issue('levels require extra.reveal in (0, 1]');
      const speak = level.extra?.speak;
      if (typeof speak !== 'string' || !(HIDING_SPEAK_MODES as readonly string[]).includes(speak)) {
        issue(`levels require extra.speak, one of ${HIDING_SPEAK_MODES.join(', ')}`);
      }
      if (level.support === 'audio-only' && speak !== 'sound') issue('an audio-only level speaks only the sound');
      const soundMs = level.extra?.soundMs;
      if (soundMs !== undefined && (typeof soundMs !== 'number' || soundMs <= 0)) issue('extra.soundMs must be a positive number');
    });
  });

export type HidingAnimal = z.infer<typeof HidingAnimalSchema>;
export type WhosHidingContent = z.infer<typeof WhosHidingContentSchema>;


/** Colouring Time (docs/specs/leisure-colouring.md): leisure-game schema, no adaptive block. */
export const ColouringRegionSchema = z.object({
  id: z.string().min(1),
  age2: z.boolean(),
  parent: z.string().min(1).optional(),
});

export const ColouringPageSchema = z.object({
  id: z.string().min(1),
  regions: z.array(ColouringRegionSchema).min(1),
});

export const ColouringPaletteColorSchema = z.object({
  id: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  age2: z.boolean(),
  age5: z.boolean(),
});

export const LeisureColouringContentSchema = z
  .object({
    id: z.literal('leisure-colouring'),
    world: z.literal('leisure-corner'),
    earnsLeisure: z.literal(false),
    defaultColor: z.literal('red'),
    pages: z.array(ColouringPageSchema).length(8),
    palette: z.array(ColouringPaletteColorSchema).min(8),
  })
  .superRefine((value, ctx) => {
    if (value.palette.some((c) => 'adaptive' in (c as object))) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, message: 'palette entries must not include adaptive fields' });
    }
    const age2 = value.palette.filter((c) => c.age2);
    const age5 = value.palette.filter((c) => c.age5);
    if (age2.length !== 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['palette'], message: 'age-2 palette must have exactly 8 colours' });
    }
    if (age5.length !== 16) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['palette'], message: 'age-5 palette must have exactly 16 colours' });
    }
  });

export type ColouringRegion = z.infer<typeof ColouringRegionSchema>;
export type ColouringPage = z.infer<typeof ColouringPageSchema>;
export type ColouringPaletteColor = z.infer<typeof ColouringPaletteColorSchema>;
export type LeisureColouringContent = z.infer<typeof LeisureColouringContentSchema>;

const nonBlankString = z
  .string()
  .min(1)
  .refine((s) => s.trim().length > 0, { message: 'string must not be blank' });

/** Letter Monster (docs/specs/letter-monster.md): no-fail color & initial-letter game in Language House. */
export const LETTER_MONSTER_COLOR_IDS = ['red', 'yellow', 'orange', 'purple', 'green', 'brown', 'white', 'blue'] as const;
export type LetterMonsterColorId = (typeof LETTER_MONSTER_COLOR_IDS)[number];

/** Normalizes the first letter of a word (strips accents, treats the œ ligature as O). */
export function normalizeInitialLetter(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return '';
  const first = trimmed[0];
  if (first === 'œ' || first === 'Œ') return 'O';
  return first
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export const LetterMonsterColorEntrySchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  he: nonBlankString,
  en: nonBlankString,
  fr: nonBlankString,
});

export const LetterMonsterFoodSchema = z.object({
  id: nonBlankString,
  he: nonBlankString,
  color: z.enum(LETTER_MONSTER_COLOR_IDS),
  word: z.object({ en: nonBlankString, fr: nonBlankString }),
  phrase: z.object({ en: nonBlankString, fr: nonBlankString }),
  initial: z.object({
    en: z.string().regex(/^[A-Z]$/),
    fr: z.string().regex(/^[A-Z]$/),
  }),
});

export const LetterMonsterContentSchema = z
  .object({
    id: z.literal('letter-monster'),
    world: z.literal('language-house'),
    template: z.literal('choice-serve'),
    skill: nonBlankString,
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    colors: z.object({
      red: LetterMonsterColorEntrySchema,
      yellow: LetterMonsterColorEntrySchema,
      orange: LetterMonsterColorEntrySchema,
      purple: LetterMonsterColorEntrySchema,
      green: LetterMonsterColorEntrySchema,
      brown: LetterMonsterColorEntrySchema,
      white: LetterMonsterColorEntrySchema,
      blue: LetterMonsterColorEntrySchema,
    }),
    foods: z.array(LetterMonsterFoodSchema).min(4),
    linesHe: z.object({
      intro: nonBlankString,
      askColorFrame: nonBlankString,
      askLetter: nonBlankString,
      notThis: nonBlankString,
    }),
    letterFrames: z.object({ en: nonBlankString, fr: nonBlankString }),
    helpTextHe: nonBlankString,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.linesHe.askColorFrame.includes('{color}')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linesHe', 'askColorFrame'],
        message: 'askColorFrame must include {color}',
      });
    }
    for (const lang of ['en', 'fr'] as const) {
      const frame = value.letterFrames[lang];
      if (!frame.includes('{letter}') || !frame.includes('{word}')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['letterFrames', lang],
          message: 'letterFrames must include {letter} and {word}',
        });
      }
    }
    const ids = new Set<string>();
    value.foods.forEach((food, i) => {
      if (ids.has(food.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['foods', i, 'id'], message: `duplicate food id "${food.id}"` });
      }
      ids.add(food.id);
      for (const lang of ['en', 'fr'] as const) {
        const expected = normalizeInitialLetter(food.word[lang]);
        if (expected !== food.initial[lang]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['foods', i, 'initial', lang],
            message: `${lang} word "${food.word[lang]}" starts with "${expected}", expected "${food.initial[lang]}"`,
          });
        }
      }
    });
    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const req = level.extra?.request;
      if (req !== 'color' && req !== 'letter') {
        issue('extra.request must be "color" or "letter"');
      }
      const choices = level.extra?.choices;
      if (choices !== 2 && choices !== 3) {
        issue('extra.choices must be 2 or 3');
      }
      if (level.support !== 'picture-audio' && level.support !== 'audio-only') {
        issue('letter-monster supports support "picture-audio" or "audio-only"');
      }
    });
  });

export type LetterMonsterColorEntry = z.infer<typeof LetterMonsterColorEntrySchema>;
export type LetterMonsterFood = z.infer<typeof LetterMonsterFoodSchema>;
export type LetterMonsterContent = z.infer<typeof LetterMonsterContentSchema>;

// ---------------------------------------------------------------------------
// Balloon Pop (Number Garden, docs/specs/balloon-pop.md). Choice family: the child pops one of
// several balloons. Per-level extras: `mode` (color | digit), and `digitMin`/`digitMax` on digit levels.
// ---------------------------------------------------------------------------

export const BALLOON_MODES = ['color', 'digit'] as const;
export type BalloonMode = (typeof BALLOON_MODES)[number];

export const BalloonColorSchema = z.object({
  id: z.string().min(1),
  /** Key in PALETTE (src/assets/colors.ts). */
  color: z.string().min(1),
  /** Colour word spoken in the request ("red", "rouge"). */
  name: LangPairSchema,
});

export const BalloonDigitSchema = z.object({
  value: z.number().int().min(0).max(9),
  /** Number word spoken in the request ("three", "trois"). */
  name: LangPairSchema,
  /** Look- or sound-alike digits, preferred as `near` distractors. */
  near: z.array(z.number().int().min(0).max(9)).default([]),
});

export const BalloonPopContentSchema = z
  .object({
    id: z.literal('balloon-pop'),
    world: z.literal('number-garden'),
    template: z.literal('choice-serve'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    /** Request frames per mode; `{name}` is replaced by the colour or number word. */
    promptFrames: z.object({ color: LangPairSchema, digit: LangPairSchema }),
    /** Short line spoken when the right balloon pops. */
    popped: z.object({ en: z.array(z.string().min(1)).min(1), fr: z.array(z.string().min(1)).min(1) }),
    /** Hebrew intro (first trial of a visit) and help texts, spoken by device TTS in Pass 1. */
    introHe: z.string().min(1),
    helpTextHe: z.string().min(1),
    colors: z.array(BalloonColorSchema).min(2),
    digits: z.array(BalloonDigitSchema).min(2),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    for (const mode of BALLOON_MODES) {
      for (const lang of ['en', 'fr'] as const) {
        if (!value.promptFrames[mode][lang].includes('{name}')) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptFrames', mode, lang], message: 'frame needs {name}' });
        }
      }
    }
    const colorIds = new Set<string>();
    value.colors.forEach((c, i) => {
      if (colorIds.has(c.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['colors', i, 'id'], message: `duplicate colour id "${c.id}"` });
      colorIds.add(c.id);
      if (!(c.color in PALETTE)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['colors', i, 'color'], message: `unknown palette colour "${c.color}"` });
    });
    const digitValues = new Set<number>();
    value.digits.forEach((d, i) => {
      if (digitValues.has(d.value)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['digits', i, 'value'], message: `duplicate digit ${d.value}` });
      digitValues.add(d.value);
    });
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      const mode = level.extra?.mode;
      if (typeof mode !== 'string' || !(BALLOON_MODES as readonly string[]).includes(mode)) {
        issue(`levels require extra.mode, one of ${BALLOON_MODES.join(', ')}`);
        return;
      }
      if (level.distractor !== undefined && level.distractor !== 'far' && level.distractor !== 'near') {
        issue('balloon-pop supports distractor "far" or "near"');
      }
      const count = level.choiceCount;
      if (count === undefined || count < 2 || count > 6) {
        issue('levels require choiceCount within 2..6');
        return;
      }
      if (mode === 'color') {
        if (count > value.colors.length) issue('choiceCount exceeds the number of colours');
        return;
      }
      const min = level.extra?.digitMin;
      const max = level.extra?.digitMax;
      if (typeof min !== 'number' || typeof max !== 'number' || min > max) {
        issue('digit levels require extra.digitMin <= extra.digitMax');
        return;
      }
      const inRange = [...digitValues].filter((v) => v >= min && v <= max).length;
      if (count > inRange) issue('choiceCount exceeds the digits in range');
    });
  });

export type BalloonColor = z.infer<typeof BalloonColorSchema>;
export type BalloonDigit = z.infer<typeof BalloonDigitSchema>;
export type BalloonPopContent = z.infer<typeof BalloonPopContentSchema>;

/** Seed to Flower (docs/specs/seed-to-flower.md): no-fail cause-and-effect game in Nature Lab. */
export const SEED_FLOWER_STAGE_IDS = ['seed', 'sprout', 'bud', 'flower'] as const;

export const SeedToFlowerContentSchema = z
  .object({
    id: z.literal('seed-to-flower'),
    world: z.string().min(1),
    template: z.literal('cause-effect'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    /** Spoken when a stage appears, in the round's learning language. */
    stageNames: z.object({ seed: LangPairSchema, sprout: LangPairSchema, bud: LangPairSchema, flower: LangPairSchema }),
    /** Hebrew guidance spoken with device TTS in Pass 1 (no recorded clips). */
    linesHe: z.object({
      introFree: z.string().min(1),
      introOrdered: z.string().min(1),
      needWater: z.string().min(1),
      needSun: z.string().min(1),
    }),
    helpTextHe: z.string().min(1),
    /** Existing bloom art per plant, `art/flowers/bloom-<id>.svg`, used in turn. */
    blooms: z.array(z.string().regex(/^[a-z]+-[a-z]+$/)).min(1),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const stages = level.extra?.stages;
      const ids = typeof stages === 'string' ? stages.split(',') : [];
      const order = ids.map((id) => (SEED_FLOWER_STAGE_IDS as readonly string[]).indexOf(id));
      const increasing = order.every((n, k) => n >= 0 && (k === 0 || n > order[k - 1]));
      if (ids.length < 2 || ids[0] !== 'seed' || ids[ids.length - 1] !== 'flower' || !increasing) {
        issue('extra.stages must be an increasing comma list of seed,sprout,bud,flower from seed to flower');
      }
      if (level.extra?.order !== 'free' && level.extra?.order !== 'water-then-sun') issue('extra.order must be "free" or "water-then-sun"');
      if (level.extra?.naming !== 'bloom' && level.extra?.naming !== 'all') issue('extra.naming must be "bloom" or "all"');
      if (level.support !== 'picture-audio' && level.support !== 'audio-only') issue('seed-to-flower supports support "picture-audio" or "audio-only"');
    });
  });

export type SeedToFlowerContent = z.infer<typeof SeedToFlowerContentSchema>;

/** Sink or Float (docs/specs/sink-or-float.md): no-fail buoyancy experiment in Science World. */
export const SINK_FLOAT_OBJECT_IDS = ['ball', 'leaf', 'apple', 'stone', 'key', 'spoon'] as const;

export const SinkFloatObjectSchema = z.object({
  id: z.enum(SINK_FLOAT_OBJECT_IDS),
  floats: z.boolean(),
  he: nonBlankString,
  en: nonBlankString,
  fr: nonBlankString,
  resultHe: nonBlankString,
});

export const SinkOrFloatContentSchema = z
  .object({
    id: z.literal('sink-or-float'),
    world: z.string().min(1),
    template: z.literal('cause-effect'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    objects: z.array(SinkFloatObjectSchema).length(SINK_FLOAT_OBJECT_IDS.length),
    outcomes: z.object({
      floats: z.object({ en: nonBlankString, fr: nonBlankString }),
      sinks: z.object({ en: nonBlankString, fr: nonBlankString }),
    }),
    /** Hebrew guidance spoken with device TTS in Pass 1 (no new recordings). */
    linesHe: z.object({
      introFree: nonBlankString,
      introPredict: nonBlankString,
      ask: nonBlankString,
      letsSee: nonBlankString,
    }),
    helpTextHe: nonBlankString,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const seen = new Set<string>();
    value.objects.forEach((obj, i) => {
      if (seen.has(obj.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['objects', i, 'id'],
          message: `duplicate object id "${obj.id}"`,
        });
      }
      seen.add(obj.id);
    });
    for (const id of SINK_FLOAT_OBJECT_IDS) {
      if (!seen.has(id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['objects'],
          message: `missing object "${id}"`,
        });
      }
    }
    if (!value.objects.some((o) => o.floats) || !value.objects.some((o) => !o.floats)) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objects'],
        message: 'objects must include at least one floater and one sinker',
      });
    }
    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const mode = level.extra?.mode;
      if (mode !== 'free' && mode !== 'predict') {
        issue('extra.mode must be "free" or "predict"');
      }
      const dropsPerStar = level.extra?.dropsPerStar;
      if (
        dropsPerStar !== undefined &&
        (typeof dropsPerStar !== 'number' || !Number.isInteger(dropsPerStar) || dropsPerStar < 1)
      ) {
        issue('extra.dropsPerStar must be a positive integer');
      }
      const naming = level.extra?.naming;
      if (naming !== undefined && naming !== 'he+learning') {
        issue('extra.naming must be "he+learning"');
      }
      const hintPulse = level.extra?.hintPulse;
      if (hintPulse !== undefined && typeof hintPulse !== 'boolean') {
        issue('extra.hintPulse must be a boolean');
      }
      if (level.support !== 'picture-audio' && level.support !== 'audio-only') {
        issue('sink-or-float supports support "picture-audio" or "audio-only"');
      }
      if (level.support === 'audio-only' && mode !== 'predict') {
        issue('audio-only sink-or-float levels must use extra.mode "predict"');
      }
    });
  });

export type SinkFloatObjectContent = z.infer<typeof SinkFloatObjectSchema>;
export type SinkOrFloatContent = z.infer<typeof SinkOrFloatContentSchema>;

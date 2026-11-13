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

// ---------------------------------------------------------------------------
// Who Lives Here? (Nature Lab, docs/specs/who-lives-here.md): an animal goes to its home. Items (animals) -> bins (homes),
// data-driven, so more habitats and animals are content-only changes.
// ---------------------------------------------------------------------------

/** Distractor homes next to the right one: `far` = other families first, `near` = the same family first. */
export const HABITAT_DISTRACTORS = ['far', 'near'] as const;
/** What the spoken request contains: the animal's name, or a descriptive clue. */
export const HABITAT_REQUESTS = ['noun', 'riddle'] as const;
export const HABITAT_MAX_HOMES = 4;

export const HabitatHomeSchema = z.object({
  /** Art key suffix: `home-<id>-back` and `home-<id>-front` in the art manifest. */
  id: z.string().min(1),
  /** Look-alike group: `near` distractors come from the target's family first. */
  family: z.string().min(1),
  /** Noun phrase with its article ("the pond", "la mare"), spoken after a correct tap. */
  name: LangPairSchema,
});

export const HabitatAnimalSchema = z.object({
  id: z.string().min(1),
  /** Registered animal rig / art kind (public/art/animals/<kind>). */
  kind: z.string().min(1),
  /** The id of the home this animal lives in. */
  home: z.string().min(1),
  /** Noun phrase with its article ("the frog", "la grenouille"), spoken at noun levels. */
  name: LangPairSchema,
  /** Descriptive clue ("I have feathers and I build a nest."), spoken at riddle levels and after a miss. */
  clue: LangPairSchema,
});

export const WhoLivesHereContentSchema = z
  .object({
    id: z.literal('who-lives-here'),
    world: z.literal('nature-lab'),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    helpTextHe: z.string().min(1),
    homes: z.array(HabitatHomeSchema).min(2),
    animals: z.array(HabitatAnimalSchema).min(2),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const homeIds = new Set<string>();
    value.homes.forEach((h, i) => {
      if (homeIds.has(h.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['homes', i, 'id'], message: `duplicate home id "${h.id}"` });
      homeIds.add(h.id);
    });
    const animalIds = new Set<string>();
    value.animals.forEach((a, i) => {
      if (animalIds.has(a.id)) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['animals', i, 'id'], message: `duplicate animal id "${a.id}"` });
      animalIds.add(a.id);
      if (!homeIds.has(a.home)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['animals', i, 'home'], message: `animal "${a.id}" lives in unknown home "${a.home}"` });
      }
    });
    const maxHomes = Math.min(HABITAT_MAX_HOMES, value.homes.length);
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      if (level.choiceCount === undefined || level.choiceCount < 2) issue('levels require choiceCount of at least 2');
      else if (level.choiceCount > maxHomes) issue(`choiceCount cannot exceed ${maxHomes} (the homes in the content, at most ${HABITAT_MAX_HOMES})`);
      if (level.distractor !== undefined && !(HABITAT_DISTRACTORS as readonly string[]).includes(level.distractor)) {
        issue('who-lives-here supports distractor "far" or "near"');
      }
      if (level.request !== undefined && !(HABITAT_REQUESTS as readonly string[]).includes(level.request)) {
        issue('who-lives-here supports request "noun" or "riddle"');
      }
      if (level.support !== undefined && level.support !== 'picture-audio' && level.support !== 'audio-only') {
        issue('who-lives-here supports support "picture-audio" or "audio-only"');
      }
      if (level.support === 'audio-only' && level.request !== 'riddle') issue('an audio-only level speaks the descriptive clue (request "riddle")');
      if (level.scaffold !== undefined && level.scaffold !== 'outline') issue('who-lives-here supports scaffold "outline" (the right home glows)');
      const clue = level.extra?.clue;
      if (clue !== undefined && clue !== 'after-miss' && clue !== 'none') issue('extra.clue must be "after-miss" or "none"');
    });
  });

export type HabitatHome = z.infer<typeof HabitatHomeSchema>;
export type HabitatAnimal = z.infer<typeof HabitatAnimalSchema>;
export type WhoLivesHereContent = z.infer<typeof WhoLivesHereContentSchema>;


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

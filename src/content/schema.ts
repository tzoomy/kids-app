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

/** Picnic Train tasks (docs/specs/picnic-train.md): one item for each friend, load N items, "how many are missing". */
export const PICNIC_TASKS = ['one-each', 'load', 'missing'] as const;
export type PicnicTask = (typeof PICNIC_TASKS)[number];
export const PICNIC_LAYOUTS = ['rows', 'scattered'] as const;
/** Cargo shelf size on the age-5 stretch load levels (sums and take-aways up to 20); the other levels keep 10. */
export const PICNIC_STRETCH_CAPACITY = 20;
export type PicnicLayout = (typeof PICNIC_LAYOUTS)[number];

/**
 * Picnic Train (docs/specs/picnic-train.md): every level has `setSize` 2..10 (the largest train of the level),
 * `extra.task` and `extra.layout`, and a `scaffold`. `request` is `quantity` for `load` levels, `two-step` for
 * `missing` levels and absent for `one-each` levels.
 */
export const PicnicTrainContentSchema = z
  .object({
    id: z.literal('picnic-train'),
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
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      if (level.setSize === undefined || level.setSize < 2 || level.setSize > 10) issue('picnic train levels require setSize within 2..10');
      if (level.scaffold === undefined) issue('picnic train levels require a scaffold');
      const task = level.extra?.task;
      const layout = level.extra?.layout;
      if (typeof task !== 'string' || !(PICNIC_TASKS as readonly string[]).includes(task)) {
        issue(`picnic train levels require extra.task of ${PICNIC_TASKS.join(', ')}`);
      }
      if (typeof layout !== 'string' || !(PICNIC_LAYOUTS as readonly string[]).includes(layout)) {
        issue(`picnic train levels require extra.layout of ${PICNIC_LAYOUTS.join(', ')}`);
      }
      const expectedRequest = task === 'load' ? 'quantity' : task === 'missing' ? 'two-step' : undefined;
      if (level.request !== expectedRequest) {
        issue(`picnic train ${String(task)} levels require request ${String(expectedRequest)}`);
      }
      if (level.support !== undefined || level.choiceCount !== undefined) issue('picnic train levels use only setSize, request, scaffold and extra');
      // Age-5 stretch (L9-L10): a load level may ask "a and b more" / "a, take b out" (`extra.op` add | sub | mix).
      const op = level.extra?.op;
      if (op !== undefined) {
        if (task !== 'load') issue('extra.op is only for load levels');
        if (op !== 'add' && op !== 'sub' && op !== 'mix') issue('extra.op must be add, sub or mix');
        const { aMin, aMax, bMin, bMax } = level.extra ?? {};
        const ints = [aMin, aMax, bMin, bMax];
        if (ints.some((v) => typeof v !== 'number' || !Number.isInteger(v))) {
          issue('op levels require integer extra.aMin, extra.aMax, extra.bMin, extra.bMax');
        } else {
          const [a0, a1, b0, b1] = ints as number[];
          if (a0 < 2 || a0 > a1 || b0 < 2 || b0 > b1) issue('op levels require 2 <= aMin <= aMax and 2 <= bMin <= bMax');
          if ((op === 'add' || op === 'mix') && a1 + b1 > PICNIC_STRETCH_CAPACITY) issue(`a + b must stay within ${PICNIC_STRETCH_CAPACITY}`);
          if ((op === 'sub' || op === 'mix') && (a0 - b1 < 1 || a1 > PICNIC_STRETCH_CAPACITY)) issue('a - b must stay at least 1, a within the shelf');
        }
      }
    });
  });

export type PicnicTrainContent = z.infer<typeof PicnicTrainContentSchema>;



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

// Shadow Match (Nature Lab, docs/specs/shadow-match.md): a variant of Who's Hiding? that reuses its
// animals (names, sounds, groups) and round builder. Choices are silhouettes of the approved animal
// art; the cue is the sound or the name. Per-level extras: `speak` (sound | name), optional `soundMs`.
// ---------------------------------------------------------------------------

export const SHADOW_SPEAK_MODES = ['sound', 'name'] as const;
export type ShadowSpeakMode = (typeof SHADOW_SPEAK_MODES)[number];

export const ShadowMatchContentSchema = z
  .object({
    id: z.literal('shadow-match'),
    world: z.literal('nature-lab'),
    template: z.literal('choice-serve'),
    skill: z.string().min(1),
    /** Animals (names, sounds, look-alike groups, art kinds) come from this game's content. */
    animalsFrom: z.literal('who-is-hiding'),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    /** Request frames per cue: `{sound}` or `{name}` is replaced from the animal. */
    promptFrames: z.object({ sound: LangPairSchema, name: LangPairSchema }),
    /** Spoken after the silhouette is revealed, in the round's learning language (`{name}`). */
    revealFrame: LangPairSchema,
    /** Then in Hebrew (`{nameHe}`), spoken by device TTS in Pass 1. */
    revealFrameHe: z.string().min(1),
    /** Hebrew frame for animals whose Hebrew name is grammatically feminine (`זו פנדה!`); `{nameHe}` as above. */
    revealFrameFeminineHe: z.string().min(1).optional(),
    /** Ids of the animals that use `revealFrameFeminineHe` instead of `revealFrameHe`. */
    feminineHeIds: z.array(z.string().min(1)).optional(),
    /** Hebrew animal names by animal id. */
    namesHe: z.record(z.string().min(1)),
    introHe: z.string().min(1),
    helpTextHe: z.string().min(1),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    for (const mode of SHADOW_SPEAK_MODES) {
      for (const lang of ['en', 'fr'] as const) {
        const token = mode === 'sound' ? '{sound}' : '{name}';
        if (!value.promptFrames[mode][lang].includes(token)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptFrames', mode, lang], message: `frame needs ${token}` });
        }
      }
    }
    for (const lang of ['en', 'fr'] as const) {
      if (!value.revealFrame[lang].includes('{name}')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['revealFrame', lang], message: 'frame needs {name}' });
    }
    if (!value.revealFrameHe.includes('{nameHe}')) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['revealFrameHe'], message: 'frame needs {nameHe}' });
    if (value.revealFrameFeminineHe !== undefined && !value.revealFrameFeminineHe.includes('{nameHe}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['revealFrameFeminineHe'], message: 'frame needs {nameHe}' });
    }
    if ((value.feminineHeIds?.length ?? 0) > 0 && value.revealFrameFeminineHe === undefined) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['revealFrameFeminineHe'], message: 'feminineHeIds needs revealFrameFeminineHe' });
    }
    value.feminineHeIds?.forEach((id, i) => {
      if (!value.namesHe[id]) ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['feminineHeIds', i], message: `no Hebrew name for "${id}"` });
    });
    value.adaptive.levels.forEach((level, i) => {
      const path = ['adaptive', 'levels', i];
      const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path, message });
      if (level.choiceCount === undefined || level.choiceCount < 2 || level.choiceCount > 6) issue('levels require choiceCount within 2..6');
      if (level.distractor !== undefined && level.distractor !== 'far' && level.distractor !== 'same-category') {
        issue('shadow-match supports distractor "far" or "same-category"');
      }
      const speak = level.extra?.speak;
      if (typeof speak !== 'string' || !(SHADOW_SPEAK_MODES as readonly string[]).includes(speak)) {
        issue(`levels require extra.speak, one of ${SHADOW_SPEAK_MODES.join(', ')}`);
      }
      const soundMs = level.extra?.soundMs;
      if (soundMs !== undefined && (typeof soundMs !== 'number' || soundMs <= 0)) issue('extra.soundMs must be a positive number');
    });
  });

export type ShadowMatchContent = z.infer<typeof ShadowMatchContentSchema>;

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

/** Sticker Board (docs/specs/sticker-board.md): free-creation Art Studio game, no adaptive block. */
export const StickerBoardBackgroundSchema = z.object({
  id: z.string().min(1),
  he: z.string().min(1),
  name: LangPairSchema,
  place: LangPairSchema,
});

export const StickerBoardStickerSchema = z.object({
  id: z.string().min(1),
  theme: z.string().min(1),
  artKey: z.string().min(1),
  name: LangPairSchema,
});

export const StickerBoardCrayonSchema = z.object({
  id: z.string().min(1),
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  age2: z.boolean(),
  age5: z.boolean(),
});

export const StickerBoardContentSchema = z
  .object({
    id: z.literal('sticker-board'),
    world: z.literal('art-studio'),
    earnsLeisure: z.boolean(),
    defaultBackground: z.string().min(1),
    defaultColor: z.string().min(1),
    backgrounds: z.array(StickerBoardBackgroundSchema).length(3),
    stickers: z.array(StickerBoardStickerSchema).length(12),
    crayons: z.array(StickerBoardCrayonSchema).min(4),
  })
  .superRefine((value, ctx) => {
    const bgIds = new Set(value.backgrounds.map((b) => b.id));
    if (bgIds.size !== value.backgrounds.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['backgrounds'], message: 'background ids must be unique' });
    }
    if (!bgIds.has(value.defaultBackground)) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultBackground'], message: 'defaultBackground must exist in backgrounds' });
    }
    const stickerIds = new Set<string>();
    const themeCounts = new Map<string, number>();
    value.stickers.forEach((s, i) => {
      if (stickerIds.has(s.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stickers', i, 'id'], message: `duplicate sticker id "${s.id}"` });
      }
      stickerIds.add(s.id);
      if (!bgIds.has(s.theme)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stickers', i, 'theme'], message: `unknown sticker theme "${s.theme}"` });
      }
      themeCounts.set(s.theme, (themeCounts.get(s.theme) ?? 0) + 1);
    });
    for (const bg of value.backgrounds) {
      if ((themeCounts.get(bg.id) ?? 0) !== 4) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['stickers'], message: `theme "${bg.id}" must have 4 stickers` });
      }
    }
    const crayonIds = new Set(value.crayons.map((c) => c.id));
    if (crayonIds.size !== value.crayons.length) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['crayons'], message: 'crayon ids must be unique' });
    }
    const defaultCrayon = value.crayons.find((c) => c.id === value.defaultColor);
    if (!defaultCrayon || !defaultCrayon.age2 || !defaultCrayon.age5) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['defaultColor'], message: 'defaultColor must exist and be enabled for age2 and age5' });
    }
    const age2 = value.crayons.filter((c) => c.age2);
    const age5 = value.crayons.filter((c) => c.age5);
    if (age2.length !== 4) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['crayons'], message: 'age-2 crayons must have 4 colours' });
    }
    if (age5.length !== 8) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['crayons'], message: 'age-5 crayons must have 8 colours' });
    }
  });

export type StickerBoardBackground = z.infer<typeof StickerBoardBackgroundSchema>;
export type StickerBoardSticker = z.infer<typeof StickerBoardStickerSchema>;
export type StickerBoardCrayon = z.infer<typeof StickerBoardCrayonSchema>;
export type StickerBoardContent = z.infer<typeof StickerBoardContentSchema>;
const nonBlankString = z
  .string()
  .min(1)
  .refine((s) => s.trim().length > 0, { message: 'string must not be blank' });

/** Word Train (docs/specs/word-train.md): English-only receptive load & spelling game in Language House. */
export const WordTrainObjectSchema = z.object({
  id: nonBlankString,
  art: nonBlankString,
  en: nonBlankString,
  he: nonBlankString,
});

export const WordTrainWordSchema = z.object({
  id: nonBlankString,
  word: z.string().regex(/^[a-z]{3,6}$/, { message: 'word must be 3-6 lowercase a-z letters (no accents)' }),
  /** Language of the spelling: English or French (French words are ascii, e.g. `oeuf`). */
  lang: z.enum(['en', 'fr']),
  art: nonBlankString,
  he: nonBlankString,
});

const WordTrainLinesSchema = z.object({
  loadFrame: nonBlankString,
  nameFrame: nonBlankString,
  otherFrame: nonBlankString,
  spellFrame: nonBlankString,
  wordFrame: nonBlankString,
});

export const WordTrainContentSchema = z
  .object({
    id: z.literal('word-train'),
    world: z.string().min(1),
    template: z.literal('spell'),
    skill: z.string().min(1),
    languages: z.tuple([z.literal('en'), z.literal('fr')]),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    objects: z.array(WordTrainObjectSchema).min(2),
    words: z.array(WordTrainWordSchema).min(2),
    distractorLetters: z.string().regex(/^[a-z]+$/, { message: 'distractorLetters must be lowercase a-z letters' }),
    linesEn: WordTrainLinesSchema,
    linesFr: WordTrainLinesSchema,
    linesHe: z.object({
      introLoad: nonBlankString,
      introSpell: nonBlankString,
      introSpellFr: nonBlankString,
    }),
    helpTextHe: nonBlankString,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const objIds = new Set<string>();
    value.objects.forEach((obj, i) => {
      if (objIds.has(obj.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['objects', i, 'id'],
          message: `duplicate object id "${obj.id}"`,
        });
      }
      objIds.add(obj.id);
    });

    const wordIds = new Set<string>();
    const wordTexts = new Set<string>();
    const wordLengthsByLang = new Map<string, number[]>();
    value.words.forEach((w, i) => {
      if (wordIds.has(w.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['words', i, 'id'],
          message: `duplicate word id "${w.id}"`,
        });
      }
      // Word text is unique per language ("orange" may exist in both English and French).
      if (wordTexts.has(`${w.lang}:${w.word}`)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['words', i, 'word'],
          message: `duplicate ${w.lang} word "${w.word}"`,
        });
      }
      wordIds.add(w.id);
      wordTexts.add(`${w.lang}:${w.word}`);
      const lengths = wordLengthsByLang.get(w.lang) ?? [];
      lengths.push(w.word.length);
      wordLengthsByLang.set(w.lang, lengths);
    });

    if (!value.linesEn.loadFrame.includes('{word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesEn', 'loadFrame'], message: 'loadFrame must include {word}' });
    }
    if (!value.linesEn.nameFrame.includes('{Word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesEn', 'nameFrame'], message: 'nameFrame must include {Word}' });
    }
    if (!value.linesEn.otherFrame.includes('{word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesEn', 'otherFrame'], message: 'otherFrame must include {word}' });
    }
    if (!value.linesEn.spellFrame.includes('{word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesEn', 'spellFrame'], message: 'spellFrame must include {word}' });
    }
    if (!value.linesEn.wordFrame.includes('{letters}') || !value.linesEn.wordFrame.includes('{word}')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linesEn', 'wordFrame'],
        message: 'wordFrame must include {letters} and {word}',
      });
    }

    const frFrames = value.linesFr;
    if (!frFrames.loadFrame.includes('{word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesFr', 'loadFrame'], message: 'loadFrame must include {word}' });
    }
    if (!frFrames.nameFrame.includes('{Word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesFr', 'nameFrame'], message: 'nameFrame must include {Word}' });
    }
    if (!frFrames.otherFrame.includes('{word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesFr', 'otherFrame'], message: 'otherFrame must include {word}' });
    }
    if (!frFrames.spellFrame.includes('{word}')) {
      ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['linesFr', 'spellFrame'], message: 'spellFrame must include {word}' });
    }
    if (!frFrames.wordFrame.includes('{letters}') || !frFrames.wordFrame.includes('{word}')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linesFr', 'wordFrame'],
        message: 'wordFrame must include {letters} and {word}',
      });
    }

    const levelCount = value.adaptive.levels.length;
    for (const trackName of ['age2', 'age5'] as const) {
      const tr = value.adaptive.tracks[trackName];
      if (tr.min < 1 || tr.max > levelCount || tr.start < tr.min || tr.start > tr.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adaptive', 'tracks', trackName],
          message: `track ${trackName} bounds must lie within 1..${levelCount}`,
        });
      }
    }

    const distractorSet = new Set(value.distractorLetters.split(''));

    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const mode = level.extra?.mode;
      if (mode !== 'load' && mode !== 'spell') {
        issue('extra.mode must be "load" or "spell"');
        return;
      }
      if (level.support !== 'picture-audio' && level.support !== 'audio-only') {
        issue('word-train supports support "picture-audio" or "audio-only"');
      }
      if (mode === 'load') {
        const choiceCount = level.extra?.choiceCount;
        if (
          typeof choiceCount !== 'number' ||
          !Number.isInteger(choiceCount) ||
          choiceCount < 2 ||
          choiceCount > value.objects.length
        ) {
          issue(`extra.choiceCount must be an integer between 2 and ${value.objects.length}`);
        }
        const loadsPerStar = level.extra?.loadsPerStar;
        if (typeof loadsPerStar !== 'number' || !Number.isInteger(loadsPerStar) || loadsPerStar < 1) {
          issue('extra.loadsPerStar must be a positive integer');
        }
      } else {
        const wordLength = level.extra?.wordLength;
        const rawMax = level.extra?.wordLengthMax;
        const wordLengthMax = rawMax === undefined ? wordLength : rawMax;
        const validLength = (n: unknown): n is number => typeof n === 'number' && Number.isInteger(n) && n >= 3 && n <= 6;
        if (!validLength(wordLength) || !validLength(wordLengthMax) || wordLengthMax < wordLength) {
          issue('extra.wordLength (and optional wordLengthMax) must be integers from 3 to 6, max not below min');
          return;
        }
        // Every language the game lists must supply at least 2 words in the length range.
        for (const lang of value.languages) {
          const fit = (wordLengthsByLang.get(lang) ?? []).filter((n) => n >= wordLength && n <= wordLengthMax).length;
          if (fit < 2) {
            issue(`words must include at least 2 ${lang} words of length ${wordLength}-${wordLengthMax}`);
          }
        }
        const ghost = level.extra?.ghost;
        if (typeof ghost !== 'boolean') {
          issue('extra.ghost must be a boolean');
        }
        const distractors = level.extra?.distractors;
        if (distractors !== 0 && distractors !== 1 && distractors !== 2) {
          issue('extra.distractors must be 0, 1 or 2');
        } else if (distractors > 0) {
          for (const w of value.words) {
            if (w.word.length < wordLength || w.word.length > wordLengthMax) continue;
            const available = [...distractorSet].filter((ch) => !w.word.includes(ch));
            if (available.length < distractors) {
              issue(`distractorLetters has fewer than ${distractors} letters outside word "${w.word}"`);
            }
          }
        }
      }
    });
  });

export type WordTrainObject = z.infer<typeof WordTrainObjectSchema>;
export type WordTrainWord = z.infer<typeof WordTrainWordSchema>;
export type WordTrainContent = z.infer<typeof WordTrainContentSchema>;

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

/** Normalizes the last letter of a word (strips accents; no ligature handling needed: œuf ends in F). */
export function normalizeFinalLetter(word: string): string {
  const trimmed = word.trim();
  if (!trimmed) return '';
  return trimmed[trimmed.length - 1]
    .normalize('NFD')
    .replace(/[\u0300-\u036f]/g, '')
    .toUpperCase();
}

export const LETTER_MONSTER_REQUESTS = ['color', 'letter', 'ending', 'word'] as const;

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
  /** Last letter of `word[lang]` (L6-L7 "ends with" requests). */
  ending: z.object({
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
      askEnding: nonBlankString,
      askWord: nonBlankString,
      notThis: nonBlankString,
    }),
    letterFrames: z.object({ en: nonBlankString, fr: nonBlankString }),
    endingFrames: z.object({ en: nonBlankString, fr: nonBlankString }),
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
      const ending = value.endingFrames[lang];
      if (!ending.includes('{letter}') || !ending.includes('{word}')) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['endingFrames', lang],
          message: 'endingFrames must include {letter} and {word}',
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
        const expectedEnd = normalizeFinalLetter(food.word[lang]);
        if (expectedEnd !== food.ending[lang]) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['foods', i, 'ending', lang],
            message: `${lang} word "${food.word[lang]}" ends with "${expectedEnd}", expected "${food.ending[lang]}"`,
          });
        }
      }
    });
    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const req = level.extra?.request;
      if (typeof req !== 'string' || !(LETTER_MONSTER_REQUESTS as readonly string[]).includes(req)) {
        issue(`extra.request must be one of ${LETTER_MONSTER_REQUESTS.join(', ')}`);
      }
      const choices = level.extra?.choices;
      if (typeof choices !== 'number' || !Number.isInteger(choices) || choices < 2 || choices > 6) {
        issue('extra.choices must be an integer from 2 to 6');
      } else if (choices > value.foods.length) {
        issue(`extra.choices ${choices} exceeds the ${value.foods.length} foods`);
      } else {
        // Every language the game lists must be able to build the round: 1 match + (choices - 1) non-matching foods.
        const languages = new Set<'en' | 'fr'>(value.languages);
        for (const lang of languages) {
          const groups = new Map<string, number>();
          if (req === 'letter') for (const f of value.foods) groups.set(f.initial[lang], (groups.get(f.initial[lang]) ?? 0) + 1);
          if (req === 'ending') for (const f of value.foods) groups.set(f.ending[lang], (groups.get(f.ending[lang]) ?? 0) + 1);
          if (req === 'letter' || req === 'ending') {
            const ok = [...groups.values()].some((n) => value.foods.length - n >= choices - 1);
            if (!ok) issue(`${req} level with ${choices} choices cannot be built in ${lang}`);
          }
          if (req === 'word') {
            const readable = value.foods.filter((f) => f.word[lang].length <= 6);
            if (readable.length < 2) issue(`word level needs at least 2 foods with words of up to 6 letters in ${lang}`);
          }
        }
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
// several balloons. Per-level extras: `mode` (color | digit | more | sum), `digitMin`/`digitMax` on digit levels
// (0-20; numbers 10-20 use the `number` request frame), `baseMin`/`baseMax`/`stepMax` on "k more than n" levels
// and `addendMax` on sum levels (age-5 stretch L10-L11).
// ---------------------------------------------------------------------------

export const BALLOON_MODES = ['color', 'digit', 'more', 'sum'] as const;
/** Largest numeral a balloon can show (teens and the stretch answers stay within 20). */
export const BALLOON_NUMBER_MAX = 20;
export type BalloonMode = (typeof BALLOON_MODES)[number];

export const BalloonColorSchema = z.object({
  id: z.string().min(1),
  /** Key in PALETTE (src/assets/colors.ts). */
  color: z.string().min(1),
  /** Colour word spoken in the request ("red", "rouge"). */
  name: LangPairSchema,
});

export const BalloonDigitSchema = z.object({
  value: z.number().int().min(0).max(20),
  /** Number word spoken in the request ("three", "trois"). */
  name: LangPairSchema,
  /** Look- or sound-alike numbers, preferred as `near` distractors. */
  near: z.array(z.number().int().min(0).max(20)).default([]),
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
    /**
     * Request frames: `color` / `digit` (0-9) / `number` (10-20) replace `{name}` with the colour or number word;
     * `more` replaces `{k}` and `{n}` ("two more than five"); `sum` replaces `{a}` and `{b}` ("three plus four").
     */
    promptFrames: z.object({
      color: LangPairSchema,
      digit: LangPairSchema,
      number: LangPairSchema,
      more: LangPairSchema,
      sum: LangPairSchema,
    }),
    /** Short line spoken when the right balloon pops. */
    popped: z.object({ en: z.array(z.string().min(1)).min(1), fr: z.array(z.string().min(1)).min(1) }),
    /** Hebrew intro (first trial of a visit) and help texts, spoken by device TTS in Pass 1. */
    introHe: z.string().min(1),
    helpTextHe: z.string().min(1),
    colors: z.array(BalloonColorSchema).min(2),
    digits: z.array(BalloonDigitSchema).min(2),
    /** Floating stage (moving balloons); see src/games/balloon/balloonFloat.ts. Absent = no floating stage. */
    floating: z
      .object({
        everyNthTrial: z.number().int().min(1),
        speed: z.object({ age2: z.number().positive().max(120), age5: z.number().positive().max(120) }),
        speedStepPerLevel: z.number().min(0).max(0.5),
        swayPx: z.number().min(0).max(60),
        hitScale: z.number().min(1.5),
        minHitCssPx: z.number().min(64),
        /** Levels above this one float no faster than it (the age-5 maths levels keep the L8 speed). Absent = no cap. */
        speedMaxLevel: z.number().int().min(1).optional(),
      })
      .refine((f) => f.speed.age2 <= f.speed.age5, { message: 'age 2 must float no faster than age 5' })
      .optional(),
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const FRAME_SLOTS = { color: ['{name}'], digit: ['{name}'], number: ['{name}'], more: ['{k}', '{n}'], sum: ['{a}', '{b}'] } as const;
    for (const frame of Object.keys(FRAME_SLOTS) as (keyof typeof FRAME_SLOTS)[]) {
      for (const lang of ['en', 'fr'] as const) {
        for (const slot of FRAME_SLOTS[frame]) {
          if (!value.promptFrames[frame][lang].includes(slot)) {
            ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['promptFrames', frame, lang], message: `frame needs ${slot}` });
          }
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
      const hasDigits = (...ns: number[]) => ns.every((n) => digitValues.has(n));
      if (mode === 'more') {
        const { baseMin, baseMax, stepMax } = level.extra ?? {};
        if (
          typeof baseMin !== 'number' || typeof baseMax !== 'number' || typeof stepMax !== 'number' ||
          !Number.isInteger(baseMin) || !Number.isInteger(baseMax) || !Number.isInteger(stepMax) ||
          baseMin < 1 || baseMin > baseMax || stepMax < 1 || stepMax > 2 || baseMax + stepMax > BALLOON_NUMBER_MAX
        ) {
          issue(`"more" levels require integers 1 <= extra.baseMin <= extra.baseMax, extra.stepMax 1..2, baseMax + stepMax <= ${BALLOON_NUMBER_MAX}`);
          return;
        }
        for (let n = baseMin; n <= baseMax; n++) if (!hasDigits(n, n + stepMax)) issue(`"more" level needs digit entries for ${n}..${n + stepMax}`);
        return;
      }
      if (mode === 'sum') {
        const addendMax = level.extra?.addendMax;
        if (typeof addendMax !== 'number' || !Number.isInteger(addendMax) || addendMax < 1 || addendMax * 2 > BALLOON_NUMBER_MAX) {
          issue(`sum levels require an integer extra.addendMax with 2 * addendMax <= ${BALLOON_NUMBER_MAX}`);
          return;
        }
        for (let n = 1; n <= addendMax * 2; n++) if (!hasDigits(n)) issue(`sum level needs a digit entry for ${n}`);
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

/** Number words 1-20: 1-10 for the counting levels, 11-20 for the age-5 equation levels (L6-L8). */
export const BRIDGE_NUMBER_KEYS = [
  '1', '2', '3', '4', '5', '6', '7', '8', '9', '10',
  '11', '12', '13', '14', '15', '16', '17', '18', '19', '20',
] as const;
/** Equation operators of the age-5 stretch levels (`extra.op`): `mix` picks add or sub per bridge. */
export const BRIDGE_EQUATION_OPS = ['add', 'sub', 'mix'] as const;
export type BridgeEquationOp = (typeof BRIDGE_EQUATION_OPS)[number];
export type BridgeNumberKey = (typeof BRIDGE_NUMBER_KEYS)[number];

export const BridgeNumberEntrySchema = z.object({
  he: nonBlankString,
  en: nonBlankString,
  fr: nonBlankString,
});

/** Number Bridge (docs/specs/number-bridge.md): stepping-stones counting and missing-number game in Number Garden. */
export const NumberBridgeContentSchema = z
  .object({
    id: z.literal('number-bridge'),
    world: z.literal('number-garden'),
    earnsLeisure: z.boolean(),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    numbers: z.object({
      '1': BridgeNumberEntrySchema,
      '2': BridgeNumberEntrySchema,
      '3': BridgeNumberEntrySchema,
      '4': BridgeNumberEntrySchema,
      '5': BridgeNumberEntrySchema,
      '6': BridgeNumberEntrySchema,
      '7': BridgeNumberEntrySchema,
      '8': BridgeNumberEntrySchema,
      '9': BridgeNumberEntrySchema,
      '10': BridgeNumberEntrySchema,
      '11': BridgeNumberEntrySchema,
      '12': BridgeNumberEntrySchema,
      '13': BridgeNumberEntrySchema,
      '14': BridgeNumberEntrySchema,
      '15': BridgeNumberEntrySchema,
      '16': BridgeNumberEntrySchema,
      '17': BridgeNumberEntrySchema,
      '18': BridgeNumberEntrySchema,
      '19': BridgeNumberEntrySchema,
      '20': BridgeNumberEntrySchema,
    }),
    /** Operator words spoken between the number words of an equation bridge ("three" "plus" "four" "equals"). */
    operatorWords: z.object({
      plus: z.object({ en: nonBlankString, fr: nonBlankString }),
      minus: z.object({ en: nonBlankString, fr: nonBlankString }),
      equals: z.object({ en: nonBlankString, fr: nonBlankString }),
    }),
    oneMorePhrase: z.object({
      en: nonBlankString,
      fr: nonBlankString,
    }),
    linesHe: z.object({
      introOneMore: nonBlankString,
      introMissing: nonBlankString,
      notThis: nonBlankString,
      crossed: nonBlankString,
      /** Equation levels: intro when an addition / subtraction / mixed level starts. */
      introAdd: nonBlankString,
      introSub: nonBlankString,
      introMix: nonBlankString,
    }),
    helpTextHe: nonBlankString,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const mode = level.extra?.mode;
      if (mode !== 'one-more' && mode !== 'missing' && mode !== 'equation') {
        issue('extra.mode must be "one-more", "missing" or "equation"');
      }
      const stones = level.extra?.stones;
      if (typeof stones !== 'number' || !Number.isInteger(stones) || stones < 2 || stones > 10) {
        issue('extra.stones must be an integer between 2 and 10');
      }
      const gaps = level.extra?.gaps;
      if (typeof gaps !== 'number' || !Number.isInteger(gaps) || gaps < 1 || (typeof stones === 'number' && gaps >= stones)) {
        issue('extra.gaps must be a positive integer smaller than extra.stones');
      }
      const range = level.extra?.range;
      const maxRange = mode === 'equation' ? 20 : 10;
      if (
        typeof range !== 'number' ||
        !Number.isInteger(range) ||
        range > maxRange ||
        (typeof stones === 'number' && range < stones)
      ) {
        issue(`extra.range must be an integer between extra.stones and ${maxRange}`);
      }
      const dots = level.extra?.dots;
      if (dots !== undefined && typeof dots !== 'boolean') {
        issue('extra.dots must be a boolean');
      }
      if (level.support !== 'picture-audio' && level.support !== 'audio-only') {
        issue('number-bridge supports support "picture-audio" or "audio-only"');
      }
      if (mode === 'missing' && gaps !== 1) {
        issue('missing-number levels must have extra.gaps === 1');
      }
      if (mode === 'missing' && typeof range === 'number' && range < 5) {
        issue('missing-number levels require extra.range >= 5 so 3 distinct choices exist');
      }
      if (level.support === 'audio-only' && mode !== 'missing' && mode !== 'equation') {
        issue('audio-only number-bridge levels must use extra.mode "missing" or "equation"');
      }
      if (mode === 'equation') {
        const op = level.extra?.op;
        if (typeof op !== 'string' || !(BRIDGE_EQUATION_OPS as readonly string[]).includes(op)) {
          issue(`equation levels require extra.op of ${BRIDGE_EQUATION_OPS.join(', ')}`);
        }
        if (stones !== 3 || gaps !== 1) issue('equation levels are "a op b = ?": extra.stones 3 and extra.gaps 1');
        if (typeof range === 'number' && range < 10) issue('equation levels require extra.range 10..20');
        if (dots === true) issue('equation levels do not draw dots');
      } else if (level.extra?.op !== undefined) {
        issue('extra.op is only for equation levels');
      }
    });
  });

export type BridgeNumberEntry = z.infer<typeof BridgeNumberEntrySchema>;
export type NumberBridgeContent = z.infer<typeof NumberBridgeContentSchema>;

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

/** Potion Lab (docs/specs/potion-lab.md): no-fail color mixing game in Science World. */
export const POTION_COLOR_IDS = ['red', 'yellow', 'blue', 'orange', 'green', 'purple'] as const;

export const PotionColorEntrySchema = z.object({
  hex: z.string().regex(/^#[0-9A-Fa-f]{6}$/),
  he: nonBlankString,
  en: nonBlankString,
  fr: nonBlankString,
});

export const PotionLabContentSchema = z
  .object({
    id: z.literal('potion-lab'),
    world: z.string().min(1),
    template: z.literal('cause-effect'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    colors: z.object({
      red: PotionColorEntrySchema,
      yellow: PotionColorEntrySchema,
      blue: PotionColorEntrySchema,
      orange: PotionColorEntrySchema,
      green: PotionColorEntrySchema,
      purple: PotionColorEntrySchema,
    }),
    /** Hebrew guidance spoken with device TTS in Pass 1 (no new recordings). */
    linesHe: z.object({
      introFree: nonBlankString,
      introRequest: nonBlankString,
      requestFrame: nonBlankString,
      tryAgainFrame: nonBlankString,
    }),
    helpTextHe: nonBlankString,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    if (!value.linesHe.requestFrame.includes('{color}')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linesHe', 'requestFrame'],
        message: 'requestFrame must include {color}',
      });
    }
    if (!value.linesHe.tryAgainFrame.includes('{color}')) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['linesHe', 'tryAgainFrame'],
        message: 'tryAgainFrame must include {color}',
      });
    }
    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const mode = level.extra?.mode;
      if (mode !== 'free' && mode !== 'request') {
        issue('extra.mode must be "free" or "request"');
      }
      const mixesPerStar = level.extra?.mixesPerStar;
      if (
        mixesPerStar !== undefined &&
        (typeof mixesPerStar !== 'number' || !Number.isInteger(mixesPerStar) || mixesPerStar < 1)
      ) {
        issue('extra.mixesPerStar must be a positive integer');
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
        issue('potion-lab supports support "picture-audio" or "audio-only"');
      }
      if (level.support === 'audio-only' && mode !== 'request') {
        issue('audio-only potion-lab levels must use extra.mode "request"');
      }
    });
  });

export type PotionColorEntry = z.infer<typeof PotionColorEntrySchema>;
export type PotionLabContent = z.infer<typeof PotionLabContentSchema>;

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

/** Magic Magnet (docs/specs/magic-magnet.md): no-fail magnetism cause-effect game in Science World. */
export const MagnetObjectSchema = z.object({
  id: nonBlankString,
  metal: z.boolean(),
  art: nonBlankString,
  he: nonBlankString,
  en: nonBlankString,
  fr: nonBlankString,
  reactHe: nonBlankString,
  askHe: nonBlankString,
});

export const MagicMagnetContentSchema = z
  .object({
    id: z.literal('magic-magnet'),
    world: z.string().min(1),
    template: z.literal('cause-effect'),
    skill: z.string().min(1),
    languages: z.array(z.enum(['en', 'fr'])).min(1),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    objects: z.array(MagnetObjectSchema).min(4),
    resultWords: z.object({
      sticks: z.object({ en: nonBlankString, fr: nonBlankString }),
      notSticks: z.object({ en: nonBlankString, fr: nonBlankString }),
    }),
    /** Hebrew guidance spoken with device TTS in Pass 1 (no new recordings). */
    linesHe: z.object({
      introFree: nonBlankString,
      introPredict: nonBlankString,
      test: nonBlankString,
      right: nonBlankString,
      surprise: nonBlankString,
      buttonSticks: nonBlankString,
      buttonNotSticks: nonBlankString,
    }),
    helpTextHe: nonBlankString,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const ids = new Set<string>();
    let metalCount = 0;
    let nonMetalCount = 0;
    value.objects.forEach((obj, i) => {
      if (ids.has(obj.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['objects', i, 'id'],
          message: `duplicate object id "${obj.id}"`,
        });
      }
      ids.add(obj.id);
      if (obj.metal) metalCount++;
      else nonMetalCount++;
    });
    if (metalCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objects'],
        message: 'objects must include at least 2 metal objects',
      });
    }
    if (nonMetalCount < 2) {
      ctx.addIssue({
        code: z.ZodIssueCode.custom,
        path: ['objects'],
        message: 'objects must include at least 2 non-metal objects',
      });
    }

    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });
      const mode = level.extra?.mode;
      if (mode !== 'free' && mode !== 'predict') {
        issue('extra.mode must be "free" or "predict"');
      }
      const objectCount = level.extra?.objectCount;
      if (
        typeof objectCount !== 'number' ||
        !Number.isInteger(objectCount) ||
        objectCount < 2 ||
        objectCount > value.objects.length
      ) {
        issue(`extra.objectCount must be an integer between 2 and ${value.objects.length}`);
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
        issue('magic-magnet supports support "picture-audio" or "audio-only"');
      }
      if (level.support === 'audio-only' && mode !== 'predict') {
        issue('audio-only magic-magnet levels must use extra.mode "predict"');
      }
    });
  });

export type MagnetObject = z.infer<typeof MagnetObjectSchema>;
export type MagicMagnetContent = z.infer<typeof MagicMagnetContentSchema>;

const suitcaseNonBlank = z
  .string()
  .min(1)
  .refine((s) => s.trim().length > 0, { message: 'string must not be blank' });

export const SUITCASE_REQUESTS = ['noun', 'two', 'attribute', 'negation'] as const;
export type SuitcaseRequestKind = (typeof SUITCASE_REQUESTS)[number];

export const SuitcaseColorVariantSchema = z.object({
  color: suitcaseNonBlank,
  art: suitcaseNonBlank,
  en: suitcaseNonBlank,
  fr: suitcaseNonBlank,
  enOne: suitcaseNonBlank,
  frOne: suitcaseNonBlank,
});

export const SuitcaseItemSchema = z.object({
  id: suitcaseNonBlank,
  art: suitcaseNonBlank,
  he: suitcaseNonBlank,
  en: z.object({ the: suitcaseNonBlank, a: suitcaseNonBlank }),
  fr: z.object({ the: suitcaseNonBlank, a: suitcaseNonBlank }),
  colors: z.array(SuitcaseColorVariantSchema).optional(),
});

const SuitcaseLangFramesSchema = z.object({
  put: suitcaseNonBlank,
  two: suitcaseNonBlank,
  not: suitcaseNonBlank,
  /** 3-item attribute request: `{a}`, `{b}`, `{c}` are the named items (colour included). */
  set: suitcaseNonBlank,
  /** 3-item request with one negation: `{b}`, `{c}` plain items, `{a}` the negated item, `{one}` its excluded colour. */
  setNot: suitcaseNonBlank,
  name: suitcaseNonBlank,
  other: suitcaseNonBlank,
});

/**
 * One slot of a curated 3-item set. `color` fixes the colour of an attribute slot; `notColor`
 * marks the single negation slot ("a hat, but not the red one"). Neither = the plain item.
 */
export const SuitcaseSetSlotSchema = z.object({
  item: suitcaseNonBlank,
  color: suitcaseNonBlank.optional(),
  notColor: suitcaseNonBlank.optional(),
});

/** A curated packing list used by `extra.setSize` levels (keeps the line catalogue finite). */
export const SuitcaseSetSchema = z.object({
  id: suitcaseNonBlank,
  attribute: z.array(SuitcaseSetSlotSchema).min(2),
  negation: z.array(SuitcaseSetSlotSchema).min(2),
});

/** Travel Suitcase (docs/specs/travel-suitcase.md): EN/FR packing & vocabulary game in Language House. */
export const TravelSuitcaseContentSchema = z
  .object({
    id: z.literal('travel-suitcase'),
    world: suitcaseNonBlank,
    template: z.literal('choice-serve'),
    skill: suitcaseNonBlank,
    languages: z.tuple([z.literal('en'), z.literal('fr')]),
    earnsLeisure: z.boolean(),
    ageTracks: z.object({ age2: AgeTrackConfigSchema, age5: AgeTrackConfigSchema }),
    items: z.array(SuitcaseItemSchema).min(2),
    frames: z.object({ en: SuitcaseLangFramesSchema, fr: SuitcaseLangFramesSchema }),
    sets: z.array(SuitcaseSetSchema),
    linesHe: z.object({ intro: suitcaseNonBlank, closed: suitcaseNonBlank }),
    helpTextHe: suitcaseNonBlank,
    adaptive: GameAdaptiveSchema,
  })
  .superRefine((value, ctx) => {
    const itemIds = new Set<string>();
    let coloredCount = 0;

    value.items.forEach((item, i) => {
      if (itemIds.has(item.id)) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['items', i, 'id'],
          message: `duplicate item id "${item.id}"`,
        });
      }
      itemIds.add(item.id);

      if (item.colors !== undefined) {
        if (item.colors.length !== 3) {
          ctx.addIssue({
            code: z.ZodIssueCode.custom,
            path: ['items', i, 'colors'],
            message: `item "${item.id}" colors must have exactly 3 colour variants`,
          });
        } else {
          coloredCount++;
        }
        const seenColors = new Set<string>();
        const seenArts = new Set<string>();
        item.colors.forEach((variant, j) => {
          if (seenColors.has(variant.color)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['items', i, 'colors', j, 'color'],
              message: `duplicate colour "${variant.color}" on item "${item.id}"`,
            });
          }
          if (seenArts.has(variant.art)) {
            ctx.addIssue({
              code: z.ZodIssueCode.custom,
              path: ['items', i, 'colors', j, 'art'],
              message: `duplicate colour art "${variant.art}" on item "${item.id}"`,
            });
          }
          seenColors.add(variant.color);
          seenArts.add(variant.art);
        });
      }
    });

    for (const lang of ['en', 'fr'] as const) {
      const f = value.frames[lang];
      if (!f.put.includes('{the}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'put'], message: 'put frame must include {the}' });
      }
      if (!f.two.includes('{a}') || !f.two.includes('{b}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'two'], message: 'two frame must include {a} and {b}' });
      }
      if (!f.not.includes('{a}') || !f.not.includes('{one}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'not'], message: 'not frame must include {a} and {one}' });
      }
      for (const ph of ['{a}', '{b}', '{c}']) {
        if (!f.set.includes(ph)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'set'], message: `set frame must include ${ph}` });
        }
      }
      for (const ph of ['{a}', '{b}', '{c}', '{one}']) {
        if (!f.setNot.includes(ph)) {
          ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'setNot'], message: `setNot frame must include ${ph}` });
        }
      }
      if (!f.name.includes('{The}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'name'], message: 'name frame must include {The}' });
      }
      if (!f.other.includes('{the}')) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['frames', lang, 'other'], message: 'other frame must include {the}' });
      }
    }

    const itemById = new Map(value.items.map((i) => [i.id, i]));
    const setIds = new Set<string>();
    value.sets.forEach((set, i) => {
      const at = (mode: 'attribute' | 'negation') => ['sets', i, mode];
      if (setIds.has(set.id)) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sets', i, 'id'], message: `duplicate set id "${set.id}"` });
      }
      setIds.add(set.id);
      for (const mode of ['attribute', 'negation'] as const) {
        const slots = set[mode];
        const issue = (message: string) => ctx.addIssue({ code: z.ZodIssueCode.custom, path: at(mode), message });
        if (new Set(slots.map((s) => s.item)).size !== slots.length) issue(`set "${set.id}" ${mode} repeats an item`);
        slots.forEach((slot) => {
          const item = itemById.get(slot.item);
          if (!item) {
            issue(`set "${set.id}" ${mode} names unknown item "${slot.item}"`);
            return;
          }
          const colourOk = (c: string) => item.colors?.some((v) => v.color === c) ?? false;
          if (slot.color !== undefined && !colourOk(slot.color)) issue(`set "${set.id}" item "${slot.item}" has no colour "${slot.color}"`);
          if (slot.notColor !== undefined && !colourOk(slot.notColor)) issue(`set "${set.id}" item "${slot.item}" has no colour "${slot.notColor}"`);
          if (mode === 'attribute' && slot.notColor !== undefined) issue(`set "${set.id}" attribute slot must not use notColor`);
          if (mode === 'negation' && slot.color !== undefined) issue(`set "${set.id}" negation slot must not use color`);
        });
        if (mode === 'attribute' && !slots.some((s) => s.color !== undefined)) {
          issue(`set "${set.id}" attribute needs at least one colour-specified slot`);
        }
        if (mode === 'negation' && slots.filter((s) => s.notColor !== undefined).length !== 1) {
          issue(`set "${set.id}" negation needs exactly one notColor slot`);
        }
      }
      if (set.attribute.length !== set.negation.length) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sets', i], message: `set "${set.id}" attribute and negation must have the same size` });
      }
      const attrItems = set.attribute.map((s) => s.item).sort().join(',');
      const negItems = set.negation.map((s) => s.item).sort().join(',');
      if (attrItems !== negItems) {
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['sets', i], message: `set "${set.id}" attribute and negation must use the same items` });
      }
    });

    const levelCount = value.adaptive.levels.length;
    for (const trackName of ['age2', 'age5'] as const) {
      const tr = value.adaptive.tracks[trackName];
      if (tr.min < 1 || tr.max > levelCount || tr.start < tr.min || tr.start > tr.max) {
        ctx.addIssue({
          code: z.ZodIssueCode.custom,
          path: ['adaptive', 'tracks', trackName],
          message: `track ${trackName} bounds must lie within 1..${levelCount}`,
        });
      }
    }

    value.adaptive.levels.forEach((level, i) => {
      const issue = (message: string) =>
        ctx.addIssue({ code: z.ZodIssueCode.custom, path: ['adaptive', 'levels', i], message });

      if (level.support !== 'picture-audio' && level.support !== 'audio-only') {
        issue('travel-suitcase supports support "picture-audio" or "audio-only"');
      }

      const choiceCount = level.choiceCount;
      if (
        typeof choiceCount !== 'number' ||
        !Number.isInteger(choiceCount) ||
        choiceCount < 2 ||
        choiceCount > value.items.length
      ) {
        issue(`choiceCount must be an integer between 2 and ${value.items.length}`);
      }

      const req = level.extra?.request;
      if (typeof req !== 'string' || !(SUITCASE_REQUESTS as readonly string[]).includes(req)) {
        issue(`extra.request must be one of ${SUITCASE_REQUESTS.join(', ')}`);
      }

      const requestsPerCase = level.extra?.requestsPerCase;
      if (typeof requestsPerCase !== 'number' || !Number.isInteger(requestsPerCase) || requestsPerCase < 1) {
        issue('extra.requestsPerCase must be a positive integer');
      }

      const rawSetSize = level.extra?.setSize;
      const setSize = rawSetSize === undefined ? 1 : rawSetSize;
      if (typeof setSize !== 'number' || !Number.isInteger(setSize) || setSize < 1) {
        issue('extra.setSize must be a positive integer');
        return;
      }
      if (setSize > 1 && req !== 'attribute' && req !== 'negation') {
        issue('extra.setSize above 1 requires an attribute or negation request');
      }

      if (req === 'attribute' || req === 'negation') {
        if (coloredCount < 2) {
          issue(`${req} request requires at least 2 coloured items`);
        }
        if (setSize === 1) {
          if (choiceCount !== 4) {
            issue(`${req} request requires choiceCount 4 (3 colours + 1 other item)`);
          }
        } else {
          // attribute: the set + at least one near (other-colour) distractor; negation: 3 colours + the other slots.
          const minChoices = req === 'attribute' ? setSize + 1 : setSize + 2;
          if (typeof choiceCount === 'number' && choiceCount < minChoices) {
            issue(`${req} set request needs choiceCount of at least ${minChoices}`);
          }
          const matching = value.sets.filter((set) => set[req].length === setSize);
          if (matching.length === 0) {
            issue(`${req} set level needs curated sets of ${setSize} items`);
          }
          for (const set of matching) {
            const items = new Set(set[req].map((s) => s.item));
            const hasPartner = matching.some((o) => o.id !== set.id && o[req].every((s) => !items.has(s.item)));
            if (!hasPartner && (level.extra?.requestsPerCase as number) > 1) {
              issue(`set "${set.id}" needs a disjoint partner set for requestsPerCase > 1`);
            }
          }
        }
      }
    });
  });

export type SuitcaseColorVariant = z.infer<typeof SuitcaseColorVariantSchema>;
export type SuitcaseItem = z.infer<typeof SuitcaseItemSchema>;
export type TravelSuitcaseContent = z.infer<typeof TravelSuitcaseContentSchema>;

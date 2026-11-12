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
    support: z.enum(['picture-audio', 'partial-reveal', 'audio-first', 'audio-only', 'clue']).optional(),
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

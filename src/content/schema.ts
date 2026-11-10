import { z } from 'zod';

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

export const RestaurantItemSchema = z.object({
  id: z.string().min(1),
  he: z.string().min(1),
  color: z.string().min(1),
  shape: z.string().min(1),
  prompts: z.object({
    en: CountedPromptsSchema,
    fr: CountedPromptsSchema,
  }),
});

export const AgeTrackConfigSchema = z.object({
  choiceCount: z.number().int().min(2),
  counts: z.array(z.union([z.literal(1), z.literal(2), z.literal(3)])).min(1),
  hintMode: z.enum(['demonstrate', 'repeat-then-demonstrate']),
  hintDelayMs: z.number().int().positive(),
});

export const AnimalRestaurantContentSchema = z.object({
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
  items: z.array(RestaurantItemSchema).min(1),
});

export type RestaurantItem = z.infer<typeof RestaurantItemSchema>;
export type AgeTrackConfig = z.infer<typeof AgeTrackConfigSchema>;
export type AnimalRestaurantContent = z.infer<typeof AnimalRestaurantContentSchema>;

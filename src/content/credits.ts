import { z } from 'zod';

/** Only licences allowed for third-party art and sound (see docs/ASSETS.md). */
export const ALLOWED_CREDIT_LICENCES = ['CC0', 'CC-BY'] as const;

const nonEmpty = z.string().trim().min(1);

export const creditItemSchema = z.object({
  title: nonEmpty,
  author: nonEmpty,
  source: z.string().url(),
  licence: z.enum(ALLOWED_CREDIT_LICENCES),
  files: z.array(nonEmpty).min(1),
});

export const creditsFileSchema = z.object({ items: z.array(creditItemSchema) });

export type CreditItem = z.infer<typeof creditItemSchema>;
export type CreditsFile = z.infer<typeof creditsFileSchema>;

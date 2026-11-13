import { describe, it, expect } from 'vitest';
import creditsJson from '../../src/content/credits.json';
import { creditsFileSchema, creditItemSchema } from '../../src/content/credits';

const good = {
  title: 'Happy Bear',
  author: 'Jane Doe',
  source: 'https://example.org/happy-bear',
  licence: 'CC-BY',
  files: ['public/art/happy-bear.png'],
};

describe('credits schema', () => {
  it('validates the shipped list', () => {
    expect(creditsFileSchema.safeParse(creditsJson).success).toBe(true);
  });
  it('accepts well-formed CC0 and CC-BY entries', () => {
    expect(creditItemSchema.safeParse(good).success).toBe(true);
    expect(creditItemSchema.safeParse({ ...good, licence: 'CC0' }).success).toBe(true);
  });
  it.each(['title', 'author', 'source', 'licence', 'files'])('rejects a missing %s', (key) => {
    const bad: Record<string, unknown> = { ...good };
    delete bad[key];
    expect(creditItemSchema.safeParse(bad).success).toBe(false);
  });
  it('rejects empty required strings', () => {
    expect(creditItemSchema.safeParse({ ...good, title: '' }).success).toBe(false);
    expect(creditItemSchema.safeParse({ ...good, author: '  ' }).success).toBe(false);
  });
  it('rejects a bad source URL', () => {
    expect(creditItemSchema.safeParse({ ...good, source: 'not a url' }).success).toBe(false);
  });
  it('rejects an empty or blank files list', () => {
    expect(creditItemSchema.safeParse({ ...good, files: [] }).success).toBe(false);
    expect(creditItemSchema.safeParse({ ...good, files: [''] }).success).toBe(false);
  });
  it.each(['CC-BY-SA', 'CC-BY-NC', 'CC-BY-NC-SA', 'CC-BY-ND', 'MIT', 'Apache-2.0', 'cc-by', ''])(
    'rejects disallowed licence %s',
    (licence) => {
      expect(creditItemSchema.safeParse({ ...good, licence }).success).toBe(false);
    },
  );
});

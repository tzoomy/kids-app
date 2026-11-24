// Who's Hiding? age-5 stretch (docs/specs/who-is-hiding.md, L9-L10 "Who is missing?", AC-41 to AC-44).
import { describe, expect, it } from 'vitest';
import { loadWhosHiding } from '@/content/loadContent';
import { WhosHidingContentSchema } from '@/content/schema';
import { buildHidingRound, hidingLevel, missingLines, MISSING_INTRO_HE_ID } from '@/games/hiding/hidingRound';
import { computeShadowLayout } from '@/games/hiding/shadowLayout';
import { enumerateGameVoiceLines } from '../helpers/gameVoiceLines';

const content = loadWhosHiding();
const levels = content.adaptive.levels;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

// The eight levels shipped before the stretch, verbatim (origin/main 3b9b160).
const L1_TO_L8 = [
  { choiceCount: 2, distractor: 'far', support: 'partial-reveal', extra: { reveal: 0.9, speak: 'name-sound' } },
  { choiceCount: 3, distractor: 'far', support: 'partial-reveal', extra: { reveal: 0.8, speak: 'name-sound' } },
  { choiceCount: 3, distractor: 'same-category', support: 'partial-reveal', extra: { reveal: 0.6, speak: 'name-sound' } },
  { choiceCount: 4, distractor: 'same-category', support: 'partial-reveal', extra: { reveal: 0.5, speak: 'name-sound' } },
  { choiceCount: 4, distractor: 'same-category', support: 'partial-reveal', extra: { reveal: 0.3, speak: 'name' } },
  { choiceCount: 5, distractor: 'same-category', support: 'partial-reveal', extra: { reveal: 0.3, speak: 'name' } },
  { choiceCount: 5, distractor: 'same-category', support: 'audio-only', extra: { reveal: 0.3, speak: 'sound' } },
  { choiceCount: 6, distractor: 'same-category', support: 'audio-only', extra: { reveal: 0.3, speak: 'sound', soundMs: 800 } },
];

describe('[AC-41] the age-5 stretch keeps the age-2 ladder untouched', () => {
  it('[AC-41] L1-L8 are unchanged, L9-L10 are "Who is missing?", age2 stays { 2, 1, 8 } and age5 reaches L10', () => {
    expect(levels.slice(0, 8)).toEqual(L1_TO_L8);
    expect(levels).toHaveLength(10);
    expect(content.adaptive.tracks.age2).toEqual({ start: 2, min: 1, max: 8 });
    expect(content.adaptive.tracks.age5.max).toBe(10);
    expect(levels.slice(0, 8).every((l) => !hidingLevel(l).missing)).toBe(true);
    expect(hidingLevel(levels[8])).toMatchObject({ missing: true, choiceCount: 4, audioOnly: false, peekMs: 3500, backMs: 2500 });
    expect(hidingLevel(levels[9])).toMatchObject({ missing: true, choiceCount: 6, audioOnly: true, peekMs: 2500, backMs: 1500 });
  });

  it('[AC-41] L1-L8 request and hint line ids (including the clue / clue-short hints) are unchanged', () => {
    const rabbit = 'rabbit';
    const ids = levels.slice(0, 8).map((l) => {
      const r = buildHidingRound(content, l, 'en', rabbit, seeded(1));
      return [r.lineId, r.hintLineId];
    });
    expect(ids).toEqual([
      ['hiding.rabbit.name-sound.en', 'hiding.rabbit.hint.name-sound.en'],
      ['hiding.rabbit.name-sound.en', 'hiding.rabbit.hint.name-sound.en'],
      ['hiding.rabbit.name-sound.en', 'hiding.rabbit.hint.name-sound.en'],
      ['hiding.rabbit.name-sound.en', 'hiding.rabbit.hint.name-sound.en'],
      ['hiding.rabbit.name.en', 'hiding.rabbit.hint.name.en'],
      ['hiding.rabbit.name.en', 'hiding.rabbit.hint.name.en'],
      ['hiding.rabbit.sound.en', 'hiding.rabbit.hint.clue.en'],
      ['hiding.rabbit.sound-short.en', 'hiding.rabbit.hint.clue-short.en'],
    ]);
  });

  it('[AC-41] the schema rejects a missing level without the missing lines or with fewer than 3 animals', () => {
    const clone = () => JSON.parse(JSON.stringify(content)) as Record<string, any>;
    expect(WhosHidingContentSchema.safeParse(clone()).success).toBe(true);
    const noLines = clone();
    delete noLines.missing;
    expect(WhosHidingContentSchema.safeParse(noLines).success).toBe(false);
    const two = clone();
    two.adaptive.levels[8].choiceCount = 2;
    expect(WhosHidingContentSchema.safeParse(two).success).toBe(false);
  });
});

describe('[AC-42] "Who is missing?" rounds', () => {
  it('[AC-42] the runaway is in the line-up; the answer cards are exactly the line-up, so one card is right', () => {
    for (const l of levels.slice(8))
      for (const a of content.animals)
        for (const lang of ['en', 'fr'] as const)
          for (let seed = 1; seed <= 5; seed++) {
            const r = buildHidingRound(content, l, lang, a.id, seeded(seed));
            const n = hidingLevel(l).choiceCount;
            expect(r.choices).toHaveLength(n);
            expect(new Set(r.choices.map((c) => c.id)).size).toBe(n);
            expect(r.choices.map((c) => c.id)).toContain(a.id);
            expect(r.cards!.map((c) => c.id).sort()).toEqual(r.choices.map((c) => c.id).sort());
            expect(r.lineId).toBe(`hiding.missing.ask.${lang}`);
            // The hint is the runaway's sound, never its name.
            expect(r.hintLineId).toBe(`hiding.missing.${a.id}.hint.${lang}`);
            expect(r.hintText).toContain(a.sound[lang]);
            expect(r.hintText).not.toContain(a.name[lang]);
          }
  });

  it('[AC-42] six answer cards stay >= 64 CSS px on a 360x800 phone, an 800x360 phone and tablets, all on screen', () => {
    for (const v of [
      { w: 360, h: 800 },
      { w: 800, h: 360 },
      { w: 1024, h: 768 },
      { w: 768, h: 1024 },
    ]) {
      const game = v.w >= v.h ? { width: 1280, height: 800 } : { width: 800, height: 1280 };
      const scale = Math.min(v.w / game.width, v.h / game.height);
      for (const n of [4, 6]) {
        const layout = computeShadowLayout(game.width, game.height, n);
        expect(layout.slots).toHaveLength(n);
        for (const s of layout.slots) {
          expect((s.hit.right - s.hit.left) * scale).toBeGreaterThanOrEqual(64);
          expect((s.hit.bottom - s.hit.top) * scale).toBeGreaterThanOrEqual(64);
          expect(s.hit.left).toBeGreaterThanOrEqual(0);
          expect(s.hit.right).toBeLessThanOrEqual(game.width);
          expect(s.hit.bottom).toBeLessThanOrEqual(game.height);
        }
      }
    }
  });
});

describe('[AC-43] "Who is missing?" voice', () => {
  it('[AC-43] look / gone / ask, the sound hints and the Hebrew rule line are registered with no conflicts', () => {
    const { lines, conflicts } = enumerateGameVoiceLines();
    expect(conflicts).toEqual({});
    const byId = new Map(lines.map((l) => [l.id, l]));
    for (const lang of ['en', 'fr'] as const) {
      const m = missingLines(content, lang)!;
      for (const s of [m.look, m.gone, m.ask]) expect(byId.get(s.lineId)?.text).toBe(s.text);
      for (const a of content.animals) expect(byId.get(`hiding.missing.${a.id}.hint.${lang}`)?.text).toBe(`${m.ask.text} ${a.sound[lang]}`);
    }
    expect(missingLines(content, 'en')!.ask.text).toBe('Who is missing?');
    expect(missingLines(content, 'fr')!.ask.text).toBe('Qui a disparu ?');
    const he = byId.get(MISSING_INTRO_HE_ID)!;
    expect(he.text).toBe(content.missing!.introHe);
    expect(he.text).toContain('הסתכלי');
    expect(he.text).toContain('תגלי');
  });
});

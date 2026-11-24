// Who Lives Here? age-5 stretch (docs/specs/who-lives-here.md, L9-L10 "mystery animal", AC-21 to AC-23).
import { describe, expect, it } from 'vitest';
import { loadWhoLivesHere } from '@/content/loadContent';
import { WhoLivesHereContentSchema } from '@/content/schema';
import { askHeLineId, askLines, buildHabitatRound, levelLevers, mysteryLine, wrongLines, HABITAT_HE_TEXT } from '@/games/habitat';
import { enumerateGameVoiceLines } from '../helpers/gameVoiceLines';

const content = loadWhoLivesHere();
const levels = content.adaptive.levels;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

// The eight levels shipped before the stretch, verbatim (origin/main 3b9b160).
const L1_TO_L8 = [
  { choiceCount: 2, distractor: 'far', request: 'noun', scaffold: 'outline', extra: { clue: 'none' } },
  { choiceCount: 2, distractor: 'far', request: 'noun', extra: { clue: 'none' } },
  { choiceCount: 3, distractor: 'far', request: 'noun', extra: { clue: 'none' } },
  { choiceCount: 3, distractor: 'near', request: 'noun', extra: { clue: 'none' } },
  { choiceCount: 3, distractor: 'near', request: 'noun', extra: { clue: 'after-miss' } },
  { choiceCount: 4, distractor: 'near', request: 'noun', extra: { clue: 'after-miss' } },
  { choiceCount: 4, distractor: 'near', request: 'riddle', extra: { clue: 'after-miss' } },
  { choiceCount: 4, distractor: 'near', request: 'riddle', support: 'audio-only', extra: { clue: 'after-miss' } },
];

describe('who-lives-here: age-5 mystery stretch (AC-21)', () => {
  it('[AC-21] L1-L8 are unchanged, L9-L10 are mystery levels, age2 stays { 1, 1, 4 } and age5 reaches L10', () => {
    expect(levels.slice(0, 8)).toEqual(L1_TO_L8);
    expect(levels).toHaveLength(10);
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 4 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 5, min: 3, max: 10 });
    expect(levels[8]).toEqual({ choiceCount: 4, distractor: 'near', request: 'mystery', extra: { clue: 'after-miss' } });
    expect(levels[9]).toEqual({ choiceCount: 4, distractor: 'near', request: 'mystery', support: 'audio-only', extra: { clue: 'after-miss' } });
    expect(levels.slice(0, 8).every((l) => !levelLevers(l).hideAnimal)).toBe(true);
    for (const l of levels.slice(8)) expect(levelLevers(l)).toMatchObject({ request: 'mystery', hideAnimal: true, choiceCount: 4, clueAfterMiss: true });
    expect(levelLevers(levels[9]).audioOnly).toBe(true);
  });

  it('[AC-21] the schema rejects a mystery level when any animal lacks a riddle', () => {
    const clone = JSON.parse(JSON.stringify(content)) as Record<string, any>;
    expect(WhoLivesHereContentSchema.safeParse(clone).success).toBe(true);
    delete clone.animals[2].mystery;
    expect(WhoLivesHereContentSchema.safeParse(clone).success).toBe(false);
  });

  it('[AC-21] mystery rounds keep the normal round shape: 4 homes and every animal\'s home on screen', () => {
    for (const l of levels.slice(8))
      for (let seed = 1; seed <= 30; seed++) {
        const plan = buildHabitatRound({ content, levers: levelLevers(l), trials: 3, random: seeded(seed), firstAnimalId: content.animals[seed % 6].id });
        expect(plan.homeIds).toHaveLength(4);
        for (const a of plan.animals) expect(plan.homeIds).toContain(a.homeId);
      }
  });
});

describe('who-lives-here: mystery voice (AC-22)', () => {
  it('[AC-22] every animal has a two-clue riddle that differs from its clue and never names the animal or its home', () => {
    for (const animal of content.animals) {
      expect(animal.mystery).toBeDefined();
      for (const lang of ['en', 'fr'] as const) {
        const riddle = animal.mystery![lang];
        expect(riddle).not.toBe(animal.clue[lang]);
        expect(riddle.split(/[.!?] /).length).toBeGreaterThanOrEqual(2);
        expect(riddle.toLowerCase()).not.toContain(animal.name[lang].replace(/^(the|la|le|l'|l’) /i, '').toLowerCase());
        const home = content.homes.find((h) => h.id === animal.home)!;
        expect(riddle.toLowerCase()).not.toContain(home.name[lang].replace(/^(the|la|le|l'|l’) ?/i, '').toLowerCase());
      }
    }
  });

  it('[AC-22] the ask speaks the Hebrew mystery line then the riddle; a miss replays the old descriptive clue', () => {
    const levers = levelLevers(levels[8]);
    const owl = content.animals.find((a) => a.id === 'owl')!;
    expect(askHeLineId(levers)).toBe('habitat.mystery.ask.he');
    expect(askHeLineId(levelLevers(levels[7]))).toBe('habitat.ask.he');
    expect(askLines(content, owl, levers, 'fr').map((l) => l.lineId)).toEqual(['habitat.mystery.ask.he', 'habitat.mystery.owl.fr']);
    expect(wrongLines(content, owl, levers, 'en').map((l) => l.lineId)).toEqual(['habitat.wrong.he', 'habitat.clue.owl.en']);
  });

  it('[AC-22] the riddle and the Hebrew ask are registered with no conflicts; the Hebrew addresses one girl', () => {
    const { lines, conflicts } = enumerateGameVoiceLines();
    expect(conflicts).toEqual({});
    const byId = new Map(lines.map((l) => [l.id, l]));
    for (const animal of content.animals)
      for (const lang of ['en', 'fr'] as const) expect(byId.get(`habitat.mystery.${animal.id}.${lang}`)?.text).toBe(mysteryLine(animal, lang).text);
    const he = HABITAT_HE_TEXT['habitat.mystery.ask.he'];
    expect(byId.get('habitat.mystery.ask.he')?.text).toBe(he);
    expect(he).toContain('הקשיבי');
    expect(he).toContain('הקישי');
  });
});

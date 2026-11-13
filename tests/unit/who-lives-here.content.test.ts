// Who Lives Here? Pass 1: content, schema, language and voice-line contract (docs/specs/who-lives-here.md AC-09, AC-10).
import { describe, expect, it } from 'vitest';
import { ART_MANIFEST } from '@/assets/art/manifest';
import { HABITAT_ANIMAL_RIGS, ANIMAL_RIGS } from '@/assets/art/rigs';
import { loadWhoLivesHere, loadWorlds } from '@/content/loadContent';
import { WhoLivesHereContentSchema } from '@/content/schema';
import whoLivesHereJson from '@/content/games/who-lives-here.json';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';
import {
  askLines,
  correctLines,
  helpLine,
  levelLevers,
  wrongLines,
} from '@/games/habitat';

const content = loadWhoLivesHere();

describe('who-lives-here: content (AC-09)', () => {
  it('[AC-09] the JSON validates against the zod schema and belongs to Nature Lab', () => {
    expect(WhoLivesHereContentSchema.safeParse(whoLivesHereJson).success).toBe(true);
    expect(content.id).toBe('who-lives-here');
    expect(content.world).toBe('nature-lab');
    expect(content.languages).toEqual(['en', 'fr']);
  });

  it('[AC-09] six animals, each with a known home, EN and FR names and clues, a registered rig, and no shared home', () => {
    expect(content.animals).toHaveLength(6);
    const homeIds = new Set(content.homes.map((h) => h.id));
    const rigs = { ...ANIMAL_RIGS, ...HABITAT_ANIMAL_RIGS };
    for (const animal of content.animals) {
      expect(homeIds.has(animal.home), `${animal.id} home`).toBe(true);
      expect(animal.name.en.length).toBeGreaterThan(0);
      expect(animal.name.fr.length).toBeGreaterThan(0);
      expect(animal.clue.en.length).toBeGreaterThan(0);
      expect(animal.clue.fr.length).toBeGreaterThan(0);
      expect(rigs[animal.kind], `${animal.id} rig`).toBeDefined();
    }
    expect(new Set(content.animals.map((a) => a.home)).size).toBe(content.animals.length);
  });

  it('[AC-09] every home has EN and FR names, a family and existing back and front art', () => {
    expect(content.homes).toHaveLength(6);
    const keys = new Set(ART_MANIFEST.map((e) => e.key));
    for (const home of content.homes) {
      expect(home.name.en.length).toBeGreaterThan(0);
      expect(home.name.fr.length).toBeGreaterThan(0);
      expect(home.family.length).toBeGreaterThan(0);
      expect(keys.has(`home-${home.id}-back`), `${home.id} back`).toBe(true);
      expect(keys.has(`home-${home.id}-front`), `${home.id} front`).toBe(true);
    }
    expect(keys.has('habitats-bg-landscape')).toBe(true);
    expect(keys.has('habitats-bg-portrait')).toBe(true);
  });

  it('[AC-09] the schema rejects a broken level, a missing home and a choiceCount above the home count', () => {
    const clone = () => JSON.parse(JSON.stringify(whoLivesHereJson)) as typeof whoLivesHereJson;
    const noHome = clone();
    noHome.animals[0].home = 'cave';
    expect(WhoLivesHereContentSchema.safeParse(noHome).success).toBe(false);
    const tooMany = clone();
    tooMany.adaptive.levels[0] = { ...tooMany.adaptive.levels[0], choiceCount: 7 } as never;
    expect(WhoLivesHereContentSchema.safeParse(tooMany).success).toBe(false);
    const badRequest = clone();
    badRequest.adaptive.levels[0] = { ...badRequest.adaptive.levels[0], request: 'sequence' } as never;
    expect(WhoLivesHereContentSchema.safeParse(badRequest).success).toBe(false);
  });

  it('[AC-09] the eight levels climb from 2 far homes to 4 near homes with riddles, and age 2 stops at level 4', () => {
    const levers = content.adaptive.levels.map(levelLevers);
    expect(levers).toHaveLength(8);
    expect(levers.map((l) => l.choiceCount)).toEqual([2, 2, 3, 3, 3, 4, 4, 4]);
    expect(levers[0]).toMatchObject({ distractor: 'far', request: 'noun', glow: true, clueAfterMiss: false });
    expect(levers[3]).toMatchObject({ distractor: 'near' });
    expect(levers[4]).toMatchObject({ clueAfterMiss: true });
    expect(levers[6]).toMatchObject({ request: 'riddle' });
    expect(levers[7]).toMatchObject({ request: 'riddle', audioOnly: true });
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 4 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 5, min: 3, max: 8 });
  });

  it('[AC-09] age 2 gets an idle demonstrate hint, age 5 only a hint after a miss', () => {
    expect(content.ageTracks.age2.hintMode).toBe('demonstrate');
    expect(content.ageTracks.age5.hintMode).toBe('repeat-then-demonstrate');
  });

  it('[AC-09] Nature Lab stays open, earns leisure, and keeps Who\'s Hiding? as its entry game', () => {
    const nature = loadWorlds().worlds.find((w) => w.id === 'nature-lab');
    expect(nature).toMatchObject({ status: 'open', earnsLeisure: true, entryGameId: 'who-is-hiding' });
  });

  it('[AC-09] the round language follows the language setting (en only, fr only, or either when both)', () => {
    expect(nextRoundLanguage(null, true, 'en', () => 0.9)).toBe('en');
    expect(nextRoundLanguage(null, true, 'fr', () => 0.1)).toBe('fr');
    expect(nextRoundLanguage('fr', false, 'both', () => 0.1)).toBe('fr');
    expect(['en', 'fr']).toContain(nextRoundLanguage(null, true, 'both', () => 0.5));
  });
});

describe('who-lives-here: voice lines (AC-10)', () => {
  const frog = content.animals.find((a) => a.id === 'frog')!;
  const bird = content.animals.find((a) => a.id === 'bird')!;
  const nounLevel = levelLevers(content.adaptive.levels[0]);
  const riddleLevel = levelLevers(content.adaptive.levels[6]);

  it('[AC-10] a noun level asks in Hebrew, then names the animal in the round language', () => {
    const lines = askLines(content, frog, nounLevel, 'en');
    expect(lines.map((l) => [l.lineId, l.lang])).toEqual([
      ['habitat.ask.he', 'he'],
      ['habitat.name.frog.en', 'en'],
    ]);
    expect(lines[1].text).toBe(frog.name.en);
    expect(askLines(content, frog, nounLevel, 'fr')[1]).toMatchObject({ lineId: 'habitat.name.frog.fr', lang: 'fr', text: frog.name.fr });
  });

  it('[AC-10] a riddle level asks in Hebrew, then speaks the descriptive clue instead of the name', () => {
    const lines = askLines(content, bird, riddleLevel, 'fr');
    expect(lines.map((l) => [l.lineId, l.lang])).toEqual([
      ['habitat.ask.he', 'he'],
      ['habitat.clue.bird.fr', 'fr'],
    ]);
    expect(lines[1].text).toBe(bird.clue.fr);
  });

  it('[AC-10] a correct tap says the Hebrew praise, then the home word in the round language', () => {
    const lines = correctLines(content, frog, 'fr');
    expect(lines.map((l) => [l.lineId, l.lang])).toEqual([
      ['habitat.correct.he', 'he'],
      ['habitat.home.pond.fr', 'fr'],
    ]);
    expect(lines[1].text).toBe('la mare');
  });

  it('[AC-10] a wrong tap says the warm Hebrew retry line, plus the clue on clue-after-miss levels only', () => {
    const plain = wrongLines(content, frog, levelLevers(content.adaptive.levels[1]), 'en');
    expect(plain.map((l) => l.lineId)).toEqual(['habitat.wrong.he']);
    const withClue = wrongLines(content, frog, levelLevers(content.adaptive.levels[4]), 'en');
    expect(withClue.map((l) => [l.lineId, l.lang])).toEqual([
      ['habitat.wrong.he', 'he'],
      ['habitat.clue.frog.en', 'en'],
    ]);
  });

  it('[AC-10] the help line is Hebrew and every Hebrew line has text', () => {
    expect(helpLine()).toMatchObject({ lineId: 'habitat.help.he', lang: 'he' });
    for (const line of [helpLine(), ...askLines(content, frog, nounLevel, 'en'), ...correctLines(content, frog, 'en'), ...wrongLines(content, frog, nounLevel, 'en')]) {
      expect(line.text.length).toBeGreaterThan(0);
      if (line.lang === 'he') expect(line.text).toMatch(/[֐-׿]/);
    }
  });
});

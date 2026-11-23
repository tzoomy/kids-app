// Wave 2 [AC-fr-first]: age-5 (Elli) hears task instructions in the round's learning language (FR or EN) in Picnic Train,
// Sorting Beds, Potion Lab, Magic Magnet, Sink or Float and Seed to Flower. Age 2 (Shai) stays strictly Hebrew, and
// every miss / wrong / help line stays Hebrew for both tracks. Helpers default (no track / lang) to today's Hebrew.
import { describe, expect, it } from 'vitest';
import {
  loadMagicMagnet,
  loadPotionLab,
  loadSeedToFlower,
  loadSinkOrFloat,
} from '@/content/loadContent';
import { taskInstructionLang } from '@/core/audio/taskInstruction';
import {
  HELP_LINE as PICNIC_HELP,
  WRONG_COUNT_LINE,
  WRONG_GIVEN_LINE,
  askLine as picnicAskLine,
  equationAskId,
  equationCandidates,
  levelLevers,
  parseEquationId,
} from '@/games/picnic/picnicLogic';
import { PICNIC_LINE_TEXT } from '@/games/picnic/picnicVoice';
import picnicJson from '@/content/games/picnic-train.json';
import type { LevelDescriptor } from '@/content/schema';
import { ruleLine, switchLine } from '@/games/sorting/sortingLogic';
import { SORTING_LINE_TEXT } from '@/games/sorting/sortingVoice';
import {
  colorLine,
  introLine as potionIntro,
  namingLines,
  requestLine as potionRequest,
  tryAgainLine,
  visitStartLines as potionVisit,
} from '@/games/potionLab/potionRound';
import {
  askLines,
  introLine as magnetIntro,
  questionLines,
  reactionLines,
  roundStartLines,
  testLine,
  wordLine,
} from '@/games/magicMagnet/magnetRound';
import {
  askLine as sinkAsk,
  introLine as sinkIntro,
  letsSeeLine,
  namingLines as sinkNaming,
  visitStartLines as sinkVisit,
} from '@/games/sinkFloat/sinkFloatRound';
import { seedHeLine, seedTaskLine } from '@/games/seedFlower/seedFlowerRound';
import { enumerateGameVoiceLines } from '../helpers/gameVoiceLines';

const LANGS = ['en', 'fr'] as const;
const isHe = (r: { lineId: string; lang: string }) => r.lang === 'he' || r.lineId.endsWith('.he');

describe('[AC-fr-first] taskInstructionLang', () => {
  it('age5 follows the round language; age2 is always Hebrew', () => {
    expect(taskInstructionLang('age5', 'fr')).toBe('fr');
    expect(taskInstructionLang('age5', 'en')).toBe('en');
    expect(taskInstructionLang('age2', 'fr')).toBe('he');
    expect(taskInstructionLang('age2', 'en')).toBe('he');
  });
});

describe('[AC-fr-first] Picnic Train', () => {
  const stretch = (picnicJson.adaptive.levels as LevelDescriptor[])
    .map((l) => levelLevers(l).equation)
    .filter((r): r is NonNullable<typeof r> => !!r)
    .flatMap((r) => equationCandidates(r));

  it('default / Hebrew asks are unchanged', () => {
    expect(picnicAskLine({ task: 'load', target: 5 })).toEqual({ lineId: 'picnic.ask.load.5.he', lang: 'he' });
    expect(picnicAskLine({ task: 'missing', target: 0 })).toEqual({ lineId: 'picnic.ask.missing.he', lang: 'he' });
    expect(picnicAskLine({ task: 'give', target: 0 } as never)).toEqual({ lineId: 'picnic.ask.one-each.he', lang: 'he' });
    expect(equationAskId({ op: 'add', a: 3, b: 4 })).toBe('picnic.ask.add.3.4.he');
    expect(picnicAskLine({ task: 'load', target: 0, equation: { op: 'sub', a: 9, b: 4 } }).lineId).toBe('picnic.ask.sub.9.4.he');
  });

  it('EN / FR asks carry the new ids and idiomatic text', () => {
    expect(picnicAskLine({ task: 'load', target: 5 }, 'en')).toEqual({ lineId: 'picnic.ask.load.5.en', lang: 'en' });
    expect(PICNIC_LINE_TEXT['picnic.ask.load.5.en']).toBe('Pack five picnic items, then tap the flag!');
    expect(PICNIC_LINE_TEXT['picnic.ask.load.5.fr']).toBe('Emporte cinq objets pour le pique-nique, puis appuie sur le drapeau !');
    expect(PICNIC_LINE_TEXT['picnic.ask.load.10.fr']).toBe('Emporte dix objets pour le pique-nique, puis appuie sur le drapeau !');
    expect(PICNIC_LINE_TEXT['picnic.ask.missing.fr']).toBe("Certains copains ont déjà un objet. Combien d'objets manquent encore ?");
    expect(PICNIC_LINE_TEXT['picnic.ask.missing.en']).toBe('Some friends already have an item. How many items are still missing?');
    expect(PICNIC_LINE_TEXT['picnic.ask.one-each.en']).toBe("Let's feed the friends on the train! Give each friend one picnic item.");
    expect(PICNIC_LINE_TEXT['picnic.ask.one-each.fr']).toBe('Allons nourrir les copains dans le train ! Donne un objet de pique-nique à chaque copain.');
    expect(picnicAskLine({ task: 'missing', target: 0 }, 'fr').lineId).toBe('picnic.ask.missing.fr');
    expect(picnicAskLine({ task: 'give', target: 0 } as never, 'en').lineId).toBe('picnic.ask.one-each.en');
  });

  it('every stretch equation (L9-L10) has an EN and an FR ask, with spoken number words', () => {
    expect(stretch.length).toBeGreaterThan(20);
    for (const id of stretch) {
      const eq = parseEquationId(id)!;
      for (const lang of LANGS) {
        const lineId = equationAskId(eq, lang);
        expect(lineId).toBe(`picnic.ask.${eq.op}.${eq.a}.${eq.b}.${lang}`);
        expect(picnicAskLine({ task: 'load', target: 0, equation: eq }, lang)).toEqual({ lineId, lang });
        const text = PICNIC_LINE_TEXT[lineId];
        expect(text, lineId).toBeTruthy();
        expect(text, lineId).not.toMatch(/\d/);
      }
    }
    const add = stretch.map((id) => parseEquationId(id)!).find((e) => e.op === 'add' && e.a === 7 && e.b === 5);
    expect(add, 'L9-L10 L9 includes 7 + 5').toBeDefined();
    expect(PICNIC_LINE_TEXT['picnic.ask.add.7.5.en']).toBe('Pack seven items and five more, then tap the flag!');
    expect(PICNIC_LINE_TEXT['picnic.ask.add.7.5.fr']).toBe('Emporte sept objets et encore cinq, puis appuie sur le drapeau !');
    const sub = stretch.map((id) => parseEquationId(id)!).find((e) => e.op === 'sub' && e.a >= 11)!;
    expect(sub).toBeDefined();
    expect(PICNIC_LINE_TEXT[equationAskId(sub, 'fr')]).toMatch(/^Emporte \S+ objets, enlève \S+, puis appuie sur le drapeau !$/);
    expect(PICNIC_LINE_TEXT[equationAskId(sub, 'en')]).toMatch(/^Pack \S+ items, take out \S+, then tap the flag!$/);
  });

  it('help / wrong lines stay Hebrew', () => {
    for (const l of [PICNIC_HELP, WRONG_COUNT_LINE, WRONG_GIVEN_LINE]) expect(isHe(l)).toBe(true);
  });
});

describe('[AC-fr-first] Sorting Beds', () => {
  it('default rule / switch lines are unchanged Hebrew', () => {
    expect(ruleLine('color')).toEqual({ lineId: 'sorting.rule.color.he', lang: 'he' });
    expect(ruleLine('size+color')).toEqual({ lineId: 'sorting.rule.two-attr.he', lang: 'he' });
    expect(ruleLine('size+shape')).toEqual({ lineId: 'sorting.switch.shape.he', lang: 'he' });
    expect(switchLine('size+shape')).toEqual({ lineId: 'sorting.switch.shape.he', lang: 'he' });
  });

  it('EN / FR rule and switch lines use the new ids and texts', () => {
    expect(ruleLine('color', 'fr')).toEqual({ lineId: 'sorting.rule.color.fr', lang: 'fr' });
    expect(ruleLine('size+shape', 'en')).toEqual({ lineId: 'sorting.switch.shape.en', lang: 'en' });
    expect(switchLine('size', 'fr')).toEqual({ lineId: 'sorting.switch.size.fr', lang: 'fr' });
    const t = SORTING_LINE_TEXT;
    expect(t['sorting.rule.color.en']).toBe("Let's sort the flowers by color!");
    expect(t['sorting.rule.color.fr']).toBe('Rangeons les fleurs par couleur !');
    expect(t['sorting.rule.shape.fr']).toBe('Rangeons les fleurs par forme !');
    expect(t['sorting.rule.size.en']).toBe("Let's sort the flowers by size — big and small!");
    expect(t['sorting.rule.size.fr']).toBe('Rangeons les fleurs par taille — les grandes et les petites !');
    expect(t['sorting.rule.two-attr.en']).toBe('Pay attention to both color and size!');
    expect(t['sorting.rule.two-attr.fr']).toBe('Fais attention à la couleur et à la taille !');
    expect(t['sorting.switch.size.fr']).toBe('Surprise ! Maintenant, fais attention à la taille !');
    expect(t['sorting.switch.color.en']).toBe('Surprise! Now pay attention to color!');
    expect(t['sorting.switch.shape.fr']).toBe('Surprise ! Maintenant, fais attention à la forme !');
  });

  it('feedback and help lines are still Hebrew-only entries', () => {
    for (const id of ['sorting.correct', 'sorting.wrong.hint', 'sorting.bed-full', 'sorting.help']) {
      expect(SORTING_LINE_TEXT[`${id}.he`]).toBeTruthy();
      expect(SORTING_LINE_TEXT[`${id}.en`]).toBeUndefined();
      expect(SORTING_LINE_TEXT[`${id}.fr`]).toBeUndefined();
    }
  });
});

describe('[AC-fr-first] Potion Lab', () => {
  const content = loadPotionLab();

  it('default / age2 keep Hebrew intro, Hebrew request THEN the color word, Hebrew tryAgain', () => {
    expect(potionIntro(content, 'request')).toMatchObject({ lineId: 'potion.intro.request.he', lang: 'he' });
    expect(potionRequest(content, 'green')).toMatchObject({ lineId: 'potion.request.green.he', lang: 'he' });
    expect(tryAgainLine(content, 'green').lineId).toBe('potion.tryAgain.he');
    const input = { includeIntro: true, mode: 'request', request: 'green', learningLang: 'fr' } as const;
    const expected = [potionIntro(content, 'request'), potionRequest(content, 'green'), colorLine(content, 'green', 'fr')];
    expect(potionVisit(content, input)).toEqual(expected);
    expect(potionVisit(content, { ...input, track: 'age2' })).toEqual(expected);
  });

  it('age5 speaks intro + a single idiomatic request in the learning language (no Hebrew, no color follow-up)', () => {
    for (const lang of LANGS) {
      const lines = potionVisit(content, { includeIntro: true, mode: 'request', request: 'orange', learningLang: lang, track: 'age5' });
      expect(lines.map((l) => l.lineId)).toEqual([`potion.intro.request.${lang}`, `potion.request.orange.${lang}`]);
      expect(lines.every((l) => l.lang === lang)).toBe(true);
      const free = potionVisit(content, { includeIntro: true, mode: 'free', request: null, learningLang: lang, track: 'age5' });
      expect(free.map((l) => l.lineId)).toEqual([`potion.intro.free.${lang}`]);
    }
    expect(potionIntro(content, 'free', 'fr').text).toBe('Mélangeons des couleurs ! Appuie sur deux pots.');
    expect(potionIntro(content, 'free', 'en').text).toBe("Let's mix colors! Tap two pots.");
    expect(potionIntro(content, 'request', 'fr').text).toBe('Faisons une nouvelle couleur !');
    expect(potionIntro(content, 'request', 'en').text).toBe("Let's make a new color!");
    expect(potionRequest(content, 'green', 'en').text).toBe('Can you make green?');
    expect(potionRequest(content, 'green', 'fr').text).toBe('Peux-tu faire du vert ?');
    expect(potionRequest(content, 'orange', 'fr').text).toBe("Peux-tu faire de l'orange ?");
    expect(potionRequest(content, 'purple', 'fr').text).toBe('Peux-tu faire du violet ?');
  });

  it('age5 tryAgain is a unique id per color and language; Hebrew default untouched', () => {
    expect(tryAgainLine(content, 'green', 'en')).toMatchObject({ lineId: 'potion.tryAgain.green.en', lang: 'en', text: "Lovely! Now let's try to make green." });
    expect(tryAgainLine(content, 'green', 'fr').text).toBe('Bravo ! Maintenant, essayons de faire du vert.');
    expect(tryAgainLine(content, 'orange', 'fr').text).toBe("Bravo ! Maintenant, essayons de faire de l'orange.");
    expect(tryAgainLine(content, 'purple', 'fr').text).toBe('Bravo ! Maintenant, essayons de faire du violet.');
    expect(tryAgainLine(content, 'purple', 'en').lineId).toBe('potion.tryAgain.purple.en');
  });

  it('mix result naming stays Hebrew then learning language', () => {
    const [he, learn] = namingLines(content, 'green', 'fr');
    expect(he.lineId).toBe('potion.color.green.he');
    expect(learn.lineId).toBe('potion.color.green.fr');
  });
});

describe('[AC-fr-first] Magic Magnet', () => {
  const content = loadMagicMagnet();

  it('default / age2 keep the Hebrew ask + word, Hebrew intro and test', () => {
    expect(askLines(content, 'nail', 'fr').map((l) => l.lineId)).toEqual(['magnet.ask.nail.he', 'magnet.word.nail.fr']);
    expect(askLines(content, 'nail', 'fr', 'age2').map((l) => l.lineId)).toEqual(['magnet.ask.nail.he', 'magnet.word.nail.fr']);
    expect(magnetIntro(content, 'predict').lineId).toBe('magnet.intro.predict.he');
    expect(testLine(content).lineId).toBe('magnet.test.he');
    expect(roundStartLines(content, { includeIntro: true, mode: 'predict', targetId: 'nail', lang: 'en', audioOnly: false }).map((l) => l.lineId)).toEqual([
      'magnet.intro.predict.he',
      'magnet.ask.nail.he',
      'magnet.word.nail.en',
    ]);
  });

  it('age5 predict question is ONE learning-language sentence with the right article and « à l\'aimant »', () => {
    expect(askLines(content, 'paperclip', 'en', 'age5')).toEqual([
      { lineId: 'magnet.ask.paperclip.en', lang: 'en', text: 'Will the paperclip stick to the magnet?' },
    ]);
    const fr = (id: string) => askLines(content, id, 'fr', 'age5')[0].text;
    expect(fr('paperclip')).toBe("Est-ce que le trombone va coller à l'aimant ?");
    expect(fr('nail')).toBe("Est-ce que le clou va coller à l'aimant ?");
    expect(fr('screw')).toBe("Est-ce que la vis va coller à l'aimant ?");
    expect(fr('bottle-cap')).toBe("Est-ce que la capsule va coller à l'aimant ?");
    expect(fr('ball')).toBe("Est-ce que la balle va coller à l'aimant ?");
    expect(fr('leaf')).toBe("Est-ce que la feuille va coller à l'aimant ?");
    expect(fr('feather')).toBe("Est-ce que la plume va coller à l'aimant ?");
    expect(fr('apple')).toBe("Est-ce que la pomme va coller à l'aimant ?");
    expect(askLines(content, 'bottle-cap', 'en', 'age5')[0].text).toBe('Will the bottle cap stick to the magnet?');
    for (const obj of content.objects) {
      for (const lang of LANGS) {
        expect(askLines(content, obj.id, lang, 'age5')[0].lineId).toBe(`magnet.ask.${obj.id}.${lang}`);
      }
    }
  });

  it('age5 intro and test lines are in the learning language; audio-only keeps the word alone', () => {
    expect(magnetIntro(content, 'free', 'fr')).toMatchObject({ lineId: 'magnet.intro.free.fr', lang: 'fr', text: "Découvrons ce qui colle à l'aimant ! Fais glisser l'aimant." });
    expect(magnetIntro(content, 'free', 'en').text).toBe("Let's find out what sticks to the magnet! Drag the magnet.");
    expect(magnetIntro(content, 'predict', 'fr').text).toBe("Devinons ce qui va coller à l'aimant, puis nous vérifierons !");
    expect(magnetIntro(content, 'predict', 'en').text).toBe("Let's guess what will stick to the magnet, then we'll check!");
    expect(testLine(content, 'fr')).toMatchObject({ lineId: 'magnet.test.fr', lang: 'fr', text: "Vérifions ! Approche l'aimant." });
    expect(testLine(content, 'en').text).toBe("Let's check! Bring the magnet close.");
    expect(questionLines(content, 'nail', 'fr', true, 'age5')).toEqual([wordLine(content, 'nail', 'fr')]);
    expect(questionLines(content, 'nail', 'fr', false, 'age5').map((l) => l.lineId)).toEqual(['magnet.ask.nail.fr']);
    expect(
      roundStartLines(content, { includeIntro: true, mode: 'predict', targetId: 'ball', lang: 'fr', audioOnly: false, track: 'age5' }).map((l) => l.lineId),
    ).toEqual(['magnet.intro.predict.fr', 'magnet.ask.ball.fr']);
  });

  it('reaction lines stay Hebrew react + word + result', () => {
    expect(reactionLines(content, 'nail', 'fr').map((l) => l.lineId)).toEqual(['magnet.react.nail.he', 'magnet.word.nail.fr', 'magnet.sticks.fr']);
  });
});

describe('[AC-fr-first] Sink or Float', () => {
  const content = loadSinkOrFloat();

  it('default / age2 keep Hebrew intros and ask', () => {
    expect(sinkIntro(content, 'predict').lineId).toBe('sinkFloat.intro.predict.he');
    expect(sinkIntro(content, 'free').lineId).toBe('sinkFloat.intro.free.he');
    expect(sinkAsk(content).lineId).toBe('sinkFloat.ask.he');
    expect(sinkVisit(content, { includeIntro: true, mode: 'predict' }).map((l) => l.lineId)).toEqual(['sinkFloat.intro.predict.he']);
    expect(sinkVisit(content, { includeIntro: true, mode: 'predict', track: 'age2', learningLang: 'fr' }).map((l) => l.lineId)).toEqual([
      'sinkFloat.intro.predict.he',
    ]);
  });

  it('age5 intro and ask are single learning-language sentences', () => {
    expect(sinkIntro(content, 'free', 'en')).toMatchObject({ lineId: 'sinkFloat.intro.free.en', lang: 'en', text: "Let's see what floats and what sinks! Tap an object." });
    expect(sinkIntro(content, 'free', 'fr').text).toBe("Voyons ce qui flotte et ce qui coule ! Appuie sur un objet.");
    expect(sinkIntro(content, 'predict', 'en').text).toBe("Let's guess: will it float or sink?");
    expect(sinkIntro(content, 'predict', 'fr').text).toBe('Devinons : est-ce que ça va flotter ou couler ?');
    expect(sinkAsk(content, 'en')).toMatchObject({ lineId: 'sinkFloat.ask.en', lang: 'en', text: 'What do you think? Will it float or sink?' });
    expect(sinkAsk(content, 'fr')).toMatchObject({ lineId: 'sinkFloat.ask.fr', text: 'À ton avis, ça va flotter ou couler ?' });
    expect(sinkVisit(content, { includeIntro: true, mode: 'free', track: 'age5', learningLang: 'fr' }).map((l) => l.lineId)).toEqual(['sinkFloat.intro.free.fr']);
    expect(sinkVisit(content, { includeIntro: false, mode: 'free', track: 'age5', learningLang: 'fr' })).toEqual([]);
  });

  it('letsSee and result naming stay Hebrew then learning language', () => {
    expect(letsSeeLine(content).lineId).toBe('sinkFloat.letsSee.he');
    const [he, learn] = sinkNaming(content, 'apple' as never, 'fr');
    expect(he.lang).toBe('he');
    expect(learn.lang).toBe('fr');
  });
});

describe('[AC-fr-first] Seed to Flower', () => {
  const content = loadSeedToFlower();

  it('seedHeLine is unchanged Hebrew (intro, help, needWater, needSun)', () => {
    expect(seedHeLine(content, 'intro.ordered').lineId).toBe('seed.intro.ordered.he');
    expect(seedHeLine(content, 'needWater')).toEqual({ lineId: 'seed.needWater.he', lang: 'he', text: content.linesHe.needWater });
    expect(seedHeLine(content, 'needSun').lang).toBe('he');
    expect(seedHeLine(content, 'help').lang).toBe('he');
  });

  it('seedTaskLine: Hebrew for "he", learning-language intros otherwise', () => {
    expect(seedTaskLine(content, 'intro.free', 'he')).toEqual(seedHeLine(content, 'intro.free'));
    expect(seedTaskLine(content, 'intro.free', 'en')).toEqual({
      lineId: 'seed.intro.free.en',
      lang: 'en',
      text: "Let's grow a flower! Tap the water or the sun, and watch it grow.",
    });
    expect(seedTaskLine(content, 'intro.free', 'fr').text).toBe("Faisons pousser une fleur ! Appuie sur l'eau ou sur le soleil, et regarde-la grandir.");
    expect(seedTaskLine(content, 'intro.ordered', 'en').text).toBe("Let's grow a flower! First we water it, then the sun warms it.");
    expect(seedTaskLine(content, 'intro.ordered', 'fr')).toMatchObject({
      lineId: 'seed.intro.ordered.fr',
      text: "Faisons pousser une fleur ! D'abord on l'arrose, ensuite le soleil la réchauffe.",
    });
  });
});

// Mutation guards: these fail if age 2 ever gets EN/FR primary asks, or age 5 falls back to a Hebrew primary ask.
describe('[AC-fr-first] regression guards (age2 never EN/FR, age5 never Hebrew)', () => {
  const potion = loadPotionLab();
  const magnet = loadMagicMagnet();
  const sink = loadSinkOrFloat();
  const seed = loadSeedToFlower();

  it('age2 primary asks are never .en/.fr', () => {
    const age2 = (['en', 'fr'] as const).flatMap((roundLang) => {
      const lang = taskInstructionLang('age2', roundLang);
      return [
        picnicAskLine({ task: 'load', target: 4 }, lang),
        picnicAskLine({ task: 'missing', target: 0 }, lang),
        ruleLine('color', lang),
        switchLine('size', lang),
        potionIntro(potion, 'request', lang),
        potionRequest(potion, 'green', lang),
        ...potionVisit(potion, { includeIntro: true, mode: 'request', request: 'green', learningLang: roundLang, track: 'age2' }).slice(0, 2),
        ...askLines(magnet, 'nail', roundLang, 'age2').slice(0, 1),
        magnetIntro(magnet, 'free', lang),
        testLine(magnet, lang),
        sinkIntro(sink, 'predict', lang),
        sinkAsk(sink, lang),
        seedTaskLine(seed, 'intro.free', lang),
      ];
    });
    for (const l of age2) expect(isHe(l), l.lineId).toBe(true);
  });

  it('age5 primary asks are never Hebrew', () => {
    const age5 = (['en', 'fr'] as const).flatMap((roundLang) => {
      const lang = taskInstructionLang('age5', roundLang);
      return [
        picnicAskLine({ task: 'load', target: 4 }, lang),
        picnicAskLine({ task: 'missing', target: 0 }, lang),
        ruleLine('color', lang),
        switchLine('size', lang),
        potionIntro(potion, 'request', lang),
        potionRequest(potion, 'green', lang),
        tryAgainLine(potion, 'green', lang),
        ...potionVisit(potion, { includeIntro: true, mode: 'request', request: 'green', learningLang: roundLang, track: 'age5' }),
        ...askLines(magnet, 'nail', roundLang, 'age5'),
        magnetIntro(magnet, 'free', lang),
        testLine(magnet, lang),
        sinkIntro(sink, 'predict', lang),
        sinkAsk(sink, lang),
        seedTaskLine(seed, 'intro.ordered', lang),
      ];
    });
    for (const l of age5) {
      expect(isHe(l as { lineId: string; lang: string }), l.lineId).toBe(false);
      expect(l.lineId.endsWith(`.${l.lang}`), l.lineId).toBe(true);
    }
  });
});

describe('[AC-fr-first] voice catalogue (scripts/tts/game-lines.json via enumerateGameVoiceLines)', () => {
  // New EN/FR task-instruction ids only (the enumerator also lists existing Hebrew and naming words).
  const TASK_ID = /^(picnic\.ask\.|sorting\.(rule|switch)\.|potion\.(intro|request|tryAgain)\.|magnet\.(intro|ask|test)\.|sinkFloat\.(intro|ask)\.|seed\.intro\.)/;
  const catalog = enumerateGameVoiceLines().lines.filter((l) => TASK_ID.test(l.id) && l.lang !== 'he');
  const byGame = (game: string) => catalog.filter((l) => l.game === game);

  it('registers 220 new EN/FR ids for the six games, no Hebrew and no existing naming words', () => {
    expect(catalog).toHaveLength(220);
    const games = ['picnic-train', 'sorting-beds', 'potion-lab', 'magic-magnet', 'sink-or-float', 'seed-to-flower'];
    const counts: Record<string, number> = {
      'picnic-train': 158,
      'sorting-beds': 14,
      'potion-lab': 16,
      'magic-magnet': 22,
      'sink-or-float': 6,
      'seed-to-flower': 4,
    };
    for (const game of games) {
      const lines = byGame(game);
      expect(lines.length, game).toBe(counts[game]);
      for (const l of lines) {
        expect(l.lang, l.id).not.toBe('he');
        expect(l.id.endsWith(`.${l.lang}`), l.id).toBe(true);
        expect(l.id, l.id).not.toMatch(/\.(number|word|result|stage)\./);
        expect(l.id, l.id).not.toMatch(/^potion\.color\./);
      }
    }
  });

  it('contains the spot-checked asks and does not re-catalogue potion.tryAgain.he as a new id', () => {
    const ids = new Set(catalog.map((l) => l.id));
    for (const id of [
      'picnic.ask.missing.fr',
      'picnic.ask.add.10.2.en',
      'sorting.switch.shape.fr',
      'potion.request.orange.fr',
      'potion.tryAgain.purple.en',
      'magnet.ask.bottle-cap.fr',
      'magnet.test.en',
      'sinkFloat.ask.fr',
      'seed.intro.ordered.en',
    ]) {
      expect(ids.has(id), id).toBe(true);
    }
    expect(ids.has('potion.tryAgain.he')).toBe(false);
  });
});

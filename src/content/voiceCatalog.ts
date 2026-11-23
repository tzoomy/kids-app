// Voice catalogue of the games that speak through device TTS and whose lines the free-quota TTS job
// (scripts/tts/generate_voice.py -> collect_lines) renders later:
//  - Language House: Travel Suitcase, Letter Monster and Word Train (every playable line);
//  - Wave 2 French-first task instructions (age 5 / Elli): ONLY the new English and French task asks of Picnic Train,
//    Sorting Beds, Potion Lab, Magic Magnet, Sink or Float and Seed to Flower. The existing Hebrew lines of those six
//    games (and their EN/FR naming words) are deliberately not re-catalogued here.
// It enumerates every playable `{ id, lang, text, path }` using the same frames and helpers the games use, so unit tests
// can prove that every line a game can emit is catalogued.
//
// Nothing here is registered in audio-manifest.json or audio-text-hashes.json (no clips exist yet): until a
// clip is rendered the games keep speaking these lines with device TTS. The committed export read by the
// Python job is src/content/game-voice-lines.json (kept in sync by tests/unit/voiceCatalog.test.ts).
import {
  loadLetterMonster,
  loadMagicMagnet,
  loadPotionLab,
  loadSeedToFlower,
  loadSinkOrFloat,
  loadTravelSuitcase,
  loadWordTrain,
} from './loadContent';
import { LETTER_MONSTER_COLOR_IDS } from './schema';
import {
  askColorLine,
  askEndingLine,
  askLetterLine,
  askWordLine,
  colorWordLine,
  endingModelLine,
  foodLine as monsterFoodLine,
  introLine as monsterIntroLine,
  letterModelLine,
  notThisLine,
  wordLine as monsterWordLine,
} from '../games/letterMonster/monsterRound';
import { MAX_READ_WORD_LENGTH } from '../games/letterMonster/monsterMachine';
import {
  closedLine,
  introLine as suitcaseIntroLine,
  nameLine as suitcaseNameLine,
  otherLine as suitcaseOtherLine,
  requestLine as suitcaseRequestLine,
  setRequestSpec,
  type RequestLineSpec,
} from '../games/travelSuitcase/suitcaseRound';
import {
  FRENCH_LETTER_NAMES,
  introLine as trainIntroLine,
  letterLine,
  loadLine,
  nameLine as trainNameLine,
  otherLine as trainOtherLine,
  spellLine,
  wordLine as trainWordLine,
} from '../games/wordTrain/wordTrainRound';
import type { SpeechRequest } from '../core/audio/types';
import { PICNIC_LINE_TEXT } from '../games/picnic/picnicVoice';
import { SORTING_LINE_TEXT } from '../games/sorting/sortingVoice';
import { SECONDARY_COLORS } from '../games/potionLab/potionMachine';
import {
  introLine as potionIntroLine,
  requestLine as potionRequestLine,
  tryAgainLine as potionTryAgainLine,
} from '../games/potionLab/potionRound';
import { askTaskLine as magnetAskLine, introLine as magnetIntroLine, testLine as magnetTestLine } from '../games/magicMagnet/magnetRound';
import { askLine as sinkAskLine, introLine as sinkIntroLine } from '../games/sinkFloat/sinkFloatRound';
import { seedTaskLine } from '../games/seedFlower/seedFlowerRound';

export type VoiceCatalogGame =
  | 'travel-suitcase'
  | 'letter-monster'
  | 'word-train'
  | 'picnic-train'
  | 'sorting-beds'
  | 'potion-lab'
  | 'magic-magnet'
  | 'sink-or-float'
  | 'seed-to-flower';

export interface VoiceCatalogLine {
  id: string;
  lang: 'en' | 'fr' | 'he';
  text: string;
  /** Where a rendered clip would live (public/<path>); no clip exists yet. */
  path: string;
  game: VoiceCatalogGame;
}

const LANGS = ['en', 'fr'] as const;

/** `audio/<lang>/<slug>.mp3`; the slug is the line id with dots turned into dashes, lower-cased. */
export function voicePathFor(id: string, lang: string): string {
  return `audio/${lang}/${id.replace(/\./g, '-').toLowerCase()}.mp3`;
}

function suitcaseLines(): VoiceCatalogLine[] {
  const content = loadTravelSuitcase();
  const out: VoiceCatalogLine[] = [];
  const add = (r: SpeechRequest) =>
    out.push({ id: r.lineId, lang: r.lang, text: r.text, path: voicePathFor(r.lineId, r.lang), game: 'travel-suitcase' });

  add(suitcaseIntroLine(content));
  add(closedLine(content));
  add({ lineId: 'suitcase.help.he', lang: 'he', text: content.helpTextHe });

  const choiceIds: string[] = [];
  for (const item of content.items) {
    choiceIds.push(item.id);
    for (const v of item.colors ?? []) choiceIds.push(`${item.id}-${v.color}`);
  }

  for (const lang of LANGS) {
    const spec = (kind: RequestLineSpec['kind'], key: string, targets: string[]): RequestLineSpec => ({
      kind,
      key,
      itemId: key,
      targets,
      needed: targets.length,
      targetItemIds: [],
    });
    for (const a of content.items) {
      add(suitcaseRequestLine(content, spec('noun', a.id, [a.id]), lang));
      // Two-item requests: both orders can be spoken (the builder shuffles the pair).
      for (const b of content.items) {
        if (a.id !== b.id) add(suitcaseRequestLine(content, spec('two', `${a.id}-${b.id}`, [a.id, b.id]), lang));
      }
      for (const v of a.colors ?? []) {
        const key = `${a.id}-${v.color}`;
        add(suitcaseRequestLine(content, spec('attribute', key, [key]), lang));
        add(suitcaseRequestLine(content, spec('negation', key, [key]), lang));
      }
    }
    for (const set of content.sets) {
      for (const mode of ['attribute', 'negation'] as const) {
        add(suitcaseRequestLine(content, setRequestSpec(content, set.id, mode), lang));
      }
    }
    for (const id of choiceIds) {
      add(suitcaseNameLine(content, id, lang));
      add(suitcaseOtherLine(content, id, lang));
    }
  }
  return out;
}

function monsterLines(): VoiceCatalogLine[] {
  const content = loadLetterMonster();
  const out: VoiceCatalogLine[] = [];
  const add = (r: SpeechRequest) =>
    out.push({ id: r.lineId, lang: r.lang, text: r.text, path: voicePathFor(r.lineId, r.lang), game: 'letter-monster' });

  add(monsterIntroLine(content));
  add(askLetterLine(content));
  add(askEndingLine(content));
  add(askWordLine(content));
  add(notThisLine(content));
  add({ lineId: 'monster.help.he', lang: 'he', text: content.helpTextHe });
  for (const color of LETTER_MONSTER_COLOR_IDS) add(askColorLine(content, color));

  for (const lang of LANGS) {
    for (const color of LETTER_MONSTER_COLOR_IDS) add(colorWordLine(content, color, lang));
    const initials = new Set(content.foods.map((f) => f.initial[lang]));
    const endings = new Set(content.foods.map((f) => f.ending[lang]));
    for (const letter of [...initials].sort()) add(letterModelLine(content, letter, lang));
    for (const letter of [...endings].sort()) add(endingModelLine(content, letter, lang));
    for (const food of content.foods) {
      add(monsterFoodLine(content, food.id, lang));
      if (food.word[lang].length <= MAX_READ_WORD_LENGTH) add(monsterWordLine(content, food.id, lang));
    }
  }
  return out;
}

function wordTrainLines(): VoiceCatalogLine[] {
  const content = loadWordTrain();
  const out: VoiceCatalogLine[] = [];
  const add = (r: SpeechRequest) =>
    out.push({ id: r.lineId, lang: r.lang, text: r.text, path: voicePathFor(r.lineId, r.lang), game: 'word-train' });

  add(trainIntroLine(content, 'load'));
  add(trainIntroLine(content, 'spell', 'en'));
  add(trainIntroLine(content, 'spell', 'fr'));
  add({ lineId: 'wordtrain.help.he', lang: 'he', text: content.helpTextHe });
  for (const obj of content.objects) {
    add(loadLine(content, obj.id));
    add(trainNameLine(content, obj.id));
    add(trainOtherLine(content, obj.id));
  }
  for (const w of content.words) {
    add(spellLine(content, w.id));
    add(trainWordLine(content, w.id));
  }
  for (const lang of LANGS) {
    for (const ch of Object.keys(FRENCH_LETTER_NAMES)) add(letterLine(ch, lang));
  }
  return out;
}

function textLines(game: VoiceCatalogGame, table: Record<string, string>, pattern: RegExp): VoiceCatalogLine[] {
  return Object.entries(table)
    .filter(([id]) => pattern.test(id))
    .map(([id, text]) => {
      const lang = id.slice(id.lastIndexOf('.') + 1) as VoiceCatalogLine['lang'];
      return { id, lang, text, path: voicePathFor(id, lang), game };
    });
}

function fromRequests(game: VoiceCatalogGame, requests: SpeechRequest[]): VoiceCatalogLine[] {
  return requests.map((r) => ({ id: r.lineId, lang: r.lang, text: r.text, path: voicePathFor(r.lineId, r.lang), game }));
}

// Wave 2 (age-5 French-first / English-first task instructions): only the new `.en` / `.fr` task asks.
function picnicTaskLines(): VoiceCatalogLine[] {
  return textLines('picnic-train', PICNIC_LINE_TEXT, /^picnic\.ask\..+\.(en|fr)$/);
}

function sortingTaskLines(): VoiceCatalogLine[] {
  return textLines('sorting-beds', SORTING_LINE_TEXT, /^sorting\.(rule|switch)\..+\.(en|fr)$/);
}

function potionTaskLines(): VoiceCatalogLine[] {
  const content = loadPotionLab();
  const out: SpeechRequest[] = [];
  for (const lang of LANGS) {
    out.push(potionIntroLine(content, 'free', lang), potionIntroLine(content, 'request', lang));
    for (const color of SECONDARY_COLORS) {
      out.push(potionRequestLine(content, color, lang), potionTryAgainLine(content, color, lang));
    }
  }
  return fromRequests('potion-lab', out);
}

function magnetTaskLines(): VoiceCatalogLine[] {
  const content = loadMagicMagnet();
  const out: SpeechRequest[] = [];
  for (const lang of LANGS) {
    out.push(magnetIntroLine(content, 'free', lang), magnetIntroLine(content, 'predict', lang), magnetTestLine(content, lang));
    for (const obj of content.objects) out.push(magnetAskLine(content, obj.id, lang));
  }
  return fromRequests('magic-magnet', out);
}

function sinkFloatTaskLines(): VoiceCatalogLine[] {
  const content = loadSinkOrFloat();
  const out: SpeechRequest[] = [];
  for (const lang of LANGS) {
    out.push(sinkIntroLine(content, 'free', lang), sinkIntroLine(content, 'predict', lang), sinkAskLine(content, lang));
  }
  return fromRequests('sink-or-float', out);
}

function seedTaskLines(): VoiceCatalogLine[] {
  const content = loadSeedToFlower();
  const out: SpeechRequest[] = [];
  for (const lang of LANGS) out.push(seedTaskLine(content, 'intro.free', lang), seedTaskLine(content, 'intro.ordered', lang));
  return fromRequests('seed-to-flower', out);
}

/**
 * Every playable line of Travel Suitcase, Letter Monster and Word Train, plus the Wave 2 age-5 EN/FR task asks of the six
 * science / number-garden / nature games, in a stable order.
 */
export function gameVoiceCatalog(): VoiceCatalogLine[] {
  return [
    ...suitcaseLines(),
    ...monsterLines(),
    ...wordTrainLines(),
    ...picnicTaskLines(),
    ...sortingTaskLines(),
    ...potionTaskLines(),
    ...magnetTaskLines(),
    ...sinkFloatTaskLines(),
    ...seedTaskLines(),
  ];
}

/** The shape written to src/content/game-voice-lines.json (what the Python TTS job reads). */
export function gameVoiceExport(): Array<Pick<VoiceCatalogLine, 'id' | 'lang' | 'text' | 'path'>> {
  return gameVoiceCatalog().map(({ id, lang, text, path }) => ({ id, lang, text, path }));
}

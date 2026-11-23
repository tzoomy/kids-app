// Voice catalogue of the three Language House games that speak through device TTS today:
// Travel Suitcase, Letter Monster and Word Train. It enumerates every playable
// `{ id, lang, text, path }` using the same frames and helpers the games use, so the free-quota TTS job
// (scripts/tts/generate_voice.py -> collect_lines) can render them later and unit tests can prove that
// every line a game can emit is catalogued.
//
// Nothing here is registered in audio-manifest.json or audio-text-hashes.json (no clips exist yet): until a
// clip is rendered the games keep speaking these lines with device TTS. The committed export read by the
// Python job is src/content/game-voice-lines.json (kept in sync by tests/unit/voiceCatalog.test.ts).
import {
  loadLetterMonster,
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

export type VoiceCatalogGame = 'travel-suitcase' | 'letter-monster' | 'word-train';

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

/** Every playable line of Travel Suitcase, Letter Monster and Word Train, in a stable order. */
export function gameVoiceCatalog(): VoiceCatalogLine[] {
  return [...suitcaseLines(), ...monsterLines(), ...wordTrainLines()];
}

/** The shape written to src/content/game-voice-lines.json (what the Python TTS job reads). */
export function gameVoiceExport(): Array<Pick<VoiceCatalogLine, 'id' | 'lang' | 'text' | 'path'>> {
  return gameVoiceCatalog().map(({ id, lang, text, path }) => ({ id, lang, text, path }));
}

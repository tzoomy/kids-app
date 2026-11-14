// Voice lines of Who Lives Here? (docs/specs/who-lives-here.md, "Voice table"). Pass 1: device TTS through
// AudioManager.play({ lineId, lang, text }). Hebrew guidance text lives here; the English and French learning tokens
// (animal and home names, clues) come from the content JSON. Pass 2 adds Leda clips with text hashes in
// voice-lines-he.json and audio-manifest.json, which this file does not touch. No Phaser: unit tests import it.
import type { HabitatAnimal, WhoLivesHereContent } from '../../content/schema';
import type { Lang } from '../templates/choiceServe';
import type { HabitatLevers } from './habitatRound';

export interface SpeechLine {
  lineId: string;
  lang: 'he' | Lang;
  /** Device-TTS text (the only source of truth until a clip exists). */
  text: string;
}

/** Hebrew guidance lines by id. */
export const HABITAT_HE_TEXT = {
  'habitat.ask.he': 'לאן החיה הזאת הולכת הביתה?',
  'habitat.correct.he': 'יופי! החיה הגיעה הביתה!',
  'habitat.wrong.he': 'כמעט! נסי בית אחר.',
  'habitat.help.he': 'עזרי לכל חיה למצוא את הבית שלה. הקשי על הבית שבו היא גרה. אפשר ללחוץ על החיה כדי לשמוע שוב.',
} as const;

type HeLineId = keyof typeof HABITAT_HE_TEXT;

function heLine(lineId: HeLineId): SpeechLine {
  return { lineId, lang: 'he', text: HABITAT_HE_TEXT[lineId] };
}

/** The animal's name line (noun levels), e.g. `habitat.name.frog.fr` -> "la grenouille". */
export function nameLine(animal: HabitatAnimal, lang: Lang): SpeechLine {
  return { lineId: `habitat.name.${animal.id}.${lang}`, lang, text: animal.name[lang] };
}

/** The animal's descriptive clue line, e.g. `habitat.clue.bird.en`. */
export function clueLine(animal: HabitatAnimal, lang: Lang): SpeechLine {
  return { lineId: `habitat.clue.${animal.id}.${lang}`, lang, text: animal.clue[lang] };
}

/** The Hebrew ask line, then the name (noun levels) or the descriptive clue (riddle levels) in the round language. */
export function askLines(_content: Pick<WhoLivesHereContent, 'homes'>, animal: HabitatAnimal, levers: HabitatLevers, lang: Lang): SpeechLine[] {
  return [heLine('habitat.ask.he'), levers.request === 'riddle' ? clueLine(animal, lang) : nameLine(animal, lang)];
}

/** Hebrew praise, then the home's name in the round language. */
export function correctLines(content: Pick<WhoLivesHereContent, 'homes'>, animal: HabitatAnimal, lang: Lang): SpeechLine[] {
  const home = content.homes.find((h) => h.id === animal.home);
  const lines = [heLine('habitat.correct.he')];
  if (home) lines.push({ lineId: `habitat.home.${home.id}.${lang}`, lang, text: home.name[lang] });
  return lines;
}

/** Warm Hebrew retry line; on clue-after-miss levels the descriptive clue follows. Never a failure sound or phrase. */
export function wrongLines(_content: Pick<WhoLivesHereContent, 'homes'>, animal: HabitatAnimal, levers: HabitatLevers, lang: Lang): SpeechLine[] {
  const lines = [heLine('habitat.wrong.he')];
  if (levers.clueAfterMiss) lines.push(clueLine(animal, lang));
  return lines;
}

/** The help button line; `text` defaults to the shared Hebrew help text (the help card shows the content's `helpTextHe`). */
export function helpLine(text: string = HABITAT_HE_TEXT['habitat.help.he']): SpeechLine {
  return { lineId: 'habitat.help.he', lang: 'he', text };
}

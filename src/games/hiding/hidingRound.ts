// Pure round logic for Who's Hiding?: level levers, round building, answer checking and prompt
// text. No Phaser dependency, so it is unit-testable. Rendering lives in HidingScene.
import type { HidingAnimal, HidingSpeakMode, LevelDescriptor, WhosHidingContent } from '../../content/schema';
import { shuffle, type Lang } from '../templates/choiceServe';

/** The levers Who's Hiding? reads from a content level descriptor, with defaults applied. */
export interface HidingLevel {
  /** Number of bushes. */
  choiceCount: number;
  /** `far`: other groups first. `same-category`: the target's look-alike group first. */
  distractor: 'far' | 'same-category';
  /** Fraction of the animal's height that shows above the bush (0..1). */
  reveal: number;
  /** What the spoken request contains. */
  speak: HidingSpeakMode;
  /** Use the animal's short sound word (the hardest level: shorter sound). */
  shortSound: boolean;
  /** Request is heard only: no text bubble and no written name. */
  audioOnly: boolean;
  /**
   * Age-5 "Who is missing?" level (`request: "missing"`): `choiceCount` animals line up in front of their bushes for
   * `peekMs`, hide, one runs away, the others come back for `backMs` and hide again; then the line-up animals stand as
   * answer cards and she taps the one that did not come back.
   */
  missing: boolean;
  peekMs: number;
  backMs: number;
}

/** Which part of the animal shows, derived from the reveal fraction (for tests and docs). */
export type RevealPart = 'whole' | 'body' | 'head' | 'ears';

export function revealPart(reveal: number): RevealPart {
  if (reveal >= 0.85) return 'whole';
  if (reveal >= 0.65) return 'body';
  if (reveal >= 0.4) return 'head';
  return 'ears';
}

export function hidingLevel(descriptor: LevelDescriptor): HidingLevel {
  const extra = descriptor.extra ?? {};
  return {
    choiceCount: descriptor.choiceCount ?? 2,
    distractor: descriptor.distractor === 'same-category' ? 'same-category' : 'far',
    reveal: typeof extra.reveal === 'number' ? extra.reveal : 0.5,
    speak: (extra.speak as HidingSpeakMode | undefined) ?? 'name-sound',
    shortSound: typeof extra.soundMs === 'number',
    audioOnly: descriptor.support === 'audio-only',
    missing: descriptor.request === 'missing',
    peekMs: typeof extra.peekMs === 'number' ? extra.peekMs : 3000,
    backMs: typeof extra.backMs === 'number' ? extra.backMs : 2000,
  };
}

export interface HidingRoundSpec {
  language: Lang;
  target: HidingAnimal;
  /** Bush occupants in display order (the target is one of them). */
  choices: HidingAnimal[];
  level: HidingLevel;
  /** Spoken request, also the text bubble on levels that show one. */
  promptText: string;
  /** Static audio line id; lines without a clip fall back to device TTS. */
  lineId: string;
  /** Spoken (and only spoken) hint on audio-only levels: the sound plus a descriptive clue. */
  hintText: string;
  hintLineId: string;
  /** Missing levels: the answer cards (the whole line-up, reshuffled), shown after the line-up has hidden. */
  cards?: HidingAnimal[];
}

/** The "Who is missing?" lines of one round language (missing levels). */
export function missingLines(content: WhosHidingContent, lang: Lang): { look: SpeechText; gone: SpeechText; ask: SpeechText } | null {
  const m = content.missing;
  if (!m) return null;
  return {
    look: { lineId: `hiding.missing.look.${lang}`, text: m.look[lang] },
    gone: { lineId: `hiding.missing.gone.${lang}`, text: m.gone[lang] },
    ask: { lineId: `hiding.missing.ask.${lang}`, text: m.ask[lang] },
  };
}

export interface SpeechText {
  lineId: string;
  text: string;
}

/** The Hebrew line that explains the "Who is missing?" rule (once per visit, before the first missing round). */
export const MISSING_INTRO_HE_ID = 'hiding.missing.intro.he';

function fill(frame: string, animal: HidingAnimal, lang: Lang, shortSound: boolean): string {
  const sound = shortSound ? animal.soundShort[lang] : animal.sound[lang];
  return frame.replace('{name}', animal.name[lang]).replace('{sound}', sound);
}

/** The request text for one animal, in the given language and speak mode. */
export function promptFor(content: WhosHidingContent, animal: HidingAnimal, lang: Lang, level: HidingLevel): string {
  return fill(content.promptFrames[level.speak][lang], animal, lang, level.shortSound);
}

/** Hint speech: the request again, plus the animal's clue on voice-only levels (nothing visual to reveal there). */
export function hintFor(content: WhosHidingContent, animal: HidingAnimal, lang: Lang, level: HidingLevel): string {
  const base = promptFor(content, animal, lang, level);
  return level.audioOnly ? `${base} ${animal.clue[lang]}` : base;
}

/**
 * Picks `k` other animals to share the bushes with `target`.
 * - `far` prefers animals from groups different from the target's and from each other.
 * - `same-category` prefers the target's own group (cat next to lion, bear next to panda).
 * Too few matches are filled from the rest, so the count is always met when enough animals exist.
 */
export function pickBushNeighbours(
  target: HidingAnimal,
  animals: readonly HidingAnimal[],
  k: number,
  distractor: 'far' | 'same-category',
  random: () => number = Math.random,
): HidingAnimal[] {
  const pool = shuffle(
    animals.filter((a) => a.id !== target.id),
    random,
  );
  const picked: HidingAnimal[] = [];
  if (distractor === 'same-category') {
    for (const a of pool) if (picked.length < k && a.group === target.group) picked.push(a);
  } else {
    const usedGroups = new Set([target.group]);
    for (const a of pool) {
      if (picked.length >= k) break;
      if (!usedGroups.has(a.group)) {
        picked.push(a);
        usedGroups.add(a.group);
      }
    }
  }
  for (const a of pool) {
    if (picked.length >= k) break;
    if (!picked.includes(a)) picked.push(a);
  }
  return picked;
}

/**
 * Builds one round. The engine chooses the target (`targetId`); the level decides the bush count,
 * the neighbours, how much of each animal shows and what is spoken. Every bush hides a different
 * animal, so the request is answerable from the name/sound and the visible part.
 */
export function buildHidingRound(
  content: WhosHidingContent,
  descriptor: LevelDescriptor,
  language: Lang,
  targetId: string,
  random: () => number = Math.random,
): HidingRoundSpec {
  const level = hidingLevel(descriptor);
  const target = content.animals.find((a) => a.id === targetId) ?? content.animals[0];
  const others = pickBushNeighbours(target, content.animals, level.choiceCount - 1, level.distractor, random);
  const choices = shuffle([target, ...others], random);
  const lines = level.missing ? missingLines(content, language) : null;
  if (lines) {
    // The target is the animal that runs away; the hint adds its sound (never its name).
    return {
      language,
      target,
      choices,
      level,
      promptText: lines.ask.text,
      lineId: lines.ask.lineId,
      hintText: `${lines.ask.text} ${target.sound[language]}`,
      hintLineId: `hiding.missing.${target.id}.hint.${language}`,
      cards: shuffle(choices, random),
    };
  }
  return {
    language,
    target,
    choices,
    level,
    promptText: promptFor(content, target, language, level),
    lineId: `hiding.${target.id}.${level.speak}${level.shortSound ? '-short' : ''}.${language}`,
    hintText: hintFor(content, target, language, level),
    hintLineId: `hiding.${target.id}.hint.${level.audioOnly ? 'clue' : level.speak}${level.audioOnly && level.shortSound ? '-short' : ''}.${language}`,
  };
}

/** True when the tapped bush hides the requested animal. */
export function isCorrectBush(choiceId: string, targetId: string): boolean {
  return choiceId === targetId;
}

/** Animal ids the engine may pick as a target. */
export function eligibleAnimalIds(content: WhosHidingContent): string[] {
  return content.animals.map((a) => a.id);
}

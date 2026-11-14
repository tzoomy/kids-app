// Pure round logic for Shadow Match (docs/specs/shadow-match.md), the silhouette variant of
// Who's Hiding?. It reuses the Who's Hiding? animals and neighbour picker; no Phaser dependency.
import type { HidingAnimal, LevelDescriptor, ShadowMatchContent, ShadowSpeakMode } from '../../content/schema';
import { shuffle, type Lang } from '../templates/choiceServe';
import { pickBushNeighbours } from './hidingRound';

export interface ShadowLevel {
  /** Number of silhouettes. */
  choiceCount: number;
  /** `far`: other look-alike groups first. `same-category`: the target's group first (cat next to lion). */
  distractor: 'far' | 'same-category';
  /** The cue: the animal's sound or its name, in the learning language. */
  speak: ShadowSpeakMode;
  /** Use the shorter sound word (top level). */
  shortSound: boolean;
}

export function shadowLevel(descriptor: LevelDescriptor): ShadowLevel {
  const extra = descriptor.extra ?? {};
  return {
    choiceCount: descriptor.choiceCount ?? 2,
    distractor: descriptor.distractor === 'same-category' ? 'same-category' : 'far',
    speak: extra.speak === 'name' ? 'name' : 'sound',
    shortSound: typeof extra.soundMs === 'number',
  };
}

export interface ShadowRoundSpec {
  language: Lang;
  level: ShadowLevel;
  target: HidingAnimal;
  /** Silhouettes in display order (the target is one of them). */
  choices: HidingAnimal[];
  /** Spoken cue, also the LTR prompt bubble. */
  promptText: string;
  lineId: string;
  /** Spoken after the reveal: the name in the learning language, then in Hebrew. */
  revealText: string;
  revealLineId: string;
  revealTextHe: string;
  revealLineIdHe: string;
}

/** The cue for one animal: its sound (optionally the short one) or its name. */
export function promptFor(content: ShadowMatchContent, animal: HidingAnimal, lang: Lang, level: ShadowLevel): string {
  if (level.speak === 'name') return content.promptFrames.name[lang].replace('{name}', animal.name[lang]);
  const sound = level.shortSound ? animal.soundShort[lang] : animal.sound[lang];
  return content.promptFrames.sound[lang].replace('{sound}', sound);
}

export function revealFor(content: ShadowMatchContent, animal: HidingAnimal, lang: Lang): { text: string; textHe: string } {
  return {
    text: content.revealFrame[lang].replace('{name}', animal.name[lang]),
    textHe: content.revealFrameHe.replace('{nameHe}', content.namesHe[animal.id] ?? animal.id),
  };
}

/**
 * Builds one trial. The engine chooses the target; the level decides the silhouette count, the
 * neighbours (same picker as Who's Hiding?) and the cue. Every silhouette is a different animal.
 */
export function buildShadowRound(
  content: ShadowMatchContent,
  animals: readonly HidingAnimal[],
  descriptor: LevelDescriptor,
  language: Lang,
  targetId: string,
  random: () => number = Math.random,
): ShadowRoundSpec {
  const level = shadowLevel(descriptor);
  const target = animals.find((a) => a.id === targetId) ?? animals[0];
  const others = pickBushNeighbours(target, animals, level.choiceCount - 1, level.distractor, random);
  const choices = shuffle([target, ...others], random);
  const reveal = revealFor(content, target, language);
  return {
    language,
    level,
    target,
    choices,
    promptText: promptFor(content, target, language, level),
    lineId: `shadow.${target.id}.${level.speak}${level.shortSound ? '-short' : ''}.${language}`,
    revealText: reveal.text,
    revealLineId: `shadow.${target.id}.reveal.${language}`,
    revealTextHe: reveal.textHe,
    revealLineIdHe: `he.shadow.${target.id}`,
  };
}

/** True when the tapped silhouette is the requested animal. */
export function isCorrectShadow(choiceId: string, targetId: string): boolean {
  return choiceId === targetId;
}

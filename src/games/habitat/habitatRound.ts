// Pure Who Lives Here? round logic (no Phaser, no DOM). Spec: docs/specs/who-lives-here.md.
// Data-driven: items (animals) -> bins (homes) come from content, so new habitats are content-only changes.
import type { HabitatAnimal, HabitatHome, LevelDescriptor, WhoLivesHereContent } from '../../content/schema';
import type { HabitatRequest } from './types';

/** The levers Who Lives Here? reads from a content level descriptor. */
export interface HabitatLevers {
  /** Homes shown (2..4). */
  choiceCount: number;
  distractor: 'far' | 'near';
  request: HabitatRequest;
  /** Level-1 scaffold: the right home glows softly. */
  glow: boolean;
  /** The descriptive clue is spoken after a wrong tap. */
  clueAfterMiss: boolean;
  /** `support: 'audio-only'`: no text bubble, the request is voice only. */
  audioOnly: boolean;
}

/** Reads the levers from a validated level (see WhoLivesHereContentSchema). */
export function levelLevers(level: LevelDescriptor): HabitatLevers {
  return {
    choiceCount: level.choiceCount ?? 2,
    distractor: level.distractor === 'near' ? 'near' : 'far',
    request: level.request === 'riddle' ? 'riddle' : 'noun',
    glow: level.scaffold === 'outline',
    clueAfterMiss: level.extra?.clue === 'after-miss',
    audioOnly: level.support === 'audio-only',
  };
}

export interface HabitatRoundAnimal {
  id: string;
  homeId: string;
}

export interface HabitatRoundPlan {
  /** Homes shown, in display order (the first animal's home is somewhere among them). */
  homeIds: string[];
  /** The round's animals in order; `animals.length === trials`. */
  animals: HabitatRoundAnimal[];
}

export interface BuildHabitatRoundParams {
  content: Pick<WhoLivesHereContent, 'homes' | 'animals'>;
  levers: HabitatLevers;
  /** Animals in the round (the adaptive `trialsPerRound`). */
  trials: number;
  random: () => number;
  /** Optional animal id the round should start with (the engine's choice). */
  firstAnimalId?: string;
}

function pickIndex(random: () => number, length: number): number {
  return Math.min(length - 1, Math.max(0, Math.floor(random() * length)));
}

function shuffled<T>(random: () => number, items: readonly T[]): T[] {
  const out = items.slice();
  for (let i = out.length - 1; i > 0; i--) {
    const j = pickIndex(random, i + 1);
    [out[i], out[j]] = [out[j], out[i]];
  }
  return out;
}

/** The first animal's home plus distractor homes per `levers.distractor`, in a shuffled display order. */
function chooseHomes(
  homes: readonly HabitatHome[],
  first: HabitatAnimal,
  levers: HabitatLevers,
  random: () => number,
): string[] {
  const target = homes.find((h) => h.id === first.home);
  const others = shuffled(random, homes.filter((h) => h.id !== first.home));
  const sameFamily = (h: HabitatHome) => target !== undefined && h.family === target.family;
  // Stable partition of the shuffled list: preferred distractors first, the rest after (the fallback).
  const preferred = others.filter((h) => (levers.distractor === 'near' ? sameFamily(h) : !sameFamily(h)));
  const fallback = others.filter((h) => !preferred.includes(h));
  const picked = [...preferred, ...fallback].slice(0, Math.max(0, levers.choiceCount - 1));
  return shuffled(random, [first.home, ...picked.map((h) => h.id)]);
}

/**
 * Builds one round: the homes shown and `trials` animals.
 * - The first animal is `firstAnimalId` (the engine's choice) or a random one; its home is always shown.
 * - Distractor homes: `far` takes other families first, `near` the same family first; either falls back to the rest.
 * - The other animals come from the animals whose home is shown, preferring different homes, then other animals.
 *   When the homes on screen have fewer animals than `trials` (age 2: 2 homes), an animal repeats, never twice in a row.
 */
export function buildHabitatRound(params: BuildHabitatRoundParams): HabitatRoundPlan {
  const { content, levers, random } = params;
  const trials = Math.max(1, Math.floor(params.trials));
  const first = content.animals.find((a) => a.id === params.firstAnimalId) ?? content.animals[pickIndex(random, content.animals.length)];
  const homeIds = chooseHomes(content.homes, first, levers, random);

  const pool = content.animals.filter((a) => homeIds.includes(a.home));
  const rest = shuffled(random, pool.filter((a) => a.id !== first.id));
  const picked: HabitatAnimal[] = [first];
  for (const a of rest) {
    if (picked.length < trials && !picked.some((p) => p.home === a.home)) picked.push(a);
  }
  for (const a of rest) {
    if (picked.length < trials && !picked.includes(a)) picked.push(a);
  }
  while (picked.length < trials) {
    const previous = picked[picked.length - 1];
    let candidates = pool.filter((a) => a.id !== previous.id);
    if (candidates.length === 0) candidates = pool;
    const uses = (a: HabitatAnimal) => picked.filter((p) => p.id === a.id).length;
    const fewest = Math.min(...candidates.map(uses));
    const least = candidates.filter((a) => uses(a) === fewest);
    picked.push(least[pickIndex(random, least.length)]);
  }
  return { homeIds, animals: picked.map((a) => ({ id: a.id, homeId: a.home })) };
}

/** The part of SkillSession the first-animal choice needs. */
export interface FirstAnimalSkills {
  selectNextItem(lang: string, candidates: readonly string[]): string;
}

/**
 * The animal a round starts with, chosen by the engine like the restaurant's food. `selectNextItem` over all animals
 * returns a known (mastered) animal right after a level drop and clears the after-drop flag; otherwise it schedules
 * due, retry, new and seen animals. Only the first animal is engine-chosen. Feed the result to `buildHabitatRound`.
 */
export function chooseFirstAnimal(skills: FirstAnimalSkills, lang: string, content: Pick<WhoLivesHereContent, 'animals'>): string {
  return skills.selectNextItem(lang, content.animals.map((a) => a.id));
}

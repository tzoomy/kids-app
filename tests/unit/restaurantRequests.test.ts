import { describe, expect, it, vi } from 'vitest';
import {
  buildRound,
  eligibleTargetIds,
  isCorrectChoice,
  isRequestedChoice,
  type ChoiceServeLevel,
} from '@/games/templates/choiceServe';
import { loadAnimalRestaurant, loadAudioManifest } from '@/content/loadContent';
import { AnimalRestaurantContentSchema } from '@/content/schema';
import { AudioManager } from '@/core/audio';
import type { AudioProvider, SpeechRequest } from '@/core/audio/types';
import { TrialTracker } from '@/games/restaurant/trialTracker';
import { showsPromptBubble } from '@/games/restaurant/voiceRules';

const restaurant = loadAnimalRestaurant();
const levels = restaurant.adaptive.levels as ChoiceServeLevel[];
const [, , , , , L6, L7, L8, L9] = levels;
const frames = restaurant.twoStepFrames;
const items = restaurant.items;

function seededRandom(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

const VARIANT_IDS = items.filter((i) => i.variants).map((i) => i.id);

describe('the 9-level restaurant curve', () => {
  it('has 9 levels with the agreed levers', () => {
    expect(levels).toHaveLength(9);
    expect(levels.map((l) => l.choiceCount)).toEqual([2, 3, 3, 3, 4, 4, 4, 4, 4]);
    expect(levels.map((l) => l.request)).toEqual([
      'noun', 'noun', 'noun', 'quantity', 'quantity', 'attribute', 'two-step', 'negation', 'quantity',
    ]);
    expect(levels.map((l) => l.distractor)).toEqual(['far', 'far', 'near', 'near', 'near', 'near', 'near', 'near', 'near']);
    expect(levels[8].support).toBe('audio-only');
    expect(levels.slice(0, 8).every((l) => l.support === undefined)).toBe(true);
  });

  it('tracks: age2 starts at L4, age5 at L5, both floor at L1 and top out at L9', () => {
    expect(restaurant.adaptive.tracks.age2).toEqual({ start: 4, min: 1, max: 9 });
    expect(restaurant.adaptive.tracks.age5).toEqual({ start: 5, min: 1, max: 9 });
  });
});

describe('L6: attribute request ("the red apple")', () => {
  it('puts both colour variants of the item on the table, so the colour word decides', () => {
    for (const id of VARIANT_IDS) {
      for (let seed = 1; seed <= 12; seed++) {
        const round = buildRound(items, L6, 'en', seededRandom(seed), id, frames);
        expect(round.request).toBe('attribute');
        expect(round.choices).toHaveLength(4);
        const same = round.choices.filter((c) => c.item.id === id);
        expect(same).toHaveLength(2);
        expect(new Set(same.map((c) => c.color)).size).toBe(2);
        expect(round.choices.filter((c) => isCorrectChoice(c, round.target))).toHaveLength(1);
        expect(round.target.item.id).toBe(id);
      }
    }
  });

  it('the spoken text names the target colour, in both languages', () => {
    const apple = items.find((i) => i.id === 'apple')!;
    for (let seed = 1; seed <= 20; seed++) {
      const en = buildRound(items, L6, 'en', seededRandom(seed), 'apple', frames);
      const variantEn = apple.variants!.find((v) => v.color === en.target.color)!;
      expect(en.promptText).toBe(variantEn.en.pick);
      expect(en.promptText).toContain(en.target.color);
      const fr = buildRound(items, L6, 'fr', seededRandom(seed), 'apple', frames);
      expect(fr.promptText).toBe(apple.variants!.find((v) => v.color === fr.target.color)!.fr.pick);
    }
  });

  it('only variant items are eligible targets; an item without variants falls back to a plain round', () => {
    expect(eligibleTargetIds(items, L6).sort()).toEqual([...VARIANT_IDS].sort());
    expect(eligibleTargetIds(items, levels[0])).toHaveLength(items.length);
    const round = buildRound(items, L6, 'en', seededRandom(2), 'carrot', frames);
    expect(round.request).toBe('noun');
    expect(round.target.item.id).toBe('carrot');
    expect(round.choices).toHaveLength(4);
  });

  it('without a target id it still builds an attribute round', () => {
    const round = buildRound(items, L6, 'en', seededRandom(5), undefined, frames);
    expect(round.request).toBe('attribute');
    expect(VARIANT_IDS).toContain(round.target.item.id);
  });
});

describe('L7: two items in one request', () => {
  it('asks for two different foods, both on the table, with at least one wrong plate', () => {
    for (const item of items) {
      for (let seed = 1; seed <= 8; seed++) {
        const round = buildRound(items, L7, 'en', seededRandom(seed), item.id, frames);
        expect(round.request).toBe('two-step');
        expect(round.targets).toHaveLength(2);
        expect(round.targets[0].item.id).toBe(item.id);
        expect(round.targets[1].item.id).not.toBe(item.id);
        expect(round.choices).toHaveLength(4);
        expect(round.choices.filter((c) => isRequestedChoice(c, round.targets))).toHaveLength(2);
        expect(round.choices.filter((c) => !isRequestedChoice(c, round.targets)).length).toBeGreaterThanOrEqual(1);
        const keys = round.choices.map((c) => c.item.id);
        expect(new Set(keys).size).toBe(keys.length);
      }
    }
  });

  it('composes the prompt per language from the content frame and noun phrases', () => {
    const en = buildRound(items, L7, 'en', seededRandom(3), 'apple', frames);
    const [a, b] = en.targets;
    expect(en.promptText).toBe(`I want ${a.item.phrase.en} and ${b.item.phrase.en}, please!`);
    const fr = buildRound(items, L7, 'fr', seededRandom(3), 'apple', frames);
    expect(fr.promptText).toBe(`Je voudrais ${fr.targets[0].item.phrase.fr} et ${fr.targets[1].item.phrase.fr}, s'il te plaît !`);
    expect(en.lineId).toBe(`pair.${a.item.id}.${b.item.id}.en`);
  });

  it('each requested plate matches only its own target (either order is accepted)', () => {
    const round = buildRound(items, L7, 'en', seededRandom(4), 'banana', frames);
    const [a, b] = round.targets;
    expect(isRequestedChoice(round.choices.find((c) => isCorrectChoice(c, a))!, round.targets)).toBe(true);
    expect(isRequestedChoice(round.choices.find((c) => isCorrectChoice(c, b))!, round.targets)).toBe(true);
    expect(isCorrectChoice(round.choices.find((c) => isCorrectChoice(c, a))!, b)).toBe(false);
  });

  it('without frames the round degrades to a plain single-target round', () => {
    const round = buildRound(items, L7, 'en', seededRandom(4), 'banana');
    expect(round.request).toBe('noun');
    expect(round.targets).toHaveLength(1);
  });
});

describe('L8: negation ("an apple, but not the red one")', () => {
  it('has exactly one correct plate: the variant that is not the excluded colour', () => {
    for (const id of VARIANT_IDS) {
      const item = items.find((i) => i.id === id)!;
      for (let seed = 1; seed <= 12; seed++) {
        const round = buildRound(items, L8, 'en', seededRandom(seed), id, frames);
        expect(round.request).toBe('negation');
        expect(round.choices).toHaveLength(4);
        const excluded = item.variants!.find((v) => v.en.not === round.promptText)!;
        expect(excluded).toBeTruthy();
        expect(round.target.color).not.toBe(excluded.color);
        expect(round.target.item.id).toBe(id);
        // The excluded variant is on the table and is a wrong answer.
        const wrongVariant = round.choices.find((c) => c.item.id === id && c.color === excluded.color)!;
        expect(wrongVariant).toBeTruthy();
        expect(isRequestedChoice(wrongVariant, round.targets)).toBe(false);
        expect(round.choices.filter((c) => isRequestedChoice(c, round.targets))).toHaveLength(1);
        expect(round.lineId).toBe(`not.${id}.${excluded.color}.en`);
      }
    }
  });

  it('speaks the French negation line', () => {
    const round = buildRound(items, L8, 'fr', seededRandom(6), 'pear', frames);
    const pear = items.find((i) => i.id === 'pear')!;
    expect(pear.variants!.some((v) => v.fr.not === round.promptText)).toBe(true);
    expect(round.promptText).toContain('mais pas');
  });
});

describe('L9: voice-only request', () => {
  it('flags the round as audio-only, keeps the quantity request and 4 plates', () => {
    const round = buildRound(items, L9, 'en', seededRandom(2), 'apple', frames);
    expect(round.audioOnly).toBe(true);
    expect(round.choices).toHaveLength(4);
    expect(round.promptText).toBeTruthy(); // still spoken
    expect(showsPromptBubble(round.audioOnly)).toBe(false);
  });

  it('every level below L9 shows the prompt bubble', () => {
    for (const level of levels.slice(0, 8)) {
      const round = buildRound(items, level, 'en', seededRandom(2), 'apple', frames);
      expect(round.audioOnly).toBe(false);
      expect(showsPromptBubble(round.audioOnly)).toBe(true);
    }
  });
});

describe('levels 1-4 are unchanged by the new request types', () => {
  it('give the same rounds with or without frames and carry the old line ids', () => {
    for (const level of levels.slice(0, 4)) {
      const a = buildRound(items, level, 'en', seededRandom(8), 'apple', frames);
      const b = buildRound(items, level, 'en', seededRandom(8), 'apple');
      expect(a).toEqual(b);
      expect(a.targets).toEqual([a.target]);
      expect(a.lineId).toBe(`food.apple.${a.target.count}.en`);
      expect(a.choices.every((c) => c.color === undefined)).toBe(true);
    }
  });
});

describe('TrialTracker with a two-item request', () => {
  it('both correct, no wrong tap: one clean first try, recorded when the second plate lands', () => {
    const t = new TrialTracker('apple', 'en');
    expect(t.onPlateTap(true, 1)).toBeNull();
    expect(t.onPlateTap(true, 0)).toEqual({ itemId: 'apple', firstTryCorrect: true, hinted: false });
  });

  it('a wrong tap is the miss, even after one correct plate; nothing more is recorded', () => {
    const t = new TrialTracker('apple', 'en');
    expect(t.onPlateTap(true, 1)).toBeNull();
    expect(t.onPlateTap(false)).toEqual({ itemId: 'apple', firstTryCorrect: false, hinted: false });
    expect(t.onPlateTap(true, 0)).toBeNull();
  });

  it('a wrong first tap is a miss and the later correct taps change nothing', () => {
    const t = new TrialTracker('apple', 'en');
    expect(t.onPlateTap(false)?.firstTryCorrect).toBe(false);
    expect(t.onPlateTap(true, 1)).toBeNull();
    expect(t.onPlateTap(true, 0)).toBeNull();
  });

  it('a hint before the first tap and a hint between the two plates both mark the trial hinted', () => {
    const early = new TrialTracker('apple', 'en');
    early.onHint();
    early.onPlateTap(true, 1);
    expect(early.onPlateTap(true, 0)?.hinted).toBe(true);

    const late = new TrialTracker('apple', 'en');
    late.onPlateTap(true, 1);
    late.onHint();
    expect(late.onPlateTap(true, 0)?.hinted).toBe(true);

    const afterRecord = new TrialTracker('apple', 'en');
    afterRecord.onPlateTap(false);
    afterRecord.onHint();
    expect(afterRecord.onPlateTap(true, 0)).toBeNull();
  });
});

describe('content validation for the new levers', () => {
  const clone = () => JSON.parse(JSON.stringify(restaurant)) as Record<string, any>;
  const ok = (v: unknown) => AnimalRestaurantContentSchema.safeParse(v).success;

  it('the shipped content validates', () => {
    expect(ok(clone())).toBe(true);
  });

  it('rejects requests the restaurant cannot build, and unsupported support values', () => {
    const riddle = clone();
    riddle.adaptive.levels[5].request = 'riddle';
    expect(ok(riddle)).toBe(false);
    const clue = clone();
    clue.adaptive.levels[8].support = 'clue';
    expect(ok(clue)).toBe(false);
  });

  it('attribute/negation levels need an item with colour variants', () => {
    const c = clone();
    for (const item of c.items) delete item.variants;
    expect(ok(c)).toBe(false);
  });

  it('variants must be exactly two distinct colours', () => {
    const one = clone();
    one.items.find((i: any) => i.id === 'apple').variants.pop();
    expect(ok(one)).toBe(false);
    const same = clone();
    same.items.find((i: any) => i.id === 'apple').variants[1].color = 'red';
    expect(ok(same)).toBe(false);
  });

  it('variant colours must be keys of the shared palette', () => {
    const typo = clone();
    typo.items.find((i: any) => i.id === 'apple').variants[0].color = 'rde';
    expect(ok(typo)).toBe(false);
    const reserved = clone();
    reserved.items.find((i: any) => i.id === 'apple').variants[0].color = 'outline';
    expect(ok(reserved)).toBe(false);
  });

  it('a two-item level needs at least 3 plates; frames need {a} and {b}', () => {
    const c = clone();
    c.adaptive.levels[6].choiceCount = 2;
    expect(ok(c)).toBe(false);
    const f = clone();
    f.twoStepFrames.en = 'I want food, please!';
    expect(ok(f)).toBe(false);
    const missingPhrase = clone();
    delete missingPhrase.items[0].phrase;
    expect(ok(missingPhrase)).toBe(false);
  });

  it('track bounds may reach level 9 but not beyond', () => {
    const c = clone();
    c.adaptive.tracks.age2.max = 10;
    expect(ok(c)).toBe(false);
  });
});

describe('L7 second food after a drop', () => {
  it('takes the second food from the familiar items when there are any', () => {
    const familiar = ['pear', 'carrot'];
    for (let seed = 1; seed <= 30; seed++) {
      const round = buildRound(items, L7, 'en', seededRandom(seed), 'apple', frames, familiar);
      expect(familiar).toContain(round.targets[1].item.id);
      expect(round.targets[0].item.id).toBe('apple');
    }
  });

  it('never picks the first food as the second, and falls back to any food when none is familiar', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const only = buildRound(items, L7, 'en', seededRandom(seed), 'apple', frames, ['apple']);
      expect(only.targets[1].item.id).not.toBe('apple');
      const none = buildRound(items, L7, 'en', seededRandom(seed), 'apple', frames, []);
      expect(none.targets[1].item.id).not.toBe('apple');
    }
  });
});

describe('audio for the new request lines', () => {
  it('none of the new line ids has a static clip, so they use device TTS', () => {
    const manifest = loadAudioManifest();
    const rounds = [L6, L7, L8].flatMap((level) =>
      ['en', 'fr'].flatMap((lang) =>
        VARIANT_IDS.map((id) => buildRound(items, level, lang as 'en' | 'fr', seededRandom(3), id, frames)),
      ),
    );
    for (const r of rounds) expect(manifest[r.lineId]).toBeUndefined();
  });

  it('a missing static clip falls through to the device TTS provider with the round text', async () => {
    const fake = (id: string, plays: boolean): AudioProvider => ({
      id,
      isAvailable: () => true,
      play: vi.fn(async (_r: SpeechRequest) => plays),
      warmup: vi.fn(),
      stop: vi.fn(),
    });
    const staticProvider = fake('static-file', false);
    const tts = fake('device-tts', true);
    const round = buildRound(items, L8, 'en', seededRandom(3), 'apple', frames);
    const request = { lineId: round.lineId, lang: round.language, text: round.promptText };
    expect(await new AudioManager([staticProvider, tts]).play(request)).toBe(true);
    expect(tts.play).toHaveBeenCalledWith(request);
  });
});

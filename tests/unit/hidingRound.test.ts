import { describe, expect, it } from 'vitest';
import { loadWhosHiding } from '@/content/loadContent';
import {
  buildHidingRound,
  eligibleAnimalIds,
  hidingLevel,
  hintFor,
  isCorrectBush,
  pickBushNeighbours,
  promptFor,
} from '@/games/hiding/hidingRound';
import { animalFeetY, computeHidingLayout } from '@/games/hiding/hidingLayout';
import { TrialTracker, nextRoundLanguage } from '@/games/restaurant/trialTracker';

const content = loadWhosHiding();
const levels = content.adaptive.levels;
const ids = eligibleAnimalIds(content);
const byId = (id: string) => content.animals.find((a) => a.id === id)!;

/** Small deterministic PRNG so the property-style checks below are reproducible. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 1664525 + 1013904223) % 4294967296;
    return s / 4294967296;
  };
}

describe('round building per level', () => {
  it('[AC-16] gives each level the right number of distinct bushes, containing the target exactly once', () => {
    levels.forEach((descriptor, i) => {
      for (const targetId of ids) {
        for (const lang of ['en', 'fr'] as const) {
          const spec = buildHidingRound(content, descriptor, lang, targetId, seeded(i * 100 + 7));
          expect(spec.choices).toHaveLength(hidingLevel(descriptor).choiceCount);
          expect(new Set(spec.choices.map((a) => a.id)).size).toBe(spec.choices.length);
          expect(spec.choices.filter((a) => a.id === targetId)).toHaveLength(1);
          expect(spec.target.id).toBe(targetId);
          expect(spec.language).toBe(lang);
        }
      }
    });
  });

  it('[AC-17] far levels pick neighbours from other groups first', () => {
    for (let seed = 1; seed <= 30; seed++) {
      const target = byId('cat');
      const picked = pickBushNeighbours(target, content.animals, 2, 'far', seeded(seed));
      expect(picked.every((a) => a.group !== target.group)).toBe(true);
      expect(new Set(picked.map((a) => a.group)).size).toBe(2);
    }
  });

  it('[AC-17] same-category levels always put the look-alike next to the target', () => {
    for (let seed = 1; seed <= 30; seed++) {
      for (const [target, twin] of [
        ['cat', 'lion'],
        ['lion', 'cat'],
        ['bear', 'panda'],
        ['panda', 'bear'],
        ['dog', 'rabbit'],
      ]) {
        const picked = pickBushNeighbours(byId(target), content.animals, 2, 'same-category', seeded(seed));
        expect(picked.map((a) => a.id)).toContain(twin);
      }
    }
  });

  it('[AC-16] level 3 (3 bushes, same-category) and level 1 (2 bushes, far) differ as specified', () => {
    const l1 = buildHidingRound(content, levels[0], 'en', 'cat', seeded(3));
    expect(l1.choices).toHaveLength(2);
    expect(l1.choices.find((a) => a.id !== 'cat')!.group).not.toBe('big-cats');
    const l3 = buildHidingRound(content, levels[2], 'en', 'cat', seeded(3));
    expect(l3.choices).toHaveLength(3);
    expect(l3.choices.map((a) => a.id)).toContain('lion');
  });

  it('[AC-17] fills from other groups when the target group is too small (L8 uses all six animals)', () => {
    const spec = buildHidingRound(content, levels[7], 'fr', 'dog', seeded(11));
    expect(spec.choices.map((a) => a.id).sort()).toEqual([...ids].sort());
  });

  it('[AC-16] [AC-18] reveal and audio-only come from the level, per level', () => {
    expect(levels.map((d) => hidingLevel(d).reveal)).toEqual([0.9, 0.8, 0.6, 0.5, 0.3, 0.3, 0.3, 0.3]);
    expect(levels.map((d) => hidingLevel(d).audioOnly)).toEqual([false, false, false, false, false, false, true, true]);
    expect(buildHidingRound(content, levels[6], 'en', 'cat', seeded(1)).level.audioOnly).toBe(true);
    expect(buildHidingRound(content, levels[0], 'en', 'cat', seeded(1)).level.audioOnly).toBe(false);
  });

  it('[AC-16] spreads the target over all bush positions', () => {
    const seen = new Set<number>();
    for (let seed = 1; seed <= 80; seed++) {
      const spec = buildHidingRound(content, levels[3], 'en', 'cat', seeded(seed));
      seen.add(spec.choices.findIndex((a) => a.id === 'cat'));
    }
    expect(seen.size).toBe(4);
  });
});

describe('answer checking', () => {
  it('[AC-02] only the bush that hides the requested animal is correct', () => {
    const spec = buildHidingRound(content, levels[3], 'en', 'panda', seeded(5));
    expect(spec.choices.filter((a) => isCorrectBush(a.id, spec.target.id))).toHaveLength(1);
    expect(isCorrectBush('panda', 'panda')).toBe(true);
    expect(isCorrectBush('bear', 'panda')).toBe(false);
  });
});

describe('prompt text per language and support mode', () => {
  const cat = byId('cat');
  const lvl = (i: number) => hidingLevel(levels[i]);

  it('[AC-19] name-sound levels say the name and the sound', () => {
    expect(promptFor(content, cat, 'en', lvl(0))).toBe('Where is the cat? Meow, meow!');
    expect(promptFor(content, cat, 'fr', lvl(0))).toBe('Où est le chat ? Miaou, miaou !');
  });

  it('[AC-19] name levels say only the name', () => {
    expect(promptFor(content, cat, 'en', lvl(4))).toBe('Where is the cat?');
    expect(promptFor(content, byId('bear'), 'fr', lvl(5))).toBe("Où est l'ours ?");
  });

  it('[AC-19] audio-only levels say only the sound, and the last level uses the short sound', () => {
    expect(promptFor(content, cat, 'en', lvl(6))).toBe('Meow, meow!');
    expect(promptFor(content, cat, 'fr', lvl(7))).toBe('Miaou !');
    expect(promptFor(content, byId('dog'), 'en', lvl(7))).toBe('Woof!');
  });

  it('[AC-22] audio-only hints add the clue; other hints just repeat the request', () => {
    expect(hintFor(content, cat, 'en', lvl(6))).toBe(`Meow, meow! ${cat.clue.en}`);
    expect(hintFor(content, cat, 'en', lvl(2))).toBe(promptFor(content, cat, 'en', lvl(2)));
  });

  it('[AC-09] every animal composes a non-empty prompt in every language at every level', () => {
    for (const d of levels)
      for (const a of content.animals)
        for (const lang of ['en', 'fr'] as const) {
          const text = promptFor(content, a, lang, hidingLevel(d));
          expect(text.length).toBeGreaterThan(0);
          expect(text).not.toMatch(/[{}]/);
        }
  });

  it('[AC-19] line ids are distinct per animal, mode and language', () => {
    const lineIds = new Set<string>();
    for (const d of levels) {
      const spec = buildHidingRound(content, d, 'en', 'cat', seeded(1));
      lineIds.add(spec.lineId);
    }
    // Levels 1-4 share one request line; every other mode has its own id.
    expect(lineIds.size).toBe(4);
    expect(buildHidingRound(content, levels[0], 'fr', 'cat', seeded(1)).lineId).not.toBe(
      buildHidingRound(content, levels[0], 'en', 'cat', seeded(1)).lineId,
    );
  });
});

describe('trial tracking', () => {
  it('[AC-23] records once on the first accepted tap: a wrong tap is the miss, later taps record nothing', () => {
    const t = new TrialTracker('cat', 'en');
    expect(t.onPlateTap(false)).toEqual({ itemId: 'cat', firstTryCorrect: false, hinted: false });
    expect(t.onPlateTap(true)).toBeNull();
  });

  it('[AC-23] a clean first tap is recorded once', () => {
    const t = new TrialTracker('cat', 'fr');
    expect(t.onPlateTap(true)).toEqual({ itemId: 'cat', firstTryCorrect: true, hinted: false });
    expect(t.onPlateTap(true)).toBeNull();
  });

  it('[AC-20] [AC-21] the idle auto-hint marks the trial hinted; a voluntary replay (which never calls onHint) does not', () => {
    const hinted = new TrialTracker('cat', 'en');
    hinted.onHint();
    expect(hinted.onPlateTap(true)).toEqual({ itemId: 'cat', firstTryCorrect: true, hinted: true });
    const replayed = new TrialTracker('cat', 'en');
    expect(replayed.onPlateTap(true)?.hinted).toBe(false);
  });

  it('[AC-23] a hint after the miss was recorded changes nothing', () => {
    const t = new TrialTracker('cat', 'en');
    t.onPlateTap(false);
    t.onHint();
    expect(t.onPlateTap(true)).toBeNull();
  });

  it('[AC-25] the language stays fixed within a round and is re-picked at the boundary', () => {
    expect(nextRoundLanguage('fr', false, 'both')).toBe('fr');
    expect(nextRoundLanguage('fr', true, 'en')).toBe('en');
    expect(nextRoundLanguage(null, false, 'fr')).toBe('fr');
  });
});

describe('hiding layout', () => {
  it('[AC-28] fits every bush count in both orientations without overlapping hit areas', () => {
    for (const [w, h] of [
      [1280, 800],
      [800, 1280],
    ]) {
      for (let n = 2; n <= 6; n++) {
        const layout = computeHidingLayout(w, h, n);
        expect(layout.bushes).toHaveLength(n);
        for (const b of layout.bushes) {
          expect(b.hit.left).toBeGreaterThanOrEqual(0);
          expect(b.hit.right).toBeLessThanOrEqual(w);
          expect(b.hit.bottom).toBeLessThanOrEqual(h);
          expect(b.hit.top).toBeGreaterThan(layout.replay.y + layout.replay.radius - 1);
        }
        for (let i = 0; i < n; i++)
          for (let j = i + 1; j < n; j++) {
            const a = layout.bushes[i].hit;
            const c = layout.bushes[j].hit;
            const overlap = a.left < c.right && c.left < a.right && a.top < c.bottom && c.top < a.bottom;
            expect(overlap, `n=${n} ${w}x${h} bushes ${i},${j}`).toBe(false);
          }
      }
    }
  });

  it('[AC-18] puts the animal feet so that exactly the reveal fraction shows above the foliage', () => {
    expect(animalFeetY(500, 200, 1)).toBe(500);
    expect(animalFeetY(500, 200, 0.3)).toBeCloseTo(640);
    expect(animalFeetY(500, 200, 0.5)).toBeCloseTo(600);
  });
});

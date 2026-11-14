// Balloon Pop Pass 1 (docs/specs/balloon-pop.md): content, language and round building (AC-09), layout (AC-16).
import { describe, expect, it } from 'vitest';
import { loadBalloonPop } from '@/content/loadContent';
import { BalloonPopContentSchema } from '@/content/schema';
import { skillKey } from '@/core/adaptive';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';
import {
  balloonLevel,
  buildBalloonRound,
  eligibleItemIds,
  isCorrectBalloon,
  pickDistractors,
  promptFor,
} from '@/games/balloon/balloonRound';
import { computeBalloonLayout } from '@/games/balloon/balloonLayout';
import balloonJson from '@/content/games/balloon-pop.json';

const content = loadBalloonPop();
const levels = content.adaptive.levels;

/** Deterministic pseudo-random sequence. */
function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('balloon-pop: content (AC-09)', () => {
  it('[AC-09] the content parses, sits in the Number Garden, and speaks EN and FR', () => {
    expect(content.id).toBe('balloon-pop');
    expect(content.world).toBe('number-garden');
    expect(content.languages).toEqual(['en', 'fr']);
    expect(content.digits.map((d) => d.value)).toEqual([0, 1, 2, 3, 4, 5, 6, 7, 8, 9]);
  });

  it('[AC-09] the schema rejects a level without a mode, a digit range that is too small, and an unknown colour', () => {
    const clone = () => JSON.parse(JSON.stringify(balloonJson));
    const noMode = clone();
    delete noMode.adaptive.levels[0].extra.mode;
    expect(BalloonPopContentSchema.safeParse(noMode).success).toBe(false);
    const tooFew = clone();
    tooFew.adaptive.levels[4].extra.digitMax = 2; // 3 balloons, only digits 1-2
    expect(BalloonPopContentSchema.safeParse(tooFew).success).toBe(false);
    const badColor = clone();
    badColor.colors[0].color = 'gold';
    expect(BalloonPopContentSchema.safeParse(badColor).success).toBe(false);
  });

  it('[AC-09] each language feeds its own skill, keyed number-garden.balloon-pop.<lang>', () => {
    expect(skillKey(content.world, content.id, 'en')).toBe('number-garden.balloon-pop.en');
    expect(skillKey(content.world, content.id, 'fr')).toBe('number-garden.balloon-pop.fr');
  });

  it('[AC-09] the EN/FR voice option follows the parent language setting, one language per round', () => {
    for (let i = 0; i < 20; i++) {
      expect(nextRoundLanguage(null, true, 'en', seeded(i))).toBe('en');
      expect(nextRoundLanguage(null, true, 'fr', seeded(i))).toBe('fr');
    }
    expect(nextRoundLanguage('fr', false, 'both')).toBe('fr');
    expect(nextRoundLanguage('fr', false, 'en')).toBe('en'); // parent switched mid-round
  });

  it('[AC-09] requests read naturally in both languages', () => {
    expect(promptFor(content, 'color-red', 'en')).toBe('Pop the red balloon!');
    expect(promptFor(content, 'color-purple', 'fr')).toBe('Éclate le ballon violet !');
    expect(promptFor(content, 'digit-3', 'en')).toBe('Pop the number three!');
    expect(promptFor(content, 'digit-7', 'fr')).toBe('Éclate le chiffre sept !');
  });
});

describe('balloon-pop: round building (AC-09)', () => {
  it('[AC-09] every level builds rounds with the target among distinct balloons, the right count, and the right mode', () => {
    levels.forEach((descriptor, i) => {
      const level = balloonLevel(descriptor);
      const ids = eligibleItemIds(content, level);
      for (const target of ids) {
        for (const lang of ['en', 'fr'] as const) {
          const round = buildBalloonRound(content, descriptor, lang, target, seeded(i * 31 + target.length));
          const choiceIds = round.choices.map((c) => c.itemId);
          expect(choiceIds, `L${i + 1}`).toHaveLength(level.choiceCount);
          expect(new Set(choiceIds).size).toBe(level.choiceCount);
          expect(choiceIds).toContain(target);
          expect(round.targetItemId).toBe(target);
          expect(round.lineId).toBe(`balloon.${target}.${lang}`);
          expect(round.promptText).toBe(promptFor(content, target, lang));
          for (const id of choiceIds) expect(ids).toContain(id);
          if (level.mode === 'color') {
            expect(new Set(round.choices.map((c) => c.color)).size).toBe(level.choiceCount);
            expect(round.choices.every((c) => c.label === null)).toBe(true);
          } else {
            for (const c of round.choices) {
              const n = Number(c.label);
              expect(c.itemId).toBe(`digit-${n}`);
              expect(n).toBeGreaterThanOrEqual(level.digitMin);
              expect(n).toBeLessThanOrEqual(level.digitMax);
            }
          }
        }
      }
    });
  });

  it('[AC-09] age-2 levels pop colours only and age-5 levels digits only, with the specified ranges', () => {
    expect(levels.slice(0, 4).map((l) => balloonLevel(l).mode)).toEqual(['color', 'color', 'color', 'color']);
    expect(levels.slice(4).map((l) => balloonLevel(l).mode)).toEqual(['digit', 'digit', 'digit', 'digit']);
    expect(eligibleItemIds(content, balloonLevel(levels[4]))).toEqual(['digit-1', 'digit-2', 'digit-3', 'digit-4', 'digit-5']);
    expect(eligibleItemIds(content, balloonLevel(levels[7]))).toHaveLength(10);
    expect(levels.map((l) => l.choiceCount)).toEqual([2, 3, 4, 5, 3, 4, 5, 6]);
  });

  it('[AC-09] L8 near distractors put the look- or sound-alike digits first', () => {
    const level = balloonLevel(levels[7]);
    expect(level.distractor).toBe('near');
    const picked = pickDistractors(content, level, 'digit-6', 5, seeded(3));
    expect(picked.slice(0, 2)).toEqual(['digit-9', 'digit-0']);
    expect(picked).not.toContain('digit-6');
  });

  it('[AC-09] a target outside the level falls back to an eligible item', () => {
    const round = buildBalloonRound(content, levels[0], 'en', 'digit-4', seeded(1));
    expect(round.targetItemId.startsWith('color-')).toBe(true);
  });

  it('[AC-09] only the requested balloon is correct', () => {
    expect(isCorrectBalloon('digit-3', 'digit-3')).toBe(true);
    expect(isCorrectBalloon('digit-8', 'digit-3')).toBe(false);
  });
});

describe('balloon-pop: layout (AC-16)', () => {
  const overlap = (a: { left: number; right: number; top: number; bottom: number }, b: typeof a) =>
    a.left < b.right && b.left < a.right && a.top < b.bottom && b.top < a.bottom;

  for (const [w, h] of [[1280, 800], [800, 1280]] as const) {
    for (let n = 2; n <= 6; n++) {
      it(`[AC-16] ${n} balloons at ${w}x${h}: inside the screen, under the HUD, at least 64 px, no overlap`, () => {
        const layout = computeBalloonLayout(w, h, n);
        expect(layout.balloons).toHaveLength(n);
        for (const b of layout.balloons) {
          expect(b.hit.left).toBeGreaterThanOrEqual(0);
          expect(b.hit.right).toBeLessThanOrEqual(w);
          expect(b.hit.top).toBeGreaterThanOrEqual(170);
          expect(b.y + b.ry + 10 + b.stringLength).toBeLessThanOrEqual(h);
          expect(b.hit.right - b.hit.left).toBeGreaterThanOrEqual(64);
          expect(b.hit.bottom - b.hit.top).toBeGreaterThanOrEqual(64);
          expect(b.rx * 2).toBeGreaterThanOrEqual(100);
        }
        for (let i = 0; i < n; i++) for (let j = i + 1; j < n; j++) expect(overlap(layout.balloons[i].hit, layout.balloons[j].hit)).toBe(false);
        const r = layout.replay;
        for (const b of layout.balloons) expect(overlap(b.hit, { left: r.x - r.radius, right: r.x + r.radius, top: r.y - r.radius, bottom: r.y + r.radius })).toBe(false);
      });
    }
  }
});

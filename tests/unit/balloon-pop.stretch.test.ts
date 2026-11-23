// Balloon Pop age-5 stretch (docs/specs/balloon-pop.md, "Age-5 stretch", 2026-11-23): L9 teens 10-20, L10 "one / two
// more than n", L11 simple sums. The floating stage keeps working on these levels at the L8 speed.
import { describe, expect, it } from 'vitest';
import { loadBalloonPop } from '@/content/loadContent';
import { BalloonPopContentSchema } from '@/content/schema';
import balloonJson from '@/content/games/balloon-pop.json';
import {
  answerFor,
  balloonLevel,
  buildBalloonRound,
  eligibleItemIds,
  isCorrectBalloon,
  promptFor,
} from '@/games/balloon/balloonRound';
import { floatHitRect, floatSpeed, initialFloatBalloons, MAX_FLOAT_SPEED } from '@/games/balloon/balloonFloat';

const content = loadBalloonPop();
const levels = content.adaptive.levels;
const cfg = content.floating!;

/** L1-L8 exactly as on main before the stretch (2026-11-23). */
const PRE_STRETCH_LEVELS = [
  { choiceCount: 2, distractor: 'far', extra: { mode: 'color' } },
  { choiceCount: 3, distractor: 'far', extra: { mode: 'color' } },
  { choiceCount: 4, distractor: 'far', extra: { mode: 'color' } },
  { choiceCount: 5, distractor: 'far', extra: { mode: 'color' } },
  { choiceCount: 3, distractor: 'far', extra: { mode: 'digit', digitMin: 1, digitMax: 5 } },
  { choiceCount: 4, distractor: 'far', extra: { mode: 'digit', digitMin: 1, digitMax: 9 } },
  { choiceCount: 5, distractor: 'far', extra: { mode: 'digit', digitMin: 0, digitMax: 9 } },
  { choiceCount: 6, distractor: 'near', extra: { mode: 'digit', digitMin: 0, digitMax: 9 } },
];

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('balloon-pop age-5 stretch: levels and tracks', () => {
  it('[AC-23] L1-L8 and the age-2 track are unchanged; age 5 now reaches L11 (teens, more, sums)', () => {
    expect(levels.slice(0, 8)).toEqual(PRE_STRETCH_LEVELS);
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 4 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 5, min: 5, max: 11 });
    expect(levels.slice(8).map((l) => [balloonLevel(l).mode, l.choiceCount, l.distractor])).toEqual([
      ['digit', 5, 'near'],
      ['more', 4, 'near'],
      ['sum', 4, 'near'],
    ]);
    expect(eligibleItemIds(content, balloonLevel(levels[8]))).toEqual(Array.from({ length: 11 }, (_, i) => `digit-${10 + i}`));
    expect(eligibleItemIds(content, balloonLevel(levels[9]))).toHaveLength(20);
    expect(eligibleItemIds(content, balloonLevel(levels[10]))).toHaveLength(25);
  });

  it('[AC-23] the schema rejects a "more" level past 20, a sum level without addendMax, and a frame missing a slot', () => {
    const clone = () => JSON.parse(JSON.stringify(balloonJson));
    const far = clone();
    far.adaptive.levels[9].extra.baseMax = 19;
    expect(BalloonPopContentSchema.safeParse(far).success).toBe(false);
    const noAddend = clone();
    delete noAddend.adaptive.levels[10].extra.addendMax;
    expect(BalloonPopContentSchema.safeParse(noAddend).success).toBe(false);
    const badFrame = clone();
    badFrame.promptFrames.more.fr = 'Éclate le nombre {n} !';
    expect(BalloonPopContentSchema.safeParse(badFrame).success).toBe(false);
  });
});

describe('balloon-pop age-5 stretch: rounds', () => {
  it('[AC-24] every L9-L11 request builds distinct numbered balloons: exactly one shows the answer, all within 0-20', () => {
    levels.slice(8).forEach((descriptor, i) => {
      const level = balloonLevel(descriptor);
      for (const target of eligibleItemIds(content, level)) {
        for (const lang of ['en', 'fr'] as const) {
          const round = buildBalloonRound(content, descriptor, lang, target, seeded(i * 17 + target.length));
          const answer = answerFor(target)!;
          expect(round.choices).toHaveLength(level.choiceCount);
          expect(new Set(round.choices.map((c) => c.itemId)).size).toBe(level.choiceCount);
          const labels = round.choices.map((c) => Number(c.label));
          expect(new Set(labels).size).toBe(level.choiceCount);
          expect(labels.filter((n) => n === answer)).toHaveLength(1);
          for (const n of labels) {
            expect(n).toBeGreaterThanOrEqual(0);
            expect(n).toBeLessThanOrEqual(20);
          }
          const right = round.choices.find((c) => Number(c.label) === answer)!;
          expect(isCorrectBalloon(right.itemId, round.targetItemId)).toBe(true);
          for (const c of round.choices) if (c !== right) expect(isCorrectBalloon(c.itemId, round.targetItemId)).toBe(false);
          expect(round.lineId).toBe(`balloon.${target}.${lang}`);
        }
      }
    });
  });

  it('[AC-24] near distractors are the likely slips: n itself for "more", an addend or one off for sums', () => {
    const more = buildBalloonRound(content, levels[9], 'en', 'more-5-2', seeded(3));
    expect(more.choices.map((c) => c.label)).toEqual(expect.arrayContaining(['7', '5']));
    const sum = buildBalloonRound(content, levels[10], 'fr', 'sum-3-4', seeded(5));
    const labels = sum.choices.map((c) => Number(c.label));
    expect(labels).toContain(7);
    expect(labels.filter((n) => [3, 4, 6, 8].includes(n)).length).toBe(3);
  });

  it('[AC-24] requests read naturally: "nombre" for 10-20, one/two more than n, and a plus b', () => {
    expect(promptFor(content, 'digit-14', 'en')).toBe('Pop the number fourteen!');
    expect(promptFor(content, 'digit-14', 'fr')).toBe('Éclate le nombre quatorze !');
    expect(promptFor(content, 'digit-7', 'fr')).toBe('Éclate le chiffre sept !');
    expect(promptFor(content, 'more-5-2', 'en')).toBe('Pop the number that is two more than five!');
    expect(promptFor(content, 'more-9-1', 'fr')).toBe('Éclate le nombre qui fait un de plus que neuf !');
    expect(promptFor(content, 'sum-3-4', 'en')).toBe('What is three plus four? Pop it!');
    expect(promptFor(content, 'sum-2-5', 'fr')).toBe('Combien font deux plus cinq ? Éclate-le !');
  });

  it('[AC-24] every stretch line id has one text (so each gets its own recorded clip)', () => {
    const byId = new Map<string, string>();
    for (const descriptor of levels)
      for (const id of eligibleItemIds(content, balloonLevel(descriptor)))
        for (const lang of ['en', 'fr'] as const) {
          const r = buildBalloonRound(content, descriptor, lang, id, seeded(1));
          if (byId.has(r.lineId)) expect(byId.get(r.lineId), r.lineId).toBe(r.promptText);
          byId.set(r.lineId, r.promptText);
        }
    // 6 colours + 10 digits (Pass 1) + 11 teens + 20 "more" + 25 sums, in two languages.
    expect(byId.size).toBe(2 * (6 + 10 + 11 + 20 + 25));
  });
});

describe('balloon-pop age-5 stretch: floating stage', () => {
  it('[AC-25] L9-L11 float at the L8 speed (no faster), well under the cap; L5-L8 keep their speeds', () => {
    const { min } = content.adaptive.tracks.age5;
    const l8 = floatSpeed(cfg, 'age5', 8, min);
    expect(l8).toBeCloseTo(60 * (1 + 0.12 * 3), 6);
    for (const level of [9, 10, 11]) expect(floatSpeed(cfg, 'age5', level, min)).toBe(l8);
    expect(l8).toBeLessThan(MAX_FLOAT_SPEED);
    expect([5, 6, 7].map((l) => floatSpeed(cfg, 'age5', l, min))).toEqual([60, 60 * 1.12, 60 * 1.24].map((v) => expect.closeTo(v, 6)));
  });

  it('[AC-25] floating stretch balloons keep lane-sized bodies and hit pads inside the playfield in both orientations', () => {
    for (const [w, h] of [[1280, 800], [800, 1280]]) {
      for (const descriptor of levels.slice(8)) {
        const n = descriptor.choiceCount!;
        const floats = initialFloatBalloons(w, h, n, seeded(n));
        expect(floats).toHaveLength(n);
        for (const f of floats) {
          // A two-digit label is drawn at 0.78 ry (about 1.0 rx wide for "20"), inside the 2 rx body.
          expect(0.78 * f.ry * 1.25).toBeLessThan(2 * f.rx);
          const pad = floatHitRect(f, cfg.hitScale, cfg.minHitCssPx, w);
          expect(pad.left).toBeGreaterThanOrEqual(0);
          expect(pad.right).toBeLessThanOrEqual(w);
          expect(pad.right - pad.left).toBeGreaterThanOrEqual(cfg.minHitCssPx);
        }
      }
    }
  });
});

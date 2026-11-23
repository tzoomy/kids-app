// Number Bridge age-5 stretch (docs/specs/number-bridge.md, "Age-5 stretch: equation bridges", 2026-11-23):
// L6 addition within 10, L7 subtraction within 10, L8 addition and subtraction within 20 (audio-only hint).
import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadNumberBridge } from '@/content/loadContent';
import { NumberBridgeContentSchema } from '@/content/schema';
import numberBridgeJson from '@/content/games/number-bridge.json';
import { buildBridge, createBridge, equationCandidates, tapChoice, type PreviousBridge } from '@/games/numberBridge/bridgeMachine';
import {
  allBridgeVoiceLines,
  equationHopLines,
  equationLines,
  introKey,
  introLine,
  numberLine,
  planForLevel,
  trialForBridge,
} from '@/games/numberBridge/bridgeRound';

const content = loadNumberBridge();

/** L1-L5 and both tracks exactly as on main before the stretch (2026-11-23): age 2 must never change. */
const PRE_STRETCH_LEVELS = [
  { support: 'picture-audio', extra: { mode: 'one-more', stones: 3, gaps: 1, range: 5, dots: false } },
  { support: 'picture-audio', extra: { mode: 'one-more', stones: 4, gaps: 2, range: 5, dots: false } },
  { support: 'picture-audio', extra: { mode: 'missing', stones: 4, gaps: 1, range: 5, dots: true } },
  { support: 'picture-audio', extra: { mode: 'missing', stones: 5, gaps: 1, range: 10, dots: false } },
  { support: 'audio-only', extra: { mode: 'missing', stones: 5, gaps: 1, range: 10, dots: false } },
];

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function session(track: 'age2' | 'age5'): SkillSession {
  return new SkillSession({
    store: new AdaptiveStore(memoryDriver()),
    profileId: 'p',
    track,
    world: content.world,
    gameId: content.id,
    meta: buildMeta({ levelCount: content.adaptive.levels.length, tracks: content.adaptive.tracks, rules: content.adaptive.rules }),
    today: () => '2026-11-23',
    random: () => 0.3,
  });
}

describe('number-bridge age-5 stretch: levels and tracks', () => {
  it('[AC-10] L1-L5 and the age-2 track are unchanged; age 5 now reaches L8; L6-L8 are equation levels', () => {
    expect(content.adaptive.levels.slice(0, 5)).toEqual(PRE_STRETCH_LEVELS);
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 2 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 3, min: 2, max: 8 });
    const plans = content.adaptive.levels.slice(5).map(planForLevel);
    expect(plans.map((p) => [p.mode, p.op, p.range, p.stones, p.gaps, p.audioOnly])).toEqual([
      ['equation', 'add', 10, 3, 1, false],
      ['equation', 'sub', 10, 3, 1, false],
      ['equation', 'mix', 20, 3, 1, true],
    ]);
    for (const level of content.adaptive.levels.slice(0, 5)) expect(planForLevel(level).op).toBeNull();
  });

  it('[AC-10] the schema rejects equation levels with a bad op, more than 3 stones, or a range above 20', () => {
    const clone = () => JSON.parse(JSON.stringify(numberBridgeJson));
    expect(NumberBridgeContentSchema.safeParse(clone()).success).toBe(true);
    const badOp = clone();
    badOp.adaptive.levels[5].extra.op = 'times';
    expect(NumberBridgeContentSchema.safeParse(badOp).success).toBe(false);
    const tooMany = clone();
    tooMany.adaptive.levels[6].extra.stones = 4;
    expect(NumberBridgeContentSchema.safeParse(tooMany).success).toBe(false);
    const tooFar = clone();
    tooFar.adaptive.levels[7].extra.range = 30;
    expect(NumberBridgeContentSchema.safeParse(tooFar).success).toBe(false);
    const opOnMissing = clone();
    opOnMissing.adaptive.levels[3].extra.op = 'add';
    expect(NumberBridgeContentSchema.safeParse(opOnMissing).success).toBe(false);
    const missingWord = clone();
    delete missingWord.numbers['17'];
    expect(NumberBridgeContentSchema.safeParse(missingWord).success).toBe(false);
  });

  it('[AC-11] age 5 climbs from L5 to L8 on clean equation bridges and stays at L8; age 2 never leaves L1-L2', () => {
    const age5 = session('age5');
    const rng = seeded(7);
    let prev: PreviousBridge | null = null;
    for (let i = 0; i < 30; i++) {
      const plan = planForLevel(content.adaptive.levels[age5.level('en') - 1]);
      const spec = buildBridge(plan, prev, rng);
      prev = { sequence: spec.sequence, gaps: spec.gaps };
      const state = tapChoice(createBridge(spec), spec.answer!).state;
      age5.record('en', trialForBridge(state, false));
    }
    expect(age5.level('en')).toBe(8);
    const age2 = session('age2');
    for (let i = 0; i < 20; i++) {
      const plan = planForLevel(content.adaptive.levels[age2.level('fr') - 1]);
      expect(plan.mode).toBe('one-more');
      const spec = buildBridge(plan);
      age2.record('fr', trialForBridge(createBridge(spec), false));
      if (i % 3 === 2) age2.endVisit();
    }
    expect(age2.level('fr')).toBeLessThanOrEqual(2);
  });
});

describe('number-bridge age-5 stretch: equation bridges', () => {
  it('[AC-12] every equation is a op b = c with 1..range numbers, the gap on c, and 3 distinct choices', () => {
    for (const [idx, level] of content.adaptive.levels.slice(5).entries()) {
      const plan = planForLevel(level);
      const rng = seeded(idx * 101 + 3);
      let prev: PreviousBridge | null = null;
      const ops = new Set<string>();
      for (let i = 0; i < 300; i++) {
        const spec = buildBridge(plan, prev, rng);
        const [a, b, c] = spec.sequence;
        expect(spec.mode).toBe('equation');
        expect(spec.gaps).toEqual([2]);
        expect(spec.answer).toBe(c);
        expect(c).toBe(spec.op === 'add' ? a + b : a - b);
        for (const n of spec.sequence) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(plan.range);
        }
        expect(new Set(spec.choices).size).toBe(3);
        expect(spec.choices).toContain(c);
        for (const n of spec.choices) {
          expect(n).toBeGreaterThanOrEqual(1);
          expect(n).toBeLessThanOrEqual(plan.range);
        }
        expect(spec.choices.some((n) => Math.abs(n - c) === 1)).toBe(true);
        if (prev) expect(spec.sequence).not.toEqual(prev.sequence);
        if (plan.range > 10) expect(spec.op === 'add' ? c >= 11 : a >= 11).toBe(true);
        ops.add(spec.op!);
        expect(() => createBridge(spec)).not.toThrow();
        prev = { sequence: spec.sequence, gaps: spec.gaps };
      }
      expect([...ops].sort()).toEqual(plan.op === 'mix' ? ['add', 'sub'] : [plan.op]);
    }
  });

  it('[AC-12] the candidate sets: 45 sums and 45 differences within 10; within 20 every equation touches the teens', () => {
    expect(equationCandidates('add', 10)).toHaveLength(45);
    expect(equationCandidates('sub', 10)).toHaveLength(45);
    for (const [a, b, c] of equationCandidates('add', 20)) expect(a + b === c && c >= 11 && c <= 20).toBe(true);
    for (const [a, b, c] of equationCandidates('sub', 20)) expect(a - b === c && a >= 11 && c >= 1).toBe(true);
  });

  it('[AC-12] a wrong stone keeps the gap (no fail state); only a first-tap answer is clean; item ids are "a+b" / "a-b"', () => {
    const plan = planForLevel(content.adaptive.levels[6]);
    const spec = buildBridge(plan, null, seeded(11));
    const wrong = spec.choices.find((n) => n !== spec.answer)!;
    const missed = tapChoice(createBridge(spec), wrong);
    expect(missed.event.kind).toBe('not-this-one');
    expect(missed.state.phase).toBe('building');
    expect(missed.state.gaps).toEqual([2]);
    const done = tapChoice(missed.state, spec.answer!);
    expect(done.event.kind).toBe('complete');
    const [a, b] = spec.sequence;
    expect(trialForBridge(done.state, false)).toEqual({ itemId: `${a}-${b}`, firstTryCorrect: false, hinted: false });
    const clean = tapChoice(createBridge(spec), spec.answer!).state;
    expect(trialForBridge(clean, false).firstTryCorrect).toBe(true);
  });
});

describe('number-bridge age-5 stretch: voice lines', () => {
  it('[AC-13] the question is spoken clip by clip in the learning language, and the crossing says the whole equation', () => {
    const state = { sequence: [12, 3, 9], op: 'sub' as const };
    expect(equationLines(content, state, 'fr').map((l) => l.lineId)).toEqual([
      'bridge.number.12.fr',
      'bridge.op.minus.fr',
      'bridge.number.3.fr',
      'bridge.op.equals.fr',
    ]);
    expect(equationLines(content, state, 'fr').map((l) => l.text)).toEqual(['douze', 'moins', 'trois', 'égale']);
    expect(equationHopLines(content, { sequence: [3, 4, 7], op: 'add' }, 'en').map((hop) => hop.map((l) => l.text))).toEqual([
      ['three'],
      ['plus', 'four'],
      ['equals', 'seven'],
    ]);
    expect(numberLine(content, 20, 'en')).toEqual({ lineId: 'bridge.number.20.en', lang: 'en', text: 'twenty' });
    expect(() => numberLine(content, 21, 'en')).toThrow();
  });

  it('[AC-13] each equation level has its own Hebrew intro, addressed to one girl', () => {
    const plans = content.adaptive.levels.slice(5).map(planForLevel);
    expect(plans.map(introKey)).toEqual(['equation-add', 'equation-sub', 'equation-mix']);
    expect(plans.map((p) => introLine(content, p.mode, p.op).lineId)).toEqual([
      'bridge.intro.add.he',
      'bridge.intro.sub.he',
      'bridge.intro.mix.he',
    ]);
    // L1-L5 keep their intros.
    expect(introLine(content, 'missing').lineId).toBe('bridge.intro.missing.he');
    for (const p of plans) {
      const text = introLine(content, p.mode, p.op).text;
      expect(text).toMatch(/בחרי/);
      expect(text).not.toMatch(/(^|\s)(בחר|הקשב|בוא)(\s|[.!?,]|$)/);
    }
  });

  it('[AC-13] every line id has exactly one text, and the stretch adds numbers 11-20, operators and three intros', () => {
    const lines = allBridgeVoiceLines(content);
    const byId = new Map<string, string>();
    for (const l of lines) {
      expect(l.text.trim().length, l.lineId).toBeGreaterThan(0);
      if (byId.has(l.lineId)) expect(byId.get(l.lineId), l.lineId).toBe(l.text);
      byId.set(l.lineId, l.text);
    }
    for (const lang of ['en', 'fr']) {
      for (let n = 1; n <= 20; n++) expect(byId.has(`bridge.number.${n}.${lang}`)).toBe(true);
      for (const w of ['plus', 'minus', 'equals']) expect(byId.has(`bridge.op.${w}.${lang}`)).toBe(true);
    }
    expect(lines).toHaveLength(8 + 2 * (1 + 20 + 3));
  });
});

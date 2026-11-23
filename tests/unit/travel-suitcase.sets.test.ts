import { describe, expect, it } from 'vitest';
import { loadTravelSuitcase } from '../../src/content/loadContent';
import { TravelSuitcaseContentSchema } from '../../src/content/schema';
import {
  createCase,
  nextRequest,
  pick,
  remainingTargets,
  type SuitcaseState,
} from '../../src/games/travelSuitcase/suitcaseMachine';
import { buildCase, buildRequest, planForLevel, requestLine } from '../../src/games/travelSuitcase/suitcaseRound';

function makeRng(seed: number): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

const SEEDS = Array.from({ length: 60 }, (_, i) => i * 37 + 3);
const LANGS = ['en', 'fr'] as const;

describe('travel-suitcase L6-L8 ceilings', () => {
  const content = loadTravelSuitcase();
  const levels = content.adaptive.levels;

  it('[AC-12] age2 track is pinned and age5 reaches L8 while starting at L3', () => {
    expect(content.adaptive.tracks.age2).toEqual({ start: 1, min: 1, max: 2 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 3, min: 1, max: 8 });
    expect(levels).toHaveLength(8);
  });

  it('[AC-12] L6-L8 plans: 6/6/8 shelf, set of 3, attribute then negation, L8 audio-only', () => {
    expect(planForLevel(levels[5])).toEqual({
      request: 'attribute',
      choiceCount: 6,
      setSize: 3,
      requestsPerCase: 2,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(levels[6])).toEqual({
      request: 'negation',
      choiceCount: 6,
      setSize: 3,
      requestsPerCase: 2,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(levels[7])).toEqual({
      request: 'negation',
      choiceCount: 8,
      setSize: 3,
      requestsPerCase: 2,
      audioOnly: true,
      hintPulse: false,
    });
    for (let i = 0; i < 5; i++) expect(planForLevel(levels[i]).setSize).toBe(1);
  });

  it('[AC-12] L4-L5 keep exactly 4 choices; set levels may use 6 and 8; bad shelves are rejected', () => {
    expect(levels[3].choiceCount).toBe(4);
    expect(levels[4].choiceCount).toBe(4);
    const bad = structuredClone(content);
    bad.adaptive.levels[3].choiceCount = 6; // single attribute with 6 is still invalid
    expect(TravelSuitcaseContentSchema.safeParse(bad).success).toBe(false);
    const tooSmall = structuredClone(content);
    tooSmall.adaptive.levels[6].choiceCount = 4; // negation set needs 3 colours + 2 other targets
    expect(TravelSuitcaseContentSchema.safeParse(tooSmall).success).toBe(false);
    expect(TravelSuitcaseContentSchema.safeParse(structuredClone(content)).success).toBe(true);
  });

  it('[AC-12] curated sets: every set has a disjoint partner and at least one colour item', () => {
    expect(content.sets.length).toBeGreaterThanOrEqual(6);
    for (const set of content.sets) {
      const ids = set.attribute.map((s) => s.item);
      expect(new Set(ids).size).toBe(3);
      expect(set.attribute.some((s) => s.color)).toBe(true);
      expect(set.negation.filter((s) => s.notColor)).toHaveLength(1);
      expect(set.negation.map((s) => s.item).sort()).toEqual([...ids].sort());
      const partner = content.sets.find((o) => o.id !== set.id && o.attribute.every((s) => !ids.includes(s.item)));
      expect(partner, `set ${set.id} needs a disjoint partner`).toBeDefined();
    }
    const missingPartner = structuredClone(content);
    missingPartner.sets = [missingPartner.sets[0]];
    expect(TravelSuitcaseContentSchema.safeParse(missingPartner).success).toBe(false);
  });

  it('[AC-13] L6 attribute set: 3 specified targets in any order, near-colour distractor, 6 choices', () => {
    const plan = planForLevel(levels[5]);
    for (const lang of LANGS) {
      for (const seed of SEEDS) {
        const built = buildRequest(content, plan, null, makeRng(seed), [], lang);
        const r = built.request;
        expect(r.kind).toBe('set');
        expect(r.needed).toBe(3);
        expect(r.groups).toHaveLength(3);
        expect(r.groups.every((g) => g.length === 1)).toBe(true);
        expect(built.choices).toHaveLength(6);
        const ids = built.choices.map((c) => c.id);
        expect(new Set(ids).size).toBe(6);
        for (const t of r.targets) expect(ids).toContain(t);
        const coloured = r.targets.filter((t) => built.choices.find((c) => c.id === t)!.color !== null);
        expect(coloured.length).toBeGreaterThanOrEqual(1);
        // near distractor: same item as a coloured target, different colour, not a target
        const near = built.choices.filter(
          (c) =>
            c.color !== null &&
            !r.targets.includes(c.id) &&
            coloured.some((t) => built.choices.find((x) => x.id === t)!.itemId === c.itemId),
        );
        expect(near.length).toBeGreaterThanOrEqual(1);
        // spoken text names all three (colour words for coloured items)
        const text = requestLine(content, r, lang).text;
        expect(text).toBe(built.lineText);
        for (const t of r.targets) {
          const c = built.choices.find((x) => x.id === t)!;
          const item = content.items.find((i) => i.id === c.itemId)!;
          const phrase = c.color ? item.colors!.find((v) => v.color === c.color)![lang] : item[lang].the;
          expect(text).toContain(phrase);
        }
        expect(r.excludedColor).toBeUndefined();
      }
    }
  });

  it('[AC-14] L7/L8 negation set: one negation slot accepts either other colour, excluded colour is on the shelf', () => {
    for (const levelIdx of [6, 7]) {
      const plan = planForLevel(levels[levelIdx]);
      for (const lang of LANGS) {
        for (const seed of SEEDS) {
          const built = buildRequest(content, plan, null, makeRng(seed), [], lang);
          const r = built.request;
          expect(built.choices).toHaveLength(plan.choiceCount);
          expect(r.kind).toBe('set');
          expect(r.needed).toBe(3);
          expect(r.groups).toHaveLength(3);
          const negGroup = r.groups.find((g) => g.length === 2)!;
          expect(negGroup).toBeDefined();
          expect(r.groups.filter((g) => g.length === 1)).toHaveLength(2);
          const excludedId = `${r.groups.find((g) => g.length === 2)![0].split('-')[0]}-${r.excludedColor}`;
          expect(negGroup).not.toContain(excludedId);
          const ids = built.choices.map((c) => c.id);
          expect(ids).toContain(excludedId);
          expect(r.targets).not.toContain(excludedId);
          for (const t of r.targets) expect(ids).toContain(t);
          const item = content.items.find((i) => i.id === negGroup[0].split('-')[0])!;
          const variant = item.colors!.find((v) => v.color === r.excludedColor)!;
          const one = lang === 'en' ? variant.enOne : variant.frOne;
          const text = requestLine(content, r, lang).text;
          expect(text).toContain(`${lang === 'en' ? 'but not' : 'mais pas'} ${one}`);
          expect(text).toContain(item[lang].a);
        }
      }
    }
  });

  it('[AC-14] L8 uses 8 choices and audio-only (no hint pulse)', () => {
    const plan = planForLevel(levels[7]);
    expect(plan.audioOnly).toBe(true);
    const built = buildRequest(content, plan, null, makeRng(5), [], 'en');
    expect(built.choices).toHaveLength(8);
  });

  it('[AC-13] [AC-14] machine plays a full L6-L8 case: any order, sibling colour is busy, wrong picks stay out', () => {
    for (const levelIdx of [5, 6, 7]) {
      const plan = planForLevel(levels[levelIdx]);
      for (const seed of SEEDS.slice(0, 15)) {
        const rng = makeRng(seed);
        const built = buildCase(content, plan, null, rng, 'en');
        expect(built.requests).toHaveLength(2);
        const first = built.requests[0];
        const second = built.requests[1];
        const firstItems = new Set(first.request.targetItemIds);
        expect(second.request.targetItemIds.some((i) => firstItems.has(i))).toBe(false);
        for (const c of second.choices) expect(firstItems.has(c.itemId)).toBe(false);

        let state: SuitcaseState = createCase({
          choices: first.choices,
          request: { kind: first.request.kind, targets: first.request.targets, groups: first.request.groups },
          requestsPerCase: 2,
        });
        expect(state.request.needed).toBe(3);
        // a wrong choice never packs
        const wrong = state.choices.find((c) => !state.request.targets.includes(c.id))!;
        const miss = pick(state, wrong.id);
        expect(miss.event.kind).toBe('other');
        state = miss.state;
        // pack groups in reversed order
        const groups = [...first.request.groups].reverse();
        groups.forEach((g, i) => {
          const res = pick(state, g[g.length - 1]);
          expect(res.event.kind).toBe('packed');
          state = res.state;
          if (g.length === 2) {
            const sibling = pick(state, g[0]);
            expect(sibling.event.kind).toBe('busy');
            expect(remainingTargets(state)).not.toContain(g[0]);
          }
          if (i < 2) expect(remainingTargets(state).length).toBeGreaterThan(0);
        });
        expect(state.request.packedForRequest).toHaveLength(3);
        expect(remainingTargets(state)).toEqual([]);

        state = nextRequest(state, {
          choices: second.choices,
          request: { kind: second.request.kind, targets: second.request.targets, groups: second.request.groups },
        });
        let last = null as ReturnType<typeof pick> | null;
        for (const g of second.request.groups) {
          last = pick(state, g[0]);
          state = last.state;
        }
        expect(last!.event).toMatchObject({ kind: 'packed', requestDone: true, caseDone: true });
        expect(state.phase).toBe('closing');
      }
    }
  });

  it('[AC-12] age2 levels L1-L2 are unchanged noun requests with setSize 1', () => {
    for (const idx of [0, 1]) {
      const plan = planForLevel(levels[idx]);
      expect(plan.request).toBe('noun');
      expect(plan.setSize).toBe(1);
    }
    expect(levels[0].choiceCount).toBe(2);
    expect(levels[1].choiceCount).toBe(3);
  });
});

// Picnic Train age-5 stretch (docs/specs/picnic-train.md, "Age-5 stretch", 2026-11-23): L9 "pack a and b more" (sums up
// to 15), L10 sums and take-aways with 10-15 items (up to 20 on the shelf). Load task, 20-slot shelf; Hebrew requests.
import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadPicnicTrain } from '@/content/loadContent';
import { PicnicTrainContentSchema } from '@/content/schema';
import picnicJson from '@/content/games/picnic-train.json';
import {
  MAX_LOAD,
  STRETCH_LOAD,
  TrainRound,
  askLine,
  buildTrain,
  equationCandidates,
  levelLevers,
  numberLine,
  parseEquationId,
  roundCandidates,
  trainSizeCandidates,
} from '@/games/picnic/picnicLogic';
import { PICNIC_LINE_TEXT } from '@/games/picnic/picnicVoice';
import { computePicnicLayout, shelfSlotRects, type LayoutRect } from '@/games/picnic/picnicLayout';

const content = loadPicnicTrain();
const levels = content.adaptive.levels;

/** L1-L8 exactly as on main before the stretch (2026-11-23). */
const PRE_STRETCH_LEVELS = [
  { setSize: 2, scaffold: 'outline', extra: { task: 'one-each', layout: 'rows' } },
  { setSize: 3, scaffold: 'outline', extra: { task: 'one-each', layout: 'rows' } },
  { setSize: 3, scaffold: 'symbol', extra: { task: 'one-each', layout: 'rows' } },
  { setSize: 4, request: 'quantity', scaffold: 'symbol', extra: { task: 'load', layout: 'rows' } },
  { setSize: 5, request: 'quantity', scaffold: 'none', extra: { task: 'load', layout: 'scattered' } },
  { setSize: 6, request: 'quantity', scaffold: 'none', extra: { task: 'load', layout: 'scattered' } },
  { setSize: 8, request: 'two-step', scaffold: 'none', extra: { task: 'missing', layout: 'scattered' } },
  { setSize: 10, request: 'two-step', scaffold: 'none', extra: { task: 'missing', layout: 'scattered' } },
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

const overlaps = (a: LayoutRect, b: LayoutRect) => a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;

describe('picnic-train age-5 stretch: levels and tracks', () => {
  it('[AC-28] L1-L8 and the age-2 track are unchanged; age 5 now reaches L10; L9-L10 are load levels with an operation', () => {
    expect(levels.slice(0, 8)).toEqual(PRE_STRETCH_LEVELS);
    expect(content.adaptive.tracks.age2).toEqual({ start: 2, min: 1, max: 8 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 5, min: 1, max: 10 });
    expect(levels.slice(8).map((l) => levelLevers(l).equation)).toEqual([
      { op: 'add', aMin: 5, aMax: 10, bMin: 2, bMax: 5 },
      { op: 'mix', aMin: 10, aMax: 15, bMin: 2, bMax: 5 },
    ]);
    for (const l of levels.slice(0, 8)) {
      const v = levelLevers(l);
      expect(v.equation).toBeNull();
      expect(roundCandidates(v)).toEqual(trainSizeCandidates(v.setSize));
    }
  });

  it('[AC-28] the schema rejects an operation on a non-load level and sums past the 20-slot shelf', () => {
    const clone = () => JSON.parse(JSON.stringify(picnicJson));
    expect(PicnicTrainContentSchema.safeParse(clone()).success).toBe(true);
    const onMissing = clone();
    onMissing.adaptive.levels[7].extra.op = 'add';
    expect(PicnicTrainContentSchema.safeParse(onMissing).success).toBe(false);
    const tooBig = clone();
    tooBig.adaptive.levels[9].extra.aMax = 18;
    expect(PicnicTrainContentSchema.safeParse(tooBig).success).toBe(false);
    const negative = clone();
    negative.adaptive.levels[9].extra.aMin = 4;
    expect(PicnicTrainContentSchema.safeParse(negative).success).toBe(false);
  });

  it('[AC-28] age 5 climbs from L8 to L10 on clean trains; age 2 stays within L1-L8', () => {
    const meta = buildMeta({ levelCount: levels.length, tracks: content.adaptive.tracks, rules: content.adaptive.rules });
    const make = (track: 'age2' | 'age5') =>
      new SkillSession({ store: new AdaptiveStore(memoryDriver()), profileId: 'p', track, world: content.world, gameId: content.id, meta, today: () => '2026-11-23', random: () => 0.4 });
    const age5 = make('age5');
    const age2 = make('age2');
    for (let i = 0; i < 40; i++) {
      for (const [s, lang] of [[age5, 'en'], [age2, 'fr']] as const) {
        const levers = levelLevers(levels[s.level(lang) - 1]);
        s.record(lang, { itemId: s.selectNextItem(lang, roundCandidates(levers)), firstTryCorrect: true, hinted: false });
      }
    }
    expect(age5.level('en')).toBe(10);
    expect(age2.level('fr')).toBe(8);
  });
});

describe('picnic-train age-5 stretch: trains', () => {
  it('[AC-29] every request is "a + b" or "a - b" with a result 1..20 and a 20-slot shelf; L10 mixes both', () => {
    const l9 = equationCandidates(levelLevers(levels[8]).equation!);
    const l10 = equationCandidates(levelLevers(levels[9]).equation!);
    expect(l9).toHaveLength(6 * 4);
    expect(l10).toHaveLength(2 * 6 * 4);
    expect(new Set(l10.map((id) => id.split('-')[0]))).toEqual(new Set(['add', 'sub']));
    for (const [i, level] of levels.slice(8).entries()) {
      const levers = levelLevers(level);
      for (const id of roundCandidates(levers)) {
        const plan = buildTrain({ levers, sizeId: id, random: seeded(i + id.length) });
        const eq = parseEquationId(id)!;
        expect(plan.task).toBe('load');
        expect(plan.equation).toEqual(eq);
        expect(plan.target).toBe(eq.op === 'add' ? eq.a + eq.b : eq.a - eq.b);
        expect(plan.target).toBeGreaterThanOrEqual(1);
        expect(plan.target).toBeLessThanOrEqual(STRETCH_LOAD);
        expect(plan.capacity).toBe(STRETCH_LOAD);
        expect(askLine(plan).lineId).toBe(`picnic.ask.${eq.op}.${eq.a}.${eq.b}.he`);
      }
    }
  });

  it('[AC-29] the shelf takes up to 20 items; "take b out" works with unload; go is right only at a - b', () => {
    const levers = levelLevers(levels[9]);
    const plan = buildTrain({ levers, sizeId: 'sub-12-3', random: seeded(2) });
    const round = new TrainRound(plan);
    for (let i = 0; i < 12; i++) round.load();
    expect(round.go()).toEqual({ kind: 'wrong', count: 12 });
    for (let i = 0; i < 12; i++) round.load();
    for (let i = 0; i < 3; i++) round.unload();
    expect(round.loaded).toBe(9);
    expect(round.go()).toEqual({ kind: 'ready' });
    const full = new TrainRound(buildTrain({ levers, sizeId: 'add-15-5', random: seeded(3) }));
    for (let i = 0; i < 20; i++) expect(full.load().kind).toBe('loaded');
    expect(full.load()).toEqual({ kind: 'full' });
    // The pre-stretch load levels still stop at 10.
    const old = new TrainRound(buildTrain({ levers: levelLevers(levels[5]), sizeId: 'n6', random: seeded(4) }));
    for (let i = 0; i < MAX_LOAD; i++) old.load();
    expect(old.load()).toEqual({ kind: 'full' });
  });
});

describe('picnic-train age-5 stretch: 20-slot shelf layout', () => {
  const PHONES = [{ width: 360, height: 800 }, { width: 412, height: 915 }];

  it('[AC-30] 20 slots fit between the train and the basket in both orientations, never overlap, and stay >= 64 game px', () => {
    for (const [w, h] of [[1280, 800], [800, 1280]]) {
      const layout = computePicnicLayout(w, h, { seatCount: 10, focusSeat: 0, shelfCapacity: STRETCH_LOAD });
      const slots = layout.shelf.slots;
      expect(slots).toHaveLength(20);
      for (const [i, s] of slots.entries()) {
        expect(s.width).toBeGreaterThanOrEqual(64);
        expect(s.x).toBeGreaterThanOrEqual(0);
        expect(s.x + s.width).toBeLessThanOrEqual(w);
        expect(s.y).toBeGreaterThanOrEqual(layout.trainTop + layout.trainHeight);
        expect(overlaps(s, layout.basket.hit)).toBe(false);
        expect(overlaps(s, layout.go.hit)).toBe(false);
        for (const t of slots.slice(i + 1)) expect(overlaps(s, t)).toBe(false);
      }
    }
  });

  it('[AC-30] portrait phones keep every stretch slot at least 48 CSS px (the #97 floor); the 10-slot shelf is unchanged', () => {
    const slots = shelfSlotRects(800, 1280, STRETCH_LOAD);
    for (const phone of PHONES) {
      const scale = Math.min(phone.width / 800, phone.height / 1280);
      for (const s of slots) expect(s.width * scale).toBeGreaterThanOrEqual(48);
    }
    for (const [w, h] of [[1280, 800], [800, 1280]]) {
      expect(shelfSlotRects(w, h, MAX_LOAD)).toEqual(shelfSlotRects(w, h));
      expect(computePicnicLayout(w, h, { seatCount: 6, focusSeat: 0 }).shelf.slots).toEqual(shelfSlotRects(w, h));
    }
  });
});

describe('picnic-train age-5 stretch: voice lines', () => {
  it('[AC-31] every stretch request has its own Hebrew line, addressed to one girl, with masculine numbers for פריטים', () => {
    const ids = levels.slice(8).flatMap((l) => roundCandidates(levelLevers(l)));
    const asks = new Set(ids.map((id) => askLine({ task: 'load', target: 0, equation: parseEquationId(id) }).lineId));
    expect(asks.size).toBe(24 + 24 - 4 + 24); // L9 add (a 5-10) + L10 add (a 10-15; a = 10 shared with L9) + L10 sub
    for (const id of asks) {
      const text = PICNIC_LINE_TEXT[id];
      expect(text, id).toBeTruthy();
      expect(text).toMatch(/^ארזי /);
      expect(text).toMatch(/לחצי על הדגל!$/);
      expect(text).toMatch(/פריטים/);
      expect(text).not.toMatch(/(^|\s)(ארוז|לחץ|הוצא)(\s|,|$)/);
    }
    expect(PICNIC_LINE_TEXT['picnic.ask.add.7.4.he']).toBe('ארזי שבעה פריטים ועוד ארבעה, ואז לחצי על הדגל!');
    expect(PICNIC_LINE_TEXT['picnic.ask.sub.12.3.he']).toBe('ארזי שנים עשר פריטים, הוציאי שלושה, ואז לחצי על הדגל!');
    expect(PICNIC_LINE_TEXT['picnic.ask.add.15.2.he']).toBe('ארזי חמישה עשר פריטים ועוד שניים, ואז לחצי על הדגל!');
    // Only the requests the content can make get a line (no stray clips for the TTS job).
    const all = Object.keys(PICNIC_LINE_TEXT).filter((k) => /^picnic\.ask\.(add|sub)\..*\.he$/.test(k));
    expect(new Set(all)).toEqual(asks);
    // Wave 2: the age-5 English and French requests cover exactly the same set of requests, no strays.
    for (const lang of ['en', 'fr']) {
      const langAll = Object.keys(PICNIC_LINE_TEXT).filter((k) => new RegExp(`^picnic\\.ask\\.(add|sub)\\..*\\.${lang}$`).test(k));
      expect(new Set(langAll)).toEqual(new Set([...asks].map((id) => id.replace(/\.he$/, `.${lang}`))));
    }
  });

  it('[AC-31] counting words go up to twenty in English and French', () => {
    for (let n = 11; n <= 20; n++) {
      for (const lang of ['en', 'fr'] as const) expect(PICNIC_LINE_TEXT[numberLine(n, lang).lineId], `${n} ${lang}`).toBeTruthy();
    }
    expect(PICNIC_LINE_TEXT['picnic.number.17.fr']).toBe('dix-sept');
    expect(PICNIC_LINE_TEXT['picnic.number.20.en']).toBe('twenty');
  });
});

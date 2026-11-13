import { describe, expect, it } from 'vitest';
import {
  buildMeta,
  initialSession,
  initialSkill,
  recordTrial,
  selectNextItem,
  type ItemState,
  type SkillSessionState,
  type SkillState,
} from '@/core/adaptive';

const TODAY = '2026-11-12';
const meta = buildMeta({ levelCount: 5, tracks: { age2: { start: 1, max: 5 }, age5: { start: 4, max: 5 } } });

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

function item(box: ItemState['box'], lastSeenDay = TODAY): ItemState {
  return { box, seen: 3, clean: 2, lastSeenDay };
}

function skillWith(items: Record<string, ItemState>, extra: Partial<SkillState> = {}): SkillState {
  return { ...initialSkill(meta, 'age5', TODAY), items, ...extra };
}

function sessionWith(extra: Partial<SkillSessionState> = {}): SkillSessionState {
  return { ...initialSession(), ...extra };
}

const pick = (skill: SkillState, session: SkillSessionState, candidates: string[], seed = 1, today = TODAY) =>
  selectNextItem(skill, session, candidates, meta, today, seeded(seed));

describe('after a level drop', () => {
  it('serves a known item (box >= 3) and clears afterDrop', () => {
    const skill = skillWith({ a: item(1), b: item(4), c: item(2) }, { afterDrop: true });
    const sel = pick(skill, sessionWith(), ['a', 'b', 'c', 'd']);
    expect(sel.itemId).toBe('b');
    expect(sel.skill.afterDrop).toBe(false);
  });

  it('falls back to the highest box seen, then to any candidate', () => {
    const skill = skillWith({ a: item(1), c: item(2) }, { afterDrop: true });
    expect(pick(skill, sessionWith(), ['a', 'c', 'd']).itemId).toBe('c');
    const none = skillWith({}, { afterDrop: true });
    expect(['x', 'y']).toContain(pick(none, sessionWith(), ['x', 'y']).itemId);
  });
});

describe('retries and review', () => {
  it('a missed item returns after retryAfterTrials trials', () => {
    let skill = skillWith({ a: item(3), b: item(3), c: item(3), d: item(3) });
    let session = sessionWith();
    const step = recordTrial(skill, session, { itemId: 'a', firstTryCorrect: false, hinted: false }, meta, 'age5', TODAY);
    skill = step.skill;
    session = step.session;
    // Not due yet (due at trial 0 + 2 = 2, we are at trial 1).
    expect(pick(skill, session, ['a', 'b', 'c', 'd']).itemId).not.toBe('a');
    const step2 = recordTrial(skill, session, { itemId: 'b', firstTryCorrect: true, hinted: false }, meta, 'age5', TODAY);
    expect(pick(step2.skill, step2.session, ['a', 'b', 'c', 'd']).itemId).toBe('a');
  });

  it('a served retry leaves the queue once the item is answered', () => {
    const base = skillWith({ a: item(1), b: item(3) });
    const s1 = recordTrial(base, sessionWith(), { itemId: 'a', firstTryCorrect: false, hinted: false }, meta, 'age5', TODAY);
    expect(s1.session.retryQueue).toHaveLength(1);
    const s2 = recordTrial(s1.skill, s1.session, { itemId: 'a', firstTryCorrect: true, hinted: false }, meta, 'age5', TODAY);
    expect(s2.session.retryQueue).toHaveLength(0);
  });

  it('serves day-due items lowest box first; same-day items are not due', () => {
    const skill = skillWith({
      a: item(4, '2026-11-01'),
      b: item(3, '2026-11-09'),
      c: item(2, '2026-11-10'),
      fresh: item(1, TODAY),
    });
    const session = sessionWith({ knownSinceNew: 0, lastItemId: null });
    expect(pick(skill, session, ['a', 'b', 'c', 'fresh']).itemId).toBe('c');
    const noC = skillWith({ a: item(4, '2026-11-01'), b: item(3, '2026-11-09'), fresh: item(1, TODAY) });
    expect(pick(noC, session, ['a', 'b', 'fresh']).itemId).toBe('b');
    // Box 4 needs 4 days; seen 2 days ago is not due.
    const early = skillWith({ a: item(4, '2026-11-10'), b: item(4, TODAY) });
    const fromEarly = pick(early, sessionWith({ knownSinceNew: 0 }), ['a', 'b', 'new1']);
    expect(['a', 'b']).toContain(fromEarly.itemId);
  });
});

describe('new vs known', () => {
  it('serves a new item first when nothing has been seen', () => {
    expect(pick(skillWith({}), sessionWith(), ['a', 'b']).itemId).toMatch(/[ab]/);
  });

  it('introduces about 1 new item per 3 known', () => {
    let skill = skillWith({ k1: item(3), k2: item(3), k3: item(3) });
    let session = sessionWith();
    const random = seeded(5);
    const candidates = ['k1', 'k2', 'k3', 'n1', 'n2', 'n3'];
    const served: string[] = [];
    for (let i = 0; i < 12; i++) {
      const sel = selectNextItem(skill, session, candidates, meta, TODAY, random);
      served.push(sel.itemId);
      const step = recordTrial(sel.skill, session, { itemId: sel.itemId, firstTryCorrect: true, hinted: false }, meta, 'age5', TODAY);
      skill = step.skill;
      session = { ...step.session, changesInRound: 1 };
    }
    // The first three picks are known items, then a new one appears.
    expect(served.slice(0, 3).every((id) => id.startsWith('k'))).toBe(true);
    expect(served[3].startsWith('n')).toBe(true);
    const newCount = served.filter((id) => id.startsWith('n')).length;
    expect(newCount).toBeGreaterThanOrEqual(2);
    expect(newCount).toBeLessThanOrEqual(4);
  });
});

describe('guards', () => {
  it('never repeats the last item when alternatives exist', () => {
    const skill = skillWith({ a: item(3), b: item(3) });
    for (let seed = 1; seed < 30; seed++) {
      expect(pick(skill, sessionWith({ lastItemId: 'a' }), ['a', 'b'], seed).itemId).toBe('b');
    }
    expect(pick(skill, sessionWith({ lastItemId: 'a' }), ['a'], 1).itemId).toBe('a');
  });

  it('ignores stored items that are no longer in content and keeps them on disk', () => {
    const skill = skillWith({ gone: item(5), a: item(3) }, { afterDrop: true });
    const sel = pick(skill, sessionWith(), ['a', 'b']);
    expect(sel.itemId).toBe('a');
    expect(sel.skill.items.gone).toBeDefined();
  });

  it('is deterministic with a seeded random', () => {
    const skill = skillWith({ a: item(3), b: item(3), c: item(3) });
    const a = pick(skill, sessionWith(), ['a', 'b', 'c', 'd'], 9).itemId;
    const b = pick(skill, sessionWith(), ['a', 'b', 'c', 'd'], 9).itemId;
    expect(a).toBe(b);
  });

  it('throws on an empty candidate list', () => {
    expect(() => pick(skillWith({}), sessionWith(), [])).toThrow();
  });
});

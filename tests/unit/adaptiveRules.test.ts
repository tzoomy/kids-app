import { describe, expect, it } from 'vitest';
import {
  applyChange,
  buildMeta,
  classify,
  clampToTrack,
  DEFAULT_RULES,
  decideChange,
  endRound,
  initialSession,
  initialSkill,
  recordTrial,
  type AgeTrack,
  type GameLevelsMeta,
  type SkillSessionState,
  type SkillState,
} from '@/core/adaptive';

const TODAY = '2026-11-12';
const meta = buildMeta({
  levelCount: 5,
  tracks: { age2: { start: 1, max: 5 }, age5: { start: 4, max: 5 } },
});

type O = 'c' | 'a' | 'm';

/** Plays outcomes against the engine; every trial uses a fresh item id unless given. */
function play(
  seq: O[],
  opts: { track?: AgeTrack; meta?: GameLevelsMeta; skill?: SkillState; session?: SkillSessionState } = {},
) {
  const track = opts.track ?? 'age5';
  const m = opts.meta ?? meta;
  let skill = opts.skill ?? initialSkill(m, track, TODAY);
  let session = opts.session ?? initialSession();
  const changes: number[] = [];
  seq.forEach((o, i) => {
    const step = recordTrial(
      skill,
      session,
      { itemId: `i${i}`, firstTryCorrect: o !== 'm', hinted: o === 'a' },
      m,
      track,
      TODAY,
    );
    skill = step.skill;
    session = step.session;
    changes.push(step.change);
  });
  return { skill, session, changes };
}

describe('classify', () => {
  it('wrong first tap is a miss; correct after hint is assisted; otherwise clean', () => {
    expect(classify({ itemId: 'x', firstTryCorrect: false, hinted: false })).toBe('miss');
    expect(classify({ itemId: 'x', firstTryCorrect: false, hinted: true })).toBe('miss');
    expect(classify({ itemId: 'x', firstTryCorrect: true, hinted: true })).toBe('assisted');
    expect(classify({ itemId: 'x', firstTryCorrect: true, hinted: false })).toBe('clean');
  });
});

describe('initial state and meta', () => {
  it('starts at the track start level', () => {
    expect(initialSkill(meta, 'age2', TODAY).level).toBe(1);
    expect(initialSkill(meta, 'age5', TODAY).level).toBe(4);
  });

  it('merges content rule overrides onto the defaults', () => {
    const m = buildMeta({
      levelCount: 3,
      tracks: { age2: { start: 1, max: 3 }, age5: { start: 2, max: 3 } },
      rules: { downWindow: 2, upCleanStreak: undefined },
    });
    expect(m.rules).toEqual({ ...DEFAULT_RULES, downWindow: 2 });
    expect(m.tracks.age2.min).toBe(1);
  });
});

describe('level up', () => {
  it('3 clean in a row go up one level (age5, after-trial)', () => {
    const r = play(['c', 'c', 'c']);
    expect(r.skill.level).toBe(5);
    expect(r.changes).toEqual([0, 0, 1]);
  });

  it('an assisted trial breaks the streak but is not a miss', () => {
    const r = play(['c', 'c', 'a', 'c']);
    expect(r.skill.level).toBe(4);
    expect(r.skill.cleanStreak).toBe(1);
    expect(r.skill.recent).not.toContain('miss');
  });
});

describe('level down', () => {
  it('miss, hit, miss goes down (window 3)', () => {
    const r = play(['m', 'c', 'm']);
    expect(r.skill.level).toBe(3);
    expect(r.skill.afterDrop).toBe(true);
  });

  it('with downWindow 2 the same sequence does not drop, two consecutive misses do', () => {
    const strict = buildMeta({
      levelCount: 5,
      tracks: { age2: { start: 1, max: 5 }, age5: { start: 4, max: 5 } },
      rules: { downWindow: 2 },
    });
    expect(play(['m', 'c', 'm'], { meta: strict }).skill.level).toBe(4);
    expect(play(['m', 'm'], { meta: strict }).skill.level).toBe(3);
  });

  it('recent is cleared after a change, so there is no cascade', () => {
    const r = play(['m', 'm']);
    expect(r.skill.level).toBe(3);
    expect(r.skill.recent).toEqual([]);
    const next = play(['m'], { skill: r.skill, session: { ...r.session, changesInRound: 0 } });
    expect(next.skill.level).toBe(3);
  });

  it('a soft drop at the floor clears history and sets afterDrop', () => {
    const base = initialSkill(meta, 'age2', TODAY);
    const r = play(['m', 'm'], { track: 'age2', skill: base });
    // age2 defers to the round end, which has not happened yet after 2 trials.
    expect(r.skill.level).toBe(1);
    const closed = endRound(r.skill, r.session, meta, 'age2');
    expect(closed.skill.level).toBe(1);
    expect(closed.skill.afterDrop).toBe(true);
    expect(closed.skill.recent).toEqual([]);
  });
});

describe('change cap and timing', () => {
  it('after-trial: at most one change per round', () => {
    // Odd rules: a single clean goes up, a single miss goes down.
    const touchy = buildMeta({
      levelCount: 5,
      tracks: { age2: { start: 1, max: 5 }, age5: { start: 3, max: 5 } },
      rules: { upCleanStreak: 1, downMisses: 1, downWindow: 1, trialsPerRound: 3 },
    });
    const r = play(['c', 'c', 'c'], { meta: touchy });
    expect(r.changes).toEqual([1, 0, 0]);
    expect(r.skill.level).toBe(4);
  });

  it('the cap resets at the next round', () => {
    const touchy = buildMeta({
      levelCount: 5,
      tracks: { age2: { start: 1, max: 5 }, age5: { start: 1, max: 5 } },
      rules: { upCleanStreak: 1, trialsPerRound: 2 },
    });
    const r = play(['c', 'c', 'c', 'c'], { meta: touchy });
    expect(r.changes).toEqual([1, 0, 1, 0]);
    expect(r.skill.level).toBe(3);
  });

  it('between-rounds defers the change to the end of the round (age2)', () => {
    const r = play(['c', 'c', 'c'], { track: 'age2' });
    // The 3rd trial completes the round, so the change lands exactly then.
    expect(r.changes).toEqual([0, 0, 1]);
    expect(r.skill.level).toBe(2);

    const partial = play(['c', 'c'], { track: 'age2' });
    expect(partial.skill.level).toBe(1);
    const closed = endRound(partial.skill, partial.session, meta, 'age2');
    expect(closed.skill.level).toBe(1);
    expect(closed.session.trialsInRound).toBe(0);
  });

  it('age2 does not change level mid-round even when the down rule is met', () => {
    const r = play(['m', 'm'], { track: 'age2', skill: { ...initialSkill(meta, 'age2', TODAY), level: 3 } });
    expect(r.skill.level).toBe(3);
    const closed = endRound(r.skill, r.session, meta, 'age2');
    expect(closed.skill.level).toBe(2);
  });
});

describe('bounds', () => {
  it('up at the ceiling is a no-op and the streak keeps counting', () => {
    const top = { ...initialSkill(meta, 'age5', TODAY), level: 5 };
    const r = play(['c', 'c', 'c', 'c'], { skill: top });
    expect(r.skill.level).toBe(5);
    expect(r.skill.cleanStreak).toBe(4);
    expect(r.changes.every((c) => c === 0)).toBe(true);
  });

  it('down wins over up when both are true (custom rules)', () => {
    const odd = buildMeta({
      levelCount: 5,
      tracks: { age2: { start: 1, max: 5 }, age5: { start: 3, max: 5 } },
      rules: { upCleanStreak: 1, downMisses: 1, downWindow: 3 },
    });
    const skill: SkillState = {
      ...initialSkill(odd, 'age5', TODAY),
      recent: ['miss', 'clean'],
      cleanStreak: 1,
    };
    expect(decideChange(skill, odd)).toBe(-1);
  });

  it('applyChange never leaves the track range', () => {
    const s = { ...initialSkill(meta, 'age5', TODAY), level: 1 };
    expect(applyChange(s, -1, meta, 'age5').level).toBe(1);
    expect(applyChange({ ...s, level: 5 }, 1, meta, 'age5').level).toBe(5);
  });

  it('clampToTrack re-clamps when the age track changes', () => {
    const capped = buildMeta({
      levelCount: 5,
      tracks: { age2: { start: 1, max: 3 }, age5: { start: 4, min: 2, max: 5 } },
    });
    const high = { ...initialSkill(capped, 'age5', TODAY), level: 5 };
    expect(clampToTrack(high, capped, 'age2').level).toBe(3);
    const low = { ...initialSkill(capped, 'age2', TODAY), level: 1 };
    expect(clampToTrack(low, capped, 'age5').level).toBe(2);
  });
});

describe('item updates', () => {
  it('clean raises the box, miss resets to 1, assisted keeps it', () => {
    const base = initialSkill(meta, 'age5', TODAY);
    const run = (seq: O[]) => {
      let skill = base;
      let session = initialSession();
      for (const o of seq) {
        const step = recordTrial(skill, session, { itemId: 'apple', firstTryCorrect: o !== 'm', hinted: o === 'a' }, meta, 'age5', TODAY);
        skill = step.skill;
        session = { ...step.session, changesInRound: 1 }; // freeze level changes for this check
      }
      return skill.items.apple;
    };
    expect(run(['c', 'c']).box).toBe(3);
    expect(run(['c', 'c', 'a']).box).toBe(3);
    expect(run(['c', 'c', 'm']).box).toBe(1);
    expect(run(['c', 'c', 'c', 'c', 'c', 'c']).box).toBe(5);
    const item = run(['c', 'a', 'm']);
    expect(item.seen).toBe(3);
    expect(item.clean).toBe(1);
    expect(item.lastSeenDay).toBe(TODAY);
  });

  it('does not mutate its inputs', () => {
    const skill = initialSkill(meta, 'age5', TODAY);
    const session = initialSession();
    const frozenSkill = JSON.stringify(skill);
    const frozenSession = JSON.stringify(session);
    recordTrial(skill, session, { itemId: 'a', firstTryCorrect: false, hinted: false }, meta, 'age5', TODAY);
    expect(JSON.stringify(skill)).toBe(frozenSkill);
    expect(JSON.stringify(session)).toBe(frozenSession);
  });

  it('keeps only the last 8 outcomes', () => {
    const r = play(Array<O>(12).fill('a'));
    expect(r.skill.recent).toHaveLength(8);
  });
});

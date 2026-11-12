import { describe, expect, it } from 'vitest';
import {
  buildMeta,
  initialSession,
  initialSkill,
  recordTrial,
  trackPolicy,
  type AgeTrack,
  type TrialResult,
} from '@/core/adaptive';

const meta = buildMeta({ levelCount: 5, tracks: { age2: { start: 1, max: 5 }, age5: { start: 4, max: 5 } } });

describe('trackPolicy', () => {
  it('age2 is tap, between-rounds, and never uses response time', () => {
    expect(trackPolicy('age2')).toEqual({ interaction: 'tap', useResponseTime: false, levelChange: 'between-rounds' });
  });

  it('age5 changes level after each trial; response time is off in v1', () => {
    const p = trackPolicy('age5');
    expect(p.levelChange).toBe('after-trial');
    expect(p.useResponseTime).toBe(false);
    expect(p.interaction).toBe('drag');
  });
});

describe('response time is ignored in v1', () => {
  const outcomes: Array<[boolean, boolean]> = [
    [true, false], [true, false], [false, false], [true, true], [true, false], [true, false], [true, false], [false, false],
  ];

  function run(track: AgeTrack, rt: (i: number) => number | undefined) {
    let skill = initialSkill(meta, track, '2026-11-12');
    let session = initialSession();
    outcomes.forEach(([ok, hinted], i) => {
      const result: TrialResult = { itemId: `i${i % 4}`, firstTryCorrect: ok, hinted, rtMs: rt(i) };
      const step = recordTrial(skill, session, result, meta, track, '2026-11-12');
      skill = step.skill;
      session = step.session;
    });
    return { skill, session };
  }

  for (const track of ['age2', 'age5'] as const) {
    it(`${track}: identical outcomes with different rtMs give identical state`, () => {
      const fast = run(track, () => 200);
      const slow = run(track, () => 60_000);
      const none = run(track, () => undefined);
      expect(slow).toEqual(fast);
      expect(none).toEqual(fast);
    });
  }
});

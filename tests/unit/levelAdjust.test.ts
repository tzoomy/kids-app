import { describe, expect, it } from 'vitest';
import { adjustSkillLevel, buildMeta, initialSkill, resetSkill, shownLevel, type SkillState } from '@/core/adaptive';

const meta = buildMeta({
  levelCount: 8,
  tracks: { age2: { start: 2, min: 1, max: 4 }, age5: { start: 5, min: 3, max: 8 } },
});
const TODAY = '2026-11-23';
const used: SkillState = {
  level: 6,
  cleanStreak: 2,
  recent: ['clean', 'miss'],
  afterDrop: true,
  lastPlayedDay: '2026-11-20',
  items: { apple: { box: 3, seen: 4, clean: 3, lastSeenDay: '2026-11-20' } },
};

describe('shownLevel', () => {
  it('shows the clamped stored level, or the effective start when unstarted', () => {
    expect(shownLevel(used, meta, 'age5', 'fr')).toBe(6);
    expect(shownLevel({ ...used, level: 20 }, meta, 'age5', 'fr')).toBe(8);
    expect(shownLevel(undefined, meta, 'age5', 'fr')).toBe(5);
    expect(shownLevel(undefined, meta, 'age5', 'fr', { startFrenchHigher: true })).toBe(6);
  });
});

describe('adjustSkillLevel', () => {
  it('steps a started skill by one and keeps its item history, but clears streak and recent', () => {
    const up = adjustSkillLevel(used, meta, 'age5', 'fr', {}, 1, TODAY);
    expect(up.level).toBe(7);
    expect(up.items).toEqual(used.items);
    expect(up.cleanStreak).toBe(0);
    expect(up.recent).toEqual([]);
  });

  it('is clamped at the track max and min (a no-op there)', () => {
    expect(adjustSkillLevel({ ...used, level: 8 }, meta, 'age5', 'fr', {}, 1, TODAY).level).toBe(8);
    expect(adjustSkillLevel({ ...used, level: 3 }, meta, 'age5', 'fr', {}, -1, TODAY).level).toBe(3);
  });

  it('age2 never goes above its max, whatever the prefs', () => {
    const prefs = { startFrenchHigher: true, difficulty: 'challenging' as const };
    expect(adjustSkillLevel({ ...used, level: 4 }, meta, 'age2', 'fr', prefs, 1, TODAY).level).toBe(4);
    expect(adjustSkillLevel(undefined, meta, 'age2', 'fr', prefs, 1, TODAY).level).toBe(3);
  });

  it('on an unstarted game persists clamp(effective start + delta)', () => {
    expect(adjustSkillLevel(undefined, meta, 'age5', 'en', {}, 1, TODAY).level).toBe(6);
    expect(adjustSkillLevel(undefined, meta, 'age5', 'fr', { difficulty: 'challenging' }, 1, TODAY).level).toBe(8);
    expect(adjustSkillLevel(undefined, meta, 'age5', 'en', {}, -1, TODAY).level).toBe(4);
  });
});

describe('resetSkill', () => {
  it('restores a fresh skill at the effective start with prefs applied, clearing items and streak', () => {
    const r = resetSkill(used, meta, 'age5', 'fr', { startFrenchHigher: true }, TODAY)!;
    expect(r).toEqual(initialSkill(meta, 'age5', TODAY, 6));
    expect(r.items).toEqual({});
    expect(r.cleanStreak).toBe(0);
  });

  it('is a no-op (undefined) for an unstarted game', () => {
    expect(resetSkill(undefined, meta, 'age5', 'fr', {}, TODAY)).toBeUndefined();
  });
});

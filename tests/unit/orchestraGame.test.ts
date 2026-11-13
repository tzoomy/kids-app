import { describe, it, expect } from 'vitest';
import { loadKitchenOrchestra, loadWorlds } from '../../src/content/loadContent';
import { KitchenOrchestraContentSchema } from '../../src/content/schema';
import { buildMeta, trackPolicy } from '../../src/core/adaptive';
import {
  buildSequence,
  buildTrial,
  checkEchoTap,
  instrumentsForChoiceCount,
  keepsGlowLit,
  noteGapMs,
  replaySpeed,
  showsVisualSupport,
} from '../../src/games/orchestra/orchestraGame';

describe('Kitchen Orchestra content and levels', () => {
  it('validates and belongs to Language House (reached through the game picker); Art Studio opens Sticker Board, not the orchestra', () => {
    const content = loadKitchenOrchestra();
    expect(content.id).toBe('kitchen-orchestra');
    expect(content.world).toBe('language-house');
    expect(content.instruments.length).toBe(5);
    const worlds = loadWorlds();
    const house = worlds.worlds.find((w) => w.id === 'language-house');
    expect(house?.status).toBe('open');
    expect(house?.earnsLeisure).toBe(true);
    const studio = worlds.worlds.find((w) => w.id === 'art-studio');
    expect(studio?.status).toBe('open');
    expect(studio?.entryGameId).toBe('sticker-board');
  });

  it('starts age 2 at a comfortable L1 and age 5 at a meaningfully harder L4', () => {
    const { adaptive } = loadKitchenOrchestra();
    expect(adaptive.levels).toHaveLength(8);
    expect(adaptive.tracks.age2.start).toBe(1);
    expect(adaptive.tracks.age2.min).toBe(1);
    expect(adaptive.tracks.age2.max).toBe(adaptive.levels.length);
    const l1 = adaptive.levels[0];
    expect(l1.sequenceLength).toBe(1);
    expect(l1.choiceCount).toBe(3);
    expect(l1.speed).toBe(0.8);
    expect(l1.support).toBe('lit');

    expect(adaptive.tracks.age5.start).toBe(4);
    expect(adaptive.tracks.age5.min).toBe(1);
    expect(adaptive.tracks.age5.max).toBe(adaptive.levels.length);
    const l4 = adaptive.levels[3];
    expect(l4.sequenceLength).toBe(3);
    expect(l4.choiceCount).toBe(4);
    expect(l4.sequenceLength).toBeGreaterThan(l1.sequenceLength!);
    expect(l4.choiceCount).toBeGreaterThan(l1.choiceCount!);
  });

  it('uses two perfect echoes to go up, matching the research exception for long trials', () => {
    const { adaptive } = loadKitchenOrchestra();
    const meta = buildMeta({
      levelCount: adaptive.levels.length,
      tracks: adaptive.tracks,
      rules: adaptive.rules,
    });
    expect(meta.rules.upCleanStreak).toBe(2);
    expect(meta.rules.downMisses).toBe(2);
    expect(meta.rules.downWindow).toBe(2);
  });

  it('never enables speed scoring on the age-2 track', () => {
    expect(trackPolicy('age2').useResponseTime).toBe(false);
    expect(trackPolicy('age2').interaction).toBe('tap');
    expect(trackPolicy('age2').levelChange).toBe('between-rounds');
  });

  it('rejects a level missing sequenceLength or with too many instruments', () => {
    const valid = JSON.parse(JSON.stringify(loadKitchenOrchestra())) as Record<string, unknown>;
    expect(KitchenOrchestraContentSchema.safeParse(valid).success).toBe(true);
    const broken = JSON.parse(JSON.stringify(valid));
    delete broken.adaptive.levels[0].sequenceLength;
    expect(KitchenOrchestraContentSchema.safeParse(broken).success).toBe(false);
    const tooMany = JSON.parse(JSON.stringify(valid));
    tooMany.adaptive.levels[0].choiceCount = 9;
    expect(KitchenOrchestraContentSchema.safeParse(tooMany).success).toBe(false);
  });
});

describe('echo sequences', () => {
  it('picks distinct big instruments at the age-2 start and more at the age-5 start', () => {
    expect(instrumentsForChoiceCount(3)).toEqual(['pot', 'pan', 'glass-mid']);
    expect(instrumentsForChoiceCount(4)).toHaveLength(4);
    expect(instrumentsForChoiceCount(5)).toHaveLength(5);
  });

  it('builds a sequence of the requested length from the instrument set', () => {
    let i = 0;
    const random = () => {
      const values = [0.1, 0.5, 0.9, 0.2, 0.7];
      return values[i++ % values.length]!;
    };
    const seq = buildSequence(['pot', 'pan', 'glass-mid'], 3, random);
    expect(seq).toHaveLength(3);
    expect(seq.every((id) => ['pot', 'pan', 'glass-mid'].includes(id))).toBe(true);
  });

  it('accepts a correct echo and flags a wrong tap as a miss', () => {
    const sequence = ['pot', 'pan', 'pot'] as const;
    expect(checkEchoTap(sequence, 0, 'pot')).toEqual({ kind: 'continue', nextIndex: 1 });
    expect(checkEchoTap(sequence, 1, 'pan')).toEqual({ kind: 'continue', nextIndex: 2 });
    expect(checkEchoTap(sequence, 2, 'pot')).toEqual({ kind: 'complete' });
    expect(checkEchoTap(sequence, 1, 'pot')).toEqual({ kind: 'miss' });
  });

  it('slows a miss-replay by 25% and lights the pattern even on audio-only levels', () => {
    expect(replaySpeed(1.2)).toBeCloseTo(0.9);
    expect(noteGapMs(0.8)).toBeGreaterThan(noteGapMs(1));
    expect(showsVisualSupport('lit')).toBe(true);
    expect(showsVisualSupport('flash')).toBe(true);
    expect(showsVisualSupport('audio-only')).toBe(false);
    expect(keepsGlowLit('lit')).toBe(true);
    expect(keepsGlowLit('flash')).toBe(false);
    const trial = buildTrial({ sequenceLength: 3, choiceCount: 4, speed: 1, support: 'lit' }, () => 0);
    expect(trial.sequence).toHaveLength(3);
    expect(trial.instruments).toHaveLength(4);
  });
});

import { describe, expect, it } from 'vitest';
import { disposePlantView } from '@/games/seedFlower/plantView';

describe('Seed to Flower plant view disposal (#65 review regression)', () => {
  it('[AC-03] kills the growth tweens of the old plant before destroying it', () => {
    const calls: string[] = [];
    const view = { destroy: () => calls.push('destroy') };
    const tweens = { killTweensOf: (t: object) => calls.push(t === view ? 'kill' : 'kill-other') };
    disposePlantView(tweens, view);
    expect(calls).toEqual(['kill', 'destroy']);
  });

  it('[AC-03] does nothing when there is no plant yet', () => {
    const calls: string[] = [];
    disposePlantView({ killTweensOf: () => calls.push('kill') }, undefined);
    expect(calls).toEqual([]);
  });
});

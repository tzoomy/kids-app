import { describe, expect, it } from 'vitest';
import { recordCompletedRound, createWardrobeState } from '@/core/wardrobe/model';

describe('sticker-board wardrobe hook', () => {
  it('[AC-03] the hair-bow unlock rule fires for a completed sticker-board round at age 5', () => {
    const result = recordCompletedRound(createWardrobeState(), 'age5', { worldId: 'art-studio', gameId: 'sticker-board' });
    expect(result.newlyUnlocked).toEqual(['hair-bow']);
    expect(result.state.unlocked).toContain('hair-bow');
  });
});

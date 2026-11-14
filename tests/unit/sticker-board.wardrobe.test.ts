import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { recordCompletedRound, createWardrobeState } from '@/core/wardrobe/model';

// The scene hook lives next to session.complete() (wardrobe AC-13 / WORLD_GAMES contract).
const SCENE = path.join('src', 'games', 'stickers', 'StickerBoardScene.ts');

describe('sticker-board wardrobe hook', () => {
  it('calls recordCompletedRound right after session.complete() for art-studio / sticker-board', () => {
    const src = fs.readFileSync(SCENE, 'utf8');
    expect(src).toMatch(
      /learningSession\?\.complete\(\);\s*this\.context\.recordCompletedRound\('art-studio', 'sticker-board'\)/,
    );
  });

  it('[AC-03] the hair-bow unlock rule fires for a completed sticker-board round at age 5', () => {
    const result = recordCompletedRound(createWardrobeState(), 'age5', { worldId: 'art-studio', gameId: 'sticker-board' });
    expect(result.newlyUnlocked).toEqual(['hair-bow']);
    expect(result.state.unlocked).toContain('hair-bow');
  });
});

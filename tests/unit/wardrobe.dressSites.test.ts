// Source contract for Wardrobe Pass 2 (docs/specs/wardrobe.md AC-17): every place that spawns a bear
// Character calls the shared dress helper, and the chef and the leisure scenes do not.
// Same style as tests/unit/wardrobe.roundHook.test.ts. RED until the call sites exist.
import { existsSync, readFileSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';

function read(rel: string): string {
  const abs = path.join(process.cwd(), rel);
  expect(existsSync(abs), `missing source ${rel}`).toBe(true);
  return readFileSync(abs, 'utf8');
}

const IMPORTS_DRESS = /from\s+'(?:\.\.\/)+core\/wardrobe\/dress'|from\s+'@\/core\/wardrobe\/dress'/;
const CALLS_DRESS = /\bdressCharacter\(/;
const READS_OUTFIT = /\bcurrentOutfitItems\(/;

/** Scenes that spawn a Character whose kind can be the bear. */
const BEAR_SCENES = [
  'src/worlds/MapScene.ts',
  'src/games/restaurant/RestaurantScene.ts',
  'src/games/hiding/HidingScene.ts',
];

/** Scenes whose Characters are never the bear (chef) or that draw no Character (leisure). */
const UNDRESSED_SCENES = [
  'src/games/orchestra/OrchestraScene.ts',
  'src/games/colouring/ColouringScene.ts',
  'src/games/bubbles/BubblesScene.ts',
];

describe('wardrobe dress call sites', () => {
  it.each(BEAR_SCENES)('[AC-17] %s dresses its bear through the shared helper (reads the profile outfit, then dressCharacter)', (rel) => {
    const src = read(rel);
    expect(src, `${rel} imports core/wardrobe/dress`).toMatch(IMPORTS_DRESS);
    expect(src, `${rel} calls dressCharacter`).toMatch(CALLS_DRESS);
    expect(src, `${rel} reads the current profile outfit`).toMatch(READS_OUTFIT);
  });

  it('[AC-17] the map has a bear mascot: MapScene spawns a Character of kind bear', () => {
    expect(read('src/worlds/MapScene.ts')).toMatch(/new Character\([^)]*kind:\s*'bear'/s);
  });

  it('[AC-17] the map mascot is not a second wardrobe entry: MapScene still opens the Wardrobe only from the HUD button', () => {
    const src = read('src/worlds/MapScene.ts');
    const opens = src.match(/transitionTo\([^)]*'WardrobeScene'/g) ?? [];
    expect(opens, 'one WardrobeScene transition (the HUD button)').toHaveLength(1);
    expect(src).toMatch(/onWardrobe/);
  });

  it.each(UNDRESSED_SCENES)('[AC-17] %s does not dress anything (chef and leisure stay as they are)', (rel) => {
    const src = read(rel);
    expect(src).not.toMatch(IMPORTS_DRESS);
    expect(src).not.toMatch(CALLS_DRESS);
  });

  it('[AC-17] the dress helper itself is Phaser-free at runtime (type-only imports allowed) and calls layoutOutfit', () => {
    const src = read('src/core/wardrobe/dress.ts');
    expect(src).toMatch(/\blayoutOutfit\b/);
    expect(src).not.toMatch(/^import\s+(?!type\b)[^;]*from\s+'phaser'/m);
  });
});

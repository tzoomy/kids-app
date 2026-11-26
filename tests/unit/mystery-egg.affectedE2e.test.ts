import { describe, expect, it } from 'vitest';
import { SMOKE_SPECS, selectAffectedE2e } from '../../scripts/affected-e2e.mjs';

const SPEC = 'tests/e2e/mystery-egg.journey.spec.ts';
const SHELL_SPEC = 'tests/e2e/game-shell.journey.spec.ts';

describe('mystery-egg affected e2e mapping', () => {
  it('[AC-16] the game folder, manifest, media folders and unit tests select the Mystery Egg and game shell journeys (and no other spec)', () => {
    for (const f of [
      'src/games/mysteryEgg/MysteryEggBuildScene.ts',
      'src/games/mysteryEgg/snap.ts',
      'src/games/mysteryEgg/progress.ts',
      'src/content/mysteryEggAssets.json',
      'public/art/mystery-egg/hub-bg.webp',
      'public/audio/mystery-egg/vo-fr-instruction.ogg',
      'tests/unit/mystery-egg.snap.test.ts',
      'tests/unit/mystery-egg.physics.test.ts',
      'tests/unit/game-shell.progress.test.ts',
      'src/games/mysteryEgg/MysteryEggScene.ts',
    ]) {
      expect([...selectAffectedE2e([f])].sort(), f).toEqual([SHELL_SPEC, SPEC]);
    }
  });

  it('[AC-16] a changed Mystery Egg or game shell spec selects itself', () => {
    expect(selectAffectedE2e([SPEC])).toContain(SPEC);
    expect(selectAffectedE2e([SHELL_SPEC])).toContain(SHELL_SPEC);
  });

  it('[AC-16] the shared map files (MapScene, hud) still select the smoke set, so the existing map keeps being tested', () => {
    for (const f of ['src/worlds/MapScene.ts', 'src/ui/hud.ts']) {
      const picked = selectAffectedE2e([f]);
      for (const s of SMOKE_SPECS) expect(picked, f).toContain(s);
    }
  });
});

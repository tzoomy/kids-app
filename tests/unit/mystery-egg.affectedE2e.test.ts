import { describe, expect, it } from 'vitest';
import { SMOKE_SPECS, selectAffectedE2e } from '../../scripts/affected-e2e.mjs';

const SPEC = 'tests/e2e/mystery-egg.journey.spec.ts';
const SHELL_SPEC = 'tests/e2e/game-shell.journey.spec.ts';
const NITS_SPEC = 'tests/e2e/game-shell.nits.spec.ts';
const L20_SPEC = 'tests/e2e/workshop-l20.spec.ts';
const ROUTE_SPEC = 'tests/e2e/preview-route.spec.ts';

describe('mystery-egg affected e2e mapping', () => {
  it('[AC-16] the game folder, manifest, media folders and unit tests select the Mystery Egg and game shell journeys, the shell nits spec and the Workshop L20 spec (and no other spec)', () => {
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
      expect([...selectAffectedE2e([f])].sort(), f).toEqual([SHELL_SPEC, NITS_SPEC, SPEC, L20_SPEC, ROUTE_SPEC].sort());
    }
  });

  it('[AC-16] the Workshop L20 files (folder, manifest, preview route, unit tests) select the L20 spec, and a changed L20 spec selects itself', () => {
    for (const f of ['src/games/mysteryEgg/workshop/l20World.ts', 'src/content/workshopAssets.json', 'src/game/previewRoute.ts', 'tests/unit/workshop-l20.physics.test.ts']) {
      expect(selectAffectedE2e([f]), f).toContain(L20_SPEC);
    }
    expect(selectAffectedE2e([L20_SPEC])).toContain(L20_SPEC);
  });

  it('[AC-16] a changed Mystery Egg or game shell spec selects itself', () => {
    expect(selectAffectedE2e([SPEC])).toContain(SPEC);
    expect(selectAffectedE2e([SHELL_SPEC])).toContain(SHELL_SPEC);
    expect(selectAffectedE2e([NITS_SPEC])).toContain(NITS_SPEC);
  });

  it('[AC-16] the shared map files (MapScene, hud) still select the smoke set, so the existing map keeps being tested', () => {
    for (const f of ['src/worlds/MapScene.ts', 'src/ui/hud.ts']) {
      const picked = selectAffectedE2e([f]);
      for (const s of SMOKE_SPECS) expect(picked, f).toContain(s);
    }
  });
});

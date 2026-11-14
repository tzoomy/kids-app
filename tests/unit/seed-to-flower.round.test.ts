import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import { loadSeedToFlower, loadWhosHiding, loadWorlds } from '@/content/loadContent';
import { SeedToFlowerContentSchema } from '@/content/schema';
import type { StorageDriver } from '@/core/storage/store';
import { applyTool, createPlant, type PlantEvent, type PlantState, type Tool } from '@/games/seedFlower/seedFlowerMachine';
import { bloomFor, planForLevel, seedHeLine, speaksStage, stageLine, trialForGrowth } from '@/games/seedFlower/seedFlowerRound';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';
import { WORLD_GAMES } from '@/ui/picker/pickerModel';
import { collectTrailGames, stationGamesForWorld } from '@/ui/picker/trailModel';
import seedJson from '@/content/games/seed-to-flower.json';
import { resolvePickerAsset } from '@/ui/picker/pickerAssets';
import heStrings from '@/content/i18n/he.json';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const content = loadSeedToFlower();
const meta = buildMeta({ levelCount: content.adaptive.levels.length, tracks: content.adaptive.tracks, rules: content.adaptive.rules });

function make(track: 'age2' | 'age5') {
  return new SkillSession({
    store: new AdaptiveStore(memoryDriver()),
    profileId: 'p',
    track,
    world: content.world,
    gameId: content.id,
    meta,
    today: () => '2026-11-13',
    random: () => 0.3,
  });
}

/** Plays one plant at the session's level with the given tap script, recording each growth step like the scene. */
function playPlant(session: SkillSession, lang: 'en' | 'fr', taps: (state: PlantState) => Tool, hinted = false): PlantEvent[] {
  const plan = planForLevel(content.adaptive.levels[session.level(lang) - 1]);
  let plant = createPlant(plan.stages, plan.mode);
  const events: PlantEvent[] = [];
  for (let guard = 0; guard < 50 && plant.phase !== 'bloomed'; guard++) {
    const { state, event } = applyTool(plant, taps(plant));
    plant = state;
    events.push(event);
    if (event.kind === 'grew') session.record(lang, trialForGrowth(event, hinted));
  }
  expect(plant.phase).toBe('bloomed');
  return events;
}

const inOrder = (s: PlantState): Tool => (s.watered ? 'sun' : 'water');
/** Sun first in every step (out of order), then water and sun. */
const sunFirst = (s: PlantState): Tool => (s.stepOutOfOrder ? inOrder(s) : 'sun');

describe('Seed to Flower: levels, adaptive trials and content', () => {
  it('[AC-05] each growth step is one trial for the stage grown into; an out-of-order step is not clean; a hinted step is not clean', () => {
    expect(trialForGrowth({ kind: 'grew', from: 'seed', to: 'sprout', bloomed: false, stepOutOfOrder: false }, false)).toEqual({
      itemId: 'sprout',
      firstTryCorrect: true,
      hinted: false,
    });
    expect(trialForGrowth({ kind: 'grew', from: 'bud', to: 'flower', bloomed: true, stepOutOfOrder: true }, false).firstTryCorrect).toBe(false);
    expect(trialForGrowth({ kind: 'grew', from: 'seed', to: 'sprout', bloomed: false, stepOutOfOrder: false }, true).hinted).toBe(true);
  });

  it('[AC-05] age 5: a clean in-order plant at L4 levels up to L5; sun-first plants drop it back to a free level', () => {
    const session = make('age5');
    expect(session.level('en')).toBe(4);
    playPlant(session, 'en', inOrder);
    expect(session.level('en')).toBe(5);
    playPlant(session, 'en', sunFirst);
    expect(session.level('en')).toBe(4);
    playPlant(session, 'en', sunFirst);
    // The engine drops at most once per engine round; a second sun-first plant lands on a free level.
    expect(session.level('en')).toBeLessThanOrEqual(3);
    expect(planForLevel(content.adaptive.levels[session.level('en') - 1]).mode).toBe('free');
  });

  it('[AC-06] a new age-2 profile starts at L2 (free) and never leaves the free levels; a new age-5 profile starts at L4 (ordered)', () => {
    const age2 = make('age2');
    expect(age2.level('fr')).toBe(2);
    for (let i = 0; i < 6; i++) playPlant(age2, 'fr', () => 'sun');
    expect(age2.level('fr')).toBe(3);
    expect(planForLevel(content.adaptive.levels[age2.level('fr') - 1]).mode).toBe('free');
    expect(content.adaptive.levels.slice(0, content.adaptive.tracks.age2.max).every((l) => planForLevel(l).mode === 'free')).toBe(true);

    const age5 = make('age5');
    expect(age5.level('en')).toBe(4);
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      stages: ['seed', 'sprout', 'bud', 'flower'],
      mode: 'water-then-sun',
      naming: 'all',
      audioOnly: false,
    });
  });

  it('[AC-03] free levels grow one stage per tap with either tool', () => {
    const session = make('age2');
    const events = playPlant(session, 'en', (s) => (s.stageIndex % 2 === 0 ? 'sun' : 'water'));
    expect(events.map((e) => e.kind)).toEqual(['grew', 'grew', 'grew']);
  });

  it('[AC-07] content validates; every stage has EN and FR names; lines carry the round language', () => {
    expect(() => SeedToFlowerContentSchema.parse(seedJson)).not.toThrow();
    for (const stage of ['seed', 'sprout', 'bud', 'flower'] as const) {
      for (const lang of ['en', 'fr'] as const) {
        expect(content.stageNames[stage][lang].length).toBeGreaterThan(0);
        expect(stageLine(content, stage, lang)).toEqual({ lineId: `seed.stage.${stage}.${lang}`, lang, text: content.stageNames[stage][lang] });
      }
    }
    expect(seedHeLine(content, 'needWater')).toEqual({ lineId: 'seed.needWater.he', lang: 'he', text: content.linesHe.needWater });
    expect(seedHeLine(content, 'intro.ordered').lineId).toBe('seed.intro.ordered.he');
    expect(content.world).toBe('nature-lab');
    expect(loadWorlds().worlds.find((w) => w.id === 'nature-lab')?.status).toBe('open');
  });

  it('[AC-07] the round language follows the language setting', () => {
    expect(nextRoundLanguage(null, true, 'fr')).toBe('fr');
    expect(nextRoundLanguage(null, true, 'en')).toBe('en');
    expect(['en', 'fr']).toContain(nextRoundLanguage(null, true, 'both', () => 0.9));
  });

  it('[AC-07] rejects levels with a bad stage list, order or naming', () => {
    const bad = (extra: Record<string, string>) => ({
      ...seedJson,
      adaptive: { ...seedJson.adaptive, levels: [{ support: 'picture-audio', extra }] , tracks: { age2: { start: 1, min: 1, max: 1 }, age5: { start: 1, min: 1, max: 1 } } },
    });
    expect(() => SeedToFlowerContentSchema.parse(bad({ stages: 'sprout,flower', order: 'free', naming: 'all' }))).toThrow();
    expect(() => SeedToFlowerContentSchema.parse(bad({ stages: 'seed,flower,bud', order: 'free', naming: 'all' }))).toThrow();
    expect(() => SeedToFlowerContentSchema.parse(bad({ stages: 'seed,flower', order: 'sun-first', naming: 'all' }))).toThrow();
    expect(() => SeedToFlowerContentSchema.parse(bad({ stages: 'seed,flower', order: 'free', naming: 'some' }))).toThrow();
    expect(() => SeedToFlowerContentSchema.parse(bad({ stages: 'seed,flower', order: 'free', naming: 'bloom' }))).not.toThrow();
  });

  it('[AC-08] naming levels speak every stage; bloom levels speak only the flower', () => {
    const l2 = planForLevel(content.adaptive.levels[1]);
    const l4 = planForLevel(content.adaptive.levels[3]);
    expect(speaksStage(l2, 'sprout')).toBe(false);
    expect(speaksStage(l2, 'flower')).toBe(true);
    expect(speaksStage(l4, 'sprout')).toBe(true);
    expect(speaksStage(l4, 'bud')).toBe(true);
    // The seed is named at plant start on naming levels only.
    expect(speaksStage(l4, 'seed')).toBe(true);
    expect(speaksStage(l2, 'seed')).toBe(false);
  });

  it('[AC-01] the Nature Lab picker lists Who\'s Hiding? first and Seed to Flower second; bloom art cycles through existing blooms', () => {
    const natureLab = stationGamesForWorld('nature-lab', WORLD_GAMES, collectTrailGames({ hiding: loadWhosHiding(), seed: content }));
    expect(natureLab.map((g) => [g.gameId, g.testId, g.sceneKey])).toEqual([
      ['who-is-hiding', 'game-picker-who-is-hiding', 'HidingScene'],
      ['seed-to-flower', 'game-picker-seed-to-flower', 'SeedFlowerScene'],
    ]);
    for (const g of natureLab) {
      expect(() => resolvePickerAsset(g.assetKey)).not.toThrow();
      expect((heStrings.gamePicker as Record<string, string>)[g.labelKey]).toBeTruthy();
    }
    expect(heStrings.gamePicker.natureLabTitle).toBeTruthy();
    expect(bloomFor(content, 0)).toBe(content.blooms[0]);
    expect(bloomFor(content, content.blooms.length)).toBe(content.blooms[0]);
  });
});

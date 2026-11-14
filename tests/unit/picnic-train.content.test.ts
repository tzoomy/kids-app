// Picnic Train Pass 1, TDD step 1: content, level table, scaffolds and wiring (ACs 07, 09, 22, 27).
// Spec: docs/specs/picnic-train.md. The wiring tests stay red until the WORLD_GAMES entry (src/ui/picker/pickerModel.ts) exists.
import { readFileSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadBalloonPop, loadNumberBridge, loadPicnicTrain, loadSortingBeds, loadWorlds } from '@/content/loadContent';
import { PicnicTrainContentSchema } from '@/content/schema';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { PICKER_GAMES, WORLD_GAMES } from '@/ui/picker/pickerModel';
import { collectTrailGames, stationGamesForWorld } from '@/ui/picker/trailModel';
import { isSafeToApplyUpdate, type AppScreen } from '@/pwa/updatePolicy';
import { levelLevers } from '@/games/picnic/picnicLogic';

const content = loadPicnicTrain();
const TODAY = '2026-11-13';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function session(profileId: string, track: 'age2' | 'age5', store: AdaptiveStore): SkillSession {
  const { adaptive } = content;
  return new SkillSession({
    store,
    profileId,
    track,
    world: content.world,
    gameId: content.id,
    meta: buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    today: () => TODAY,
    random: () => 0.5,
  });
}

describe('picnic-train: start levels (AC-07)', () => {
  it('[AC-07] the tracks start at L2 (age 2) and L5 (age 5), min 1, max 8, in both languages', () => {
    expect(content.adaptive.tracks.age2).toEqual({ start: 2, min: 1, max: 8 });
    expect(content.adaptive.tracks.age5).toEqual({ start: 5, min: 1, max: 8 });
    expect(content.adaptive.levels).toHaveLength(8);
    const store = new AdaptiveStore(memoryDriver());
    const age2 = session('a', 'age2', store);
    const age5 = session('b', 'age5', store);
    for (const lang of ['en', 'fr']) {
      expect(age2.level(lang)).toBe(2);
      expect(age5.level(lang)).toBe(5);
    }
  });

  it('[AC-07] the age-5 start is meaningfully harder than the age-2 start (a new task, no scaffold, more passengers)', () => {
    const l2 = levelLevers(content.adaptive.levels[1]);
    const l5 = levelLevers(content.adaptive.levels[4]);
    expect(l2.task).toBe('one-each');
    expect(l5.task).toBe('load');
    expect(l5.scaffold).toBe('none');
    expect(l5.setSize).toBeGreaterThan(l2.setSize);
  });
});

describe('picnic-train: content and language (AC-09, AC-22)', () => {
  it('[AC-09] the game belongs to the Number Garden, speaks English and French, and uses the age-track hint modes of Sorting Beds', () => {
    expect(content.id).toBe('picnic-train');
    expect(content.world).toBe('number-garden');
    expect(content.languages).toEqual(['en', 'fr']);
    expect(content.ageTracks.age2).toEqual({ hintMode: 'demonstrate', hintDelayMs: 6000 });
    expect(content.ageTracks.age5).toEqual({ hintMode: 'repeat-then-demonstrate', hintDelayMs: 8000 });
  });

  it('[AC-09] one train is one round: trialsPerRound is 1 and the other rules are the engine defaults', () => {
    expect(content.adaptive.rules).toEqual({ trialsPerRound: 1 });
  });

  it('[AC-09] the level table follows the spec: size, task, layout and scaffold per level', () => {
    const table = content.adaptive.levels.map((l) => {
      const v = levelLevers(l);
      return [v.setSize, v.task, v.layout, v.scaffold];
    });
    expect(table).toEqual([
      [2, 'one-each', 'rows', 'outline'],
      [3, 'one-each', 'rows', 'outline'],
      [3, 'one-each', 'rows', 'symbol'],
      [4, 'load', 'rows', 'symbol'],
      [5, 'load', 'scattered', 'none'],
      [6, 'load', 'scattered', 'none'],
      [8, 'missing', 'scattered', 'none'],
      [10, 'missing', 'scattered', 'none'],
    ]);
  });

  it('[AC-09] load levels request "quantity" and missing levels request "two-step"', () => {
    for (const level of content.adaptive.levels) {
      const v = levelLevers(level);
      if (v.task === 'one-each') expect(level.request).toBeUndefined();
      if (v.task === 'load') expect(level.request).toBe('quantity');
      if (v.task === 'missing') expect(level.request).toBe('two-step');
    }
  });

  it('[AC-22] scaffolds per level: L1-L2 outline, L3-L4 symbol, L5-L8 none', () => {
    expect(content.adaptive.levels.map((l) => l.scaffold)).toEqual([
      'outline',
      'outline',
      'symbol',
      'symbol',
      'none',
      'none',
      'none',
      'none',
    ]);
  });

  it('[AC-22] content validation rejects unknown requests, scaffolds, tasks, layouts and sizes outside 2..10', () => {
    const base = JSON.parse(JSON.stringify(content)) as Record<string, unknown>;
    const withLevel0 = (patch: Record<string, unknown>) => {
      const copy = JSON.parse(JSON.stringify(base)) as { adaptive: { levels: Array<Record<string, unknown>> } };
      copy.adaptive.levels[0] = { ...copy.adaptive.levels[0], ...patch };
      return PicnicTrainContentSchema.safeParse(copy);
    };
    expect(PicnicTrainContentSchema.safeParse(base).success).toBe(true);
    expect(withLevel0({ request: 'riddle' }).success).toBe(false);
    expect(withLevel0({ scaffold: 'sparkles' }).success).toBe(false);
    expect(withLevel0({ setSize: 11 }).success).toBe(false);
    expect(withLevel0({ setSize: 1 }).success).toBe(false);
    expect(withLevel0({ extra: { task: 'juggle', layout: 'rows' } }).success).toBe(false);
    expect(withLevel0({ extra: { task: 'one-each', layout: 'diagonal' } }).success).toBe(false);
    expect(withLevel0({ extra: { layout: 'rows' } }).success).toBe(false);
    expect(withLevel0({ setSize: undefined }).success).toBe(false);
  });
});

describe('picnic-train: wiring (AC-27)', () => {
  it('[AC-27] picnic is an AppScreen and a waiting update is deferred while it is open', () => {
    const screen: AppScreen = 'picnic';
    expect(isSafeToApplyUpdate(screen)).toBe(false);
  });

  it('[AC-27] PicnicScene reports the picnic screen while it is open', () => {
    const source = readFileSync(resolve(process.cwd(), 'src/games/picnic/PicnicScene.ts'), 'utf8');
    expect(source).toMatch(/setAppScreen\(\s*'picnic'\s*\)/);
  });

  it('[AC-27] the Number Garden trail (WORLD_GAMES + content) lists Sorting Beds, Balloon Pop, Picnic Train, then Number Bridge; the Language House picker is unchanged', () => {
    const garden = stationGamesForWorld(
      'number-garden',
      WORLD_GAMES,
      collectTrailGames({ sorting: loadSortingBeds(), balloon: loadBalloonPop(), picnic: content, numberBridge: loadNumberBridge() }),
    );
    expect(garden.map((g) => g.testId)).toEqual(['game-picker-sorting-beds', 'game-picker-balloon-pop', 'game-picker-picnic-train', 'game-picker-number-bridge']);
    expect(garden.map((g) => g.sceneKey)).toEqual(['SortingScene', 'BalloonScene', 'PicnicScene', 'NumberBridgeScene']);
    expect(PICKER_GAMES.map((g) => g.testId)).toEqual([
      'game-picker-animal-restaurant',
      'game-picker-kitchen-orchestra',
      'game-picker-letter-monster',
    ]);
  });

  it('[AC-27] Picnic Train is one WORLD_GAMES registry entry and no per-world picker list exists', async () => {
    const entries = WORLD_GAMES.filter((g) => g.gameId === 'picnic-train');
    expect(entries).toHaveLength(1);
    expect(entries[0]).toMatchObject({ testId: 'game-picker-picnic-train', sceneKey: 'PicnicScene', labelKey: 'picnicTrain' });
    const model = (await import('@/ui/picker/pickerModel')) as Record<string, unknown>;
    expect(model.NUMBER_GARDEN_PICKER_GAMES).toBeUndefined();
  });

  it('[AC-27] PicnicScene records a completed Picnic Train round for the wardrobe unlock hook', () => {
    const src = readFileSync(resolve('src/games/picnic/PicnicScene.ts'), 'utf8');
    expect(src).toContain("recordCompletedRound('number-garden', 'picnic-train')");
  });

  it('[AC-27] the Number Garden stays open and earns leisure; Sorting Beds remains its entry game', () => {
    const garden = loadWorlds().worlds.find((w) => w.id === 'number-garden');
    expect(garden).toMatchObject({ status: 'open', earnsLeisure: true, entryGameId: 'sorting-beds' });
  });
});

import { describe, expect, it } from 'vitest';
import { buildMeta, type SkillState } from '../../src/core/adaptive';
import type { PickerGame } from '../../src/ui/picker/pickerModel';
import { WORLD_GAMES } from '../../src/ui/picker/pickerModel';
import {
  buildTrail,
  collectTrailGames,
  isGameCompleted,
  stationGamesForWorld,
  worldEntry,
  type TrailGame,
} from '../../src/ui/picker/trailModel';
import { resolvePickerAsset } from '../../src/ui/picker/pickerAssets';
import he from '../../src/content/i18n/he.json';
import {
  loadAnimalRestaurant,
  loadBalloonPop,
  loadKitchenOrchestra,
  loadLetterMonster,
  loadPicnicTrain,
  loadTravelSuitcase,
  loadPotionLab,
  loadSinkOrFloat,
  loadMagicMagnet,
  loadSeedToFlower,
  loadSortingBeds,
  loadWhoLivesHere,
  loadWhosHiding,
  loadWorlds,
} from '../../src/content/loadContent';
import { GAME_SCENE, PICKER_WORLD_DEFAULT_GAME, WORLD_ENTRY_GAME } from '../e2e/helpers/journey';

// Spec: docs/specs/station-trail.md. Pure model only (no DOM, no Phaser).

/** Every game content in the repo, as the app's content bundle holds it (world + adaptive metadata). */
const REAL_GAMES = collectTrailGames({
  restaurant: loadAnimalRestaurant(),
  orchestra: loadKitchenOrchestra(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  sorting: loadSortingBeds(),
  balloon: loadBalloonPop(),
  picnic: loadPicnicTrain(),
  hiding: loadWhosHiding(),
  seedToFlower: loadSeedToFlower(),
  whoLivesHere: loadWhoLivesHere(),
  potion: loadPotionLab(),
  sinkOrFloat: loadSinkOrFloat(),
  magicMagnet: loadMagicMagnet(),
});

const META = buildMeta({
  levelCount: 8,
  tracks: { age2: { start: 2, max: 8 }, age5: { start: 5, max: 8 } },
  rules: { trialsPerRound: 3 },
});

function skill(over: Partial<SkillState> = {}): SkillState {
  return { level: 2, cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: '2026-11-01', items: {}, ...over };
}

/** A skill that has `trials` recorded trials spread over items. */
function played(trials: number, over: Partial<SkillState> = {}): SkillState {
  const items: SkillState['items'] = {};
  for (let i = 0; i < trials; i++) items[`item-${i}`] = { box: 1, seen: 1, clean: 0, lastSeenDay: '2026-11-01' };
  return skill({ items, ...over });
}

function card(gameId: string): PickerGame {
  return {
    gameId: gameId as PickerGame['gameId'],
    testId: `game-picker-${gameId}`,
    sceneKey: 'X',
    assetKey: 'picker-card-animal-restaurant',
    labelKey: 'animalRestaurant',
  };
}

const REGISTRY = [card('alpha'), card('beta'), card('gamma')];
const GAMES: TrailGame[] = [
  { id: 'alpha', world: 'w1', meta: META },
  { id: 'beta', world: 'w1', meta: META },
  { id: 'gamma', world: 'w1', meta: META },
  { id: 'other', world: 'w2', meta: META },
];

function trail(skills: Record<string, SkillState>, track: 'age2' | 'age5' = 'age2', games = GAMES, registry = REGISTRY) {
  return buildTrail({ worldId: 'w1', registry, games, skills, track });
}

describe('station trail: star from progress', () => {
  it('[AC-02] a fresh game (no stored skill) is not completed', () => {
    expect(isGameCompleted({}, 'w1', 'alpha', META, 'age2')).toBe(false);
  });

  it('[AC-02] one full round of trials (trialsPerRound) completes the game', () => {
    expect(isGameCompleted({ 'w1.alpha.en': played(2) }, 'w1', 'alpha', META, 'age2')).toBe(false);
    expect(isGameCompleted({ 'w1.alpha.en': played(3) }, 'w1', 'alpha', META, 'age2')).toBe(true);
  });

  it('[AC-02] trials add up across languages', () => {
    const skills = { 'w1.alpha.en': played(2), 'w1.alpha.fr': played(1) };
    expect(isGameCompleted(skills, 'w1', 'alpha', META, 'age2')).toBe(true);
  });

  it('[AC-02] a level above the track start completes the game (seeded or earned), a level at or below does not', () => {
    expect(isGameCompleted({ 'w1.alpha.en': skill({ level: 3 }) }, 'w1', 'alpha', META, 'age2')).toBe(true);
    expect(isGameCompleted({ 'w1.alpha.en': skill({ level: 2 }) }, 'w1', 'alpha', META, 'age2')).toBe(false);
    // The same level 3 is below the age-5 start (5): the level is clamped to the track, so no star.
    expect(isGameCompleted({ 'w1.alpha.en': skill({ level: 3 }) }, 'w1', 'alpha', META, 'age5')).toBe(false);
    expect(isGameCompleted({ 'w1.alpha.en': skill({ level: 6 }) }, 'w1', 'alpha', META, 'age5')).toBe(true);
  });

  it('[AC-02] only this game and this world count: neighbours and look-alike ids are ignored', () => {
    const skills = {
      'w1.alphabet.en': played(5),
      'w2.alpha.en': played(5),
      'w1.beta.en': played(5),
    };
    expect(isGameCompleted(skills, 'w1', 'alpha', META, 'age2')).toBe(false);
  });

  it('[AC-02] a game without adaptive metadata is never completed', () => {
    expect(isGameCompleted({ 'w1.alpha.en': played(9) }, 'w1', 'alpha', undefined, 'age2')).toBe(false);
  });

  it('[AC-02] stations carry the star flag from the stored state', () => {
    const stations = trail({ 'w1.beta.en': played(3) });
    expect(stations.map((s) => s.completed)).toEqual([false, true, false]);
  });
});

describe('station trail: suggested next game', () => {
  it('[AC-04] fresh profile: the first station in trail order is suggested', () => {
    expect(trail({}).map((s) => s.suggested)).toEqual([true, false, false]);
  });

  it('[AC-04] the first uncompleted station is suggested, even when a later one is completed', () => {
    expect(trail({ 'w1.alpha.en': played(3) }).map((s) => s.suggested)).toEqual([false, true, false]);
    expect(trail({ 'w1.beta.en': played(3) }).map((s) => s.suggested)).toEqual([true, false, false]);
    expect(trail({ 'w1.alpha.en': played(3), 'w1.beta.en': played(3) }).map((s) => s.suggested)).toEqual([false, false, true]);
  });

  it('[AC-04] exactly one station is suggested', () => {
    const states: Record<string, SkillState>[] = [{}, { 'w1.alpha.en': played(3) }, { 'w1.gamma.en': played(3) }];
    for (const skills of states) {
      expect(trail(skills).filter((s) => s.suggested)).toHaveLength(1);
    }
  });

  it('[AC-05] all completed: the least recently played station is suggested', () => {
    const skills = {
      'w1.alpha.en': played(3, { lastPlayedDay: '2026-11-10' }),
      'w1.beta.en': played(3, { lastPlayedDay: '2026-11-03' }),
      'w1.gamma.en': played(3, { lastPlayedDay: '2026-11-12' }),
    };
    expect(trail(skills).map((s) => s.suggested)).toEqual([false, true, false]);
  });

  it('[AC-05] all completed with equal days: trail order breaks the tie (first station)', () => {
    const skills = {
      'w1.alpha.en': played(3, { lastPlayedDay: '2026-11-10' }),
      'w1.beta.en': played(3, { lastPlayedDay: '2026-11-10' }),
      'w1.gamma.en': played(3, { lastPlayedDay: '2026-11-10' }),
    };
    expect(trail(skills).map((s) => s.suggested)).toEqual([true, false, false]);
  });

  it('[AC-05] the latest day across languages is the game\'s last played day', () => {
    const skills = {
      'w1.alpha.en': played(3, { lastPlayedDay: '2026-11-01' }),
      'w1.alpha.fr': played(1, { lastPlayedDay: '2026-11-12' }),
      'w1.beta.en': played(3, { lastPlayedDay: '2026-11-05' }),
      'w1.gamma.en': played(3, { lastPlayedDay: '2026-11-06' }),
    };
    expect(trail(skills).map((s) => s.suggested)).toEqual([false, true, false]);
  });

  it('[AC-05] an empty trail suggests nothing and does not throw', () => {
    expect(buildTrail({ worldId: 'empty', registry: REGISTRY, games: GAMES, skills: {}, track: 'age2' })).toEqual([]);
  });
});

describe('station trail: no locks', () => {
  it('[AC-07] every station is enabled when fresh, partial, and complete', () => {
    const states: Record<string, SkillState>[] = [
      {},
      { 'w1.alpha.en': played(3) },
      { 'w1.alpha.en': played(3), 'w1.beta.en': played(3), 'w1.gamma.en': played(3) },
    ];
    for (const skills of states) {
      const stations = trail(skills);
      expect(stations).toHaveLength(3);
      expect(stations.every((s) => s.enabled === true)).toBe(true);
    }
  });
});

describe('station trail: data-driven station list', () => {
  it('[AC-09] stations are the registry games whose content is in the world, in registry order', () => {
    expect(stationGamesForWorld('w1', REGISTRY, GAMES).map((g) => g.gameId)).toEqual(['alpha', 'beta', 'gamma']);
    expect(stationGamesForWorld('w2', REGISTRY, GAMES)).toEqual([]);
  });

  it('[AC-09] adding a registry game plus its content to a world adds a station, with no trail change', () => {
    const registry = [...REGISTRY, card('delta')];
    const games = [...GAMES, { id: 'delta', world: 'w1', meta: META }];
    expect(trail({}, 'age2', games, registry).map((s) => s.game.gameId)).toEqual(['alpha', 'beta', 'gamma', 'delta']);
  });

  it('[AC-09] moving a game\'s content to another world moves its station', () => {
    const games = GAMES.map((g) => (g.id === 'beta' ? { ...g, world: 'w2' } : g));
    expect(trail({}, 'age2', games).map((s) => s.game.gameId)).toEqual(['alpha', 'gamma']);
    expect(buildTrail({ worldId: 'w2', registry: REGISTRY, games, skills: {}, track: 'age2' }).map((s) => s.game.gameId)).toEqual(['beta']);
  });

  it('[AC-09] a registry game without content is on no trail; content without a registry card is ignored', () => {
    const registry = [...REGISTRY, card('no-content')];
    expect(trail({}, 'age2', GAMES, registry).map((s) => s.game.gameId)).toEqual(['alpha', 'beta', 'gamma']);
    expect(trail({}, 'age2', [...GAMES, { id: 'no-card', world: 'w1', meta: META }]).map((s) => s.game.gameId)).toEqual(['alpha', 'beta', 'gamma']);
  });

  it('[AC-09] collectTrailGames reads id, world and adaptive metadata from any content object, skipping the rest', () => {
    const restaurant = loadAnimalRestaurant();
    const bundle = { worlds: { worlds: [] }, he: { a: 1 }, restaurant, orchestra: loadKitchenOrchestra() };
    const games = collectTrailGames(bundle);
    expect(games.map((g) => [g.id, g.world])).toEqual([
      ['animal-restaurant', 'language-house'],
      ['kitchen-orchestra', 'language-house'],
    ]);
    expect(games[0].meta?.levelCount).toBe(restaurant.adaptive.levels.length);
    expect(games[0].meta?.tracks.age2.start).toBe(restaurant.adaptive.tracks.age2.start);
  });

  it('[AC-09] the real registry and content give every world its post-main stations, in registry order', () => {
    const ids = (world: string) => stationGamesForWorld(world, WORLD_GAMES, REAL_GAMES).map((g) => g.gameId);
    expect(ids('language-house')).toEqual(['animal-restaurant', 'kitchen-orchestra', 'letter-monster', 'travel-suitcase']);
    expect(ids('number-garden')).toEqual(['sorting-beds', 'balloon-pop', 'picnic-train']);
    expect(ids('nature-lab')).toEqual(['who-is-hiding', 'seed-to-flower', 'who-lives-here']);
    expect(ids('science-world')).toEqual(['potion-lab', 'sink-or-float', 'magic-magnet']);
    expect(ids('art-studio')).toEqual([]);
    expect(ids('leisure-corner')).toEqual([]);
  });

  it('[AC-09] every content game of a world on the map is in the registry (no orphan content, no orphan card)', () => {
    const registered = new Set(WORLD_GAMES.map((g) => g.gameId));
    const worldIds = new Set(loadWorlds().worlds.map((w) => w.id));
    for (const game of REAL_GAMES) {
      // The leisure picker keeps its own list (LEISURE_PICKER_GAMES): leisure content is not a station.
      if (game.world === 'leisure-corner') continue;
      expect(worldIds.has(game.world), `${game.id} world`).toBe(true);
      expect(registered.has(game.id as PickerGame['gameId']), `${game.id} registry`).toBe(true);
    }
    for (const card of WORLD_GAMES) {
      expect(REAL_GAMES.some((g) => g.id === card.gameId), `${card.gameId} content`).toBe(true);
    }
  });

  it('[AC-09] the per-world picker lists are gone: WORLD_GAMES is the only registry of world games', async () => {
    const model = (await import('../../src/ui/picker/pickerModel')) as Record<string, unknown>;
    for (const name of ['NUMBER_GARDEN_PICKER_GAMES', 'NATURE_LAB_PICKER_GAMES', 'SCIENCE_WORLD_PICKER_GAMES']) {
      expect(model[name], name).toBeUndefined();
    }
  });

  it('[AC-09] every registry card has a unique id, test id and a Hebrew label', () => {
    expect(new Set(WORLD_GAMES.map((g) => g.gameId)).size).toBe(WORLD_GAMES.length);
    expect(new Set(WORLD_GAMES.map((g) => g.testId)).size).toBe(WORLD_GAMES.length);
    const labels = he.gamePicker as Record<string, string>;
    for (const card of WORLD_GAMES) {
      expect(card.testId).toBe(`game-picker-${card.gameId}`);
      expect(labels[card.labelKey], card.labelKey).toBeTruthy();
      expect(() => resolvePickerAsset(card.assetKey), card.assetKey).not.toThrow();
    }
  });

  it('[AC-09] the registry holds exactly the games whose scenes exist, each added with its own PR (Picnic Train is the third Number Garden station)', () => {
    expect(WORLD_GAMES.map((g) => [g.gameId, g.sceneKey])).toEqual([
      ['animal-restaurant', 'RestaurantScene'],
      ['kitchen-orchestra', 'OrchestraScene'],
      ['letter-monster', 'LetterMonsterScene'],
      ['sorting-beds', 'SortingScene'],
      ['balloon-pop', 'BalloonScene'],
      ['picnic-train', 'PicnicScene'],
      ['who-is-hiding', 'HidingScene'],
      ['seed-to-flower', 'SeedFlowerScene'],
      ['who-lives-here', 'HabitatScene'],
      ['potion-lab', 'PotionScene'],
      ['sink-or-float', 'SinkFloatScene'],
      ['magic-magnet', 'MagnetScene'],
      ['travel-suitcase', 'SuitcaseScene'],
    ]);
  });
});

describe('station trail: world entry rule', () => {
  it('[AC-10] no stations: no entry; one station: direct entry; two or more: the trail picker', () => {
    expect(worldEntry([])).toEqual({ kind: 'none' });
    const one = trail({}).slice(0, 1);
    expect(worldEntry(one)).toEqual({ kind: 'direct', game: one[0].game });
    const three = trail({});
    expect(worldEntry(three)).toEqual({ kind: 'picker', stations: three });
  });

  it('[AC-10] the real worlds: Language House 4, Number Garden 3, Nature Lab 3 and Science World 3 open the trail; a world with no game is none', () => {
    const entryOf = (world: string) =>
      worldEntry(buildTrail({ worldId: world, registry: WORLD_GAMES, games: REAL_GAMES, skills: {}, track: 'age5' }));
    for (const world of ['language-house', 'number-garden', 'nature-lab', 'science-world']) {
      expect(entryOf(world).kind, world).toBe('picker');
    }
    // Pending Maor decision: a world with no game yet (zero stations) still opens the coming-soon picker.
    expect(entryOf('art-studio').kind).toBe('none');
  });

  it('[AC-10] the e2e journey helper agrees with the registry: trail worlds are picker worlds, one-game worlds are direct-entry worlds', () => {
    for (const world of loadWorlds().worlds.filter((w) => w.status === 'open')) {
      const stations = stationGamesForWorld(world.id, WORLD_GAMES, REAL_GAMES);
      if (stations.length >= 2) {
        expect(PICKER_WORLD_DEFAULT_GAME[world.id], `${world.id} picker default`).toBe(stations[0].gameId);
        expect(WORLD_ENTRY_GAME[world.id], `${world.id} entry`).toBeUndefined();
      } else if (stations.length === 1) {
        expect(PICKER_WORLD_DEFAULT_GAME[world.id], `${world.id} picker default`).toBeUndefined();
        expect(WORLD_ENTRY_GAME[world.id], `${world.id} entry`).toBe(stations[0].gameId);
      }
    }
    for (const card of WORLD_GAMES) expect(GAME_SCENE[card.gameId], card.gameId).toBe(card.sceneKey);
  });
});

describe('station trail: same for both ages, per profile', () => {
  it('[AC-12] age 2 and age 5 use the same rules; the age track only changes the start level that counts', () => {
    const skills = { 'w1.alpha.en': skill({ level: 3 }) };
    expect(trail(skills, 'age2').map((s) => s.completed)).toEqual([true, false, false]);
    expect(trail(skills, 'age5').map((s) => s.completed)).toEqual([false, false, false]);
    expect(trail({}, 'age2').map((s) => s.suggested)).toEqual(trail({}, 'age5').map((s) => s.suggested));
  });

  it('[AC-12] each profile\'s own skills drive its own trail (no shared state)', () => {
    const profileA = { 'w1.alpha.en': played(3) };
    const profileB = {};
    expect(trail(profileA).map((s) => s.suggested)).toEqual([false, true, false]);
    expect(trail(profileB).map((s) => s.suggested)).toEqual([true, false, false]);
  });
});

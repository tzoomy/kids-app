// Lazy scene registry (docs/ARCHITECTURE.md, "Code splitting"). Every game scene is its own chunk: it is fetched
// with import() and added to the Phaser game the first time it is about to start. MapScene and PreloadScene stay in
// the engine chunk (src/game/createGame.ts) and are not listed here.
// To add a game: add one loader line here (key = the scene's Phaser key, usually PickerGame.sceneKey).
// Keep each loader on ONE line: tests/unit/codeSplit.loaders.test.ts parses this file.
import type Phaser from 'phaser';

type SceneLoader = () => Promise<Phaser.Types.Scenes.SceneType>;

export const SCENE_LOADERS: Readonly<Record<string, SceneLoader>> = {
  RestaurantScene: () => import('../games/restaurant/RestaurantScene').then((m) => m.RestaurantScene),
  OrchestraScene: () => import('../games/orchestra/OrchestraScene').then((m) => m.OrchestraScene),
  LetterMonsterScene: () => import('../games/letterMonster/LetterMonsterScene').then((m) => m.LetterMonsterScene),
  SuitcaseScene: () => import('../games/travelSuitcase/SuitcaseScene').then((m) => m.SuitcaseScene),
  SortingScene: () => import('../games/sorting/SortingScene').then((m) => m.SortingScene),
  BalloonScene: () => import('../games/balloon/BalloonScene').then((m) => m.BalloonScene),
  PicnicScene: () => import('../games/picnic/PicnicScene').then((m) => m.PicnicScene),
  HidingScene: () => import('../games/hiding/HidingScene').then((m) => m.HidingScene),
  SeedFlowerScene: () => import('../games/seedFlower/SeedFlowerScene').then((m) => m.SeedFlowerScene),
  HabitatScene: () => import('../games/habitat/HabitatScene').then((m) => m.HabitatScene),
  ShadowScene: () => import('../games/hiding/ShadowScene').then((m) => m.ShadowScene),
  PotionScene: () => import('../games/potionLab/PotionScene').then((m) => m.PotionScene),
  SinkFloatScene: () => import('../games/sinkFloat/SinkFloatScene').then((m) => m.SinkFloatScene),
  MagnetScene: () => import('../games/magicMagnet/MagnetScene').then((m) => m.MagnetScene),
  BubblesScene: () => import('../games/bubbles/BubblesScene').then((m) => m.BubblesScene),
  ColouringScene: () => import('../games/colouring/ColouringScene').then((m) => m.ColouringScene),
  WardrobeScene: () => import('../games/wardrobe/WardrobeScene').then((m) => m.WardrobeScene),
};

const inFlight = new WeakMap<Phaser.Game, Map<string, Promise<void>>>();

/**
 * Makes sure scene `key` is added to `game` (inactive). Returns null when it is already there (synchronous path:
 * MapScene, PreloadScene, or a scene loaded earlier), otherwise a promise that resolves once the scene is added.
 * The promise is cached per game and key, so concurrent callers share one import and one `scene.add`.
 * A failed import is not cached, so the next attempt retries.
 */
export function ensureSceneLoaded(game: Phaser.Game, key: string): Promise<void> | null {
  if (game.scene.getScene(key)) return null;
  let perGame = inFlight.get(game);
  if (!perGame) {
    perGame = new Map();
    inFlight.set(game, perGame);
  }
  const cached = perGame.get(key);
  if (cached) return cached;

  const load = SCENE_LOADERS[key];
  if (!load) return Promise.reject(new Error(`No scene loader registered for "${key}" (src/game/sceneLoaders.ts)`));
  const games = perGame;
  const promise = load().then(
    (sceneClass) => {
      games.delete(key);
      if (!game.scene.getScene(key)) game.scene.add(key, sceneClass, false);
    },
    (err: unknown) => {
      games.delete(key);
      throw err;
    },
  );
  games.set(key, promise);
  return promise;
}

/** Loads (if needed) and then starts scene `key`. Used by createGame hooks. */
export function startSceneLazily(game: Phaser.Game, key: string, data?: object): void {
  const start = (): void => {
    game.scene.start(key, data);
  };
  const pending = ensureSceneLoaded(game, key);
  if (!pending) {
    start();
    return;
  }
  pending.then(start, (err: unknown) => console.error(`Could not load scene ${key}`, err));
}

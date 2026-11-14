/** Pure data model of the game pickers: the world game registry (station trail) and the Leisure Corner list (no DOM, no Phaser). */

export type PickerGameId =
  | 'animal-restaurant'
  | 'kitchen-orchestra'
  | 'letter-monster'
  | 'travel-suitcase'
  | 'sorting-beds'
  | 'balloon-pop'
  | 'who-is-hiding'
  | 'seed-to-flower'
  | 'who-lives-here'
  | 'potion-lab'
  | 'sink-or-float'
  | 'magic-magnet'
  | 'bubbles'
  | 'leisure-colouring';

export interface PickerGame {
  gameId: PickerGameId;
  /** `data-testid` of the card. */
  testId: string;
  /** Phaser scene started by the card. */
  sceneKey: string;
  /** Art asset key of the card picture (see pickerAssets.ts). */
  assetKey: string;
  /** Key of the Hebrew card label in `he.json` under `gamePicker`. */
  labelKey: 'animalRestaurant' | 'kitchenOrchestra' | 'letterMonster' | 'travelSuitcase' | 'sortingBeds' | 'balloonPop' | 'whoIsHiding' | 'seedToFlower' | 'whoLivesHere' | 'potionLab' | 'sinkOrFloat' | 'magicMagnet' | 'bubbles' | 'colouring';
}

/**
 * Cards in DOM order. Under `dir="rtl"` the first card is on the right in landscape
 * and on top in portrait, so the restaurant (the original game) comes first.
 *
 * These are the Language House games, the default cards of `renderGamePicker`. Every world's trail (Language House
 * included) is built from `WORLD_GAMES` below.
 */
export const PICKER_GAMES: readonly PickerGame[] = [
  {
    gameId: 'animal-restaurant',
    testId: 'game-picker-animal-restaurant',
    sceneKey: 'RestaurantScene',
    assetKey: 'picker-card-animal-restaurant',
    labelKey: 'animalRestaurant',
  },
  {
    gameId: 'kitchen-orchestra',
    testId: 'game-picker-kitchen-orchestra',
    sceneKey: 'OrchestraScene',
    assetKey: 'picker-card-kitchen-orchestra',
    labelKey: 'kitchenOrchestra',
  },
  {
    gameId: 'letter-monster',
    testId: 'game-picker-letter-monster',
    sceneKey: 'LetterMonsterScene',
    assetKey: 'picker-card-letter-monster',
    labelKey: 'letterMonster',
  },
];

/**
 * Registry of every world game that can be a station (docs/specs/station-trail.md), the only list of world games:
 * `MapScene` has no per-world list or branch. The WORLD of a game is not stored here: it comes from the game's
 * content JSON (`"world": "<id>"`), which the trail reads. (Some content schemas still pin `world` to one literal
 * in `src/content/schema.ts`; moving such a game to another world also means relaxing that schema.)
 * To add a game: append one entry here (scene, card art key, label key), ship its content JSON with
 * `"world": "<id>"`, add its Hebrew label under `gamePicker` in `he.json` and a card placeholder in
 * `pickerAssets.ts`; its station then appears with no trail or `MapScene` change. Trail order = array order, so a
 * world's first game here is its first station. Only games whose scene is on main belong here.
 */
export const WORLD_GAMES: readonly PickerGame[] = [
  ...PICKER_GAMES,
  // Number Garden.
  {
    gameId: 'sorting-beds',
    testId: 'game-picker-sorting-beds',
    sceneKey: 'SortingScene',
    assetKey: 'picker-card-sorting-beds',
    labelKey: 'sortingBeds',
  },
  {
    gameId: 'balloon-pop',
    testId: 'game-picker-balloon-pop',
    sceneKey: 'BalloonScene',
    assetKey: 'picker-card-balloon-pop',
    labelKey: 'balloonPop',
  },
  // Nature Lab.
  {
    gameId: 'who-is-hiding',
    testId: 'game-picker-who-is-hiding',
    sceneKey: 'HidingScene',
    assetKey: 'picker-card-who-is-hiding',
    labelKey: 'whoIsHiding',
  },
  {
    gameId: 'seed-to-flower',
    testId: 'game-picker-seed-to-flower',
    sceneKey: 'SeedFlowerScene',
    assetKey: 'picker-card-seed-to-flower',
    labelKey: 'seedToFlower',
  },
  {
    gameId: 'who-lives-here',
    testId: 'game-picker-who-lives-here',
    sceneKey: 'HabitatScene',
    assetKey: 'picker-card-who-lives-here',
    labelKey: 'whoLivesHere',
  },
  // Science World.
  {
    gameId: 'potion-lab',
    testId: 'game-picker-potion-lab',
    sceneKey: 'PotionScene',
    assetKey: 'picker-card-potion-lab',
    labelKey: 'potionLab',
  },
  {
    gameId: 'sink-or-float',
    testId: 'game-picker-sink-or-float',
    sceneKey: 'SinkFloatScene',
    assetKey: 'picker-card-sink-or-float',
    labelKey: 'sinkOrFloat',
  },
  {
    gameId: 'magic-magnet',
    testId: 'game-picker-magic-magnet',
    sceneKey: 'MagnetScene',
    assetKey: 'picker-card-magic-magnet',
    labelKey: 'magicMagnet',
  },
  // Language House (appended; keep main's earlier Language House order and default).
  {
    gameId: 'travel-suitcase',
    testId: 'game-picker-travel-suitcase',
    sceneKey: 'SuitcaseScene',
    assetKey: 'picker-card-travel-suitcase',
    labelKey: 'travelSuitcase',
  },
];

export const PICKER_CLOSE_TEST_ID = 'game-picker-close';

export const STATION_TRAIL_TEST_ID = 'station-trail';
export const stationStarTestId = (gameId: string): string => `station-star-${gameId}`;
export const stationPulseTestId = (gameId: string): string => `station-pulse-${gameId}`;

/** `data-testid` of the empty-state message of a picker with no games yet. */
export const PICKER_EMPTY_TEST_ID = 'game-picker-empty';

/** Leisure Corner picker: two cards (Bubbles first, then Colouring Time). Opened only with a balance above 0. */
export const LEISURE_PICKER_GAMES: readonly PickerGame[] = [
  {
    gameId: 'bubbles',
    testId: 'game-picker-bubbles',
    sceneKey: 'BubblesScene',
    assetKey: 'picker-card-bubbles',
    labelKey: 'bubbles',
  },
  {
    gameId: 'leisure-colouring',
    testId: 'game-picker-leisure-colouring',
    sceneKey: 'ColouringScene',
    assetKey: 'picker-card-colouring',
    labelKey: 'colouring',
  },
];

/** Pure data model of the Language House game picker (no DOM, no Phaser). */

export type PickerGameId =
  | 'animal-restaurant'
  | 'kitchen-orchestra'
  | 'letter-monster'
  | 'sorting-beds'
  | 'balloon-pop'
  | 'who-is-hiding'
  | 'seed-to-flower'
  | 'potion-lab'
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
  labelKey: 'animalRestaurant' | 'kitchenOrchestra' | 'letterMonster' | 'sortingBeds' | 'balloonPop' | 'whoIsHiding' | 'seedToFlower' | 'potionLab' | 'bubbles' | 'colouring';
}

/**
 * Cards in DOM order. Under `dir="rtl"` the first card is on the right in landscape
 * and on top in portrait, so the restaurant (the original game) comes first.
 *
 * This is the original Language House pair, kept as-is. The world trails are built from `WORLD_GAMES` below.
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
 * Registry of every world game that can be a station (docs/specs/station-trail.md). The WORLD of a game is not
 * stored here: it comes from the game's content JSON (`"world": "<id>"`), so a game moves between worlds by
 * editing its content only. To add a game to a world: append one entry here (scene, card art key, label key) and
 * ship its content JSON; its station then appears with no trail change. Trail order = array order.
 */
export const WORLD_GAMES: readonly PickerGame[] = [
  ...PICKER_GAMES,
  {
    gameId: 'sorting-beds',
    testId: 'game-picker-sorting-beds',
    sceneKey: 'SortingScene',
    assetKey: 'picker-card-sorting-beds',
    labelKey: 'sortingBeds',
  },
  {
    gameId: 'who-is-hiding',
    testId: 'game-picker-who-is-hiding',
    sceneKey: 'HidingScene',
    assetKey: 'picker-card-who-is-hiding',
    labelKey: 'whoIsHiding',
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

/** Number Garden picker: Sorting Beds (the original game) first, then Balloon Pop (docs/specs/balloon-pop.md). */
export const NUMBER_GARDEN_PICKER_GAMES: readonly PickerGame[] = [
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
];

/**
 * Science World picker (separate map area, pending owner decision; docs/PENDING-DECISIONS.md).
 * Potion Lab is the default entry game. Append later games here (additive registry), e.g. Sink or Float, Magic Magnet.
 */
export const SCIENCE_WORLD_PICKER_GAMES: readonly PickerGame[] = [
  {
    gameId: 'potion-lab',
    testId: 'game-picker-potion-lab',
    sceneKey: 'PotionScene',
    assetKey: 'picker-card-potion-lab',
    labelKey: 'potionLab',
  },
];

/**
 * Nature Lab picker (docs/specs/seed-to-flower.md): Who's Hiding? (the entry game) first, then Seed to Flower.
 * Append later Nature Lab games here (additive registry).
 */
export const NATURE_LAB_PICKER_GAMES: readonly PickerGame[] = [
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
];

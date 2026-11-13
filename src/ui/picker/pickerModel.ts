/** Pure data model of the Language House game picker (no DOM, no Phaser). */

export type PickerGameId =
  | 'animal-restaurant'
  | 'kitchen-orchestra'
  | 'sorting-beds'
  | 'who-is-hiding'
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
  labelKey: 'animalRestaurant' | 'kitchenOrchestra' | 'sortingBeds' | 'whoIsHiding' | 'bubbles' | 'colouring';
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

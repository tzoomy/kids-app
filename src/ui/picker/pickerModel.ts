/** Pure data model of the Language House game picker (no DOM, no Phaser). */

export type PickerGameId = 'animal-restaurant' | 'kitchen-orchestra' | 'bubbles' | 'leisure-colouring' | 'sorting-beds' | 'balloon-pop';

export interface PickerGame {
  gameId: PickerGameId;
  /** `data-testid` of the card. */
  testId: string;
  /** Phaser scene started by the card. */
  sceneKey: string;
  /** Art asset key of the card picture (see pickerAssets.ts). */
  assetKey: string;
  /** Key of the Hebrew card label in `he.json` under `gamePicker`. */
  labelKey: 'animalRestaurant' | 'kitchenOrchestra' | 'bubbles' | 'colouring' | 'sortingBeds' | 'balloonPop';
}

/**
 * Cards in DOM order. Under `dir="rtl"` the first card is on the right in landscape
 * and on top in portrait, so the restaurant (the original game) comes first.
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

export const PICKER_CLOSE_TEST_ID = 'game-picker-close';

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

/** Pure data model of the Language House game picker (no DOM, no Phaser). */

export type PickerGameId = 'animal-restaurant' | 'kitchen-orchestra' | 'bubbles' | 'leisure-colouring' | 'who-is-hiding' | 'seed-to-flower';

export interface PickerGame {
  gameId: PickerGameId;
  /** `data-testid` of the card. */
  testId: string;
  /** Phaser scene started by the card. */
  sceneKey: string;
  /** Art asset key of the card picture (see pickerAssets.ts). */
  assetKey: string;
  /** Key of the Hebrew card label in `he.json` under `gamePicker`. */
  labelKey: 'animalRestaurant' | 'kitchenOrchestra' | 'bubbles' | 'colouring' | 'whoIsHiding' | 'seedToFlower';
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

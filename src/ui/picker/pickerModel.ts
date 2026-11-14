/** Pure data model of the Language House game picker (no DOM, no Phaser). */

export type PickerGameId = 'animal-restaurant' | 'kitchen-orchestra' | 'bubbles' | 'leisure-colouring' | 'sink-or-float' | 'who-is-hiding' | 'seed-to-flower';

export interface PickerGame {
  gameId: PickerGameId;
  /** `data-testid` of the card. */
  testId: string;
  /** Phaser scene started by the card. */
  sceneKey: string;
  /** Art asset key of the card picture (see pickerAssets.ts). */
  assetKey: string;
  /** Key of the Hebrew card label in `he.json` under `gamePicker`. */
  labelKey: 'animalRestaurant' | 'kitchenOrchestra' | 'bubbles' | 'colouring' | 'sinkOrFloat' | 'whoIsHiding' | 'seedToFlower';
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

/**
 * Science World picker (separate map area, pending owner decision; docs/PENDING-DECISIONS.md).
 * Empty until its games land: the building then opens the picker's gentle "coming soon" state.
 * Append games here (additive registry), e.g. Potion Lab, Sink or Float, Magic Magnet:
 *   { gameId: 'potion-lab', testId: 'game-picker-potion-lab', sceneKey: 'PotionScene', assetKey: 'picker-card-potion-lab', labelKey: 'potionLab' }
 * (extend PickerGameId and labelKey, add the he.json label and a pickerAssets placeholder).
 */
export const SCIENCE_WORLD_PICKER_GAMES: readonly PickerGame[] = [
  {
    gameId: 'sink-or-float',
    testId: 'game-picker-sink-or-float',
    sceneKey: 'SinkFloatScene',
    assetKey: 'picker-card-sink-or-float',
    labelKey: 'sinkOrFloat',
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

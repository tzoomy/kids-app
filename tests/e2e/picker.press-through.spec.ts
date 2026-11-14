// Table-driven press-through regression suite for DOM game pickers (src/ui/picker/gamePicker.ts).
// Add a row to PICKER_PRESS_THROUGH_CASES when introducing a new picker-hosted world; new cards appended
// to PICKER_GAMES or NATURE_LAB_PICKER_GAMES are picked up automatically.
import { test } from '@playwright/test';
import { NATURE_LAB_PICKER_GAMES, PICKER_GAMES } from '../../src/ui/picker/pickerModel';
import {
  expectPickerPressDoesNotReachMap,
  type PickerPressThroughOptions,
} from './helpers/pickerPressThrough';

export const PICKER_PRESS_THROUGH_CASES: readonly PickerPressThroughOptions[] = [
  {
    profile: 'profile-a',
    worldId: 'language-house',
    cards: PICKER_GAMES,
  },
  {
    profile: 'profile-b',
    worldId: 'nature-lab',
    cards: NATURE_LAB_PICKER_GAMES,
  },
];

test.describe('game picker press-through prevention', () => {
  for (const row of PICKER_PRESS_THROUGH_CASES) {
    test(`${row.worldId} picker card taps over map buildings start only the chosen game`, async ({ page }) => {
      test.setTimeout(90_000);
      await expectPickerPressDoesNotReachMap(page, row);
    });
  }
});

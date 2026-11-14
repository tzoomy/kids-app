// Table-driven press-through regression suite for DOM game pickers (src/ui/picker/gamePicker.ts).
// Station-trail worlds take their cards from WORLD_GAMES + content via stationsForWorld.
import { test } from '@playwright/test';
import { stationsForWorld } from './helpers/worldStations';
import {
  expectPickerPressDoesNotReachMap,
  type PickerPressThroughOptions,
} from './helpers/pickerPressThrough';

export const PICKER_PRESS_THROUGH_CASES: readonly PickerPressThroughOptions[] = [
  {
    profile: 'profile-a',
    worldId: 'language-house',
    cards: stationsForWorld('language-house'),
  },
  {
    profile: 'profile-b',
    worldId: 'nature-lab',
    cards: stationsForWorld('nature-lab'),
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

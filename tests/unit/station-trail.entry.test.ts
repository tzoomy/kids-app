// @vitest-environment jsdom
import { describe, expect, it } from 'vitest';
import he from '../../src/content/i18n/he.json';
import { renderGamePicker } from '../../src/ui/picker/gamePicker';
import { PICKER_EMPTY_TEST_ID, STATION_TRAIL_TEST_ID, WORLD_GAMES } from '../../src/ui/picker/pickerModel';
import { buildTrail, collectTrailGames, worldEntry } from '../../src/ui/picker/trailModel';
import type { GamePickerOptions } from '../../src/ui/picker/gamePicker';
import type { WorldEntry } from '../../src/ui/picker/trailModel';
import * as worldTrail from '../../src/worlds/worldTrail';
import { loadAnimalRestaurant, loadKitchenOrchestra, loadLetterMonster, loadPotionLab, loadTravelSuitcase } from '../../src/content/loadContent';

/** Contract of the helper the implementation step adds to src/worlds/worldTrail.ts. Looked up by name so this file type-checks (and fails at runtime) until it exists. */
type WorldPickerOptions = Pick<GamePickerOptions, 'games' | 'stations' | 'title' | 'emptyText'>;
const worldPickerOptions = (entry: WorldEntry, strings: { title: string; emptyText: string }): WorldPickerOptions | null =>
  (worldTrail as unknown as { worldPickerOptions: (e: WorldEntry, s: { title: string; emptyText: string }) => WorldPickerOptions | null })
    .worldPickerOptions(entry, strings);

// Spec: docs/specs/station-trail.md (AC-10 entry rule). What a world building tap does with each entry kind.
// `worldPickerOptions` is the pure helper MapScene uses (added in the implementation step): it turns a WorldEntry into
// the options of the world picker, or null when the world is entered directly. Absorbs the Science World zero-game
// "coming soon" picker (PR #73): worldEntry 'none' still opens the empty picker.

const t = he.gamePicker;
const STRINGS = { title: t.scienceWorldTitle, emptyText: t.scienceWorldEmpty };

const GAMES = collectTrailGames({
  restaurant: loadAnimalRestaurant(),
  orchestra: loadKitchenOrchestra(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  potion: loadPotionLab(),
});

const trailOf = (worldId: string, registry = WORLD_GAMES) =>
  buildTrail({ worldId, registry, games: GAMES, skills: {}, track: 'age5' });

describe('station trail: map entry path per entry kind', () => {
  it('[AC-10] kind "none" opens the empty coming-soon picker (no cards, no trail), with the Science World texts', () => {
    // Potion Lab is on main, so emulate the zero-game state by leaving its card out of the registry.
    const registry = WORLD_GAMES.filter((g) => g.gameId !== 'potion-lab');
    const entry = worldEntry(trailOf('science-world', registry));
    expect(entry).toEqual({ kind: 'none' });

    const options = worldPickerOptions(entry, STRINGS);
    expect(options).not.toBeNull();
    expect(options?.games).toEqual([]);
    expect(options?.stations).toBeUndefined();
    expect(options?.title).toBe(t.scienceWorldTitle);
    expect(options?.emptyText).toBe(t.scienceWorldEmpty);

    const root = renderGamePicker({ ...options!, onPick: () => {}, onClose: () => {} });
    expect(root.querySelector(`[data-testid="${PICKER_EMPTY_TEST_ID}"]`)?.textContent).toBe(t.scienceWorldEmpty);
    expect(root.querySelectorAll('.picker-card')).toHaveLength(0);
    expect(root.querySelector(`[data-testid="${STATION_TRAIL_TEST_ID}"]`)).toBeNull();
    expect(root.querySelector('[data-testid="game-picker-close"]')).not.toBeNull();
  });

  it('[AC-10] kind "direct" opens no picker (the game is entered directly)', () => {
    const entry = worldEntry(trailOf('science-world'));
    expect(entry.kind).toBe('direct');
    expect(worldPickerOptions(entry, STRINGS)).toBeNull();
  });

  it('[AC-10] kind "picker" opens the trail picker with the stations and the given title, and no empty card', () => {
    const entry = worldEntry(trailOf('language-house'));
    expect(entry.kind).toBe('picker');
    const options = worldPickerOptions(entry, { title: 'בית השפה', emptyText: t.scienceWorldEmpty });
    expect(options?.title).toBe('בית השפה');
    const stationIds = options?.stations?.map((s) => s.game.gameId) ?? [];
    expect(stationIds).toEqual(['animal-restaurant', 'kitchen-orchestra', 'letter-monster', 'travel-suitcase']);
    expect(options?.games).toBeUndefined();

    const root = renderGamePicker({ ...options!, onPick: () => {}, onClose: () => {} });
    expect(root.querySelector(`[data-testid="${STATION_TRAIL_TEST_ID}"]`)).not.toBeNull();
    expect(root.querySelector(`[data-testid="${PICKER_EMPTY_TEST_ID}"]`)).toBeNull();
    expect(root.querySelectorAll('.picker-card')).toHaveLength(stationIds.length);
  });
});

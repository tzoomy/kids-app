import { describe, expect, it, vi } from 'vitest';
import { renderGamePicker } from '../../src/ui/picker/gamePicker';
import { LEISURE_PICKER_GAMES, PICKER_GAMES, WORLD_GAMES } from '../../src/ui/picker/pickerModel';
import { collectTrailGames, stationGamesForWorld, type Station } from '../../src/ui/picker/trailModel';
import heStrings from '../../src/content/i18n/he.json';
import {
  loadAnimalRestaurant,
  loadBalloonPop,
  loadKitchenOrchestra,
  loadLetterMonster,
  loadPicnicTrain,
  loadNumberBridge,
  loadTravelSuitcase,
  loadPotionLab,
  loadSeedToFlower,
  loadSortingBeds,
  loadWhoLivesHere,
  loadWhosHiding,
} from '../../src/content/loadContent';

// Spec: docs/specs/station-trail.md. DOM render of the trail picker (jsdom, no Phaser).

const REAL_GAMES = collectTrailGames({
  restaurant: loadAnimalRestaurant(),
  orchestra: loadKitchenOrchestra(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  sorting: loadSortingBeds(),
  balloon: loadBalloonPop(),
  picnic: loadPicnicTrain(),
  numberBridge: loadNumberBridge(),
  hiding: loadWhosHiding(),
  seedToFlower: loadSeedToFlower(),
  whoLivesHere: loadWhoLivesHere(),
  potion: loadPotionLab(),
});

function stations(opts: { completed?: string[]; suggested?: string }): Station[] {
  return PICKER_GAMES.map((game) => ({
    game,
    completed: opts.completed?.includes(game.gameId) ?? false,
    suggested: opts.suggested === game.gameId,
    enabled: true as const,
  }));
}

function render(s: Station[], onPick = vi.fn()) {
  const root = renderGamePicker({ stations: s, title: 'כותרת', onPick, onClose: () => {} });
  return { root, onPick };
}

describe('station trail picker render', () => {
  it('[AC-03] a completed station shows its star badge; others do not', () => {
    const { root } = render(stations({ completed: ['animal-restaurant'], suggested: 'kitchen-orchestra' }));
    expect(root.querySelector('[data-testid="station-star-animal-restaurant"]')).not.toBeNull();
    expect(root.querySelector('[data-testid="station-star-kitchen-orchestra"]')).toBeNull();
    expect(root.querySelector('[data-testid="game-picker-animal-restaurant"]')?.getAttribute('data-completed')).toBe('true');
    expect(root.querySelector('[data-testid="game-picker-kitchen-orchestra"]')?.getAttribute('data-completed')).toBe('false');
  });

  it('[AC-06] exactly one pulse marker, on the suggested station', () => {
    const { root } = render(stations({ completed: ['animal-restaurant'], suggested: 'kitchen-orchestra' }));
    const markers = root.querySelectorAll('[data-testid^="station-pulse-"]');
    expect(markers).toHaveLength(1);
    expect(markers[0].getAttribute('data-testid')).toBe('station-pulse-kitchen-orchestra');
    expect(root.querySelector('[data-testid="game-picker-kitchen-orchestra"]')?.getAttribute('data-suggested')).toBe('true');
  });

  it('[AC-07] every station card is an enabled button and picking any of them calls onPick', () => {
    const { root, onPick } = render(stations({ completed: ['animal-restaurant'], suggested: 'kitchen-orchestra' }));
    for (const game of PICKER_GAMES) {
      const button = root.querySelector<HTMLButtonElement>(`[data-testid="${game.testId}"]`);
      expect(button?.tagName).toBe('BUTTON');
      expect(button?.disabled).toBe(false);
      expect(button?.getAttribute('aria-disabled')).toBeNull();
      button?.click();
    }
    expect(onPick.mock.calls.map((c) => (c[0] as { gameId: string }).gameId)).toEqual([
      'animal-restaurant',
      'kitchen-orchestra',
      'letter-monster',
    ]);
  });

  it('[AC-15] the card label says completed and suggested in Hebrew; a plain card keeps its plain name', () => {
    const t = heStrings.gamePicker;
    const { root } = render(stations({ completed: ['animal-restaurant'], suggested: 'kitchen-orchestra' }));
    expect(root.querySelector('[data-testid="game-picker-animal-restaurant"]')?.getAttribute('aria-label')).toBe(
      `${t.animalRestaurant}, ${t.stationDone}`,
    );
    expect(root.querySelector('[data-testid="game-picker-kitchen-orchestra"]')?.getAttribute('aria-label')).toBe(
      `${t.kitchenOrchestra}, ${t.stationSuggested}`,
    );
    const plain = render(stations({ suggested: 'animal-restaurant' })).root;
    expect(plain.querySelector('[data-testid="game-picker-kitchen-orchestra"]')?.getAttribute('aria-label')).toBe(t.kitchenOrchestra);
  });

  it('[AC-15] a completed and suggested station says both', () => {
    const t = heStrings.gamePicker;
    const { root } = render(stations({ completed: ['animal-restaurant'], suggested: 'animal-restaurant' }));
    expect(root.querySelector('[data-testid="game-picker-animal-restaurant"]')?.getAttribute('aria-label')).toBe(
      `${t.animalRestaurant}, ${t.stationDone}, ${t.stationSuggested}`,
    );
  });

  it('[AC-14] the cards sit in a trail container that knows how many stations it holds (Language House and Number Garden from the registry)', () => {
    const languageHouse = stationGamesForWorld('language-house', WORLD_GAMES, REAL_GAMES);
    const root = renderGamePicker({
      stations: languageHouse.map((game, i) => ({
        game,
        completed: false,
        suggested: i === 0,
        enabled: true as const,
      })),
      title: 'x',
      onPick: () => {},
      onClose: () => {},
    });
    const trail = root.querySelector<HTMLElement>('[data-testid="station-trail"]');
    expect(trail).not.toBeNull();
    expect(languageHouse.map((g) => g.gameId)).toEqual([
      'animal-restaurant',
      'kitchen-orchestra',
      'letter-monster',
      'travel-suitcase',
    ]);
    expect(trail?.style.getPropertyValue('--picker-count')).toBe(String(languageHouse.length));
    expect(root.querySelectorAll('.picker-card')).toHaveLength(languageHouse.length);

    const gardenCards = stationGamesForWorld('number-garden', WORLD_GAMES, REAL_GAMES);
    expect(gardenCards.map((g) => g.gameId)).toEqual(['sorting-beds', 'balloon-pop', 'picnic-train', 'number-bridge']);
    const garden = renderGamePicker({
      stations: gardenCards.map((game) => ({
        game,
        completed: false,
        suggested: game.gameId === 'sorting-beds',
        enabled: true as const,
      })),
      title: 'x',
      onPick: () => {},
      onClose: () => {},
    });
    expect(garden.querySelector<HTMLElement>('[data-testid="station-trail"]')?.style.getPropertyValue('--picker-count')).toBe(String(gardenCards.length));
    expect([...garden.querySelectorAll('.picker-card')].map((c) => c.getAttribute('data-testid'))).toEqual(gardenCards.map((g) => g.testId));
  });

  it('[AC-14] the picker has a close button next to the stations', () => {
    const { root } = render(stations({ suggested: 'animal-restaurant' }));
    expect(root.querySelector('[data-testid="game-picker-close"]')).not.toBeNull();
  });

  it('[AC-09] each world\'s picker is built from WORLD_GAMES + content: Nature Lab shows Who\'s Hiding?, Seed to Flower, then Who Lives Here? with plain or state labels', () => {
    const t = heStrings.gamePicker;
    const cards = stationGamesForWorld('nature-lab', WORLD_GAMES, REAL_GAMES);
    const root = renderGamePicker({
      stations: cards.map((game, i) => ({ game, completed: i === 0, suggested: i === 1, enabled: true as const })),
      title: t.natureLabTitle,
      onPick: () => {},
      onClose: () => {},
    });
    expect([...root.querySelectorAll('.picker-card')].map((c) => c.getAttribute('data-testid'))).toEqual([
      'game-picker-who-is-hiding',
      'game-picker-seed-to-flower',
      'game-picker-who-lives-here',
    ]);
    expect(root.querySelector<HTMLElement>('[data-testid="station-trail"]')?.style.getPropertyValue('--picker-count')).toBe('3');
    expect(root.querySelector('[data-testid="game-picker-who-is-hiding"]')?.getAttribute('aria-label')).toBe(`${t.whoIsHiding}, ${t.stationDone}`);
    expect(root.querySelector('[data-testid="game-picker-seed-to-flower"]')?.getAttribute('aria-label')).toBe(`${t.seedToFlower}, ${t.stationSuggested}`);
    expect(root.querySelector('[data-testid="game-picker-who-lives-here"]')?.getAttribute('aria-label')).toBe(t.whoLivesHere);
  });

  it('[AC-16] the Leisure Corner picker (no stations) has no trail, star, pulse or station attributes', () => {
    const root = renderGamePicker({ games: LEISURE_PICKER_GAMES, title: 'x', onPick: () => {}, onClose: () => {} });
    expect(root.querySelector('[data-testid="station-trail"]')).toBeNull();
    expect(root.querySelector('[data-testid^="station-star-"]')).toBeNull();
    expect(root.querySelector('[data-testid^="station-pulse-"]')).toBeNull();
    expect(root.querySelector('[data-completed]')).toBeNull();
    expect(root.querySelector('[data-suggested]')).toBeNull();
  });
});

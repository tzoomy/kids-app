import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { PICKER_ASSET_KEYS, resolvePickerAsset } from '../../src/ui/picker/pickerAssets';
import { PICKER_GAMES } from '../../src/ui/picker/pickerModel';
import { loadAnimalRestaurant, loadKitchenOrchestra, loadLetterMonster, loadTravelSuitcase } from '../../src/content/loadContent';
import he from '../../src/content/i18n/he.json';

const KEYS = ['picker-card-animal-restaurant', 'picker-card-kitchen-orchestra', 'picker-close', 'picker-bg'];

describe('Language House picker data model', () => {
  it('lists Language House games looked up by gameId, restaurant first, Letter Monster fourth after Travel Suitcase', () => {
    const byId = (id: string) => PICKER_GAMES.find((g) => g.gameId === id);
    expect(byId('animal-restaurant')).toEqual({
      gameId: 'animal-restaurant',
      testId: 'game-picker-animal-restaurant',
      sceneKey: 'RestaurantScene',
      assetKey: 'picker-card-animal-restaurant',
      labelKey: 'animalRestaurant',
    });
    expect(byId('kitchen-orchestra')).toEqual({
      gameId: 'kitchen-orchestra',
      testId: 'game-picker-kitchen-orchestra',
      sceneKey: 'OrchestraScene',
      assetKey: 'picker-card-kitchen-orchestra',
      labelKey: 'kitchenOrchestra',
    });
    expect(byId('travel-suitcase')).toEqual({
      gameId: 'travel-suitcase',
      testId: 'game-picker-travel-suitcase',
      sceneKey: 'SuitcaseScene',
      assetKey: 'picker-card-travel-suitcase',
      labelKey: 'travelSuitcase',
    });
    expect(byId('letter-monster')).toEqual({
      gameId: 'letter-monster',
      testId: 'game-picker-letter-monster',
      sceneKey: 'LetterMonsterScene',
      assetKey: 'picker-card-letter-monster',
      labelKey: 'letterMonster',
    });
    const ids = PICKER_GAMES.map((g) => g.gameId);
    expect(ids.indexOf('animal-restaurant')).toBe(0);
    expect(ids.indexOf('kitchen-orchestra')).toBeGreaterThan(ids.indexOf('animal-restaurant'));
    expect(ids.indexOf('travel-suitcase')).toBeGreaterThan(ids.indexOf('kitchen-orchestra'));
    expect(ids.indexOf('letter-monster')).toBeGreaterThan(ids.indexOf('travel-suitcase'));
    expect((he.gamePicker as Record<string, string>).travelSuitcase).toBe('מזוודת הטיול');
    expect((he.gamePicker as Record<string, string>).letterMonster).toBe('מפלצת האותיות');
  });

  it('only offers games whose content belongs to Language House', () => {
    const worlds = new Map([
      ['animal-restaurant', loadAnimalRestaurant().world],
      ['kitchen-orchestra', loadKitchenOrchestra().world],
      ['travel-suitcase', loadTravelSuitcase().world],
      ['letter-monster', loadLetterMonster().world],
    ]);
    for (const g of PICKER_GAMES) expect(worlds.get(g.gameId)).toBe('language-house');
  });
});

describe('Language House picker placeholder art', () => {
  it('uses exactly the four agreed asset keys', () => {
    expect([...PICKER_ASSET_KEYS].sort()).toEqual([...KEYS].sort());
  });

  it('never registers a picker key twice in the main art manifest (art/language-house-picker owns those entries)', () => {
    // When the art branch registers the keys, resolvePickerAsset returns its entries instead (see the last test).
    const manifestKeys = ART_MANIFEST.map((e) => e.key).filter((k) => (KEYS as readonly string[]).includes(k));
    expect(new Set(manifestKeys).size).toBe(manifestKeys.length);
  });

  it('resolves every key to a placeholder that exists on disk (or a CSS shape)', () => {
    for (const key of KEYS) {
      const asset = resolvePickerAsset(key);
      expect(asset.key).toBe(key);
      if (asset.kind === 'css') {
        expect(asset.css.length).toBeGreaterThan(0);
      } else if (asset.kind === 'manifest') {
        expect(fs.existsSync(path.join('public', asset.url))).toBe(true);
      } else {
        expect(asset.kind).toBe('placeholder');
        expect(fs.existsSync(path.join('public', asset.url))).toBe(true);
      }
    }
  });

  it('prefers a real manifest entry over the placeholder when one is registered', () => {
    const manifest = [{ key: 'picker-close', url: 'art/ui/picker-close.svg', width: 120, height: 120 }];
    const asset = resolvePickerAsset('picker-close', manifest);
    expect(asset.kind).toBe('manifest');
    if (asset.kind === 'manifest') expect(asset.url).toBe('art/ui/picker-close.svg');
    expect(resolvePickerAsset('picker-bg', manifest).kind).not.toBe('manifest');
  });
});

describe('Language House picker art sizes (paired with draft art PR #40)', () => {
  it('sizes the layout to the #40 art: 640x800 cards, 128x128 close, 1280x800 background', async () => {
    const { PICKER_ART_SIZES } = await import('../../src/ui/picker/pickerAssets');
    expect(PICKER_ART_SIZES['picker-card-animal-restaurant']).toEqual({ width: 640, height: 800 });
    expect(PICKER_ART_SIZES['picker-card-kitchen-orchestra']).toEqual({ width: 640, height: 800 });
    expect(PICKER_ART_SIZES['picker-close']).toEqual({ width: 128, height: 128 });
    expect(PICKER_ART_SIZES['picker-bg']).toEqual({ width: 1280, height: 800 });
  });

  it('resolves the #40 manifest entries (same keys and urls) instead of the placeholders', () => {
    const pr40 = [
      { key: 'picker-card-animal-restaurant', url: 'art/ui/picker/card-animal-restaurant.svg', width: 640, height: 800 },
      { key: 'picker-card-kitchen-orchestra', url: 'art/ui/picker/card-kitchen-orchestra.svg', width: 640, height: 800 },
      { key: 'picker-close', url: 'art/ui/picker/close.svg', width: 128, height: 128 },
      { key: 'picker-bg', url: 'art/ui/picker/bg.svg', width: 1280, height: 800 },
    ];
    for (const e of pr40) expect(resolvePickerAsset(e.key, pr40)).toEqual({ key: e.key, kind: 'manifest', url: e.url });
  });
});

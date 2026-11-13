import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { PICKER_ASSET_KEYS, resolvePickerAsset } from '../../src/ui/picker/pickerAssets';
import { PICKER_GAMES } from '../../src/ui/picker/pickerModel';
import { loadAnimalRestaurant, loadKitchenOrchestra } from '../../src/content/loadContent';

const KEYS = ['picker-card-animal-restaurant', 'picker-card-kitchen-orchestra', 'picker-close', 'picker-bg'];

describe('Language House picker data model', () => {
  it('lists exactly two games, restaurant first (right in RTL landscape, top in portrait)', () => {
    expect(PICKER_GAMES.map((g) => g.gameId)).toEqual(['animal-restaurant', 'kitchen-orchestra']);
  });

  it('maps each card to its testid and game scene', () => {
    expect(PICKER_GAMES.map((g) => g.testId)).toEqual(['game-picker-animal-restaurant', 'game-picker-kitchen-orchestra']);
    expect(PICKER_GAMES.map((g) => g.sceneKey)).toEqual(['RestaurantScene', 'OrchestraScene']);
    expect(PICKER_GAMES.map((g) => g.assetKey)).toEqual(['picker-card-animal-restaurant', 'picker-card-kitchen-orchestra']);
  });

  it('only offers games whose content belongs to Language House', () => {
    const worlds = new Map([
      ['animal-restaurant', loadAnimalRestaurant().world],
      ['kitchen-orchestra', loadKitchenOrchestra().world],
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

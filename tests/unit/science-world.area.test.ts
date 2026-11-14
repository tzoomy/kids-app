// @vitest-environment jsdom
import { afterAll, beforeAll, describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import worlds from '../../src/content/worlds.json';
import he from '../../src/content/i18n/he.json';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { buildingArtKey, registerArtManifest, resetArtRegistry } from '../../src/anim/artRegistry';
import { PICKER_EMPTY_TEST_ID, SCIENCE_WORLD_PICKER_GAMES } from '../../src/ui/picker/pickerModel';
import { resolvePickerAsset } from '../../src/ui/picker/pickerAssets';
import { loadPotionLab, loadSinkOrFloat, loadMagicMagnet } from '../../src/content/loadContent';
import { renderGamePicker } from '../../src/ui/picker/gamePicker';
import { selectAffectedE2e } from '../../scripts/affected-e2e.mjs';

type World = { id: string; nameHe: string; status: string; earnsLeisure?: boolean; entryGameId?: string };
const list = (worlds as { worlds: World[] }).worlds;

describe('Science World map area (separate area: pending Maor decision)', () => {
  beforeAll(() => registerArtManifest(ART_MANIFEST));
  afterAll(() => resetArtRegistry());

  it('is registered in worlds.json as an open, leisure-earning world before Art Studio', () => {
    const ids = list.map((w) => w.id);
    const sw = list.find((w) => w.id === 'science-world');
    expect(sw).toBeDefined();
    expect(sw!.nameHe).toBe('עולם המדע');
    expect(sw!.status).toBe('open');
    expect(sw!.earnsLeisure).toBe(true);
    // No direct entry game: the building always opens its picker.
    expect(sw!.entryGameId).toBeUndefined();
    expect(ids.indexOf('science-world')).toBe(ids.indexOf('art-studio') - 1);
    expect(new Set(ids).size).toBe(ids.length);
  });

  it('has Hebrew map label, picker title and empty-state text', () => {
    expect(he.worldMap.scienceWorld).toBe('עולם המדע');
    expect(he.gamePicker.scienceWorldTitle).toBe('עולם המדע');
    expect(he.gamePicker.scienceWorldEmpty.length).toBeGreaterThan(0);
  });

  it('registers its building art once, and the SVG exists on disk', () => {
    const key = buildingArtKey('science-world');
    expect(key).toBe('building-science-world');
    const entries = ART_MANIFEST.filter((e) => e.key === key);
    expect(entries).toHaveLength(1);
    const file = path.join('public', entries[0].url);
    expect(fs.existsSync(file)).toBe(true);
    const svg = fs.readFileSync(file, 'utf8');
    expect(svg).toMatch(/<svg[^>]*viewBox=/);
    // Static art only: no scripts, no external references.
    expect(svg).not.toMatch(/<script|href="http/i);
  });

  it('other worlds keep their procedural buildings (no art key)', () => {
    for (const id of ['language-house', 'number-garden', 'nature-lab', 'art-studio', 'leisure-corner']) {
      expect(buildingArtKey(id), id).toBeUndefined();
    }
  });

  it('picker list has potion-lab, sink-or-float and magic-magnet, looked up by gameId, with Hebrew labels and resolvable assets', () => {
    const byId = (id: string) => SCIENCE_WORLD_PICKER_GAMES.find((g) => g.gameId === id);
    const potionEntry = byId('potion-lab');
    const sinkEntry = byId('sink-or-float');
    const magnetEntry = byId('magic-magnet');
    expect(potionEntry).toEqual({
      gameId: 'potion-lab',
      testId: 'game-picker-potion-lab',
      sceneKey: 'PotionScene',
      assetKey: 'picker-card-potion-lab',
      labelKey: 'potionLab',
    });
    expect(sinkEntry).toEqual({
      gameId: 'sink-or-float',
      testId: 'game-picker-sink-or-float',
      sceneKey: 'SinkFloatScene',
      assetKey: 'picker-card-sink-or-float',
      labelKey: 'sinkOrFloat',
    });
    expect(magnetEntry).toEqual({
      gameId: 'magic-magnet',
      testId: 'game-picker-magic-magnet',
      sceneKey: 'MagnetScene',
      assetKey: 'picker-card-magic-magnet',
      labelKey: 'magicMagnet',
    });
    const ids = SCIENCE_WORLD_PICKER_GAMES.map((g) => g.gameId);
    expect(ids.indexOf('potion-lab')).toBeGreaterThanOrEqual(0);
    expect(ids.indexOf('sink-or-float')).toBeGreaterThan(ids.indexOf('potion-lab'));
    expect(ids.indexOf('magic-magnet')).toBeGreaterThan(ids.indexOf('sink-or-float'));
    expect(loadPotionLab().world).toBe('science-world');
    expect(loadSinkOrFloat().world).toBe('science-world');
    expect(loadMagicMagnet().world).toBe('science-world');
    expect(() => resolvePickerAsset(potionEntry!.assetKey)).not.toThrow();
    expect(() => resolvePickerAsset(sinkEntry!.assetKey)).not.toThrow();
    expect(() => resolvePickerAsset(magnetEntry!.assetKey)).not.toThrow();
    const labels = he.gamePicker as Record<string, string>;
    expect(labels[potionEntry!.labelKey]).toBe('מעבדת השיקויים');
    expect(labels[sinkEntry!.labelKey]).toBe('צף או שוקע?');
    expect(labels[magnetEntry!.labelKey]).toBe('המגנט הקסום');
  });
});

describe('game picker empty state', () => {
  it('renders the coming-soon card and no game cards when the list is empty', () => {
    const root = renderGamePicker({
      games: [],
      title: he.gamePicker.scienceWorldTitle,
      emptyText: he.gamePicker.scienceWorldEmpty,
      onPick: () => {},
      onClose: () => {},
    });
    const empty = root.querySelector(`[data-testid="${PICKER_EMPTY_TEST_ID}"]`);
    expect(empty?.textContent).toBe(he.gamePicker.scienceWorldEmpty);
    expect(root.querySelectorAll('.picker-card')).toHaveLength(0);
  });

  it('keeps presses on the picker from reaching window listeners (the Phaser map underneath)', () => {
    const root = renderGamePicker({ games: [], emptyText: 'x', onPick: () => {}, onClose: () => {} });
    document.body.appendChild(root);
    const seen: string[] = [];
    const spy = (e: Event) => seen.push(e.type);
    for (const t of ['pointerdown', 'mousedown', 'touchstart']) window.addEventListener(t, spy);
    const empty = root.querySelector(`[data-testid="${PICKER_EMPTY_TEST_ID}"]`)!;
    for (const t of ['pointerdown', 'mousedown', 'touchstart']) empty.dispatchEvent(new Event(t, { bubbles: true }));
    for (const t of ['pointerdown', 'mousedown', 'touchstart']) window.removeEventListener(t, spy);
    root.remove();
    expect(seen).toEqual([]);
  });

  it('does not render the empty card when games exist', () => {
    const root = renderGamePicker({ onPick: () => {}, onClose: () => {} });
    expect(root.querySelector(`[data-testid="${PICKER_EMPTY_TEST_ID}"]`)).toBeNull();
    expect(root.querySelectorAll('.picker-card').length).toBeGreaterThan(0);
  });
});

describe('Science World affected e2e mapping', () => {
  it('building art and picker changes select the Science World map spec', () => {
    expect(selectAffectedE2e(['public/art/buildings/science-world.svg'])).toContain('tests/e2e/science-world.map.spec.ts');
    expect(selectAffectedE2e(['src/ui/picker/pickerModel.ts'])).toContain('tests/e2e/science-world.map.spec.ts');
    expect(selectAffectedE2e(['tests/unit/science-world.area.test.ts'])).toEqual(['tests/e2e/science-world.map.spec.ts']);
  });
});

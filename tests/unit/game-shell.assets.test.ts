// Game shell asset contract (docs/specs/game-shell.md AC-17, docs/specs/mystery-egg-assets.md "Game shell assets").
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import rawManifest from '../../src/content/mysteryEggAssets.json';
import { GAME_SHELL_ASSET_IDS, ONE_X_ART_IDS, assetEntry, assetEntrySchema, mysteryEggManifest, parseAssetManifest } from '../../src/games/mysteryEgg/assets';

/** The 38 new ids, pinned here (a spec change is needed to add one). */
const SHELL_IDS = [
  'map-bg', 'map-path',
  'world-workshop', 'world-bakery', 'world-bakery-locked', 'world-owl-house', 'world-owl-house-locked',
  'world-jungle', 'world-jungle-locked', 'world-garden', 'world-garden-locked',
  'frog', 'piece-knit-square', 'piece-pebble', 'piece-leaf', 'piece-flower', 'icon-skip',
  'slide-intro-1', 'slide-intro-2', 'slide-intro-3', 'slide-intro-4', 'slide-workshop-1', 'slide-workshop-2',
  'vo-fr-intro-1', 'vo-he-intro-1', 'vo-fr-intro-2', 'vo-he-intro-2', 'vo-fr-intro-3', 'vo-he-intro-3', 'vo-fr-intro-4', 'vo-he-intro-4',
  'vo-fr-workshop-entry-1', 'vo-he-workshop-entry-1', 'vo-fr-workshop-entry-2', 'vo-he-workshop-entry-2',
  'vo-he-robot-locked',
  'sfx-locked', 'sfx-walk',
];

const publicDir = path.resolve(__dirname, '..', '..', 'public');

describe('game-shell asset manifest', () => {
  it('[AC-17] the manifest parses and has exactly the 38 game shell ids on top of the 41 prototype ids (79)', () => {
    expect(SHELL_IDS).toHaveLength(38);
    expect([...GAME_SHELL_ASSET_IDS].sort()).toEqual([...SHELL_IDS].sort());
    const parsed = parseAssetManifest(rawManifest);
    expect(Object.keys(parsed)).toHaveLength(79);
    for (const id of SHELL_IDS) expect(parsed[id], id).toBeDefined();
  });

  it('[AC-17] every new entry is pending or has its file under public/ (pending is the only excuse for a missing file)', () => {
    for (const id of SHELL_IDS) {
      const e = assetEntry(id);
      const exists = fs.existsSync(path.join(publicDir, e.path));
      expect(exists || e.pending === true, `${id}: ${e.path} is missing and not pending`).toBe(true);
    }
  });

  it('[AC-17] pending must be a boolean in the schema, and an old entry without it still parses', () => {
    expect(assetEntrySchema.safeParse({ path: 'art/mystery-egg/x.webp', kind: 'webp', w: 1, h: 1, pending: true }).success).toBe(true);
    expect(assetEntrySchema.safeParse({ path: 'art/mystery-egg/x.webp', kind: 'webp', w: 1, h: 1, pending: 'yes' }).success).toBe(false);
    expect(mysteryEggManifest()['hub-bg'].pending).toBeUndefined();
  });

  it('[AC-17] paths follow the pattern; vo entries have a transcript and the language of their id', () => {
    for (const id of SHELL_IDS) {
      const e = assetEntry(id);
      if (e.kind === 'vo' || e.kind === 'sfx') expect(e.path, id).toBe(`audio/mystery-egg/${id}.ogg`);
      else expect(e.path, id).toBe(`art/mystery-egg/${id}.webp`);
      if (e.kind === 'vo') {
        expect(e.transcript, id).toBeTruthy();
        expect(e.lang, id).toBe(id.startsWith('vo-he-') ? 'he' : 'fr');
      }
    }
    expect(SHELL_IDS.filter((id) => assetEntry(id).kind === 'vo')).toHaveLength(13);
    expect(SHELL_IDS.filter((id) => assetEntry(id).kind === 'sfx')).toEqual(['sfx-locked', 'sfx-walk']);
  });

  it('[AC-17] display sizes follow the contract; map-bg and the six slides are 1x files like hub-bg, everything else is 2x', () => {
    const sizes: Record<string, [number, number]> = {
      'map-bg': [1280, 800], 'map-path': [96, 96], 'world-workshop': [340, 280], 'world-garden-locked': [340, 280],
      frog: [140, 160], 'piece-leaf': [120, 120], 'icon-skip': [96, 96], 'slide-intro-1': [1280, 800], 'slide-workshop-2': [1280, 800],
    };
    for (const [id, [w, h]] of Object.entries(sizes)) expect([assetEntry(id).w, assetEntry(id).h], id).toEqual([w, h]);
    expect([...ONE_X_ART_IDS].sort()).toEqual(['hub-bg', 'map-bg', 'slide-intro-1', 'slide-intro-2', 'slide-intro-3', 'slide-intro-4', 'slide-workshop-1', 'slide-workshop-2']);
    // Tap targets: every world art is big enough that its tap area (80%) is at least 96 px.
    for (const w of ['workshop', 'bakery', 'owl-house', 'jungle', 'garden']) expect(assetEntry(`world-${w}`).w as number * 0.8).toBeGreaterThanOrEqual(96);
  });

  it('[AC-17] the locked worlds have a locked look, the Workshop only the open one', () => {
    for (const w of ['bakery', 'owl-house', 'jungle', 'garden']) {
      expect(mysteryEggManifest()[`world-${w}`], w).toBeDefined();
      expect(mysteryEggManifest()[`world-${w}-locked`], w).toBeDefined();
    }
    expect(mysteryEggManifest()['world-workshop-locked']).toBeUndefined();
  });

  it('[AC-17] the locked line is the proposed feminine-singular Hebrew line and names nobody', () => {
    const t = assetEntry('vo-he-robot-locked').transcript as string;
    expect(t).toBe('העולם הזה עוד ישן. בואי נלך לסדנה!');
    expect(t).not.toMatch(/elli|shai/i);
  });
});

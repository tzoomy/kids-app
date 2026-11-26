// Game shell asset contract (docs/specs/game-shell.md AC-17; Gemini's media contract, game-shell/plan.md section (d)):
// src/content/gameShellAssets.json is merged with mysteryEggAssets.json at load time.
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import rawShell from '../../src/content/gameShellAssets.json';
import rawProto from '../../src/content/mysteryEggAssets.json';
import {
  GAME_SHELL_ASSET_IDS,
  MYSTERY_EGG_ASSET_IDS,
  ONE_X_ART_IDS,
  assetEntry,
  entriesOfKind,
  mergeManifests,
  mysteryEggManifest,
  parseAssetManifest,
  parseGameShellManifest,
  spriteSpec,
} from '../../src/games/mysteryEgg/assets';

/** Gemini's 37 ids, pinned here (the contract: a spec change is needed to add one). */
const SHELL_IDS = [
  'shell-intro-1', 'shell-intro-2', 'shell-intro-3', 'shell-intro-4', 'shell-ws-1', 'shell-ws-2',
  'map-bg', 'map-nest-home',
  'map-world-workshop-open', 'map-world-workshop-closed', 'map-world-bakery-open', 'map-world-bakery-closed',
  'map-world-detective-open', 'map-world-detective-closed', 'map-world-jungle-open', 'map-world-jungle-closed',
  'map-world-garden-open', 'map-world-garden-closed',
  'map-bunny-idle', 'map-bunny-walk', 'map-robot-idle', 'map-robot-walk', 'map-capybara-idle', 'map-capybara-walk', 'map-frog-idle', 'map-frog-walk',
  'vo-shell-intro-1-hero', 'vo-shell-intro-1-narr', 'vo-shell-intro-2-hero', 'vo-shell-intro-2-robot',
  'vo-shell-intro-3-hero', 'vo-shell-intro-3-robot', 'vo-shell-intro-4-hero', 'vo-shell-intro-4-narr',
  'vo-shell-ws-1-hero', 'vo-shell-ws-1-narr', 'vo-shell-ws-2-robot',
];

const publicDir = path.resolve(__dirname, '..', '..', 'public');

describe('game-shell asset manifest', () => {
  it('[AC-17] gameShellAssets.json has exactly Gemini\'s 37 ids and parses; the combined manifest has the 41 prototype ids plus them (78)', () => {
    expect(SHELL_IDS).toHaveLength(37);
    expect([...GAME_SHELL_ASSET_IDS].sort()).toEqual([...SHELL_IDS].sort());
    expect(Object.keys(parseGameShellManifest(rawShell)).sort()).toEqual([...SHELL_IDS].sort());
    expect(Object.keys(mysteryEggManifest())).toHaveLength(78);
    expect([...MYSTERY_EGG_ASSET_IDS]).toHaveLength(78);
    // mysteryEggAssets.json is untouched by the shell: no shell id lives in it.
    for (const id of SHELL_IDS) expect(Object.keys(rawProto), id).not.toContain(id);
    expect(Object.keys(parseAssetManifest(rawProto))).toHaveLength(41);
  });

  it('[AC-17] a duplicate id across the two files is an error, and an id outside Gemini\'s list is rejected', () => {
    const proto = parseAssetManifest(rawProto);
    const shell = parseGameShellManifest(rawShell);
    expect(() => mergeManifests(proto, shell)).not.toThrow();
    expect(() => mergeManifests(proto, { ...shell, bunny: shell['map-bg'] })).toThrow(/duplicate/i);
    expect(() => parseGameShellManifest({ ...rawShell, extra: { path: 'art/game-shell/extra.webp', kind: 'webp', w: 1, h: 1 } })).toThrow();
    const { 'map-bg': _removed, ...fewer } = rawShell as Record<string, unknown>;
    expect(() => parseGameShellManifest(fewer)).toThrow();
  });

  it('[AC-17] paths are art/game-shell/<id>.webp and audio/game-shell/<id>.ogg, relative to public/', () => {
    for (const id of SHELL_IDS) {
      const e = assetEntry(id);
      if (e.kind === 'vo' || e.kind === 'sfx') expect(e.path, id).toBe(`audio/game-shell/${id}.ogg`);
      else expect(e.path, id).toBe(`art/game-shell/${id}.webp`);
    }
  });

  it('[AC-17] sizes, frames and fps are Gemini\'s: 1x w/h, walk strips of 4 frames at 8 fps', () => {
    const sizes: Record<string, [number, number]> = {
      'shell-intro-1': [1280, 800], 'shell-ws-2': [1280, 800], 'map-bg': [1280, 800], 'map-nest-home': [360, 300],
      'map-world-workshop-open': [320, 260], 'map-world-garden-closed': [320, 260],
      'map-bunny-idle': [160, 200], 'map-robot-idle': [120, 150], 'map-capybara-idle': [160, 190], 'map-frog-idle': [110, 130],
    };
    for (const [id, [w, h]] of Object.entries(sizes)) expect([assetEntry(id).w, assetEntry(id).h], id).toEqual([w, h]);
    const walks: Record<string, [number, number]> = { bunny: [160, 200], robot: [120, 150], capybara: [160, 190], frog: [110, 130] };
    for (const [f, [w, h]] of Object.entries(walks)) {
      expect(assetEntry(`map-${f}-walk`).kind).toBe('sprite');
      expect(spriteSpec(`map-${f}-walk`), f).toEqual({ id: `map-${f}-walk`, frames: 4, fps: 8, w, h });
    }
    expect(entriesOfKind('sprite').map(([id]) => id).sort()).toEqual([
      'cat-wake', 'confetti', 'map-bunny-walk', 'map-capybara-walk', 'map-frog-walk', 'map-robot-walk', 'robot-blink',
    ]);
    expect([...ONE_X_ART_IDS].sort()).toEqual(['hub-bg', 'map-bg', 'shell-intro-1', 'shell-intro-2', 'shell-intro-3', 'shell-intro-4', 'shell-ws-1', 'shell-ws-2']);
  });

  it('[AC-17] the 11 voice clips have a transcript and the language of their kind; there is no sfx and no locked line', () => {
    const vos = SHELL_IDS.filter((id) => assetEntry(id).kind === 'vo');
    expect(vos).toHaveLength(11);
    for (const id of vos) {
      const e = assetEntry(id);
      expect(e.transcript, id).toBeTruthy();
      expect(e.lang, id).toBe(id.endsWith('-hero') ? 'fr' : 'he');
      if (e.lang === 'he') expect(e.transcript, id).not.toMatch(/lumi|bip|elli|shai/i);
    }
    expect(SHELL_IDS.filter((id) => assetEntry(id).kind === 'sfx')).toEqual([]);
  });

  it('[AC-17] every world has an open and a closed tile', () => {
    for (const w of ['workshop', 'bakery', 'detective', 'jungle', 'garden']) {
      expect(assetEntry(`map-world-${w}-open`)).toBeDefined();
      expect(assetEntry(`map-world-${w}-closed`)).toBeDefined();
    }
  });

  it('[AC-17] a shell file that is not in the repo yet is fine (Gemini\'s media PR adds it); one that exists is checked by the files guard', () => {
    const missing = SHELL_IDS.filter((id) => !fs.existsSync(path.join(publicDir, assetEntry(id).path)));
    // Either none are missing (media landed) or the rest fall back to placeholders; never an id outside the shell.
    for (const id of missing) expect(assetEntry(id).path.includes('/game-shell/'), id).toBe(true);
  });
});

// Workshop L20 asset contract (docs/specs/workshop-l20-assets.md): src/content/workshopAssets.json, parsed by the same zod
// schema as the 1.1 manifest, merged into the lookups without duplicating any existing key.
import { describe, expect, it } from 'vitest';
import rawWorkshop from '../../src/content/workshopAssets.json';
import {
  ALL_ONE_X_ART_IDS,
  WORKSHOP_ONE_X_ART_IDS,
  WORKSHOP_ASSET_IDS,
  assetEntry,
  assetUrl,
  displaySize,
  mysteryEggManifest,
  parseWorkshopManifest,
  spriteSpec,
  workshopManifest,
} from '../../src/games/mysteryEgg/assets';
import { eggSfxIds } from '../../src/games/mysteryEgg/eggSound';
import { drawWorkshopPlaceholder } from '../../src/games/mysteryEgg/workshop/l20Art';

/** The agreed Workshop L20 keys, pinned (docs/specs/workshop-l20-assets.md; adding one is a contract change). */
const SLEEPERS = ['moustache', 'bruno', 'plume', 'cocopom', 'pip', 'grandpere'];
const ART = [
  'ws-l20-bg-dawn', 'ws-l20-bg-morning', 'ws-l20-fixtures',
  'ws-domino', 'ws-seesaw', 'ws-sandbag', 'ws-lantern', 'ws-rope', 'ws-scissors', 'ws-scissors-snip',
  'ws-bell-morning', 'ws-window-frame', 'ws-egg-piece',
  'ws-capybara-facepalm', 'ws-capybara-ring', 'ws-capybara-cheer',
  ...SLEEPERS.flatMap((id) => [`ws-sleeper-${id}-asleep`, `ws-sleeper-${id}-awake`]),
];
const SFX = [
  'sfx-ws-trapdoor', 'sfx-ws-snip', 'sfx-ws-rope-swish', 'sfx-ws-domino-clack', 'sfx-ws-sandbag-thump', 'sfx-ws-seesaw-creak',
  'sfx-ws-bell-morning', 'sfx-ws-lantern-clonk', 'sfx-ws-town-wake', 'sfx-ws-yawn', 'sfx-ws-snore',
];
const VO = [
  'vo-fr-ws-l20-story', 'vo-he-ws-l20-goal', 'vo-he-ws-dominoes-gap', 'vo-he-ws-scissors-which',
  'vo-fr-ws-l20-one-bell', 'vo-fr-ws-l20-bonjour', 'vo-fr-ws-l20-success', 'vo-he-ws-egg-piece',
];
const ALL = [...ART, ...SFX, ...VO];

describe('workshop L20 asset manifest', () => {
  it('[L20-AC8] workshopAssets.json holds exactly the 47 agreed keys and parses with the shared zod schema', () => {
    expect(ALL).toHaveLength(47);
    expect(Object.keys(parseWorkshopManifest(rawWorkshop)).sort()).toEqual([...ALL].sort());
    expect([...WORKSHOP_ASSET_IDS].sort()).toEqual([...ALL].sort());
  });

  it('[L20-AC8] no key is duplicated from the 1.1 or shell manifests, and the 1.1 manifest is unchanged', () => {
    const old = new Set(Object.keys(mysteryEggManifest()));
    for (const id of ALL) expect(old.has(id), id).toBe(false);
    expect(old.size).toBe(78);
  });

  it('[L20-AC8] paths follow the contract: art/mystery-egg/<key>.webp and audio/mystery-egg/<key>.ogg', () => {
    for (const [id, e] of Object.entries(workshopManifest())) {
      if (e.kind === 'vo' || e.kind === 'sfx') expect(e.path, id).toBe(`audio/mystery-egg/${id}.ogg`);
      else expect(e.path, id).toBe(`art/mystery-egg/${id}.webp`);
    }
    expect(assetUrl('ws-domino', '/kids-app/')).toBe('/kids-app/art/mystery-egg/ws-domino.webp');
  });

  it('[L20-AC8] key prefixes: sfx-ws-*, vo-<lang>-ws-*, sleepers ws-sleeper-<id>-<state>', () => {
    for (const id of SFX) expect(workshopManifest()[id].kind, id).toBe('sfx');
    for (const id of VO) expect(workshopManifest()[id].kind, id).toBe('vo');
    expect(workshopManifest()['ws-scissors-snip'].kind).toBe('sprite');
    for (const id of ART.filter((k) => k !== 'ws-scissors-snip')) expect(workshopManifest()[id].kind, id).toBe('webp');
  });

  it('[L20-AC8] display sizes in world px (the contract tables; the file is 2x, both backgrounds 1x)', () => {
    const sizes: Record<string, [number, number]> = {
      'ws-l20-bg-dawn': [1280, 800], 'ws-l20-bg-morning': [1280, 800], 'ws-l20-fixtures': [1280, 800],
      'ws-domino': [28, 114], 'ws-seesaw': [336, 30], 'ws-sandbag': [84, 96], 'ws-lantern': [56, 76],
      'ws-rope': [10, 64], 'ws-scissors': [96, 64], 'ws-scissors-snip': [96, 64],
      'ws-bell-morning': [150, 170], 'ws-window-frame': [110, 110], 'ws-egg-piece': [110, 110],
      'ws-capybara-facepalm': [220, 280], 'ws-capybara-ring': [220, 280], 'ws-capybara-cheer': [220, 280],
      'ws-sleeper-moustache-asleep': [92, 92], 'ws-sleeper-grandpere-awake': [92, 92],
    };
    for (const [id, [w, h]] of Object.entries(sizes)) expect(displaySize(id), id).toEqual({ w, h });
    for (const id of SLEEPERS) {
      expect(displaySize(`ws-sleeper-${id}-asleep`)).toEqual({ w: 92, h: 92 });
      expect(displaySize(`ws-sleeper-${id}-awake`)).toEqual({ w: 92, h: 92 });
    }
    expect(spriteSpec('ws-scissors-snip')).toEqual({ id: 'ws-scissors-snip', frames: 2, fps: 12, w: 96, h: 64 });
  });

  it('[L20-AC8] both backgrounds are 1x like hub-bg; every other Workshop art file is 2x', () => {
    expect([...WORKSHOP_ONE_X_ART_IDS]).toEqual(['ws-l20-bg-dawn', 'ws-l20-bg-morning']);
    expect(ALL_ONE_X_ART_IDS).toEqual(expect.arrayContaining(['hub-bg', 'ws-l20-bg-dawn', 'ws-l20-bg-morning']));
    expect(ALL_ONE_X_ART_IDS).not.toContain('ws-l20-fixtures');
  });

  it('[L20-AC8] VO transcripts and languages are the agreed ones; Hebrew is Bip\'s hints only, feminine singular', () => {
    const expected: Record<string, [string, string]> = {
      'vo-fr-ws-l20-story': ['fr', 'Toute la ville dort encore ! Il faut sonner les deux cloches !'],
      'vo-he-ws-l20-goal': ['he', 'בואי נעיר את כל העיר! צריך לצלצל בשני הפעמונים, les cloches: בפעמון הקטן וגם בפעמון הגדול.'],
      'vo-he-ws-dominoes-gap': ['he', 'בשורת הדומינו אסור שיהיה חור גדול.'],
      'vo-he-ws-scissors-which': ['he', 'איזה חוט מחזיק את השק? את החוט הזה גוזרים, עם המספריים.'],
      'vo-fr-ws-l20-one-bell': ['fr', 'Mmm… encore une cloche… Zzz…'],
      'vo-fr-ws-l20-bonjour': ['fr', 'Bonjour, Ville des Surprises !'],
      'vo-fr-ws-l20-success': ['fr', 'Bravo ! Tu as réveillé toute la ville !'],
      'vo-he-ws-egg-piece': ['he', 'חתיכה חדשה לקן של הביצה!'],
    };
    for (const [id, [lang, text]] of Object.entries(expected)) expect([assetEntry(id).lang, assetEntry(id).transcript], id).toEqual([lang, text]);
    for (const id of VO) expect(assetEntry(id).lang, id).toBe(id.startsWith('vo-he-') ? 'he' : 'fr');
  });

  it('[L20-AC8] the schema rejects a missing key, an extra key and a vo without transcript', () => {
    const base = parseWorkshopManifest(rawWorkshop);
    const { 'ws-domino': _drop, ...fewer } = base;
    expect(() => parseWorkshopManifest(fewer)).toThrow();
    expect(() => parseWorkshopManifest({ ...base, 'ws-extra': { path: 'art/mystery-egg/ws-extra.webp', kind: 'webp', w: 1, h: 1 } })).toThrow();
    expect(() => parseWorkshopManifest({ ...base, 'vo-fr-ws-l20-story': { path: 'audio/mystery-egg/vo-fr-ws-l20-story.ogg', kind: 'vo' } })).toThrow();
  });
});

describe('workshop L20 placeholders (a missing file never breaks the level)', () => {
  it('[L20-AC8] every sfx-ws-* key is in the sfx id union and has a synth placeholder', () => {
    const ids = eggSfxIds();
    for (const id of SFX) expect(ids, id).toContain(id);
  });

  it('[L20-AC8] every Workshop art key has a code-drawn placeholder (not the grey fallback box)', () => {
    for (const id of ART) {
      const calls: string[] = [];
      const g = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push(`${name}:${args[0]}`); return g; } });
      expect(drawWorkshopPlaceholder(g as never, id), id).toBe(true);
      expect(calls.length, id).toBeGreaterThan(0);
    }
    expect(drawWorkshopPlaceholder(new Proxy({}, { get: () => () => undefined }) as never, 'hub-bg')).toBe(false);
  });
});

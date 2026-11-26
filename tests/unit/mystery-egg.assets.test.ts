import { describe, expect, it } from 'vitest';
import rawManifest from '../../src/content/mysteryEggAssets.json';
import {
  AssetAvailability,
  GAME_SHELL_ASSET_IDS,
  MYSTERY_EGG_ASSET_IDS,
  assetEntry,
  assetUrl,
  displaySize,
  entriesOfKind,
  mysteryEggManifest,
  parseAssetManifest,
  animatedSpriteSpec,
  spriteFrameRects,
  spriteSpec,
} from '../../src/games/mysteryEgg/assets';
import { HEART_SOCKETS_1X, heartSlotCentres } from '../../src/games/mysteryEgg/layout';

/** The ids agreed with the Gemini agent (docs/specs/mystery-egg-assets.md, aligned with PR #108). Do not extend without a spec change. */
const AGREED_IDS = [
  'hub-bg',
  'egg-nest-0', 'egg-nest-1', 'egg-nest-2', 'egg-nest-3', 'egg-nest-4', 'egg-nest-5',
  'bunny', 'robot', 'capybara', 'cat-asleep', 'cat-awake',
  'heart-panel', 'slot-empty', 'slot-filled',
  'part-ball', 'part-ramp', 'part-bell', 'part-domino', 'part-spring',
  'feather',
  'vo-fr-instruction', 'vo-fr-success', 'vo-fr-cat-croissants', 'vo-he-robot-help-1', 'vo-he-robot-help-2',
  'sfx-robot-beep-1', 'sfx-robot-beep-2', 'sfx-robot-beep-3', 'sfx-bell', 'sfx-ball-roll',
  'cat-wake', 'robot-blink', 'confetti',
  // Extras from Gemini's PR #108.
  'vo-fr-story', 'vo-fr-presque', 'vo-fr-robot-regarde', 'vo-fr-robot-aide', 'vo-he-robot-breathe',
  'sfx-success', 'sfx-pop',
];

/** The 38 game shell ids are pinned in tests/unit/game-shell.assets.test.ts; here only the prototype ids are. */
const SHELL = new Set<string>(GAME_SHELL_ASSET_IDS);
const prototypeIds = (ids: string[]): string[] => ids.filter((id) => !SHELL.has(id)).sort();

describe('mystery-egg asset manifest', () => {
  it('[AC-14] parses with zod and contains exactly the agreed ids (41 prototype ids plus the game shell ids)', () => {
    const parsed = parseAssetManifest(rawManifest);
    expect(prototypeIds(Object.keys(parsed))).toEqual([...AGREED_IDS].sort());
    expect([...MYSTERY_EGG_ASSET_IDS].sort()).toEqual([...AGREED_IDS, ...GAME_SHELL_ASSET_IDS].sort());
    expect(Object.keys(mysteryEggManifest()).sort()).toEqual([...MYSTERY_EGG_ASSET_IDS].sort());
  });

  it('[AC-14] paths follow the contract: art/mystery-egg/<id>.webp and audio/mystery-egg/<id>.ogg, relative to the app base', () => {
    for (const [id, e] of Object.entries(parseAssetManifest(rawManifest))) {
      if (e.kind === 'vo' || e.kind === 'sfx') expect(e.path, id).toBe(`audio/mystery-egg/${id}.ogg`);
      else expect(e.path, id).toBe(`art/mystery-egg/${id}.webp`);
      expect(e.path.startsWith('/'), id).toBe(false);
      expect(e.path.includes('public'), id).toBe(false);
    }
  });

  it('[AC-14] kinds: all static art is webp, exactly three sprite strips (cat-wake, robot-blink, confetti), no svg paths', () => {
    const m = parseAssetManifest(rawManifest);
    expect(entriesOfKind('sprite').map(([id]) => id).sort()).toEqual(['cat-wake', 'confetti', 'robot-blink']);
    expect(Object.values(m).some((e) => e.kind === 'svg')).toBe(false);
    expect(Object.values(m).some((e) => e.path.endsWith('.svg'))).toBe(false);
    for (const id of ['hub-bg', 'bunny', 'robot', 'feather', 'part-ramp', 'egg-nest-3']) expect(m[id].kind, id).toBe('webp');
    for (const id of ['sfx-bell', 'sfx-ball-roll', 'sfx-robot-beep-1', 'sfx-success', 'sfx-pop']) expect(m[id].kind, id).toBe('sfx');
  });

  it('[AC-14] every vo-* entry has a transcript and a language; the transcripts are the ones Gemini verified (PR #108) and the Hebrew ones do not name the child', () => {
    const vos = entriesOfKind('vo').filter(([id]) => !SHELL.has(id));
    expect(vos.map(([id]) => id).sort()).toEqual([
      'vo-fr-cat-croissants', 'vo-fr-instruction', 'vo-fr-presque', 'vo-fr-robot-aide', 'vo-fr-robot-regarde', 'vo-fr-story', 'vo-fr-success',
      'vo-he-robot-breathe', 'vo-he-robot-help-1', 'vo-he-robot-help-2',
    ]);
    for (const [id, e] of vos) {
      expect(e.transcript, id).toBeTruthy();
      expect(e.lang, id).toBe(id.startsWith('vo-he-') ? 'he' : 'fr');
      if (e.lang === 'he') expect(e.transcript, id).not.toMatch(/elli/i);
    }
    expect(assetEntry('vo-fr-instruction').transcript).toBe('Réveille Monsieur Moustache ! Fais rouler la balle pour sonner la cloche.');
    expect(assetEntry('vo-fr-story').transcript).toBe('Oh non ! Monsieur Moustache dort, et il n\'y a pas de croissants !');
    expect(assetEntry('vo-fr-success').transcript).toBe('Bravo ! Tu as réveillé Monsieur Moustache !');
    expect(assetEntry('vo-fr-presque').transcript).toBe('Presque !');
    expect(assetEntry('vo-fr-cat-croissants').transcript).toBe('(Mmm,) Mes croissants ! (Mmm,) Merci beaucoup !');
    // Gemini's final trimmed recording (PR #110): Hebrew with the French key words.
    expect(assetEntry('vo-he-robot-help-1').transcript).toBe('בואי נעיר אותו! הכדור, la balle, צריך לצלצל בפעמון, la cloche!');
    expect(assetEntry('vo-he-robot-help-1').lang).toBe('he');
    expect(assetEntry('vo-he-robot-help-2').transcript).toBe('שימי את הרמפה במקום שזוהר.');
    expect(assetEntry('vo-he-robot-breathe').transcript).toBe('קחי נשימה, תחשבי, ותנסי שוב!');
    expect(assetEntry('vo-fr-robot-regarde').transcript).toBe('Regarde ici !');
    expect(assetEntry('vo-fr-robot-aide').transcript).toBe('Je t\'aide un peu !');
  });

  it('[AC-14] every art entry has a display size (half of the 2x file px from PR #108; hub-bg is 1x); sprites have frames, and the animated ones have fps', () => {
    for (const [id, e] of Object.entries(parseAssetManifest(rawManifest))) {
      if (e.kind === 'webp' || e.kind === 'sprite') {
        expect(e.w, id).toBeGreaterThan(0);
        expect(e.h, id).toBeGreaterThan(0);
      }
    }
    // Display px (w, h) = Gemini's file px / 2; single-frame size for strips.
    const sizes: Record<string, [number, number]> = {
      'hub-bg': [1280, 800], bunny: [200, 300], robot: [140, 180], capybara: [220, 280],
      'cat-asleep': [320, 220], 'cat-awake': [320, 320], 'heart-panel': [320, 80], 'slot-empty': [48, 48], 'slot-filled': [48, 48],
      'part-ball': [64, 64], 'part-ramp': [240, 140], 'part-bell': [96, 110], 'part-domino': [48, 110], 'part-spring': [80, 110],
      feather: [120, 120], 'egg-nest-0': [360, 300], 'egg-nest-5': [360, 300],
      'cat-wake': [320, 320], 'robot-blink': [140, 180], confetti: [32, 32],
    };
    for (const [id, [w, h]] of Object.entries(sizes)) expect([assetEntry(id).w, assetEntry(id).h], id).toEqual([w, h]);
    expect(assetEntry('cat-wake')).toMatchObject({ frames: 6, fps: 8 });
    expect(assetEntry('robot-blink')).toMatchObject({ frames: 4, fps: 10 });
    expect(assetEntry('confetti')).toMatchObject({ frames: 6 });
    expect(assetEntry('confetti').fps).toBeUndefined();
  });

  it('[AC-14] the schema rejects a vo entry without transcript or lang, a sprite without frames, and bad paths', () => {
    const base = parseAssetManifest(rawManifest);
    expect(() => parseAssetManifest({ ...base, 'vo-fr-instruction': { path: 'audio/mystery-egg/vo-fr-instruction.ogg', kind: 'vo' } })).toThrow();
    expect(() => parseAssetManifest({ ...base, 'cat-wake': { path: 'art/mystery-egg/cat-wake.webp', kind: 'sprite', w: 10, h: 10 } })).toThrow();
    expect(() => parseAssetManifest({ ...base, 'cat-wake': { path: 'art/mystery-egg/cat-wake.webp', kind: 'sprite', w: 10, h: 10, frames: 6 } })).not.toThrow();
    expect(() => parseAssetManifest({ ...base, hub: { path: '/abs/hub.webp', kind: 'webp', w: 1, h: 1 } })).toThrow();
    expect(() => parseAssetManifest({ ...base, extra: { path: 'art/mystery-egg/extra.webp', kind: 'webp', w: 1, h: 1 } })).toThrow();
  });
});

describe('mystery-egg asset loading tolerance', () => {
  it('[AC-15] URLs respect the Vite base, with or without a trailing slash', () => {
    expect(assetUrl('hub-bg', '/kids-app/')).toBe('/kids-app/art/mystery-egg/hub-bg.webp');
    expect(assetUrl('hub-bg', '/kids-app')).toBe('/kids-app/art/mystery-egg/hub-bg.webp');
    expect(assetUrl('sfx-bell', '/')).toBe('/audio/mystery-egg/sfx-bell.ogg');
  });

  it('[AC-15] a failed key is marked missing; unknown keys count as not missing until they fail; marking is idempotent', () => {
    const a = new AssetAvailability();
    expect(a.isMissing('bunny')).toBe(false);
    expect(a.isReady('bunny')).toBe(false);
    a.markMissing('bunny');
    a.markMissing('bunny');
    expect(a.isMissing('bunny')).toBe(true);
    expect(a.isReady('bunny')).toBe(false);
    a.markLoaded('robot');
    expect(a.isReady('robot')).toBe(true);
    expect(a.isMissing('robot')).toBe(false);
    // A later success (files dropped in, cache refreshed) clears the missing flag.
    a.markLoaded('bunny');
    expect(a.isMissing('bunny')).toBe(false);
    expect(a.isReady('bunny')).toBe(true);
  });

  it('[AC-15] sprite frames, fps, w and h are read from the manifest, never hardcoded', () => {
    const raw = rawManifest as unknown as Record<string, { frames: number; fps?: number; w: number; h: number }>;
    for (const id of ['cat-wake', 'robot-blink']) {
      expect(spriteSpec(id), id).toEqual({ id, frames: raw[id].frames, fps: raw[id].fps, w: raw[id].w, h: raw[id].h });
    }
    // The confetti strip is a set of particle frames, not an animation: no fps.
    expect(spriteSpec('confetti')).toEqual({ id: 'confetti', frames: 6, fps: undefined, w: 32, h: 32 });
    expect(() => spriteSpec('hub-bg')).toThrow();
    expect(() => animatedSpriteSpec('confetti')).toThrow();
    expect(animatedSpriteSpec('cat-wake').fps).toBe(8);
  });

  it('[AC-15] frame rectangles come from the real texture width, so any file scale works', () => {
    expect(spriteFrameRects(4, 800, 260)).toEqual([
      { index: 0, x: 0, y: 0, width: 200, height: 260 },
      { index: 1, x: 200, y: 0, width: 200, height: 260 },
      { index: 2, x: 400, y: 0, width: 200, height: 260 },
      { index: 3, x: 600, y: 0, width: 200, height: 260 },
    ]);
    // A 2x file gives bigger frames; the count stays the manifest's.
    expect(spriteFrameRects(6, 3840, 640)).toHaveLength(6);
    expect(spriteFrameRects(6, 3840, 640)[5]).toMatchObject({ x: 3200, width: 640, height: 640 });
    expect(spriteFrameRects(0, 100, 100)).toEqual([]);
  });
});

describe('mystery-egg heart panel geometry (PR #108)', () => {
  it('[AC-14] the 5 sockets sit at x = 40/100/160/220/280, y = 40 on the 1x panel; slots are centred on them at the same scale', () => {
    expect(HEART_SOCKETS_1X.x).toEqual([40, 100, 160, 220, 280]);
    expect(HEART_SOCKETS_1X.y).toBe(40);
    const panel = displaySize('heart-panel');
    expect(panel).toEqual({ w: 320, h: 80 });
    const at1 = heartSlotCentres(160, 40, panel, 1);
    expect(at1.map((p) => p.x)).toEqual([40, 100, 160, 220, 280]);
    expect(at1.every((p) => p.y === 40)).toBe(true);
    // Scaled 1.5 and centred at (640, 100): the middle socket is under the panel centre.
    const scaled = heartSlotCentres(640, 100, panel, 1.5);
    expect(scaled[2]).toEqual({ x: 640, y: 100 });
    expect(scaled[1].x).toBeCloseTo(640 - 90, 5);
    expect(scaled[4].x).toBeCloseTo(640 + 180, 5);
    expect(displaySize('slot-empty')).toEqual({ w: 48, h: 48 });
  });
});

import { describe, expect, it } from 'vitest';
import rawManifest from '../../src/content/mysteryEggAssets.json';
import {
  AssetAvailability,
  MYSTERY_EGG_ASSET_IDS,
  assetEntry,
  assetUrl,
  entriesOfKind,
  mysteryEggManifest,
  parseAssetManifest,
  spriteFrameRects,
  spriteSpec,
} from '../../src/games/mysteryEgg/assets';

/** The ids agreed with the Gemini agent (docs/specs/mystery-egg-assets.md). Do not extend without a spec change. */
const AGREED_IDS = [
  'hub-bg',
  'egg-nest-0', 'egg-nest-1', 'egg-nest-2', 'egg-nest-3', 'egg-nest-4', 'egg-nest-5',
  'bunny', 'robot', 'capybara', 'cat-asleep', 'cat-awake',
  'heart-panel', 'slot-empty', 'slot-filled',
  'part-ball', 'part-ramp', 'part-bell', 'part-domino', 'part-spring',
  'feather', 'confetti',
  'vo-fr-instruction', 'vo-fr-success', 'vo-fr-cat-croissants', 'vo-he-robot-help-1', 'vo-he-robot-help-2',
  'sfx-robot-beep-1', 'sfx-robot-beep-2', 'sfx-robot-beep-3', 'sfx-bell', 'sfx-ball-roll',
  'cat-wake', 'robot-blink',
];

describe('mystery-egg asset manifest', () => {
  it('[AC-14] parses with zod and contains exactly the agreed ids', () => {
    const parsed = parseAssetManifest(rawManifest);
    expect(Object.keys(parsed).sort()).toEqual([...AGREED_IDS].sort());
    expect([...MYSTERY_EGG_ASSET_IDS].sort()).toEqual([...AGREED_IDS].sort());
    expect(Object.keys(mysteryEggManifest()).sort()).toEqual([...AGREED_IDS].sort());
  });

  it('[AC-14] paths follow the contract: art/mystery-egg/<id>.webp and audio/mystery-egg/<id>.ogg, relative to the app base', () => {
    for (const [id, e] of Object.entries(parseAssetManifest(rawManifest))) {
      if (e.kind === 'vo' || e.kind === 'sfx') expect(e.path, id).toBe(`audio/mystery-egg/${id}.ogg`);
      else expect(e.path, id).toBe(`art/mystery-egg/${id}.webp`);
      expect(e.path.startsWith('/'), id).toBe(false);
      expect(e.path.includes('public'), id).toBe(false);
    }
  });

  it('[AC-14] kinds: all static art is webp, exactly two sprite entries, no svg paths', () => {
    const m = parseAssetManifest(rawManifest);
    expect(entriesOfKind('sprite').map(([id]) => id).sort()).toEqual(['cat-wake', 'robot-blink']);
    expect(Object.values(m).some((e) => e.kind === 'svg')).toBe(false);
    expect(Object.values(m).some((e) => e.path.endsWith('.svg'))).toBe(false);
    for (const id of ['hub-bg', 'bunny', 'robot', 'feather', 'confetti', 'part-ramp', 'egg-nest-3']) expect(m[id].kind, id).toBe('webp');
    for (const id of ['sfx-bell', 'sfx-ball-roll', 'sfx-robot-beep-1']) expect(m[id].kind, id).toBe('sfx');
  });

  it('[AC-14] every vo-* entry has a transcript and a language, Hebrew lines are he and French lines are fr', () => {
    const vos = entriesOfKind('vo');
    expect(vos.map(([id]) => id).sort()).toEqual(['vo-fr-cat-croissants', 'vo-fr-instruction', 'vo-fr-success', 'vo-he-robot-help-1', 'vo-he-robot-help-2']);
    for (const [id, e] of vos) {
      expect(e.transcript, id).toBeTruthy();
      expect(e.lang, id).toBe(id.startsWith('vo-he-') ? 'he' : 'fr');
    }
    expect(assetEntry('vo-fr-instruction').transcript).toBe('Monsieur Moustache dort ! Il doit faire les croissants !');
  });

  it('[AC-14] every art entry has a display size; the sprite entries have frames, fps, w and h', () => {
    for (const [id, e] of Object.entries(parseAssetManifest(rawManifest))) {
      if (e.kind === 'webp' || e.kind === 'sprite') {
        expect(e.w, id).toBeGreaterThan(0);
        expect(e.h, id).toBeGreaterThan(0);
      }
    }
    for (const id of ['cat-wake', 'robot-blink']) {
      const e = assetEntry(id);
      expect(e.frames, id).toBeGreaterThan(1);
      expect(e.fps, id).toBeGreaterThan(0);
    }
    expect(assetEntry('cat-wake')).toMatchObject({ frames: 8, fps: 10 });
    expect(assetEntry('robot-blink')).toMatchObject({ frames: 4, fps: 10 });
  });

  it('[AC-14] the schema rejects a vo entry without transcript or lang, a sprite without frames, and bad paths', () => {
    const base = parseAssetManifest(rawManifest);
    expect(() => parseAssetManifest({ ...base, 'vo-fr-instruction': { path: 'audio/mystery-egg/vo-fr-instruction.ogg', kind: 'vo' } })).toThrow();
    expect(() => parseAssetManifest({ ...base, 'cat-wake': { path: 'art/mystery-egg/cat-wake.webp', kind: 'sprite', w: 10, h: 10 } })).toThrow();
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
    const spec = spriteSpec('cat-wake');
    const raw = (rawManifest as unknown as Record<string, { frames: number; fps: number; w: number; h: number }>)['cat-wake'];
    expect(spec).toEqual({ id: 'cat-wake', frames: raw.frames, fps: raw.fps, w: raw.w, h: raw.h });
    expect(() => spriteSpec('hub-bg')).toThrow();
  });

  it('[AC-15] frame rectangles come from the real texture width, so any file scale works', () => {
    expect(spriteFrameRects(4, 800, 260)).toEqual([
      { index: 0, x: 0, y: 0, width: 200, height: 260 },
      { index: 1, x: 200, y: 0, width: 200, height: 260 },
      { index: 2, x: 400, y: 0, width: 200, height: 260 },
      { index: 3, x: 600, y: 0, width: 200, height: 260 },
    ]);
    // A 2x file gives bigger frames; the count stays the manifest's.
    expect(spriteFrameRects(8, 4800, 680)).toHaveLength(8);
    expect(spriteFrameRects(8, 4800, 680)[7]).toMatchObject({ x: 4200, width: 600 });
    expect(spriteFrameRects(0, 100, 100)).toEqual([]);
  });
});

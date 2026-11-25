// Mystery Egg asset manifest: zod-validated, typed lookups, and Phaser-free helpers for missing-file tolerance.
// Contract (frozen with the Gemini agent): docs/specs/mystery-egg-assets.md. The Gemini PR adds the media files only;
// this code reads sizes, frames and fps from `src/content/mysteryEggAssets.json` and tolerates any file being absent.
import { z } from 'zod';
import rawManifest from '../../content/mysteryEggAssets.json';

export const assetKindSchema = z.enum(['svg', 'webp', 'sprite', 'vo', 'sfx']);
export type AssetKind = z.infer<typeof assetKindSchema>;

/** Paths are relative to the app base (Vite `import.meta.env.BASE_URL`), never absolute and never under `public/`. */
const relativePath = z
  .string()
  .min(1)
  .refine((p) => !p.startsWith('/') && !p.startsWith('public/') && !p.includes('..'), 'path must be relative to the app base');

export const assetEntrySchema = z
  .object({
    path: relativePath,
    kind: assetKindSchema,
    w: z.number().positive().optional(),
    h: z.number().positive().optional(),
    frames: z.number().int().positive().optional(),
    fps: z.number().positive().optional(),
    transcript: z.string().min(1).optional(),
    lang: z.enum(['fr', 'he']).optional(),
  })
  .superRefine((e, ctx) => {
    const need = (ok: boolean, message: string): void => {
      if (!ok) ctx.addIssue({ code: z.ZodIssueCode.custom, message });
    };
    if (e.kind === 'webp' || e.kind === 'svg' || e.kind === 'sprite') need(e.w !== undefined && e.h !== undefined, `${e.kind} needs w and h`);
    // fps is optional: a strip of particle frames (confetti) is not an animation.
    if (e.kind === 'sprite') need(e.frames !== undefined, 'sprite needs frames');
    if (e.kind === 'vo') need(Boolean(e.transcript) && e.lang !== undefined, 'vo needs transcript and lang');
    if (e.kind === 'webp' || e.kind === 'sprite') need(/^art\/mystery-egg\/[a-z0-9-]+\.webp$/.test(e.path), 'art path must be art/mystery-egg/<id>.webp');
    if (e.kind === 'vo' || e.kind === 'sfx') need(/^audio\/mystery-egg\/[a-z0-9-]+\.ogg$/.test(e.path), 'audio path must be audio/mystery-egg/<id>.ogg');
  });

export type AssetEntry = z.infer<typeof assetEntrySchema>;

/** Exactly the ids agreed with the Gemini agent, incl. the extras of PR #108 (a spec change is needed to add one). */
export const MYSTERY_EGG_ASSET_IDS = [
  'hub-bg',
  'egg-nest-0', 'egg-nest-1', 'egg-nest-2', 'egg-nest-3', 'egg-nest-4', 'egg-nest-5',
  'bunny', 'robot', 'capybara', 'cat-asleep', 'cat-awake',
  'heart-panel', 'slot-empty', 'slot-filled',
  'part-ball', 'part-ramp', 'part-bell', 'part-domino', 'part-spring',
  'feather',
  'vo-fr-instruction', 'vo-fr-success', 'vo-fr-cat-croissants', 'vo-he-robot-help-1', 'vo-he-robot-help-2',
  'sfx-robot-beep-1', 'sfx-robot-beep-2', 'sfx-robot-beep-3', 'sfx-bell', 'sfx-ball-roll',
  'cat-wake', 'robot-blink', 'confetti',
  // Extras added by the Gemini media PR #108.
  'vo-fr-story', 'vo-fr-presque', 'vo-fr-robot-regarde', 'vo-fr-robot-aide', 'vo-he-robot-breathe',
  'sfx-success', 'sfx-pop',
] as const;
export type MysteryEggAssetId = (typeof MYSTERY_EGG_ASSET_IDS)[number];

export type AssetManifest = Record<string, AssetEntry>;

/** Validates a manifest and requires exactly the agreed ids. Throws a ZodError / Error on any violation. */
export function parseAssetManifest(input: unknown): AssetManifest {
  const parsed = z.record(assetEntrySchema).parse(input);
  const have = Object.keys(parsed).sort().join(',');
  const want = [...MYSTERY_EGG_ASSET_IDS].sort().join(',');
  if (have !== want) throw new Error(`Mystery Egg manifest ids differ from the agreed set.\nhave: ${have}\nwant: ${want}`);
  return parsed;
}

let cached: AssetManifest | null = null;
export function mysteryEggManifest(): AssetManifest {
  cached ??= parseAssetManifest(rawManifest);
  return cached;
}

export function assetEntry(id: string): AssetEntry {
  const entry = mysteryEggManifest()[id];
  if (!entry) throw new Error(`Unknown Mystery Egg asset id: ${id}`);
  return entry;
}

export function entriesOfKind(kind: AssetKind): Array<[string, AssetEntry]> {
  return Object.entries(mysteryEggManifest()).filter(([, e]) => e.kind === kind);
}

/** Joins the Vite base ("/kids-app/") with the manifest path of `id`. */
export function assetUrl(id: string, base: string): string {
  const b = base.endsWith('/') ? base : `${base}/`;
  return `${b}${assetEntry(id).path}`;
}

/**
 * Display size in game px of a static entry, or of ONE frame of a sprite strip. Convention: w,h are HALF of the 2x file
 * pixels Gemini delivers (hub-bg is 1x: 1280x800 file = 1280x800 display).
 */
export function displaySize(id: string): { w: number; h: number } {
  const e = assetEntry(id);
  if (e.w === undefined || e.h === undefined) throw new Error(`Asset ${id} has no display size`);
  return { w: e.w, h: e.h };
}

export interface SpriteSpec {
  id: string;
  frames: number;
  /** Frames per second; undefined for a strip of particle frames (confetti). */
  fps: number | undefined;
  /** Single-frame display size in game px. */
  w: number;
  h: number;
}

/** Frames, fps and the single-frame size of a sprite entry, read from the manifest. */
export function spriteSpec(id: string): SpriteSpec {
  const e = assetEntry(id);
  if (e.kind !== 'sprite' || e.frames === undefined || e.w === undefined || e.h === undefined) {
    throw new Error(`Asset ${id} is not a sprite entry`);
  }
  return { id, frames: e.frames, fps: e.fps, w: e.w, h: e.h };
}

/** A sprite strip that is an animation: `fps` is required. */
export function animatedSpriteSpec(id: string): SpriteSpec & { fps: number } {
  const spec = spriteSpec(id);
  if (spec.fps === undefined) throw new Error(`Sprite ${id} has no fps (it is a strip of particle frames)`);
  return { ...spec, fps: spec.fps };
}

export interface FrameRect {
  index: number;
  x: number;
  y: number;
  width: number;
  height: number;
}

/**
 * Frame rectangles of a horizontal strip. The frame width comes from the REAL texture width divided by the manifest's
 * frame count, so a 1x or 2x file both work without a code change.
 */
export function spriteFrameRects(frames: number, textureWidth: number, textureHeight: number): FrameRect[] {
  if (frames <= 0) return [];
  const width = textureWidth / frames;
  return Array.from({ length: frames }, (_, index) => ({ index, x: index * width, y: 0, width, height: textureHeight }));
}

/** Which assets failed to load (Phaser `loaderror`) and which loaded. Pure bookkeeping; lookups never throw. */
export class AssetAvailability {
  private readonly missing = new Set<string>();
  private readonly loaded = new Set<string>();

  markMissing(id: string): void {
    this.loaded.delete(id);
    this.missing.add(id);
  }

  markLoaded(id: string): void {
    this.missing.delete(id);
    this.loaded.add(id);
  }

  isMissing(id: string): boolean {
    return this.missing.has(id);
  }

  /** True only when the file really loaded: callers draw a placeholder otherwise. */
  isReady(id: string): boolean {
    return this.loaded.has(id);
  }
}

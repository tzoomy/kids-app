// Mystery Egg asset manifest: zod-validated, typed lookups, and Phaser-free helpers for missing-file tolerance.
// Contract (frozen with the Gemini agent): docs/specs/mystery-egg-assets.md. The Gemini PR adds the media files only;
// this code reads sizes, frames and fps from `src/content/mysteryEggAssets.json` and tolerates any file being absent.
import { z } from 'zod';
import rawManifest from '../../content/mysteryEggAssets.json';
import rawShellManifest from '../../content/gameShellAssets.json';
import rawWorkshopManifest from '../../content/workshopAssets.json';

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
    if (e.kind === 'webp' || e.kind === 'sprite') need(/^art\/(mystery-egg|game-shell)\/[a-z0-9-]+\.webp$/.test(e.path), 'art path must be art/<mystery-egg|game-shell>/<id>.webp');
    if (e.kind === 'vo' || e.kind === 'sfx') need(/^audio\/(mystery-egg|game-shell)\/[a-z0-9-]+\.ogg$/.test(e.path), 'audio path must be audio/<mystery-egg|game-shell>/<id>.ogg');
  });

export type AssetEntry = z.infer<typeof assetEntrySchema>;

/** The prototype's ids agreed with the Gemini agent, incl. the extras of PR #108 (a spec change is needed to add one). */
const PROTOTYPE_ASSET_IDS = [
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

/**
 * The game shell ids: Gemini's media contract (`src/content/gameShellAssets.json`, paths under art|audio/game-shell/).
 * The files arrive with Gemini's media PR; until then every one falls back to a placeholder.
 */
export const GAME_SHELL_ASSET_IDS = [
  'shell-intro-1', 'shell-intro-2', 'shell-intro-3', 'shell-intro-4', 'shell-ws-1', 'shell-ws-2',
  'map-bg', 'map-nest-home',
  'map-world-workshop-open', 'map-world-workshop-closed', 'map-world-bakery-open', 'map-world-bakery-closed',
  'map-world-detective-open', 'map-world-detective-closed', 'map-world-jungle-open', 'map-world-jungle-closed',
  'map-world-garden-open', 'map-world-garden-closed',
  'map-bunny-idle', 'map-bunny-walk', 'map-robot-idle', 'map-robot-walk', 'map-capybara-idle', 'map-capybara-walk', 'map-frog-idle', 'map-frog-walk',
  'vo-shell-intro-1-hero', 'vo-shell-intro-1-narr', 'vo-shell-intro-2-hero', 'vo-shell-intro-2-robot',
  'vo-shell-intro-3-hero', 'vo-shell-intro-3-robot', 'vo-shell-intro-4-hero', 'vo-shell-intro-4-narr',
  'vo-shell-ws-1-hero', 'vo-shell-ws-1-narr', 'vo-shell-ws-2-robot',
] as const;

const WORKSHOP_SLEEPERS = ['moustache', 'bruno', 'plume', 'cocopom', 'pip', 'grandpere'] as const;

/**
 * Workshop level 20 ids: the media contract `docs/specs/workshop-l20-assets.md`, manifest `src/content/workshopAssets.json`
 * (a separate file: the 1.1 manifest's ids are pinned). Existing keys (part-ramp, part-bell, capybara, egg-nest-N, ...) are
 * reused by their existing key and never listed here. `ws-string-socket` is code-only (no file).
 */
export const WORKSHOP_ASSET_IDS = [
  'ws-l20-bg-dawn', 'ws-l20-bg-morning', 'ws-l20-fixtures',
  'ws-domino', 'ws-seesaw', 'ws-sandbag', 'ws-lantern', 'ws-rope', 'ws-scissors', 'ws-scissors-snip',
  'ws-bell-morning', 'ws-window-frame', 'ws-egg-piece',
  'ws-capybara-facepalm', 'ws-capybara-ring', 'ws-capybara-cheer',
  ...WORKSHOP_SLEEPERS.flatMap((id) => [`ws-sleeper-${id}-asleep`, `ws-sleeper-${id}-awake`]),
  'sfx-ws-trapdoor', 'sfx-ws-snip', 'sfx-ws-rope-swish', 'sfx-ws-domino-clack', 'sfx-ws-sandbag-thump', 'sfx-ws-seesaw-creak',
  'sfx-ws-bell-morning', 'sfx-ws-lantern-clonk', 'sfx-ws-town-wake', 'sfx-ws-yawn', 'sfx-ws-snore',
  'vo-fr-ws-l20-story', 'vo-he-ws-l20-goal', 'vo-he-ws-dominoes-gap', 'vo-he-ws-scissors-which',
  'vo-fr-ws-l20-one-bell', 'vo-fr-ws-l20-bonjour', 'vo-fr-ws-l20-success', 'vo-he-ws-egg-piece',
] as const;

/** Every id of the combined manifest. */
export const MYSTERY_EGG_ASSET_IDS = [...PROTOTYPE_ASSET_IDS, ...GAME_SHELL_ASSET_IDS] as const;
export type MysteryEggAssetId = (typeof MYSTERY_EGG_ASSET_IDS)[number];

/** Full-screen images delivered at 1x (file px = display px); every other art file is 2x. */
export const ONE_X_ART_IDS: readonly string[] = ['hub-bg', 'map-bg', 'shell-intro-1', 'shell-intro-2', 'shell-intro-3', 'shell-intro-4', 'shell-ws-1', 'shell-ws-2'];

/** The Workshop L20 full-screen backgrounds, also delivered at 1x (every other Workshop art file is 2x). */
export const WORKSHOP_ONE_X_ART_IDS: readonly string[] = ['ws-l20-bg-dawn', 'ws-l20-bg-morning'];
/** Every 1x art id of every manifest. */
export const ALL_ONE_X_ART_IDS: readonly string[] = [...ONE_X_ART_IDS, ...WORKSHOP_ONE_X_ART_IDS];

export type AssetManifest = Record<string, AssetEntry>;

function parseExact(input: unknown, ids: readonly string[], label: string): AssetManifest {
  const parsed = z.record(assetEntrySchema).parse(input);
  const have = Object.keys(parsed).sort().join(',');
  const want = [...ids].sort().join(',');
  if (have !== want) throw new Error(`${label} ids differ from the agreed set.\nhave: ${have}\nwant: ${want}`);
  return parsed;
}

/** Validates `mysteryEggAssets.json` and requires exactly the prototype's agreed ids. Throws on any violation. */
export function parseAssetManifest(input: unknown): AssetManifest {
  return parseExact(input, PROTOTYPE_ASSET_IDS, 'Mystery Egg manifest');
}

/** Validates `gameShellAssets.json` (Gemini's media contract) and requires exactly its ids. */
export function parseGameShellManifest(input: unknown): AssetManifest {
  return parseExact(input, GAME_SHELL_ASSET_IDS, 'Game shell manifest');
}

/** Validates `workshopAssets.json` (the Workshop L20 contract) and requires exactly its ids. */
export function parseWorkshopManifest(input: unknown): AssetManifest {
  return parseExact(input, WORKSHOP_ASSET_IDS, 'Workshop manifest');
}

/** One combined manifest from several files; the same id in two files is an error. */
export function mergeManifests(...parts: AssetManifest[]): AssetManifest {
  const out: AssetManifest = {};
  for (const part of parts) {
    for (const [id, entry] of Object.entries(part)) {
      if (id in out) throw new Error(`Duplicate asset id across manifest files: ${id}`);
      out[id] = entry;
    }
  }
  return out;
}

let cached: AssetManifest | null = null;
export function mysteryEggManifest(): AssetManifest {
  cached ??= mergeManifests(parseAssetManifest(rawManifest), parseGameShellManifest(rawShellManifest));
  return cached;
}

let cachedWorkshop: AssetManifest | null = null;
/** The Workshop L20 manifest alone. */
export function workshopManifest(): AssetManifest {
  cachedWorkshop ??= parseWorkshopManifest(rawWorkshopManifest);
  return cachedWorkshop;
}

let cachedAll: AssetManifest | null = null;
/** Every manifest file merged (1.1 + game shell + Workshop); a duplicated key throws. Lookups by id use this. */
export function allAssetsManifest(): AssetManifest {
  cachedAll ??= mergeManifests(mysteryEggManifest(), workshopManifest());
  return cachedAll;
}

/** Voice line ids of every manifest (the voice provider plays all of them). */
export function allVoiceIds(): string[] {
  return Object.entries(allAssetsManifest()).filter(([, e]) => e.kind === 'vo').map(([id]) => id);
}

export function assetEntry(id: string): AssetEntry {
  const entry = allAssetsManifest()[id];
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

import { ART_MANIFEST, type ArtManifestEntry } from '../../assets/art/manifest';

/**
 * Art for the Language House picker.
 *
 * The real SVGs arrive on branch art/language-house-picker, which registers these same four keys in
 * src/assets/art/manifest.ts. Until then the placeholder block below stands in. `resolvePickerAsset`
 * looks in the manifest first, so once the art branch lands the real files win with no code change here.
 * Do NOT add these keys to ART_MANIFEST on this branch (see docs/assets/language-house-picker.md).
 */
export const PICKER_ASSET_KEYS = [
  'picker-card-animal-restaurant',
  'picker-card-kitchen-orchestra',
  'picker-close',
  'picker-bg',
] as const;

export type PickerAssetKey = (typeof PICKER_ASSET_KEYS)[number];

export type PickerAsset =
  | { key: string; kind: 'manifest' | 'placeholder'; url: string }
  | { key: string; kind: 'css'; css: string };

/**
 * Intrinsic sizes of the real art on draft PR #40 (art/language-house-picker), which registers the same keys
 * with these sizes in ART_MANIFEST. The layout is sized to them so merging #40 only swaps the files in.
 */
export const PICKER_ART_SIZES: Record<PickerAssetKey, { width: number; height: number }> = {
  'picker-card-animal-restaurant': { width: 640, height: 800 },
  'picker-card-kitchen-orchestra': { width: 640, height: 800 },
  'picker-close': { width: 128, height: 128 }, // shown at about 120 CSS px
  'picker-bg': { width: 1280, height: 800 }, // cover in portrait
};

/** Placeholder block: each key maps to an existing art file under `public/` or to a CSS shape. */
const PLACEHOLDERS: Record<PickerAssetKey, { url: string } | { css: string }> = {
  'picker-card-animal-restaurant': { url: 'art/scenes/restaurant/bg-landscape.svg' },
  'picker-card-kitchen-orchestra': { url: 'art/scenes/kitchen/bg-landscape.svg' },
  'picker-bg': { url: 'art/scenes/restaurant/bg-landscape.svg' },
  'picker-close': { css: 'background:#FFFDF9;border-radius:50%' },
};

/** Leisure Corner picker cards (additive; not part of PICKER_ASSET_KEYS, which pins the Language House art). */
const LEISURE_PLACEHOLDERS: Record<string, { url: string } | { css: string }> = {
  'picker-card-bubbles': { css: 'background:linear-gradient(180deg,#a1c4fd,#c2e9fb)' },
  'picker-card-colouring': { url: 'art/colouring/pages/cat.svg' },
  // Number Garden picker cards (Pass 1 placeholders: existing scene art and a CSS sky).
  'picker-card-sorting-beds': { url: 'art/scenes/number-garden/bg-landscape.svg' },
  'picker-card-balloon-pop': { css: 'background:radial-gradient(circle at 35% 40%,#ff6fb5 0 14%,transparent 15%),radial-gradient(circle at 62% 30%,#ffd93d 0 13%,transparent 14%),radial-gradient(circle at 50% 62%,#4d96ff 0 14%,transparent 15%),linear-gradient(180deg,#b8e6ff,#e7f7ff)' },
};

/** Real manifest entry first, then the placeholder. Urls are relative to the app base, like the manifest. */
export function resolvePickerAsset(key: string, manifest: readonly ArtManifestEntry[] = ART_MANIFEST): PickerAsset {
  const real = manifest.find((e) => e.key === key);
  if (real) return { key, kind: 'manifest', url: real.url };
  const placeholder = PLACEHOLDERS[key as PickerAssetKey] ?? LEISURE_PLACEHOLDERS[key];
  if (!placeholder) throw new Error(`Unknown picker asset key: ${key}`);
  return 'url' in placeholder ? { key, kind: 'placeholder', url: placeholder.url } : { key, kind: 'css', css: placeholder.css };
}

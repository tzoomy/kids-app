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

/** Placeholder block: each key maps to an existing art file under `public/` or to a CSS shape. */
const PLACEHOLDERS: Record<PickerAssetKey, { url: string } | { css: string }> = {
  'picker-card-animal-restaurant': { url: 'art/scenes/restaurant/bg-landscape.svg' },
  'picker-card-kitchen-orchestra': { url: 'art/scenes/kitchen/bg-landscape.svg' },
  'picker-bg': { url: 'art/scenes/restaurant/bg-landscape.svg' },
  'picker-close': { css: 'background:#FFFDF9;border-radius:50%' },
};

/** Real manifest entry first, then the placeholder. Urls are relative to the app base, like the manifest. */
export function resolvePickerAsset(key: string, manifest: readonly ArtManifestEntry[] = ART_MANIFEST): PickerAsset {
  const real = manifest.find((e) => e.key === key);
  if (real) return { key, kind: 'manifest', url: real.url };
  const placeholder = PLACEHOLDERS[key as PickerAssetKey];
  if (!placeholder) throw new Error(`Unknown picker asset key: ${key}`);
  return 'url' in placeholder ? { key, kind: 'placeholder', url: placeholder.url } : { key, kind: 'css', css: placeholder.css };
}

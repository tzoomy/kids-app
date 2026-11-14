// Sticker Board art keys. Loaded lazily when StickerBoardScene opens, never at boot.
// Do not add these entries to ART_MANIFEST / registerProjectArt / PreloadScene.
import type { ArtManifestEntry } from './manifest';

export const STICKER_BOARD_ART_MANIFEST: ArtManifestEntry[] = [
  // Stickers (check each SVG's own width/height attributes)
  { key: 'sticker-rocket', url: 'art/stickers/rocket.svg', width: 256, height: 256 },
  { key: 'sticker-planet', url: 'art/stickers/planet.svg', width: 256, height: 256 },
  { key: 'sticker-moon', url: 'art/stickers/moon.svg', width: 256, height: 256 },
  { key: 'sticker-star', url: 'art/fx/star.svg', width: 128, height: 128 },
  { key: 'sticker-palm-tree', url: 'art/stickers/palm-tree.svg', width: 256, height: 256 },
  { key: 'sticker-banana', url: 'art/foods/banana.svg', width: 256, height: 256 },
  { key: 'sticker-leaf', url: 'art/props/clue-icon-leaf.svg', width: 160, height: 160 },
  { key: 'sticker-flower', url: 'art/flowers/bloom-tulip-red.svg', width: 256, height: 256 },
  { key: 'sticker-shell', url: 'art/stickers/shell.svg', width: 256, height: 256 },
  { key: 'sticker-starfish', url: 'art/stickers/starfish.svg', width: 256, height: 256 },
  { key: 'sticker-umbrella', url: 'art/items/umbrella.svg', width: 256, height: 256 },
  { key: 'sticker-ball', url: 'art/items/ball.svg', width: 256, height: 256 },

  // Backgrounds (1280x800 landscape, 800x1280 portrait)
  { key: 'sticker-board-bg-space-landscape', url: 'art/scenes/sticker-board/space-landscape.svg', width: 1280, height: 800 },
  { key: 'sticker-board-bg-space-portrait', url: 'art/scenes/sticker-board/space-portrait.svg', width: 800, height: 1280 },
  { key: 'sticker-board-bg-jungle-landscape', url: 'art/scenes/sticker-board/jungle-landscape.svg', width: 1280, height: 800 },
  { key: 'sticker-board-bg-jungle-portrait', url: 'art/scenes/sticker-board/jungle-portrait.svg', width: 800, height: 1280 },
  { key: 'sticker-board-bg-beach-landscape', url: 'art/scenes/sticker-board/beach-landscape.svg', width: 1280, height: 800 },
  { key: 'sticker-board-bg-beach-portrait', url: 'art/scenes/sticker-board/beach-portrait.svg', width: 800, height: 1280 },
];

export const STICKER_BOARD_ART_KEYS = STICKER_BOARD_ART_MANIFEST.map((e) => e.key);

const URL_BY_KEY = new Map(STICKER_BOARD_ART_MANIFEST.map((e) => [e.key, e.url]));

export function stickerBoardAssetPath(key: string): string {
  const url = URL_BY_KEY.get(key);
  if (!url) throw new Error(`Unknown sticker-board art key: ${key}`);
  return url;
}

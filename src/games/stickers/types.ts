// Frozen hook types for Sticker Board (spec: docs/specs/sticker-board.md).
// Tests depend on these shapes; do not rename fields without a spec update.

/** Rectangle in page CSS px (top-left + size), the same space as `getBuildingHit`. */
export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export type StickerAgeTrack = 'age2' | 'age5';

/** One sticker placed on the board, in page CSS px. */
export interface PlacedStickerInfo {
  index: number;
  stickerId: string;
  center: { x: number; y: number };
  rect: PageRect;
}

/** Summary of one drawn stroke on the board. */
export interface StrokeInfo {
  colorId: string;
  pointCount: number;
}

/** Active age-5 spoken request snapshot. */
export interface StickerRequestInfo {
  stickerId: string;
  backgroundId: string;
  lang: 'en' | 'fr';
  lineId: string;
}

/** Snapshot returned by StickerBoardScene.getStickerBoardInfo() while the scene is active. */
export interface StickerBoardInfo {
  ageTrack: StickerAgeTrack;
  backgroundId: string;
  selectedColor: string;
  boardRect: PageRect;
  stickers: PlacedStickerInfo[];
  strokes: StrokeInfo[];
  request: StickerRequestInfo | null;
  requestsEnabled: boolean;
  requestsMet: number;
  albumCount: number;
  undoCount: number;
  earnsLeisure: boolean;
  chromeButtons: Array<{ id: string; rect: PageRect }>;
}

/** Payload of the seed-only hook `seedStickerBoardState`. */
export interface StickerBoardSeed {
  current?: {
    backgroundId: string;
    stickers?: Array<{ stickerId: string; x: number; y: number }>;
    strokes?: Array<{ colorId: string; points: number[] }>;
  };
  album?: Array<{
    backgroundId: string;
    stickers: Array<{ stickerId: string; x: number; y: number }>;
    strokes: Array<{ colorId: string; points: number[] }>;
  }>;
}

// Seed-only writer for ?e2e=1 `seedStickerBoardState`. Writes only the stickers autosave key.
import type { StickerBoardSeed } from '../../games/stickers/types';
import {
  loadStickerBoardState,
  saveStickerBoardState,
  STICKERS_SAVE_VERSION,
  type StickerBoardSave,
} from './store';
import type { Board } from '../../games/stickers/board';

export function writeStickerBoardSeed(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  profileId: string,
  seed: StickerBoardSeed,
): void {
  const existing = loadStickerBoardState(storage, profileId);
  const current: Board = seed.current
    ? {
        backgroundId: seed.current.backgroundId,
        stickers: (seed.current.stickers ?? []).map((s) => ({ ...s })),
        strokes: (seed.current.strokes ?? []).map((st) => ({ colorId: st.colorId, points: [...st.points] })),
      }
    : existing.current;
  const album: Board[] = seed.album
    ? seed.album.map((b) => ({
        backgroundId: b.backgroundId,
        stickers: b.stickers.map((s) => ({ ...s })),
        strokes: b.strokes.map((st) => ({ colorId: st.colorId, points: [...st.points] })),
      }))
    : existing.album;
  const next: StickerBoardSave = { v: STICKERS_SAVE_VERSION, current, album };
  saveStickerBoardState(storage, profileId, next);
}

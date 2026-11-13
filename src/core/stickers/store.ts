// Sticker Board autosave and album persistence. No Phaser dependency.
// Key: kids-app-stickers:<profileId>. Schema: { v: 1, current: Board, album: Board[] }.
import stickerBoardJson from '../../content/games/sticker-board.json';
import {
  cloneBoard,
  createEmptyBoard,
  MAX_POINTS,
  MAX_STICKERS,
  MAX_STROKES,
  type Board,
  type PlacedSticker,
  type Stroke,
} from '../../games/stickers/board';

export const STICKERS_KEY_PREFIX = 'kids-app-stickers:';
export const STICKERS_SAVE_VERSION = 1 as const;
export const ALBUM_CAP = 12;

export function stickersKey(profileId: string): string {
  return `${STICKERS_KEY_PREFIX}${profileId}`;
}

export interface StickerBoardSave {
  v: typeof STICKERS_SAVE_VERSION;
  current: Board;
  album: Board[];
}

const DEFAULT_BG = stickerBoardJson.defaultBackground;
const KNOWN_BACKGROUNDS = new Set(stickerBoardJson.backgrounds.map((b) => b.id));
const KNOWN_STICKERS = new Set(stickerBoardJson.stickers.map((s) => s.id));
const KNOWN_CRAYONS = new Set(stickerBoardJson.crayons.map((c) => c.id));

function isUnitNumber(n: unknown): n is number {
  return typeof n === 'number' && Number.isFinite(n) && n >= 0 && n <= 1;
}

function emptySave(): StickerBoardSave {
  return {
    v: STICKERS_SAVE_VERSION,
    current: createEmptyBoard(DEFAULT_BG),
    album: [],
  };
}

export function sanitizeBoard(raw: unknown): Board {
  if (!raw || typeof raw !== 'object') return createEmptyBoard(DEFAULT_BG);
  const obj = raw as Record<string, unknown>;
  const backgroundId =
    typeof obj.backgroundId === 'string' && KNOWN_BACKGROUNDS.has(obj.backgroundId)
      ? obj.backgroundId
      : DEFAULT_BG;

  const stickers: PlacedSticker[] = [];
  if (Array.isArray(obj.stickers)) {
    for (const item of obj.stickers) {
      if (!item || typeof item !== 'object') continue;
      const s = item as Record<string, unknown>;
      if (
        typeof s.stickerId === 'string' &&
        KNOWN_STICKERS.has(s.stickerId) &&
        isUnitNumber(s.x) &&
        isUnitNumber(s.y)
      ) {
        stickers.push({ stickerId: s.stickerId, x: s.x, y: s.y });
      }
    }
  }
  const cappedStickers =
    stickers.length > MAX_STICKERS ? stickers.slice(stickers.length - MAX_STICKERS) : stickers;

  const strokes: Stroke[] = [];
  if (Array.isArray(obj.strokes)) {
    for (const item of obj.strokes) {
      if (!item || typeof item !== 'object') continue;
      const st = item as Record<string, unknown>;
      if (typeof st.colorId !== 'string' || !KNOWN_CRAYONS.has(st.colorId)) continue;
      if (!Array.isArray(st.points)) continue;
      const points: number[] = [];
      for (let i = 0; i + 1 < st.points.length; i += 2) {
        const px = st.points[i];
        const py = st.points[i + 1];
        if (isUnitNumber(px) && isUnitNumber(py)) {
          points.push(px, py);
          if (points.length >= MAX_POINTS * 2) break;
        }
      }
      if (points.length >= 2) {
        strokes.push({ colorId: st.colorId, points });
      }
    }
  }
  const cappedStrokes =
    strokes.length > MAX_STROKES ? strokes.slice(strokes.length - MAX_STROKES) : strokes;

  return { backgroundId, stickers: cappedStickers, strokes: cappedStrokes };
}

function sanitizeSave(state: StickerBoardSave): StickerBoardSave {
  const album: Board[] = [];
  for (const b of state.album) {
    if (!b || typeof b !== 'object') continue;
    album.push(sanitizeBoard(b));
    if (album.length >= ALBUM_CAP) break;
  }
  return {
    v: STICKERS_SAVE_VERSION,
    current: sanitizeBoard(state.current),
    album,
  };
}

export function loadStickerBoardState(
  storage: Pick<Storage, 'getItem'>,
  profileId: string,
): StickerBoardSave {
  const raw = storage.getItem(stickersKey(profileId));
  if (!raw) return emptySave();
  try {
    const parsed = JSON.parse(raw) as Partial<StickerBoardSave>;
    if (!parsed || typeof parsed !== 'object' || parsed.v !== STICKERS_SAVE_VERSION) {
      return emptySave();
    }
    return sanitizeSave({
      v: STICKERS_SAVE_VERSION,
      current: (parsed.current ?? createEmptyBoard(DEFAULT_BG)) as Board,
      album: Array.isArray(parsed.album) ? (parsed.album as Board[]) : [],
    });
  } catch {
    return emptySave();
  }
}

export function saveStickerBoardState(
  storage: Pick<Storage, 'setItem'>,
  profileId: string,
  state: StickerBoardSave,
): void {
  storage.setItem(stickersKey(profileId), JSON.stringify(sanitizeSave(state)));
}

/** Prepends a sanitised copy of `board` to the album (newest first, capped at ALBUM_CAP = 12). */
export function addToAlbum(state: StickerBoardSave, board: Board): StickerBoardSave {
  const nextAlbum = [sanitizeBoard(cloneBoard(board)), ...state.album].slice(0, ALBUM_CAP);
  return {
    v: STICKERS_SAVE_VERSION,
    current: cloneBoard(state.current),
    album: nextAlbum,
  };
}

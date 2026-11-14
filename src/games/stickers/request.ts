// Pure age-5 spoken request selection, matching, and SpeechRequest construction.
import type { StickerBoardContent } from '../../content/schema';
import type { SpeechRequest } from '../../core/audio/types';
import type { LanguageSetting } from '../../core/storage/schema';

export interface StickerRequest {
  stickerId: string;
  backgroundId: string;
  lang: 'en' | 'fr';
  lineId: string;
}

/**
 * Deterministically picks the next request for `backgroundId`.
 * Cycles through the theme's stickers without repeating `previousStickerId`.
 * When `langSetting === 'both'`, alternates `'en'` (even requestIndex) and `'fr'` (odd).
 */
export function pickRequest(
  content: StickerBoardContent,
  backgroundId: string,
  langSetting: LanguageSetting,
  requestIndex: number,
  previousStickerId?: string | null,
): StickerRequest {
  const lang: 'en' | 'fr' =
    langSetting === 'en' ? 'en' : langSetting === 'fr' ? 'fr' : requestIndex % 2 === 0 ? 'en' : 'fr';

  const themeStickers = content.stickers.filter((s) => s.theme === backgroundId);
  const pool = themeStickers.length > 0 ? themeStickers : content.stickers;
  const idx = ((requestIndex % pool.length) + pool.length) % pool.length;
  let chosen = pool[idx];
  if (pool.length > 1 && previousStickerId && chosen.id === previousStickerId) {
    chosen = pool[(idx + 1) % pool.length];
  }

  return {
    stickerId: chosen.id,
    backgroundId,
    lang,
    lineId: `sticker-board.request.${chosen.id}.${lang}`,
  };
}

/** True only when `placedStickerId` matches the requested sticker on the requested background. */
export function isRequestMet(
  request: StickerRequest | null,
  placedStickerId: string,
  backgroundId: string,
): boolean {
  if (!request) return false;
  return request.stickerId === placedStickerId && request.backgroundId === backgroundId;
}

/** Builds the device-TTS SpeechRequest for an active sticker request. */
export function requestLine(request: StickerRequest, content: StickerBoardContent): SpeechRequest {
  const sticker = content.stickers.find((s) => s.id === request.stickerId);
  const bg = content.backgrounds.find((b) => b.id === request.backgroundId);
  const stickerPhrase = sticker ? sticker.name[request.lang] : request.stickerId;
  const placePhrase = bg ? bg.place[request.lang] : request.backgroundId;
  const text =
    request.lang === 'fr'
      ? `Mets ${stickerPhrase} ${placePhrase} !`
      : `Put ${stickerPhrase} ${placePhrase}!`;
  return {
    lineId: request.lineId,
    lang: request.lang,
    text,
  };
}

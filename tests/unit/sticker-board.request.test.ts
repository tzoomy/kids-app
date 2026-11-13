import { describe, expect, it } from 'vitest';
import { loadStickerBoard } from '@/content/loadContent';
import { isRequestMet, pickRequest, requestLine } from '@/games/stickers/request';

const content = loadStickerBoard();

describe('sticker-board age-5 requests', () => {
  it('[AC-08] a request names a sticker of the current theme, in the learning language', () => {
    for (const bg of ['space', 'jungle', 'beach']) {
      for (let i = 0; i < 6; i++) {
        const req = pickRequest(content, bg, 'en', i, null);
        const sticker = content.stickers.find((s) => s.id === req.stickerId);
        expect(sticker?.theme).toBe(bg);
        expect(req.backgroundId).toBe(bg);
        expect(req.lang).toBe('en');
        expect(req.lineId).toBe(`sticker-board.request.${req.stickerId}.en`);
      }
    }
    expect(pickRequest(content, 'space', 'fr', 0).lang).toBe('fr');
  });

  it("[AC-08] 'both' alternates per request, starting with English, and never repeats the previous sticker", () => {
    const langs = [0, 1, 2, 3].map((i) => pickRequest(content, 'beach', 'both', i).lang);
    expect(langs).toEqual(['en', 'fr', 'en', 'fr']);
    let prev: string | null = null;
    for (let i = 0; i < 10; i++) {
      const req = pickRequest(content, 'jungle', 'en', i, prev);
      expect(req.stickerId).not.toBe(prev);
      prev = req.stickerId;
    }
  });

  it('[AC-08] the request is met only by that sticker on that background; ignoring it changes nothing', () => {
    const req = pickRequest(content, 'space', 'en', 0);
    expect(isRequestMet(req, req.stickerId, 'space')).toBe(true);
    expect(isRequestMet(req, req.stickerId, 'beach')).toBe(false);
    const other = content.stickers.find((s) => s.id !== req.stickerId)!.id;
    expect(isRequestMet(req, other, 'space')).toBe(false);
    expect(isRequestMet(null, req.stickerId, 'space')).toBe(false);
  });

  it('[AC-08] the spoken line is a full sentence in English or French', () => {
    const en = requestLine({ stickerId: 'rocket', backgroundId: 'space', lang: 'en', lineId: 'sticker-board.request.rocket.en' }, content);
    expect(en).toEqual({ lineId: 'sticker-board.request.rocket.en', lang: 'en', text: 'Put the rocket in space!' });
    const fr = requestLine({ stickerId: 'shell', backgroundId: 'beach', lang: 'fr', lineId: 'sticker-board.request.shell.fr' }, content);
    expect(fr.text).toBe('Mets le coquillage sur la plage !');
    expect(fr.lang).toBe('fr');
  });
});

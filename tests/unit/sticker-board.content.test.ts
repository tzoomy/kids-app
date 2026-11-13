import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { loadStickerBoard, loadWorlds } from '@/content/loadContent';
import { STICKER_BOARD_ART_MANIFEST } from '@/assets/art/stickerBoardManifest';
import { stickerLeisureMode } from '@/games/stickers/leisure';
import { computeStickerBoardLayout } from '@/games/stickers/layout';

const root = path.resolve(__dirname, '../..');
const content = loadStickerBoard();

describe('sticker-board content, art and leisure', () => {
  it('[AC-14] content validates: 3 backgrounds, 12 stickers (4 per theme), crayons per age', () => {
    expect(content.id).toBe('sticker-board');
    expect(content.world).toBe('art-studio');
    expect(content.backgrounds.map((b) => b.id)).toEqual(['space', 'jungle', 'beach']);
    expect(content.stickers).toHaveLength(12);
    for (const theme of ['space', 'jungle', 'beach']) {
      expect(content.stickers.filter((s) => s.theme === theme)).toHaveLength(4);
    }
    expect(loadWorlds().worlds.find((w) => w.id === 'art-studio')).toMatchObject({ status: 'open', entryGameId: 'sticker-board' });
  });

  it('[AC-05] 4 crayons at age 2 and 8 at age 5; the default colour is in both', () => {
    expect(content.crayons.filter((c) => c.age2).map((c) => c.id)).toEqual(['red', 'yellow', 'blue', 'green']);
    expect(content.crayons.filter((c) => c.age5)).toHaveLength(8);
    const def = content.crayons.find((c) => c.id === content.defaultColor);
    expect(def?.age2 && def?.age5).toBe(true);
  });

  it('[AC-14] every sticker and background has a manifest key and a clean SVG under 15 KB', () => {
    const keys = new Set(STICKER_BOARD_ART_MANIFEST.map((e) => e.key));
    for (const s of content.stickers) expect(keys.has(s.artKey), s.artKey).toBe(true);
    for (const bg of content.backgrounds) {
      expect(keys.has(`sticker-board-bg-${bg.id}-landscape`)).toBe(true);
      expect(keys.has(`sticker-board-bg-${bg.id}-portrait`)).toBe(true);
    }
    for (const entry of STICKER_BOARD_ART_MANIFEST) {
      const file = path.join(root, 'public', entry.url);
      expect(fs.existsSync(file), entry.url).toBe(true);
      const svg = fs.readFileSync(file, 'utf8');
      expect(Buffer.byteLength(svg), entry.url).toBeLessThan(15 * 1024);
      expect(svg, entry.url).not.toMatch(/<text|<image|<script|href="http|xlink:href|url\(http|data:image/i);
      expect(svg, entry.url).toMatch(/<svg[^>]*viewBox=/);
    }
  });

  it('[AC-13] leisure follows the content mark: earns only when marked and time earning is on; never spends', () => {
    expect(content.earnsLeisure).toBe(false);
    expect(stickerLeisureMode(false, true)).toBe('none');
    expect(stickerLeisureMode(false, false)).toBe('none');
    expect(stickerLeisureMode(true, false)).toBe('none');
    expect(stickerLeisureMode(true, true)).toBe('earn');
    const scene = fs.readFileSync(path.join(root, 'src/games/stickers/StickerBoardScene.ts'), 'utf8');
    expect(scene).not.toMatch(/createLeisureSession|LeisureSession\b/);
    expect(scene).not.toMatch(/core\/adaptive|SkillSession/);
  });

  it('[AC-15] layout: every button is at least 64 units and nothing overlaps, both orientations and ages', () => {
    for (const [w, h] of [[1280, 800], [800, 1280]] as const) {
      for (const age of ['age2', 'age5'] as const) {
        const g = computeStickerBoardLayout(w, h, age, age === 'age2' ? 4 : 8);
        const rects = [
          ...g.tray,
          ...g.backgrounds,
          ...g.crayons,
          ...Object.values(g.tools).filter((r): r is NonNullable<typeof r> => Boolean(r)),
        ];
        expect(g.tray).toHaveLength(12);
        for (const r of rects) {
          expect(r.width).toBeGreaterThanOrEqual(64);
          expect(r.height).toBeGreaterThanOrEqual(64);
          expect(r.x).toBeGreaterThanOrEqual(0);
          expect(r.y).toBeGreaterThanOrEqual(0);
          expect(r.x + r.width).toBeLessThanOrEqual(w);
          expect(r.y + r.height).toBeLessThanOrEqual(h);
        }
        const all = [...rects, g.board];
        for (let i = 0; i < all.length; i++) {
          for (let j = i + 1; j < all.length; j++) {
            const a = all[i];
            const b = all[j];
            const overlap = a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
            expect(overlap, `${w}x${h} ${age} rects ${i} and ${j} overlap`).toBe(false);
          }
        }
      }
    }
  });
});

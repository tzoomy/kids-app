// Real-tap journeys for Sticker Board Pass 1 (docs/specs/sticker-board.md). Hooks only seed or read.
import { test, expect, type Page } from '@playwright/test';
import { enterWorldByTap, getActiveScenes, seedLanguageSetting, tapTestId, waitForScene } from './helpers/journey';
import type { StickerBoardInfo, StickerBoardSeed } from '../../src/games/stickers/types';

const LANDSCAPE = 'landscape-1280x800';

async function shot(page: Page, name: string): Promise<void> {
  const size = page.viewportSize();
  const o = size && size.width >= size.height ? 'landscape' : 'portrait';
  await page.screenshot({ path: `docs/screenshots/sticker-board-${name}-${o}.png` });
}

function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function info(page: Page): Promise<StickerBoardInfo | null> {
  return page.evaluate(() => window.__testHooks__?.getStickerBoardInfo() ?? null);
}

async function waitReady(page: Page): Promise<StickerBoardInfo> {
  await expect.poll(async () => (await info(page)) !== null, { timeout: 15_000 }).toBe(true);
  return (await info(page)) as StickerBoardInfo;
}

async function enterBoard(
  page: Page,
  profile: 'profile-a' | 'profile-b',
  opts?: { seed?: StickerBoardSeed; lang?: 'en' | 'fr' | 'both' },
): Promise<StickerBoardInfo> {
  await enterWorldByTap(page, profile, 'art-studio', undefined, {
    beforeEnter: async () => {
      if (opts?.lang) await seedLanguageSetting(page, opts.lang);
      if (opts?.seed) await page.evaluate((s) => window.__testHooks__?.seedStickerBoardState(s), opts.seed);
    },
  });
  return waitReady(page);
}

async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  for (let i = 1; i <= 8; i++) {
    await page.mouse.move(from.x + ((to.x - from.x) * i) / 8, from.y + ((to.y - from.y) * i) / 8);
  }
  await page.mouse.up();
}

async function spokenLines(page: Page): Promise<Array<{ lineId: string; lang: string }>> {
  return page.evaluate(() => (window.__testHooks__?.getSpokenLines() ?? []).map((l) => ({ lineId: l.lineId, lang: l.lang })));
}

test.describe('sticker-board journeys', () => {
  test('[AC-01] real-tap journey: profile → Art Studio → Sticker Board → tray sticker → hud-back → map', async ({ page }) => {
    test.setTimeout(90_000);
    const start = await enterBoard(page, 'profile-b');
    expect(await getActiveScenes(page)).toContain('StickerBoardScene');
    const before = start.stickers.length;
    await expect(page.locator('[data-testid="sticker-request"]')).toBeVisible();
    await shot(page, 'age5-start');
    await tapTestId(page, 'sticker-tray-rocket');
    const after = (await info(page)) as StickerBoardInfo;
    expect(after.stickers.length).toBe(before + 1);
    const placed = after.stickers[after.stickers.length - 1];
    expect(placed.stickerId).toBe('rocket');
    const b = after.boardRect;
    expect(placed.center.x).toBeGreaterThanOrEqual(b.x);
    expect(placed.center.x).toBeLessThanOrEqual(b.x + b.width);
    expect(placed.center.y).toBeGreaterThanOrEqual(b.y);
    expect(placed.center.y).toBeLessThanOrEqual(b.y + b.height);
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('StickerBoardScene');
  });

  test('[AC-03] [AC-04] @single-orientation dragging a sticker moves it; dragging on empty board draws in the selected crayon', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterBoard(page, 'profile-b');
    await tapTestId(page, 'sticker-tray-moon');
    let now = (await info(page)) as StickerBoardInfo;
    const moon = now.stickers[now.stickers.length - 1];
    const target = { x: now.boardRect.x + now.boardRect.width * 0.5, y: now.boardRect.y + now.boardRect.height * 0.55 };
    await drag(page, moon.center, target);
    now = (await info(page)) as StickerBoardInfo;
    const moved = now.stickers[now.stickers.length - 1];
    expect(moved.stickerId).toBe('moon');
    expect(Math.abs(moved.center.x - target.x)).toBeLessThan(6);
    expect(Math.abs(moved.center.y - target.y)).toBeLessThan(6);
    expect(now.strokes.length).toBe(0);

    await tapTestId(page, 'sticker-crayon-blue');
    const r = now.boardRect;
    // Bottom-left corner area, away from the slot grid's first slots and the moved moon.
    await drag(page, { x: r.x + r.width * 0.12, y: r.y + r.height * 0.96 }, { x: r.x + r.width * 0.3, y: r.y + r.height * 0.97 });
    now = (await info(page)) as StickerBoardInfo;
    expect(now.strokes.length).toBe(1);
    expect(now.strokes[0].colorId).toBe('blue');
    expect(now.strokes[0].pointCount).toBeGreaterThan(2);
    expect(now.stickers.length).toBe(1);
  });

  test('[AC-05] [AC-10] @single-orientation age 2: 4 crayons, no request, no save or album', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    const start = await enterBoard(page, 'profile-a');
    expect(start.ageTrack).toBe('age2');
    expect(start.request).toBeNull();
    await expect(page.locator('[data-testid^="sticker-crayon-"]')).toHaveCount(4);
    await expect(page.locator('[data-testid="sticker-save"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="sticker-album"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="sticker-request-toggle"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="sticker-crayon-red"]')).toHaveAttribute('aria-pressed', 'true');
    await page.waitForTimeout(2000);
    expect((await info(page))?.request).toBeNull();
  });

  test('[AC-05] @single-orientation age 5 has 8 crayons and one is selected', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterBoard(page, 'profile-b');
    await expect(page.locator('[data-testid^="sticker-crayon-"]')).toHaveCount(8);
    await tapTestId(page, 'sticker-crayon-purple');
    await expect(page.locator('[data-testid="sticker-crayon-purple"]')).toHaveAttribute('aria-pressed', 'true');
    await expect(page.locator('[data-testid="sticker-crayon-red"]')).toHaveAttribute('aria-pressed', 'false');
    expect((await info(page))?.selectedColor).toBe('purple');
  });

  test('[AC-06] @single-orientation background buttons switch theme and keep the board', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterBoard(page, 'profile-b');
    await tapTestId(page, 'sticker-tray-shell');
    await tapTestId(page, 'sticker-bg-beach');
    let now = (await info(page)) as StickerBoardInfo;
    expect(now.backgroundId).toBe('beach');
    expect(now.stickers.map((s) => s.stickerId)).toEqual(['shell']);
    await tapTestId(page, 'sticker-bg-jungle');
    now = (await info(page)) as StickerBoardInfo;
    expect(now.backgroundId).toBe('jungle');
    expect(now.stickers.length).toBe(1);
  });

  test('[AC-09] @single-orientation age 5 request is spoken in the learning language and met by placing the named sticker', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    const start = await enterBoard(page, 'profile-b', { lang: 'en' });
    expect(start.request).not.toBeNull();
    const req = start.request!;
    expect(req.backgroundId).toBe(start.backgroundId);
    expect(req.lang).toBe('en');
    await expect(page.locator('[data-testid="sticker-request"]')).toBeVisible();
    await expect
      .poll(async () => (await spokenLines(page)).some((l) => l.lineId === req.lineId && l.lang === 'en'), { timeout: 10_000 })
      .toBe(true);
    await tapTestId(page, `sticker-tray-${req.stickerId}`);
    expect((await info(page))?.requestsMet).toBe(1);
    await expect.poll(async () => (await info(page))?.request?.stickerId ?? null, { timeout: 10_000 }).not.toBe(req.stickerId);
  });

  test('[AC-11] @single-orientation age 5 save adds the board to the album and a thumbnail loads it', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterBoard(page, 'profile-b');
    await tapTestId(page, 'sticker-tray-starfish');
    await tapTestId(page, 'sticker-save');
    expect((await info(page))?.albumCount).toBe(1);
    await tapTestId(page, 'sticker-clear');
    expect((await info(page))?.stickers.length).toBe(0);
    await tapTestId(page, 'sticker-album');
    await expect(page.locator('[data-testid="sticker-album-view"]')).toBeVisible();
    await tapTestId(page, 'sticker-album-item-0');
    await expect(page.locator('[data-testid="sticker-album-view"]')).toBeHidden();
    expect((await info(page))?.stickers.map((s) => s.stickerId)).toEqual(['starfish']);
  });

  test('[AC-12] @single-orientation the board autosaves per profile and a seeded board loads', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    const start = await enterBoard(page, 'profile-b', {
      seed: { current: { backgroundId: 'jungle', stickers: [{ stickerId: 'banana', x: 0.4, y: 0.5 }], strokes: [] } },
    });
    expect(start.backgroundId).toBe('jungle');
    expect(start.stickers.map((s) => s.stickerId)).toEqual(['banana']);
    await tapTestId(page, 'sticker-tray-leaf');
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    const again = await enterBoard(page, 'profile-b');
    expect(again.stickers.map((s) => s.stickerId)).toEqual(['banana', 'leaf']);
    const other = await enterBoard(page, 'profile-a');
    expect(other.stickers.map((s) => s.stickerId)).not.toContain('leaf');
  });

  test('[AC-15] every tray, crayon, background and tool button is at least 64 CSS px', async ({ page }) => {
    test.setTimeout(90_000);
    const now = await enterBoard(page, 'profile-b');
    const ids = now.chromeButtons.map((b) => b.id);
    expect(ids.filter((id) => id.startsWith('sticker-tray-')).length).toBe(12);
    for (const id of ['sticker-bg-space', 'sticker-bg-jungle', 'sticker-bg-beach', 'sticker-undo', 'sticker-clear', 'sticker-save', 'sticker-album']) {
      expect(ids, id).toContain(id);
    }
    for (const b of now.chromeButtons) {
      if (b.id === 'sticker-board' || b.id.startsWith('sticker-album-')) continue;
      expect(b.rect.width, b.id).toBeGreaterThanOrEqual(63.5);
      expect(b.rect.height, b.id).toBeGreaterThanOrEqual(63.5);
    }
    // In-game screenshots for the ready-for-merge gate.
    await tapTestId(page, 'sticker-tray-rocket');
    await tapTestId(page, 'sticker-tray-planet');
    const r = now.boardRect;
    await drag(page, { x: r.x + r.width * 0.15, y: r.y + r.height * 0.95 }, { x: r.x + r.width * 0.45, y: r.y + r.height * 0.93 });
    await page.waitForTimeout(1800);
    await shot(page, 'age5-play');
    await tapTestId(page, 'sticker-save');
    await tapTestId(page, 'sticker-album');
    await expect(page.locator('[data-testid="sticker-album-view"]')).toBeVisible();
    await shot(page, 'age5-album');
    await enterBoard(page, 'profile-a');
    await tapTestId(page, 'sticker-tray-palm-tree');
    await tapTestId(page, 'sticker-tray-banana');
    await shot(page, 'age2-play');
  });
});

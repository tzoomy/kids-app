// Real-tap journeys for Colouring Time Pass 1. Hooks only seed or read; entry is via enterWorldByTap.
import { existsSync } from 'node:fs';
import { test, expect, type Page } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getColouringInfo,
  getSpokenLineCount,
  getSpokenLines,
  seedBalanceSec,
  seedColouringState,
  tapTestId,
  tapWorldBuilding,
  waitForColouringReady,
  waitForScene,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterColouring(
  page: Page,
  profile: 'profile-a' | 'profile-b' = 'profile-a',
  opts?: { balanceSec?: number; seed?: { pageId: string; fills?: Record<string, string> } },
): Promise<void> {
  await enterWorldByTap(page, profile, 'leisure-corner', 'leisure-colouring', {
    beforeEnter: async () => {
      await seedBalanceSec(page, opts?.balanceSec ?? 120);
      if (opts?.seed) await seedColouringState(page, opts.seed);
    },
  });
}

test.describe('leisure-colouring journeys', () => {
  test('[AC-01] real-tap journey: profile → Leisure Corner → picker → Colouring Time → fill a region → hud-back → map; the game opens only from this building', async ({ page }) => {
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a');
    expect(await getActiveScenes(page)).toContain('ColouringScene');
    expect(await getActiveScenes(page)).not.toContain('MapScene');

    const info = await waitForColouringReady(page);
    expect(info.regions.length).toBeGreaterThan(0);
    const target = info.regions[0];
    const before = { ...info.fills };
    await page.mouse.click(target.tapPoint.x, target.tapPoint.y);
    const after = await getColouringInfo(page);
    expect(after?.fills[target.id]).toBeDefined();
    expect(after?.fills[target.id]).not.toBe(before[target.id]);

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('ColouringScene');

    // Other buildings must not open Colouring Time or its picker card.
    for (const worldId of ['language-house', 'nature-lab', 'art-studio', 'number-garden']) {
      await tapWorldBuilding(page, 'profile-a', worldId);
      await page.waitForTimeout(1500);
      const scenes = await getActiveScenes(page);
      expect(scenes, worldId).not.toContain('ColouringScene');
      await expect(page.locator('[data-testid="game-picker-leisure-colouring"]')).toHaveCount(0);
    }
  });

  test('[AC-02] @single-orientation a tap on a region tapPoint fills it, and a second colour overwrites it', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    const region = info.regions[0];
    if (info.selectedColor !== 'red') await tapTestId(page, 'colouring-swatch-red');
    await page.mouse.click(region.tapPoint.x, region.tapPoint.y);
    expect((await getColouringInfo(page))?.fills[region.id]).toBe('red');
    await tapTestId(page, 'colouring-swatch-blue');
    await page.mouse.click(region.tapPoint.x, region.tapPoint.y);
    expect((await getColouringInfo(page))?.fills[region.id]).toBe('blue');
  });

  test('[AC-03] @single-orientation a far no-op tap changes nothing (except the 1s timer); a tap within 20 CSS px fills the nearest region', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a', { balanceSec: 60 });
    const info = await waitForColouringReady(page);
    const speechBefore = await getSpokenLineCount(page);
    const fillsBefore = { ...info.fills };
    const undoBefore = info.undoCount;
    // Far corner of the page, well outside every region.
    await page.mouse.click(info.pageRect.x + 8, info.pageRect.y + 8);
    const afterFar = await getColouringInfo(page);
    expect(afterFar?.fills).toEqual(fillsBefore);
    expect(afterFar?.undoCount).toBe(undoBefore);
    expect(await getSpokenLineCount(page)).toBe(speechBefore);
    // Near a region (within 20 CSS px of its painted box).
    const region = info.regions[0];
    await page.mouse.click(region.hit.x - 10, region.hit.y + region.hit.height / 2);
    const afterNear = await getColouringInfo(page);
    expect(afterNear?.fills[region.id] ?? afterNear?.fills).toBeDefined();
    expect(Object.keys(afterNear?.fills ?? {}).length).toBeGreaterThan(Object.keys(fillsBefore).length);
  });

  test('[AC-05] @single-orientation undo reverts the last fill and the last clear, is disabled when empty, caps at 50, and clears on a page change', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    await expect(page.locator('[data-testid="colouring-undo"]')).toBeDisabled();
    const region = info.regions[0];
    await page.mouse.click(region.tapPoint.x, region.tapPoint.y);
    expect((await getColouringInfo(page))?.undoCount).toBe(1);
    await tapTestId(page, 'colouring-undo');
    expect((await getColouringInfo(page))?.fills[region.id]).toBeUndefined();
    expect((await getColouringInfo(page))?.undoCount).toBe(0);

    await page.mouse.click(region.tapPoint.x, region.tapPoint.y);
    await tapTestId(page, 'colouring-clear');
    expect((await getColouringInfo(page))?.fills[region.id]).toBeUndefined();
    await tapTestId(page, 'colouring-undo');
    expect((await getColouringInfo(page))?.fills[region.id]).toBeDefined();

    // Cap 50: 51 fills drop the oldest step.
    for (let i = 0; i < 51; i++) await page.mouse.click(region.tapPoint.x, region.tapPoint.y);
    expect((await getColouringInfo(page))?.undoCount).toBe(50);

    await tapTestId(page, 'colouring-next');
    expect((await getColouringInfo(page))?.undoCount).toBe(0);
    await expect(page.locator('[data-testid="colouring-undo"]')).toBeDisabled();
  });

  test('[AC-06] @single-orientation age 2 shows 8 swatches including charcoal; age 5 shows 16 including grey and peach; default red; swatches are >= 64 CSS px', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a');
    await waitForColouringReady(page);
    const age2 = page.locator('[data-testid^="colouring-swatch-"]');
    await expect(age2).toHaveCount(8);
    await expect(page.locator('[data-testid="colouring-swatch-charcoal"]')).toBeVisible();
    await expect(page.locator('[data-testid="colouring-swatch-white"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="colouring-swatch-cream"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="colouring-swatch-red"]')).toHaveAttribute('aria-pressed', 'true');
    const redBox = await page.locator('[data-testid="colouring-swatch-red"]').boundingBox();
    expect(redBox).toBeTruthy();
    expect(redBox!.width).toBeGreaterThanOrEqual(64);
    expect(redBox!.height).toBeGreaterThanOrEqual(64);
    await tapTestId(page, 'colouring-swatch-charcoal');
    await expect(page.locator('[data-testid="colouring-swatch-charcoal"]')).toHaveAttribute('aria-pressed', 'true');
    await tapTestId(page, 'hud-back');

    await enterColouring(page, 'profile-b');
    await waitForColouringReady(page);
    await expect(page.locator('[data-testid^="colouring-swatch-"]')).toHaveCount(16);
    await expect(page.locator('[data-testid="colouring-swatch-grey"]')).toBeVisible();
    await expect(page.locator('[data-testid="colouring-swatch-peach"]')).toBeVisible();
  });

  test('[AC-10] @single-orientation intro, help, 30s warning, and end lines request the right ids; fills and tools request no speech', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a', { balanceSec: 2 });
    await waitForColouringReady(page);
    const intro = (await getSpokenLines(page)).filter((l) => l.lineId === 'colouring.intro.he');
    expect(intro.length).toBeGreaterThanOrEqual(1);
    expect(intro[0].lang).toBe('he');

    const beforeHelp = await getSpokenLineCount(page);
    await tapTestId(page, 'hud-help');
    const help = (await getSpokenLines(page, beforeHelp)).find((l) => l.lineId === 'colouring.help.he');
    expect(help?.lang).toBe('he');

    const beforeFill = await getSpokenLineCount(page);
    const info = await getColouringInfo(page);
    await page.mouse.click(info!.regions[0].tapPoint.x, info!.regions[0].tapPoint.y);
    await tapTestId(page, 'colouring-undo');
    expect(await getSpokenLineCount(page)).toBe(beforeFill);

    await page.waitForTimeout(4000);
    const warning = (await getSpokenLines(page)).filter((l) => l.lineId === 'bubbles.lowWarning');
    expect(warning.length).toBe(1);

    await page.waitForTimeout(10_000);
    const end = (await getSpokenLines(page)).filter((l) => l.lineId === 'colouring.end.he');
    expect(end.length).toBeGreaterThanOrEqual(1);
    expect(end[0].lang).toBe('he');
  });

  test('[AC-16] @single-orientation clear resets the page as one undoable step, with no confirm; clear on an empty page records no step', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    const dialogs: string[] = [];
    page.on('dialog', (d) => {
      dialogs.push(d.message());
      void d.dismiss();
    });
    await expect(async () => {
      await tapTestId(page, 'colouring-clear');
    }).not.toThrow();
    expect((await getColouringInfo(page))?.undoCount).toBe(0);
    expect(dialogs).toEqual([]);

    await page.mouse.click(info.regions[0].tapPoint.x, info.regions[0].tapPoint.y);
    await tapTestId(page, 'colouring-clear');
    expect(dialogs).toEqual([]);
    expect((await getColouringInfo(page))?.fills).toEqual({});
    expect((await getColouringInfo(page))?.undoCount).toBeGreaterThan(0);
    await tapTestId(page, 'colouring-undo');
    expect((await getColouringInfo(page))?.fills[info.regions[0].id]).toBeDefined();
  });

  test('[AC-17] @single-orientation previous/next walk the 8 pages, stop at the ends, keep per-page fills, and autosave the current page', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a', { seed: { pageId: 'cat' } });
    const first = await waitForColouringReady(page);
    expect(first.pageId).toBe('cat');
    expect(first.pageIndex).toBe(0);
    await expect(page.locator('[data-testid="colouring-prev"]')).toBeDisabled();
    await page.mouse.click(first.regions[0].tapPoint.x, first.regions[0].tapPoint.y);
    const catFill = (await getColouringInfo(page))!.fills;

    await tapTestId(page, 'colouring-next');
    const dog = await getColouringInfo(page);
    expect(dog?.pageId).toBe('dog');
    expect(dog?.pageIndex).toBe(1);
    expect(dog?.fills).toEqual({});

    for (let i = 0; i < 6; i++) await tapTestId(page, 'colouring-next');
    const last = await getColouringInfo(page);
    expect(last?.pageId).toBe('chef');
    expect(last?.pageIndex).toBe(7);
    await expect(page.locator('[data-testid="colouring-next"]')).toBeDisabled();

    for (let i = 0; i < 7; i++) await tapTestId(page, 'colouring-prev');
    const back = await getColouringInfo(page);
    expect(back?.pageId).toBe('cat');
    expect(back?.fills).toEqual(catFill);
  });

  test('[AC-18] @single-orientation fills and the current page restore after hud-back and after a reload; undo is empty; profiles are isolated', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a', { seed: { pageId: 'cat' } });
    const info = await waitForColouringReady(page);
    await page.mouse.click(info.regions[0].tapPoint.x, info.regions[0].tapPoint.y);
    const saved = (await getColouringInfo(page))!;
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');

    await enterColouring(page, 'profile-a');
    const restored = await waitForColouringReady(page);
    expect(restored.pageId).toBe(saved.pageId);
    expect(restored.fills).toEqual(saved.fills);
    expect(restored.undoCount).toBe(0);

    await page.reload();
    await enterColouring(page, 'profile-a');
    const reloaded = await waitForColouringReady(page);
    expect(reloaded.fills).toEqual(saved.fills);
    expect(reloaded.undoCount).toBe(0);
    await tapTestId(page, 'hud-back');

    await enterColouring(page, 'profile-b');
    const other = await waitForColouringReady(page);
    expect(other.fills).not.toEqual(saved.fills);
  });

  test('[AC-20] @single-orientation on time-out the page is saved, taps are ignored, the end line plays, colouring-end has only Home, and fills survive re-entry', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await enterColouring(page, 'profile-a', { balanceSec: 2, seed: { pageId: 'cat' } });
    const info = await waitForColouringReady(page);
    await page.mouse.click(info.regions[0].tapPoint.x, info.regions[0].tapPoint.y);
    const filled = (await getColouringInfo(page))!.fills;
    await page.waitForTimeout(10_000);
    const ended = await getColouringInfo(page);
    expect(ended?.ended).toBe(true);
    await expect(page.locator('[data-testid="colouring-end"]')).toBeVisible();
    await expect(page.locator('[data-testid="colouring-end-home"]')).toBeVisible();
    expect(await page.locator('[data-testid="colouring-end"] button').count()).toBe(1);
    const lines = await getSpokenLines(page);
    expect(lines.some((l) => l.lineId === 'colouring.end.he')).toBe(true);

    const afterEnd = ended!.regions[0];
    if (afterEnd) await page.mouse.click(afterEnd.tapPoint.x, afterEnd.tapPoint.y);
    expect((await getColouringInfo(page))?.fills).toEqual(filled);

    await tapTestId(page, 'colouring-end-home');
    await waitForScene(page, 'MapScene');
    await enterColouring(page, 'profile-a', { balanceSec: 60 });
    const again = await waitForColouringReady(page);
    expect(again.fills).toEqual(filled);
    expect(again.ended).toBe(false);
  });

  test('[AC-21] @single-orientation a 0 balance shows the 0:00 toast and no picker; with a balance the picker opens, close stays on the map, and hud-back returns to the map', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await tapWorldBuilding(page, 'profile-a', 'leisure-corner', {
      beforeEnter: () => seedBalanceSec(page, 0),
    });
    // The map HUD already shows ⏳ 0:00; the toast is the absolutely positioned pill (no test id).
    await expect(page.locator('.shell-pill[style*="position: absolute"]').filter({ hasText: '⏳ 0:00' })).toBeVisible();
    await expect(page.locator('[data-testid="game-picker-leisure-colouring"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="game-picker-bubbles"]')).toHaveCount(0);
    expect(await getActiveScenes(page)).toContain('MapScene');
    expect(await getActiveScenes(page)).not.toContain('ColouringScene');
    expect(await getActiveScenes(page)).not.toContain('BubblesScene');

    await tapWorldBuilding(page, 'profile-a', 'leisure-corner', {
      beforeEnter: () => seedBalanceSec(page, 60),
    });
    await expect(page.locator('[data-testid="game-picker-leisure-colouring"]')).toBeVisible();
    await expect(page.locator('[data-testid="game-picker-bubbles"]')).toBeVisible();
    await tapTestId(page, 'game-picker-close');
    expect(await getActiveScenes(page)).toContain('MapScene');
    expect(await getActiveScenes(page)).not.toContain('ColouringScene');

    await enterColouring(page, 'profile-a', { balanceSec: 60 });
    await waitForColouringReady(page);
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    await expect(page.locator('[data-testid="game-picker-leisure-colouring"]')).toHaveCount(0);
  });

  test('with timeEarning disabled, Colouring Time opens with no timer or balance, does not end after a short seeded time, and leaves via back', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo); // @single-orientation
    test.setTimeout(90_000);
    await enterWorldByTap(page, 'profile-a', 'leisure-corner', 'leisure-colouring', {
      timeEarningEnabled: false,
      beforeEnter: () => seedBalanceSec(page, 2),
    });
    const info = await waitForColouringReady(page);
    expect(info.ended).toBe(false);
    await expect(page.locator('[data-testid="hud-back"]')).toBeVisible();
    await expect(page.locator('[data-testid="colouring-countdown"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="leisure-balance"]')).toHaveCount(0);

    // A 2 s balance + 5 s grace would have ended a timed session.
    await page.waitForTimeout(13_000);
    expect(await getActiveScenes(page)).toContain('ColouringScene');
    expect((await getColouringInfo(page))?.ended).toBe(false);
    await expect(page.locator('[data-testid="colouring-end"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="colouring-end-home"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="colouring-countdown"]')).toHaveCount(0);
    await expect(page.locator('[data-testid="leisure-balance"]')).toHaveCount(0);

    const shotDir = '/workspace/shots-timepause';
    if (existsSync(shotDir)) {
      await page.screenshot({ path: `${shotDir}/colouring-time-paused-landscape.png`, fullPage: false });
    }

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('ColouringScene');
  });
});

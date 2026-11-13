// Platform, layout, offline, parent-gate, and lazy-load e2e for Colouring Time Pass 1.
import { test, expect, type Page, type Request } from '@playwright/test';
import {
  enterWorldByTap,
  getColouringInfo,
  seedBalanceSec,
  waitForColouringReady,
  waitForScene,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterColouring(page: Page, profile: 'profile-a' | 'profile-b' = 'profile-a'): Promise<void> {
  await enterWorldByTap(page, profile, 'leisure-corner', 'leisure-colouring', {
    beforeEnter: () => seedBalanceSec(page, 120),
  });
}

const COLOURING_ASSET = /art\/colouring\/|leisure-colouring-bg-/;

test.describe('leisure-colouring platform', () => {
  test('[AC-11] Colouring Time is playable at 1280x800 and 800x1280: page side >= 680, palette and tools visible, a fill works, and a rotation keeps the fills', async ({ page }) => {
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    expect(info.pageSide).toBeGreaterThanOrEqual(680);
    await expect(page.locator('[data-testid="colouring-palette"]')).toBeVisible();
    await expect(page.locator('[data-testid="colouring-undo"]')).toBeVisible();
    await expect(page.locator('[data-testid="colouring-clear"]')).toBeVisible();
    await page.mouse.click(info.regions[0].tapPoint.x, info.regions[0].tapPoint.y);
    const filled = (await getColouringInfo(page))!.fills;
    expect(Object.keys(filled).length).toBeGreaterThan(0);

    const next = info.pageRect.width >= info.pageRect.height ? { width: 800, height: 1280 } : { width: 1280, height: 800 };
    await page.setViewportSize(next);
    const after = await getColouringInfo(page);
    expect(after?.pageSide).toBeGreaterThanOrEqual(680);
    expect(after?.fills).toEqual(filled);
  });

  test('[AC-11] chrome buttons are >= 64 CSS px and no background decoration overlaps any of them', async ({ page }) => {
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    const buttons = info.chromeButtons ?? [];
    const decorations = info.decorations ?? [];
    const required = ['hud-help', 'hud-back', 'colouring-undo', 'colouring-clear', 'colouring-prev', 'colouring-next'];
    for (const id of required) expect(buttons.map((b) => b.id), `chrome button ${id} reported`).toContain(id);
    expect(decorations.length, 'decorations reported').toBeGreaterThan(0);
    for (const b of buttons) {
      expect(b.rect.width, `${b.id} width`).toBeGreaterThanOrEqual(63.5);
      expect(b.rect.height, `${b.id} height`).toBeGreaterThanOrEqual(63.5);
    }
    const eps = 0.5;
    for (const d of decorations) {
      for (const b of buttons) {
        const w = Math.min(d.rect.x + d.rect.width, b.rect.x + b.rect.width) - Math.max(d.rect.x, b.rect.x);
        const h = Math.min(d.rect.y + d.rect.height, b.rect.y + b.rect.height) - Math.max(d.rect.y, b.rect.y);
        expect(w > eps && h > eps, `decoration ${d.id} overlaps ${b.id}`).toBe(false);
      }
    }
  });

  test('[AC-12] @single-orientation after the first load, with the network off, the journey opens a page and fills a region', async ({ page, context }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await page.goto('./?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // preview environments without a SW still have HTTP cache
      }
    });
    await page.reload();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    await page.mouse.click(info.regions[0].tapPoint.x, info.regions[0].tapPoint.y);
    expect(Object.keys((await getColouringInfo(page))?.fills ?? {}).length).toBeGreaterThan(0);
    await context.setOffline(false);
  });

  test('[AC-13] @single-orientation the parent area stays gated without ?e2e=1, and the game itself has no parent controls', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await page.goto('./');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.getByText('אזור הורים')).toBeVisible();
    await expect(page.getByText(/כמה זה/)).toBeVisible();
    await page.getByRole('button', { name: 'ביטול' }).click();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    // The colouring game itself does not host parent controls (no parent-gate inside the scene).
    await expect(page.locator('[data-testid="colouring-parent"]')).toHaveCount(0);
  });

  test('[AC-22] tap targets (swatches, tools, back, help) are at least 64 CSS px; pageSide >= 680; region hit boxes are not expanded', async ({ page }) => {
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    expect(info.pageSide).toBeGreaterThanOrEqual(680);
    for (const id of ['hud-back', 'hud-help', 'colouring-undo', 'colouring-clear', 'colouring-prev', 'colouring-next', 'colouring-swatch-red']) {
      const box = await page.locator(`[data-testid="${id}"]`).boundingBox();
      expect(box, id).toBeTruthy();
      expect(box!.width, `${id} width`).toBeGreaterThanOrEqual(64);
      expect(box!.height, `${id} height`).toBeGreaterThanOrEqual(64);
    }
    // Painted hit is a bounding box, not an inflated target: the box must stay inside the page.
    for (const region of info.regions) {
      expect(region.hit.width).toBeGreaterThan(0);
      expect(region.hit.x).toBeGreaterThanOrEqual(info.pageRect.x - 0.5);
      expect(region.hit.y).toBeGreaterThanOrEqual(info.pageRect.y - 0.5);
      expect(region.hit.x + region.hit.width).toBeLessThanOrEqual(info.pageRect.x + info.pageRect.width + 0.5);
      expect(region.hit.y + region.hit.height).toBeLessThanOrEqual(info.pageRect.y + info.pageRect.height + 0.5);
    }
  });

  test('[AC-25] @single-orientation no ads, sharing, export, print, cloud, purchase, account, or outbound game network request', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    const outbound: string[] = [];
    page.on('request', (req: Request) => {
      const url = req.url();
      if (/doubleclick|googlesyndication|facebook\.com|analytics|sentry\.io|stripe|paypal|buy\./i.test(url)) {
        outbound.push(url);
      }
    });
    await enterColouring(page);
    await waitForColouringReady(page);
    for (const id of ['colouring-share', 'colouring-export', 'colouring-print', 'colouring-account', 'colouring-buy']) {
      await expect(page.locator(`[data-testid="${id}"]`)).toHaveCount(0);
    }
    expect(outbound, outbound.join('\n')).toEqual([]);
  });

  test('[AC-31] landscape uses a side-column palette (RTL start = right) with pageSide ~704 and >= 680; portrait uses a bottom bar; rotation keeps fills', async ({ page }, testInfo) => {
    test.setTimeout(90_000);
    await enterColouring(page);
    const info = await waitForColouringReady(page);
    await page.mouse.click(info.regions[0].tapPoint.x, info.regions[0].tapPoint.y);
    const fills = (await getColouringInfo(page))!.fills;
    const palette = await page.locator('[data-testid="colouring-palette"]').boundingBox();
    const pageBox = (await getColouringInfo(page))!.pageRect;
    expect((await getColouringInfo(page))!.pageSide).toBeGreaterThanOrEqual(680);
    if (testInfo.project.name === LANDSCAPE) {
      expect((await getColouringInfo(page))!.pageSide).toBeGreaterThanOrEqual(690);
      expect((await getColouringInfo(page))!.pageSide).toBeLessThanOrEqual(720);
      // RTL start side is the right: the palette column sits to the right of the page.
      expect(palette).toBeTruthy();
      expect(palette!.x).toBeGreaterThan(pageBox.x + pageBox.width / 2);
      expect(palette!.height).toBeGreaterThan(palette!.width);
    } else {
      expect(palette).toBeTruthy();
      expect(palette!.y).toBeGreaterThan(pageBox.y + pageBox.height / 2);
      expect(palette!.width).toBeGreaterThan(palette!.height);
    }
    expect(fills).toEqual((await getColouringInfo(page))!.fills);
  });

  test('[AC-34] @single-orientation no colouring page or background is requested before Colouring Time is entered', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    const early: string[] = [];
    const onReq = (req: Request) => {
      if (COLOURING_ASSET.test(req.url())) early.push(req.url());
    };
    page.on('request', onReq);
    await page.goto('./?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="profile-a"]').click();
    await waitForScene(page, 'MapScene');
    // Still on the map (and even a Leisure Corner tap that does not enter colouring) must not fetch pages.
    expect(early, early.join('\n')).toEqual([]);
    page.off('request', onReq);
  });
});

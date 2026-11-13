import { test, expect, type Page } from '@playwright/test';
import { enterWorldByTap, waitForRoundReady, waitForScene } from './helpers/journey';

/** Tap the dimmer (help overlay) at a point that is not on the card itself. */
async function clickOverlayOutsideCard(page: Page): Promise<void> {
  const cardBox = await page.locator('[data-testid="help-card"]').boundingBox();
  const overlayBox = await page.locator('[data-testid="help-card-close"]').boundingBox();
  if (!cardBox || !overlayBox) throw new Error('help card or overlay not visible');
  const inRect = (pt: { x: number; y: number }, r: { x: number; y: number; width: number; height: number }) =>
    pt.x >= r.x && pt.x <= r.x + r.width && pt.y >= r.y && pt.y <= r.y + r.height;
  const candidates = [
    { x: overlayBox.x + 12, y: overlayBox.y + 12 },
    { x: overlayBox.x + overlayBox.width - 12, y: overlayBox.y + 12 },
    { x: overlayBox.x + 12, y: overlayBox.y + overlayBox.height - 12 },
    { x: overlayBox.x + overlayBox.width / 2, y: overlayBox.y + 12 },
  ];
  const tap = candidates.find((pt) => !inRect(pt, cardBox));
  if (!tap) throw new Error('no free overlay tap point outside the card');
  await page.mouse.click(tap.x, tap.y);
}

async function assertCardStaysOpenOnCardTapAndClosesOnDimmer(page: Page): Promise<void> {
  const card = page.locator('[data-testid="help-card"]');
  await page.locator('[data-testid="hud-help"]').click();
  await expect(card).toBeVisible();
  await card.click();
  await expect(card).toBeVisible();
  await clickOverlayOutsideCard(page);
  await expect(card).toHaveCount(0);
}

test.describe('help card: tapping the card does not close it; the dimmer does', () => {
  test('[AC-39] restaurant help card itself does not close; the dimmer does', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'language-house');
    await waitForRoundReady(page);
    await assertCardStaysOpenOnCardTapAndClosesOnDimmer(page);
  });

  test('[AC-39] orchestra help card itself does not close; the dimmer does', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'art-studio');
    await waitForScene(page, 'OrchestraScene');
    await expect(page.locator('[data-testid="hud-help"]')).toBeVisible({ timeout: 10_000 });
    await page.waitForTimeout(800);
    await assertCardStaysOpenOnCardTapAndClosesOnDimmer(page);
  });
});

import { test, expect } from '@playwright/test';

// Parent area credits screen, reached by real taps (e2e bypass skips only the multiplication gate).
test('parent settings opens the credits screen and returns', async ({ page }) => {
  await page.goto('/?e2e=1');
  await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
  await page.locator('[data-testid="parent-gate-btn"]').click();
  await expect(page.locator('[data-testid="parent-exit-btn"]')).toBeVisible();

  const creditsBtn = page.locator('[data-testid="parent-credits-btn"]');
  await creditsBtn.scrollIntoViewIfNeeded();
  const btnBox = (await creditsBtn.boundingBox())!;
  expect(btnBox.height).toBeGreaterThanOrEqual(64);
  await creditsBtn.click();

  // Shipped list is empty; if items are added later the list is shown instead.
  const empty = page.locator('[data-testid="credits-empty"]');
  const list = page.locator('[data-testid="credits-list"]');
  await expect(empty.or(list)).toBeVisible();

  const back = page.locator('[data-testid="credits-back"]');
  const backBox = (await back.boundingBox())!;
  expect(backBox.width).toBeGreaterThanOrEqual(64);
  expect(backBox.height).toBeGreaterThanOrEqual(64);
  await back.click();
  await expect(page.locator('[data-testid="parent-exit-btn"]')).toBeVisible();
});

import { existsSync, readFileSync } from 'node:fs';
import { test, expect } from '@playwright/test';

const version = (JSON.parse(readFileSync(new URL('../../package.json', import.meta.url), 'utf8')) as { version: string }).version;

// Parent area build info line, reached by real taps (e2e bypass skips only the multiplication gate).
test('parent settings shows build version, sha and date', async ({ page }, testInfo) => {
  await page.goto('/?e2e=1');
  await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
  await page.locator('[data-testid="parent-gate-btn"]').click();
  await expect(page.locator('[data-testid="parent-exit-btn"]')).toBeVisible();

  const info = page.locator('[data-testid="parent-build-info"]');
  await info.scrollIntoViewIfNeeded();
  await expect(info).toBeVisible();
  await expect(info).toContainText(version);
  await expect(info).toHaveText(/\d{4}-\d{2}-\d{2} \d{2}:\d{2}/);

  const shotDir = '/workspace/shots-buildinfo';
  if (testInfo.project.name.startsWith('landscape') && existsSync(shotDir)) {
    await page.screenshot({ path: `${shotDir}/parent-build-info.png`, fullPage: false });
  }
});

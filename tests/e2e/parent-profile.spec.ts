// Parent area: per-child profile page (language, start French higher, overall difficulty, per-game levels).
// Real taps from the profile screen; `?e2e=1` only skips the multiplication gate. Hooks seed or read state.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import {
  enterMapByTap,
  enterWorldByTap,
  readStoredSkill,
  seedSortingLevel,
  tapTestId,
  waitForLetterMonsterReady,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

const id = (testId: string) => `[data-testid="${testId}"]`;

async function openSettingsFromProfileSelect(page: Page): Promise<void> {
  await page.goto('./?e2e=1');
  await expect(page.locator(id('profile-a'))).toBeVisible();
  await page.locator(id('parent-gate-btn')).click();
  await expect(page.locator(id('parent-exit-btn'))).toBeVisible();
}

async function openProfilePage(page: Page, profile: 'a' | 'b'): Promise<void> {
  await page.locator(id(`parent-open-profile-${profile}`)).click();
  await expect(page.locator(id(`parent-profile-page-${profile}`))).toBeVisible();
}

const level = async (page: Page, game: string, lang: string): Promise<number> => {
  const node = page.locator(id(`parent-level-${game}-${lang}`));
  await node.scrollIntoViewIfNeeded();
  return Number(await node.textContent());
};

test.describe('parent profile page', () => {
  test('[PROFILE-01] @single-orientation the main settings screen has no global language select and lists both girls', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await expect(page.locator('select')).toHaveCount(0);
    await expect(page.locator(id('parent-open-profile-a'))).toBeVisible();
    await expect(page.locator(id('parent-open-profile-b'))).toBeVisible();
    for (const profile of ['a', 'b']) {
      const box = (await page.locator(id(`parent-open-profile-${profile}`)).boundingBox())!;
      expect(box.height).toBeGreaterThanOrEqual(44);
    }
  });

  test('[PROFILE-02] @single-orientation a language set on her page is saved per profile, reloads, and drives the game', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    await page.locator(id('parent-profile-languages')).selectOption('fr');
    await page.locator(id('parent-profile-back')).click();
    await page.locator(id('parent-save-btn')).click();

    // After a reload both profiles read back: b is French, a is still the default.
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    await expect(page.locator(id('parent-profile-languages'))).toHaveValue('fr');
    await page.locator(id('parent-profile-back')).click();
    await openProfilePage(page, 'a');
    await expect(page.locator(id('parent-profile-languages'))).toHaveValue('both');
    await page.locator(id('parent-profile-back')).click();
    await page.locator(id('parent-exit-btn')).click();

    // Her game then uses French only (letter-monster, entered by real taps through the world building and picker).
    await enterWorldByTap(page, 'profile-b', 'language-house', 'letter-monster');
    const info = await waitForLetterMonsterReady(page);
    expect(info.language).toBe('fr');
  });

  test('[PROFILE-03] @single-orientation two profiles hold different languages and the page reflects both', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'a');
    await page.locator(id('parent-profile-languages')).selectOption('en');
    await page.locator(id('parent-profile-back')).click();
    await openProfilePage(page, 'b');
    await page.locator(id('parent-profile-languages')).selectOption('fr');
    await page.locator(id('parent-profile-back')).click();
    await openProfilePage(page, 'a');
    await expect(page.locator(id('parent-profile-languages'))).toHaveValue('en');
    await page.locator(id('parent-profile-back')).click();
    await openProfilePage(page, 'b');
    await expect(page.locator(id('parent-profile-languages'))).toHaveValue('fr');
  });

  test('[PROFILE-04] @single-orientation start French higher raises the unstarted French level above English on age5; age2 has no toggle', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    const en = await level(page, 'travel-suitcase', 'en');
    expect(await level(page, 'travel-suitcase', 'fr')).toBe(en);
    await page.locator(id('parent-profile-start-french-higher')).check();
    expect(await level(page, 'travel-suitcase', 'fr')).toBeGreaterThan(en);
    expect(await level(page, 'travel-suitcase', 'en')).toBe(en);
    expect(await level(page, 'picnic-train', 'fr')).toBeGreaterThan(await level(page, 'picnic-train', 'en'));
    await expect(page.locator(id('parent-level-note-travel-suitcase-fr'))).toHaveText('טרם התחילה');
    await page.locator(id('parent-profile-back')).click();

    await openProfilePage(page, 'a');
    await expect(page.locator(id('parent-profile-start-french-higher'))).toHaveCount(0);
    await expect(page.locator(id('parent-profile-difficulty'))).toHaveCount(0);
    const aEn = await level(page, 'picnic-train', 'en');
    expect(await level(page, 'picnic-train', 'fr')).toBe(aEn);
  });

  test('[PROFILE-05] @single-orientation challenging difficulty raises unstarted levels on age5 (clamped); age2 is unchanged', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    const regular = await level(page, 'picnic-train', 'en');
    const regularMonster = await level(page, 'letter-monster', 'en');
    await page.locator(id('parent-profile-difficulty')).selectOption('challenging');
    expect(await level(page, 'picnic-train', 'en')).toBeGreaterThan(regular);
    // Letter Monster age5 starts at 3; challenging adds 2. Max is now 8, so this is not clamped.
    expect(await level(page, 'letter-monster', 'en')).toBe(5);
    expect(regularMonster).toBe(3);
    await page.locator(id('parent-profile-back')).click();

    await openProfilePage(page, 'a');
    expect(await level(page, 'picnic-train', 'en')).toBe(2);
    expect(await level(page, 'letter-monster', 'en')).toBe(1);
  });

  test('[PROFILE-06] @single-orientation + and - persist at once, clamp at the track bounds, and Reset returns to the effective start', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await enterMapByTap(page, 'profile-b', { beforeEnter: () => seedSortingLevel(page, 7) });
    await tapTestId(page, 'parent-gate-btn');
    await expect(page.locator(id('parent-exit-btn'))).toBeVisible();
    await openProfilePage(page, 'b');

    expect(await level(page, 'sorting-beds', 'en')).toBe(7);
    await page.locator(id('parent-level-up-sorting-beds-en')).click();
    expect(await level(page, 'sorting-beds', 'en')).toBe(8);
    expect((await readStoredSkill(page, 'profile-b', 'en'))?.level).toBe(8);
    await expect(page.locator(id('parent-level-up-sorting-beds-en'))).toBeDisabled();
    await page.locator(id('parent-level-up-sorting-beds-en')).click({ force: true });
    expect(await level(page, 'sorting-beds', 'en')).toBe(8);

    for (let i = 0; i < 9; i++) await page.locator(id('parent-level-down-sorting-beds-en')).click({ force: true });
    expect(await level(page, 'sorting-beds', 'en')).toBe(1);
    await expect(page.locator(id('parent-level-down-sorting-beds-en'))).toBeDisabled();
    expect((await readStoredSkill(page, 'profile-b', 'en'))?.level).toBe(1);

    await page.locator(id('parent-level-reset-sorting-beds-en')).click();
    expect(await level(page, 'sorting-beds', 'en')).toBe(5);
    expect((await readStoredSkill(page, 'profile-b', 'en'))?.level).toBe(5);
  });

  test('[PROFILE-07] @single-orientation +5 minutes returns to the same profile page', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    await page.locator(id('plus-five-b')).click();
    await expect(page.locator(id('parent-profile-page-b'))).toBeVisible();
  });
});

test('[PROFILE-08] the profile page fits a phone-sized viewport and its tap targets are at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSettingsFromProfileSelect(page);
  await openProfilePage(page, 'b');
  const back = (await page.locator(id('parent-profile-back')).boundingBox())!;
  expect(back.height).toBeGreaterThanOrEqual(44);
  const up = page.locator(id('parent-level-up-letter-monster-en'));
  await up.scrollIntoViewIfNeeded();
  const upBox = (await up.boundingBox())!;
  expect(upBox.width).toBeGreaterThanOrEqual(44);
  expect(upBox.height).toBeGreaterThanOrEqual(44);
  expect(upBox.x + upBox.width).toBeLessThanOrEqual(360);
  expect(upBox.x).toBeGreaterThanOrEqual(0);
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

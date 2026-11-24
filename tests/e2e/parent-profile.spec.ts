// Parent area: the per-child profile page, generic across all games (name, age track, language, age5 French boost and
// difficulty, leisure balance, one child-wide progress reset). There are no per-game level controls.
// Real taps from the profile screen; `?e2e=1` only skips the multiplication gate. Skills are seeded and read through
// localStorage (state only, no game actions, no scene navigation).
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { enterWorldByTap, waitForLetterMonsterReady } from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

const id = (testId: string) => `[data-testid="${testId}"]`;

// Real keys: Letter Monster age5 starts at 3 and tops out at 8; Animal Restaurant age5 starts at 5 and tops out at 12.
const LM_EN = 'language-house.letter-monster.en';
const LM_FR = 'language-house.letter-monster.fr';
const REST_EN = 'language-house.animal-restaurant.en';
const REST_FR = 'language-house.animal-restaurant.fr';

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

/** Seeds already-started skills (level only; the rest is a valid skill). Reload afterwards so the app reads them. */
async function seedSkills(page: Page, profile: 'a' | 'b', levels: Record<string, number>): Promise<void> {
  await page.evaluate(
    ([pid, lv]) => {
      const skills: Record<string, unknown> = {};
      for (const [key, level] of Object.entries(lv)) {
        skills[key] = {
          level,
          cleanStreak: 1,
          recent: ['clean'],
          afterDrop: false,
          lastPlayedDay: '2026-11-20',
          items: { apple: { box: 2, seen: 2, clean: 2, lastSeenDay: '2026-11-20' } },
        };
      }
      window.localStorage.setItem(`kids-app-adaptive:${pid}`, JSON.stringify({ schemaVersion: 1, profileId: pid, skills }));
    },
    [profile, levels] as const,
  );
}

/** Reads the stored level per skill key of one profile (null when the profile has no adaptive payload). */
async function storedLevels(page: Page, profile: 'a' | 'b'): Promise<Record<string, number> | null> {
  return page.evaluate((pid) => {
    const raw = window.localStorage.getItem(`kids-app-adaptive:${pid}`);
    if (!raw) return null;
    const skills = (JSON.parse(raw) as { skills: Record<string, { level: number }> }).skills;
    return Object.fromEntries(Object.entries(skills).map(([k, v]) => [k, v.level]));
  }, profile);
}

test.describe('parent profile page', () => {
  test('[AC-15] @single-orientation the main settings screen has no global language select and lists both girls', async ({ page }, testInfo) => {
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

  test('[AC-13] @single-orientation a language set on her page is saved per profile, reloads, and drives the game', async ({ page }, testInfo) => {
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

  test('[AC-13] @single-orientation two profiles hold different languages and the page reflects both', async ({ page }, testInfo) => {
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

  test('[AC-01] the profile page is generic: name, age track, language and the age5 options, with no per-game level list or controls', async ({ page }) => {
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    for (const t of ['parent-profile-name', 'parent-profile-age-track', 'parent-profile-languages', 'parent-profile-start-french-higher', 'parent-profile-difficulty', 'parent-profile-reset-progress']) {
      await expect(page.locator(id(t)), t).toBeVisible();
    }
    await expect(page.locator('[data-testid^="parent-level"]')).toHaveCount(0);
    await expect(page.locator('.shell-levels, .shell-level-game, .shell-level-btn')).toHaveCount(0);
    await expect(page.getByText('טרם התחילה')).toHaveCount(0);
  });

  test('[AC-02] age2 has no French-higher or difficulty control (also when the age select is switched live) and no per-game levels', async ({ page }) => {
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'a');
    await expect(page.locator(id('parent-profile-start-french-higher'))).toHaveCount(0);
    await expect(page.locator(id('parent-profile-difficulty'))).toHaveCount(0);
    await expect(page.locator('[data-testid^="parent-level"]')).toHaveCount(0);
    await page.locator(id('parent-profile-age-track')).selectOption('age5');
    await expect(page.locator(id('parent-profile-difficulty'))).toBeVisible();
    await page.locator(id('parent-profile-age-track')).selectOption('age2');
    await expect(page.locator(id('parent-profile-start-french-higher'))).toHaveCount(0);
    await expect(page.locator(id('parent-profile-difficulty'))).toHaveCount(0);
  });

  test('[AC-11] French boost on age5 lifts started French skills only, persists across Back and reload, and leaves age2 alone', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator(id('profile-a'))).toBeVisible();
    await seedSkills(page, 'a', { [LM_EN]: 1, [LM_FR]: 1 });
    await seedSkills(page, 'b', { [LM_EN]: 3, [LM_FR]: 3, [REST_EN]: 5, [REST_FR]: 12 });
    await page.reload();
    await page.locator(id('parent-gate-btn')).click();
    await openProfilePage(page, 'b');
    await page.locator(id('parent-profile-start-french-higher')).check();
    await expect.poll(() => storedLevels(page, 'b')).toEqual({ [LM_EN]: 3, [LM_FR]: 4, [REST_EN]: 5, [REST_FR]: 12 });
    expect(await storedLevels(page, 'a')).toEqual({ [LM_EN]: 1, [LM_FR]: 1 });

    await page.locator(id('parent-profile-back')).click();
    await page.locator(id('parent-save-btn')).click();
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    await expect(page.locator(id('parent-profile-start-french-higher'))).toBeChecked();
    await page.locator(id('parent-profile-start-french-higher')).uncheck();
    await expect.poll(async () => (await storedLevels(page, 'b'))?.[LM_FR]).toBe(4);
  });

  test('[AC-11] challenging on age5 lifts every started game below the floor (clamped), never lowers, and survives toggling back', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator(id('profile-a'))).toBeVisible();
    await seedSkills(page, 'a', { [LM_EN]: 1, [LM_FR]: 1 });
    await seedSkills(page, 'b', { [LM_EN]: 3, [LM_FR]: 8, [REST_EN]: 5, [REST_FR]: 11 });
    await page.reload();
    await page.locator(id('parent-gate-btn')).click();
    await openProfilePage(page, 'b');
    await page.locator(id('parent-profile-difficulty')).selectOption('challenging');
    await expect.poll(() => storedLevels(page, 'b')).toEqual({ [LM_EN]: 5, [LM_FR]: 8, [REST_EN]: 7, [REST_FR]: 11 });
    expect(await storedLevels(page, 'a')).toEqual({ [LM_EN]: 1, [LM_FR]: 1 });

    await page.locator(id('parent-profile-difficulty')).selectOption('regular');
    await expect(page.locator(id('parent-profile-difficulty'))).toHaveValue('regular');
    expect(await storedLevels(page, 'b')).toEqual({ [LM_EN]: 5, [LM_FR]: 8, [REST_EN]: 7, [REST_FR]: 11 });
  });

  test('[AC-12] Reset progress asks twice, clears only this child\'s skills and keeps her settings, balance and the other child', async ({ page }) => {
    await page.goto('./?e2e=1');
    await expect(page.locator(id('profile-a'))).toBeVisible();
    await seedSkills(page, 'a', { [LM_EN]: 2, [REST_FR]: 4 });
    await seedSkills(page, 'b', { [LM_EN]: 6, [REST_FR]: 4 });
    await page.reload();
    await page.locator(id('parent-gate-btn')).click();
    await openProfilePage(page, 'b');
    await page.locator(id('parent-profile-difficulty')).selectOption('challenging');
    await page.locator(id('parent-profile-languages')).selectOption('fr');
    await page.locator(id('plus-five-b')).click();
    await expect(page.locator(id('parent-profile-page-b'))).toBeVisible();
    const balanceNote = page.locator('.shell-profile-page .shell-note', { hasText: '5:00' });
    await expect(balanceNote).toBeVisible();
    const before = await balanceNote.textContent();

    // First tap only asks; cancel keeps everything.
    await page.locator(id('parent-profile-reset-progress')).click();
    await expect(page.locator(id('parent-profile-reset-progress-confirm'))).toBeVisible();
    expect(await storedLevels(page, 'b')).toEqual({ [LM_EN]: 6, [REST_FR]: 7 });
    await page.locator(id('parent-profile-reset-progress-cancel')).click();
    await expect(page.locator(id('parent-profile-reset-progress'))).toBeVisible();
    expect(await storedLevels(page, 'b')).toEqual({ [LM_EN]: 6, [REST_FR]: 7 });

    // Second step resets, and she stays on her page.
    await page.locator(id('parent-profile-reset-progress')).click();
    await page.locator(id('parent-profile-reset-progress-confirm')).click();
    await expect(page.locator(id('parent-profile-page-b'))).toBeVisible();
    await expect(page.locator(id('parent-profile-reset-progress'))).toBeVisible();
    expect(await storedLevels(page, 'b')).toEqual({});
    expect(await storedLevels(page, 'a')).toEqual({ [LM_EN]: 2, [REST_FR]: 4 });
    await expect(page.locator(id('parent-profile-difficulty'))).toHaveValue('challenging');
    await expect(page.locator(id('parent-profile-languages'))).toHaveValue('fr');
    await expect(balanceNote).toHaveText(before!);

    // Settings survive a reload too.
    await page.locator(id('parent-profile-back')).click();
    await page.locator(id('parent-save-btn')).click();
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    await expect(page.locator(id('parent-profile-difficulty'))).toHaveValue('challenging');
    await expect(page.locator(id('parent-profile-languages'))).toHaveValue('fr');
  });

  test('[AC-16] @single-orientation +5 minutes returns to the same profile page', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openSettingsFromProfileSelect(page);
    await openProfilePage(page, 'b');
    await page.locator(id('plus-five-b')).click();
    await expect(page.locator(id('parent-profile-page-b'))).toBeVisible();
  });
});

test('[AC-14] the profile page fits a phone-sized viewport and its tap targets are at least 44px', async ({ page }) => {
  await page.setViewportSize({ width: 360, height: 800 });
  await openSettingsFromProfileSelect(page);
  await openProfilePage(page, 'b');
  for (const t of ['parent-profile-back', 'parent-profile-reset-progress', 'parent-profile-reset-balance', 'plus-five-b']) {
    const node = page.locator(id(t));
    await node.scrollIntoViewIfNeeded();
    const box = (await node.boundingBox())!;
    expect(box.height, t).toBeGreaterThanOrEqual(44);
    expect(box.width, t).toBeGreaterThanOrEqual(44);
    expect(box.x, t).toBeGreaterThanOrEqual(0);
    expect(box.x + box.width, t).toBeLessThanOrEqual(360);
  }
  await page.locator(id('parent-profile-reset-progress')).click();
  for (const t of ['parent-profile-reset-progress-confirm', 'parent-profile-reset-progress-cancel']) {
    const box = (await page.locator(id(t)).boundingBox())!;
    expect(box.height, t).toBeGreaterThanOrEqual(44);
    expect(box.x + box.width, t).toBeLessThanOrEqual(360);
  }
  const overflow = await page.evaluate(() => document.documentElement.scrollWidth > window.innerWidth);
  expect(overflow).toBe(false);
});

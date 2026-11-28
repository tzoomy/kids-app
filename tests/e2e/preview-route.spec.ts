// Preview route `?level=N` (src/game/previewRoute.ts, docs/specs/workshop-l20.md AC-10, AC-11, AC-22): the level opens directly
// from the URL, also for a device that already has saved progress, and again after a reload (what a PWA update does).
// Only READ hooks are used; the saves are seeded through localStorage before the page boots.
import { test, expect, type Page } from '@playwright/test';
import { getActiveScenes, waitForScene } from './helpers/journey';

const STATE_KEY = 'kids-app-state-v2';

/** A device with saved data: only the little girl's profile (age2, so no age5 profile exists) and Workshop progress. */
async function seedSavedDevice(page: Page): Promise<void> {
  await page.addInitScript((key) => {
    if (window.localStorage.getItem('preview-route-seeded')) return;
    window.localStorage.setItem('preview-route-seeded', '1');
    window.localStorage.setItem(
      key,
      JSON.stringify({
        schemaVersion: 2,
        settings: { learnMinutes: 10, leisureMinutes: 5, dailyEarnCapMinutes: 30, idleSeconds: 20, languages: 'both', timeEarning: { enabled: false } },
        profiles: [{ id: 'a', name: 'הקטנה', avatar: 'bunny', ageTrack: 'age2', languages: 'both', startFrenchHigher: false, difficulty: 'regular' }],
        data: {},
      }),
    );
    window.localStorage.setItem(
      'kids-app-mystery-egg:a',
      JSON.stringify({ v: 3, worlds: { workshop: { level: 1, completed: [1] } }, pieces: ['feather'], introSeen: true, entrySeen: ['workshop'] }),
    );
  }, STATE_KEY);
}

test.describe('preview route ?level=N', () => {
  test.setTimeout(90_000);

  test('[AC-10] ?level=20 on a device with saved progress opens L20 directly (not the profile screen, the map or level 1), and a reload keeps it', async ({ page }) => {
    await seedSavedDevice(page);
    await page.goto('./?level=20&e2e=1');
    await waitForScene(page, 'WorkshopL20Scene');
    expect(await getActiveScenes(page)).not.toContain('MapScene');
    expect(await getActiveScenes(page)).not.toContain('MysteryEggScene');
    await expect(page.locator('[data-testid="profile-a"]')).toHaveCount(0);
    // A PWA update reloads the page: the query string is part of the URL, so the same level opens again.
    await page.reload();
    await waitForScene(page, 'WorkshopL20Scene');
    expect(new URL(page.url()).searchParams.get('level')).toBe('20');
  });

  test('[AC-10] the query may carry other params and a stray space, and #/workshop/20 works too', async ({ page }) => {
    await seedSavedDevice(page);
    await page.goto('./?utm_source=chat&level=%2020&e2e=1');
    await waitForScene(page, 'WorkshopL20Scene');
    await page.goto('./?e2e=1#/workshop/20');
    await page.reload();
    await waitForScene(page, 'WorkshopL20Scene');
  });

  test('[AC-11] a level that has no stand-alone scene (?level=1, ?level=19) boots as before: the profile screen, no level scene, no page error', async ({ page }) => {
    const errors: string[] = [];
    page.on('pageerror', (e) => errors.push(e.message));
    await seedSavedDevice(page);
    for (const n of ['1', '19']) {
      await page.goto(`./?level=${n}&e2e=1`);
      await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
      // The game (and its scene hooks) is only created after a profile is picked: none may exist yet.
      expect(await page.evaluate(() => (window as unknown as { __testHooks__?: { getActiveScenes?: () => string[] } }).__testHooks__?.getActiveScenes?.() ?? [])).not.toContain('WorkshopL20Scene');
    }
    expect(errors).toEqual([]);
  });
});

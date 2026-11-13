import { test, expect } from '@playwright/test';
import { clickGame, enterWorldByTap, getActiveScenes, waitForRoundReady, waitForScene, waitForSpokenLine } from './helpers/journey';

test.describe('animal restaurant: map journey', () => {
  test('[AC-01] real-tap journey: profile -> Language House building -> restaurant -> one correct trial -> back to the map', async ({ page }) => {
    test.setTimeout(60_000); // the Hebrew intro clip plays before the food request
    await enterWorldByTap(page, 'profile-a', 'language-house');

    expect(await getActiveScenes(page)).toContain('RestaurantScene');
    expect(await getActiveScenes(page)).not.toContain('MapScene');

    const info = await waitForRoundReady(page);
    expect(info.visualCue).toBe(true); // a fresh age-2 profile shows the prompt bubble
    await expect(page.locator('[data-testid="prompt-bubble"]')).toBeVisible();

    // The food request was spoken (as a clip or as device TTS) in the round's language.
    expect(['en', 'fr']).toContain(info.language);
    const spoken = await waitForSpokenLine(page, (l) => l.lineId.startsWith('food.') && l.lang === info.language, 20_000);
    expect(['clip', 'tts']).toContain(spoken.source);

    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);
    const correct = info.choiceCenters[info.correctIndex];
    await clickGame(page, correct.x, correct.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('RestaurantScene');
  });
});

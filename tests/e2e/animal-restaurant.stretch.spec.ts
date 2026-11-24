// Animal Restaurant age-5 stretch: L10-L12 real-tap journeys (docs/specs/animal-restaurant.md AC-48).
// profile-b is the age-5 track; the level is seeded on the map before the building tap. Hooks only seed or read.
import { test, expect, type Page } from '@playwright/test';
import { clickGame, enterWorldByTap, getRoundInfo, seedRestaurantLevel, waitForRoundReady, waitForSpokenLine, type RoundInfo } from './helpers/journey';

async function enterAt(page: Page, level: number): Promise<RoundInfo> {
  await enterWorldByTap(page, 'profile-b', 'language-house', 'animal-restaurant', { beforeEnter: () => seedRestaurantLevel(page, level) });
  const info = await waitForRoundReady(page);
  expect(info.level).toBe(level);
  return info;
}

async function tapPlate(page: Page, info: RoundInfo, index: number): Promise<void> {
  const c = info.choiceCenters[index];
  await clickGame(page, c.x, c.y);
}

test.describe('animal restaurant: age-5 stretch', () => {
  test('[AC-48] L10 colour + count: the request names a count and a colour, the bubble shows it, and the right plate earns a star', async ({ page }) => {
    test.setTimeout(90_000);
    const info = await enterAt(page, 10);
    expect(info.request).toBe('count-attribute');
    expect(info.choiceCount).toBe(4);
    expect(info.correctIndices).toHaveLength(1);
    expect(info.visualCue).toBe(true);
    await expect(page.locator('[data-testid="prompt-bubble"]')).toBeVisible();
    const spoken = await waitForSpokenLine(page, (l) => l.lineId.startsWith('countattr.') && l.lang === info.language, 25_000);
    expect(spoken.lineId).toMatch(/^countattr\.(apple|banana|pear)\.\w+\.[23]\.(en|fr)$/);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);
    await tapPlate(page, info, info.correctIndex);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
  });

  test('[AC-48] L11 "First..., then...": the second food first is a miss; serving both in order earns a star', async ({ page }) => {
    test.setTimeout(90_000);
    const info = await enterAt(page, 11);
    expect(info.request).toBe('sequence');
    expect(info.ordered).toBe(true);
    expect(info.requestedIndices).toHaveLength(2);
    expect(info.correctIndices).toEqual([info.requestedIndices![0]]);
    await waitForSpokenLine(page, (l) => l.lineId.startsWith('seq.') && l.lang === info.language, 25_000);
    const [first, second] = info.requestedIndices!;

    await tapPlate(page, info, second);
    await expect.poll(async () => (await getRoundInfo(page))?.tries ?? 0, { timeout: 8000 }).toBeGreaterThan(info.tries);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);

    await page.waitForTimeout(600); // the scene ignores taps for 400 ms after a miss
    const again = await waitForRoundReady(page);
    await tapPlate(page, again, first);
    await expect.poll(async () => (await getRoundInfo(page))?.requestedIndices?.length ?? 0, { timeout: 8000 }).toBe(1);
    const next = await waitForRoundReady(page);
    expect(next.correctIndices).toEqual([second]);
    await tapPlate(page, next, second);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
  });

  test('[AC-48] L12 voice-only colour + count: no bubble, one food in a 2x2 of colours and counts, the right plate earns a star', async ({ page }) => {
    test.setTimeout(90_000);
    const info = await enterAt(page, 12);
    expect(info.request).toBe('count-attribute');
    expect(info.visualCue).toBe(false);
    expect(info.choiceCount).toBe(4);
    await waitForSpokenLine(page, (l) => l.lineId.startsWith('countattr.') && l.lang === info.language, 25_000);
    await expect(page.locator('[data-testid="prompt-bubble"]')).toHaveCount(0);
    await tapPlate(page, info, info.correctIndex);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
  });
});

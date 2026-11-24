// Who Lives Here? age-5 stretch: L9-L10 "mystery animal" real-tap journeys (docs/specs/who-lives-here.md AC-23).
// profile-b is the age-5 track; the level is seeded on the map before the building tap. Hooks only seed or read.
import { test, expect, type Page } from '@playwright/test';
import { enterWorldByTap, getHabitatInfo, seedHabitatLevel, tapHome, waitForHabitatReady, waitForSpokenLine, wrongHomeId } from './helpers/journey';

async function enterAt(page: Page, level: number): Promise<void> {
  await enterWorldByTap(page, 'profile-b', 'nature-lab', 'who-lives-here', { beforeEnter: () => seedHabitatLevel(page, level) });
}

test.describe('who lives here: age-5 mystery animal', () => {
  test('[AC-23] L9: the animal is hidden, the riddle is spoken, a miss keeps it hidden, and its home reveals it', async ({ page }) => {
    test.setTimeout(90_000);
    await enterAt(page, 9);
    const info = await waitForHabitatReady(page, 30_000);
    expect(info.level).toBe(9);
    expect(info.request).toBe('mystery');
    expect(info.animalHidden).toBe(true);
    expect(info.homes).toHaveLength(4);
    const lang = info.lang;
    expect(info.textBubble).toBe(true);
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.mystery.${info.currentAnimal.id}.${lang}`, 30_000);
    await expect(page.locator('[data-testid="prompt-bubble"]')).toBeVisible();

    await tapHome(page, wrongHomeId(info));
    // A miss replays the old descriptive clue; the animal stays hidden.
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.clue.${info.currentAnimal.id}.${lang}`, 15_000);
    const after = await waitForHabitatReady(page, 15_000);
    expect(after.currentAnimal.id).toBe(info.currentAnimal.id);
    expect(after.animalHidden).toBe(true);

    await tapHome(page, info.currentAnimal.homeId);
    await expect
      .poll(async () => {
        const now = await getHabitatInfo(page);
        return now === null || now.currentAnimal?.id !== info.currentAnimal.id || now.animalHidden === false;
      }, { timeout: 15_000 })
      .toBe(true);
  });

  test('[AC-23] L10: voice-only mystery, no bubble, the right home places the animal', async ({ page }) => {
    test.setTimeout(90_000);
    await enterAt(page, 10);
    const info = await waitForHabitatReady(page, 30_000);
    expect(info.level).toBe(10);
    expect(info.request).toBe('mystery');
    expect(info.animalHidden).toBe(true);
    expect(info.textBubble).toBe(false);
    await waitForSpokenLine(page, (l) => l.lineId === `habitat.mystery.${info.currentAnimal.id}.${info.lang}`, 30_000);
    await expect(page.locator('[data-testid="prompt-bubble"]')).toHaveCount(0);
    await tapHome(page, info.currentAnimal.homeId);
    await expect
      .poll(async () => {
        const now = await getHabitatInfo(page);
        return now === null || now.currentAnimal?.id !== info.currentAnimal.id;
      }, { timeout: 15_000 })
      .toBe(true);
  });
});

// Kitchen Orchestra age-5 stretch: L9 six-note echo and L10 reverse echo (docs/specs/kitchen-orchestra.md AC-23).
// profile-b is the age-5 track; the level is seeded on the map before the building tap. Hooks only seed or read.
import { test, expect, type Page } from '@playwright/test';
import { clickGame, enterWorldByTap, getOrchestraInfo, seedOrchestraLevel, waitForOrchestraEcho, waitForSpokenLine, type OrchestraInfo } from './helpers/journey';

async function enterAt(page: Page, level: number): Promise<void> {
  await enterWorldByTap(page, 'profile-b', 'language-house', 'kitchen-orchestra', { beforeEnter: () => seedOrchestraLevel(page, level) });
}

async function tapInstrument(page: Page, info: OrchestraInfo, id: string): Promise<void> {
  const c = info.instrumentCenters.find((i) => i.id === id)!;
  await clickGame(page, c.x, c.y);
}

/** Echoes the trial's answer with real taps and waits for the celebration. */
async function echoAnswer(page: Page, info: OrchestraInfo): Promise<void> {
  for (const [i, id] of info.answer.entries()) {
    await tapInstrument(page, info, id);
    if (i < info.answer.length - 1) await expect.poll(async () => (await getOrchestraInfo(page))?.expectedIndex, { timeout: 5000 }).toBe(i + 1);
  }
  await expectStar(page);
}

/** A completed echo adds a star (the celebrate phase itself can be over before a poll sees it). */
async function expectStar(page: Page): Promise<void> {
  await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1$/, { timeout: 10_000 });
}

test.describe('kitchen orchestra: age-5 stretch', () => {
  test('[AC-23] L9: six notes over five instruments, echoed forwards', async ({ page }) => {
    test.setTimeout(120_000);
    await enterAt(page, 9);
    const info = await waitForOrchestraEcho(page);
    expect(info.level).toBe(9);
    expect(info.reverse).toBe(false);
    expect(info.sequence).toHaveLength(6);
    expect(info.instrumentCenters).toHaveLength(5);
    expect(info.answer).toEqual(info.sequence);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0$/);
    await echoAnswer(page, info);
  });

  test('[AC-23] L10 reverse: the rule is spoken, the badge dots go out one per correct tap, and only the backwards echo completes', async ({ page }) => {
    test.setTimeout(120_000);
    await enterAt(page, 10);
    await waitForSpokenLine(page, (l) => l.lineId === 'orchestra.reverse.he', 30_000);
    const info = await waitForOrchestraEcho(page);
    expect(info.level).toBe(10);
    expect(info.reverse).toBe(true);
    expect(info.sequence).toHaveLength(4);
    expect(info.answer).toEqual([...info.sequence].reverse());
    expect(info.answer).not.toEqual(info.sequence);
    expect(info.litDots).toBe(4);
    await waitForSpokenLine(page, (l) => l.lineId === `orchestra.reverse.yourturn.${info.language}`, 15_000);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0$/);

    await tapInstrument(page, info, info.answer[0]);
    await expect.poll(async () => (await getOrchestraInfo(page))?.litDots, { timeout: 5000 }).toBe(3);
    await expect.poll(async () => (await getOrchestraInfo(page))?.expectedIndex, { timeout: 5000 }).toBe(1);
    const rest = { ...info, answer: info.answer.slice(1) };
    for (const [i, id] of rest.answer.entries()) {
      await tapInstrument(page, info, id);
      if (i < rest.answer.length - 1) await expect.poll(async () => (await getOrchestraInfo(page))?.expectedIndex, { timeout: 5000 }).toBe(i + 2);
    }
    await expectStar(page);
  });
});

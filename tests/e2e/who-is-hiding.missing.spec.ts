// Who's Hiding? age-5 stretch: L9-L10 "Who is missing?" real-tap journeys (docs/specs/who-is-hiding.md AC-44).
// profile-b is the age-5 track; the level is seeded on the map before the building tap. Hooks only seed or read.
import { test, expect, type Page } from '@playwright/test';
import { clickGame, enterWorldByTap, getRoundInfo, seedHidingLevel, waitForSpokenLine, type RoundInfo } from './helpers/journey';

async function enterAt(page: Page, level: number): Promise<void> {
  await enterWorldByTap(page, 'profile-b', 'nature-lab', undefined, { beforeEnter: () => seedHidingLevel(page, level) });
}

/** Waits for the answer phase of a "Who is missing?" round (cards on screen, taps accepted). */
async function waitForAnswer(page: Page, timeout = 45_000): Promise<RoundInfo> {
  await expect
    .poll(async () => {
      const info = await getRoundInfo(page);
      return info !== null && info.request === 'missing' && info.phase === 'answer' && info.ready;
    }, { timeout, intervals: [100] })
    .toBe(true);
  return (await getRoundInfo(page))!;
}

test.describe("who's hiding: age-5 who is missing", () => {
  test('[AC-44] L9: line-up peeks, one runs away, the rest come back; the cards are the line-up and the runaway earns a star', async ({ page }) => {
    test.setTimeout(120_000);
    await enterAt(page, 9);
    const phases = new Set<string>();
    const deadline = Date.now() + 45_000;
    let info = await getRoundInfo(page);
    while (!(info && info.phase === 'answer' && info.ready) && Date.now() < deadline) {
      if (info?.phase) phases.add(info.phase);
      await page.waitForTimeout(100);
      info = await getRoundInfo(page);
    }
    info = await waitForAnswer(page);
    phases.add('answer');
    expect(phases.has('peek') || phases.has('gone')).toBe(true);
    expect(phases.has('back')).toBe(true);
    expect(info.level).toBe(9);
    expect(info.request).toBe('missing');
    expect(info.choiceCount).toBe(4);
    expect([...info.choiceIds!].sort()).toEqual([...info.lineupIds!].sort());
    expect(info.choiceIds![info.correctIndex]).toBe(info.targetId);
    expect(info.visualCue).toBe(true);
    await waitForSpokenLine(page, (l) => l.lineId === `hiding.missing.look.${info!.language}`, 5000);
    await waitForSpokenLine(page, (l) => l.lineId === `hiding.missing.gone.${info!.language}`, 5000);
    await waitForSpokenLine(page, (l) => l.lineId === `hiding.missing.ask.${info!.language}`, 15_000);
    await waitForSpokenLine(page, (l) => l.lineId === 'hiding.missing.intro.he', 5000);

    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);
    const c = info.choiceCenters[info.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 10_000 });
  });

  test('[AC-44] L10: six animals, voice only; a wrong card is a miss, then the runaway earns a star', async ({ page }) => {
    test.setTimeout(120_000);
    await enterAt(page, 10);
    const info = await waitForAnswer(page);
    expect(info.level).toBe(10);
    expect(info.choiceCount).toBe(6);
    expect(info.visualCue).toBe(false);
    await expect(page.locator('[data-testid="prompt-bubble"]')).toHaveCount(0);

    const wrong = info.choiceIds!.findIndex((id) => id !== info.targetId);
    const w = info.choiceCenters[wrong];
    await clickGame(page, w.x, w.y);
    await expect.poll(async () => (await getRoundInfo(page))?.tries ?? 0, { timeout: 8000 }).toBeGreaterThan(info.tries);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);

    await page.waitForTimeout(600); // the scene ignores taps for a moment after a miss
    const again = await waitForAnswer(page, 20_000);
    expect(again.targetId).toBe(info.targetId);
    const c = again.choiceCenters[again.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 10_000 });
  });
});

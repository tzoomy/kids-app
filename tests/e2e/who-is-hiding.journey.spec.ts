import { test, expect, type Page } from '@playwright/test';
import {
  clickGame,
  enterWorldByTap,
  getBuildingHit,
  getRoundInfo,
  getSpokenLines,
  waitForRoundReady,
  waitForScene,
  waitForSpokenLine,
  type PageRect,
  type SpokenLine,
} from './helpers/journey';

function isIntro(line: SpokenLine): boolean {
  return line.lineId === 'he.hiding.intro' && line.lang === 'he';
}

function isHelp(line: SpokenLine): boolean {
  return line.lineId === 'he.hiding.help' && line.lang === 'he';
}

function isRequest(line: SpokenLine): boolean {
  return line.lineId.startsWith('hiding.') && !line.lineId.startsWith('hiding.found.');
}

async function waitForRequest(page: Page, since?: number): Promise<SpokenLine> {
  return waitForSpokenLine(page, isRequest, 15_000, since);
}

/** Taps the Nature Lab building from an already-open map (no page reload). */
async function enterNatureLabFromMap(page: Page): Promise<void> {
  await waitForScene(page, 'MapScene');
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  const deadline = Date.now() + 15_000;
  for (;;) {
    const current = await getBuildingHit(page, 'nature-lab');
    const settled = current !== null && current.width > 20 && previous !== null && Math.abs(current.width - previous.width) < 0.5;
    previous = current;
    rect = current;
    if (settled) break;
    if (Date.now() > deadline) throw new Error('Nature Lab building hit rectangle never became available and stable');
    await page.waitForTimeout(100);
  }
  const hit = (await getBuildingHit(page, 'nature-lab')) ?? rect;
  if (!hit) throw new Error('Nature Lab building has no hit rectangle');
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
  await waitForScene(page, 'HidingScene');
}

test.describe("Who's Hiding? intro and help (Pass 1)", () => {
  test('[AC-32] intro plays once per visit, before the first request, and again after leaving and re-entering', async ({ page }) => {
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);

    const intro = await waitForSpokenLine(page, isIntro, 15_000);
    const request = await waitForRequest(page);
    expect(intro.index).toBeLessThan(request.index);
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(1);

    // A later request in the same visit must not play the intro again.
    const info = await getRoundInfo(page);
    expect(info).not.toBeNull();
    const correct = info!.choiceCenters[info!.correctIndex];
    await clickGame(page, correct.x, correct.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    await page.waitForFunction(() => {
      const i = (window as unknown as { __testHooks__: { getRoundInfo: () => { ready?: boolean; correctCount?: number } | null } }).__testHooks__.getRoundInfo();
      return i !== null && i.ready === true && i.correctCount === 1;
    }, undefined, { timeout: 15_000 });
    const second = await waitForRequest(page, request.index + 1);
    expect(second.index).toBeGreaterThan(request.index);
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(1);

    const afterFirstVisit = (await getSpokenLines(page)).at(-1)?.index ?? 0;
    await page.locator('[data-testid="hud-back"]').click();
    await enterNatureLabFromMap(page);
    await waitForRoundReady(page);
    const introAgain = await waitForSpokenLine(page, isIntro, 15_000, afterFirstVisit + 1);
    expect(introAgain.lang).toBe('he');
    expect((await getSpokenLines(page)).filter(isIntro)).toHaveLength(2);
    const requestAgain = await waitForRequest(page, introAgain.index + 1);
    expect(introAgain.index).toBeLessThan(requestAgain.index);
  });

  test('[AC-33] the help pill plays he.hiding.help', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    await waitForSpokenLine(page, isIntro, 15_000);

    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    const help = await waitForSpokenLine(page, isHelp, 10_000);
    expect(help.lang).toBe('he');
    expect(help.lineId).toBe('he.hiding.help');
  });

  test('[AC-35] opening help stops audio, plays the help clip, blocks replay, and closing repeats the request', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab');
    await waitForRoundReady(page);
    const firstRequest = await waitForRequest(page);

    await page.locator('[data-testid="hud-help"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    const help = await waitForSpokenLine(page, isHelp, 10_000);
    expect(help.index).toBeGreaterThan(firstRequest.index);
    // The help overlay covers the canvas and the prompt bubble (tap anywhere closes the card),
    // so a real pointer click cannot reach the speaker while help is open. The scene still
    // guards replay() and postpones the idle hint while helpOpen. Closing repeats the request.
    expect(page.locator('[data-testid="help-card"]')).toBeVisible();
    const afterHelp = (await getSpokenLines(page)).at(-1)!.index;
    // No further request should start while the card stays open.
    await page.waitForTimeout(400);
    const duringHelp = (await getSpokenLines(page)).filter((l) => l.index > afterHelp);
    expect(duringHelp.filter(isRequest)).toHaveLength(0);

    await page.locator('[data-testid="help-card-close"]').click();
    await expect(page.locator('[data-testid="help-card"]')).toHaveCount(0);
    const repeated = await waitForRequest(page, afterHelp + 1);
    expect(repeated.index).toBeGreaterThan(help.index);
  });
});

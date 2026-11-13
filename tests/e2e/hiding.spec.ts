import { test, expect, type Page } from '@playwright/test';
import { enterWorldByTap, seedHidingLevel, seedTimeEarningEnabled } from './helpers/journey';

type Hooks = {
  getRoundInfo: () => HidingInfo | null;
  getGameSize: () => { width: number; height: number };
  getActiveScenes: () => string[];
  seedBalanceSec: (sec: number) => void;
  seedHidingLevel: (level: number) => void;
  goToScreen: (screen: 'map' | 'restaurant' | 'hiding' | 'bubbles') => void;
};

type HidingInfo = {
  request: string;
  correctIndex: number;
  choiceIds: string[];
  choiceCenters: Array<{ x: number; y: number }>;
  replayCenter: { x: number; y: number };
  choiceCount: number;
  promptText: string;
  visualCue: boolean;
  reveal: number;
  speak: string;
  tries: number;
  hinted: boolean;
  level: number;
  skillKey: string;
  correctCount: number;
  ready: boolean;
  shortSound?: boolean;
};

async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __GAME_READY__?: boolean }).__GAME_READY__ === true, { timeout: 15000 });
}

async function enterProfile(page: Page): Promise<void> {
  await page.goto('/?e2e=1');
  await seedTimeEarningEnabled(page, true);
  await page.locator('[data-testid="profile-a"]').click();
  await waitForGameReady(page);
}

async function getInfo(page: Page): Promise<HidingInfo> {
  await page.waitForFunction(() => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo() !== null);
  return page.evaluate(() => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo() as HidingInfo);
}

/** Waits until every bush has popped in and the request was given. */
async function waitForReady(page: Page): Promise<HidingInfo> {
  await page.waitForFunction(() => {
    const info = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo();
    return info !== null && info.request === 'hiding' && info.ready;
  });
  return getInfo(page);
}

async function gamePoint(page: Page, x: number, y: number): Promise<{ cx: number; cy: number }> {
  const size = await page.evaluate(() => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getGameSize());
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return { cx: box.x + (x / size.width) * box.width, cy: box.y + (y / size.height) * box.height };
}

async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const { cx, cy } = await gamePoint(page, x, y);
  await page.mouse.click(cx, cy);
}

async function balanceSec(page: Page): Promise<number> {
  const text = await page.locator('[data-testid="leisure-balance"]').innerText();
  const m = text.match(/(\d+):(\d+)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

/** Opens Who's Hiding? the way a child does: tap the Nature Lab building on the map. */
async function openFromMap(page: Page): Promise<void> {
  await page.evaluate(() => new Promise((r) => requestAnimationFrame(() => requestAnimationFrame(r))));
  await page.waitForFunction(() => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getActiveScenes().includes('MapScene'));
  const label = page.locator('.shell-map-pin[data-world-id="nature-lab"]');
  await expect(label).toBeVisible();
  // The map pin label sits 88 game units below its building (MapScene), so the building is directly above it.
  const [labelBox, canvasBox, size] = await Promise.all([
    label.boundingBox(),
    page.locator('canvas').boundingBox(),
    page.evaluate(() => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getGameSize()),
  ]);
  if (!labelBox || !canvasBox) throw new Error('no map pin or canvas');
  const scale = canvasBox.height / size.height;
  // Wait for the staggered pop-in of the buildings to finish before tapping.
  await page.waitForTimeout(900);
  await page.mouse.click(labelBox.x + labelBox.width / 2, labelBox.y - 88 * scale);
  // Nature Lab opens its game picker; Who's Hiding? is a card.
  const card = page.locator('[data-testid="game-picker-who-is-hiding"]');
  await card.waitFor({ state: 'visible', timeout: 8000 });
  await card.click();
  await page.waitForFunction(() => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getActiveScenes().includes('HidingScene'), undefined, {
    timeout: 8000,
  });
}

/** Total number of recorded trials across all stored adaptive skills. */
async function recordedTrials(page: Page): Promise<number> {
  return page.evaluate(() => {
    let total = 0;
    for (let i = 0; i < localStorage.length; i++) {
      const key = localStorage.key(i);
      if (!key || !key.startsWith('kids-app-adaptive:')) continue;
      const profile = JSON.parse(localStorage.getItem(key) ?? '{}') as {
        skills?: Record<string, { items: Record<string, { seen: number }> }>;
      };
      for (const skill of Object.values(profile.skills ?? {})) for (const item of Object.values(skill.items)) total += item.seen;
    }
    return total;
  });
}

test.describe("Who's Hiding? (Nature Lab)", () => {
  test('[AC-01] [AC-07] [AC-11] profile select -> map -> Nature Lab opens a ready round at the age-2 start level', async ({ page }) => {
    await enterProfile(page);
    await openFromMap(page);
    const info = await waitForReady(page);
    // A fresh age-2 profile starts at L2 of the 8-level curve: 3 bushes, far distractors, most of the animal shows.
    expect(info.level).toBe(2);
    expect(info.skillKey).toMatch(/^nature-lab\.who-is-hiding\.(en|fr)$/);
    expect(info.choiceCount).toBe(3);
    expect(info.choiceCenters).toHaveLength(3);
    expect(info.correctIndex).toBeGreaterThanOrEqual(0);
    expect(info.choiceIds[info.correctIndex]).toBeTruthy();
    expect(info.visualCue).toBe(true);
    expect(info.reveal).toBeCloseTo(0.8);
    expect(info.tries).toBe(0);
    await expect(page.locator('.shell-prompt-bubble')).toBeVisible();
    await page.locator('[data-testid="hud-back"]').click();
    await page.waitForFunction(
      () => (window as unknown as { __testHooks__: Hooks }).__testHooks__.getActiveScenes().includes('MapScene'),
    );
  });

  test('[AC-03] [AC-08] [AC-23] a wrong bush never reduces the leisure balance; the correct bush adds one star and completes the trial', async ({ page }) => {
    await enterProfile(page);
    await page.evaluate((sec) => (window as unknown as { __testHooks__: Hooks }).__testHooks__.seedBalanceSec(sec), 120);
    await openFromMap(page);
    const info = await waitForReady(page);
    const before = await balanceSec(page);

    const wrongIndex = info.choiceCenters.findIndex((_, i) => i !== info.correctIndex);
    const wrong = await gamePoint(page, info.choiceCenters[wrongIndex].x, info.choiceCenters[wrongIndex].y);
    // A double tap inside the 400 ms lock counts as one try.
    await page.mouse.click(wrong.cx, wrong.cy);
    await page.mouse.click(wrong.cx, wrong.cy);
    await expect.poll(async () => (await getInfo(page)).tries).toBe(1);
    expect(await balanceSec(page)).toBeGreaterThanOrEqual(before);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);
    expect(await recordedTrials(page)).toBe(1); // the miss, recorded once

    await page.waitForTimeout(500); // past the wrong-tap lock
    const correct = info.choiceCenters[info.correctIndex];
    await clickGame(page, correct.x, correct.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    expect(await balanceSec(page)).toBeGreaterThanOrEqual(before);
    expect(await recordedTrials(page)).toBe(1); // exactly once per trial: the correct tap adds nothing
  });

  test('[AC-02] a clean correct tap completes the trial and starts the next round', async ({ page }) => {
    await enterProfile(page);
    await openFromMap(page);
    const info = await waitForReady(page);
    const c = info.choiceCenters[info.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    expect(await recordedTrials(page)).toBe(1);
    await page.waitForFunction(
      () => {
        const i = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo();
        return i !== null && i.ready && i.correctCount === 1;
      },
      undefined,
      { timeout: 15000 },
    );
  });

  test('[AC-20] tapping the speaker or the request bubble replays it: no try, no hint, no recorded trial', async ({ page }) => {
    await enterProfile(page);
    await openFromMap(page);
    const info = await waitForReady(page);
    await clickGame(page, info.replayCenter.x, info.replayCenter.y);
    await page.locator('.shell-prompt-bubble').click();
    await page.waitForTimeout(600);
    const after = await getInfo(page);
    expect(after.tries).toBe(0);
    expect(after.hinted).toBe(false);
    expect(after.correctCount).toBe(0);
    expect(await recordedTrials(page)).toBe(0);
  });

  test('[AC-06] [AC-18] [AC-22] seeded L7 and L8 entered from the map are audio-only: no bubble, sound / short sound, and a correct tap still works', async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'nature-lab', undefined, { beforeEnter: () => seedHidingLevel(page, 7) });
    let info = await waitForReady(page);
    expect(info.level).toBe(7);
    expect(info.speak).toBe('sound');
    expect(info.shortSound).not.toBe(true);
    expect(info.visualCue).toBe(false);
    expect(info.choiceCount).toBe(5);
    await expect(page.locator('.shell-prompt-bubble')).toHaveCount(0);

    // The request can still be replayed by voice (speaker), and replaying is not a try.
    await clickGame(page, info.replayCenter.x, info.replayCenter.y);
    await page.waitForTimeout(600);
    const after = await getInfo(page);
    expect(after.tries).toBe(0);
    expect(after.correctCount).toBe(0);
    await expect(page.locator('.shell-prompt-bubble')).toHaveCount(0);

    const c = info.choiceCenters[info.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });

    await enterWorldByTap(page, 'profile-a', 'nature-lab', undefined, { beforeEnter: () => seedHidingLevel(page, 8) });
    info = await waitForReady(page);
    expect(info.level).toBe(8);
    expect(info.speak).toBe('sound');
    expect(info.shortSound).toBe(true);
    expect(info.visualCue).toBe(false);
    expect(info.choiceCount).toBe(6);
    await expect(page.locator('.shell-prompt-bubble')).toHaveCount(0);
    const c8 = info.choiceCenters[info.correctIndex];
    await clickGame(page, c8.x, c8.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
  });

  test('[AC-07] [AC-27] age-5 profile starts at L5 and a correct tap completes the trial', async ({ page }) => {
    await enterWorldByTap(page, 'profile-b', 'nature-lab');
    const info = await waitForReady(page);
    expect(info.level).toBe(5);
    expect(info.choiceCount).toBe(4);
    expect(info.reveal).toBeCloseTo(0.3);
    expect(info.speak).toBe('name');
    const c = info.choiceCenters[info.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
  });
});

import { test, expect, type Page } from '@playwright/test';
import { seedTimeEarningEnabled } from './helpers/journey';

async function waitForGameReady(page: Page): Promise<void> {
  await page.waitForFunction(() => (window as unknown as { __GAME_READY__?: boolean }).__GAME_READY__ === true, {
    timeout: 15000,
  });
}

type Screen = 'map' | 'restaurant' | 'bubbles';

async function goToScreen(page: Page, screen: Screen): Promise<void> {
  await page.evaluate((s: Screen) => {
    (window as unknown as { __testHooks__: { goToScreen: (s: Screen) => void } }).__testHooks__.goToScreen(s);
  }, screen);
  await waitForGameReady(page);
}

type RoundInfo = {
  correctIndex: number;
  correctIndices: number[];
  choiceCount: number;
  choiceCenters: Array<{ x: number; y: number }>;
  animalCenter: { x: number; y: number };
  animalHit: { left: number; top: number; right: number; bottom: number };
  promptText: string;
  tries: number;
  level: number;
  request: string;
  visualCue: boolean;
  correctCount: number;
  characterState: string;
  ready: boolean;
};

type Hooks = { getRoundInfo: () => RoundInfo | null };

/** Waits until the animal has hopped in and the plates have popped in. */
async function waitForRoundReady(page: Page): Promise<RoundInfo> {
  await page.waitForFunction(() => {
    const info = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo();
    return info !== null && info.ready;
  });
  return getRoundInfo(page);
}

async function balanceSec(page: Page): Promise<number> {
  const text = await page.locator('[data-testid="leisure-balance"]').innerText();
  const m = text.match(/(\d+):(\d+)/);
  return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
}

async function getRoundInfo(page: Page): Promise<RoundInfo> {
  await page.waitForFunction(
    () => (window as unknown as { __testHooks__: { getRoundInfo: () => unknown } }).__testHooks__.getRoundInfo() !== null,
  );
  return page.evaluate(
    () => (window as unknown as { __testHooks__: { getRoundInfo: () => RoundInfo } }).__testHooks__.getRoundInfo(),
  );
}

/** Convert a game-coordinate point to a client-pixel position on the canvas. */
async function gameClientPoint(page: Page, x: number, y: number): Promise<{ cx: number; cy: number }> {
  const size = await page.evaluate(() =>
    (window as unknown as { __testHooks__: { getGameSize: () => { width: number; height: number } } }).__testHooks__.getGameSize(),
  );
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return { cx: box.x + (x / size.width) * box.width, cy: box.y + (y / size.height) * box.height };
}

/** Click a point given in game coordinates. */
async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const { cx, cy } = await gameClientPoint(page, x, y);
  await page.mouse.click(cx, cy);
}

test.describe('kids-app journey', () => {
  test('restaurant requests voice clips, keeps the prompt bubble across HUD ticks and updates stars on arrival', async ({ page }) => {
    await page.goto('/?e2e=1');
    await seedTimeEarningEnabled(page, true);
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);
    await goToScreen(page, 'restaurant');

    const info = await getRoundInfo(page);
    expect(info.choiceCenters).toHaveLength(info.choiceCount);
    expect(info.correctIndex).toBeGreaterThanOrEqual(0);
    // A fresh age-2 profile starts at L4 of the 9-level curve: 3 plates and a quantity request.
    expect(info.level).toBe(4);
    expect(info.choiceCount).toBe(3);
    expect(info.request).toBe('quantity');
    expect(info.visualCue).toBe(true);

    // Tapping the animal repeats the food request, which asks for a static en/fr clip.
    // (The first clip is the Hebrew intro; the tap supersedes it so this is not timing dependent.)
    const clip = page.waitForRequest(/\/audio\/(en|fr)\/.*\.mp3/, { timeout: 10000 });
    await waitForRoundReady(page); // the animal has finished entering
    await clickGame(page, info.animalCenter.x, info.animalCenter.y);
    await clip;

    // The HUD ticks every second without destroying the prompt bubble.
    const bubble = page.locator('.shell-prompt-bubble');
    await expect(bubble).toBeVisible();
    await bubble.evaluate((n) => ((n as HTMLElement).dataset.marker = 'kept'));
    // Wait for at least two HUD ticks (the clock text changes every second).
    const balance = page.locator('[data-testid="leisure-balance"]');
    const t0 = await balance.innerText();
    await expect.poll(async () => balance.innerText(), { timeout: 5000 }).not.toBe(t0);
    await expect(page.locator('.shell-prompt-bubble[data-marker="kept"]')).toBeVisible();

    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);
    const c = info.choiceCenters[info.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
  });

  test('profile select -> map -> restaurant -> bubbles -> parent gate', async ({ page }) => {
    await page.goto('/?e2e=1');
    await seedTimeEarningEnabled(page, true);

    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);

    await goToScreen(page, 'restaurant');
    await waitForRoundReady(page); // the animal hopped in and the plates popped in

    await page.evaluate((sec) => {
      (window as unknown as { __testHooks__: { seedBalanceSec: (s: number) => void } }).__testHooks__.seedBalanceSec(sec);
    }, 120);
    await goToScreen(page, 'bubbles');
    await page.waitForFunction(() => (window as unknown as { __testHooks__: { getActiveScenes: () => string[] } }).__testHooks__.getActiveScenes().includes('BubblesScene'));

    await goToScreen(page, 'map');
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.locator('[data-testid="parent-exit-btn"]')).toBeVisible();
  });

  test('wrong choices in the restaurant never reduce the leisure balance', async ({ page }) => {
    await page.goto('/?e2e=1');
    await seedTimeEarningEnabled(page, true);
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);

    await page.evaluate((sec) => {
      (window as unknown as { __testHooks__: { seedBalanceSec: (s: number) => void } }).__testHooks__.seedBalanceSec(sec);
    }, 42);
    await goToScreen(page, 'restaurant');
    const info = await waitForRoundReady(page);

    const before = await page.locator('[data-testid="leisure-balance"]').innerText();
    expect(before).toMatch(/0:4[2-9]|0:5\d/); // 0:42 or a second or two of earning

    // Tap a plate that is not the requested one (from the exposed round info) — a miss must never reduce the balance.
    const wrong = info.choiceCenters[info.choiceCenters.findIndex((_, i) => i !== info.correctIndex)];
    for (let i = 0; i < 3; i++) {
      await clickGame(page, wrong.x, wrong.y);
      await page.waitForTimeout(450); // longer than the wrong-tap input lock (visual pacing only)
    }
    // Taps are 450 ms apart and the wrong-tap lock is 400 ms, so each of the three taps counts.
    expect((await getRoundInfo(page)).tries).toBe(3);

    const after = await page.locator('[data-testid="leisure-balance"]').innerText();
    const parse = (s: string) => {
      const m = s.match(/(\d+):(\d+)/);
      return m ? Number(m[1]) * 60 + Number(m[2]) : 0;
    };
    expect(parse(after)).toBeGreaterThanOrEqual(parse(before));
  });

  test('wrong tap then correct tap: a double tap is one try, nothing is deducted, one star is added', async ({ page }) => {
    await page.goto('/?e2e=1');
    await seedTimeEarningEnabled(page, true);
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);
    await page.evaluate((sec) => {
      (window as unknown as { __testHooks__: { seedBalanceSec: (s: number) => void } }).__testHooks__.seedBalanceSec(sec);
    }, 120);
    await goToScreen(page, 'restaurant');
    const info = await waitForRoundReady(page);
    const before = await balanceSec(page);

    const wrongIndex = info.choiceCenters.findIndex((_, i) => i !== info.correctIndex);
    const wrong = info.choiceCenters[wrongIndex];
    // Resolve the canvas point once so both clicks stay inside the 400ms input lock,
    // even on a slow CI runner where two full clickGame() lookups can drift apart.
    const wrongPoint = await gameClientPoint(page, wrong.x, wrong.y);
    await page.mouse.click(wrongPoint.cx, wrongPoint.cy);
    await page.mouse.click(wrongPoint.cx, wrongPoint.cy);
    await expect.poll(async () => (await getRoundInfo(page)).tries).toBe(1);
    expect(await balanceSec(page)).toBeGreaterThanOrEqual(before);

    // After the lock the correct plate still works, and exactly one star arrives.
    await page.waitForFunction(() => {
      const i = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo();
      return i !== null && i.characterState !== 'hmm';
    });
    const c = info.choiceCenters[info.correctIndex];
    await clickGame(page, c.x, c.y);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    expect(await balanceSec(page)).toBeGreaterThanOrEqual(before);
  });

  test('tapping the animal repeats the request without selecting a plate', async ({ page }) => {
    await page.goto('/?e2e=1');
    await seedTimeEarningEnabled(page, true);
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);
    await goToScreen(page, 'restaurant');
    const info = await waitForRoundReady(page);
    // The lowest tappable animal pixel, right above every plate hit area, in the middle where
    // a 3-plate layout has its middle plate.
    await clickGame(page, info.animalCenter.x, info.animalHit.bottom - 3);
    await clickGame(page, info.animalCenter.x, info.animalCenter.y);
    await page.waitForTimeout(600); // let any (unwanted) plate reaction show up
    const after = await getRoundInfo(page);
    expect(after.tries).toBe(0);
    expect(after.correctCount).toBe(0);
  });

  /** Starts a restaurant visit at a seeded adaptive level (the hook writes it before the scene starts). */
  async function startRestaurantAtLevel(page: Page, level: number): Promise<RoundInfo> {
    await page.goto('/?e2e=1');
    await seedTimeEarningEnabled(page, true);
    await page.locator('[data-testid="profile-a"]').click();
    await waitForGameReady(page);
    await page.evaluate((l) => {
      (window as unknown as { __testHooks__: { seedRestaurantLevel: (l: number) => void } }).__testHooks__.seedRestaurantLevel(l);
    }, level);
    await goToScreen(page, 'restaurant');
    return waitForRoundReady(page);
  }

  /** Total number of recorded trials across all stored adaptive skills of every profile. */
  async function recordedTrials(page: Page): Promise<number> {
    return page.evaluate(() => {
      let total = 0;
      for (let i = 0; i < localStorage.length; i++) {
        const key = localStorage.key(i);
        if (!key || !key.startsWith('kids-app-adaptive:')) continue;
        const profile = JSON.parse(localStorage.getItem(key) ?? '{}') as {
          skills?: Record<string, { items: Record<string, { seen: number }> }>;
        };
        for (const skill of Object.values(profile.skills ?? {})) {
          for (const item of Object.values(skill.items)) total += item.seen;
        }
      }
      return total;
    });
  }

  test('L7 two-item request: serving a plate twice has no effect, the second plate completes one trial', async ({ page }) => {
    const info = await startRestaurantAtLevel(page, 7);
    expect(info.level).toBe(7);
    expect(info.request).toBe('two-step');
    expect(info.correctIndices).toHaveLength(2);
    const [a, b] = info.correctIndices;
    const pointA = await gameClientPoint(page, info.choiceCenters[a].x, info.choiceCenters[a].y);

    await page.mouse.click(pointA.cx, pointA.cy);
    await page.waitForFunction(() => {
      const i = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo();
      return i !== null && i.correctIndices.length === 1;
    });
    // The served plate is gone: tapping its spot again is not an answer.
    await page.mouse.click(pointA.cx, pointA.cy);
    await page.waitForTimeout(600);
    const mid = await getRoundInfo(page);
    expect(mid.tries).toBe(0);
    expect(mid.correctIndices).toEqual([b]);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 0/);
    expect(await recordedTrials(page)).toBe(0);

    const pointB = await gameClientPoint(page, mid.choiceCenters[b].x, mid.choiceCenters[b].y);
    await page.mouse.click(pointB.cx, pointB.cy);
    await expect(page.locator('[data-testid="star-count"]')).toHaveText(/⭐ 1/, { timeout: 8000 });
    expect(await recordedTrials(page)).toBe(1);
  });

  test('L9 is negation + voice-only: no prompt bubble, and tapping the animal replays without selecting a plate', async ({ page }) => {
    const info = await startRestaurantAtLevel(page, 9);
    expect(info.level).toBe(9);
    expect(info.request).toBe('negation');
    expect(info.visualCue).toBe(false);
    expect(info.choiceCount).toBe(4);
    expect(info.correctIndices).toHaveLength(1);
    await expect(page.locator('.shell-prompt-bubble')).toHaveCount(0);

    await clickGame(page, info.animalCenter.x, info.animalHit.bottom - 3);
    await clickGame(page, info.animalCenter.x, info.animalCenter.y);
    await page.waitForTimeout(600);
    const after = await getRoundInfo(page);
    expect(after.tries).toBe(0);
    expect(after.correctCount).toBe(0);
    await expect(page.locator('.shell-prompt-bubble')).toHaveCount(0);
  });

  test('parent multiplication gate is shown when e2e bypass is off', async ({ page }) => {
    await page.goto('/');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await page.locator('[data-testid="parent-gate-btn"]').click();
    await expect(page.getByText('אזור הורים')).toBeVisible();
    await expect(page.getByText(/כמה זה/)).toBeVisible();
    await page.getByRole('button', { name: 'ביטול' }).click();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
  });

  test('shell stays available after going offline', async ({ page, context }) => {
    await page.goto('/?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    // Give the production service worker a chance to take control, then reload so
    // the page is served from cache before we cut the network.
    await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return;
      try {
        await navigator.serviceWorker.ready;
      } catch {
        // ignore — preview environments without a SW still have HTTP cache
      }
    });
    await page.reload();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible({ timeout: 15_000 });
    await context.setOffline(false);
  });
});

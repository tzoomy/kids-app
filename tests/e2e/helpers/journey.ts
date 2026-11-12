// Shared Playwright helpers for real-tap journeys (docs/PROCESS.md section 4).
// Not a test file: Playwright only runs *.spec.ts / *.test.ts, so this folder is never collected.
// Hooks are used only to READ state (hit rectangles, round info, speech log) or to seed it.
import type { Page } from '@playwright/test';

export type ProfileTestId = 'profile-a' | 'profile-b';

/** Scene that each world's building starts (see src/worlds/MapScene.ts). */
export const WORLD_SCENE: Record<string, string> = {
  'language-house': 'RestaurantScene',
  'art-studio': 'OrchestraScene',
  'leisure-corner': 'BubblesScene',
};

export interface PageRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface SpokenLine {
  index: number;
  lineId: string;
  lang: string;
  source: 'clip' | 'tts';
  text?: string;
  at: number;
}

export interface RoundInfo {
  correctIndex: number;
  correctIndices: number[];
  choiceCount: number;
  choiceCenters: Array<{ x: number; y: number }>;
  animalCenter: { x: number; y: number };
  animalHit: { left: number; top: number; right: number; bottom: number };
  language: string;
  promptText: string;
  tries: number;
  level: number;
  request: string;
  visualCue: boolean;
  correctCount: number;
  characterState: string;
  ready: boolean;
}

type Hooks = {
  getActiveScenes: () => string[];
  getBuildingHit: (worldId: string) => PageRect | null;
  getSpokenLines: (since?: number) => SpokenLine[];
  getRoundInfo: () => RoundInfo | null;
  getGameSize: () => { width: number; height: number };
};

type HookName = keyof Hooks;

/** Calls a read-only hook in the page. */
async function callHook<T>(page: Page, name: HookName, args: unknown[] = []): Promise<T> {
  return page.evaluate(
    ([hookName, hookArgs]) => {
      const hooks = (window as unknown as { __testHooks__: Record<string, (...a: unknown[]) => unknown> }).__testHooks__;
      return hooks[hookName as string](...(hookArgs as unknown[]));
    },
    [name, args] as const,
  ) as Promise<T>;
}

export function getActiveScenes(page: Page): Promise<string[]> {
  return callHook<string[]>(page, 'getActiveScenes');
}

export async function waitForScene(page: Page, sceneKey: string, timeout = 15_000): Promise<void> {
  await page.waitForFunction(
    (key) => (window as unknown as { __testHooks__?: Hooks }).__testHooks__?.getActiveScenes().includes(key) === true,
    sceneKey,
    { timeout },
  );
}

export function getBuildingHit(page: Page, worldId: string): Promise<PageRect | null> {
  return callHook<PageRect | null>(page, 'getBuildingHit', [worldId]);
}

export function getSpokenLines(page: Page, since?: number): Promise<SpokenLine[]> {
  return callHook<SpokenLine[]>(page, 'getSpokenLines', [since]);
}

/** Resolves with the first recorded spoken line matching the predicate (polling the speech log). */
export async function waitForSpokenLine(
  page: Page,
  predicate: (line: SpokenLine) => boolean,
  timeout = 10_000,
  since?: number,
): Promise<SpokenLine> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const found = (await getSpokenLines(page, since)).find(predicate);
    if (found) return found;
    if (Date.now() > deadline) {
      const seen = (await getSpokenLines(page, since)).map((l) => `${l.lineId}(${l.lang},${l.source})`).join(', ');
      throw new Error(`waitForSpokenLine timed out after ${timeout} ms; recorded lines: [${seen}]`);
    }
    await page.waitForTimeout(50);
  }
}

/**
 * Opens the app with ?e2e=1, taps the profile with a real click, waits for the map, then taps the
 * world's building (real pointer click at the centre of its hit rectangle) and returns when the
 * world's game scene is active.
 */
export async function enterWorldByTap(page: Page, profile: ProfileTestId, worldId: string): Promise<void> {
  const targetScene = WORLD_SCENE[worldId];
  if (!targetScene) throw new Error(`enterWorldByTap: no game scene known for world "${worldId}"`);

  await page.goto('/?e2e=1');
  await page.locator(`[data-testid="${profile}"]`).click();
  await waitForScene(page, 'MapScene');

  // Wait for the building's pop-in to finish (its size stops changing), then tap its centre.
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  await expectPoll(async () => {
    const current = await getBuildingHit(page, worldId);
    const settled = current !== null && previous !== null && Math.abs(current.width - previous.width) < 0.5;
    previous = current;
    rect = current;
    return settled;
  }, `building "${worldId}" hit rectangle never became available and stable`);

  const hit = rect as PageRect | null;
  if (!hit) throw new Error(`building "${worldId}" has no hit rectangle`);
  // Re-read right before the click: the idle float moves the building a few pixels.
  const fresh = (await getBuildingHit(page, worldId)) ?? hit;
  await page.mouse.click(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  await waitForScene(page, targetScene);
}

async function expectPoll(check: () => Promise<boolean>, message: string, timeout = 15_000): Promise<void> {
  const deadline = Date.now() + timeout;
  while (!(await check())) {
    if (Date.now() > deadline) throw new Error(message);
    await new Promise((r) => setTimeout(r, 100));
  }
}

export function getRoundInfo(page: Page): Promise<RoundInfo | null> {
  return callHook<RoundInfo | null>(page, 'getRoundInfo');
}

/** Waits until the animal has hopped in and the plates have popped in. */
export async function waitForRoundReady(page: Page): Promise<RoundInfo> {
  await page.waitForFunction(() => {
    const info = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getRoundInfo();
    return info !== null && info.ready;
  });
  const info = await getRoundInfo(page);
  if (!info) throw new Error('no active restaurant round');
  return info;
}

/** Converts a game-coordinate point to a page (client) pixel position using the canvas bounding box. */
export async function gameClientPoint(page: Page, x: number, y: number): Promise<{ cx: number; cy: number }> {
  const size = await callHook<{ width: number; height: number }>(page, 'getGameSize');
  const box = await page.locator('canvas').boundingBox();
  if (!box) throw new Error('no canvas');
  return { cx: box.x + (x / size.width) * box.width, cy: box.y + (y / size.height) * box.height };
}

/** Real pointer click at a point given in game coordinates. */
export async function clickGame(page: Page, x: number, y: number): Promise<void> {
  const { cx, cy } = await gameClientPoint(page, x, y);
  await page.mouse.click(cx, cy);
}

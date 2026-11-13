// Shared Playwright helpers for real-tap journeys (docs/PROCESS.md section 4).
// Not a test file: Playwright only runs *.spec.ts / *.test.ts, so this folder is never collected.
// Hooks are used only to READ state (hit rectangles, round info, speech log) or to seed it.
import type { Page } from '@playwright/test';

export type ProfileTestId = 'profile-a' | 'profile-b';

/** Game scenes by game id (see src/games and src/worlds/MapScene.ts). */
export const GAME_SCENE: Record<string, string> = {
  'animal-restaurant': 'RestaurantScene',
  'kitchen-orchestra': 'OrchestraScene',
  bubbles: 'BubblesScene',
  // Who's Hiding? (PR #29, feat/game-hiding). HidingScene is not on main yet, so no test enters nature-lab until that PR lands.
  hiding: 'HidingScene',
};

/** Entry game of each single-game world. Art Studio is locked until its own game exists. */
export const WORLD_ENTRY_GAME: Record<string, string> = {
  'leisure-corner': 'bubbles',
  'nature-lab': 'hiding',
};

/** Worlds whose building opens the game picker; the value is the default game to pick. */
export const PICKER_WORLD_DEFAULT_GAME: Record<string, string> = {
  'language-house': 'animal-restaurant',
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

export interface OrchestraInfo {
  sequence: string[];
  expectedIndex: number;
  instrumentCenters: Array<{ x: number; y: number; id: string }>;
  level: number;
  support: string;
  language: string;
  ready: boolean;
  phase: 'listen' | 'echo' | 'celebrate';
}

type Hooks = {
  getOrchestraInfo: () => OrchestraInfo | null;
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
 * world's building (real pointer click at the centre of its hit rectangle). Returns right after the tap.
 */
export async function tapWorldBuilding(page: Page, profile: ProfileTestId, worldId: string): Promise<void> {
  await page.goto('/?e2e=1');
  await page.locator(`[data-testid="${profile}"]`).click();
  await waitForScene(page, 'MapScene');

  // Wait for the building's pop-in to finish (its size stops changing), then tap its centre.
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  await expectPoll(async () => {
    const current = await getBuildingHit(page, worldId);
    // Width 0 means the pop-in has not started yet (scale 0): never treat that as settled.
    const settled =
      current !== null && previous !== null && current.width > 0 && Math.abs(current.width - previous.width) < 0.5;
    previous = current;
    rect = current;
    return settled;
  }, `building "${worldId}" hit rectangle never became available and stable`);

  const hit = rect as PageRect | null;
  if (!hit) throw new Error(`building "${worldId}" has no hit rectangle`);
  // Re-read right before the click: the idle float moves the building a few pixels.
  const fresh = (await getBuildingHit(page, worldId)) ?? hit;
  await page.mouse.click(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
}

/** Bounding box (page CSS px) of a DOM element by testid, once it is visible and has stopped moving. */
export async function getStableBox(page: Page, testId: string, timeout = 10_000): Promise<PageRect> {
  const locator = page.locator(`[data-testid="${testId}"]`);
  await locator.waitFor({ state: 'visible', timeout });
  let previous: PageRect | null = null;
  let box: PageRect | null = null;
  await expectPoll(
    async () => {
      box = await locator.boundingBox();
      const settled =
        box !== null &&
        previous !== null &&
        Math.abs(box.x - previous.x) < 0.5 &&
        Math.abs(box.y - previous.y) < 0.5 &&
        Math.abs(box.width - previous.width) < 0.5;
      previous = box;
      return settled;
    },
    `element "${testId}" never became stable`,
    timeout,
  );
  return box as unknown as PageRect;
}

/** Real pointer click at the centre of a DOM element found by testid. */
export async function tapTestId(page: Page, testId: string): Promise<void> {
  const box = await getStableBox(page, testId);
  await page.mouse.click(box.x + box.width / 2, box.y + box.height / 2);
}

/**
 * Taps the world's building and returns when the world's game scene is active.
 * Language House opens a game picker first: then `game-picker-<gameId>` is tapped (default: animal-restaurant).
 * Single-game worlds take their entry game; passing another game id for them is an error.
 */
export async function enterWorldByTap(page: Page, profile: ProfileTestId, worldId: string, gameId?: string): Promise<void> {
  const pickerDefault = PICKER_WORLD_DEFAULT_GAME[worldId];
  const game = gameId ?? pickerDefault ?? WORLD_ENTRY_GAME[worldId];
  const targetScene = game ? GAME_SCENE[game] : undefined;
  if (!game || !targetScene) throw new Error(`enterWorldByTap: no game scene known for world "${worldId}"`);
  if (!pickerDefault && WORLD_ENTRY_GAME[worldId] !== game) {
    throw new Error(`enterWorldByTap: world "${worldId}" has no game "${game}"`);
  }

  await tapWorldBuilding(page, profile, worldId);
  if (pickerDefault) await tapTestId(page, `game-picker-${game}`);
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

export function getOrchestraInfo(page: Page): Promise<OrchestraInfo | null> {
  return callHook<OrchestraInfo | null>(page, 'getOrchestraInfo');
}

/** Waits until the chef has finished the pattern and the child may echo it from the first note. */
export async function waitForOrchestraEcho(page: Page): Promise<OrchestraInfo> {
  await page.waitForFunction(
    () => {
      const info = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getOrchestraInfo();
      return info !== null && info.ready && info.phase === 'echo' && info.expectedIndex === 0;
    },
    undefined,
    { timeout: 30_000 },
  );
  const info = await getOrchestraInfo(page);
  if (!info) throw new Error('no active orchestra trial');
  return info;
}

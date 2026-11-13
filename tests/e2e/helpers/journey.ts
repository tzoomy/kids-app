// Shared Playwright helpers for real-tap journeys (docs/PROCESS.md section 4).
// Not a test file: Playwright only runs *.spec.ts / *.test.ts, so this folder is never collected.
// Hooks are used only to READ state (hit rectangles, round info, speech log) or to seed it.
import type { Page } from '@playwright/test';
import type { SortingInfo } from '../../../src/games/sorting/types';

export type { SortingInfo };

export type ProfileTestId = 'profile-a' | 'profile-b';

/** Scene that each world's building starts (see src/worlds/MapScene.ts). */
export const WORLD_SCENE: Record<string, string> = {
  'language-house': 'RestaurantScene',
  'art-studio': 'OrchestraScene',
  'leisure-corner': 'BubblesScene',
  // Who's Hiding? (PR #29, feat/game-hiding). HidingScene is not on main yet, so no test enters nature-lab until that PR lands.
  'nature-lab': 'HidingScene',
  // Sorting Beds is the only Number Garden game in Pass 1, so the building opens it directly (no picker).
  'number-garden': 'SortingScene',
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
  getSortingInfo: () => SortingInfo | null;
  getSpokenLineCount: () => number;
  seedSortingLevel: (level: number) => void;
  seedBalanceSec: (sec: number) => void;
  seedLanguageSetting: (lang: 'en' | 'fr' | 'both') => void;
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
export async function enterWorldByTap(
  page: Page,
  profile: ProfileTestId,
  worldId: string,
  options: {
    /** Runs on the map (profile selected, building not tapped yet): the place to SEED persisted state with a hook. */
    beforeEnter?: (page: Page) => Promise<void>;
  } = {},
): Promise<void> {
  const targetScene = WORLD_SCENE[worldId];
  if (!targetScene) throw new Error(`enterWorldByTap: no game scene known for world "${worldId}"`);

  // Relative to baseURL (.../kids-app/): stays inside the service worker scope, so it also works offline.
  await page.goto('./?e2e=1');
  await page.locator(`[data-testid="${profile}"]`).click();
  await waitForScene(page, 'MapScene');
  if (options.beforeEnter) await options.beforeEnter(page);

  // Wait for the building's pop-in to finish (its size stops changing), then tap its centre.
  let previous: PageRect | null = null;
  let rect: PageRect | null = null;
  await expectPoll(async () => {
    const current = await getBuildingHit(page, worldId);
    // Width 0 means the pop-in has not started yet (scale 0): never treat that as settled.
    const settled = current !== null && current.width > 0 && previous !== null && Math.abs(current.width - previous.width) < 0.5;
    previous = current;
    rect = current;
    return settled;
  }, `building "${worldId}" hit rectangle never became available and stable`);

  const hit = rect as PageRect | null;
  if (!hit) throw new Error(`building "${worldId}" has no hit rectangle`);
  // Re-read right before the click: the idle float moves the building a few pixels.
  const fresh = (await getBuildingHit(page, worldId)) ?? hit;
  await page.mouse.click(fresh.x + fresh.width / 2, fresh.y + fresh.height / 2);
  // TODO(game picker): Language House will open a game picker before entering a game (approved by the owner).
  // When the picker lands, tap the matching `game-picker-<gameId>` here after the building tap
  // (testids `game-picker-animal-restaurant`, `game-picker-kitchen-orchestra`, close: `game-picker-close`),
  // and take the game id as a parameter instead of deriving the scene from the world alone.
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

// ---------------------------------------------------------------------------------------------
// Sorting Beds (docs/specs/sorting-beds.md, docs/contracts/sorting-beds.md)
// Hit rectangles from getSortingInfo are already in page CSS px: tap them with page.mouse.click (not clickGame).
// ---------------------------------------------------------------------------------------------

export type ReadySortingInfo = SortingInfo & { currentItem: NonNullable<SortingInfo['currentItem']> };

export function getSpokenLineCount(page: Page): Promise<number> {
  return callHook<number>(page, 'getSpokenLineCount');
}

/** Seeds the active profile's persisted Sorting Beds level. Call from `enterWorldByTap(..., { beforeEnter })`. */
export async function seedSortingLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedSortingLevel', [level]);
}

/** Seeds the active profile's leisure balance in seconds. Call from `enterWorldByTap(..., { beforeEnter })`. */
export async function seedBalanceSec(page: Page, sec: number): Promise<void> {
  await callHook<void>(page, 'seedBalanceSec', [sec]);
}

/** Seeds the app's language setting (stored settings.languages) so a test knows which language a round uses. Call from `beforeEnter`. */
export async function seedLanguageSetting(page: Page, lang: 'en' | 'fr' | 'both'): Promise<void> {
  await callHook<void>(page, 'seedLanguageSetting', [lang]);
}

export function getSortingInfo(page: Page): Promise<SortingInfo | null> {
  return callHook<SortingInfo | null>(page, 'getSortingInfo');
}

/** Waits until the current flower is in the basket and bed taps are accepted (kept tight: about 12 s). */
export async function waitForSortingReady(page: Page, timeout = 12_000): Promise<ReadySortingInfo> {
  await page.waitForFunction(
    () => {
      const info = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getSortingInfo();
      return info !== null && info.ready && info.currentItem !== null;
    },
    undefined,
    { timeout },
  );
  const info = await getSortingInfo(page);
  if (!info || !info.currentItem) throw new Error('no active Sorting Beds round');
  return info as ReadySortingInfo;
}

/** Flowers placed so far in the round, summed over the beds (examples excluded). */
export function placedCount(info: SortingInfo): number {
  return info.beds.reduce((sum, bed) => sum + bed.count, 0);
}

/** Real pointer click at the centre of a page-px rectangle. */
export async function tapRect(page: Page, hit: PageRect): Promise<void> {
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
}

/** Real tap on a bed, using a fresh read of its hit rectangle. */
export async function tapBed(page: Page, bedId: string): Promise<void> {
  const info = await getSortingInfo(page);
  const bed = info?.beds.find((b) => b.id === bedId);
  if (!bed) throw new Error(`no bed "${bedId}" in the active round`);
  await tapRect(page, bed.hit);
}

/** Id of a bed that does NOT accept the current flower. */
export function wrongBedId(info: ReadySortingInfo): string {
  const bed = info.beds.find((b) => b.id !== info.currentItem.targetBedId);
  if (!bed) throw new Error('the round has no second bed');
  return bed.id;
}

/** Polls until the state differs from `before` (a flower was consumed, the round moved on, or the level changed). */
async function waitForStateChange(page: Page, before: ReadySortingInfo, timeout: number): Promise<void> {
  const beforeCount = placedCount(before);
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getSortingInfo(page);
    const changed =
      info === null ||
      info.currentItem === null ||
      !info.ready ||
      placedCount(info) !== beforeCount ||
      info.currentItem.id !== before.currentItem.id ||
      info.level !== before.level;
    if (changed) return;
    if (Date.now() > deadline) throw new Error('the tap on the matching bed did not change the Sorting Beds state');
    await page.waitForTimeout(50);
  }
}

/** Waits for the current flower, taps its matching bed for real, waits until it is consumed. Returns the info read before the tap. */
export async function placeCurrentCorrectly(page: Page, timeout = 12_000): Promise<ReadySortingInfo> {
  const before = await waitForSortingReady(page, timeout);
  const target = before.beds.find((b) => b.id === before.currentItem.targetBedId);
  if (!target) throw new Error(`target bed "${before.currentItem.targetBedId}" is not among the beds`);
  await tapRect(page, target.hit);
  await waitForStateChange(page, before, timeout);
  return before;
}

/** Reads the HUD star counter (a star emoji followed by the number). */
export async function readStarCount(page: Page): Promise<number> {
  const text = (await page.locator('[data-testid="star-count"]').textContent()) ?? '';
  const match = text.match(/(\d+)/);
  if (!match) throw new Error(`unreadable star count: "${text}"`);
  return Number(match[1]);
}

/** Reads the HUD leisure balance ("m:ss") in seconds. */
export async function readBalanceSec(page: Page): Promise<number> {
  const text = (await page.locator('[data-testid="leisure-balance"]').first().textContent()) ?? '';
  const match = text.match(/(\d+):(\d{2})/);
  if (!match) throw new Error(`unreadable leisure balance: "${text}"`);
  return Number(match[1]) * 60 + Number(match[2]);
}

export interface StoredSkill {
  level: number;
  recent: string[];
  items: Record<string, unknown>;
}

/** The persisted adaptive skill of a profile (read-only localStorage read), e.g. to prove "one placement is one recorded trial". */
export async function readStoredSkill(page: Page, profile: ProfileTestId, lang: string): Promise<StoredSkill | null> {
  const profileId = profile === 'profile-a' ? 'a' : 'b';
  return page.evaluate(
    ([id, skill]) => {
      const raw = window.localStorage.getItem(`kids-app-adaptive:${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { skills?: Record<string, StoredSkill> };
      return parsed.skills?.[skill] ?? null;
    },
    [profileId, `number-garden.sorting-beds.${lang}`] as const,
  );
}

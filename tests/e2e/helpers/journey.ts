// Shared Playwright helpers for real-tap journeys (docs/PROCESS.md section 4).
// Not a test file: Playwright only runs *.spec.ts / *.test.ts, so this folder is never collected.
// Hooks are used only to READ state (hit rectangles, round info, speech log) or to seed it.
import type { Page } from '@playwright/test';
import type { SortingInfo } from '../../../src/games/sorting/types';
import type { SinkFloatInfo } from '../../../src/games/sinkFloat/sinkFloatTypes';
import type { LetterMonsterInfo } from '../../../src/games/letterMonster/letterMonsterTypes';
import type { BalloonInfo } from '../../../src/games/balloon/types';
import type { SeedFlowerInfo } from '../../../src/games/seedFlower/seedFlowerTypes';

export type { SortingInfo, SinkFloatInfo, LetterMonsterInfo, BalloonInfo, SeedFlowerInfo };

export type ProfileTestId = 'profile-a' | 'profile-b';

/** Game scenes by game id (see src/games and src/worlds/MapScene.ts). */
export const GAME_SCENE: Record<string, string> = {
  'animal-restaurant': 'RestaurantScene',
  'kitchen-orchestra': 'OrchestraScene',
  'letter-monster': 'LetterMonsterScene',
  bubbles: 'BubblesScene',
  // Nature Lab opens a picker (docs/specs/seed-to-flower.md): Who's Hiding? or Seed to Flower.
  'who-is-hiding': 'HidingScene',
  'seed-to-flower': 'SeedFlowerScene',
  'leisure-colouring': 'ColouringScene',
  // Number Garden opens a picker (Sorting Beds, Balloon Pop); Sorting Beds is its default card.
  'sorting-beds': 'SortingScene',
  'balloon-pop': 'BalloonScene',
  'sink-or-float': 'SinkFloatScene',
};

/** Entry game of each single-game world. Art Studio is locked until its own game exists. */
export const WORLD_ENTRY_GAME: Record<string, string> = {
  'leisure-corner': 'bubbles',
};

/** Worlds whose building opens the game picker; the value is the default game to pick. */
export const PICKER_WORLD_DEFAULT_GAME: Record<string, string> = {
  'language-house': 'animal-restaurant',
  'number-garden': 'sorting-beds',
  'nature-lab': 'who-is-hiding',
};

/** Extra picker-card games on a world that still defaults to a direct entry game.
 * Leisure Corner keeps opening Bubbles when no gameId is passed, so existing tests stay green.
 * Passing 'leisure-colouring' taps `game-picker-leisure-colouring` after the building. */
export const PICKER_WORLD_EXTRA_GAMES: Record<string, string[]> = {
  'leisure-corner': ['leisure-colouring'],
  'science-world': ['sink-or-float'],
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
  /** Who's Hiding? speaker button centre, in game coordinates. */
  replayCenter?: { x: number; y: number };
  hinted?: boolean;
  targetId?: string;
  choiceIds?: string[];
  correctFrontScale?: number;
  correctPeek?: number;
  shortSound?: boolean;
  speak?: string;
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

export interface ColouringSeed {
  pageId: string;
  fills?: Record<string, string>;
}

export interface ColouringInfo {
  pageId: string;
  pageIndex: number;
  selectedColor: string;
  fills: Record<string, string>;
  undoCount: number;
  ageTrack: 'age2' | 'age5';
  balanceSec: number;
  inGrace: boolean;
  ended: boolean;
  pageRect: PageRect;
  pageSide: number;
  regions: Array<{ id: string; hit: PageRect; tapPoint: { x: number; y: number } }>;
  /** Additive: background craft-prop groups (axis-aligned bbox, page CSS px). Desk planks and grain are excluded. */
  decorations?: Array<{ id: string; rect: PageRect }>;
  /** Additive: chrome/tool/swatch buttons (page CSS px). */
  chromeButtons?: Array<{ id: string; rect: PageRect }>;
}

type Hooks = {
  getOrchestraInfo: () => OrchestraInfo | null;
  getActiveScenes: () => string[];
  getBuildingHit: (worldId: string) => PageRect | null;
  getSpokenLines: (since?: number) => SpokenLine[];
  getSpokenLineCount: () => number;
  getRoundInfo: () => RoundInfo | null;
  getGameSize: () => { width: number; height: number };
  /** Whether the current learning session is reporting listening. Read-only, ?e2e=1 only. */
  isListening: () => boolean;
  seedHidingLevel: (level: number) => void;
  seedBalanceSec: (sec: number) => void;
  seedColouringState: (seed: ColouringSeed) => void;
  getColouringInfo: () => ColouringInfo | null;
  getSortingInfo: () => SortingInfo | null;
  seedSortingLevel: (level: number) => void;
  seedLanguageSetting: (lang: 'en' | 'fr' | 'both') => void;
  seedTimeEarningEnabled: (enabled: boolean) => void;
  seedLetterMonsterLevel: (level: number) => void;
  getLetterMonsterInfo: () => LetterMonsterInfo | null;
  getBalloonInfo: () => BalloonInfo | null;
  seedBalloonLevel: (level: number) => void;
  seedSeedFlowerLevel: (level: number) => void;
  getSeedFlowerInfo: () => SeedFlowerInfo | null;
  seedSinkFloatLevel: (level: number) => void;
  getSinkFloatInfo: () => SinkFloatInfo | null;
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

/** Current LearningSession listening flag. Read-only; only present under ?e2e=1. */
export function isListening(page: Page): Promise<boolean> {
  return callHook<boolean>(page, 'isListening');
}

export function getGameSize(page: Page): Promise<{ width: number; height: number }> {
  return callHook<{ width: number; height: number }>(page, 'getGameSize');
}

/** Seeds the Who's Hiding? adaptive level (seed-only hook; call it on the map, before the building tap). */
export async function seedHidingLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedHidingLevel', [level]);
}

/** Optional steps for a journey: `beforeEnter` runs on the map (after the profile tap), before the building tap. */
export interface JourneyOptions {
  beforeEnter?: () => Promise<void>;
  /** Seeds settings.timeEarning.enabled before the profile tap (default true: existing tests exercise the earning UI). */
  timeEarningEnabled?: boolean;
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
export async function tapWorldBuilding(
  page: Page,
  profile: ProfileTestId,
  worldId: string,
  opts?: JourneyOptions,
): Promise<void> {
  // Relative to baseURL (.../kids-app/): stays inside the service worker scope, so it also works offline.
  await page.goto('./?e2e=1');
  await seedTimeEarningEnabled(page, opts?.timeEarningEnabled ?? true);
  await page.locator(`[data-testid="${profile}"]`).click();
  await waitForScene(page, 'MapScene');
  if (opts?.beforeEnter) await opts.beforeEnter();

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
 * Language House and Number Garden open a game picker first: then `game-picker-<gameId>` is tapped
 * (defaults: animal-restaurant, sorting-beds).
 * Single-game worlds take their entry game; passing another game id for them is an error.
 */
export async function enterWorldByTap(
  page: Page,
  profile: ProfileTestId,
  worldId: string,
  gameId?: string,
  opts?: JourneyOptions,
): Promise<void> {
  const pickerDefault = PICKER_WORLD_DEFAULT_GAME[worldId];
  const game = gameId ?? pickerDefault ?? WORLD_ENTRY_GAME[worldId];
  const targetScene = game ? GAME_SCENE[game] : undefined;
  const extraPicker = Boolean(gameId && PICKER_WORLD_EXTRA_GAMES[worldId]?.includes(gameId));
  if (!game || !targetScene) throw new Error(`enterWorldByTap: no game scene known for world "${worldId}"`);
  if (!pickerDefault && WORLD_ENTRY_GAME[worldId] !== game && !extraPicker) {
    throw new Error(`enterWorldByTap: world "${worldId}" has no game "${game}"`);
  }

  await tapWorldBuilding(page, profile, worldId, opts);
  if (pickerDefault || extraPicker) await tapTestId(page, `game-picker-${game}`);
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

export function getSpokenLineCount(page: Page): Promise<number> {
  return callHook<number>(page, 'getSpokenLineCount');
}

export async function seedBalanceSec(page: Page, sec: number): Promise<void> {
  await callHook<void>(page, 'seedBalanceSec', [sec]);
}

export async function seedColouringState(page: Page, seed: ColouringSeed): Promise<void> {
  await callHook<void>(page, 'seedColouringState', [seed]);
}

export function getColouringInfo(page: Page): Promise<ColouringInfo | null> {
  return callHook<ColouringInfo | null>(page, 'getColouringInfo');
}

/** Waits until ColouringScene is active and getColouringInfo() is non-null. */
export async function waitForColouringReady(page: Page, timeout = 15_000): Promise<ColouringInfo> {
  await page.waitForFunction(() => {
    const hooks = (window as unknown as { __testHooks__?: Hooks }).__testHooks__;
    return hooks?.getColouringInfo() !== null && hooks?.getColouringInfo() !== undefined;
  }, undefined, { timeout });
  const info = await getColouringInfo(page);
  if (!info) throw new Error('ColouringScene is active but getColouringInfo() is null');
  return info;
}

/** Real click at a region's tapPoint (page CSS px). */
export async function tapColouringRegion(page: Page, regionId: string): Promise<void> {
  const info = await getColouringInfo(page);
  const region = info?.regions.find((r) => r.id === regionId);
  if (!region) throw new Error(`no hit-testable region "${regionId}" (info ${info ? 'present' : 'null'})`);
  await page.mouse.click(region.tapPoint.x, region.tapPoint.y);
}


// ---------------------------------------------------------------------------------------------
// Sorting Beds (docs/specs/sorting-beds.md, docs/contracts/sorting-beds.md)
// Hit rectangles from getSortingInfo are already in page CSS px: tap them with page.mouse.click (not clickGame).
// ---------------------------------------------------------------------------------------------

export type ReadySortingInfo = SortingInfo & { currentItem: NonNullable<SortingInfo['currentItem']> };


/** Seeds the active profile's persisted Sorting Beds level. Call from `enterWorldByTap(page, profile, worldId, undefined, { beforeEnter })`. */
export async function seedSortingLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedSortingLevel', [level]);
}


/** Seeds the app's language setting (stored settings.languages) so a test knows which language a round uses. Call from `beforeEnter`. */
export async function seedLanguageSetting(page: Page, lang: 'en' | 'fr' | 'both'): Promise<void> {
  await callHook<void>(page, 'seedLanguageSetting', [lang]);
}

/** Seeds settings.timeEarning.enabled (seed only; waits for the hooks, no profile needed). Call right after `goto('?e2e=1')`. Reloads once so profile-select and later HUDs render with the persisted flag. */
export async function seedTimeEarningEnabled(page: Page, enabled: boolean): Promise<void> {
  await page.waitForFunction(
    () => (window as unknown as { __testHooks__?: Hooks }).__testHooks__?.seedTimeEarningEnabled !== undefined,
  );
  await callHook<void>(page, 'seedTimeEarningEnabled', [enabled]);
  await page.reload();
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

/** Seeds the persisted Letter Monster level for the active profile. Call before entering. */
export async function seedLetterMonsterLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedLetterMonsterLevel', [level]);
}

/** Reads the live Letter Monster round snapshot (null when LetterMonsterScene is not active). */
export async function getLetterMonsterInfo(page: Page): Promise<LetterMonsterInfo | null> {
  return callHook<LetterMonsterInfo | null>(page, 'getLetterMonsterInfo');
}

/** Waits until Letter Monster is asking and ready for taps with all offered foods measured. */
export async function waitForLetterMonsterReady(page: Page, timeout = 12_000): Promise<LetterMonsterInfo> {
  const handle = await page.waitForFunction(
    () => {
      const hooks = (window as unknown as {
        __testHooks__?: { getLetterMonsterInfo?: () => LetterMonsterInfo | null };
      }).__testHooks__;
      const info = hooks?.getLetterMonsterInfo?.();
      if (!info || !info.ready || info.phase !== 'asking') return null;
      if (info.offeredIds.length === 0 || Object.keys(info.foods).length !== info.offeredIds.length) return null;
      return info;
    },
    undefined,
    { timeout },
  );
  return (await handle.jsonValue()) as LetterMonsterInfo;
}

// ---------------------------------------------------------------------------------------------
// Balloon Pop (docs/specs/balloon-pop.md). Hit rectangles from getBalloonInfo are page CSS px.
// ---------------------------------------------------------------------------------------------

/** Seeds the active profile's persisted Balloon Pop level for every language. Call from `beforeEnter` (on the map). */
export async function seedBalloonLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedBalloonLevel', [level]);
}

export function getBalloonInfo(page: Page): Promise<BalloonInfo | null> {
  return callHook<BalloonInfo | null>(page, 'getBalloonInfo');
}

/** Waits until every balloon has risen into place and taps are accepted. */
export async function waitForBalloonReady(page: Page, timeout = 12_000): Promise<BalloonInfo> {
  await page.waitForFunction(
    () => {
      const info = (window as unknown as { __testHooks__: Hooks }).__testHooks__.getBalloonInfo();
      return info !== null && info.ready;
    },
    undefined,
    { timeout },
  );
  const info = await getBalloonInfo(page);
  if (!info) throw new Error('no active Balloon Pop trial');
  return info;
}

/** Real tap on the balloon holding `itemId`, using a fresh read of its hit rectangle. */
export async function tapBalloon(page: Page, itemId: string): Promise<void> {
  const info = await getBalloonInfo(page);
  const balloon = info?.balloons.find((b) => b.itemId === itemId);
  if (!balloon) throw new Error(`no balloon "${itemId}" in the active trial`);
  await tapRect(page, balloon.hit);
}

/** Waits for a ready trial, taps the requested balloon for real, and waits until the next trial is ready. Returns the info read before the tap. */
export async function popCorrectBalloon(page: Page, timeout = 15_000): Promise<BalloonInfo> {
  const before = await waitForBalloonReady(page, timeout);
  await tapBalloon(page, before.targetItemId);
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getBalloonInfo(page);
    if (info && info.ready && info.correctCount > before.correctCount) return before;
    if (Date.now() > deadline) throw new Error('the tap on the requested balloon did not start the next trial');
    await page.waitForTimeout(50);
  }
}

/** The persisted Balloon Pop skill of a profile (read-only localStorage read). */
export async function readBalloonSkill(page: Page, profile: ProfileTestId, lang: string): Promise<StoredSkill | null> {
  const profileId = profile === 'profile-a' ? 'a' : 'b';
  return page.evaluate(
    ([id, skill]) => {
      const raw = window.localStorage.getItem(`kids-app-adaptive:${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { skills?: Record<string, StoredSkill> };
      return parsed.skills?.[skill] ?? null;
    },
    [profileId, `number-garden.balloon-pop.${lang}`] as const,
  );
}

/** Seeds the persisted Sink or Float level for every language (seed only). Call on the map, before entering. */
export async function seedSinkFloatLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedSinkFloatLevel', [level]);
}

export function getSinkFloatInfo(page: Page): Promise<SinkFloatInfo | null> {
  return callHook<SinkFloatInfo | null>(page, 'getSinkFloatInfo');
}

/** Waits until Sink or Float accepts taps and returns its state. */
export async function waitForSinkFloatReady(page: Page, timeout = 15_000): Promise<SinkFloatInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getSinkFloatInfo(page);
    if (info?.ready) return info;
    if (Date.now() > deadline) throw new Error(`Sink or Float never became ready: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

/** Seeds the persisted Seed to Flower level for every language (seed only). Call on the map, before entering. */
export async function seedSeedFlowerLevel(page: Page, level: number): Promise<void> {
  await callHook<void>(page, 'seedSeedFlowerLevel', [level]);
}

export function getSeedFlowerInfo(page: Page): Promise<SeedFlowerInfo | null> {
  return callHook<SeedFlowerInfo | null>(page, 'getSeedFlowerInfo');
}

/** Waits until the plant accepts tool taps and returns its state. */
export async function waitForSeedFlowerReady(page: Page, timeout = 15_000): Promise<SeedFlowerInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getSeedFlowerInfo(page);
    if (info?.ready) return info;
    if (Date.now() > deadline) throw new Error(`Seed to Flower never became ready: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

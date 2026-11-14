// Playwright helpers for Picnic Train (docs/specs/picnic-train.md, docs/PROCESS.md section 4).
// Hooks only SEED (level) or READ state (getPicnicInfo). Every action is a real pointer click on a rectangle read from
// getPicnicInfo (page CSS px). Not a test file: Playwright only collects *.spec.ts.
import { expect, type Page } from '@playwright/test';
import type { PicnicInfo, PageRect } from '../../../src/games/picnic/types';
import { enterWorldByTap, readStarCount, type ProfileTestId } from './journey';

export type { PicnicInfo, PageRect };

/** Info of a train that accepts input right now. */
export type ReadyPicnicInfo = PicnicInfo & { ready: true };

type PicnicHooks = {
  getPicnicInfo: () => PicnicInfo | null;
  seedPicnicLevel: (level: number) => void;
};

async function callPicnicHook<T>(page: Page, name: keyof PicnicHooks, args: unknown[] = []): Promise<T> {
  return page.evaluate(
    ([hookName, hookArgs]) => {
      const hooks = (window as unknown as { __testHooks__: Record<string, (...a: unknown[]) => unknown> }).__testHooks__;
      return hooks[hookName as string](...(hookArgs as unknown[]));
    },
    [name, args] as const,
  ) as Promise<T>;
}

export function getPicnicInfo(page: Page): Promise<PicnicInfo | null> {
  return callPicnicHook<PicnicInfo | null>(page, 'getPicnicInfo');
}

/** Seeds the active profile's persisted Picnic Train level. Call from `beforeEnter`. */
export async function seedPicnicLevel(page: Page, level: number): Promise<void> {
  await callPicnicHook<void>(page, 'seedPicnicLevel', [level]);
}

/** Enters Picnic Train through the Number Garden building and its picker card, with optional seeds. */
export async function enterPicnic(
  page: Page,
  profile: ProfileTestId,
  seed: { level?: number; balanceSec?: number; lang?: 'en' | 'fr' | 'both' } = {},
): Promise<void> {
  await enterWorldByTap(page, profile, 'number-garden', 'picnic-train', {
    beforeEnter: async () => {
      await page.evaluate(
        ([level, balanceSec, lang]) => {
          const hooks = (window as unknown as { __testHooks__: Record<string, (...a: unknown[]) => unknown> }).__testHooks__;
          if (lang !== null) hooks.seedLanguageSetting(lang);
          if (level !== null) hooks.seedPicnicLevel(level);
          if (balanceSec !== null) hooks.seedBalanceSec(balanceSec);
        },
        [seed.level ?? null, seed.balanceSec ?? null, seed.lang ?? null] as const,
      );
    },
  });
}

/** Waits until the train accepts input (not departing, not animating). */
export async function waitForPicnicReady(page: Page, timeout = 20_000): Promise<ReadyPicnicInfo> {
  await page.waitForFunction(
    () => {
      const info = (window as unknown as { __testHooks__: { getPicnicInfo: () => { ready: boolean; phase: string } | null } }).__testHooks__.getPicnicInfo();
      return info !== null && info.ready && info.phase !== 'depart';
    },
    undefined,
    { timeout },
  );
  const info = await getPicnicInfo(page);
  if (!info) throw new Error('no active Picnic Train round');
  return info as ReadyPicnicInfo;
}

/** Polls until `predicate` holds for the current info. Returns that info. */
export async function waitForPicnic(
  page: Page,
  predicate: (info: PicnicInfo) => boolean,
  message: string,
  timeout = 15_000,
): Promise<PicnicInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getPicnicInfo(page);
    if (info && predicate(info)) return info;
    if (Date.now() > deadline) throw new Error(`waitForPicnic timed out: ${message} (last info: ${JSON.stringify(info)})`);
    await page.waitForTimeout(50);
  }
}

/** Real pointer click at the centre of a page-px rectangle. */
export async function tapRect(page: Page, hit: PageRect): Promise<void> {
  await page.mouse.click(hit.x + hit.width / 2, hit.y + hit.height / 2);
}

/** Number of passengers holding an item. */
export function servedCount(info: PicnicInfo): number {
  return info.passengers.filter((p) => p.hasItem).length;
}

/** Real tap on the first free passenger, then waits until that passenger holds an item. Returns the info read before the tap. */
export async function giveToNextFree(page: Page): Promise<ReadyPicnicInfo> {
  const before = await waitForPicnicReady(page);
  if (before.phase !== 'give' || !before.nextFreeId) throw new Error(`not in the give phase: ${JSON.stringify(before.phase)}`);
  const target = before.passengers.find((p) => p.id === before.nextFreeId);
  if (!target) throw new Error(`free passenger "${before.nextFreeId}" is not in the train`);
  expect(target.visible, `${target.id} must be on screen when it is the next free passenger`).toBe(true);
  await tapRect(page, target.hit);
  const id = target.id;
  await waitForPicnic(
    page,
    (info) => info.phase === 'depart' || info.passengers.find((p) => p.id === id)?.hasItem === true || info.size !== before.size,
    `passenger ${id} did not receive an item`,
  );
  return before;
}

/** Real tap on the basket, then waits for the loaded count to rise. */
export async function loadOne(page: Page): Promise<ReadyPicnicInfo> {
  const before = await waitForPicnicReady(page);
  if (before.phase !== 'load' || !before.basket) throw new Error('not in the load phase');
  await tapRect(page, before.basket.hit);
  await waitForPicnic(page, (info) => info.loaded === before.loaded + 1, 'the loaded count did not rise');
  return before;
}

export async function tapGo(page: Page): Promise<ReadyPicnicInfo> {
  const before = await waitForPicnicReady(page);
  if (!before.go) throw new Error('no go flag in this phase');
  await tapRect(page, before.go.hit);
  return before;
}

export async function tapCard(page: Page, value: number): Promise<ReadyPicnicInfo> {
  const before = await waitForPicnicReady(page);
  const card = before.cards?.find((c) => c.value === value);
  if (!card) throw new Error(`no number card ${value}`);
  await tapRect(page, card.hit);
  return before;
}

/**
 * Plays the current train to the end with real taps (the right ones), whatever the task, and waits until the
 * star count has risen by 1 (the train is ready and has set off).
 */
export async function playTrain(page: Page): Promise<{ task: PicnicInfo['task']; level: number; size: number }> {
  const first = await waitForPicnicReady(page);
  const stars = await readStarCount(page);
  const summary = { task: first.task, level: first.level, size: first.size };
  for (let guard = 0; guard < 40; guard++) {
    const info = await getPicnicInfo(page);
    if (!info) throw new Error('the Picnic Train round disappeared');
    if ((await readStarCount(page)) > stars) return summary;
    if (!info.ready || info.phase === 'depart') {
      await page.waitForTimeout(100);
      continue;
    }
    if (info.phase === 'give') {
      await giveToNextFree(page);
    } else if (info.phase === 'load') {
      if (info.loaded < info.target) await loadOne(page);
      else await tapGo(page);
    } else if (info.phase === 'answer') {
      await tapCard(page, info.target);
      await waitForPicnic(page, (i) => i.phase !== 'answer', 'the right number card did not open the give phase');
    }
  }
  await expect.poll(() => readStarCount(page), { timeout: 15_000 }).toBeGreaterThan(stars);
  return summary;
}

export interface StoredPicnicSkill {
  level: number;
  recent: string[];
  items: Record<string, unknown>;
}

/** The persisted adaptive skill of a profile for Picnic Train (read-only localStorage read). */
export async function readStoredPicnicSkill(page: Page, profile: ProfileTestId, lang: string): Promise<StoredPicnicSkill | null> {
  const profileId = profile === 'profile-a' ? 'a' : 'b';
  return page.evaluate(
    ([id, skill]) => {
      const raw = window.localStorage.getItem(`kids-app-adaptive:${id}`);
      if (!raw) return null;
      const parsed = JSON.parse(raw) as { skills?: Record<string, StoredPicnicSkill> };
      return parsed.skills?.[skill] ?? null;
    },
    [profileId, `number-garden.picnic-train.${lang}`] as const,
  );
}

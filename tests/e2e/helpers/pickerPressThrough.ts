// Shared press-through regression helpers for DOM game pickers rendered over MapScene.
// Ensures pointerdown/mousedown/touchstart on a picker card does not reach Phaser's window listeners
// and trigger a map building underneath the card.
import fs from 'node:fs';
import { expect, type Page } from '@playwright/test';
import {
  GAME_SCENE,
  getActiveScenes,
  getBuildingHit,
  getSpokenLineCount,
  getSpokenLines,
  getStableBox,
  seedBalanceSec,
  tapWorldBuilding,
  type PageRect,
  type ProfileTestId,
} from './journey';

export interface BuildingHit {
  readonly worldId: string;
  readonly rect: PageRect;
}

export interface CardBuildingOverlap {
  readonly worldId: string;
  readonly x: number;
  readonly y: number;
  readonly intersection: PageRect;
}

export interface FindCardPointOptions {
  /** World id to deprioritise (e.g. the building that opened the picker, preferring other buildings first). */
  readonly preferOtherThan?: string;
  /** Minimum overlap width and height in CSS px so the tap point is safely inside both rects (default 4). */
  readonly minOverlapPx?: number;
}

export interface PickerCardTarget {
  readonly testId: string;
  readonly sceneKey: string;
}

export interface PickerPressThroughOptions {
  readonly profile: ProfileTestId;
  /** Map building world id that opens this picker (e.g. 'language-house', 'nature-lab'). */
  readonly worldId: string;
  /** Picker cards and the Phaser scene key each card must start when tapped. */
  readonly cards: readonly PickerCardTarget[];
  /** World ids whose map building hit rects should be checked; defaults to all worlds in src/content/worlds.json. */
  readonly worldIds?: readonly string[];
}

const worldsData = JSON.parse(
  fs.readFileSync(new URL('../../../src/content/worlds.json', import.meta.url), 'utf8'),
) as { worlds: Array<{ id: string }> };
const DEFAULT_WORLD_IDS: readonly string[] = worldsData.worlds.map((w) => w.id);
const ALL_GAME_SCENES: readonly string[] = [...new Set(Object.values(GAME_SCENE))];

/**
 * Finds a page CSS-px point inside `cardRect` that also lies inside one of `buildingHits`.
 * Prefers buildings other than `opts.preferOtherThan`, prefers non-locked buildings (`art-studio` last),
 * and breaks ties by largest overlap area. Returns `null` when the card overlaps no building.
 */
export function findCardPointOverBuilding(
  cardRect: PageRect,
  buildingHits: readonly BuildingHit[],
  opts?: FindCardPointOptions,
): CardBuildingOverlap | null {
  const minPx = opts?.minOverlapPx ?? 4;
  const candidates: Array<CardBuildingOverlap & { priority: number; area: number }> = [];

  for (const b of buildingHits) {
    const left = Math.max(cardRect.x, b.rect.x);
    const top = Math.max(cardRect.y, b.rect.y);
    const right = Math.min(cardRect.x + cardRect.width, b.rect.x + b.rect.width);
    const bottom = Math.min(cardRect.y + cardRect.height, b.rect.y + b.rect.height);
    const width = right - left;
    const height = bottom - top;
    if (width < minPx || height < minPx) continue;

    const isOther = b.worldId !== opts?.preferOtherThan;
    const isUnlocked = b.worldId !== 'art-studio';
    const priority = (isOther ? 2 : 0) + (isUnlocked ? 1 : 0);
    candidates.push({
      worldId: b.worldId,
      x: left + width / 2,
      y: top + height / 2,
      intersection: { x: left, y: top, width, height },
      priority,
      area: width * height,
    });
  }

  if (candidates.length === 0) return null;
  candidates.sort((a, b) => b.priority - a.priority || b.area - a.area);
  const best = candidates[0];
  return { worldId: best.worldId, x: best.x, y: best.y, intersection: best.intersection };
}

/**
 * Verifies that tapping a picker card at a point overlapping a map building starts ONLY that card's scene
 * and never leaks the press through to MapScene (no other scene, no second picker, no locked-world toast/voice).
 *
 * To add coverage for another picker or new card in a future PR:
 *   1. Add `{ profile, worldId, cards }` to `PICKER_PRESS_THROUGH_CASES` in `tests/e2e/picker.press-through.spec.ts`
 *      (use `stationsForWorld(worldId)` so new WORLD_GAMES entries are picked up automatically).
 *   2. Add any new game scene id to `GAME_SCENE` in `tests/e2e/helpers/journey.ts`.
 *   3. Add any new world id to `src/content/worlds.json` (read automatically by `DEFAULT_WORLD_IDS`).
 *
 * Fails if zero cards in the picker overlap any map building in the current viewport orientation,
 * so the check can never pass vacuously.
 */
export async function expectPickerPressDoesNotReachMap(
  page: Page,
  opts: PickerPressThroughOptions,
): Promise<number> {
  expect(opts.cards.length, `${opts.worldId} picker must declare at least one card`).toBeGreaterThan(0);
  const worldIds = opts.worldIds ?? DEFAULT_WORLD_IDS;
  let testedCount = 0;

  for (const card of opts.cards) {
    // Seed a positive leisure balance so Leisure Corner would open its own picker (a visible DOM/scene break)
    // if a press ever leaked through to it.
    await tapWorldBuilding(page, opts.profile, opts.worldId, {
      beforeEnter: () => seedBalanceSec(page, 60),
    });

    const cardBox = await getStableBox(page, card.testId);
    const buildingHits: BuildingHit[] = [];
    for (const id of worldIds) {
      const rect = await getBuildingHit(page, id);
      if (rect) buildingHits.push({ worldId: id, rect });
    }
    expect(buildingHits.length, 'MapScene must expose building hit rects while picker is open').toBeGreaterThan(0);

    const overlap = findCardPointOverBuilding(cardBox, buildingHits, { preferOtherThan: opts.worldId });
    if (!overlap) continue;
    testedCount += 1;

    const topIsCard = await page.evaluate(
      ({ x, y, testId }) => {
        const el = document.elementFromPoint(x, y);
        return el !== null && el.closest(`[data-testid="${testId}"]`) !== null;
      },
      { x: overlap.x, y: overlap.y, testId: card.testId },
    );
    expect(topIsCard, `${card.testId} overlap point (${overlap.x}, ${overlap.y}) must hit the card`).toBe(true);

    const spokenBefore = await getSpokenLineCount(page);
    await page.mouse.click(overlap.x, overlap.y);

    await page.waitForFunction(
      ({ expectedScene, otherScenes, cardTestId }) => {
        const hooks = (window as unknown as { __testHooks__?: { getActiveScenes: () => string[] } }).__testHooks__;
        const scenes = hooks?.getActiveScenes() ?? [];
        if (scenes.includes(expectedScene)) return true;
        if (scenes.some((s) => otherScenes.includes(s))) return true;
        // Another picker replaced ours on MapScene while leaving .shell-game-picker mounted.
        if (
          scenes.includes('MapScene') &&
          document.querySelector('.shell-game-picker') !== null &&
          !document.querySelector(`[data-testid="${cardTestId}"]`)
        ) {
          return true;
        }
        return false;
      },
      {
        expectedScene: card.sceneKey,
        otherScenes: ALL_GAME_SCENES.filter((s) => s !== card.sceneKey),
        cardTestId: card.testId,
      },
      { timeout: 10_000 },
    );

    const scenes = await getActiveScenes(page);
    expect(scenes, `${card.testId} over ${overlap.worldId} must start ${card.sceneKey}`).toContain(card.sceneKey);
    expect(scenes, `${card.testId} over ${overlap.worldId} must leave MapScene`).not.toContain('MapScene');
    for (const other of ALL_GAME_SCENES) {
      if (other !== card.sceneKey) {
        expect(scenes, `${card.testId} over ${overlap.worldId} must not start ${other}`).not.toContain(other);
      }
    }

    await expect(page.locator('.shell-game-picker'), 'no picker may remain open after card tap').toHaveCount(0);
    const spoken = await getSpokenLines(page, spokenBefore);
    expect(
      spoken.some((l) => l.lineId === 'map.comingSoon'),
      `${card.testId} over ${overlap.worldId} must not trigger locked-world audio`,
    ).toBe(false);
  }

  expect(
    testedCount,
    `${opts.worldId} picker had zero cards overlapping any map building in this orientation`,
  ).toBeGreaterThan(0);
  return testedCount;
}

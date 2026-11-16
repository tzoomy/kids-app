import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { test, expect, type Locator, type Page, type TestInfo } from '@playwright/test';
import { tapWorldBuilding, type PageRect } from './helpers/journey';
import { PICKER_CLOSE_TEST_ID, STATION_TRAIL_TEST_ID } from '../../src/ui/picker/pickerModel';
import { stationsForWorld } from './helpers/worldStations';

// Regression spec for the station-trail picker on a PHONE in portrait (docs/specs/station-trail.md, AC-14 family).
// Bug (Maor's phone, ~440 px wide): with 5 stations the cards were ~70 px wide, labels were cut off, the stars covered
// labels and art, and the title was clipped by the close button.
// Every test enters through the real map building with real taps. Hooks only SEED persisted adaptive state
// (`seed*Level`, before the building tap); no goToScreen. Scrolling the trail container is allowed (scrollIntoViewIfNeeded).
// No screenshots: everything is asserted from DOM geometry. Geometry assertions are `expect.soft`, so one run reports
// every violation of every station; hard `expect`s are kept only where later code depends on them.
//
// Orientation gating (docs/PROCESS.md section 4, @single-orientation): the phone viewports override the project
// viewport, so each phone test would run twice. They run in the portrait project only; the landscape guard runs in the
// landscape project only.

const PORTRAIT_PROJECT = 'portrait-800x1280';
const LANDSCAPE_PROJECT = 'landscape-1280x800';
const MIN_TAP = 64;
const MIN_CARD_WIDTH_RATIO = 0.6;
const TOLERANCE = 1; // px, sub-pixel layout rounding
const SCROLL_TOLERANCE = 2; // px, line-height rounding in scrollHeight vs clientHeight
const SEED_LEVEL = 8; // above every track start: seeded games count as completed (star shown)

const PHONE_VIEWPORTS = [
  { width: 440, height: 900 },
  { width: 360, height: 780 },
] as const;

const WORLDS_FILE = path.join(path.dirname(fileURLToPath(import.meta.url)), '../../src/content/worlds.json');

/** Open learning worlds whose building opens a station trail (2+ stations, per the registry). 1 station = direct entry, 0 = empty picker: no trail. */
const TRAIL_WORLDS: readonly { id: string; stationCount: number }[] = (
  JSON.parse(fs.readFileSync(WORLDS_FILE, 'utf8')) as { worlds: { id: string; status: string }[] }
).worlds
  .filter((w) => w.status === 'open')
  .map((w) => ({ id: w.id, stationCount: stationsForWorld(w.id).length }))
  .filter((w) => w.stationCount >= 2);

function onlyProject(testInfo: TestInfo, projectName: string): void {
  if (testInfo.project.name !== projectName) test.skip();
}

/** Seed-only: puts every game that has a `seed*Level` hook above its track start so completed stations show their star. */
async function seedAllGamesCompleted(page: Page): Promise<void> {
  await page.evaluate((level) => {
    const hooks = (window as unknown as { __testHooks__: Record<string, unknown> }).__testHooks__;
    for (const [name, fn] of Object.entries(hooks)) {
      if (/^seed.+Level$/.test(name) && typeof fn === 'function') (fn as (l: number) => void)(level);
    }
  }, SEED_LEVEL);
}

async function openTrail(page: Page, worldId: string, stationCount: number, seed: boolean): Promise<Locator> {
  await tapWorldBuilding(page, 'profile-b', worldId, seed ? { beforeEnter: () => seedAllGamesCompleted(page) } : undefined);
  const trail = page.locator(`[data-testid="${STATION_TRAIL_TEST_ID}"]`);
  await trail.waitFor({ state: 'visible', timeout: 10_000 });
  await expect(trail.locator('.picker-card')).toHaveCount(stationCount);
  return trail;
}

async function box(locator: Locator, what: string): Promise<PageRect> {
  const b = await locator.boundingBox();
  if (!b) throw new Error(`${what} has no bounding box`);
  return b;
}

const overlaps = (a: PageRect, b: PageRect): boolean =>
  a.x < b.x + b.width - TOLERANCE && b.x < a.x + a.width - TOLERANCE && a.y < b.y + b.height - TOLERANCE && b.y < a.y + a.height - TOLERANCE;

const isInside = (inner: PageRect, outer: PageRect): boolean =>
  inner.x >= outer.x - TOLERANCE &&
  inner.y >= outer.y - TOLERANCE &&
  inner.x + inner.width <= outer.x + outer.width + TOLERANCE &&
  inner.y + inner.height <= outer.y + outer.height + TOLERANCE;

const union = (rects: readonly PageRect[]): PageRect => {
  const left = Math.min(...rects.map((r) => r.x));
  const top = Math.min(...rects.map((r) => r.y));
  const right = Math.max(...rects.map((r) => r.x + r.width));
  const bottom = Math.max(...rects.map((r) => r.y + r.height));
  return { x: left, y: top, width: right - left, height: bottom - top };
};

const fmt = (r: PageRect): string => `[x ${r.x.toFixed(1)}, y ${r.y.toFixed(1)}, w ${r.width.toFixed(1)}, h ${r.height.toFixed(1)}]`;

interface TextMetrics {
  scrollWidth: number;
  clientWidth: number;
  scrollHeight: number;
  clientHeight: number;
  textOverflow: string;
}

const textMetrics = (el: Locator): Promise<TextMetrics> =>
  el.evaluate((node) => ({
    scrollWidth: node.scrollWidth,
    clientWidth: node.clientWidth,
    scrollHeight: node.scrollHeight,
    clientHeight: node.clientHeight,
    textOverflow: getComputedStyle(node).textOverflow,
  }));

/**
 * Rendered glyph rectangles of an element's text (one rect per line box): `Range.getClientRects()` over its contents.
 * Unlike scrollWidth/scrollHeight this sees text that is painted outside its card or under a sibling, and it does not
 * suffer from sub-pixel line-height rounding. Coordinates are viewport CSS px, like Playwright's boundingBox().
 */
async function textRects(el: Locator): Promise<PageRect[]> {
  return el.evaluate((node) => {
    const range = document.createRange();
    range.selectNodeContents(node);
    return Array.from(range.getClientRects())
      .filter((r) => r.width > 0 && r.height > 0)
      .map((r) => ({ x: r.x, y: r.y, width: r.width, height: r.height }));
  });
}

for (const viewport of PHONE_VIEWPORTS) {
  test.describe(`station trail on a phone in portrait ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport });

    for (const world of TRAIL_WORLDS) {
      test(`[AC-14] ${world.id} (${world.stationCount} stations): readable full-width rows, label not cut off, star off the label, title clear of the close button`, async ({ page }, testInfo) => {
        onlyProject(testInfo, PORTRAIT_PROJECT);
        const trail = await openTrail(page, world.id, world.stationCount, true);

        // 1) Cards first.
        let starsChecked = 0;
        for (const game of stationsForWorld(world.id)) {
          const id = game.gameId;
          const card = trail.locator(`[data-testid="${game.testId}"]`);
          await card.scrollIntoViewIfNeeded(); // the portrait trail may scroll vertically
          await expect(card).toBeVisible();
          const cardBox = await box(card, `${id} card`);

          // Tap target and width: a full-width row, not a thumbnail.
          expect.soft(cardBox.height, `${id} card height ${fmt(cardBox)}`).toBeGreaterThanOrEqual(MIN_TAP);
          expect.soft(cardBox.width, `${id} card width ${fmt(cardBox)} vs viewport ${viewport.width}`).toBeGreaterThanOrEqual(viewport.width * MIN_CARD_WIDTH_RATIO);

          // Label: complete text, not truncated, inside its card.
          const label = card.locator('.picker-card-label');
          await expect(label).toBeVisible();
          const m = await textMetrics(label);
          expect.soft(m.scrollWidth, `${id} label scrollWidth > clientWidth (cut off horizontally)`).toBeLessThanOrEqual(m.clientWidth + TOLERANCE);
          expect.soft(m.scrollHeight, `${id} label scrollHeight > clientHeight (cut off vertically)`).toBeLessThanOrEqual(m.clientHeight + SCROLL_TOLERANCE);
          expect.soft(m.textOverflow, `${id} label uses an ellipsis`).not.toBe('ellipsis');
          const labelBox = await box(label, `${id} label`);
          expect.soft(isInside(labelBox, cardBox), `${id} label box ${fmt(labelBox)} is not inside card ${fmt(cardBox)}`).toBe(true);

          // Rendered text: every line of the label must lie inside the card (the card clips with overflow:hidden).
          const lines = await textRects(label);
          expect(lines.length, `${id} label has rendered text`).toBeGreaterThan(0);
          const textBox = union(lines);
          expect.soft(isInside(textBox, cardBox), `${id} label text ${fmt(textBox)} is not inside card ${fmt(cardBox)} (clipped by the card)`).toBe(true);

          // Star (completed stations only) must not cover the label box or any rendered line of its text.
          const star = card.locator('[data-testid^="station-star-"]');
          if ((await star.count()) > 0) {
            starsChecked++;
            const starBox = await box(star, `${id} star`);
            expect.soft(overlaps(labelBox, starBox), `${id} star ${fmt(starBox)} covers label box ${fmt(labelBox)}`).toBe(false);
            for (const line of lines) {
              expect.soft(overlaps(line, starBox), `${id} star ${fmt(starBox)} covers label text line ${fmt(line)}`).toBe(false);
            }
          }
        }
        // Language House always has the restaurant, which the seed* sweep completes: the star checks are not vacuous.
        if (world.id === 'language-house') expect(starsChecked, 'Language House shows at least one star').toBeGreaterThan(0);

        // 2) Then the title: no horizontal clipping, text clear of the close button and inside the panel and viewport.
        const title = page.locator('.picker-title');
        await expect(title).toBeVisible();
        const titleMetrics = await textMetrics(title);
        expect.soft(titleMetrics.scrollWidth, 'title scrollWidth > clientWidth (clipped horizontally)').toBeLessThanOrEqual(titleMetrics.clientWidth + TOLERANCE);
        const closeBox = await box(page.locator(`[data-testid="${PICKER_CLOSE_TEST_ID}"]`), 'close button');
        const panelBox = await box(page.locator('.picker-panel'), 'picker panel');
        const titleLines = await textRects(title);
        expect(titleLines.length, 'title has rendered text').toBeGreaterThan(0);
        for (const line of titleLines) {
          expect.soft(overlaps(line, closeBox), `title text line ${fmt(line)} overlaps close button ${fmt(closeBox)}`).toBe(false);
        }
        const titleText = union(titleLines);
        expect.soft(isInside(titleText, panelBox), `title text ${fmt(titleText)} is not inside the panel ${fmt(panelBox)}`).toBe(true);
        expect.soft(titleText.x, `title text ${fmt(titleText)} left of the viewport`).toBeGreaterThanOrEqual(-TOLERANCE);
        expect.soft(titleText.x + titleText.width, `title text ${fmt(titleText)} right of the viewport`).toBeLessThanOrEqual(viewport.width + TOLERANCE);
      });
    }
  });
}

test.describe('station trail in landscape stays a single 4:5 row @single-orientation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // No equivalent guard exists in station-trail.spec.ts: AC-14 there checks size, viewport and overlap only.
  for (const world of TRAIL_WORLDS) {
    test(`[AC-14] ${world.id} (${world.stationCount} stations): cards side by side in one row, 4:5`, async ({ page }, testInfo) => {
      onlyProject(testInfo, LANDSCAPE_PROJECT);
      const trail = await openTrail(page, world.id, world.stationCount, false);
      const boxes: PageRect[] = [];
      for (const game of stationsForWorld(world.id)) {
        boxes.push(await box(trail.locator(`[data-testid="${game.testId}"]`), `${game.gameId} card`));
      }
      for (const [i, b] of boxes.entries()) {
        expect(Math.abs(b.y - boxes[0].y), `card ${i} top differs from card 0 (not one row)`).toBeLessThanOrEqual(3);
        expect(b.width / b.height, `card ${i} aspect ratio (width/height)`).toBeGreaterThan(0.78);
        expect(b.width / b.height, `card ${i} aspect ratio (width/height)`).toBeLessThan(0.82);
      }
      // Side by side: no two cards share a column.
      const xs = boxes.map((b) => b.x).sort((a, b) => a - b);
      for (let i = 1; i < xs.length; i++) expect(xs[i] - xs[i - 1], 'cards are side by side').toBeGreaterThan(boxes[0].width * 0.9);
    });
  }
});

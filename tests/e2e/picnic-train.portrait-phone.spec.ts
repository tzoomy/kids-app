// Regression spec for portrait audit H4 (2026-11-16): on a portrait PHONE the age-5 cargo shelf (load task) had ten slots
// in one row, 31x31 CSS px at 360x800 and 36x36 at 412x915. The portrait shelf now wraps to two rows; every slot must be
// at least 48 CSS px, inside the viewport, and the top element at its centre must be the game canvas (nothing covers it).
// Spec: docs/specs/picnic-train.md (AC-11). Real taps through the map building and the picker card; hooks only seed the
// level and read getPicnicInfo. No screenshots.
//
// Orientation gating (docs/PROCESS.md section 4): the phone viewports override the project viewport, so these tests run
// in the portrait project only.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { readStarCount } from './helpers/journey';
import { MAX_LOAD } from '../../src/games/picnic/picnicLogic';
import { enterPicnic, waitForPicnic, waitForPicnicReady, type PageRect, type PicnicInfo } from './helpers/picnic';

const PORTRAIT_PROJECT = 'portrait-800x1280';
const MIN_PHONE_SLOT = 48;
const LOAD_LEVEL = 5; // age-5 load task (docs/specs/picnic-train.md level table)

const PHONES = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
] as const;

function portraitOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== PORTRAIT_PROJECT) test.skip();
}

/** Real touch tap at the centre of a page-px rectangle. */
async function touchRect(page: Page, r: PageRect): Promise<void> {
  await page.touchscreen.tap(r.x + r.width / 2, r.y + r.height / 2);
}

async function touchBasketUntil(page: Page, loaded: number): Promise<PicnicInfo> {
  for (;;) {
    const info = await waitForPicnicReady(page);
    if (info.loaded >= loaded) return info;
    await touchRect(page, info.basket!.hit);
    await waitForPicnic(page, (i) => i.loaded === info.loaded + 1, 'the loaded count did not rise');
  }
}

/** Whether the top-most element at the centre of each rectangle is the game canvas. */
function centresHitCanvas(page: Page, rects: PageRect[]): Promise<boolean[]> {
  return page.evaluate(
    (rs) =>
      rs.map((r) => {
        const el = document.elementFromPoint(r.x + r.width / 2, r.y + r.height / 2);
        return el instanceof HTMLCanvasElement;
      }),
    rects,
  );
}

for (const phone of PHONES) {
  test.describe(`picnic train: cargo shelf on a ${phone.width}x${phone.height} portrait phone`, () => {
    test.use({ viewport: phone, isMobile: true, hasTouch: true });

    test(`[AC-11] all ${MAX_LOAD} cargo slots are at least ${MIN_PHONE_SLOT} CSS px, on screen, uncovered and tappable`, async ({ page }, testInfo) => {
      portraitOnly(testInfo);
      test.setTimeout(90_000);
      await enterPicnic(page, 'profile-b', { level: LOAD_LEVEL });
      const first = await waitForPicnicReady(page);
      expect(first.task).toBe('load');

      // Fill the shelf so every slot has a readable, tappable rectangle (cargoHits lists the loaded slots).
      const full = await touchBasketUntil(page, MAX_LOAD);
      expect(full.cargoHits).toHaveLength(MAX_LOAD);
      for (const [i, r] of full.cargoHits.entries()) {
        expect.soft(r.width, `slot ${i} width`).toBeGreaterThanOrEqual(MIN_PHONE_SLOT);
        expect.soft(r.height, `slot ${i} height`).toBeGreaterThanOrEqual(MIN_PHONE_SLOT);
        expect.soft(r.x, `slot ${i} left`).toBeGreaterThanOrEqual(0);
        expect.soft(r.y, `slot ${i} top`).toBeGreaterThanOrEqual(0);
        expect.soft(r.x + r.width, `slot ${i} right`).toBeLessThanOrEqual(phone.width);
        expect.soft(r.y + r.height, `slot ${i} bottom`).toBeLessThanOrEqual(phone.height);
        for (let j = i + 1; j < full.cargoHits.length; j++) {
          const o = full.cargoHits[j];
          const overlap = r.x < o.x + o.width && o.x < r.x + r.width && r.y < o.y + o.height && o.y < r.y + r.height;
          expect.soft(overlap, `slot ${i} overlaps slot ${j}`).toBe(false);
        }
      }
      expect(await centresHitCanvas(page, full.cargoHits)).toEqual(full.cargoHits.map(() => true));

      // The slots still work: a tap on any loaded slot (first the top-left one, then the last one, in the second row)
      // takes an item back, down to the asked number, then go wins the train.
      const stars = await readStarCount(page);
      for (let loaded = MAX_LOAD; loaded > full.target; loaded--) {
        const info = await waitForPicnicReady(page);
        await touchRect(page, info.cargoHits[loaded === MAX_LOAD ? 0 : loaded - 1]);
        await waitForPicnic(page, (i) => i.loaded === loaded - 1, `a slot tap at ${loaded} loaded did not take an item back`);
      }
      const ready = await waitForPicnicReady(page);
      expect(ready.loaded).toBe(ready.target);
      await touchRect(page, ready.go!.hit);
      await expect.poll(() => readStarCount(page), { timeout: 20_000 }).toBeGreaterThan(stars);
    });
  });
}

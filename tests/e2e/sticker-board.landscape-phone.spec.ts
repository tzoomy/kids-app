// Regression spec for the Sticker Board chrome on a PHONE in landscape and on a TABLET in portrait (follow-up to the
// 2026-11-16 portrait audit; docs/specs/sticker-board.md AC-15 family).
// Bug 1 (915x412, 844x390, 800x360): the chrome mapped the 1280x800 game layout through the ~0.45-0.52x canvas and
// forced each button to 64 CSS px without re-flowing: 10 (age 2) / 14 (age 5) controls ran off the bottom edge or sat
// under the top bar, and at most 38 % of any control could be tapped.
// Bug 2 (768x1024): the 64 px minimum grew each button from its top-left corner at scale 0.8, so neighbouring
// backgrounds, tools and crayons overlapped by ~5-7 px.
// Fix: src/ui/phoneChromeLayout.ts moves the controls beside the board on landscape phones and re-spaces only the
// overlapping rows on portrait tablets. Larger landscape and tablet sizes and phone portrait are unchanged.
// Real taps through the Art Studio building; no hooks that act; no screenshots (DOM geometry only).
//
// Orientation gating (docs/PROCESS.md section 4, @single-orientation): landscape viewports run in the landscape
// project only, portrait viewports in the portrait project only.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { enterWorldByTap } from './helpers/journey';
import { exactBoxes, expectHittableChrome, expectSameBoxes, fmt, probeStable, rowDirections, type Rect } from './helpers/phoneChromeCheck';
import { computeStickerBoardLayout, type UnitRect } from '../../src/games/stickers/layout';

const PORTRAIT_PROJECT = 'portrait-800x1280';
const LANDSCAPE_PROJECT = 'landscape-1280x800';
const LAYER = '.sticker-layer';
const CONTROLS = '.sticker-tool:not(.sticker-album-close), .sticker-crayon, .sticker-tray-btn, .sticker-request';
/** The top-bar buttons are probed too: the reflowed chrome must not cover them. */
const WITH_BAR = `${CONTROLS}, .shell-top-bar > button`;
const MIN_SIZE = 44;

const AGES = [
  { profile: 'profile-a', age: 'age2', crayons: 4, controls: 2 + 3 + 4 + 12 },
  { profile: 'profile-b', age: 'age5', crayons: 8, controls: 5 + 3 + 8 + 12 + 1 },
] as const;

function onlyProject(testInfo: TestInfo, projectName: string): void {
  if (testInfo.project.name !== projectName) test.skip();
}

async function enterBoard(page: Page, profile: 'profile-a' | 'profile-b'): Promise<void> {
  await enterWorldByTap(page, profile, 'art-studio');
  await expect.poll(() => page.evaluate(() => window.__testHooks__?.getStickerBoardInfo() ?? null) !== null, { timeout: 15_000 }).toBe(true);
}

async function boardRect(page: Page): Promise<Rect> {
  const b = await page.locator('[data-testid="sticker-board"]').boundingBox();
  if (!b) throw new Error('sticker-board overlay has no box');
  return b;
}

async function canvasRect(page: Page): Promise<Rect> {
  const c = await page.locator('#game-root canvas').boundingBox();
  if (!c) throw new Error('game canvas has no box');
  return c;
}

/** Game-layout box of each control: canvas box + game rect × scale, grown to the 64 px minimum (the unchanged path). */
function gameLayoutBoxes(canvas: Rect, ageTrack: 'age2' | 'age5', crayonCount: number, ids: readonly string[]): Map<string, Rect> {
  const landscape = canvas.width >= canvas.height;
  const g = computeStickerBoardLayout(landscape ? 1280 : 800, landscape ? 800 : 1280, ageTrack, crayonCount);
  const k = canvas.width / (landscape ? 1280 : 800);
  const map = (r: UnitRect): Rect => ({ x: canvas.x + r.x * k, y: canvas.y + r.y * k, width: Math.max(64, r.width * k), height: Math.max(64, r.height * k) });
  const out = new Map<string, Rect>();
  const byPrefix = (prefix: string) => ids.filter((id) => id.startsWith(prefix));
  byPrefix('sticker-bg-').forEach((id, i) => out.set(id, map(g.backgrounds[i])));
  byPrefix('sticker-crayon-').forEach((id, i) => out.set(id, map(g.crayons[i])));
  byPrefix('sticker-tray-').forEach((id, i) => out.set(id, map(g.tray[i])));
  out.set('sticker-undo', map(g.tools.undo));
  out.set('sticker-clear', map(g.tools.clear));
  if (g.tools.save) out.set('sticker-save', map(g.tools.save));
  if (g.tools.album) out.set('sticker-album', map(g.tools.album));
  if (g.tools.requestToggle) out.set('sticker-request-toggle', map(g.tools.requestToggle));
  if (g.requestBubble) out.set('sticker-request', map(g.requestBubble));
  return out;
}

const PHONES = [
  { width: 915, height: 412 },
  { width: 844, height: 390 },
  { width: 800, height: 360 },
] as const;

for (const viewport of PHONES) {
  test.describe(`sticker board chrome on a phone in landscape ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const a of AGES) {
      test(`[AC-15] ${a.age}: every control is hittable, on-screen, overlap-free and >= ${MIN_SIZE} px`, async ({ page }, testInfo) => {
        onlyProject(testInfo, LANDSCAPE_PROJECT);
        test.setTimeout(90_000);
        await enterBoard(page, a.profile);
        await expect.soft(page.locator(`${LAYER}[data-phone-landscape]`), 'landscape-phone reflow active').toHaveCount(1);
        const probes = await probeStable(page, LAYER, WITH_BAR, a.controls + 2);
        expectHittableChrome(probes, viewport, { minSize: MIN_SIZE, surface: await boardRect(page), mayCoverSurface: ['sticker-request'] });

        // Order: rows read left to right like the Sticker Board game layout and the phone-portrait reflow.
        const boxes = await exactBoxes(page, LAYER, CONTROLS);
        const crayonIds = probes.filter((p) => p.id.startsWith('sticker-crayon-')).map((p) => p.id);
        const trayIds = probes.filter((p) => p.id.startsWith('sticker-tray-')).map((p) => p.id);
        for (const ids of [crayonIds, trayIds]) expect.soft(new Set(rowDirections(boxes, ids)), `${ids[0]}… row order`).toEqual(new Set(['ltr']));

        // Behaviour, not only geometry: a real tap on each crayon's centre selects that crayon.
        for (const p of probes.filter((x) => x.id.startsWith('sticker-crayon-'))) {
          await page.touchscreen.tap(p.rect.x + p.rect.width / 2, p.rect.y + p.rect.height / 2);
          await expect.soft(page.locator(`[data-testid="${p.id}"]`), `tap on ${p.id} centre ${fmt(p.rect)}`).toHaveAttribute('aria-pressed', 'true');
        }
      });
    }
  });
}

test.describe('sticker board chrome on a tablet in portrait 768x1024 @single-orientation', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  for (const a of AGES) {
    test(`[AC-15] ${a.age}: crayons, backgrounds and tools no longer overlap; nothing else moves`, async ({ page }, testInfo) => {
      onlyProject(testInfo, PORTRAIT_PROJECT);
      test.setTimeout(90_000);
      await enterBoard(page, a.profile);
      const probes = await probeStable(page, LAYER, WITH_BAR, a.controls + 2);
      // The top-bar back pill overlaps the board corner by ~5 px at this size on main too (top bar, out of scope here).
      expectHittableChrome(probes, { width: 768, height: 1024 }, { minSize: 64, surface: await boardRect(page), mayCoverSurface: ['sticker-request', 'hud-back'] });
      // Neighbouring crayons: at least 8 px apart (they overlapped by ~5 px).
      const crayons = probes.filter((p) => p.id.startsWith('sticker-crayon-')).map((p) => p.layout).sort((p, q) => p.x - q.x);
      for (let i = 1; i < crayons.length; i++) {
        expect.soft(crayons[i].x - (crayons[i - 1].x + crayons[i - 1].width), `crayon gap ${i}`).toBeGreaterThanOrEqual(8 - 1);
      }
      // The tray keeps its game-layout boxes.
      const boxes = await exactBoxes(page, LAYER, CONTROLS);
      const tray = new Map([...gameLayoutBoxes(await canvasRect(page), a.age, a.crayons, [...boxes.keys()])].filter(([id]) => id.startsWith('sticker-tray-')));
      expect(expectSameBoxes(boxes, tray, '768x1024 tray')).toBe(12);
    });
  }
});

// Unchanged sizes: every control keeps its game-layout box (to 0.05 px) and no phone reflow is marked.
const UNCHANGED = [
  { viewport: { width: 1280, height: 800 }, project: LANDSCAPE_PROJECT },
  { viewport: { width: 1024, height: 768 }, project: LANDSCAPE_PROJECT },
  { viewport: { width: 800, height: 1280 }, project: PORTRAIT_PROJECT },
] as const;

for (const u of UNCHANGED) {
  test.describe(`sticker board chrome unchanged at ${u.viewport.width}x${u.viewport.height} @single-orientation`, () => {
    test.use({ viewport: u.viewport });

    for (const a of AGES) {
      test(`[AC-15] ${a.age}: every control keeps its game-layout box`, async ({ page }, testInfo) => {
        onlyProject(testInfo, u.project);
        test.setTimeout(90_000);
        await enterBoard(page, a.profile);
        await probeStable(page, LAYER, CONTROLS, a.controls);
        await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
        const boxes = await exactBoxes(page, LAYER, CONTROLS);
        const n = expectSameBoxes(boxes, gameLayoutBoxes(await canvasRect(page), a.age, a.crayons, [...boxes.keys()]), `${u.viewport.width}x${u.viewport.height}`);
        expect(n).toBe(a.controls);
      });
    }
  });
}

// Phone portrait keeps the #98 reflow: same fitted size, no landscape marker.
const PORTRAIT_SIZES = [
  { viewport: { width: 360, height: 800 }, sizes: { age2: '50', age5: '46' } },
  { viewport: { width: 412, height: 915 }, sizes: { age2: '59', age5: '54' } },
] as const;

for (const p of PORTRAIT_SIZES) {
  test.describe(`sticker board chrome phone portrait unchanged ${p.viewport.width}x${p.viewport.height} @single-orientation`, () => {
    test.use({ viewport: p.viewport, isMobile: true, hasTouch: true });

    for (const a of AGES) {
      test(`[AC-15] ${a.age}: the phone-portrait reflow keeps its size`, async ({ page }, testInfo) => {
        onlyProject(testInfo, PORTRAIT_PROJECT);
        test.setTimeout(90_000);
        await enterBoard(page, a.profile);
        await probeStable(page, LAYER, CONTROLS, a.controls);
        await expect(page.locator(LAYER)).toHaveAttribute('data-phone-chrome', p.sizes[a.age]);
        await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(0);
      });
    }
  });
}

test.describe('sticker board chrome survives landscape-phone rotation @single-orientation', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });

  test('landscape phone -> portrait tablet -> portrait phone -> landscape phone', async ({ page }, testInfo) => {
    onlyProject(testInfo, LANDSCAPE_PROJECT);
    test.setTimeout(90_000);
    const a = AGES[1];
    await enterBoard(page, a.profile);
    await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(1);

    await page.setViewportSize({ width: 800, height: 1280 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
    await probeStable(page, LAYER, CONTROLS, a.controls);
    const boxes = await exactBoxes(page, LAYER, CONTROLS);
    expectSameBoxes(boxes, gameLayoutBoxes(await canvasRect(page), a.age, a.crayons, [...boxes.keys()]), 'after rotation to 800x1280');
    const leaked = await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((n) => n.style.minWidth || n.style.minHeight).map((n) => n.dataset.testid), CONTROLS);
    expect.soft(leaked, 'inline min-size left over after rotation').toEqual([]);

    await page.setViewportSize({ width: 412, height: 915 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(1);
    await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(0);

    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(1);
    const probes = await probeStable(page, LAYER, WITH_BAR, a.controls + 2);
    expectHittableChrome(probes, { width: 915, height: 412 }, { minSize: MIN_SIZE, surface: await boardRect(page), mayCoverSurface: ['sticker-request'] });
  });
});

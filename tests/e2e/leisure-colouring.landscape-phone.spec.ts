// Regression spec for the Colouring Time chrome on a PHONE in landscape and on a TABLET in portrait (follow-up to the
// 2026-11-16 portrait audit; docs/specs/leisure-colouring.md AC-22 family).
// Bug 1 (915x412, 844x390, 800x360): the chrome mapped the 1280x800 game layout through the ~0.45-0.52x canvas and
// forced each swatch and tool to 64 CSS px without re-flowing: 8 controls ran off the bottom edge or sat under the
// top bar, and at age 5 only 7-17 % of the top swatch could be tapped.
// Bug 2 (768x1024): the 64 px minimum grew each swatch from its top-left corner at scale 0.8, so neighbouring swatches
// overlapped by ~6 px on both axes.
// Fix: src/ui/phoneChromeLayout.ts moves the tools and palette beside the page on landscape phones and re-spaces only
// the overlapping groups on portrait tablets. Larger landscape and tablet sizes and phone portrait are unchanged.
// Real taps through the Leisure Corner building and its picker card; no hooks that act; no screenshots.
//
// Orientation gating (docs/PROCESS.md section 4, @single-orientation): landscape viewports run in the landscape
// project only, portrait viewports in the portrait project only.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { enterWorldByTap, seedBalanceSec, waitForColouringReady } from './helpers/journey';
import { exactBoxes, expectHittableChrome, expectSameBoxes, fmt, probeStable, rowDirections, type Rect } from './helpers/phoneChromeCheck';
import { computeColouringLayout } from '../../src/games/colouring/layout';
import type { UnitRect } from '../../src/ui/colouringChrome';

const PORTRAIT_PROJECT = 'portrait-800x1280';
const LANDSCAPE_PROJECT = 'landscape-1280x800';
const LAYER = '.colouring-layer';
const CONTROLS = '.colouring-tool, .colouring-swatch';
/** The top-bar buttons are probed too: the reflowed chrome must not cover them. */
const WITH_BAR = `${CONTROLS}, .shell-top-bar > button`;
const MIN_SIZE = 44;

const AGES = [
  { profile: 'profile-a', age: 'age2', swatches: 8 },
  { profile: 'profile-b', age: 'age5', swatches: 16 },
] as const;

function onlyProject(testInfo: TestInfo, projectName: string): void {
  if (testInfo.project.name !== projectName) test.skip();
}

async function enterColouring(page: Page, profile: 'profile-a' | 'profile-b'): Promise<void> {
  // Seed-only, as in leisure-colouring.platform.spec.ts: a balance so the Leisure Corner picker offers Colouring Time.
  await enterWorldByTap(page, profile, 'leisure-corner', 'leisure-colouring', { beforeEnter: () => seedBalanceSec(page, 120) });
  await waitForColouringReady(page);
}

async function canvasRect(page: Page): Promise<Rect> {
  const c = await page.locator('#game-root canvas').boundingBox();
  if (!c) throw new Error('game canvas has no box');
  return c;
}

/** Game-layout box of each control: canvas box + game rect × scale, grown to the 64 px minimum (the unchanged path). */
function gameLayoutBoxes(canvas: Rect, swatchCount: number, ids: readonly string[]): Map<string, Rect> {
  const landscape = canvas.width >= canvas.height;
  const g = computeColouringLayout(landscape ? 1280 : 800, landscape ? 800 : 1280, swatchCount);
  const k = canvas.width / (landscape ? 1280 : 800);
  const map = (r: UnitRect): Rect => ({ x: canvas.x + r.x * k, y: canvas.y + r.y * k, width: Math.max(64, r.width * k), height: Math.max(64, r.height * k) });
  const out = new Map<string, Rect>();
  for (const kind of ['undo', 'clear', 'prev', 'next'] as const) out.set(`colouring-${kind}`, map(g.tools[kind]));
  ids.filter((id) => id.startsWith('colouring-swatch-')).forEach((id, i) => out.set(id, map(g.swatches[i])));
  return out;
}

const PHONES = [
  { width: 915, height: 412 },
  { width: 844, height: 390 },
  { width: 800, height: 360 },
] as const;

for (const viewport of PHONES) {
  test.describe(`colouring chrome on a phone in landscape ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const a of AGES) {
      test(`[AC-22] ${a.age}: every swatch and tool is hittable, on-screen, overlap-free and >= ${MIN_SIZE} px`, async ({ page }, testInfo) => {
        onlyProject(testInfo, LANDSCAPE_PROJECT);
        test.setTimeout(90_000);
        await enterColouring(page, a.profile);
        await expect.soft(page.locator(`${LAYER}[data-phone-landscape]`), 'landscape-phone reflow active').toHaveCount(1);
        const probes = await probeStable(page, LAYER, WITH_BAR, 4 + a.swatches + 2);
        expectHittableChrome(probes, viewport, { minSize: MIN_SIZE, surface: (await waitForColouringReady(page)).pageRect });

        // Order: the palette reads right to left (Hebrew chrome, as in the game layout).
        const boxes = await exactBoxes(page, LAYER, CONTROLS);
        const swatchIds = probes.filter((p) => p.id.startsWith('colouring-swatch-')).map((p) => p.id);
        expect.soft(new Set(rowDirections(boxes, swatchIds)), 'palette row order').toEqual(new Set(['rtl']));

        // Behaviour, not only geometry: a real tap on each swatch's centre selects that swatch.
        for (const p of probes.filter((x) => x.id.startsWith('colouring-swatch-'))) {
          await page.touchscreen.tap(p.rect.x + p.rect.width / 2, p.rect.y + p.rect.height / 2);
          await expect.soft(page.locator(`[data-testid="${p.id}"]`), `tap on ${p.id} centre ${fmt(p.rect)}`).toHaveAttribute('aria-pressed', 'true');
        }
      });
    }
  });
}

test.describe('colouring chrome on a tablet in portrait 768x1024 @single-orientation', () => {
  test.use({ viewport: { width: 768, height: 1024 } });

  for (const a of AGES) {
    test(`[AC-22] ${a.age}: swatches and tools no longer overlap and stay >= 64 px`, async ({ page }, testInfo) => {
      onlyProject(testInfo, PORTRAIT_PROJECT);
      test.setTimeout(90_000);
      await enterColouring(page, a.profile);
      const probes = await probeStable(page, LAYER, WITH_BAR, 4 + a.swatches + 2);
      // The top-bar back pill overlaps the page corner by ~5 px at this size on main too (top bar, out of scope here).
      expectHittableChrome(probes, { width: 768, height: 1024 }, { minSize: 64, surface: (await waitForColouringReady(page)).pageRect, mayCoverSurface: ['hud-back'] });
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
  test.describe(`colouring chrome unchanged at ${u.viewport.width}x${u.viewport.height} @single-orientation`, () => {
    test.use({ viewport: u.viewport });

    for (const a of AGES) {
      test(`[AC-22] ${a.age}: every swatch and tool keeps its game-layout box`, async ({ page }, testInfo) => {
        onlyProject(testInfo, u.project);
        test.setTimeout(90_000);
        await enterColouring(page, a.profile);
        await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
        await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
        const boxes = await exactBoxes(page, LAYER, CONTROLS);
        const n = expectSameBoxes(boxes, gameLayoutBoxes(await canvasRect(page), a.swatches, [...boxes.keys()]), `${u.viewport.width}x${u.viewport.height}`);
        expect(n).toBe(4 + a.swatches);
      });
    }
  });
}

// Phone portrait keeps the #98 reflow: same fitted size, no landscape marker.
const PORTRAIT_SIZES = [
  { viewport: { width: 360, height: 800 }, sizes: { age2: '64', age5: '62' } },
  { viewport: { width: 412, height: 915 }, sizes: { age2: '64', age5: '64' } },
] as const;

for (const p of PORTRAIT_SIZES) {
  test.describe(`colouring chrome phone portrait unchanged ${p.viewport.width}x${p.viewport.height} @single-orientation`, () => {
    test.use({ viewport: p.viewport, isMobile: true, hasTouch: true });

    for (const a of AGES) {
      test(`[AC-22] ${a.age}: the phone-portrait reflow keeps its size`, async ({ page }, testInfo) => {
        onlyProject(testInfo, PORTRAIT_PROJECT);
        test.setTimeout(90_000);
        await enterColouring(page, a.profile);
        await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
        await expect(page.locator(LAYER)).toHaveAttribute('data-phone-chrome', p.sizes[a.age]);
        await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(0);
      });
    }
  });
}

test.describe('colouring chrome survives landscape-phone rotation @single-orientation', () => {
  test.use({ viewport: { width: 915, height: 412 }, isMobile: true, hasTouch: true });

  test('landscape phone -> portrait tablet -> portrait phone -> landscape phone', async ({ page }, testInfo) => {
    onlyProject(testInfo, LANDSCAPE_PROJECT);
    test.setTimeout(90_000);
    const a = AGES[1];
    await enterColouring(page, a.profile);
    await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(1);

    await page.setViewportSize({ width: 800, height: 1280 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
    await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
    const boxes = await exactBoxes(page, LAYER, CONTROLS);
    expectSameBoxes(boxes, gameLayoutBoxes(await canvasRect(page), a.swatches, [...boxes.keys()]), 'after rotation to 800x1280');
    const leaked = await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((n) => n.style.minWidth || n.style.minHeight).map((n) => n.dataset.testid), `${CONTROLS}, .colouring-palette`);
    expect.soft(leaked, 'inline min-size left over after rotation').toEqual([]);

    await page.setViewportSize({ width: 412, height: 915 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(1);
    await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(0);

    await page.setViewportSize({ width: 915, height: 412 });
    await expect(page.locator(`${LAYER}[data-phone-landscape]`)).toHaveCount(1);
    const probes = await probeStable(page, LAYER, WITH_BAR, 4 + a.swatches + 2);
    expectHittableChrome(probes, { width: 915, height: 412 }, { minSize: MIN_SIZE, surface: (await waitForColouringReady(page)).pageRect });
  });
});

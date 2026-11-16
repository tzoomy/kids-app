// Regression spec for the Colouring Time chrome on a PHONE in portrait (portrait audit 2026-11-16, H2;
// docs/specs/leisure-colouring.md AC-22 family).
// Bug: the chrome mapped game-unit rects through the ~0.45x canvas and then forced each swatch and tool to 64 CSS px
// without re-flowing, so at 360x800 (age 5) the palette rows sat 32 px apart: a tap on red's centre picked brown and
// each top-row swatch was only ~25 % tappable; the tools were 36 px apart.
// Fix: src/ui/phoneChromeLayout.ts re-lays the chrome out from the CSS viewport on phones in portrait.
// Real taps through the Leisure Corner building and its picker card; no hooks that act; no screenshots.
//
// Orientation gating (docs/PROCESS.md section 4, @single-orientation): phone viewports run in the portrait project
// only; the landscape guard runs in the landscape project only.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { enterWorldByTap, seedBalanceSec, waitForColouringReady } from './helpers/journey';
import { expectHittableChrome, fmt, probeStable, TOLERANCE, type ControlProbe, type Rect } from './helpers/phoneChromeCheck';
import { computeColouringLayout } from '../../src/games/colouring/layout';
import type { UnitRect } from '../../src/ui/colouringChrome';

const PORTRAIT_PROJECT = 'portrait-800x1280';
const LANDSCAPE_PROJECT = 'landscape-1280x800';
const LAYER = '.colouring-layer';
const CONTROLS = '.colouring-tool, .colouring-swatch';
/** Floor at the phone sizes under test (fitted sizes measured: 62-64 px); 64 px wherever it fits. */
const PHONE_MIN_SIZE = 56;

const PHONE_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
] as const;

const AGES = [
  { profile: 'profile-a', age: 'age2', swatches: 8 },
  { profile: 'profile-b', age: 'age5', swatches: 16 },
] as const;

function onlyProject(testInfo: TestInfo, projectName: string): void {
  if (testInfo.project.name !== projectName) test.skip();
}

async function enterColouring(page: Page, profile: 'profile-a' | 'profile-b'): Promise<Rect> {
  // Seed-only, as in leisure-colouring.platform.spec.ts: a balance so the Leisure Corner picker offers Colouring Time.
  await enterWorldByTap(page, profile, 'leisure-corner', 'leisure-colouring', { beforeEnter: () => seedBalanceSec(page, 120) });
  return (await waitForColouringReady(page)).pageRect;
}

for (const viewport of PHONE_VIEWPORTS) {
  test.describe(`colouring chrome on a phone in portrait ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const a of AGES) {
      test(`[AC-22] ${a.age}: every swatch and tool is hittable, on-screen and overlap-free`, async ({ page }, testInfo) => {
        onlyProject(testInfo, PORTRAIT_PROJECT);
        test.setTimeout(90_000);
        await enterColouring(page, a.profile);
        await expect.soft(page.locator(`${LAYER}[data-phone-chrome]`), 'phone reflow active').toHaveCount(1);
        const probes = await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
        const pageRect = (await waitForColouringReady(page)).pageRect;
        expectHittableChrome(probes, viewport, { minSize: PHONE_MIN_SIZE, surface: pageRect });

        // Behaviour, not only geometry: a real tap on each swatch's centre selects that swatch (the bug picked a neighbour).
        for (const p of probes.filter((x) => x.id.startsWith('colouring-swatch-'))) {
          await page.touchscreen.tap(p.rect.x + p.rect.width / 2, p.rect.y + p.rect.height / 2);
          await expect.soft(page.locator(`[data-testid="${p.id}"]`), `tap on ${p.id} centre ${fmt(p.rect)}`).toHaveAttribute('aria-pressed', 'true');
        }
      });
    }
  });
}

/** Expected pre-fix (game layout) box of each control: canvas box + game rect × scale, grown to the 64 px minimum. */
function legacyBoxes(canvas: Rect, swatchCount: number, probes: readonly ControlProbe[]): Map<string, Rect> {
  const landscape = canvas.width >= canvas.height;
  const g = computeColouringLayout(landscape ? 1280 : 800, landscape ? 800 : 1280, swatchCount);
  const k = canvas.width / (landscape ? 1280 : 800);
  const map = (r: UnitRect): Rect => ({ x: canvas.x + r.x * k, y: canvas.y + r.y * k, width: Math.max(64, r.width * k), height: Math.max(64, r.height * k) });
  const out = new Map<string, Rect>();
  for (const kind of ['undo', 'clear', 'prev', 'next'] as const) out.set(`colouring-${kind}`, map(g.tools[kind]));
  probes.filter((p) => p.id.startsWith('colouring-swatch-')).forEach((p, i) => out.set(p.id, map(g.swatches[i])));
  return out;
}

const LANDSCAPE_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  // Landscape phones (915x412 and smaller) now reflow: see the *.landscape-phone.spec.ts regression spec.
] as const;

for (const viewport of LANDSCAPE_VIEWPORTS) {
  test.describe(`colouring chrome landscape guard ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport });

    for (const a of AGES) {
      test(`[AC-22] ${a.age}: landscape keeps the game layout (no phone reflow)`, async ({ page }, testInfo) => {
        onlyProject(testInfo, LANDSCAPE_PROJECT);
        test.setTimeout(90_000);
        const pageRect = await enterColouring(page, a.profile);
        const probes = await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
        await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
        const canvas = await page.locator('#game-root canvas').boundingBox();
        if (!canvas) throw new Error('game canvas has no box');
        const expected = legacyBoxes(canvas, a.swatches, probes);
        for (const p of probes) {
          const e = expected.get(p.id);
          expect.soft(e, `${p.id} has an expected game-layout box`).toBeDefined();
          if (!e) continue;
          for (const key of ['x', 'y', 'width', 'height'] as const) {
            expect.soft(Math.abs(p.layout[key] - e[key]), `${p.id} ${key}: ${fmt(p.layout)} vs game layout ${fmt(e)}`).toBeLessThanOrEqual(TOLERANCE);
          }
        }
        // The native tablet size is also fully hittable and overlap-free.
        if (viewport.width === 1280) expectHittableChrome(probes, viewport, { minSize: 64, surface: pageRect });
      });
    }
  });
}

test.describe('colouring chrome survives phone rotation @single-orientation', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

  test('portrait phone -> landscape tablet -> portrait phone: landscape gets the game layout back, portrait reflows again', async ({ page }, testInfo) => {
    onlyProject(testInfo, PORTRAIT_PROJECT);
    test.setTimeout(90_000);
    const a = AGES[1];
    await enterColouring(page, a.profile);
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(1);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
    let probes = await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
    const canvas = await page.locator('#game-root canvas').boundingBox();
    if (!canvas) throw new Error('game canvas has no box');
    const expected = legacyBoxes(canvas, a.swatches, probes);
    for (const p of probes) {
      const e = expected.get(p.id);
      if (!e) continue;
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect.soft(Math.abs(p.layout[key] - e[key]), `after rotation ${p.id} ${key}: ${fmt(p.layout)} vs game layout ${fmt(e)}`).toBeLessThanOrEqual(TOLERANCE);
      }
    }
    // No phone-only inline minimum may leak into landscape.
    const leaked = await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((n) => n.style.minWidth || n.style.minHeight).map((n) => n.dataset.testid), `${CONTROLS}, .colouring-palette`);
    expect.soft(leaked, 'inline min-size left over after rotation').toEqual([]);

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(1);
    probes = await probeStable(page, LAYER, CONTROLS, 4 + a.swatches);
    expectHittableChrome(probes, { width: 360, height: 800 }, { minSize: PHONE_MIN_SIZE, surface: (await waitForColouringReady(page)).pageRect });
  });
});

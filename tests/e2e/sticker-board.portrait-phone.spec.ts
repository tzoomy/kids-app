// Regression spec for the Sticker Board chrome on a PHONE in portrait (portrait audit 2026-11-16, H1;
// docs/specs/sticker-board.md AC-15 family).
// Bug: the chrome mapped game-unit rects through the ~0.45x canvas and then forced each button to 64 CSS px without
// re-flowing, so at 360x800 tools, crayons and tray sat 33 px apart while 64 px wide: rows overlapped, only 28-29 %
// of a crayon or of save/album could be tapped, and the space background button ran 19-24 px off the right edge.
// Fix: src/ui/phoneChromeLayout.ts re-lays the chrome out from the CSS viewport on phones in portrait.
// Real taps through the Art Studio building; no hooks that act; no screenshots (DOM geometry only).
//
// Orientation gating (docs/PROCESS.md section 4, @single-orientation): phone viewports run in the portrait project
// only; the landscape guard runs in the landscape project only.
import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { enterWorldByTap } from './helpers/journey';
import { expectHittableChrome, fmt, probeStable, TOLERANCE, type ControlProbe, type Rect } from './helpers/phoneChromeCheck';
import { computeStickerBoardLayout, type UnitRect } from '../../src/games/stickers/layout';

const PORTRAIT_PROJECT = 'portrait-800x1280';
const LANDSCAPE_PROJECT = 'landscape-1280x800';
const LAYER = '.sticker-layer';
const CONTROLS = '.sticker-tool:not(.sticker-album-close), .sticker-crayon, .sticker-tray-btn, .sticker-request';
/** Floor at the phone sizes under test (fitted sizes measured: 46-59 px); 64 px wherever it fits. */
const PHONE_MIN_SIZE = 44;

const PHONE_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
] as const;

const AGES = [
  // tools + backgrounds + crayons + tray (+ request bubble at age 5)
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

for (const viewport of PHONE_VIEWPORTS) {
  test.describe(`sticker board chrome on a phone in portrait ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport, isMobile: true, hasTouch: true });

    for (const a of AGES) {
      test(`[AC-15] ${a.age}: every tool, background, crayon and tray button is hittable, on-screen and overlap-free`, async ({ page }, testInfo) => {
        onlyProject(testInfo, PORTRAIT_PROJECT);
        test.setTimeout(90_000);
        await enterBoard(page, a.profile);
        await expect.soft(page.locator(`${LAYER}[data-phone-chrome]`), 'phone reflow active').toHaveCount(1);
        const probes = await probeStable(page, LAYER, CONTROLS, a.controls);
        expectHittableChrome(probes, viewport, {
          minSize: PHONE_MIN_SIZE,
          surface: await boardRect(page),
          // The age-5 request bubble sits on the board's top edge in every layout (unchanged by this fix).
          mayCoverSurface: ['sticker-request'],
        });

        // Behaviour, not only geometry: a real tap on each crayon's centre selects that crayon.
        for (const p of probes.filter((x) => x.id.startsWith('sticker-crayon-'))) {
          await page.touchscreen.tap(p.rect.x + p.rect.width / 2, p.rect.y + p.rect.height / 2);
          await expect.soft(page.locator(`[data-testid="${p.id}"]`), `tap on ${p.id} centre ${fmt(p.rect)}`).toHaveAttribute('aria-pressed', 'true');
        }
      });
    }
  });
}

/** Expected pre-fix (game layout) box of each control: canvas box + game rect × scale, grown to the 64 px minimum. */
function legacyBoxes(canvas: Rect, ageTrack: 'age2' | 'age5', crayonCount: number, probes: readonly ControlProbe[]): Map<string, Rect> {
  const g = computeStickerBoardLayout(canvas.width >= canvas.height ? 1280 : 800, canvas.width >= canvas.height ? 800 : 1280, ageTrack, crayonCount);
  const k = canvas.width / (canvas.width >= canvas.height ? 1280 : 800);
  const map = (r: UnitRect): Rect => ({ x: canvas.x + r.x * k, y: canvas.y + r.y * k, width: Math.max(64, r.width * k), height: Math.max(64, r.height * k) });
  const out = new Map<string, Rect>();
  const byPrefix = (prefix: string) => probes.filter((p) => p.id.startsWith(prefix)).map((p) => p.id);
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

const LANDSCAPE_VIEWPORTS = [
  { width: 1280, height: 800 },
  { width: 1024, height: 768 },
  // Landscape phones (915x412 and smaller) now reflow: see the *.landscape-phone.spec.ts regression spec.
] as const;

for (const viewport of LANDSCAPE_VIEWPORTS) {
  test.describe(`sticker board chrome landscape guard ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport });

    for (const a of AGES) {
      test(`[AC-15] ${a.age}: landscape keeps the game layout (no phone reflow)`, async ({ page }, testInfo) => {
        onlyProject(testInfo, LANDSCAPE_PROJECT);
        test.setTimeout(90_000);
        await enterBoard(page, a.profile);
        const probes = await probeStable(page, LAYER, CONTROLS, a.controls);
        await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
        const canvas = await page.locator('#game-root canvas').boundingBox();
        if (!canvas) throw new Error('game canvas has no box');
        const expected = legacyBoxes(canvas, a.age, a.crayons, probes);
        for (const p of probes) {
          const e = expected.get(p.id);
          expect.soft(e, `${p.id} has an expected game-layout box`).toBeDefined();
          if (!e) continue;
          for (const key of ['x', 'y', 'width', 'height'] as const) {
            expect.soft(Math.abs(p.layout[key] - e[key]), `${p.id} ${key}: ${fmt(p.layout)} vs game layout ${fmt(e)}`).toBeLessThanOrEqual(TOLERANCE);
          }
        }
        // The native tablet size is also fully hittable and overlap-free.
        if (viewport.width === 1280) expectHittableChrome(probes, viewport, { minSize: 64, surface: await boardRect(page), mayCoverSurface: ['sticker-request'] });
      });
    }
  });
}

test.describe('sticker board chrome survives phone rotation @single-orientation', () => {
  test.use({ viewport: { width: 360, height: 800 }, isMobile: true, hasTouch: true });

  test('portrait phone -> landscape tablet -> portrait phone: landscape gets the game layout back, portrait reflows again', async ({ page }, testInfo) => {
    onlyProject(testInfo, PORTRAIT_PROJECT);
    test.setTimeout(90_000);
    const a = AGES[1];
    await enterBoard(page, a.profile);
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(1);

    await page.setViewportSize({ width: 1024, height: 768 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(0);
    let probes = await probeStable(page, LAYER, CONTROLS, a.controls);
    const canvas = await page.locator('#game-root canvas').boundingBox();
    if (!canvas) throw new Error('game canvas has no box');
    const expected = legacyBoxes(canvas, a.age, a.crayons, probes);
    for (const p of probes) {
      const e = expected.get(p.id);
      if (!e) continue;
      for (const key of ['x', 'y', 'width', 'height'] as const) {
        expect.soft(Math.abs(p.layout[key] - e[key]), `after rotation ${p.id} ${key}: ${fmt(p.layout)} vs game layout ${fmt(e)}`).toBeLessThanOrEqual(TOLERANCE);
      }
    }
    // No phone-only inline minimum may leak into landscape.
    const leaked = await page.evaluate((sel) => Array.from(document.querySelectorAll<HTMLElement>(sel)).filter((n) => n.style.minWidth || n.style.minHeight).map((n) => n.dataset.testid), `${CONTROLS}`);
    expect.soft(leaked, 'inline min-size left over after rotation').toEqual([]);

    await page.setViewportSize({ width: 360, height: 800 });
    await expect(page.locator(`${LAYER}[data-phone-chrome]`)).toHaveCount(1);
    probes = await probeStable(page, LAYER, CONTROLS, a.controls);
    expectHittableChrome(probes, { width: 360, height: 800 }, { minSize: PHONE_MIN_SIZE, surface: await boardRect(page), mayCoverSurface: ['sticker-request'] });
  });
});

import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { getStableBox } from './helpers/journey';

// Parent long-press gate (docs/specs/parent-longpress-gate.md, AC-09..AC-13).
// Real mouse input only: move to the button centre, press, wait, release. These tests deliberately run
// WITHOUT `?e2e=1` (the bypass would skip the multiplication gate) and use no seed/read hooks. They never
// take screenshots. Timing is measured on the Node side from just after `mouse.down()` resolves, so the page
// timer (started by the pointerdown) is always slightly ahead of our clock: "not yet open" checks stay
// well below 3000 ms and "open" checks wait with a generous timeout.

const LANDSCAPE = 'landscape-1280x800';
const GATE_BTN = '[data-testid="parent-gate-btn"]';
const PROGRESS = '[data-testid="parent-gate-progress"]';
const SETTINGS_EXIT = '[data-testid="parent-exit-btn"]';
const PROFILE_A = '[data-testid="profile-a"]';
const GATE_QUESTION = /כמה זה/;

function skipIfNotLandscape(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function openProfileSelect(page: Page): Promise<void> {
  // Relative to baseURL; no `?e2e=1` so the real multiplication gate is active.
  await page.goto('./');
  await expect(page.locator(PROFILE_A)).toBeVisible();
  await expect(page.locator(GATE_BTN)).toBeVisible();
}

/** Moves the real mouse to the centre of the parent button and presses. Returns the press time (Node clock). */
async function pressParentButton(page: Page): Promise<number> {
  const box = await getStableBox(page, 'parent-gate-btn');
  await page.mouse.move(box.x + box.width / 2, box.y + box.height / 2);
  await page.mouse.down();
  return Date.now();
}

async function waitUntilHeldFor(startedAt: number, heldMs: number): Promise<void> {
  const remaining = startedAt + heldMs - Date.now();
  if (remaining > 0) await new Promise((r) => setTimeout(r, remaining));
}

/** A quick real tap (well under the 500 ms tap threshold). */
async function shortPress(page: Page): Promise<void> {
  const startedAt = await pressParentButton(page);
  await waitUntilHeldFor(startedAt, 80);
  await page.mouse.up();
}

/** Reads "a × b" from the multiplication gate and returns the product. */
async function readGateAnswer(page: Page): Promise<number> {
  const question = page.getByText(GATE_QUESTION);
  await expect(question).toBeVisible();
  // Strip the invisible RLM / LRM direction marks (U+200F, U+200E) before parsing the digits.
  const text = (await question.innerText()).replace(/\u{200f}|\u{200e}/gu, '');
  const m = text.match(/(\d+)\s*[×x*]\s*(\d+)/) ?? text.match(/(\d+)\D+(\d+)/);
  if (!m) throw new Error(`cannot parse the gate question: "${text}"`);
  return Number(m[1]) * Number(m[2]);
}

test.describe('parent long-press gate (profile select + map HUD)', () => {
  test('[AC-09] real 3 s hold of the parent button opens the settings (not before) and never shows the multiplication question', async ({ page }) => {
    await openProfileSelect(page);

    const startedAt = await pressParentButton(page);

    await waitUntilHeldFor(startedAt, 2500);
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);

    // The hold completes at 3000 ms (page clock), i.e. at most ~500 ms after the 2.5 s check.
    await expect(page.locator(SETTINGS_EXIT)).toBeVisible({ timeout: 2_000 });
    expect(Date.now() - startedAt, 'settings must not open before the 3 s hold is done').toBeGreaterThanOrEqual(2900);
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);

    // Releasing afterwards must not open the multiplication gate either (trailing click is suppressed).
    await page.mouse.up();
    await page.waitForTimeout(600);
    await expect(page.locator(SETTINGS_EXIT)).toBeVisible();
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);
  });

  test('[AC-10] @single-orientation a short real press shows the multiplication gate; a correct answer opens the settings and cancel returns', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openProfileSelect(page);

    // Short press -> multiplication gate, settings stay closed.
    await shortPress(page);
    await expect(page.getByText(GATE_QUESTION)).toBeVisible();
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);

    // Cancel returns to profile select.
    await page.getByRole('button', { name: 'ביטול' }).click();
    await expect(page.locator(PROFILE_A)).toBeVisible();
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);

    // Short press again, answer correctly -> parent settings.
    await shortPress(page);
    const answer = await readGateAnswer(page);
    await page.locator('input[type="number"]').fill(String(answer));
    await page.getByRole('button', { name: 'כניסה' }).click();
    await expect(page.locator(SETTINGS_EXIT)).toBeVisible();
  });

  test('[AC-11] @single-orientation progress shows on the button while held, its aria-valuenow grows, and it is gone after release', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openProfileSelect(page);
    await expect(page.locator(PROGRESS)).toHaveCount(0);

    const startedAt = await pressParentButton(page);
    const bar = page.locator(PROGRESS);
    await expect(bar).toBeVisible({ timeout: 1_000 });
    await expect(bar).toHaveAttribute('role', 'progressbar');

    await waitUntilHeldFor(startedAt, 600);
    const early = Number(await bar.getAttribute('aria-valuenow'));
    await waitUntilHeldFor(startedAt, 1600);
    const later = Number(await bar.getAttribute('aria-valuenow'));
    expect(later, `aria-valuenow should grow while held (early ${early}, later ${later})`).toBeGreaterThan(early);
    expect(later).toBeGreaterThan(0);
    expect(later).toBeLessThan(100);

    // Release after 1.6 s: cancelled hold, so the bar goes away and nothing opens.
    await page.mouse.up();
    await expect(bar).toHaveCount(0);
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);
  });

  test('[AC-12] @single-orientation releasing after 1.5 s opens nothing, and the very next short press opens the multiplication gate', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openProfileSelect(page);

    const startedAt = await pressParentButton(page);
    await waitUntilHeldFor(startedAt, 1500);
    await page.mouse.up();

    // Nothing opens: not the settings, not the multiplication gate (the trailing click is suppressed).
    await page.waitForTimeout(700);
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);
    await expect(page.locator(PROFILE_A)).toBeVisible();
    await expect(page.locator(PROGRESS)).toHaveCount(0);

    // No lockout: the next short press works at once.
    await shortPress(page);
    await expect(page.getByText(GATE_QUESTION)).toBeVisible();
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);
  });

  test('[AC-12] @single-orientation a second pointer landing off the button during a real hold cancels it: nothing opens after 3 s', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openProfileSelect(page);

    const startedAt = await pressParentButton(page);
    await waitUntilHeldFor(startedAt, 1000);

    // A second finger / resting palm lands on the page, away from the button. A bubbling PointerEvent on
    // <body> with a different pointerId (not a test hook): the page sees it like a real second touch.
    await page.evaluate(() => {
      document.body.dispatchEvent(
        new PointerEvent('pointerdown', {
          pointerId: 42,
          isPrimary: false,
          pointerType: 'touch',
          button: 0,
          clientX: 5,
          clientY: 5,
          bubbles: true,
          cancelable: true,
        }),
      );
    });

    await waitUntilHeldFor(startedAt, 3500);
    await page.waitForTimeout(300);
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);
    await expect(page.locator(PROFILE_A)).toBeVisible();
    await expect(page.locator(PROGRESS)).toHaveCount(0);

    await page.mouse.up();
  });

  test('[AC-13] @single-orientation the same 3 s hold works on the map HUD button after picking a profile', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    await openProfileSelect(page);

    // Real tap on the profile; the map chrome (switch-profile-btn) marks that the map is up. No hooks without ?e2e=1.
    await page.locator(PROFILE_A).click();
    await expect(page.locator('[data-testid="switch-profile-btn"]')).toBeVisible({ timeout: 15_000 });
    await expect(page.locator(PROFILE_A)).toHaveCount(0);

    const startedAt = await pressParentButton(page);
    await waitUntilHeldFor(startedAt, 2500);
    await expect(page.locator(SETTINGS_EXIT)).toHaveCount(0);
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);

    await expect(page.locator(SETTINGS_EXIT)).toBeVisible({ timeout: 5_000 });
    expect(Date.now() - startedAt, 'settings must not open before the 3 s hold is done').toBeGreaterThanOrEqual(2900);
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);

    await page.mouse.up();
    await page.waitForTimeout(600);
    await expect(page.locator(SETTINGS_EXIT)).toBeVisible();
    await expect(page.getByText(GATE_QUESTION)).toHaveCount(0);
  });
});

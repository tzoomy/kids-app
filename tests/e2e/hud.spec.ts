import { test, expect } from '@playwright/test';
import { enterWorldByTap, getStableBox } from './helpers/journey';

// Shared HUD pills must meet the owner's 64 CSS px minimum tap target in both Playwright orientations
// (1280x800 and 800x1280). Both games are reached by real taps through the Language House picker.

const MIN_TAP = 64;

for (const gameId of ['animal-restaurant', 'kitchen-orchestra'] as const) {
  test(`HUD back and help buttons are at least 64x64 CSS px in ${gameId}`, async ({ page }) => {
    await enterWorldByTap(page, 'profile-a', 'language-house', gameId);
    const vp = page.viewportSize()!;
    for (const id of ['hud-back', 'hud-help']) {
      const box = await getStableBox(page, id);
      expect(box.width, `${id} width in ${gameId}`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.height, `${id} height in ${gameId}`).toBeGreaterThanOrEqual(MIN_TAP);
      expect(box.x, `${id} inside viewport (left)`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${id} inside viewport (top)`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} inside viewport (right)`).toBeLessThanOrEqual(vp.width + 0.5);
    }
    // The other HUD pills (stars, leisure balance) use the same shared pill style.
    for (const id of ['star-count', 'leisure-balance']) {
      const box = await getStableBox(page, id);
      expect(box.height, `${id} height in ${gameId}`).toBeGreaterThanOrEqual(MIN_TAP);
    }
  });
}

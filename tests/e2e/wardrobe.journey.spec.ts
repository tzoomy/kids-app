// Wardrobe (docs/specs/wardrobe.md), Pass 1. Real taps only; ?e2e=1 hooks only seed or read state.
// RED until the wardrobe-btn HUD button, WardrobeScene, the item buttons and the three hooks exist.
import { test, expect, type Page } from '@playwright/test';
import {
  enterMapByTap,
  getActiveScenes,
  getStableBox,
  getWardrobeInfo,
  openWardrobeByTap,
  recordCompletedRound,
  seedWardrobeState,
  tapTestId,
  tapWardrobeButton,
  tapWardrobeItem,
  waitForScene,
  waitForWardrobe,
  waitForWardrobeReady,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;
const AGE2_IDS = ['beanie', 'flower-clip', 'party-hat', 'scarf'];
const AGE5_ONLY_IDS = ['crown', 'glasses', 'hair-bow', 'sun-hat'];
const ALL_IDS = [...AGE2_IDS, ...AGE5_ONLY_IDS].sort();

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

const itemButton = (page: Page, id: string) => page.locator(`[data-testid="wardrobe-item-${id}"]`);

test.describe('wardrobe', () => {
  test('[AC-01] full real-tap journey: profile -> map -> wardrobe button -> starter flower-clip on the character -> back to the map', async ({ page }) => {
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');
    await expect(page.locator('[data-testid="wardrobe-btn"]')).toBeVisible();

    const opened = await tapWardrobeButton(page);
    expect(opened.character).toBe('bear');
    expect(opened.ageTrack).toBe('age2');
    expect(opened.unlocked).toEqual(['flower-clip']);
    expect(opened.worn).toEqual({});
    expect(opened.rendered).toEqual([]);
    await expect(itemButton(page, 'flower-clip')).toHaveAttribute('data-locked', 'false');

    await tapWardrobeItem(page, 'flower-clip');
    const dressed = await waitForWardrobe(page, (i) => i.worn.headSide === 'flower-clip', 'flower-clip was not put on');
    expect(dressed.rendered).toEqual(['flower-clip']);
    await expect(itemButton(page, 'flower-clip')).toHaveAttribute('data-worn', 'true');

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('WardrobeScene');
    // The outfit was saved: it is readable on the map without the scene.
    expect((await getWardrobeInfo(page))?.worn).toEqual({ headSide: 'flower-clip' });
  });

  test('[AC-02] @single-orientation one item per slot: a second item replaces the first, tapping the worn item removes it, head and headSide are worn together, the scarf draws last', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await openWardrobeByTap(page, 'profile-a', {
      beforeEnter: () => seedWardrobeState(page, { unlocked: ['beanie', 'party-hat', 'scarf'] }),
    });

    await tapWardrobeItem(page, 'beanie');
    await waitForWardrobe(page, (i) => i.worn.head === 'beanie', 'beanie was not put on');

    // Same slot: party-hat replaces beanie.
    await tapWardrobeItem(page, 'party-hat');
    const replaced = await waitForWardrobe(page, (i) => i.worn.head === 'party-hat', 'party-hat did not replace beanie');
    expect(replaced.rendered).toEqual(['party-hat']);
    await expect(itemButton(page, 'beanie')).toHaveAttribute('data-worn', 'false');
    await expect(itemButton(page, 'party-hat')).toHaveAttribute('data-worn', 'true');

    // head + headSide together.
    await tapWardrobeItem(page, 'flower-clip');
    const both = await waitForWardrobe(page, (i) => i.worn.headSide === 'flower-clip', 'flower-clip was not put on');
    expect(both.worn.head).toBe('party-hat');
    expect(both.rendered).toEqual(['party-hat', 'flower-clip']);

    // The scarf is in front of the head group: it is drawn last.
    await tapWardrobeItem(page, 'scarf');
    const scarfed = await waitForWardrobe(page, (i) => i.worn.neck === 'scarf', 'scarf was not put on');
    expect(scarfed.rendered).toEqual(['party-hat', 'flower-clip', 'scarf']);

    // Tapping the worn item takes it off; the others stay on.
    await tapWardrobeItem(page, 'party-hat');
    const removed = await waitForWardrobe(page, (i) => i.worn.head === undefined, 'party-hat was not taken off');
    expect(removed.worn).toEqual({ headSide: 'flower-clip', neck: 'scarf' });
    expect(removed.rendered).toEqual(['flower-clip', 'scarf']);
  });

  test('[AC-05] @single-orientation after a completed Language House round beanie is unlocked and wearable; the other profile is unchanged', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a');

    // Before the round: beanie is offered but locked, and tapping it does nothing.
    await tapWardrobeButton(page);
    await expect(itemButton(page, 'beanie')).toHaveAttribute('data-locked', 'true');
    await tapWardrobeItem(page, 'beanie');
    expect((await getWardrobeInfo(page))?.worn).toEqual({});
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');

    // The public record-round API (the one the games call) unlocks it.
    const unlockedNow = await recordCompletedRound(page, 'language-house', 'animal-restaurant');
    expect(unlockedNow).toEqual(['beanie']);
    expect((await getWardrobeInfo(page))?.unlocked.sort()).toEqual(['beanie', 'flower-clip']);

    await tapWardrobeButton(page);
    await expect(itemButton(page, 'beanie')).toHaveAttribute('data-locked', 'false');
    await tapWardrobeItem(page, 'beanie');
    const worn = await waitForWardrobe(page, (i) => i.worn.head === 'beanie', 'beanie was not put on after unlocking');
    expect(worn.rendered).toEqual(['beanie']);

    // The other profile did not get it.
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    await tapTestId(page, 'switch-profile-btn');
    await page.locator('[data-testid="profile-b"]').click();
    await waitForWardrobe(page, (i) => i.ageTrack === 'age5', 'the map did not switch to profile b');
    const other = await tapWardrobeButton(page);
    expect(other.unlocked).toEqual(['flower-clip']);
    expect(other.worn).toEqual({});
    await expect(itemButton(page, 'beanie')).toHaveAttribute('data-locked', 'true');
  });

  test('[AC-06] @single-orientation age 2 sees only the age-2 items; age-5-only items are not shown even when seeded as unlocked', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await openWardrobeByTap(page, 'profile-a', {
      beforeEnter: () => seedWardrobeState(page, { unlocked: ALL_IDS }),
    });
    expect(info.ageTrack).toBe('age2');
    expect([...info.offered].sort()).toEqual(AGE2_IDS);
    for (const id of AGE2_IDS) await expect(itemButton(page, id)).toHaveCount(1);
    for (const id of AGE5_ONLY_IDS) await expect(itemButton(page, id)).toHaveCount(0);
  });

  test('[AC-06] @single-orientation age 5 is offered all 8 items and can wear unlocked age-5 items', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    const info = await openWardrobeByTap(page, 'profile-b', {
      beforeEnter: () => seedWardrobeState(page, { unlocked: ALL_IDS }),
    });
    expect(info.ageTrack).toBe('age5');
    expect([...info.offered].sort()).toEqual(ALL_IDS);

    await tapWardrobeItem(page, 'crown');
    await tapWardrobeItem(page, 'glasses');
    await tapWardrobeItem(page, 'hair-bow');
    const dressed = await waitForWardrobe(
      page,
      (i) => i.worn.head === 'crown' && i.worn.eyes === 'glasses' && i.worn.headSide === 'hair-bow',
      'age-5 items were not put on',
    );
    expect(dressed.rendered).toEqual(['glasses', 'crown', 'hair-bow']);
  });

  test('[AC-08] @single-orientation an unlock shows the toast: one round away, then the completing round', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    // Two different Language House games are done: the third unlocks the sun-hat.
    await enterMapByTap(page, 'profile-b', {
      beforeEnter: () =>
        seedWardrobeState(page, {
          unlocked: ['beanie'],
          completed: { 'language-house': ['animal-restaurant', 'kitchen-orchestra'] },
        }),
    });
    const toast = page.locator('[data-testid="wardrobe-unlock-toast"]');
    await expect(toast).toHaveCount(0);

    const unlockedNow = await recordCompletedRound(page, 'language-house', 'letter-monster');
    expect(unlockedNow).toEqual(['sun-hat']);
    await expect(toast).toBeVisible();
    await expect(toast).toHaveAttribute('data-items', 'sun-hat');
    expect(((await toast.textContent()) ?? '').trim().length).toBeGreaterThan(0);
    expect((await getWardrobeInfo(page))?.lastUnlock).toEqual(['sun-hat']);

    // It goes away by itself, and a round that unlocks nothing shows no toast.
    await expect(toast).toHaveCount(0, { timeout: 10_000 });
    expect(await recordCompletedRound(page, 'language-house', 'letter-monster')).toEqual([]);
    await expect(toast).toHaveCount(0);

    // The new item is wearable.
    await tapWardrobeButton(page);
    await expect(itemButton(page, 'sun-hat')).toHaveAttribute('data-locked', 'false');
  });

  test('[AC-09] smoke: usable in both orientations; item buttons are at least 64 CSS px and inside the viewport', async ({ page }) => {
    test.setTimeout(60_000);
    await openWardrobeByTap(page, 'profile-b', {
      beforeEnter: () => seedWardrobeState(page, { unlocked: ALL_IDS }),
    });
    const vp = page.viewportSize()!;
    await expect(page.locator('canvas')).toBeVisible();
    for (const id of ALL_IDS) {
      const box = await getStableBox(page, `wardrobe-item-${id}`);
      expect(box.width, `${id} width`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(box.height, `${id} height`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(box.x, `${id} x`).toBeGreaterThanOrEqual(0);
      expect(box.y, `${id} y`).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, `${id} right edge`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(box.y + box.height, `${id} bottom edge`).toBeLessThanOrEqual(vp.height + 0.5);
    }
    await tapWardrobeItem(page, 'crown');
    await waitForWardrobe(page, (i) => i.worn.head === 'crown', 'crown was not put on');
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
  });

  test('[AC-10] @single-orientation works offline: after the cache is warm the Wardrobe opens and an item goes on', async ({ page, context }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(90_000);
    await page.goto('./?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    // The service worker must be installed and active; otherwise the offline part proves nothing.
    const sw = await page.evaluate(async () => {
      if (!('serviceWorker' in navigator)) return 'no service worker support';
      const timeout = new Promise<string>((resolve) => setTimeout(() => resolve('serviceWorker.ready timed out'), 30_000));
      return Promise.race([navigator.serviceWorker.ready.then((reg) => (reg.active ? 'ready' : 'no active worker')), timeout]);
    });
    expect(sw).toBe('ready');
    await page.reload();
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();

    await context.setOffline(true);
    await page.reload({ waitUntil: 'domcontentloaded' });
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible({ timeout: 15_000 });
    await page.locator('[data-testid="profile-a"]').click();
    await waitForScene(page, 'MapScene');
    await tapWardrobeButton(page);
    await tapWardrobeItem(page, 'flower-clip');
    await waitForWardrobe(page, (i) => i.worn.headSide === 'flower-clip', 'flower-clip was not put on offline');
    expect((await waitForWardrobeReady(page)).rendered).toEqual(['flower-clip']);
    await context.setOffline(false);
  });
});

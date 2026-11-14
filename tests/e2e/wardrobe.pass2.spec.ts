// Wardrobe Pass 2 (docs/specs/wardrobe.md AC-14..AC-16): the bear wears the current profile's outfit on the
// map and in games. Real taps only; ?e2e=1 hooks only seed or read state. No screenshots, no goToScreen.
// RED until: the map bear mascot, the dress helper call sites, and the hooks getVisibleBearOutfits,
// seedWardrobeStateForProfile and seedRestaurantKind exist.
// getVisibleBearOutfits reads the accessories actually mounted on the bear Characters. Do not replace it with
// getWardrobeInfo().rendered: that is computed from saved state even when nothing is drawn (false green).
import { test, expect } from '@playwright/test';
import {
  enterMapByTap,
  getActiveScenes,
  getBuildingHit,
  getVisibleBearOutfits,
  seedRestaurantKind,
  seedWardrobeState,
  seedWardrobeStateForProfile,
  tapBuildingOnMap,
  tapTestId,
  tapWardrobeButton,
  tapWardrobeItem,
  waitForBearOutfit,
  waitForRoundReady,
  waitForScene,
  waitForWardrobe,
  type PageRect,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const BUILDING_IDS = ['language-house', 'number-garden', 'nature-lab', 'science-world', 'art-studio', 'leisure-corner'];

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

function overlaps(a: PageRect, b: PageRect): boolean {
  return a.x < b.x + b.width && b.x < a.x + a.width && a.y < b.y + b.height && b.y < a.y + a.height;
}

test.describe('wardrobe pass 2: the outfit on the bear', () => {
  test('[AC-14] the saved outfit shows on the map bear, the map bear does nothing and hides no building, and the outfit shows on the bear in Animal Restaurant', async ({ page }) => {
    test.setTimeout(90_000);
    // Seed BEFORE the profile tap so MapScene is created with the outfit already saved.
    await enterMapByTap(page, 'profile-a', {
      beforeProfileTap: () => seedWardrobeStateForProfile(page, 'a', { unlocked: ['beanie'], outfit: { head: 'beanie' } }),
    });

    // The accessories are mounted on the map bear itself (not just present in saved state).
    const mapBear = await waitForBearOutfit(page, 'MapScene', ['beanie']);
    expect((await getVisibleBearOutfits(page)).filter((b) => b.scene === 'MapScene')).toHaveLength(1);

    // The mascot is decorative: it overlaps no building hit target, and a real tap on it does nothing.
    expect(mapBear.rect, 'the map bear reports its page bounds').not.toBeNull();
    const bearRect = mapBear.rect as PageRect;
    expect(bearRect.width).toBeGreaterThan(0);
    for (const id of BUILDING_IDS) {
      const hit = await getBuildingHit(page, id);
      if (hit) expect(overlaps(bearRect, hit), `the map bear overlaps the ${id} building`).toBe(false);
    }
    await page.mouse.click(bearRect.x + bearRect.width / 2, bearRect.y + bearRect.height / 2);
    await page.waitForTimeout(600);
    const afterBearTap = await getActiveScenes(page);
    expect(afterBearTap).toContain('MapScene');
    expect(afterBearTap).not.toContain('WardrobeScene');

    // Into a game by real taps: the next Animal Restaurant customer is the bear.
    await seedRestaurantKind(page, 'bear');
    await tapBuildingOnMap(page, 'language-house');
    await tapTestId(page, 'game-picker-animal-restaurant');
    await waitForScene(page, 'RestaurantScene');
    await waitForRoundReady(page);

    const inGame = await waitForBearOutfit(page, 'RestaurantScene', ['beanie']);
    expect(inGame.items).toEqual(['beanie']);
  });

  test('[AC-15] @single-orientation a change made in the Wardrobe shows on the map bear when you return', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a', {
      beforeEnter: () => seedWardrobeState(page, { unlocked: ['beanie', 'scarf'] }),
    });
    // Nothing is worn yet: the map bear exists and is undressed.
    await waitForBearOutfit(page, 'MapScene', []);

    await tapWardrobeButton(page);
    await tapWardrobeItem(page, 'beanie');
    await waitForWardrobe(page, (i) => i.worn.head === 'beanie', 'beanie was not put on');
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    await waitForBearOutfit(page, 'MapScene', ['beanie']);

    // And taking it off shows on the map too; the scarf (drawn last) goes on next.
    await tapWardrobeButton(page);
    await tapWardrobeItem(page, 'beanie');
    await tapWardrobeItem(page, 'scarf');
    await waitForWardrobe(page, (i) => i.worn.head === undefined && i.worn.neck === 'scarf', 'outfit was not changed');
    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    await waitForBearOutfit(page, 'MapScene', ['scarf']);
  });

  test('[AC-16] @single-orientation switching profiles shows that profile\'s outfit on the map bear', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterMapByTap(page, 'profile-a', {
      beforeProfileTap: async () => {
        await seedWardrobeStateForProfile(page, 'a', { unlocked: ['beanie'], outfit: { head: 'beanie' } });
        await seedWardrobeStateForProfile(page, 'b', { unlocked: ['scarf'], outfit: { neck: 'scarf' } });
      },
    });
    await waitForBearOutfit(page, 'MapScene', ['beanie']);

    await tapTestId(page, 'switch-profile-btn');
    await page.locator('[data-testid="profile-b"]').click();
    await waitForScene(page, 'MapScene');
    await waitForBearOutfit(page, 'MapScene', ['scarf']);
    const whileB = await getVisibleBearOutfits(page);
    expect(whileB.flatMap((b) => b.items), "profile a's beanie must not leak to profile b").not.toContain('beanie');

    await tapTestId(page, 'switch-profile-btn');
    await page.locator('[data-testid="profile-a"]').click();
    await waitForScene(page, 'MapScene');
    await waitForBearOutfit(page, 'MapScene', ['beanie']);
    const whileA = await getVisibleBearOutfits(page);
    expect(whileA.flatMap((b) => b.items), "profile b's scarf must not leak to profile a").not.toContain('scarf');
  });
});

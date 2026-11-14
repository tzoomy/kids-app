// Picnic Train Pass 1, TDD step 1: real-tap acceptance tests (docs/specs/picnic-train.md, docs/PROCESS.md section 4).
// Every test enters through the Number Garden building and its picker card (enterWorldByTap), then taps rectangles read from
// getPicnicInfo with real pointer clicks. Hooks only seed (level, balance, language) or read state. No goToScreen.
// profile-a is the age-2 track (starts at L2, idle hint after 6 s); profile-b is the age-5 track (starts at L5, no idle hint).
import { test, expect, type TestInfo } from '@playwright/test';
import {
  enterWorldByTap,
  getActiveScenes,
  getSpokenLines,
  readBalanceSec,
  readStarCount,
  waitForScene,
  waitForSpokenLine,
} from './helpers/journey';
import {
  enterPicnic,
  getPicnicInfo,
  giveToNextFree,
  loadOne,
  playTrain,
  readStoredPicnicSkill,
  servedCount,
  tapCard,
  tapGo,
  tapRect,
  waitForPicnic,
  waitForPicnicReady,
  type PageRect,
} from './helpers/picnic';

const LANDSCAPE = 'landscape-1280x800';

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function landscapeOnly(testInfo: TestInfo): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

test.describe('picnic train: map journey', () => {
  test('[AC-01] real-tap journey: profile -> Number Garden building -> picker card -> Picnic Train -> one train -> back to the map', async ({ page }) => {
    test.setTimeout(90_000);
    await enterWorldByTap(page, 'profile-a', 'number-garden', 'picnic-train', {
      beforeEnter: async () => {
        // Still on the map: the game only starts from this world's building.
        expect(await getActiveScenes(page)).toContain('MapScene');
        expect(await getActiveScenes(page)).not.toContain('PicnicScene');
      },
    });
    const scenes = await getActiveScenes(page);
    expect(scenes).toContain('PicnicScene');
    expect(scenes).not.toContain('MapScene');

    const first = await waitForPicnicReady(page);
    expect(first.passengers.length).toBeGreaterThanOrEqual(2);
    expect(await readStarCount(page)).toBe(0);

    await playTrain(page);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(1);

    await page.locator('[data-testid="hud-back"]').click();
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('PicnicScene');
  });

  test('[AC-11] smoke: playable at the current viewport, with tap targets of at least 64 CSS px inside the screen', async ({ page }) => {
    test.setTimeout(90_000);
    await enterPicnic(page, 'profile-a');
    const info = await waitForPicnicReady(page);
    const viewport = page.viewportSize();
    if (!viewport) throw new Error('no viewport');

    const targets: Array<[string, PageRect]> = [
      ...info.passengers.filter((p) => p.visible).map((p): [string, PageRect] => [p.id, p.hit]),
      ['basket', info.basket!.hit],
    ];
    expect(info.passengers.filter((p) => p.visible).length).toBe(info.passengers.length);
    for (const [name, hit] of targets) {
      expect(hit.width, `${name} width`).toBeGreaterThanOrEqual(64);
      expect(hit.height, `${name} height`).toBeGreaterThanOrEqual(64);
      expect(hit.x, `${name} left`).toBeGreaterThanOrEqual(0);
      expect(hit.y, `${name} top`).toBeGreaterThanOrEqual(0);
      expect(hit.x + hit.width, `${name} right`).toBeLessThanOrEqual(viewport.width);
      expect(hit.y + hit.height, `${name} bottom`).toBeLessThanOrEqual(viewport.height);
    }
    // Playable: one real tap on a free passenger gives an item.
    await giveToNextFree(page);
    const next = await getPicnicInfo(page);
    expect(servedCount(next!)).toBeGreaterThanOrEqual(1);
  });

  test('[AC-11] smoke: the load task (basket, shelf and go flag) fits the viewport too', async ({ page }) => {
    test.setTimeout(90_000);
    await enterPicnic(page, 'profile-b', { level: 5 });
    const info = await waitForPicnicReady(page);
    const viewport = page.viewportSize()!;
    expect(info.task).toBe('load');
    for (const [name, hit] of [['basket', info.basket!.hit], ['go', info.go!.hit]] as Array<[string, PageRect]>) {
      expect(hit.width, `${name} width`).toBeGreaterThanOrEqual(64);
      expect(hit.height, `${name} height`).toBeGreaterThanOrEqual(64);
      expect(hit.x).toBeGreaterThanOrEqual(0);
      expect(hit.y).toBeGreaterThanOrEqual(0);
      expect(hit.x + hit.width).toBeLessThanOrEqual(viewport.width);
      expect(hit.y + hit.height).toBeLessThanOrEqual(viewport.height);
    }
    await loadOne(page);
    const after = await getPicnicInfo(page);
    expect(after!.loaded).toBe(1);
    expect(after!.cargoHits).toHaveLength(1);
    const cargo = after!.cargoHits[0];
    expect(cargo.width).toBeGreaterThanOrEqual(64);
    expect(cargo.x + cargo.width).toBeLessThanOrEqual(viewport.width);
  });
});

test.describe('picnic train: one item for each friend (age 2)', () => {
  test('[AC-02] a tap on a free passenger gives the item, counts it aloud and offers the next free passenger', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-a', { level: 2, lang: 'en' });
    const before = await waitForPicnicReady(page);
    expect(before.task).toBe('one-each');
    expect(servedCount(before)).toBe(0);
    expect(before.nextFreeId).toBe('p-0');

    await giveToNextFree(page);
    const after = await waitForPicnic(page, (i) => i.ready, 'ready after the first give');
    expect(after.passengers[0].hasItem).toBe(true);
    expect(servedCount(after)).toBe(1);
    expect(after.nextFreeId).toBe('p-1');
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.number.1.en' && l.lang === 'en');
  });

  test('[AC-03] a wrong tap (a passenger who already has an item) gives the hint, removes nothing and never reduces the balance', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enterPicnic(page, 'profile-a', { level: 2, lang: 'en', balanceSec: 100 });
    await giveToNextFree(page);
    const served = await waitForPicnic(page, (i) => i.ready && servedCount(i) === 1, 'ready after the first give');
    const balanceBefore = await readBalanceSec(page);

    await tapRect(page, served.passengers[0].hit); // p-0 already has an item
    await expect.poll(async () => (await getPicnicInfo(page))?.tries, { timeout: 5_000 }).toBe(1);
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.wrong.given.he' && l.lang === 'he');
    await page.waitForTimeout(500);

    const after = await waitForPicnicReady(page);
    expect(after.passengers[0].hasItem).toBe(true);
    expect(servedCount(after)).toBe(1);
    expect(after.phase).toBe('give');
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    // Age 2 can always finish the train after a mistake.
    await playTrain(page);
    expect(await readStarCount(page)).toBe(1);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);
  });

  test('[AC-17] when every friend has an item the train is ready: the line is spoken, the star rises and a new train arrives', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enterPicnic(page, 'profile-a', { level: 2, lang: 'en' });
    const first = await waitForPicnicReady(page);
    expect(await readStarCount(page)).toBe(0);
    await playTrain(page);
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.ready.he' && l.lang === 'he');
    expect(await readStarCount(page)).toBe(1);
    // A new train arrives: nobody has an item and input is accepted again.
    const next = await waitForPicnicReady(page);
    expect(servedCount(next)).toBe(0);
    expect(next.phase).toBe('give');
    expect(next.passengers.length).toBeGreaterThanOrEqual(first.passengers.length - 1);
  });

  test('[AC-25] age 2: with no tap for 6 s the next free passenger is shown, hinted becomes true and the instruction is asked again', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-a', { level: 2, lang: 'en' });
    const first = await waitForPicnicReady(page);
    expect(first.hinted).toBe(false);
    await expect.poll(async () => (await getPicnicInfo(page))?.hinted, { timeout: 15_000 }).toBe(true);
    await expect
      .poll(async () => (await getSpokenLines(page)).filter((l) => l.lineId === 'picnic.ask.one-each.he').length, { timeout: 10_000 })
      .toBeGreaterThanOrEqual(2);
  });

  test('[AC-25] age 5 gets no idle hint: after 10 s nothing is hinted and the instruction was asked once', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-b', { level: 5, lang: 'en' });
    await waitForPicnicReady(page);
    await page.waitForTimeout(10_000);
    expect((await getPicnicInfo(page))?.hinted).toBe(false);
    expect((await getSpokenLines(page)).filter((l) => l.lineId.startsWith('picnic.ask.'))).toHaveLength(1);
  });
});

test.describe('picnic train: levels', () => {
  test('[AC-05] one real-tap level change at a low level: from a seeded L1, three clean trains raise the level to 2', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(180_000);
    await enterPicnic(page, 'profile-a', { level: 1, lang: 'en' });
    const first = await waitForPicnicReady(page);
    expect(first.level).toBe(1);
    for (let i = 0; i < 3; i++) await playTrain(page);
    const next = await waitForPicnic(page, (info) => info.ready && info.level === 2, 'the level did not rise to 2');
    expect(next.level).toBe(2);
    expect((await readStoredPicnicSkill(page, 'profile-a', 'en'))?.level).toBe(2);
    expect(await readStarCount(page)).toBe(3);
  });

  test('[AC-06] high level: a seeded L5 (load N, scattered) is completed by real taps, with one recorded trial', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enterPicnic(page, 'profile-b', { level: 5, lang: 'en' });
    const info = await waitForPicnicReady(page);
    expect(info.level).toBe(5);
    expect(info.task).toBe('load');
    expect([4, 5]).toContain(info.size);
    expect(info.target).toBe(info.size);
    expect(info.passengers.length).toBe(info.size);
    await playTrain(page);
    expect(await readStarCount(page)).toBe(1);
    const skill = await readStoredPicnicSkill(page, 'profile-b', 'en');
    expect(skill?.recent).toEqual(['clean']);
  });

  test('[AC-06] high level: a seeded L8 (10 friends, how many are missing) is completed by real taps, panning along the train', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(120_000);
    await enterPicnic(page, 'profile-b', { level: 8, lang: 'en' });
    const info = await waitForPicnicReady(page);
    expect(info.level).toBe(8);
    expect(info.task).toBe('missing');
    expect([9, 10]).toContain(info.size);
    expect(info.phase).toBe('answer');
    expect(servedCount(info)).toBe(info.size - info.target);
    expect(info.cards?.map((c) => c.value)).toEqual(Array.from({ length: info.size - 1 }, (_, i) => i + 1));
    await playTrain(page);
    expect(await readStarCount(page)).toBe(1);
  });

  test('[AC-23] seeded L2 shows ghost items and no tally', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-a', { level: 2 });
    const info = await waitForPicnicReady(page);
    expect(info.scaffold).toBe('outline');
    expect(info.ghostItems).toBe(true);
    expect(info.tally).toBeNull();
  });

  test('[AC-23] seeded L3 shows a tally of the train size and no ghost items', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-a', { level: 3 });
    const info = await waitForPicnicReady(page);
    expect(info.scaffold).toBe('symbol');
    expect(info.ghostItems).toBe(false);
    expect(info.tally).toBe(info.size);
  });

  test('[AC-23] seeded L5 shows no scaffold', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-b', { level: 5 });
    const info = await waitForPicnicReady(page);
    expect(info.scaffold).toBe('none');
    expect(info.ghostItems).toBe(false);
    expect(info.tally).toBeNull();
  });
});

test.describe('picnic train: load and missing tasks (age 5)', () => {
  test('[AC-19] load: a basket tap loads one item and counts it; a loaded item can be taken back; a wrong go records one miss and returns the cargo; the right go makes the train ready', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(120_000);
    await enterPicnic(page, 'profile-b', { level: 5, lang: 'en' });
    const info = await waitForPicnicReady(page);
    expect(info.task).toBe('load');
    const n = info.target;
    await waitForSpokenLine(page, (l) => l.lineId === `picnic.ask.load.${n}.he` && l.lang === 'he');

    await loadOne(page);
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.number.1.en' && l.lang === 'en');
    const one = await waitForPicnicReady(page);
    expect(one.loaded).toBe(1);
    expect(one.cargoHits).toHaveLength(1);

    // Taking an item back is free.
    await tapRect(page, one.cargoHits[0]);
    await waitForPicnic(page, (i) => i.loaded === 0, 'the loaded item was not taken back');
    expect((await getPicnicInfo(page))!.tries).toBe(0);

    // One item too few, then go: wrong.
    await loadOne(page);
    await tapGo(page);
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.wrong.count.he' && l.lang === 'he');
    const afterWrong = await waitForPicnic(page, (i) => i.ready && i.loaded === 0, 'the cargo did not return to the basket');
    expect(afterWrong.phase).toBe('load');
    expect(afterWrong.tries).toBe(1);

    // The right count: ready, one star, one recorded trial (a miss: only the first wrong go counts).
    for (let k = 0; k < n; k++) await loadOne(page);
    await tapGo(page);
    await expect.poll(() => readStarCount(page), { timeout: 15_000 }).toBe(1);
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.ready.he');
    const skill = await readStoredPicnicSkill(page, 'profile-b', 'en');
    expect(skill?.recent).toEqual(['miss']);
  });

  test('[AC-20] missing: a wrong number card gives the hint and records one miss; the right card speaks m, then the free friends are served and the train is ready', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(120_000);
    await enterPicnic(page, 'profile-b', { level: 7, lang: 'en' });
    const info = await waitForPicnicReady(page);
    expect(info.task).toBe('missing');
    expect(info.phase).toBe('answer');
    const m = info.target;
    const wrong = m === 1 ? 2 : 1;
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.ask.missing.he' && l.lang === 'he');

    await tapCard(page, wrong);
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.wrong.count.he' && l.lang === 'he');
    await page.waitForTimeout(500);
    const afterWrong = await waitForPicnicReady(page);
    expect(afterWrong.phase).toBe('answer');
    expect(afterWrong.tries).toBe(1);

    await tapCard(page, m);
    await waitForSpokenLine(page, (l) => l.lineId === `picnic.number.${m}.en` && l.lang === 'en');
    await waitForSpokenLine(page, (l) => l.lineId === 'picnic.missing.give.he' && l.lang === 'he');
    const give = await waitForPicnic(page, (i) => i.ready && i.phase === 'give', 'the give phase did not start');
    expect(give.passengers.filter((p) => !p.hasItem)).toHaveLength(m);

    await playTrain(page);
    expect(await readStarCount(page)).toBe(1);
    const skill = await readStoredPicnicSkill(page, 'profile-b', 'en');
    expect(skill?.recent).toEqual(['miss']);
  });
});

test.describe('picnic train: voice lines', () => {
  test('[AC-10] the instruction, the counting token in the round language, the wrong hint and the ready line are requested with the right ids and languages', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(90_000);
    await enterPicnic(page, 'profile-a', { level: 2, lang: 'fr' });
    const info = await waitForPicnicReady(page);
    expect(info.lang).toBe('fr');
    const ask = await waitForSpokenLine(page, (l) => l.lineId === 'picnic.ask.one-each.he');
    expect(ask.lang).toBe('he');

    await giveToNextFree(page);
    const one = await waitForSpokenLine(page, (l) => l.lineId === 'picnic.number.1.fr');
    expect(one.lang).toBe('fr');

    const served = await waitForPicnic(page, (i) => i.ready && servedCount(i) === 1, 'ready after the first give');
    await tapRect(page, served.passengers[0].hit);
    const wrong = await waitForSpokenLine(page, (l) => l.lineId === 'picnic.wrong.given.he');
    expect(wrong.lang).toBe('he');
    await page.waitForTimeout(500);

    await playTrain(page);
    const ready = await waitForSpokenLine(page, (l) => l.lineId === 'picnic.ready.he');
    expect(ready.lang).toBe('he');
    // No English line was requested in a French round.
    expect((await getSpokenLines(page)).filter((l) => l.lineId.endsWith('.en'))).toEqual([]);
  });

  test('[AC-10] the help button asks for the help line', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(60_000);
    await enterPicnic(page, 'profile-a', { level: 2 });
    await waitForPicnicReady(page);
    await page.locator('[data-testid="hud-help"]').click();
    const help = await waitForSpokenLine(page, (l) => l.lineId === 'picnic.help.he');
    expect(help.lang).toBe('he');
    await expect(page.locator('[data-testid="help-card"]')).toBeVisible();
  });
});

// Word Train (docs/specs/word-train.md), Pass 1. Real taps and drags only; hooks seed or read state.
import { test, expect, type Page } from '@playwright/test';
import {
  dragRectTo,
  enterWorldByTap,
  getActiveScenes,
  getSpokenLines,
  getWordTrainInfo,
  readBalanceSec,
  readStarCount,
  seedLanguageSetting,
  seedWordTrainLevel,
  tapRect,
  tapTestId,
  tapWorldBuilding,
  waitForScene,
  waitForWordTrainReady,
  type WordTrainInfo,
} from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
const MIN_HIT_PX = 64;

/** @single-orientation tests run in the landscape project only (docs/PROCESS.md section 4). */
function skipIfNotLandscape(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function enterWordTrain(
  page: Page,
  profile: 'profile-a' | 'profile-b',
  level?: number,
): Promise<WordTrainInfo> {
  await enterWorldByTap(page, profile, 'language-house', 'word-train', {
    beforeEnter: level === undefined ? undefined : () => seedWordTrainLevel(page, level),
  });
  return waitForWordTrainReady(page);
}

/** Polls until Word Train state satisfies `check`. */
async function waitForWordTrain(
  page: Page,
  check: (info: WordTrainInfo) => boolean,
  what: string,
  timeout = 10_000,
): Promise<WordTrainInfo> {
  const deadline = Date.now() + timeout;
  for (;;) {
    const info = await getWordTrainInfo(page);
    if (info && check(info)) return info;
    if (Date.now() > deadline) throw new Error(`${what}: ${JSON.stringify(info)}`);
    await new Promise((r) => setTimeout(r, 100));
  }
}

test.describe('word train', () => {
  test('[AC-01] full real-input journey: profile -> Language House -> picker card -> tap asked-for object -> back to the map', async ({ page }) => {
    test.setTimeout(60_000);
    await tapWorldBuilding(page, 'profile-a', 'language-house');
    await tapTestId(page, 'game-picker-word-train');
    await waitForScene(page, 'WordTrainScene');
    const info = await waitForWordTrainReady(page);

    expect(info.mode).toBe('load');
    const targetObj = info.objects.find((o) => o.id === info.target);
    expect(targetObj).toBeDefined();

    await tapRect(page, targetObj!.rect);
    await waitForWordTrain(
      page,
      (i) => i.lastEvent === 'loaded' || i.phase === 'departing',
      'tapping asked-for object did not load it',
    );

    await tapTestId(page, 'hud-back');
    await waitForScene(page, 'MapScene');
    expect(await getActiveScenes(page)).not.toContain('WordTrainScene');
  });

  test('[AC-02] @single-orientation load mode: dragging another object names it and keeps the request without dropping stars or balance; dragging the right object loads it', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    const info = await enterWordTrain(page, 'profile-a');
    expect(info.mode).toBe('load');
    expect(info.wagonRect).not.toBeNull();

    const starsBefore = await readStarCount(page);
    const balanceBefore = await readBalanceSec(page);
    const targetId = info.target!;
    const otherObj = info.objects.find((o) => o.id !== targetId)!;
    const rightObj = info.objects.find((o) => o.id === targetId)!;

    const spokenBeforeOther = (await getSpokenLines(page)).length;
    await dragRectTo(page, otherObj.rect, info.wagonRect!);
    await waitForWordTrain(
      page,
      (i) => i.lastEvent === 'other',
      'dragging another object did not emit other event',
    );

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeOther);
          return (
            lines.some((l) => l.lineId === `wordtrain.other.${otherObj.id}.en` && l.lang === 'en') &&
            lines.some((l) => l.lineId === `wordtrain.load.${targetId}.en` && l.lang === 'en')
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const afterOther = await getWordTrainInfo(page);
    expect(afterOther?.target).toBe(targetId);
    expect(await readStarCount(page)).toBeGreaterThanOrEqual(starsBefore);
    expect(await readBalanceSec(page)).toBeGreaterThanOrEqual(balanceBefore);

    const spokenBeforeRight = (await getSpokenLines(page)).length;
    await dragRectTo(page, rightObj.rect, info.wagonRect!);
    await waitForWordTrain(
      page,
      (i) => i.lastEvent === 'loaded',
      'dragging asked-for object did not emit loaded event',
    );
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeRight);
          return lines.some((l) => l.lineId === `wordtrain.name.${targetId}.en` && l.lang === 'en');
        },
        { timeout: 10_000 },
      )
      .toBe(true);
  });

  test('[AC-03] @single-orientation spell mode (L3): wrong block bounces and is named; dragging right blocks spells the word, speaks word line and awards a star', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    let info = await enterWordTrain(page, 'profile-b', 3);
    expect(info.level).toBe(3);
    expect(info.mode).toBe('spell');
    expect(info.phase).toBe('spelling');
    const starsBefore = await readStarCount(page);

    const firstSlot = info.slots[0];
    const wrongTile = info.tiles.find((t) => !t.placed && t.letter !== firstSlot.letter)!;
    const spokenBeforeBounce = (await getSpokenLines(page)).length;
    await dragRectTo(page, wrongTile.rect, firstSlot.rect);
    await waitForWordTrain(page, (i) => i.lastEvent === 'bounced', 'wrong block did not bounce');
    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeBounce);
          return lines.some((l) => l.lineId === `wordtrain.letter.${wrongTile.letter}.${info.language}` && l.lang === info.language);
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const wordId = info.target!;
    const roundLang = info.language;
    const spokenBeforeSpell = (await getSpokenLines(page)).length;
    for (let s = 0; s < info.slots.length; s++) {
      info = await waitForWordTrainReady(page);
      const slot = info.slots[s];
      const tile = info.tiles.find((t) => !t.placed && t.letter === slot.letter)!;
      await dragRectTo(page, tile.rect, slot.rect);
      await waitForWordTrain(
        page,
        (i) => (s === info.slots.length - 1 ? i.lastEvent === 'spelled' : Boolean(i.slots[s]?.filled)),
        `slot ${s} did not fill`,
      );
    }

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page, spokenBeforeSpell);
          return lines.some((l) => l.lineId === `wordtrain.word.${wordId}.${roundLang}` && l.lang === roundLang);
        },
        { timeout: 10_000 },
      )
      .toBe(true);
    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(starsBefore + 1);
  });

  test('[AC-05] @single-orientation tapping blocks in order spells the word (L4)', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    let info = await enterWordTrain(page, 'profile-b', 4);
    expect(info.level).toBe(4);
    expect(info.mode).toBe('spell');
    const starsBefore = await readStarCount(page);

    for (let s = 0; s < info.slots.length; s++) {
      info = await waitForWordTrainReady(page);
      const slot = info.slots[s];
      const tile = info.tiles.find((t) => !t.placed && t.letter === slot.letter)!;
      await tapRect(page, tile.rect);
      await waitForWordTrain(
        page,
        (i) => (s === info.slots.length - 1 ? i.lastEvent === 'spelled' : Boolean(i.slots[s]?.filled)),
        `tapping block for slot ${s} did not fill`,
      );
    }

    await expect.poll(() => readStarCount(page), { timeout: 10_000 }).toBe(starsBefore + 1);
  });

  test('[AC-07] @single-orientation load mode (age 2) stays English only even when language setting is French or both; its skill key stays .en', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    for (const lang of ['fr', 'both'] as const) {
      await enterWorldByTap(page, 'profile-a', 'language-house', 'word-train', {
        beforeEnter: () => seedLanguageSetting(page, lang),
      });
      const loadInfo = await waitForWordTrainReady(page);
      expect(loadInfo.mode).toBe('load');
      expect(loadInfo.language).toBe('en');
      expect(loadInfo.skillKey.endsWith('.en')).toBe(true);

      await expect
        .poll(
          async () => {
            const lines = await getSpokenLines(page);
            return lines.some((l) => l.lineId.startsWith('wordtrain.load.') && l.lang === 'en');
          },
          { timeout: 10_000 },
        )
        .toBe(true);

      const wordTrainLines = (await getSpokenLines(page)).filter((l) => l.lineId.startsWith('wordtrain.'));
      expect(wordTrainLines.length).toBeGreaterThan(0);
      for (const line of wordTrainLines) {
        if (line.lineId.startsWith('wordtrain.intro.') || line.lineId.startsWith('wordtrain.praise.')) {
          expect(line.lang, `${lang}: ${line.lineId}`).toBe('he');
        } else {
          expect(line.lang, `${lang}: ${line.lineId}`).toBe('en');
        }
      }
    }
  });

  test('[AC-09] object, block and wagon targets are at least 64 CSS px and on screen in both orientations and modes', async ({ page }) => {
    test.setTimeout(60_000);
    const vp = page.viewportSize()!;
    const checkRect = (rect: { x: number; y: number; width: number; height: number }, label: string) => {
      expect(rect.width, `${label} width`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.height, `${label} height`).toBeGreaterThanOrEqual(MIN_HIT_PX);
      expect(rect.x, `${label} left`).toBeGreaterThanOrEqual(0);
      expect(rect.y, `${label} top`).toBeGreaterThanOrEqual(0);
      expect(rect.x + rect.width, `${label} right`).toBeLessThanOrEqual(vp.width + 0.5);
      expect(rect.y + rect.height, `${label} bottom`).toBeLessThanOrEqual(vp.height + 0.5);
    };

    // Load mode (profile-a)
    const loadInfo = await enterWordTrain(page, 'profile-a');
    expect(loadInfo.mode).toBe('load');
    expect(loadInfo.wagonRect).not.toBeNull();
    checkRect(loadInfo.wagonRect!, 'load wagon');
    for (const obj of loadInfo.objects) {
      checkRect(obj.rect, `load object ${obj.id}`);
    }

    // Spell mode L5 (4 wagons + 5 blocks, profile-b)
    const spellInfo = await enterWordTrain(page, 'profile-b', 5);
    expect(spellInfo.mode).toBe('spell');
    expect(spellInfo.slots).toHaveLength(4);
    expect(spellInfo.tiles).toHaveLength(5);
    for (const slot of spellInfo.slots) {
      checkRect(slot.rect, `spell wagon ${slot.index}`);
    }
    for (const tile of spellInfo.tiles) {
      checkRect(tile.rect, `spell tile ${tile.index}`);
    }
  });
  test('[AC-12] @single-orientation L6 spells a five-letter word by tapping (5 wagons, 6 blocks)', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-b', 'language-house', 'word-train', {
      beforeEnter: async () => {
        await seedLanguageSetting(page, 'en');
        await seedWordTrainLevel(page, 6);
      },
    });
    let info = await waitForWordTrainReady(page);
    expect(info.level).toBe(6);
    expect(info.mode).toBe('spell');
    expect(info.language).toBe('en');
    expect(info.slots).toHaveLength(5);
    expect(info.tiles).toHaveLength(6);
    expect(info.word).toHaveLength(5);
    const starsBefore = await readStarCount(page);

    for (let s = 0; s < info.slots.length; s++) {
      info = await waitForWordTrainReady(page);
      const slot = info.slots[s];
      const tile = info.tiles.find((t) => !t.placed && t.letter === slot.letter)!;
      await tapRect(page, tile.rect);
      await waitForWordTrain(
        page,
        (i) => (s === info.slots.length - 1 ? i.lastEvent === 'spelled' : Boolean(i.slots[s]?.filled)),
        `tapping block for slot ${s} did not fill`,
      );
    }
    await expect.poll(() => readStarCount(page), { timeout: 12_000 }).toBe(starsBefore + 1);
  });

  test('[AC-13] @single-orientation French setting at L7 speaks the French intro, spell line and French letter names; skill key is .fr', async ({ page }, testInfo) => {
    skipIfNotLandscape(testInfo);
    test.setTimeout(60_000);
    await enterWorldByTap(page, 'profile-b', 'language-house', 'word-train', {
      beforeEnter: async () => {
        await seedLanguageSetting(page, 'fr');
        await seedWordTrainLevel(page, 7);
      },
    });
    let info = await waitForWordTrainReady(page);
    expect(info.level).toBe(7);
    expect(info.mode).toBe('spell');
    expect(info.language).toBe('fr');
    expect(info.skillKey.endsWith('.fr')).toBe(true);
    expect(info.slots).toHaveLength(5);
    expect(info.tiles).toHaveLength(7);
    const wordId = info.target!;

    await expect
      .poll(
        async () => {
          const lines = await getSpokenLines(page);
          return (
            lines.some((l) => l.lineId === 'wordtrain.intro.spell.fr.he' && l.lang === 'he') &&
            lines.some((l) => l.lineId === `wordtrain.spell.${wordId}.fr` && l.lang === 'fr')
          );
        },
        { timeout: 10_000 },
      )
      .toBe(true);

    const starsBefore = await readStarCount(page);
    const firstSlot = info.slots[0];
    const wrong = info.tiles.find((t) => !t.placed && t.letter !== firstSlot.letter)!;
    await dragRectTo(page, wrong.rect, firstSlot.rect);
    await waitForWordTrain(page, (i) => i.lastEvent === 'bounced', 'wrong block did not bounce');
    await expect
      .poll(async () => (await getSpokenLines(page)).some((l) => l.lineId === `wordtrain.letter.${wrong.letter}.fr` && l.lang === 'fr'), {
        timeout: 10_000,
      })
      .toBe(true);

    for (let s = 0; s < info.slots.length; s++) {
      info = await waitForWordTrainReady(page);
      const slot = info.slots[s];
      const tile = info.tiles.find((t) => !t.placed && t.letter === slot.letter)!;
      await tapRect(page, tile.rect);
      await waitForWordTrain(
        page,
        (i) => (s === info.slots.length - 1 ? i.lastEvent === 'spelled' : Boolean(i.slots[s]?.filled)),
        `tapping block for slot ${s} did not fill`,
      );
    }
    await expect
      .poll(async () => (await getSpokenLines(page)).some((l) => l.lineId === `wordtrain.word.${wordId}.fr` && l.lang === 'fr'), {
        timeout: 10_000,
      })
      .toBe(true);
    await expect.poll(() => readStarCount(page), { timeout: 12_000 }).toBe(starsBefore + 1);
  });

  test('[AC-14] L8 (5-6 letters, 2 distractors, audio-only) and L7 blocks are at least 64 CSS px, on screen and not overlapping, in both orientations', async ({ page }) => {
    test.setTimeout(90_000);
    const vp = page.viewportSize()!;
    for (const level of [7, 8]) {
      await enterWorldByTap(page, 'profile-b', 'language-house', 'word-train', {
        beforeEnter: async () => {
          await seedLanguageSetting(page, 'en');
          await seedWordTrainLevel(page, level);
        },
      });
      const info = await waitForWordTrainReady(page);
      expect(info.level).toBe(level);
      expect(info.slots.length).toBeGreaterThanOrEqual(5);
      expect(info.slots.length).toBeLessThanOrEqual(6);
      expect(info.tiles).toHaveLength(info.slots.length + 2);
      for (const slot of info.slots) {
        expect(slot.rect.width, `L${level} wagon ${slot.index} width`).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(slot.rect.height, `L${level} wagon ${slot.index} height`).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(slot.rect.x).toBeGreaterThanOrEqual(0);
        expect(slot.rect.x + slot.rect.width).toBeLessThanOrEqual(vp.width + 0.5);
      }
      for (const tile of info.tiles) {
        const r = tile.rect;
        expect(r.width, `L${level} tile ${tile.index}`).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(r.height).toBeGreaterThanOrEqual(MIN_HIT_PX);
        expect(r.x).toBeGreaterThanOrEqual(0);
        expect(r.y).toBeGreaterThanOrEqual(0);
        expect(r.x + r.width).toBeLessThanOrEqual(vp.width + 0.5);
        expect(r.y + r.height).toBeLessThanOrEqual(vp.height + 0.5);
      }
      for (let i = 0; i < info.tiles.length; i++) {
        for (let j = i + 1; j < info.tiles.length; j++) {
          const a = info.tiles[i].rect;
          const b = info.tiles[j].rect;
          const overlap = a.x < b.x + b.width - 0.5 && b.x < a.x + a.width - 0.5 && a.y < b.y + b.height - 0.5 && b.y < a.y + a.height - 0.5;
          expect(overlap, `L${level} tile ${i} overlaps tile ${j}`).toBe(false);
        }
      }
      await tapTestId(page, 'hud-back');
      await waitForScene(page, 'MapScene');
    }
  });
});

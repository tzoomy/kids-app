import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { ART_MANIFEST } from '../../src/assets/art/manifest';
import { loadTravelSuitcase } from '../../src/content/loadContent';
import { TravelSuitcaseContentSchema } from '../../src/content/schema';
import { buildMeta, SkillSession } from '../../src/core/adaptive';
import { AdaptiveStore } from '../../src/core/storage/adaptiveStore';
import type { StorageDriver } from '../../src/core/storage/store';
import { nextRoundLanguage } from '../../src/games/restaurant/trialTracker';
import {
  artKeyForChoice,
  buildCase,
  buildRequest,
  closedLine,
  introLine,
  nameLine,
  otherLine,
  planForLevel,
  requestLine,
  trialForRequest,
} from '../../src/games/travelSuitcase/suitcaseRound';

const REPO_ROOT = path.resolve(__dirname, '../..');

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

function makeRng(seed = 17): () => number {
  let state = seed >>> 0;
  return () => {
    state = (state * 1664525 + 1013904223) >>> 0;
    return state / 0x100000000;
  };
}

describe('suitcaseRound', () => {
  const content = loadTravelSuitcase();

  it('[AC-06] level plans map L1..L5 to the spec difficulty curve and real adaptive engine advances within track bounds', () => {
    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      request: 'noun',
      choiceCount: 2,
      requestsPerCase: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      request: 'noun',
      choiceCount: 3,
      requestsPerCase: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      request: 'two',
      choiceCount: 4,
      requestsPerCase: 2,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      request: 'attribute',
      choiceCount: 4,
      requestsPerCase: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[4])).toEqual({
      request: 'negation',
      choiceCount: 4,
      requestsPerCase: 3,
      audioOnly: true,
      hintPulse: false,
    });

    expect(trialForRequest(0, false, 'hat')).toEqual({
      itemId: 'hat',
      firstTryCorrect: true,
      hinted: false,
    });
    expect(trialForRequest(1, false, 'hat')).toEqual({
      itemId: 'hat',
      firstTryCorrect: false,
      hinted: false,
    });
    expect(trialForRequest(0, true, 'hat')).toEqual({
      itemId: 'hat',
      firstTryCorrect: true,
      hinted: true,
    });

    const meta = buildMeta({
      levelCount: content.adaptive.levels.length,
      tracks: content.adaptive.tracks,
      rules: content.adaptive.rules,
    });

    const makeSession = (track: 'age2' | 'age5', profileId: string) =>
      new SkillSession({
        store: new AdaptiveStore(memoryDriver()),
        profileId,
        track,
        world: content.world,
        gameId: content.id,
        meta,
        today: () => '2026-11-14',
        random: () => 0.1,
      });

    // Age 2 starts at L1, rises to L2 after 3 clean requests, stays capped at L2, and drops on misses at round end.
    const session2 = makeSession('age2', 'p2');
    expect(session2.level('en')).toBe(1);
    session2.record('en', trialForRequest(0, false, 'hat'));
    session2.record('en', trialForRequest(0, false, 'shoes'));
    session2.record('en', trialForRequest(0, false, 'ball'));
    expect(session2.level('en')).toBe(2);

    session2.record('en', trialForRequest(0, false, 'book'));
    session2.record('en', trialForRequest(0, false, 'coat'));
    session2.record('en', trialForRequest(0, false, 'shirt'));
    expect(session2.level('en')).toBe(2);

    session2.record('en', trialForRequest(1, false, 'socks'));
    session2.record('en', trialForRequest(2, false, 'bottle'));
    session2.record('en', trialForRequest(0, false, 'teddy'));
    expect(session2.level('en')).toBe(1);

    // Age 5 starts at L3, rises on 3 clean unhinted requests, ignores hinted streaks, and drops on 2 misses.
    const session5 = makeSession('age5', 'p5');
    expect(session5.level('fr')).toBe(3);
    session5.record('fr', trialForRequest(0, false, 'hat+shoes'));
    session5.record('fr', trialForRequest(0, false, 'ball+book'));
    session5.record('fr', trialForRequest(0, false, 'coat+shirt'));
    expect(session5.level('fr')).toBe(4);

    // A hinted request does not advance L4 -> L5 on its own; 3 clean unhinted requests do.
    session5.record('fr', trialForRequest(0, true, 'hat-blue'));
    expect(session5.level('fr')).toBe(4);
    session5.record('fr', trialForRequest(0, false, 'shoes-red'));
    session5.record('fr', trialForRequest(0, false, 'ball-yellow'));
    session5.record('fr', trialForRequest(0, false, 'coat-blue'));
    expect(session5.level('fr')).toBe(5);

    session5.record('fr', trialForRequest(1, false, 'shirt-not-red'));
    session5.record('fr', trialForRequest(2, false, 'hat-not-blue'));
    expect(session5.level('fr')).toBe(4);
  });

  it('[AC-07] keeps one language mid-case, honours settings.languages at boundary, and formats EN/FR/HE voice lines', () => {
    expect(nextRoundLanguage('en', false, 'both', () => 0.99)).toBe('en');
    expect(nextRoundLanguage('fr', false, 'both', () => 0.01)).toBe('fr');
    expect(nextRoundLanguage('en', true, 'fr')).toBe('fr');
    expect(nextRoundLanguage('fr', true, 'en')).toBe('en');
    expect(nextRoundLanguage('en', true, 'both', () => 0.2)).toBe('en');
    expect(nextRoundLanguage('en', true, 'both', () => 0.8)).toBe('fr');

    expect(introLine(content)).toEqual({
      lineId: 'suitcase.intro.he',
      lang: 'he',
      text: content.linesHe.intro,
    });
    expect(closedLine(content)).toEqual({
      lineId: 'suitcase.closed.he',
      lang: 'he',
      text: content.linesHe.closed,
    });

    // Noun
    const nounReq = {
      kind: 'noun' as const,
      key: 'hat',
      itemId: 'hat',
      targets: ['hat'],
      needed: 1,
      targetItemIds: ['hat'],
    };
    expect(requestLine(content, nounReq, 'en')).toEqual({
      lineId: 'suitcase.req.noun.hat.en',
      lang: 'en',
      text: 'Put the hat in the suitcase!',
    });
    expect(requestLine(content, nounReq, 'fr')).toEqual({
      lineId: 'suitcase.req.noun.hat.fr',
      lang: 'fr',
      text: 'Mets le chapeau dans la valise !',
    });

    // Two
    const twoReq = {
      kind: 'two' as const,
      key: 'hat-shoes',
      itemId: 'hat+shoes',
      targets: ['hat', 'shoes'],
      needed: 2,
      targetItemIds: ['hat', 'shoes'],
    };
    expect(requestLine(content, twoReq, 'en').text).toBe('Put the hat and the shoes in the suitcase!');
    expect(requestLine(content, twoReq, 'fr').text).toBe('Mets le chapeau et les chaussures dans la valise !');

    // Attribute & Negation with French feminine / plural agreement
    const attrShoesReq = {
      kind: 'attribute' as const,
      key: 'shoes-red',
      itemId: 'shoes-red',
      targets: ['shoes-red'],
      needed: 1,
      targetItemIds: ['shoes'],
    };
    expect(requestLine(content, attrShoesReq, 'en').text).toBe('Put the red shoes in the suitcase!');
    expect(requestLine(content, attrShoesReq, 'fr').text).toBe('Mets les chaussures rouges dans la valise !');

    const negShirtReq = {
      kind: 'negation' as const,
      key: 'shirt-red',
      itemId: 'shirt-not-red',
      targets: ['shirt-yellow', 'shirt-blue'],
      needed: 1,
      targetItemIds: ['shirt'],
      excludedColor: 'red',
    };
    expect(requestLine(content, negShirtReq, 'en')).toEqual({
      lineId: 'suitcase.req.negation.shirt-red.en',
      lang: 'en',
      text: 'Put a shirt in the suitcase, but not the red one!',
    });
    expect(requestLine(content, negShirtReq, 'fr')).toEqual({
      lineId: 'suitcase.req.negation.shirt-red.fr',
      lang: 'fr',
      text: 'Mets une chemise dans la valise, mais pas la rouge !',
    });

    const negShoesReq = {
      ...negShirtReq,
      key: 'shoes-blue',
      itemId: 'shoes-not-blue',
      targets: ['shoes-red', 'shoes-yellow'],
      targetItemIds: ['shoes'],
      excludedColor: 'blue',
    };
    expect(requestLine(content, negShoesReq, 'fr').text).toBe(
      'Mets des chaussures dans la valise, mais pas les bleues !',
    );

    expect(nameLine(content, 'hat', 'en')).toEqual({
      lineId: 'suitcase.name.hat.en',
      lang: 'en',
      text: 'The hat!',
    });
    expect(nameLine(content, 'shirt-yellow', 'fr')).toEqual({
      lineId: 'suitcase.name.shirt-yellow.fr',
      lang: 'fr',
      text: 'La chemise jaune !',
    });
    expect(otherLine(content, 'shoes-yellow', 'en')).toEqual({
      lineId: 'suitcase.other.shoes-yellow.en',
      lang: 'en',
      text: 'Oh, the yellow shoes!',
    });
    expect(otherLine(content, 'shoes-yellow', 'fr')).toEqual({
      lineId: 'suitcase.other.shoes-yellow.fr',
      lang: 'fr',
      text: 'Oh, les chaussures jaunes !',
    });
  });

  it('[AC-08] validates 12 items, colour variants, manifest art files, buildCase floor exclusions, and schema rejections', () => {
    expect(content.id).toBe('travel-suitcase');
    expect(content.world).toBe('language-house');
    expect(content.items).toHaveLength(12);

    const coloredItems = content.items.filter((i) => i.colors);
    expect(coloredItems.map((i) => i.id)).toEqual(['hat', 'shoes', 'ball', 'coat', 'shirt']);

    const manifestByKey = new Map(ART_MANIFEST.map((e) => [e.key, e]));

    // Every base item and every colour variant resolves to a registered SVG on disk and has HE/EN/FR names.
    for (const item of content.items) {
      expect(item.he.trim().length).toBeGreaterThan(0);
      expect(item.en.the.trim().length).toBeGreaterThan(0);
      expect(item.en.a.trim().length).toBeGreaterThan(0);
      expect(item.fr.the.trim().length).toBeGreaterThan(0);
      expect(item.fr.a.trim().length).toBeGreaterThan(0);

      const baseKey = artKeyForChoice(content, item.id);
      const baseEntry = manifestByKey.get(baseKey);
      expect(baseEntry, `Missing manifest entry for ${baseKey}`).toBeDefined();
      expect(fs.existsSync(path.join(REPO_ROOT, 'public', baseEntry!.url)), baseEntry!.url).toBe(true);

      if (item.colors) {
        expect(item.colors).toHaveLength(3);
        for (const variant of item.colors) {
          expect(variant.en.trim().length).toBeGreaterThan(0);
          expect(variant.fr.trim().length).toBeGreaterThan(0);
          expect(variant.enOne.trim().length).toBeGreaterThan(0);
          expect(variant.frOne.trim().length).toBeGreaterThan(0);

          const choiceKey = artKeyForChoice(content, `${item.id}-${variant.color}`);
          const varEntry = manifestByKey.get(choiceKey);
          expect(varEntry, `Missing manifest entry for ${choiceKey}`).toBeDefined();
          expect(fs.existsSync(path.join(REPO_ROOT, 'public', varEntry!.url)), varEntry!.url).toBe(true);
        }
      }
    }

    // Suitcase layers and Language House backgrounds also exist.
    for (const propKey of [
      'suitcase-back',
      'suitcase-front',
      'language-house-bg-landscape',
      'language-house-bg-portrait',
    ] as const) {
      const entry = manifestByKey.get(propKey);
      expect(entry, propKey).toBeDefined();
      expect(fs.existsSync(path.join(REPO_ROOT, 'public', entry!.url)), entry!.url).toBe(true);
    }

    // Determinism and non-repeat across consecutive buildRequest / buildCase calls.
    for (const lvl of content.adaptive.levels) {
      const plan = planForLevel(lvl);
      const first = buildRequest(content, plan, null, makeRng(42), [], 'en');
      const replay = buildRequest(content, plan, null, makeRng(42), [], 'en');
      expect(first).toEqual(replay);
      expect(first.choices).toHaveLength(plan.choiceCount);

      const second = buildRequest(content, plan, first.request.key, makeRng(99), [], 'fr');
      expect(second.request.key).not.toBe(first.request.key);

      const fullCase = buildCase(content, plan, null, makeRng(7), 'en');
      expect(fullCase.requests).toHaveLength(plan.requestsPerCase);

      // Targets packed in earlier requests of the same case stay off the floor in later requests.
      const packedSoFar = new Set<string>();
      let prevKey: string | null = null;
      for (const req of fullCase.requests) {
        expect(req.request.key).not.toBe(prevKey);
        for (const choice of req.choices) {
          expect(packedSoFar.has(choice.itemId)).toBe(false);
        }
        for (const id of req.request.targetItemIds) packedSoFar.add(id);
        prevKey = req.request.key;
      }
    }

    // Schema superRefine rejections.
    const dupItems = structuredClone(content);
    dupItems.items[1] = { ...dupItems.items[1], id: dupItems.items[0].id };
    expect(TravelSuitcaseContentSchema.safeParse(dupItems).success).toBe(false);

    const badColorCount = structuredClone(content);
    badColorCount.items[0] = {
      ...badColorCount.items[0],
      colors: badColorCount.items[0].colors!.slice(0, 2),
    };
    expect(TravelSuitcaseContentSchema.safeParse(badColorCount).success).toBe(false);

    const badFrame = structuredClone(content);
    badFrame.frames.fr = { ...badFrame.frames.fr, not: 'Mets dans la valise !' };
    expect(TravelSuitcaseContentSchema.safeParse(badFrame).success).toBe(false);

    const impossibleChoiceCount = structuredClone(content);
    impossibleChoiceCount.adaptive.levels[0] = {
      ...impossibleChoiceCount.adaptive.levels[0],
      choiceCount: 20,
    };
    expect(TravelSuitcaseContentSchema.safeParse(impossibleChoiceCount).success).toBe(false);
  });
});

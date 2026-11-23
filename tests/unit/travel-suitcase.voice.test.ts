import { describe, expect, it } from 'vitest';
import { gameVoiceCatalog } from '../../src/content/voiceCatalog';

function lcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (s * 1664525 + 1013904223) >>> 0;
    return s / 0x100000000;
  };
}

const byId = new Map(gameVoiceCatalog().map((l) => [l.id, l]));
import { loadTravelSuitcase } from '../../src/content/loadContent';
import {
  buildCase,
  closedLine,
  introLine as suitcaseIntro,
  nameLine,
  otherLine,
  planForLevel as suitcasePlan,
  requestLine,
} from '../../src/games/travelSuitcase/suitcaseRound';

describe('travel-suitcase voice catalogue', () => {
  it('[AC-19] every line Travel Suitcase can emit is catalogued (all levels, both languages, many seeded cases)', () => {
    const content = loadTravelSuitcase();
    const emitted = new Set<string>();
    emitted.add(suitcaseIntro(content).lineId);
    emitted.add(closedLine(content).lineId);
    for (const level of content.adaptive.levels) {
      const plan = suitcasePlan(level);
      for (const lang of ['en', 'fr'] as const) {
        for (let seed = 1; seed <= 40; seed++) {
          const built = buildCase(content, plan, null, lcg(seed * 7919), lang);
          for (const req of built.requests) {
            emitted.add(requestLine(content, req.request, lang).lineId);
            for (const c of req.choices) {
              emitted.add(nameLine(content, c.id, lang).lineId);
              emitted.add(otherLine(content, c.id, lang).lineId);
            }
          }
        }
      }
    }
    expect(emitted.size).toBeGreaterThan(100);
    for (const id of emitted) expect(byId.has(id), id).toBe(true);
  });
});

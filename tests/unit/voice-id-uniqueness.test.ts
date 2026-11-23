// Voice-ID hygiene: one line id must never stand for two different spoken texts, because a recorded clip is keyed by id
// (a collision means one text plays the other's clip, or one of the two is silently skipped by the TTS batch job).
// This walks the runtime builders of the games whose lines are not (yet) in the voice catalogue as well as the catalogue.
import { describe, expect, it } from 'vitest';
import {
  loadPotionLab,
  loadShadowMatch,
  loadWhoLivesHere,
  loadWhosHiding,
} from '@/content/loadContent';
import { gameVoiceCatalog } from '@/content/voiceCatalog';
import { buildHidingRound } from '@/games/hiding/hidingRound';
import { buildShadowRound } from '@/games/hiding/shadowRound';
import { askLines, correctLines, helpLine, levelLevers, wrongLines } from '@/games/habitat';
import { PICNIC_LINE_TEXT } from '@/games/picnic/picnicVoice';
import { SECONDARY_COLORS } from '@/games/potionLab/potionMachine';
import { colorLine, introLine, requestLine, tryAgainLine } from '@/games/potionLab/potionRound';

type Collector = Map<string, Set<string>>;

function add(into: Collector, lineId: string, text: string): void {
  const texts = into.get(lineId) ?? new Set<string>();
  texts.add(text);
  into.set(lineId, texts);
}

function collisions(into: Collector): string[] {
  return [...into].filter(([, texts]) => texts.size > 1).map(([id, texts]) => `${id}: ${[...texts].join(' | ')}`);
}

describe('voice ids: no id maps to more than one spoken text', () => {
  it('Who\'s Hiding?: every request and hint id, over all levels, animals and languages', () => {
    const content = loadWhosHiding();
    const lines: Collector = new Map();
    for (const level of content.adaptive.levels) {
      for (const animal of content.animals) {
        for (const lang of ['en', 'fr'] as const) {
          const round = buildHidingRound(content, level, lang, animal.id);
          add(lines, round.lineId, round.promptText);
          add(lines, round.hintLineId, round.hintText);
        }
      }
    }
    expect(lines.size).toBeGreaterThan(0);
    expect(collisions(lines)).toEqual([]);
  });

  it('Who\'s Hiding?: the L7 (long sound) and L8 (short sound) clue hints keep separate ids', () => {
    const content = loadWhosHiding();
    const ids = new Set<string>();
    for (const animal of content.animals) {
      for (const lang of ['en', 'fr'] as const) {
        for (const i of [6, 7]) ids.add(buildHidingRound(content, content.adaptive.levels[i], lang, animal.id).hintLineId);
      }
    }
    expect(ids.size).toBe(content.animals.length * 2 * 2);
  });

  it('Shadow Match: cue, reveal and Hebrew reveal ids over all levels, animals and languages', () => {
    const shadow = loadShadowMatch();
    const animals = loadWhosHiding().animals;
    const lines: Collector = new Map();
    for (const level of shadow.adaptive.levels) {
      for (const animal of animals) {
        for (const lang of ['en', 'fr'] as const) {
          const round = buildShadowRound(shadow, animals, level, lang, animal.id);
          add(lines, round.lineId, round.promptText);
          add(lines, round.revealLineId, round.revealText);
          add(lines, round.revealLineIdHe, round.revealTextHe);
        }
      }
    }
    expect(collisions(lines)).toEqual([]);
  });

  it('Potion Lab: request, try-again, colour and intro ids (one try-again id per secondary colour)', () => {
    const content = loadPotionLab();
    const lines: Collector = new Map();
    for (const color of SECONDARY_COLORS) {
      for (const line of [requestLine(content, color), tryAgainLine(content, color)]) add(lines, line.lineId, line.text);
    }
    for (const color of Object.keys(content.colors) as Array<keyof typeof content.colors>) {
      for (const lang of ['he', 'en', 'fr'] as const) add(lines, colorLine(content, color, lang).lineId, colorLine(content, color, lang).text);
    }
    for (const mode of ['free', 'request'] as const) add(lines, introLine(content, mode).lineId, introLine(content, mode).text);
    expect(collisions(lines)).toEqual([]);
    expect(new Set(SECONDARY_COLORS.map((c) => tryAgainLine(content, c).lineId)).size).toBe(SECONDARY_COLORS.length);
  });

  it('Who Lives Here?: ask, correct, wrong and help ids over all levels, animals and languages', () => {
    const content = loadWhoLivesHere();
    const lines: Collector = new Map();
    const add2 = (l: { lineId: string; text: string }) => add(lines, l.lineId, l.text);
    add2(helpLine());
    for (const descriptor of content.adaptive.levels) {
      const levers = levelLevers(descriptor);
      for (const animal of content.animals) {
        for (const lang of ['en', 'fr'] as const) {
          [...askLines(content, animal, levers, lang), ...correctLines(content, animal, lang), ...wrongLines(content, animal, levers, lang)].forEach(add2);
        }
      }
    }
    expect(collisions(lines)).toEqual([]);
  });

  it('Picnic Train: the id -> text table is complete and no text is orphaned under an empty id', () => {
    const entries = Object.entries(PICNIC_LINE_TEXT);
    expect(entries.length).toBeGreaterThan(0);
    for (const [id, text] of entries) {
      expect(id.trim().length, id).toBeGreaterThan(0);
      expect(text.trim().length, id).toBeGreaterThan(0);
    }
    // Two ids may not share a text either: a shared text is a sign of a copy-pasted id.
    const byText = new Map<string, string[]>();
    for (const [id, text] of entries) byText.set(text, [...(byText.get(text) ?? []), id]);
    const dupes = [...byText].filter(([text, ids]) => ids.length > 1 && /[֐-׿]/.test(text)).map(([text, ids]) => `${text}: ${ids.join(', ')}`);
    expect(dupes).toEqual([]);
  });

  it('voice catalogue: ids are unique entries (never the same id twice, even with the same text)', () => {
    const catalog = gameVoiceCatalog();
    const lines: Collector = new Map();
    const seen = new Set<string>();
    for (const l of catalog) {
      expect(seen.has(l.id), l.id).toBe(false);
      seen.add(l.id);
      add(lines, l.id, l.text);
    }
    expect(collisions(lines)).toEqual([]);
  });
});

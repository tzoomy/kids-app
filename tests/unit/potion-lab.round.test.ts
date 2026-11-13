import { describe, expect, it } from 'vitest';
import { SkillSession, buildMeta } from '@/core/adaptive';
import { AdaptiveStore } from '@/core/storage/adaptiveStore';
import type { StorageDriver } from '@/core/storage/store';
import { loadLeisureColouring, loadPotionLab, loadWorlds } from '@/content/loadContent';
import { PotionLabContentSchema } from '@/content/schema';
import potionJson from '@/content/games/potion-lab.json';
import {
  POTION_COLORS,
  PRIMARY_COLORS,
  SECONDARY_COLORS,
  createPotion,
  potsFor,
  resetBowl,
  tapPot,
  type SecondaryColor,
} from '@/games/potionLab/potionMachine';
import {
  colorLine,
  introLine,
  namingLines,
  nextRequest,
  planForLevel,
  requestLine,
  trialForMix,
  trialForRequest,
  tryAgainLine,
} from '@/games/potionLab/potionRound';
import { nextRoundLanguage } from '@/games/restaurant/trialTracker';

function memoryDriver(): StorageDriver {
  const map = new Map<string, string>();
  return { getItem: (k) => map.get(k) ?? null, setItem: (k, v) => void map.set(k, v) };
}

const content = loadPotionLab();
const meta = buildMeta({
  levelCount: content.adaptive.levels.length,
  tracks: content.adaptive.tracks,
  rules: content.adaptive.rules,
});

function makeSession(track: 'age2' | 'age5'): SkillSession {
  return new SkillSession({
    store: new AdaptiveStore(memoryDriver()),
    profileId: 'p',
    track,
    world: content.world,
    gameId: content.id,
    meta,
    today: () => '2026-11-13',
    random: () => 0.3,
  });
}

function playFreeMix(session: SkillSession, lang: 'en' | 'fr'): void {
  let state = createPotion();
  state = tapPot(state, 'red').state;
  const { event } = tapPot(state, 'yellow');
  if (event.kind !== 'mixed') throw new Error('Expected mixed event in free mode');
  session.record(lang, trialForMix(event));
}

function playRequest(
  session: SkillSession,
  lang: 'en' | 'fr',
  target: SecondaryColor,
  missFirst: boolean,
  hinted = false,
): void {
  let state = createPotion({ request: target });
  if (missFirst) {
    // Mixing same primary twice never hits a secondary target.
    const wrongPot = PRIMARY_COLORS[0];
    const miss = tapPot(tapPot(state, wrongPot).state, wrongPot);
    expect(miss.event.kind).toBe('mixed-other');
    state = resetBowl(miss.state);
  }
  const [p1, p2] = potsFor(target);
  const done = tapPot(tapPot(state, p1).state, p2);
  if (done.event.kind !== 'matched') throw new Error('Expected matched event');
  session.record(lang, trialForRequest(done.event, hinted));
}

describe('Potion Lab: levels, adaptive trials, voice lines and content', () => {
  it('[AC-04] free mode naming produces Hebrew then the active learning language (en or fr) for every color', () => {
    expect(introLine(content, 'free')).toEqual({
      lineId: 'potion.intro.free.he',
      lang: 'he',
      text: content.linesHe.introFree,
    });

    for (const color of POTION_COLORS) {
      for (const lang of ['en', 'fr'] as const) {
        expect(colorLine(content, color, lang)).toEqual({
          lineId: `potion.color.${color}.${lang}`,
          lang,
          text: content.colors[color][lang],
        });
        expect(namingLines(content, color, lang)).toEqual([
          { lineId: `potion.color.${color}.he`, lang: 'he', text: content.colors[color].he },
          { lineId: `potion.color.${color}.${lang}`, lang, text: content.colors[color][lang] },
        ]);
      }
    }

    expect(nextRoundLanguage(null, true, 'fr')).toBe('fr');
    expect(nextRoundLanguage(null, true, 'en')).toBe('en');
    expect(['en', 'fr']).toContain(nextRoundLanguage(null, true, 'both', () => 0.8));
  });

  it('[AC-05] request mode helpers: nextRequest never repeats the previous color; requestLine and tryAgainLine carry Hebrew color names', () => {
    for (const prev of [null, ...SECONDARY_COLORS] as const) {
      for (const r of [0, 0.25, 0.5, 0.75, 0.99]) {
        const picked = nextRequest(prev, () => r);
        expect(SECONDARY_COLORS).toContain(picked);
        if (prev !== null) expect(picked).not.toBe(prev);
      }
    }

    expect(introLine(content, 'request')).toEqual({
      lineId: 'potion.intro.request.he',
      lang: 'he',
      text: content.linesHe.introRequest,
    });

    for (const target of SECONDARY_COLORS) {
      const req = requestLine(content, target);
      expect(req.lineId).toBe(`potion.request.${target}.he`);
      expect(req.lang).toBe('he');
      expect(req.text).toContain(content.colors[target].he);

      const retry = tryAgainLine(content, target);
      expect(retry.lineId).toBe('potion.tryAgain.he');
      expect(retry.lang).toBe('he');
      expect(retry.text).toContain(content.colors[target].he);
    }

    expect(planForLevel(content.adaptive.levels[0])).toEqual({
      mode: 'free',
      mixesPerStar: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[1])).toEqual({
      mode: 'request',
      mixesPerStar: 3,
      audioOnly: false,
      hintPulse: true,
    });
    expect(planForLevel(content.adaptive.levels[2])).toEqual({
      mode: 'request',
      mixesPerStar: 3,
      audioOnly: false,
      hintPulse: false,
    });
    expect(planForLevel(content.adaptive.levels[3])).toEqual({
      mode: 'request',
      mixesPerStar: 3,
      audioOnly: true,
      hintPulse: false,
    });
  });

  it('[AC-06] trialForMix is always clean; trialForRequest is clean only on a first-try unhinted match', () => {
    expect(trialForMix({ kind: 'mixed', result: 'orange', first: 'red', second: 'yellow' })).toEqual({
      itemId: 'orange',
      firstTryCorrect: true,
      hinted: false,
    });

    expect(
      trialForRequest({ kind: 'matched', result: 'green', first: 'yellow', second: 'blue', tries: 1 }, false),
    ).toEqual({
      itemId: 'green',
      firstTryCorrect: true,
      hinted: false,
    });

    expect(
      trialForRequest({ kind: 'matched', result: 'green', first: 'yellow', second: 'blue', tries: 1 }, true),
    ).toEqual({
      itemId: 'green',
      firstTryCorrect: true,
      hinted: true,
    });

    expect(
      trialForRequest({ kind: 'matched', result: 'purple', first: 'red', second: 'blue', tries: 2 }, false),
    ).toEqual({
      itemId: 'purple',
      firstTryCorrect: false,
      hinted: false,
    });
  });

  it('[AC-06] adaptive steps: age 2 stays at L1; age 5 starts at L2, rises after clean trials, and drops after misses', () => {
    const age2 = makeSession('age2');
    expect(age2.level('fr')).toBe(1);
    for (let i = 0; i < 6; i++) playFreeMix(age2, 'fr');
    expect(age2.level('fr')).toBe(1);
    expect(planForLevel(content.adaptive.levels[age2.level('fr') - 1]).mode).toBe('free');

    const age5 = makeSession('age5');
    expect(age5.level('en')).toBe(2);

    // 3 clean first-try matches raise L2 -> L3
    playRequest(age5, 'en', 'orange', false);
    playRequest(age5, 'en', 'green', false);
    playRequest(age5, 'en', 'purple', false);
    expect(age5.level('en')).toBe(3);

    // 3 more clean first-try matches raise L3 -> L4 (audio-only)
    playRequest(age5, 'en', 'orange', false);
    playRequest(age5, 'en', 'green', false);
    playRequest(age5, 'en', 'purple', false);
    expect(age5.level('en')).toBe(4);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).audioOnly).toBe(true);

    // 2 missed requests drop L4 -> L3
    playRequest(age5, 'en', 'orange', true);
    playRequest(age5, 'en', 'green', true);
    expect(age5.level('en')).toBe(3);

    // 2 more missed requests drop L3 -> L2 -> L1 (free)
    playRequest(age5, 'en', 'purple', true);
    playRequest(age5, 'en', 'orange', true);
    expect(age5.level('en')).toBe(2);
    playRequest(age5, 'en', 'green', true);
    playRequest(age5, 'en', 'purple', true);
    expect(age5.level('en')).toBe(1);
    expect(planForLevel(content.adaptive.levels[age5.level('en') - 1]).mode).toBe('free');
  });

  it('[AC-07] content validates; every color has non-empty he, en, fr names and colouring palette hexes; rejects invalid content', () => {
    expect(() => PotionLabContentSchema.parse(potionJson)).not.toThrow();
    expect(content.id).toBe('potion-lab');
    expect(content.world).toBe('science-world');
    expect(content.earnsLeisure).toBe(true);
    expect(content.languages).toEqual(['en', 'fr']);
    expect(loadWorlds().worlds.find((w) => w.id === 'science-world')?.status).toBe('open');

    const paletteById = new Map(loadLeisureColouring().palette.map((c) => [c.id, c.hex]));
    for (const color of POTION_COLORS) {
      const entry = content.colors[color];
      expect(entry.he.trim().length).toBeGreaterThan(0);
      expect(entry.en.trim().length).toBeGreaterThan(0);
      expect(entry.fr.trim().length).toBeGreaterThan(0);
      expect(entry.hex).toBe(paletteById.get(color));
    }

    const withEmptyName = structuredClone(potionJson);
    withEmptyName.colors.green.fr = '';
    expect(() => PotionLabContentSchema.parse(withEmptyName)).toThrow();

    const withBlankName = structuredClone(potionJson);
    withBlankName.colors.red.he = '   ';
    expect(() => PotionLabContentSchema.parse(withBlankName)).toThrow();

    const withBadEnName = structuredClone(potionJson);
    withBadEnName.colors.blue.en = '';
    expect(() => PotionLabContentSchema.parse(withBadEnName)).toThrow();

    const withBadFrame = structuredClone(potionJson);
    withBadFrame.linesHe.requestFrame = 'אפשר להכין?';
    expect(() => PotionLabContentSchema.parse(withBadFrame)).toThrow();

    const withBadAudioOnly = {
      ...potionJson,
      adaptive: {
        tracks: { age2: { start: 1, min: 1, max: 1 }, age5: { start: 1, min: 1, max: 1 } },
        levels: [{ support: 'audio-only', extra: { mode: 'free', mixesPerStar: 3 } }],
      },
    };
    expect(() => PotionLabContentSchema.parse(withBadAudioOnly)).toThrow();
  });
});

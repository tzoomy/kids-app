// Regression for the Balloon Pop "listen to the animal" bug: each game must speak its own guidance lines,
// and every shipped Hebrew clip must contain the words of the line it is listed under.
// Root cause of the bug: the automatic splitter in scripts/tts/generate_voice.py cut the first Hebrew batch
// one sentence off, so he.retry.0 (used by Balloon Pop) held the tail of he.restaurant.help
// ("tap the animal to hear again"). The clips are now cut from hand-verified points (scripts/tts/verified-splits.json).
import { existsSync, readFileSync, statSync } from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import { WORLD_GAMES, type PickerGameId } from '../../src/ui/picker/pickerModel';
import heLines from '../../src/content/voice-lines-he.json';
import manifest from '../../src/content/audio-manifest.json';
import splits from '../../scripts/tts/verified-splits.json';
import balloon from '../../src/content/games/balloon-pop.json';

type WorldGameId = (typeof WORLD_GAMES)[number]['gameId'];

/** Scene source of every world game (same list as tests/unit/wardrobe.roundHook.test.ts). */
const SCENE: Partial<Record<PickerGameId, string>> = {
  'animal-restaurant': 'src/games/restaurant/RestaurantScene.ts',
  'kitchen-orchestra': 'src/games/orchestra/OrchestraScene.ts',
  'letter-monster': 'src/games/letterMonster/LetterMonsterScene.ts',
  'travel-suitcase': 'src/games/travelSuitcase/SuitcaseScene.ts',
  'word-train': 'src/games/wordTrain/WordTrainScene.ts',
  'sorting-beds': 'src/games/sorting/SortingScene.ts',
  'balloon-pop': 'src/games/balloon/BalloonScene.ts',
  'picnic-train': 'src/games/picnic/PicnicScene.ts',
  'number-bridge': 'src/games/numberBridge/NumberBridgeScene.ts',
  'who-is-hiding': 'src/games/hiding/HidingScene.ts',
  'seed-to-flower': 'src/games/seedFlower/SeedFlowerScene.ts',
  'who-lives-here': 'src/games/habitat/HabitatScene.ts',
  'shadow-match': 'src/games/hiding/ShadowScene.ts',
  'potion-lab': 'src/games/potionLab/PotionScene.ts',
  'sink-or-float': 'src/games/sinkFloat/SinkFloatScene.ts',
  'magic-magnet': 'src/games/magicMagnet/MagnetScene.ts',
  'sticker-board': 'src/games/stickers/StickerBoardScene.ts',
};

/** Hebrew guidance keys in voice-lines-he.json that belong to one game (the rest are shared: retry, praise, leisure). */
const HE_KEY_OWNER: Record<string, WorldGameId> = {
  restaurant: 'animal-restaurant',
  hiding: 'who-is-hiding',
};
/** Games whose round is about an animal, so the "listen to the animal" retry line (he.retry.2) fits. */
const ANIMAL_GAMES = new Set<string>(['animal-restaurant', 'who-is-hiding']);
const SHARED_PREFIXES = new Set(['retry', 'praise', 'leisure']);

function read(rel: string): string {
  return readFileSync(path.join(process.cwd(), rel), 'utf8').replace(/\/\*[\s\S]*?\*\//g, '').replace(/^\s*\/\/.*$/gm, '');
}

/** The scene file plus the same-directory modules it imports (round, voice and logic helpers). */
function gameSources(scene: string): string {
  const dir = path.dirname(scene);
  const main = read(scene);
  const locals = [...main.matchAll(/from '\.\/([^']+)'/g)].map((m) => path.join(dir, `${m[1]}.ts`)).filter((p) => existsSync(p));
  return [main, ...locals.map(read)].join('\n');
}

/** Game-specific prefixes of intro/help line ids, e.g. 'he.balloon.intro' -> balloon, 'potion.help.he' -> potion. */
function guidancePrefixes(source: string): Set<string> {
  const out = new Set<string>();
  for (const m of source.matchAll(/'(?:he\.)?([a-zA-Z]+)\.(?:[a-zA-Z]+\.)*(?:intro|help)(?:\.[a-zA-Z]+)*'/g)) out.add(m[1]);
  for (const m of source.matchAll(/heLine\('([a-zA-Z]+)\.(?:intro|help)/g)) out.add(m[1]);
  return out;
}

function heKeysUsed(source: string): string[] {
  return [...source.matchAll(/heLine\(\s*'([^']+)'/g)].map((m) => m[1]);
}

const normalize = (s: string) => s.replace(/[^\p{L}\p{N}]+/gu, '');

describe('Balloon Pop speaks its own guidance', () => {
  const src = gameSources(SCENE['balloon-pop']!);

  it('intro and help use Balloon Pop line ids and Balloon Pop text', () => {
    expect(src).toContain("INTRO_LINE_ID = 'he.balloon.intro'");
    expect(src).toContain("HELP_LINE_ID = 'he.balloon.help'");
    expect(src).toMatch(/lineId: INTRO_LINE_ID[^}]*text: (?:this\.context\.content\.balloon|content)\.introHe/);
    expect(src).toMatch(/lineId: HELP_LINE_ID[^}]*text: content\.helpTextHe/);
    expect(balloon.introHe).toContain('בלון');
    expect(balloon.helpTextHe).toContain('בלון');
  });

  it('never reaches another game\'s line or the animal retry line', () => {
    expect(heKeysUsed(src).filter((k) => k.split('.')[0] in HE_KEY_OWNER)).toEqual([]);
    expect(src).not.toMatch(/heVariant\(\s*'retry'/);
    expect(heKeysUsed(src)).not.toContain('retry.2');
  });

  it('every shipped Hebrew clip Balloon Pop can play says its own words and no animal', () => {
    const verified = Object.assign({}, ...Object.entries(splits).filter(([k]) => !k.startsWith('_')).map(([, v]) => v)) as Record<
      string,
      { heard: string }
    >;
    for (const key of heKeysUsed(src)) {
      const id = `he.${key}`;
      if (!(id in manifest)) continue;
      expect(verified[id], `${id} has no verified transcript`).toBeTruthy();
      expect(verified[id].heard, id).not.toMatch(/חיה|חיות/);
    }
  });
});

describe('every WORLD_GAMES game resolves to its own voice prompt', () => {
  const ids = WORLD_GAMES.map((g) => g.gameId);

  it('the scene map covers WORLD_GAMES', () => {
    expect(ids.filter((id) => !SCENE[id])).toEqual([]);
  });

  it('no two games share an intro/help line id prefix (no default or other-game fallback)', () => {
    const owner = new Map<string, string>();
    for (const id of ids) {
      const prefixes = [...guidancePrefixes(gameSources(SCENE[id]!))].filter((p) => !SHARED_PREFIXES.has(p));
      for (const p of prefixes) {
        expect(owner.get(p) ?? id, `intro/help prefix "${p}" is used by ${owner.get(p)} and ${id}`).toBe(id);
        owner.set(p, id);
      }
    }
  });

  it('game-specific Hebrew guidance keys are spoken only by their own game', () => {
    for (const id of ids) {
      for (const key of heKeysUsed(gameSources(SCENE[id]!))) {
        const prefix = key.split('.')[0];
        if (prefix in HE_KEY_OWNER) expect(HE_KEY_OWNER[prefix], `${id} speaks he.${key}`).toBe(id);
      }
    }
  });

  it('only animal games can pick the "listen to the animal" retry line', () => {
    for (const id of ids) {
      if (ANIMAL_GAMES.has(id)) continue;
      const src = gameSources(SCENE[id]!);
      expect(src, `${id} uses heVariant('retry'), which can pick he.retry.2`).not.toMatch(/heVariant\(\s*'retry'/);
      expect(heKeysUsed(src), id).not.toContain('retry.2');
    }
  });
});

describe('verified Hebrew clip splits', () => {
  const lines = heLines as Record<string, string>;
  const entries = Object.entries(splits).filter(([k]) => !k.startsWith('_')) as [
    string,
    Record<string, { start: number; end: number; heard: string }>,
  ][];

  it('each verified transcript matches the line text it is shipped for', () => {
    for (const [, batch] of entries) {
      for (const [id, cut] of Object.entries(batch)) {
        expect(normalize(cut.heard), id).toBe(normalize(lines[id.replace(/^he\./, '')]));
      }
    }
  });

  it('each shipped clip has the length of its verified interval (a re-cut at other points fails here)', () => {
    for (const [, batch] of entries) {
      for (const [id, cut] of Object.entries(batch)) {
        const rel = (manifest as Record<string, string>)[id];
        expect(rel, `${id} missing from the audio manifest`).toBeTruthy();
        // Clips are CBR 48 kbps mono MP3, so the byte size gives the duration; encode_clip pads 0.06 s + 0.10 s.
        const seconds = (statSync(path.join(process.cwd(), 'public', rel)).size * 8) / 48_000;
        expect(Math.abs(seconds - (cut.end - cut.start + 0.16)), `${id}: ${seconds.toFixed(2)} s`).toBeLessThan(0.3);
      }
    }
  });
});

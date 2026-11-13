import { describe, expect, it } from 'vitest';
import crypto from 'node:crypto';
import { loadAnimalRestaurant, loadKitchenOrchestra, loadWorlds } from '../../src/content/loadContent';
import kitchenOrchestraJson from '../../src/content/games/kitchen-orchestra.json';

describe('Kitchen Orchestra moves to Language House', () => {
  it('declares language-house as its world, next to Animal Restaurant', () => {
    expect(loadKitchenOrchestra().world).toBe('language-house');
    expect(loadAnimalRestaurant().world).toBe('language-house');
  });

  it('keeps Language House open and earning leisure, with Animal Restaurant as the legacy entry game', () => {
    const house = loadWorlds().worlds.find((w) => w.id === 'language-house');
    expect(house?.status).toBe('open');
    expect(house?.earnsLeisure).toBe(true);
    expect(house?.entryGameId).toBe('animal-restaurant');
  });

  it('locks Art Studio again, with no entry game, until it has its own game', () => {
    const studio = loadWorlds().worlds.find((w) => w.id === 'art-studio');
    expect(studio).toBeDefined();
    expect(studio?.status).toBe('locked');
    expect(studio?.entryGameId).toBeUndefined();
    expect(studio?.earnsLeisure).toBe(true);
  });
});

describe('Kitchen Orchestra French pan strings (poele)', () => {
  const PAN_NAME_FR = 'poêle';
  const PAN_LINE_FR = 'Joue sur la poêle !';
  // Text hash of the recorded Leda clip on audio PR #39 (same recipe as tests/unit/audioStaticFile.test.ts there).
  const LEDA_PREFIX = 'gemini-3.8-flash-tts|Leda|warm, cheerful, slow and clear, speaking to a 2 to 5 year old|';
  const PAN_LINE_HASH = '4677a1ef0d1c';

  const pan = kitchenOrchestraJson.instruments.find((i) => i.id === 'pan');

  it('names the pan "poêle" (precomposed NFC e-circumflex)', () => {
    expect(pan?.name.fr).toBe(PAN_NAME_FR);
    expect(pan?.name.fr.normalize('NFC')).toBe(pan?.name.fr);
  });

  it('speaks orchestra.play.pan.fr as exactly "Joue sur la poêle !" (NFC, ASCII space before the bang)', () => {
    const line = pan?.prompts.fr as string;
    expect(line).toBe(PAN_LINE_FR);
    expect(line.normalize('NFC')).toBe(line);
    expect(line).toContain('ê');
    expect(line.endsWith(' !')).toBe(true);
    expect(line.includes(' ')).toBe(false);
  });

  it('has a text hash equal to the recorded clip hash 4677a1ef0d1c', () => {
    const line = pan?.prompts.fr as string;
    const hash = crypto.createHash('sha1').update(LEDA_PREFIX + line, 'utf8').digest('hex').slice(0, 12);
    expect(hash).toBe(PAN_LINE_HASH);
  });
});

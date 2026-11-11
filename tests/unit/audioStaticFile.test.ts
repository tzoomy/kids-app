import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { StaticFileProvider } from '@/core/audio/staticFileProvider';
import { loadAudioManifest, loadAnimalRestaurant } from '@/content/loadContent';
import { heLine, heVariant } from '@/content/voiceLines';
import heLines from '@/content/voice-lines-he.json';

class FakeAudio {
  static instances: FakeAudio[] = [];
  listeners: Record<string, Array<() => void>> = {};
  paused = false;
  playbackRate = 1;
  muted = false;
  volume = 1;
  constructor(public src = '') {
    FakeAudio.instances.push(this);
  }
  addEventListener(type: string, fn: () => void) {
    (this.listeners[type] ??= []).push(fn);
  }
  removeEventListener(type: string, fn: () => void) {
    this.listeners[type] = (this.listeners[type] ?? []).filter((f) => f !== fn);
  }
  emit(type: string) {
    for (const fn of [...(this.listeners[type] ?? [])]) fn();
  }
  play() {
    return Promise.resolve();
  }
  pause() {
    this.paused = true;
  }
}

describe('StaticFileProvider', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
  });
  afterEach(() => vi.unstubAllGlobals());

  const req = { lineId: 'food.apple.1.en', lang: 'en' as const, text: 'I want an apple, please!' };

  it('resolves false without a manifest entry (device TTS fallback)', async () => {
    const p = new StaticFileProvider({}, '/kids-app/');
    await expect(p.play(req)).resolves.toBe(false);
  });

  it('plays the manifest file from the base URL and resolves true when it ends', async () => {
    const p = new StaticFileProvider({ 'food.apple.1.en': 'audio/en/apple-1.mp3' }, '/kids-app/');
    const done = p.play(req);
    expect(FakeAudio.instances[0].src).toBe('/kids-app/audio/en/apple-1.mp3');
    FakeAudio.instances[0].emit('ended');
    await expect(done).resolves.toBe(true);
  });

  it('resolves false on a load error so the manager can fall back', async () => {
    const p = new StaticFileProvider({ 'food.apple.1.en': 'audio/en/apple-1.mp3' });
    const done = p.play(req);
    FakeAudio.instances[0].emit('error');
    await expect(done).resolves.toBe(false);
  });

  it('settles a pending clip when stopped, so talking animations never hang', async () => {
    const p = new StaticFileProvider({ 'food.apple.1.en': 'audio/en/apple-1.mp3' });
    const done = p.play(req);
    p.stop();
    await expect(done).resolves.toBe(true);
    expect(FakeAudio.instances[0].paused).toBe(true);
  });

  it('a new line interrupts and settles the previous one', async () => {
    const p = new StaticFileProvider({ 'food.apple.1.en': 'a.mp3', 'thanks.en.0': 'b.mp3' });
    const first = p.play(req);
    const second = p.play({ lineId: 'thanks.en.0', lang: 'en', text: 'Yummy! Thank you!' });
    await expect(first).resolves.toBe(true);
    FakeAudio.instances[1].emit('ended');
    await expect(second).resolves.toBe(true);
  });
});

describe('voice clip coverage', () => {
  const manifest = loadAudioManifest();
  const publicDir = path.resolve(__dirname, '../../public');

  it('every manifest entry points to an existing small mp3 file', () => {
    for (const [id, rel] of Object.entries(manifest)) {
      expect(rel, id).toMatch(/^audio\/(en|fr|he)\/[a-z0-9-]+\.mp3$/);
      const file = path.join(publicDir, rel);
      expect(fs.existsSync(file), `${id} -> ${rel}`).toBe(true);
      expect(fs.statSync(file).size, rel).toBeLessThan(60_000);
    }
  });

  it('only lists line ids the app can ask for', () => {
    const content = loadAnimalRestaurant();
    const valid = new Set<string>();
    for (const item of content.items) {
      for (const lang of ['en', 'fr'] as const) {
        for (const count of Object.keys(item.prompts[lang] ?? {})) valid.add(`food.${item.id}.${count}.${lang}`);
      }
    }
    for (const lang of ['en', 'fr'] as const) content.thanks[lang].forEach((_, i) => valid.add(`thanks.${lang}.${i}`));
    for (const key of Object.keys(heLines)) if (!key.startsWith('_')) valid.add(`he.${key}`);
    for (const id of Object.keys(manifest)) expect(valid.has(id), id).toBe(true);
  });

  it('builds Hebrew guidance requests', () => {
    expect(heLine('retry.0')).toEqual({ lineId: 'he.retry.0', lang: 'he', text: heLines['retry.0'] });
    expect(heVariant('praise', () => 0).lineId).toBe('he.praise.0');
    expect(heVariant('retry', () => 0.99).lineId).toBe('he.retry.2');
  });
});

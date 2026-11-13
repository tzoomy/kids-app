import { afterEach, beforeEach, describe, expect, it, vi } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import { StaticFileProvider, STATIC_CLIP_GRACE_MS, STATIC_CLIP_HARD_TIMEOUT_MS } from '@/core/audio/staticFileProvider';
import textHashes from '@/content/audio-text-hashes.json';
import { loadAudioManifest, loadAnimalRestaurant } from '@/content/loadContent';
import { heLine, heVariant } from '@/content/voiceLines';
import heLines from '@/content/voice-lines-he.json';

class FakeAudio {
  static instances: FakeAudio[] = [];
  listeners: Record<string, Array<() => void>> = {};
  paused = false;
  playbackRate = 1;
  duration = NaN;
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
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

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

describe('StaticFileProvider safety timeout', () => {
  beforeEach(() => {
    FakeAudio.instances = [];
    vi.stubGlobal('Audio', FakeAudio);
    vi.useFakeTimers();
  });
  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });
  const req = { lineId: 'x', lang: 'en' as const, text: 'x' };

  it('settles a clip that never ends after its duration plus a grace period', async () => {
    const p = new StaticFileProvider({ x: 'a.mp3' });
    const done = p.play(req);
    const a = FakeAudio.instances[0];
    a.duration = 2;
    a.emit('loadedmetadata');
    vi.advanceTimersByTime(2000 + STATIC_CLIP_GRACE_MS + 10);
    await expect(done).resolves.toBe(true);
    expect(a.paused).toBe(true);
  });

  it('settles a clip whose metadata never loads after the hard timeout', async () => {
    const p = new StaticFileProvider({ x: 'a.mp3' });
    const done = p.play(req);
    vi.advanceTimersByTime(STATIC_CLIP_HARD_TIMEOUT_MS + 10);
    await expect(done).resolves.toBe(true);
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
      // 48 kbps mono 24 kHz; longer Hebrew guidance lines (about 10–12 s) exceed 60 KB.
      expect(fs.statSync(file).size, rel).toBeLessThan(80_000);
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
    for (const item of content.items) {
      for (const variant of item.variants ?? []) {
        for (const lang of ['en', 'fr'] as const) {
          valid.add(`attr.${item.id}.${variant.color}.${lang}`);
          valid.add(`not.${item.id}.${variant.color}.${lang}`);
        }
      }
    }
    // Decided French pan line (Kitchen Orchestra). Other orchestra.* lines stay on device TTS.
    valid.add('orchestra.play.pan.fr');
    for (const key of Object.keys(heLines)) if (!key.startsWith('_')) valid.add(`he.${key}`);
    for (const id of Object.keys(manifest)) expect(valid.has(id), id).toBe(true);
  });

  it('every line the app can request has a clip', () => {
    const content = loadAnimalRestaurant();
    const ids: string[] = [];
    for (const item of content.items) {
      for (const lang of ['en', 'fr'] as const) {
        for (const count of Object.keys(item.prompts[lang] ?? {})) ids.push(`food.${item.id}.${count}.${lang}`);
      }
    }
    for (const lang of ['en', 'fr'] as const) content.thanks[lang].forEach((_, i) => ids.push(`thanks.${lang}.${i}`));
    for (const item of content.items) {
      for (const variant of item.variants ?? []) {
        for (const lang of ['en', 'fr'] as const) {
          ids.push(`attr.${item.id}.${variant.color}.${lang}`);
          ids.push(`not.${item.id}.${variant.color}.${lang}`);
        }
      }
    }
    ids.push('orchestra.play.pan.fr');
    for (const key of Object.keys(heLines)) if (!key.startsWith('_')) ids.push(`he.${key}`);
    // he.hiding.intro / he.hiding.help texts are in voice-lines-he.json so heLine works; clips and
    // hashes land with #39 (not merged here). [AC-34] in who-is-hiding.audio.test.ts pins the gap.
    const pendingUntil39 = new Set(['he.hiding.intro', 'he.hiding.help']);
    const missing = ids.filter((id) => !manifest[id] && !pendingUntil39.has(id));
    expect(missing).toEqual([]);
  });

  it('every clip was rendered from the current text (re-run scripts/tts/generate_voice.py after copy edits)', () => {
    // Must match text_hash() in scripts/tts/generate_voice.py.
    const prefix = 'gemini-3.8-flash-tts|Leda|warm, cheerful, slow and clear, speaking to a 2 to 5 year old|';
    const content = loadAnimalRestaurant();
    const texts: Record<string, string> = {};
    for (const item of content.items) {
      for (const lang of ['en', 'fr'] as const) {
        for (const [count, text] of Object.entries(item.prompts[lang] ?? {})) texts[`food.${item.id}.${count}.${lang}`] = text;
      }
    }
    for (const lang of ['en', 'fr'] as const) content.thanks[lang].forEach((t, i) => (texts[`thanks.${lang}.${i}`] = t));
    for (const item of content.items) {
      for (const variant of item.variants ?? []) {
        for (const lang of ['en', 'fr'] as const) {
          texts[`attr.${item.id}.${variant.color}.${lang}`] = variant[lang].pick;
          texts[`not.${item.id}.${variant.color}.${lang}`] = variant[lang].not;
        }
      }
    }
    // Decided 2026-11-12: use poêle, not the stale tambour string still in kitchen-orchestra.json.
    texts['orchestra.play.pan.fr'] = 'Joue sur la poêle !';
    for (const [key, text] of Object.entries(heLines)) if (!key.startsWith('_')) texts[`he.${key}`] = text;
    const hashes = textHashes as Record<string, string>;
    const stale = Object.keys(manifest).filter((id) => {
      const h = crypto.createHash('sha1').update(prefix + texts[id], 'utf8').digest('hex').slice(0, 12);
      return hashes[id] !== h;
    });
    expect(stale).toEqual([]);
  });

  it('builds Hebrew guidance requests', () => {
    expect(heLine('retry.0')).toEqual({ lineId: 'he.retry.0', lang: 'he', text: heLines['retry.0'] });
    expect(heVariant('praise', () => 0).lineId).toBe('he.praise.0');
    expect(heVariant('retry', () => 0.99).lineId).toBe('he.retry.2');
  });
});

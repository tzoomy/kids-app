// Workshop L20 real VO (the 8 Gemini clips): every workshop `vo` key resolves through the manifest to a file that exists on
// disk, and the voice chain used by the app plays that static file (never device TTS, never the missing-file chime).
import { existsSync } from 'node:fs';
import { resolve } from 'node:path';
import { describe, expect, it, vi } from 'vitest';
import { AudioManager, SpeechRecorder, StaticFileProvider } from '../../src/core/audio';
import type { AudioProvider } from '../../src/core/audio/types';
import { loadAudioManifest } from '../../src/content/loadContent';
import { AssetAvailability, assetEntry, assetUrl, workshopManifest } from '../../src/games/mysteryEgg/assets';
import { eggSpeechRequest } from '../../src/games/mysteryEgg/speech';
import { MysteryEggVoiceProvider, type VoiceAudio } from '../../src/games/mysteryEgg/voiceProvider';

const WORKSHOP_VO = Object.entries(workshopManifest()).filter(([, e]) => e.kind === 'vo').map(([id]) => id);
const BASE = '/kids-app/';

class FakeAudio implements VoiceAudio {
  static urls: string[] = [];
  private readonly listeners = new Map<string, Array<() => void>>();
  constructor(url: string) {
    FakeAudio.urls.push(url);
  }
  addEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(): void {}
  play(): Promise<void> {
    // The file loads and plays to its end.
    queueMicrotask(() => this.listeners.get('ended')?.forEach((f) => f()));
    return Promise.resolve();
  }
  pause(): void {}
}

describe('workshop L20 real voice files', () => {
  it('[AC-08] the workshop manifest has exactly the 8 agreed vo keys', () => {
    expect(WORKSHOP_VO.sort()).toEqual([
      'vo-fr-ws-l20-bonjour', 'vo-fr-ws-l20-one-bell', 'vo-fr-ws-l20-story', 'vo-fr-ws-l20-success',
      'vo-he-ws-dominoes-gap', 'vo-he-ws-egg-piece', 'vo-he-ws-l20-goal', 'vo-he-ws-scissors-which',
    ]);
  });

  it.each(WORKSHOP_VO)('[AC-08] %s resolves to audio/mystery-egg/<key>.ogg (base applied) and that file exists in public/', (id) => {
    expect(assetEntry(id).path).toBe(`audio/mystery-egg/${id}.ogg`);
    expect(assetUrl(id, BASE)).toBe(`${BASE}audio/mystery-egg/${id}.ogg`);
    expect(existsSync(resolve(__dirname, '../../public', assetEntry(id).path)), `missing file for ${id}`).toBe(true);
  });

  it.each(WORKSHOP_VO)('[AC-08] %s is played from its static file by the app chain: no device TTS, no chime', async (id) => {
    FakeAudio.urls = [];
    const chime = vi.fn();
    const deviceTts: AudioProvider = { id: 'device-tts', isAvailable: () => true, play: vi.fn(async () => true), warmup: vi.fn(), stop: vi.fn() };
    const staticFiles = new StaticFileProvider(loadAudioManifest(), BASE);
    // The older static-clip provider must not claim a Workshop key (it would play a different file / skip the Egg provider).
    expect(staticFiles.has(id)).toBe(false);
    const egg = new MysteryEggVoiceProvider(BASE, { createAudio: (u) => new FakeAudio(u), chime, availability: new AssetAvailability() });
    const recorder = new SpeechRecorder(() => 0);
    const manager = new AudioManager([egg, deviceTts]);
    manager.setObserver(recorder);

    const request = eggSpeechRequest(id, 'game');
    expect(request, id).not.toBeNull();
    await manager.play(request!);

    expect(FakeAudio.urls).toEqual([`${BASE}audio/mystery-egg/${id}.ogg`]);
    expect(recorder.getLines()[0]).toMatchObject({ lineId: id, source: 'clip' });
    expect(chime).not.toHaveBeenCalled();
    expect(deviceTts.play).not.toHaveBeenCalled();
  });
});

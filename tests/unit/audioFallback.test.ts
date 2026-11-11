import { describe, expect, it, vi } from 'vitest';
import { AudioManager } from '@/core/audio';
import type { AudioProvider, SpeechRequest } from '@/core/audio/types';

function fakeProvider(id: string, available: boolean, plays: boolean): AudioProvider {
  return {
    id,
    isAvailable: () => available,
    play: vi.fn(async (_req: SpeechRequest) => plays),
    warmup: vi.fn(),
    stop: vi.fn(),
  };
}

describe('AudioManager fallback', () => {
  const request: SpeechRequest = { lineId: 'food.apple.en', lang: 'en', text: 'I want an apple, please!' };

  it('uses the static file provider when it successfully plays', async () => {
    const staticProvider = fakeProvider('static-file', true, true);
    const ttsProvider = fakeProvider('device-tts', true, true);
    const manager = new AudioManager([staticProvider, ttsProvider]);

    const played = await manager.play(request);
    expect(played).toBe(true);
    expect(staticProvider.play).toHaveBeenCalledWith(request);
    expect(ttsProvider.play).not.toHaveBeenCalled();
  });

  it('falls back to device TTS when the static file is missing (provider returns false)', async () => {
    const staticProvider = fakeProvider('static-file', true, false);
    const ttsProvider = fakeProvider('device-tts', true, true);
    const manager = new AudioManager([staticProvider, ttsProvider]);

    const played = await manager.play(request);
    expect(played).toBe(true);
    expect(staticProvider.play).toHaveBeenCalled();
    expect(ttsProvider.play).toHaveBeenCalledWith(request);
  });

  it('skips providers that report unavailable', async () => {
    const staticProvider = fakeProvider('static-file', false, true);
    const ttsProvider = fakeProvider('device-tts', true, true);
    const manager = new AudioManager([staticProvider, ttsProvider]);

    await manager.play(request);
    expect(staticProvider.play).not.toHaveBeenCalled();
    expect(ttsProvider.play).toHaveBeenCalled();
  });

  it('resolves false when every provider fails or is unavailable', async () => {
    const staticProvider = fakeProvider('static-file', true, false);
    const ttsProvider = fakeProvider('device-tts', true, false);
    const manager = new AudioManager([staticProvider, ttsProvider]);

    expect(await manager.play(request)).toBe(false);
  });

  it('warmup() and stopAll() call through to every provider', () => {
    const staticProvider = fakeProvider('static-file', true, true);
    const ttsProvider = fakeProvider('device-tts', true, true);
    const manager = new AudioManager([staticProvider, ttsProvider]);

    manager.warmup();
    manager.stopAll();
    expect(staticProvider.warmup).toHaveBeenCalled();
    expect(ttsProvider.warmup).toHaveBeenCalled();
    expect(staticProvider.stop).toHaveBeenCalled();
    expect(ttsProvider.stop).toHaveBeenCalled();
  });

  it('stops every provider before a new line (single voice)', async () => {
    const a = fakeProvider('static-file', true, true);
    const b = fakeProvider('device-tts', true, true);
    const manager = new AudioManager([a, b]);
    await manager.play(request);
    expect(a.stop).toHaveBeenCalled();
    expect(b.stop).toHaveBeenCalled();
  });

  it('a line superseded while its static clip was failing does not fall back to device TTS', async () => {
    let failFirst: (v: boolean) => void = () => {};
    const staticProvider: AudioProvider = {
      id: 'static-file',
      isAvailable: () => true,
      play: vi.fn((req: SpeechRequest) =>
        req.lineId === 'A' ? new Promise<boolean>((r) => (failFirst = r)) : Promise.resolve(true),
      ),
      warmup: vi.fn(),
      stop: vi.fn(),
    };
    const tts = fakeProvider('device-tts', true, true);
    const manager = new AudioManager([staticProvider, tts]);
    const first = manager.play({ ...request, lineId: 'A' });
    const second = manager.play({ ...request, lineId: 'B' });
    await expect(second).resolves.toBe(true);
    failFirst(false); // A's static attempt fails late
    await expect(first).resolves.toBe(false);
    expect(tts.play).not.toHaveBeenCalled();
  });
});

import { describe, expect, it, vi } from 'vitest';
import { AudioManager, SpeechRecorder } from '@/core/audio';
import type { AudioProvider, SpeechRequest } from '@/core/audio/types';

function fakeProvider(id: string, plays: boolean, available = true): AudioProvider {
  return {
    id,
    isAvailable: () => available,
    play: vi.fn(async (_req: SpeechRequest) => plays),
    warmup: vi.fn(),
    stop: vi.fn(),
  };
}

const apple: SpeechRequest = { lineId: 'food.apple.1.en', lang: 'en', text: 'I want an apple!' };
const pomme: SpeechRequest = { lineId: 'food.apple.1.fr', lang: 'fr', text: 'Je veux une pomme !' };

describe('SpeechRecorder with AudioManager', () => {
  it('records a line handled by the static clip provider as source "clip"', async () => {
    const recorder = new SpeechRecorder(() => 1000);
    const staticP = fakeProvider('static-file', true);
    const tts = fakeProvider('device-tts', true);
    const manager = new AudioManager([staticP, tts]);
    manager.setObserver(recorder);
    await manager.play(apple);
    expect(recorder.getLines()).toEqual([
      { index: 0, lineId: 'food.apple.1.en', lang: 'en', source: 'clip', text: 'I want an apple!', at: 1000 },
    ]);
    expect(tts.play).not.toHaveBeenCalled();
  });

  it('records source "tts" when the clip provider cannot play and device TTS takes over', async () => {
    const recorder = new SpeechRecorder();
    const manager = new AudioManager([fakeProvider('static-file', false), fakeProvider('device-tts', true)]);
    manager.setObserver(recorder);
    await manager.play(pomme);
    expect(recorder.getLines()).toHaveLength(1);
    expect(recorder.getLines()[0]).toMatchObject({ lineId: 'food.apple.1.fr', lang: 'fr', source: 'tts' });
  });

  it('records a line even when no provider is available, and does not change the play result', async () => {
    const recorder = new SpeechRecorder();
    const manager = new AudioManager([fakeProvider('static-file', true, false)]);
    manager.setObserver(recorder);
    expect(await manager.play(apple)).toBe(false);
    expect(recorder.getCount()).toBe(1);
  });

  it('behaves identically without an observer', async () => {
    const manager = new AudioManager([fakeProvider('static-file', false), fakeProvider('device-tts', true)]);
    expect(await manager.play(apple)).toBe(true);
  });

  it('numbers lines in request order and filters with sinceIndex', async () => {
    const recorder = new SpeechRecorder();
    const manager = new AudioManager([fakeProvider('static-file', true)]);
    manager.setObserver(recorder);
    await manager.play(apple);
    await manager.play(pomme);
    await manager.play({ lineId: 'he.retry.0', lang: 'he', text: 'x' });
    expect(recorder.getCount()).toBe(3);
    expect(recorder.getLines().map((l) => l.index)).toEqual([0, 1, 2]);
    expect(recorder.getLines(1).map((l) => l.lineId)).toEqual(['food.apple.1.fr', 'he.retry.0']);
    expect(recorder.getLines(3)).toEqual([]);
  });

  it('records a superseded line as requested', async () => {
    const recorder = new SpeechRecorder();
    const manager = new AudioManager([fakeProvider('static-file', true)]);
    manager.setObserver(recorder);
    void manager.play(apple);
    await manager.play(pomme);
    expect(recorder.getLines().map((l) => l.lineId)).toEqual(['food.apple.1.en', 'food.apple.1.fr']);
  });
});

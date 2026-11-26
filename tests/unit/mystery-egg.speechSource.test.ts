// The e2e speech spy logs where a Mystery Egg line really came from (docs/specs/mystery-egg.md AC-25): 'clip' when the ogg played,
// 'chime' for the missing-file placeholder, 'tts' only when device speech synthesis took over.
import { describe, expect, it, vi } from 'vitest';
import { AudioManager, SpeechRecorder } from '../../src/core/audio';
import type { AudioProvider, SpeechRequest } from '../../src/core/audio/types';
import { AssetAvailability } from '../../src/games/mysteryEgg/assets';
import { MysteryEggVoiceProvider, type VoiceAudio } from '../../src/games/mysteryEgg/voiceProvider';

class FakeAudio implements VoiceAudio {
  static last: FakeAudio | null = null;
  private readonly listeners = new Map<string, Array<() => void>>();
  constructor(private readonly rejects: boolean) {
    FakeAudio.last = this;
  }
  addEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, [...(this.listeners.get(type) ?? []), fn]);
  }
  removeEventListener(type: string, fn: () => void): void {
    this.listeners.set(type, (this.listeners.get(type) ?? []).filter((f) => f !== fn));
  }
  emit(type: string): void {
    for (const f of this.listeners.get(type) ?? []) f();
  }
  play(): Promise<void> {
    return this.rejects ? Promise.reject(new Error('NotSupportedError')) : Promise.resolve();
  }
  pause(): void {}
}

const req = (lineId: string): SpeechRequest => ({ lineId, lang: 'fr', text: 'x' });
const deviceTts = (): AudioProvider => ({ id: 'device-tts', isAvailable: () => true, play: vi.fn(async () => true), warmup: vi.fn(), stop: vi.fn() });

function setup(rejects = false) {
  const availability = new AssetAvailability();
  const provider = new MysteryEggVoiceProvider('/kids-app/', { createAudio: () => new FakeAudio(rejects), chime: vi.fn(), availability, timeoutMs: 50 });
  const recorder = new SpeechRecorder(() => 0);
  const manager = new AudioManager([provider, deviceTts()]);
  manager.setObserver(recorder);
  return { availability, recorder, manager };
}

describe('mystery-egg speech source in the spy', () => {
  it('[AC-25] a Mystery Egg line whose ogg plays is logged as "clip", both while it plays and after it ended', async () => {
    const { recorder, manager } = setup();
    const done = manager.play(req('vo-fr-instruction'));
    await Promise.resolve();
    expect(recorder.getLines()[0].source).toBe('clip');
    (FakeAudio.last as FakeAudio).emit('ended');
    await done;
    expect(recorder.getLines()[0]).toMatchObject({ lineId: 'vo-fr-instruction', source: 'clip' });
  });

  it('[AC-25] a line whose file is already known to be missing is logged as "chime", not "tts"', async () => {
    const { availability, recorder, manager } = setup();
    availability.markMissing('vo-fr-instruction');
    await manager.play(req('vo-fr-instruction'));
    expect(recorder.getLines()[0].source).toBe('chime');
  });

  it('[AC-25] a file that fails to play (rejected play) ends as "chime"', async () => {
    const { recorder, manager } = setup(true);
    await manager.play(req('vo-he-robot-help-1'));
    expect(recorder.getLines()[0].source).toBe('chime');
  });

  it('[AC-25] a line that is not a Mystery Egg voice id still falls through to device speech and is logged as "tts"', async () => {
    const { recorder, manager } = setup();
    await manager.play(req('he.welcome'));
    expect(recorder.getLines()[0].source).toBe('tts');
  });
});

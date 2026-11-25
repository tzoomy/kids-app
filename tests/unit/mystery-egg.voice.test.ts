import { describe, expect, it, vi } from 'vitest';
import { AssetAvailability } from '../../src/games/mysteryEgg/assets';
import { MysteryEggVoiceProvider, type VoiceAudio } from '../../src/games/mysteryEgg/voiceProvider';

class FakeAudio implements VoiceAudio {
  static last: FakeAudio | null = null;
  readonly listeners = new Map<string, Array<() => void>>();
  paused = false;
  constructor(public readonly url: string, private readonly behaviour: 'play' | 'reject') {
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
    return this.behaviour === 'reject' ? Promise.reject(new Error('NotSupportedError')) : Promise.resolve();
  }
  pause(): void {
    this.paused = true;
  }
}

const req = (lineId: string) => ({ lineId, lang: 'fr' as const, text: 'x' });

function make(behaviour: 'play' | 'reject' = 'play') {
  const chime = vi.fn();
  const availability = new AssetAvailability();
  const provider = new MysteryEggVoiceProvider('/kids-app/', {
    createAudio: (url) => new FakeAudio(url, behaviour),
    chime,
    availability,
    timeoutMs: 50,
  });
  return { provider, chime, availability };
}

describe('mystery-egg voice provider (missing-file tolerance)', () => {
  it('[AC-15] lines that are not Mystery Egg voice ids are left to the next provider', async () => {
    const { provider } = make();
    expect(await provider.play(req('he.welcome'))).toBe(false);
    expect(await provider.play(req('sfx-bell'))).toBe(false);
  });

  it('[AC-15] a present file plays from the Vite base path and resolves true when it ends, with no chime', async () => {
    const { provider, chime, availability } = make();
    const p = provider.play(req('vo-fr-instruction'));
    await Promise.resolve();
    const audio = FakeAudio.last as FakeAudio;
    expect(audio.url).toBe('/kids-app/audio/mystery-egg/vo-fr-instruction.ogg');
    audio.emit('ended');
    expect(await p).toBe(true);
    expect(chime).not.toHaveBeenCalled();
    expect(availability.isMissing('vo-fr-instruction')).toBe(false);
  });

  it('[AC-15] a missing file (error event) is marked missing, a chime plays, and the line counts as handled (no device TTS)', async () => {
    const { provider, chime, availability } = make();
    const p = provider.play(req('vo-fr-instruction'));
    await Promise.resolve();
    (FakeAudio.last as FakeAudio).emit('error');
    expect(await p).toBe(true);
    expect(chime).toHaveBeenCalledTimes(1);
    expect(availability.isMissing('vo-fr-instruction')).toBe(true);
  });

  it('[AC-15] a rejected play() (404 or blocked) falls back to the chime without an unhandled rejection', async () => {
    const { provider, chime } = make('reject');
    expect(await provider.play(req('vo-he-robot-help-1'))).toBe(true);
    expect(chime).toHaveBeenCalledTimes(1);
  });

  it('[AC-15] a stuck clip settles after the timeout, and stop() settles a playing clip', async () => {
    const { provider } = make();
    expect(await provider.play(req('vo-fr-success'))).toBe(true);
    const p = provider.play(req('vo-fr-cat-croissants'));
    await Promise.resolve();
    const audio = FakeAudio.last as FakeAudio;
    provider.stop();
    expect(audio.paused).toBe(true);
    expect(await p).toBe(true);
  });

  it('[AC-15] a known missing file is not requested again on the next play (straight to the chime)', async () => {
    const { provider, chime, availability } = make();
    availability.markMissing('vo-fr-success');
    FakeAudio.last = null;
    expect(await provider.play(req('vo-fr-success'))).toBe(true);
    expect(FakeAudio.last).toBeNull();
    expect(chime).toHaveBeenCalledTimes(1);
  });
});

describe('mystery-egg sfx (missing-file tolerance)', () => {
  it('[AC-15] a missing sfx file is marked missing without an unhandled rejection, and is not requested again', async () => {
    const { playEggSfx } = await import('../../src/games/mysteryEgg/eggSound');
    const { eggAvailability } = await import('../../src/games/mysteryEgg/voiceProvider');
    const created: string[] = [];
    class RejectingAudio {
      volume = 1;
      constructor(public url: string) {
        created.push(url);
      }
      addEventListener(): void {}
      play(): Promise<void> {
        const err = new Error('The element has no supported sources.');
        err.name = 'NotSupportedError';
        return Promise.reject(err);
      }
    }
    vi.stubGlobal('Audio', RejectingAudio);
    try {
      playEggSfx('sfx-bell');
      await new Promise((r) => setTimeout(r, 0));
      expect(created).toEqual(['/audio/mystery-egg/sfx-bell.ogg']);
      expect(eggAvailability.isMissing('sfx-bell')).toBe(true);
      playEggSfx('sfx-bell');
      await new Promise((r) => setTimeout(r, 0));
      expect(created).toHaveLength(1);
    } finally {
      vi.unstubAllGlobals();
    }
  });

  it('[AC-15] a blocked autoplay (NotAllowedError) is silent and does not mark the file missing', async () => {
    const { playEggSfx } = await import('../../src/games/mysteryEgg/eggSound');
    const { eggAvailability } = await import('../../src/games/mysteryEgg/voiceProvider');
    class BlockedAudio {
      volume = 1;
      addEventListener(): void {}
      play(): Promise<void> {
        const err = new Error('blocked');
        err.name = 'NotAllowedError';
        return Promise.reject(err);
      }
    }
    vi.stubGlobal('Audio', BlockedAudio);
    try {
      playEggSfx('sfx-ball-roll');
      await new Promise((r) => setTimeout(r, 0));
      expect(eggAvailability.isMissing('sfx-ball-roll')).toBe(false);
    } finally {
      vi.unstubAllGlobals();
    }
  });
});

// Mystery Egg speech rate (docs/specs/mystery-egg.md AC-23, docs/specs/game-shell.md AC-27): in-game lines are requested at
// 1.2x, the slide voice-over (intro and world entry) at 1.0x; the voice provider applies the rate with natural pitch.
import { describe, expect, it, vi } from 'vitest';
import { AssetAvailability, mysteryEggManifest } from '../../src/games/mysteryEgg/assets';
import { GAME_SPEECH_RATE, SLIDE_SPEECH_RATE, eggSpeechRequest } from '../../src/games/mysteryEgg/speech';
import { MysteryEggVoiceProvider, type VoiceAudio } from '../../src/games/mysteryEgg/voiceProvider';

const voiceIds = Object.entries(mysteryEggManifest()).filter(([, e]) => e.kind === 'vo').map(([id]) => id);

describe('mystery-egg speech rate', () => {
  it('[AC-23] the in-game rate is one constant, 1.2, and the slide rate is 1.0', () => {
    expect(GAME_SPEECH_RATE).toBe(1.2);
    expect(SLIDE_SPEECH_RATE).toBe(1);
  });

  it('[AC-23] every in-game line (mission voice and help lines) requests 1.2', () => {
    const game = voiceIds.filter((id) => !id.startsWith('vo-shell-'));
    expect(game.length).toBeGreaterThan(5);
    for (const id of game) {
      const r = eggSpeechRequest(id, 'game');
      expect(r, id).not.toBeNull();
      expect(r?.rate, id).toBe(1.2);
    }
    expect(eggSpeechRequest('vo-fr-cat-croissants', 'game')).toMatchObject({ lineId: 'vo-fr-cat-croissants', lang: 'fr', rate: 1.2 });
    expect(eggSpeechRequest('vo-he-robot-help-1', 'game')).toMatchObject({ lang: 'he', rate: 1.2 });
  });

  it('[AC-27] every slide line (intro and world entry) requests 1.0', () => {
    const slides = voiceIds.filter((id) => id.startsWith('vo-shell-'));
    expect(slides.length).toBe(11);
    for (const id of slides) expect(eggSpeechRequest(id, 'slide')?.rate, id).toBe(1);
  });

  it('[AC-23] a line that is not a voice line has no request', () => {
    expect(eggSpeechRequest('sfx-bell', 'game')).toBeNull();
    expect(eggSpeechRequest('nope', 'slide')).toBeNull();
  });
});

class FakeAudio implements VoiceAudio {
  static last: FakeAudio | null = null;
  playbackRate = 1;
  preservesPitch = false;
  muted = false;
  constructor(public readonly url: string) {
    FakeAudio.last = this;
  }
  addEventListener(): void {}
  removeEventListener(): void {}
  play(): Promise<void> {
    return Promise.resolve();
  }
  pause(): void {}
}

describe('mystery-egg voice provider rate', () => {
  const make = () => new MysteryEggVoiceProvider('/kids-app/', { createAudio: (u) => new FakeAudio(u), chime: vi.fn(), availability: new AssetAvailability(), timeoutMs: 20 });

  it('[AC-23] the provider plays a request at its rate with natural pitch (preservesPitch set explicitly)', async () => {
    const p = make();
    void p.play({ lineId: 'vo-fr-success', lang: 'fr', text: 'x', rate: 1.2 });
    await Promise.resolve();
    expect(FakeAudio.last?.playbackRate).toBe(1.2);
    expect(FakeAudio.last?.preservesPitch).toBe(true);
    p.stop();
  });

  it('[AC-27] a request without a rate plays at 1.0x', async () => {
    const p = make();
    void p.play({ lineId: 'vo-shell-intro-1-hero', lang: 'fr', text: 'x' });
    await Promise.resolve();
    expect(FakeAudio.last?.playbackRate).toBe(1);
    expect(FakeAudio.last?.preservesPitch).toBe(true);
    p.stop();
  });

  it('[AC-23] a cut clip is muted as well as paused, so a late pause on a device can never be heard under the next line', async () => {
    const p = make();
    void p.play({ lineId: 'vo-fr-success', lang: 'fr', text: 'x', rate: 1.2 });
    await Promise.resolve();
    const first = FakeAudio.last as FakeAudio;
    p.stop();
    expect(first.muted).toBe(true);
  });
});

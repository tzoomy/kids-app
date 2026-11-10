import { describe, expect, it, vi, afterEach, beforeEach } from 'vitest';
import { DeviceTtsProvider, TTS_SAFETY_TIMEOUT_MS } from '@/core/audio/deviceTtsProvider';

describe('DeviceTtsProvider safety timeout', () => {
  beforeEach(() => {
    class FakeUtterance {
      text: string;
      lang = '';
      rate = 1;
      pitch = 1;
      voice = null;
      onend: (() => void) | null = null;
      onerror: (() => void) | null = null;
      constructor(text: string) {
        this.text = text;
      }
    }
    // jsdom does not implement the Web Speech API.
    vi.stubGlobal('SpeechSynthesisUtterance', FakeUtterance);
  });

  afterEach(() => {
    vi.useRealTimers();
    vi.unstubAllGlobals();
  });

  it('resolves false if onend/onerror never fire', async () => {
    vi.useFakeTimers();
    const speak = vi.fn();
    const cancel = vi.fn();
    vi.stubGlobal('speechSynthesis', { cancel, speak, getVoices: () => [] });
    Object.defineProperty(window, 'speechSynthesis', {
      configurable: true,
      value: { cancel, speak, getVoices: () => [] },
    });

    const provider = new DeviceTtsProvider();
    const pending = provider.play({ lineId: 'food.apple.1.en', lang: 'en', text: 'I want an apple, please!' });
    expect(speak).toHaveBeenCalled();
    vi.advanceTimersByTime(TTS_SAFETY_TIMEOUT_MS + 20);
    await expect(pending).resolves.toBe(false);
    expect(cancel).toHaveBeenCalled();
  });
});

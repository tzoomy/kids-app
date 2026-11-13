import type { AudioProvider, SpeechRequest } from './types';
import type { SpeechObserver } from './speechLog';

/**
 * Tries providers in priority order (static files first, device TTS fallback) and
 * stops at the first one that actually plays.
 *
 * Single-voice guarantee: every play() stops whatever is playing on all providers,
 * and a line that was superseded while one provider was still trying does not fall
 * through to the next provider (so a late static-file failure can never make device
 * TTS speak over a newer line).
 */
export class AudioManager {
  private generation = 0;
  private observer: SpeechObserver | null = null;

  constructor(private readonly providers: AudioProvider[]) {}

  /** Attaches a passive observer (e2e speech spy). It only watches; it never changes playback. */
  setObserver(observer: SpeechObserver | null): void {
    this.observer = observer;
  }

  warmup(): void {
    for (const p of this.providers) p.warmup();
  }

  stopAll(): void {
    this.generation++;
    for (const p of this.providers) p.stop();
  }

  async play(request: SpeechRequest): Promise<boolean> {
    this.stopAll();
    this.observer?.onRequest(request);
    const gen = this.generation;
    for (const provider of this.providers) {
      if (gen !== this.generation) return false;
      if (!provider.isAvailable()) continue;
      this.observer?.onAttempt(request, provider.id);
      const played = await provider.play(request);
      if (played) return true;
    }
    return false;
  }
}

import type { AudioProvider, SpeechRequest } from './types';

/**
 * Tries providers in priority order (static files first, device TTS fallback) and
 * stops at the first one that actually plays. Pluggable so static files can be
 * dropped in later without touching call sites.
 */
export class AudioManager {
  constructor(private readonly providers: AudioProvider[]) {}

  warmup(): void {
    for (const p of this.providers) p.warmup();
  }

  stopAll(): void {
    for (const p of this.providers) p.stop();
  }

  async play(request: SpeechRequest): Promise<boolean> {
    for (const provider of this.providers) {
      if (!provider.isAvailable()) continue;
      const played = await provider.play(request);
      if (played) return true;
    }
    return false;
  }
}

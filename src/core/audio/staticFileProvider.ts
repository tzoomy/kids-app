import type { AudioManifest, AudioProvider, SpeechRequest } from './types';

/**
 * Plays pre-rendered static voice clips (Gemini TTS, voice Leda) listed in the manifest.
 * Lines without a clip resolve false so the AudioManager falls back to device TTS.
 * The returned promise always settles: on end, on error, or when stop() interrupts it,
 * so callers can safely drive a "talking" animation off it.
 */
export class StaticFileProvider implements AudioProvider {
  readonly id = 'static-file';
  private current: HTMLAudioElement | null = null;
  private settleCurrent: ((played: boolean) => void) | null = null;

  constructor(
    private readonly manifest: AudioManifest,
    private readonly baseUrl = '',
  ) {}

  isAvailable(): boolean {
    return typeof Audio !== 'undefined';
  }

  has(lineId: string): boolean {
    return Boolean(this.manifest[lineId]);
  }

  warmup(): void {
    if (!this.isAvailable()) return;
    // Touch the Audio constructor so the first real play has less latency.
    try {
      const probe = new Audio();
      probe.muted = true;
      probe.volume = 0;
    } catch {
      // ignore — warmup is best-effort
    }
  }

  stop(): void {
    const audio = this.current;
    const settle = this.settleCurrent;
    this.current = null;
    this.settleCurrent = null;
    audio?.pause();
    // An interrupted clip counts as handled: do not fall back to device TTS.
    settle?.(true);
  }

  play(request: SpeechRequest): Promise<boolean> {
    if (!this.isAvailable()) return Promise.resolve(false);
    const path = this.manifest[request.lineId];
    if (!path) return Promise.resolve(false);

    // A new line interrupts the previous one.
    this.stop();

    return new Promise<boolean>((resolve) => {
      const audio = new Audio(this.baseUrl + path);
      let settled = false;
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        if (this.current === audio) {
          this.current = null;
          this.settleCurrent = null;
        }
        resolve(played);
      };
      const onEnded = () => finish(true);
      const onError = () => finish(false);
      this.current = audio;
      this.settleCurrent = finish;
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      if (request.rate && request.rate !== 1) audio.playbackRate = request.rate;
      audio.play().catch(() => finish(false));
    });
  }
}

import type { AudioManifest, AudioProvider, SpeechRequest } from './types';

/**
 * Plays pre-recorded/pre-rendered static audio files per the manifest.
 * Ready for real files later; until then every lookup 404s and the
 * AudioManager falls back to device TTS.
 */
export class StaticFileProvider implements AudioProvider {
  readonly id = 'static-file';
  private current: HTMLAudioElement | null = null;

  constructor(
    private readonly manifest: AudioManifest,
    private readonly baseUrl = '',
  ) {}

  isAvailable(): boolean {
    return typeof Audio !== 'undefined';
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
    this.current?.pause();
    this.current = null;
  }

  play(request: SpeechRequest): Promise<boolean> {
    if (!this.isAvailable()) return Promise.resolve(false);
    const path = this.manifest[request.lineId];
    if (!path) return Promise.resolve(false);

    return new Promise<boolean>((resolve) => {
      const audio = new Audio(this.baseUrl + path);
      this.current = audio;
      const cleanup = () => {
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
      };
      const onEnded = () => {
        cleanup();
        resolve(true);
      };
      const onError = () => {
        cleanup();
        resolve(false);
      };
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      audio.play().catch(() => {
        cleanup();
        resolve(false);
      });
    });
  }
}

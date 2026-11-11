import type { AudioManifest, AudioProvider, SpeechRequest } from './types';

/**
 * Plays pre-rendered static voice clips (Gemini TTS, voice Leda) listed in the manifest.
 * Lines without a clip resolve false so the AudioManager falls back to device TTS.
 * The returned promise always settles: on end, on error, or when stop() interrupts it,
 * so callers can safely drive a "talking" animation off it.
 */
/** Hard cap for one clip when its duration is unknown (the longest clip is about 10 s). */
export const STATIC_CLIP_HARD_TIMEOUT_MS = 15000;
/** Grace period added to a clip's known duration before it is treated as stuck. */
export const STATIC_CLIP_GRACE_MS = 1500;

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
      let timer: ReturnType<typeof setTimeout> | undefined;
      const arm = (ms: number) => {
        if (timer !== undefined) clearTimeout(timer);
        // A stalled load or an audio-focus pause must not leave the caller (and the
        // leisure "listening" flag) waiting forever: treat a stuck clip as finished.
        timer = setTimeout(() => {
          audio.pause();
          finish(true);
        }, ms);
      };
      const onMeta = () => {
        const d = audio.duration;
        if (Number.isFinite(d) && d > 0) {
          arm((d * 1000) / (audio.playbackRate || 1) + STATIC_CLIP_GRACE_MS);
        }
      };
      const finish = (played: boolean) => {
        if (settled) return;
        settled = true;
        if (timer !== undefined) clearTimeout(timer);
        audio.removeEventListener('ended', onEnded);
        audio.removeEventListener('error', onError);
        audio.removeEventListener('loadedmetadata', onMeta);
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
      audio.addEventListener('loadedmetadata', onMeta);
      arm(STATIC_CLIP_HARD_TIMEOUT_MS);
      if (request.rate && request.rate !== 1) audio.playbackRate = request.rate;
      audio.play().catch(() => finish(false));
    });
  }
}

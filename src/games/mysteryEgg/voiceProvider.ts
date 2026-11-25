// Mystery Egg voice provider: plays public/audio/mystery-egg/<id>.ogg for the `vo-*` ids of the asset manifest.
// A missing or unplayable file is NOT an error: the provider marks it missing, plays a short chime instead, and reports
// the line as handled, so the AudioManager does not fall through to device TTS (media come from the Gemini PR).
// The speech spy still sees every request (lineId + lang) because AudioManager notifies its observer first.
import type { AudioProvider, SpeechRequest } from '../../core/audio/types';
import { AssetAvailability, assetUrl, entriesOfKind } from './assets';
import { synthChime } from './placeholderSfx';

export interface VoiceAudio {
  addEventListener(type: string, listener: () => void): void;
  removeEventListener(type: string, listener: () => void): void;
  play(): Promise<void>;
  pause(): void;
}

export interface VoiceProviderOptions {
  createAudio?: (url: string) => VoiceAudio;
  chime?: () => void;
  availability?: AssetAvailability;
  /** Longest a clip may take before it counts as finished. */
  timeoutMs?: number;
}

const DEFAULT_TIMEOUT_MS = 15_000;

/** Shared with the scenes, so a voice file that failed once is not asked for again in this page session. */
export const eggAvailability = new AssetAvailability();

export class MysteryEggVoiceProvider implements AudioProvider {
  readonly id = 'mystery-egg-voice';
  private readonly voiceIds = new Set(entriesOfKind('vo').map(([id]) => id));
  private readonly createAudio: (url: string) => VoiceAudio;
  private readonly chime: () => void;
  private readonly availability: AssetAvailability;
  private readonly timeoutMs: number;
  private current: VoiceAudio | null = null;
  private settleCurrent: (() => void) | null = null;

  constructor(
    private readonly baseUrl: string,
    opts: VoiceProviderOptions = {},
  ) {
    this.createAudio = opts.createAudio ?? ((url) => new Audio(url));
    this.chime = opts.chime ?? synthChime;
    this.availability = opts.availability ?? eggAvailability;
    this.timeoutMs = opts.timeoutMs ?? DEFAULT_TIMEOUT_MS;
  }

  isAvailable(): boolean {
    return true;
  }

  warmup(): void {
    // Nothing to warm: clips are tiny and created on demand.
  }

  stop(): void {
    const settle = this.settleCurrent;
    this.current?.pause();
    this.current = null;
    this.settleCurrent = null;
    settle?.();
  }

  play(request: SpeechRequest): Promise<boolean> {
    if (!this.voiceIds.has(request.lineId)) return Promise.resolve(false);
    this.stop();
    if (this.availability.isMissing(request.lineId)) {
      this.chime();
      return Promise.resolve(true);
    }
    return new Promise<boolean>((resolve) => {
      let settled = false;
      let audio: VoiceAudio | null = null;
      let timer: ReturnType<typeof setTimeout> | undefined;
      const cleanup = (): void => {
        if (timer !== undefined) clearTimeout(timer);
        audio?.removeEventListener('ended', onEnded);
        audio?.removeEventListener('error', onError);
        if (this.current === audio) {
          this.current = null;
          this.settleCurrent = null;
        }
      };
      const finish = (): void => {
        if (settled) return;
        settled = true;
        cleanup();
        resolve(true);
      };
      const missing = (): void => {
        if (settled) return;
        this.availability.markMissing(request.lineId);
        this.chime();
        finish();
      };
      const onEnded = (): void => finish();
      const onError = (): void => missing();
      try {
        audio = this.createAudio(assetUrl(request.lineId, this.baseUrl));
      } catch {
        missing();
        return;
      }
      this.current = audio;
      this.settleCurrent = finish;
      audio.addEventListener('ended', onEnded);
      audio.addEventListener('error', onError);
      timer = setTimeout(finish, this.timeoutMs);
      audio.play().catch(() => missing());
    });
  }
}

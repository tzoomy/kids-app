export type SpeechLang = 'en' | 'fr' | 'he';

export interface SpeechRequest {
  /** Stable id used to look up a static audio file in the manifest, e.g. "food.apple.1.en" or "he.retry.0". */
  lineId: string;
  lang: SpeechLang;
  /** Fallback text for device TTS, and the only source of truth when no file exists yet. */
  text: string;
  rate?: number;
}

export interface AudioProvider {
  readonly id: string;
  isAvailable(): boolean;
  /** Resolves true if audio actually played, false if this provider could not handle it. */
  play(request: SpeechRequest): Promise<boolean>;
  /**
   * What the last `play()` really produced, for providers that can fall back to a placeholder: 'clip' = the recorded file,
   * 'chime' = the missing-file chime. Providers that never fall back leave it out.
   */
  playedSource?(): 'clip' | 'chime';
  /** Call after the first user gesture to reduce first-sound latency. */
  warmup(): void;
  stop(): void;
}

/** lineId -> relative static audio file path, ready for files that don't exist yet. */
export type AudioManifest = Record<string, string>;

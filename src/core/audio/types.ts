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
  /** Call after the first user gesture to reduce first-sound latency. */
  warmup(): void;
  stop(): void;
}

/** lineId -> relative static audio file path, ready for files that don't exist yet. */
export type AudioManifest = Record<string, string>;

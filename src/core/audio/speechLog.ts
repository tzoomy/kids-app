import type { SpeechRequest } from './types';

/** Passive observer of AudioManager.play(). Never influences what is spoken. */
export interface SpeechObserver {
  /** A line was requested (called synchronously at the start of play()). */
  onRequest(request: SpeechRequest): void;
  /** A provider is about to try the line; the last attempt for a request is the one that handled it. */
  onAttempt(request: SpeechRequest, providerId: string): void;
  /** The provider that handled the line says what it really played (only providers with a placeholder fallback report). */
  onOutcome?(request: SpeechRequest, providerId: string, source: 'clip' | 'chime'): void;
}

export interface SpokenLine {
  index: number;
  lineId: string;
  lang: string;
  /** 'clip' = a recorded file played, 'tts' = device speech synthesis, 'chime' = the missing-file placeholder chime. */
  source: 'clip' | 'tts' | 'chime';
  text?: string;
  /** The requested playback rate (1 = recorded speed); undefined when the caller did not ask for one. */
  rate?: number;
  /** Timestamp (ms, from the injected clock) when the line was requested. */
  at: number;
}

/** Providers that play recorded files: a line they handle counts as a clip until they report a chime instead. */
const CLIP_PROVIDER_IDS = new Set(['static-file', 'mystery-egg-voice']);

/** Records every requested spoken line (e2e only). */
export class SpeechRecorder implements SpeechObserver {
  private readonly lines: SpokenLine[] = [];
  private readonly byRequest = new WeakMap<SpeechRequest, SpokenLine>();

  constructor(private readonly clock: () => number = () => Date.now()) {}

  onRequest(request: SpeechRequest): void {
    // Provisional source 'tts'; the first provider attempt (synchronous for the static clip provider) refines it.
    const line: SpokenLine = {
      index: this.lines.length,
      lineId: request.lineId,
      lang: request.lang,
      source: 'tts',
      text: request.text,
      rate: request.rate,
      at: this.clock(),
    };
    this.lines.push(line);
    this.byRequest.set(request, line);
  }

  onAttempt(request: SpeechRequest, providerId: string): void {
    const line = this.byRequest.get(request);
    if (line) line.source = CLIP_PROVIDER_IDS.has(providerId) ? 'clip' : 'tts';
  }

  onOutcome(request: SpeechRequest, _providerId: string, source: 'clip' | 'chime'): void {
    const line = this.byRequest.get(request);
    if (line) line.source = source;
  }

  /** Lines with index >= sinceIndex (all lines by default). Returns copies. */
  getLines(sinceIndex = 0): SpokenLine[] {
    return this.lines.filter((l) => l.index >= sinceIndex).map((l) => ({ ...l }));
  }

  getCount(): number {
    return this.lines.length;
  }
}

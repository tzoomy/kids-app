import type { SpeechRequest } from './types';

/** Passive observer of AudioManager.play(). Never influences what is spoken. */
export interface SpeechObserver {
  /** A line was requested (called synchronously at the start of play()). */
  onRequest(request: SpeechRequest): void;
  /** A provider is about to try the line; the last attempt for a request is the one that handled it. */
  onAttempt(request: SpeechRequest, providerId: string): void;
}

export interface SpokenLine {
  index: number;
  lineId: string;
  lang: string;
  /** 'clip' = recorded static file, 'tts' = device speech synthesis fallback. */
  source: 'clip' | 'tts';
  text?: string;
  /** Timestamp (ms, from the injected clock) when the line was requested. */
  at: number;
}

const STATIC_PROVIDER_ID = 'static-file';

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
      at: this.clock(),
    };
    this.lines.push(line);
    this.byRequest.set(request, line);
  }

  onAttempt(request: SpeechRequest, providerId: string): void {
    const line = this.byRequest.get(request);
    if (line) line.source = providerId === STATIC_PROVIDER_ID ? 'clip' : 'tts';
  }

  /** Lines with index >= sinceIndex (all lines by default). Returns copies. */
  getLines(sinceIndex = 0): SpokenLine[] {
    return this.lines.filter((l) => l.index >= sinceIndex).map((l) => ({ ...l }));
  }

  getCount(): number {
    return this.lines.length;
  }
}

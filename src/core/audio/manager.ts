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
 *
 * play() interrupts (the new line takes the floor). playQueued() waits for the current clip, and for the clips queued
 * before it, to END and then plays; any interrupting play() or stopAll() drops the queued lines (they resolve false).
 * Either way at most one clip plays at a time.
 */
export class AudioManager {
  private generation = 0;
  /** Bumped by every interrupt (play, stopAll): queued lines of an older epoch are dropped. */
  private epoch = 0;
  /** Settles when the latest started or queued line is done. */
  private tail: Promise<unknown> = Promise.resolve();
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
    this.epoch++;
    this.halt();
  }

  /** Silences every provider and supersedes a line that is still trying (does not touch the queue). */
  private halt(): void {
    this.generation++;
    for (const p of this.providers) p.stop();
  }

  /** Interrupts whatever plays (and drops queued lines), then plays this line. */
  play(request: SpeechRequest): Promise<boolean> {
    this.epoch++;
    return this.track(this.run(request));
  }

  /**
   * Plays after the current clip and any lines queued before it have ended; dropped (false) if an interrupt comes first.
   * `onStart` runs at the moment the clip is actually requested (e.g. to show its speech cue then, not while it waits).
   */
  playQueued(request: SpeechRequest, onStart?: () => void): Promise<boolean> {
    const epoch = this.epoch;
    return this.track(this.tail.then(() => (epoch === this.epoch ? this.run(request, onStart) : false)));
  }

  private track(result: Promise<boolean>): Promise<boolean> {
    this.tail = result.catch(() => false);
    return result;
  }

  private async run(request: SpeechRequest, onStart?: () => void): Promise<boolean> {
    this.halt();
    this.observer?.onRequest(request);
    onStart?.();
    const gen = this.generation;
    for (const provider of this.providers) {
      if (gen !== this.generation) return false;
      if (!provider.isAvailable()) continue;
      this.observer?.onAttempt(request, provider.id);
      const played = await provider.play(request);
      if (played) {
        const source = provider.playedSource?.();
        if (source) this.observer?.onOutcome?.(request, provider.id, source);
        return true;
      }
    }
    return false;
  }
}

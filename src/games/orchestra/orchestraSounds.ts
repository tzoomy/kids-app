/** Synthesized kitchen-instrument notes. No audio files required. */
import type { OrchestraInstrumentId } from '../../content/schema';

const NOTES: Record<OrchestraInstrumentId, { freq: number; duration: number; type: OscillatorType; volume: number }> = {
  pot: { freq: 160, duration: 0.28, type: 'triangle', volume: 0.28 },
  pan: { freq: 220, duration: 0.22, type: 'square', volume: 0.16 },
  'glass-low': { freq: 392, duration: 0.38, type: 'sine', volume: 0.22 },
  'glass-mid': { freq: 523, duration: 0.36, type: 'sine', volume: 0.22 },
  'glass-high': { freq: 659, duration: 0.34, type: 'sine', volume: 0.2 },
};

export class OrchestraSounds {
  private ctx: AudioContext | null = null;

  warmup(): void {
    if (!this.ctx) {
      try {
        const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext: typeof AudioContext }).webkitAudioContext;
        this.ctx = new Ctor();
      } catch {
        this.ctx = null;
      }
    }
    if (this.ctx?.state === 'suspended') void this.ctx.resume();
  }

  play(id: OrchestraInstrumentId): void {
    this.warmup();
    const ctx = this.ctx;
    const note = NOTES[id];
    if (!ctx || !note) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = note.type;
    osc.frequency.value = note.freq;
    const start = ctx.currentTime;
    gain.gain.setValueAtTime(note.volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + note.duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + note.duration);
  }
}

export const INSTRUMENT_PITCH_HZ: Record<OrchestraInstrumentId, number> = {
  pot: NOTES.pot.freq,
  pan: NOTES.pan.freq,
  'glass-low': NOTES['glass-low'].freq,
  'glass-mid': NOTES['glass-mid'].freq,
  'glass-high': NOTES['glass-high'].freq,
};

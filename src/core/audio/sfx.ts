/** Short synthesized SFX (success, hint, pop, transition) — no files needed, warms up with first gesture. */
export class SfxPlayer {
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

  private tone(freq: number, duration = 0.15, type: OscillatorType = 'sine', delay = 0, volume = 0.25): void {
    const ctx = this.ctx;
    if (!ctx) return;
    const osc = ctx.createOscillator();
    const gain = ctx.createGain();
    osc.type = type;
    osc.frequency.value = freq;
    const start = ctx.currentTime + delay;
    gain.gain.setValueAtTime(volume, start);
    gain.gain.exponentialRampToValueAtTime(0.001, start + duration);
    osc.connect(gain).connect(ctx.destination);
    osc.start(start);
    osc.stop(start + duration);
  }

  yay(): void {
    [523, 659, 784, 1047].forEach((f, i) => this.tone(f, 0.2, 'triangle', i * 0.09));
  }

  hint(): void {
    this.tone(440, 0.12, 'triangle', 0, 0.2);
  }

  pop(): void {
    this.tone(600 + Math.random() * 500, 0.08, 'square', 0, 0.12);
  }

  tap(): void {
    this.tone(440, 0.06, 'triangle', 0, 0.15);
  }

  end(): void {
    [784, 659, 523].forEach((f, i) => this.tone(f, 0.35, 'sine', i * 0.25));
  }
}

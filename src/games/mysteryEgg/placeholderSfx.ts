// Mystery Egg placeholder sounds: short WebAudio beeps and chimes used while a real sfx or voice file is missing.
// Never throws: with no AudioContext (or blocked autoplay) every call is a silent no-op.
let ctx: AudioContext | null = null;

function context(): AudioContext | null {
  if (!ctx) {
    try {
      const Ctor = window.AudioContext ?? (window as unknown as { webkitAudioContext?: typeof AudioContext }).webkitAudioContext;
      if (!Ctor) return null;
      ctx = new Ctor();
    } catch {
      return null;
    }
  }
  if (ctx.state === 'suspended') void ctx.resume().catch(() => undefined);
  return ctx;
}

function tone(freq: number, duration: number, type: OscillatorType, delay = 0, volume = 0.18): void {
  try {
    const c = context();
    if (!c) return;
    const t0 = c.currentTime + delay;
    const osc = c.createOscillator();
    const gain = c.createGain();
    osc.type = type;
    osc.frequency.setValueAtTime(freq, t0);
    gain.gain.setValueAtTime(0.0001, t0);
    gain.gain.exponentialRampToValueAtTime(volume, t0 + 0.015);
    gain.gain.exponentialRampToValueAtTime(0.0001, t0 + duration);
    osc.connect(gain).connect(c.destination);
    osc.start(t0);
    osc.stop(t0 + duration + 0.05);
  } catch {
    // Placeholder audio is best-effort.
  }
}

/** Soft two-note chime: stands in for a voice line whose file is missing. */
export function synthChime(): void {
  tone(660, 0.18, 'sine');
  tone(880, 0.28, 'sine', 0.14);
}

/** Bell ring (sfx-bell). */
export function synthBell(): void {
  tone(1046, 0.9, 'sine', 0, 0.22);
  tone(1568, 0.6, 'triangle', 0, 0.08);
}

/** Robot beeps (sfx-robot-beep-1..3). */
export function synthBeep(n: 1 | 2 | 3): void {
  const freqs = { 1: [520, 780], 2: [640], 3: [440, 660, 880] }[n];
  freqs.forEach((f, i) => tone(f, 0.09, 'square', i * 0.1, 0.07));
}

/** Short rumble (sfx-ball-roll). */
export function synthRoll(): void {
  tone(110, 0.35, 'sawtooth', 0, 0.05);
}

/** Soft pop (sfx-pop): a part snaps in, confetti bursts. */
export function synthPop(): void {
  tone(520, 0.08, 'sine', 0, 0.16);
  tone(780, 0.06, 'sine', 0.03, 0.08);
}

/** Four-note success chime (sfx-success). */
export function synthSuccess(): void {
  [523, 659, 784, 1046].forEach((f, i) => tone(f, 0.28, 'triangle', i * 0.13, 0.14));
}

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

// --- Workshop L20 placeholders (docs/specs/workshop-l20-assets.md, section 4): short synths until Gemini's files land. ---

/** Wood click (sfx-ws-trapdoor). */
export function synthTrapdoor(): void {
  tone(180, 0.07, 'square', 0, 0.1);
  tone(120, 0.09, 'triangle', 0.04, 0.1);
}

/** Scissors: a click pair (sfx-ws-snip). */
export function synthSnip(): void {
  tone(1400, 0.05, 'square', 0, 0.08);
  tone(1000, 0.06, 'square', 0.12, 0.08);
}

/** Rope swish (sfx-ws-rope-swish). */
export function synthSwish(): void {
  tone(600, 0.25, 'sawtooth', 0, 0.025);
  tone(300, 0.25, 'sawtooth', 0.05, 0.02);
}

/** Dry wood tick (sfx-ws-domino-clack); `pitch` 0.92..1.08 varies it so a row sounds like a cascade. */
export function synthClack(pitch = 1): void {
  tone(900 * pitch, 0.05, 'square', 0, 0.09);
  tone(500 * pitch, 0.06, 'triangle', 0.01, 0.08);
}

/** Soft heavy thud (sfx-ws-sandbag-thump). */
export function synthThump(): void {
  tone(70, 0.4, 'sine', 0, 0.3);
  tone(110, 0.25, 'triangle', 0, 0.12);
}

/** Wood creak (sfx-ws-seesaw-creak). */
export function synthCreak(): void {
  tone(220, 0.3, 'sawtooth', 0, 0.04);
  tone(260, 0.2, 'sawtooth', 0.15, 0.04);
}

/** Deep warm morning bell with a long tail (sfx-ws-bell-morning). */
export function synthMorningBell(): void {
  tone(196, 2.0, 'sine', 0, 0.28);
  tone(392, 1.4, 'sine', 0, 0.1);
  tone(588, 0.9, 'triangle', 0, 0.05);
}

/** Light metal clonk (sfx-ws-lantern-clonk). */
export function synthClonk(): void {
  tone(740, 0.12, 'triangle', 0, 0.12);
  tone(1110, 0.08, 'square', 0, 0.04);
}

/** Morning flourish (sfx-ws-town-wake): rising notes and a little ta-da. */
export function synthTownWake(): void {
  [523, 659, 784, 1046, 1318].forEach((f, i) => tone(f, 0.3, 'triangle', i * 0.18, 0.12));
  tone(1568, 0.6, 'sine', 0.95, 0.1);
}

/** A cute yawn: a falling slide (sfx-ws-yawn). */
export function synthYawn(): void {
  [500, 440, 380, 320, 260].forEach((f, i) => tone(f, 0.22, 'sine', i * 0.16, 0.1));
}

/** A soft snore (sfx-ws-snore), quiet. */
export function synthSnore(): void {
  tone(90, 0.5, 'sawtooth', 0, 0.02);
  tone(80, 0.5, 'sawtooth', 0.6, 0.02);
}

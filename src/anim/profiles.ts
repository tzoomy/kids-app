// All animation feel knobs in one data object. Design can tune amplitudes, durations
// and easings here without touching any logic. Durations are ms, distances are px at
// the character's display scale unless noted, angles are degrees.
// Easing names are Phaser ease strings (https://docs.phaser.io/api-documentation/namespace/math-easing).

export const ANIM_PROFILE = {
  /** Amplitude multiplier applied when the OS asks for reduced motion (0..1). */
  reducedMotionFactor: 0.3,

  squash: { scaleX: 1.14, scaleY: 0.86, duration: 110, ease: 'Quad.easeOut' },
  stretch: { scaleX: 0.9, scaleY: 1.12, duration: 140, ease: 'Quad.easeOut' },
  press: { scaleX: 1.08, scaleY: 0.9, duration: 80, release: 220, releaseEase: 'Back.easeOut' },
  popIn: { from: 0, duration: 380, ease: 'Back.easeOut', overshoot: 2.2, stagger: 95 },
  popOut: { duration: 200, ease: 'Back.easeIn' },
  bounce: { height: 26, duration: 420, ease: 'Sine.easeOut' },
  wobble: { angle: 7, duration: 90, repeats: 3, ease: 'Sine.easeInOut' },
  shakeSoft: { distance: 6, duration: 70, repeats: 2, ease: 'Sine.easeInOut' },
  float: { distance: 8, duration: 1800, ease: 'Sine.easeInOut' },
  invite: { scale: 1.035, duration: 1100, ease: 'Sine.easeInOut' },
  hint: { scale: 1.14, duration: 260, repeats: 2, ease: 'Sine.easeInOut' },
  flyArc: { duration: 520, height: 170, endScale: 0.45, stagger: 110, ease: 'Sine.easeIn' },

  character: {
    enter: { duration: 680, hops: 3, hopHeight: 42, ease: 'Linear' },
    exit: { duration: 520, hops: 2, hopHeight: 36, waveAngle: 9, waveDuration: 110, waveRepeats: 1 },
    breath: { scaleX: 0.988, scaleY: 1.022, duration: 1400, ease: 'Sine.easeInOut' },
    sway: { angle: 1.6, duration: 2200, ease: 'Sine.easeInOut' },
    blink: { minDelay: 2000, maxDelay: 5000, closedFor: 120 },
    ear: { angle: 12, duration: 110, repeats: 1, minDelay: 3500, maxDelay: 8000 },
    tail: { angle: 14, duration: 160, repeats: 2, minDelay: 3000, maxDelay: 7000 },
    talk: { flapMs: 130, nodAngle: 2.5, nodDuration: 260 },
    happy: { jumpHeight: 60, duration: 760, hearts: 6, spinAngle: 0 },
    munch: { duration: 820, chewMs: 120, chewScaleY: 0.94, crumbs: 6 },
    hmm: { headAngle: 11, bodyAngle: 5, duration: 900, ease: 'Sine.easeInOut' },
    poke: { scaleX: 1.06, scaleY: 0.94, duration: 90 },
  },

  particles: {
    maxPerEmitter: 48,
    star: { count: 10, speedMin: 180, speedMax: 380, lifespan: 750, scaleStart: 0.7, gravityY: 300 },
    sparkle: { count: 8, speedMin: 60, speedMax: 180, lifespan: 600, scaleStart: 0.55, gravityY: 0 },
    heart: { count: 6, speedMin: 70, speedMax: 150, lifespan: 1100, scaleStart: 0.6, gravityY: -120 },
    crumb: { count: 8, speedMin: 110, speedMax: 230, lifespan: 650, scaleStart: 0.62, gravityY: 480 },
    confetti: { count: 18, speedMin: 220, speedMax: 460, lifespan: 1300, scaleStart: 0.5, gravityY: 520 },
  },

  transition: { duration: 320, color: 0xfde9d9 },

  /** Who's Hiding? peek / rustle / reveal. Used by worldMotion helpers and the art preview. */
  hiding: {
    rustle: { angle: 8, duration: 90, repeats: 3, ease: 'Sine.easeInOut' },
    peek: { rise: 52, duration: 420, ease: 'Back.easeOut' },
    reveal: { rise: 130, duration: 480, ease: 'Back.easeOut' },
    hide: { duration: 280, ease: 'Sine.easeIn' },
  },

  /** Kitchen Orchestra instrument tap / glow. Chef idle/react reuse character + press/happy/hmm. */
  orchestra: {
    glow: { duration: 320, alpha: 1, ease: 'Sine.easeInOut' },
    glowPulse: { duration: 900, ease: 'Sine.easeInOut' },
  },

  // Puppet Says (Language House) — pose knobs only; no game logic.
  puppet: {
    jump: { height: 72, duration: 520, stretch: 1.1, ease: 'Quad.easeOut' },
    clap: { distance: 78, duration: 180, repeats: 3, ease: 'Sine.easeInOut' },
    wave: { angle: 28, duration: 200, repeats: 4, ease: 'Sine.easeInOut' },
    sleep: { headAngle: 12, duration: 640, ease: 'Sine.easeInOut' },
    dance: { hop: 18, duration: 280, ease: 'Sine.easeInOut' },
  },

  // Color the World (Art Studio) — fill / splash knobs only; no game logic.
  color: {
    fill: { duration: 280, ease: 'Quad.easeOut' },
    splash: { scale: 1.35, duration: 320, ease: 'Back.easeOut' },
    burst: { duration: 420, ease: 'Quad.easeOut' },
  },

  /** Who Lives Here? walk-home and settle-in. */
  homes: {
    walk: { duration: 700, bob: 10, ease: 'Sine.easeInOut' },
    settle: { duration: 420, scale: 0.86, ease: 'Back.easeOut' },
  },

  /** Picnic Train chug, arrive, and hand-out. */
  train: {
    chug: { bob: 8, duration: 180, ease: 'Sine.easeInOut' },
    arrive: { duration: 800, ease: 'Sine.easeOut' },
    handOut: { duration: 520, arcHeight: 110, endScale: 0.7, ease: 'Sine.easeIn' },
  },

  /** Sorting Beds (docs/specs/sorting-beds.md): flower drop into a bed, soil settle, rule-sign flip on the L8 switch. */
  sorting: {
    drop: { duration: 520, arcHeight: 120, endScale: 0.92, ease: 'Sine.easeIn' },
    settle: { duration: 280, squash: 0.9, ease: 'Back.easeOut' },
    ruleSwitch: { duration: 480, ease: 'Sine.easeInOut' },
  },

  /** Colouring Time fill flash. Clipped to the region; never scale (AC-24). */
  colouring: {
    fill: { durationMs: 280, flashFrom: 0.7 },
  },

  /** Travel Suitcase pack-into-case and landing bounce. */
  suitcase: {
    pack: { duration: 560, arcHeight: 140, endScale: 0.88, ease: 'Sine.easeIn' },
    bounce: { height: 22, duration: 360, ease: 'Sine.easeOut' },
  },
} as const;

export type AnimProfile = typeof ANIM_PROFILE;
export type ParticleKind = keyof AnimProfile['particles'] & ('star' | 'sparkle' | 'heart' | 'crumb' | 'confetti');
export const PARTICLE_KINDS: readonly ParticleKind[] = ['star', 'sparkle', 'heart', 'crumb', 'confetti'];

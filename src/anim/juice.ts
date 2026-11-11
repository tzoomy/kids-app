// Pooled particle "juice" (stars, sparkles, hearts, crumbs, confetti). One emitter per
// kind per scene, created lazily, capped with maxAliveParticles; Phaser pools the
// particles internally. Textures come from the art registry when loaded, otherwise a
// simple texture is generated once per game and reused (no per-frame Graphics).
import Phaser from 'phaser';
import { ANIM_PROFILE as P, type ParticleKind } from './profiles';
import { ampCount } from './motion';
import { fxArtKey } from './artRegistry';
import { PALETTE } from '../assets/colors';

const FX_SIZE = 64;
const CONFETTI_TINTS = [PALETTE.yellow, PALETTE.pink, PALETTE.blue, PALETTE.green, PALETTE.orange, PALETTE.purple];

function starPoints(cx: number, cy: number, outer: number, inner: number, points: number): Phaser.Math.Vector2[] {
  const out: Phaser.Math.Vector2[] = [];
  for (let i = 0; i < points * 2; i++) {
    const r = i % 2 === 0 ? outer : inner;
    const a = -Math.PI / 2 + (i * Math.PI) / points;
    out.push(new Phaser.Math.Vector2(cx + Math.cos(a) * r, cy + Math.sin(a) * r));
  }
  return out;
}

function generateFallback(scene: Phaser.Scene, kind: ParticleKind, key: string): void {
  const g = scene.make.graphics({ x: 0, y: 0 }, false);
  const c = FX_SIZE / 2;
  const outline = PALETTE.outline;
  switch (kind) {
    case 'star': {
      const pts = starPoints(c, c + 2, 28, 13, 5);
      g.fillStyle(PALETTE.yellow, 1).fillPoints(pts, true);
      g.lineStyle(4, outline, 1).strokePoints(pts, true, true);
      g.fillStyle(0xffffff, 0.6).fillCircle(c - 6, c - 4, 4);
      break;
    }
    case 'sparkle': {
      const pts = starPoints(c, c, 28, 7, 4);
      g.fillStyle(0xfff6b0, 1).fillPoints(pts, true);
      break;
    }
    case 'heart': {
      g.fillStyle(PALETTE.pink, 1);
      g.fillCircle(c - 12, c - 6, 15);
      g.fillCircle(c + 12, c - 6, 15);
      g.fillTriangle(c - 26, c, c + 26, c, c, c + 26);
      g.fillStyle(0xffffff, 0.55).fillCircle(c - 14, c - 10, 5);
      break;
    }
    case 'crumb': {
      g.fillStyle(0xe0a36a, 1).fillCircle(c, c, 14);
      g.lineStyle(3, 0xa86b35, 1).strokeCircle(c, c, 14);
      break;
    }
    case 'confetti': {
      g.fillStyle(0xffffff, 1).fillRoundedRect(c - 10, c - 16, 20, 32, 5);
      break;
    }
  }
  g.generateTexture(key, FX_SIZE, FX_SIZE);
  g.destroy();
}

/** Resolves (and if needed generates) the texture key for a particle kind. */
export function fxTextureKey(scene: Phaser.Scene, kind: ParticleKind): string {
  if (kind !== 'confetti') {
    const registered = fxArtKey(kind);
    if (registered && scene.textures.exists(registered)) return registered;
  }
  const key = `fx-fallback-${kind}`;
  if (!scene.textures.exists(key)) generateFallback(scene, kind, key);
  return key;
}

const instances = new WeakMap<Phaser.Scene, Juice>();

export class Juice {
  private readonly emitters = new Map<ParticleKind, Phaser.GameObjects.Particles.ParticleEmitter>();
  private dead = false;

  /** Per-scene singleton, cleaned up automatically on scene shutdown. */
  static for(scene: Phaser.Scene): Juice {
    let j = instances.get(scene);
    if (!j || j.dead) {
      j = new Juice(scene);
      instances.set(scene, j);
    }
    return j;
  }

  private constructor(private readonly scene: Phaser.Scene, private readonly depth = 900) {
    scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.destroy());
  }

  private emitter(kind: ParticleKind): Phaser.GameObjects.Particles.ParticleEmitter {
    let e = this.emitters.get(kind);
    if (e) return e;
    const cfg = P.particles[kind];
    const upward = kind === 'heart';
    e = this.scene.add.particles(0, 0, fxTextureKey(this.scene, kind), {
      emitting: false,
      maxAliveParticles: P.particles.maxPerEmitter,
      lifespan: cfg.lifespan,
      speed: { min: cfg.speedMin, max: cfg.speedMax },
      angle: upward ? { min: 235, max: 305 } : { min: 0, max: 360 },
      scale: { start: cfg.scaleStart, end: kind === 'heart' ? cfg.scaleStart * 0.8 : 0 },
      alpha: { start: 1, end: 0, ease: 'Quad.easeIn' },
      rotate: kind === 'heart' ? { min: -15, max: 15 } : { min: -180, max: 180 },
      gravityY: cfg.gravityY,
      tint: kind === 'confetti' ? CONFETTI_TINTS : 0xffffff,
    });
    e.setDepth(this.depth);
    this.emitters.set(kind, e);
    return e;
  }

  /** Emits a burst at (x, y). Count defaults to the profile and scales with reduced motion. */
  burst(kind: ParticleKind, x: number, y: number, count?: number): void {
    if (this.dead) return;
    const n = ampCount(count ?? P.particles[kind].count);
    this.emitter(kind).explode(n, x, y);
  }

  destroy(): void {
    if (this.dead) return;
    this.dead = true;
    for (const e of this.emitters.values()) e.destroy();
    this.emitters.clear();
    instances.delete(this.scene);
  }
}

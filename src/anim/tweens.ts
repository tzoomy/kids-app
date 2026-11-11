// Small, reusable tween/timeline helpers. Every amplitude comes from ANIM_PROFILE and
// is scaled by the global reduced-motion factor. Helpers return Promises that resolve
// when the motion completes (or is stopped), so game flow can `await` them.
// Animated objects are expected to rest at scale 1 / angle 0 unless stated otherwise.
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { amp, ampScale } from './motion';
import { arcPoint, type Point } from './arc';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
type AnyTween = Phaser.Tweens.Tween | Phaser.Tweens.TweenChain;

function done(tween: AnyTween): Promise<void> {
  return new Promise((resolve) => {
    tween.once(Phaser.Tweens.Events.TWEEN_COMPLETE, () => resolve());
    tween.once(Phaser.Tweens.Events.TWEEN_STOP, () => resolve());
  });
}

/** Wraps `scene.tweens.add` in a Promise. */
export function tweenAsync(scene: Phaser.Scene, config: Phaser.Types.Tweens.TweenBuilderConfig): Promise<void> {
  return done(scene.tweens.add(config));
}

/** A chain step; `targets` may be omitted to inherit the chain's targets (Phaser supports this). */
export type ChainStep = Omit<Phaser.Types.Tweens.TweenBuilderConfig, 'targets'> & { targets?: unknown };
export type ChainConfig = Omit<Phaser.Types.Tweens.TweenChainBuilderConfig, 'targets' | 'tweens'> & {
  targets?: unknown;
  tweens: ChainStep[];
};

/** Typed wrapper over `scene.tweens.chain` that allows steps without their own targets. */
export function chain(scene: Phaser.Scene, config: ChainConfig): Phaser.Tweens.TweenChain {
  return scene.tweens.chain(config as Phaser.Types.Tweens.TweenChainBuilderConfig);
}

/** Wraps `chain` in a Promise. */
export function chainAsync(scene: Phaser.Scene, config: ChainConfig): Promise<void> {
  return done(chain(scene, config));
}

/** Waits on the scene clock (pauses with the scene, cleared on shutdown). */
export function wait(scene: Phaser.Scene, ms: number): Promise<void> {
  return new Promise((resolve) => {
    scene.time.delayedCall(ms, () => resolve());
  });
}

/**
 * Stops only the tweens on `target` that animate one of `props`, so e.g. a press squash
 * (scale) does not cancel an idle float (y) running on the same object.
 */
export function killTweensOfProps(scene: Phaser.Scene, target: object, props: readonly string[]): void {
  for (const t of scene.tweens.getTweensOf(target)) {
    const data = (t as Phaser.Tweens.Tween).data as { key?: string }[] | undefined;
    if (data?.some((d) => d.key !== undefined && props.includes(d.key))) t.stop();
  }
}

const SCALE_PROPS = ['scale', 'scaleX', 'scaleY'] as const;

/** Anticipation squash, stretch, then a springy settle back to rest scale. */
export function squashStretch(scene: Phaser.Scene, target: Target, restX = 1, restY = 1): Promise<void> {
  killTweensOfProps(scene, target, SCALE_PROPS);
  return chainAsync(scene, {
    targets: target,
    tweens: [
      { scaleX: restX * ampScale(P.squash.scaleX), scaleY: restY * ampScale(P.squash.scaleY), duration: P.squash.duration, ease: P.squash.ease },
      { scaleX: restX * ampScale(P.stretch.scaleX), scaleY: restY * ampScale(P.stretch.scaleY), duration: P.stretch.duration, ease: P.stretch.ease },
      { scaleX: restX, scaleY: restY, duration: 260, ease: 'Back.easeOut' },
    ],
  });
}

/** Quick press-down squash for tap feedback, releasing with a little overshoot. */
export function pressSquash(scene: Phaser.Scene, target: Target, restX = 1, restY = 1): Promise<void> {
  killTweensOfProps(scene, target, SCALE_PROPS);
  return chainAsync(scene, {
    targets: target,
    tweens: [
      { scaleX: restX * ampScale(P.press.scaleX), scaleY: restY * ampScale(P.press.scaleY), duration: P.press.duration, ease: 'Quad.easeOut' },
      { scaleX: restX, scaleY: restY, duration: P.press.release, ease: P.press.releaseEase },
    ],
  });
}

/** Grows from nothing with an overshoot. Pass `delay` to stagger a group. */
export function popIn(scene: Phaser.Scene, target: Target, delay = 0, restScale = 1): Promise<void> {
  target.setScale(P.popIn.from);
  return tweenAsync(scene, {
    targets: target,
    scale: restScale,
    delay,
    duration: P.popIn.duration,
    ease: P.popIn.ease,
    easeParams: [P.popIn.overshoot],
  });
}

/** Shrinks away with a small anticipation. */
export function popOut(scene: Phaser.Scene, target: Target, delay = 0): Promise<void> {
  scene.tweens.killTweensOf(target);
  return tweenAsync(scene, { targets: target, scale: 0, delay, duration: P.popOut.duration, ease: P.popOut.ease });
}

/** Single hop up and back down from the current y, with a squash on landing. */
export function bounce(scene: Phaser.Scene, target: Target, height: number = P.bounce.height): Promise<void> {
  const baseY = target.y;
  const half = P.bounce.duration / 2;
  return chainAsync(scene, {
    targets: target,
    tweens: [
      { y: baseY - amp(height), duration: half, ease: 'Quad.easeOut' },
      { y: baseY, duration: half, ease: 'Quad.easeIn' },
    ],
  });
}

/** Soft decaying rotation wobble ("not this one"), never harsh. */
export function wobble(scene: Phaser.Scene, target: Target): Promise<void> {
  const a = amp(P.wobble.angle);
  const steps: ChainStep[] = [];
  let sign = 1;
  for (let i = 0; i <= P.wobble.repeats; i++) {
    const decay = 1 - i / (P.wobble.repeats + 1);
    steps.push({ targets: target, angle: sign * a * decay, duration: P.wobble.duration, ease: P.wobble.ease });
    sign = -sign;
  }
  steps.push({ targets: target, angle: 0, duration: P.wobble.duration, ease: P.wobble.ease });
  return chainAsync(scene, { tweens: steps });
}

/** Gentle horizontal shake around the current x. */
export function shakeSoft(scene: Phaser.Scene, target: Target): Promise<void> {
  const baseX = target.x;
  return tweenAsync(scene, {
    targets: target,
    x: baseX + amp(P.shakeSoft.distance),
    duration: P.shakeSoft.duration,
    yoyo: true,
    repeat: P.shakeSoft.repeats,
    ease: P.shakeSoft.ease,
    onComplete: () => target.setX(baseX),
    onStop: () => target.setX(baseX),
  });
}

/** Endless gentle float around the current y. Returns the tween so callers can stop it. */
export function floatIdle(scene: Phaser.Scene, target: Target, distance: number = P.float.distance, duration: number = P.float.duration): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    y: target.y - amp(distance),
    duration,
    yoyo: true,
    repeat: -1,
    ease: P.float.ease,
    delay: Math.random() * 300,
  });
}

/** Endless subtle "tap me" breathing scale. Returns the tween. */
export function invitePulse(scene: Phaser.Scene, target: Target, delay = 0): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: target,
    scale: ampScale(P.invite.scale),
    duration: P.invite.duration,
    yoyo: true,
    repeat: -1,
    delay,
    ease: P.invite.ease,
  });
}

/** A few friendly scale pulses to point at the right answer. */
export function hintPulse(scene: Phaser.Scene, target: Target, restScale = 1): Promise<void> {
  return tweenAsync(scene, {
    targets: target,
    scale: restScale * Math.max(1.04, ampScale(P.hint.scale)),
    duration: P.hint.duration,
    yoyo: true,
    repeat: P.hint.repeats,
    ease: P.hint.ease,
    onComplete: () => target.setScale(restScale),
  });
}

export interface FlyArcOptions {
  duration?: number;
  height?: number;
  endScale?: number;
  delay?: number;
  /** Spin while flying, degrees. */
  spin?: number;
}

/**
 * Flies `target` from its current position to (toX, toY) along an arc, shrinking toward
 * `endScale`. Position is computed per frame into a reused point (no allocations).
 */
export function flyArc(scene: Phaser.Scene, target: Target, toX: number, toY: number, opts: FlyArcOptions = {}): Promise<void> {
  const fromX = target.x;
  const fromY = target.y;
  const startScale = target.scaleX;
  const endScale = startScale * (opts.endScale ?? P.flyArc.endScale);
  const height = Math.max(40, amp(opts.height ?? P.flyArc.height));
  const spin = amp(opts.spin ?? 0);
  const startAngle = target.angle;
  const pt: Point = { x: fromX, y: fromY };
  return tweenAsync(scene, {
    targets: { t: 0 },
    t: 1,
    delay: opts.delay ?? 0,
    duration: opts.duration ?? P.flyArc.duration,
    ease: P.flyArc.ease,
    onUpdate: (tween) => {
      const t = tween.getValue() ?? 0;
      arcPoint(t, fromX, fromY, toX, toY, height, pt);
      target.setPosition(pt.x, pt.y);
      target.setScale(startScale + (endScale - startScale) * t);
      if (spin) target.setAngle(startAngle + spin * t);
    },
  });
}

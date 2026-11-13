/**
 * Puppet Says pose helpers and Color the World fill / splash helpers.
 * These reuse the shared tween helpers and ANIM_PROFILE knobs so later
 * game scenes can call them without a second stack. No game logic lives here.
 */
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { amp } from './motion';
import { tweenAsync } from './tweens';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
type AlphaTarget = Target & Phaser.GameObjects.Components.Alpha;

/** Hop the whole puppet up and back down (jump verb). */
export async function jumpPuppet(scene: Phaser.Scene, puppet: Target): Promise<void> {
  const startY = puppet.y;
  const height = amp(P.puppet.jump.height);
  const half = P.puppet.jump.duration / 2;
  const stretch = P.puppet.jump.stretch;
  const startSX = puppet.scaleX;
  const startSY = puppet.scaleY;
  await tweenAsync(scene, {
    targets: puppet,
    y: startY - height,
    scaleX: startSX * (2 - stretch),
    scaleY: startSY * stretch,
    duration: half,
    ease: P.puppet.jump.ease,
  });
  await tweenAsync(scene, {
    targets: puppet,
    y: startY,
    scaleX: startSX,
    scaleY: startSY,
    duration: half,
    ease: P.puppet.jump.ease,
  });
}

/** Bring two hands together a few times (clap verb). */
export async function clapHands(scene: Phaser.Scene, left: Target, right: Target): Promise<void> {
  const leftX = left.x;
  const rightX = right.x;
  const inward = amp(P.puppet.clap.distance);
  const meetLeft = Math.min(leftX + inward, (leftX + rightX) / 2 - 8);
  const meetRight = Math.max(rightX - inward, (leftX + rightX) / 2 + 8);
  for (let i = 0; i < P.puppet.clap.repeats; i++) {
    await Promise.all([
      tweenAsync(scene, { targets: left, x: meetLeft, duration: P.puppet.clap.duration, ease: P.puppet.clap.ease }),
      tweenAsync(scene, { targets: right, x: meetRight, duration: P.puppet.clap.duration, ease: P.puppet.clap.ease }),
    ]);
    await Promise.all([
      tweenAsync(scene, { targets: left, x: leftX, duration: P.puppet.clap.duration, ease: P.puppet.clap.ease }),
      tweenAsync(scene, { targets: right, x: rightX, duration: P.puppet.clap.duration, ease: P.puppet.clap.ease }),
    ]);
  }
}

/** Wave one hand (wave verb). */
export async function waveHand(scene: Phaser.Scene, hand: Target): Promise<void> {
  const start = hand.angle;
  const angle = amp(P.puppet.wave.angle);
  await tweenAsync(scene, {
    targets: hand,
    angle: start + angle,
    duration: P.puppet.wave.duration,
    yoyo: true,
    repeat: P.puppet.wave.repeats,
    ease: P.puppet.wave.ease,
  });
  await tweenAsync(scene, {
    targets: hand,
    angle: start,
    duration: P.puppet.wave.duration,
    ease: P.puppet.wave.ease,
  });
}

/** Tilt the head into a rest / sleep pose. Swap eye/mouth textures in the scene. */
export function sleepPuppet(scene: Phaser.Scene, head: Target): Promise<void> {
  return tweenAsync(scene, {
    targets: head,
    angle: amp(P.puppet.sleep.headAngle),
    duration: P.puppet.sleep.duration,
    ease: P.puppet.sleep.ease,
  });
}

/** A short hop used at the end of an age-2 turn (little dance). */
export async function dancePuppet(scene: Phaser.Scene, puppet: Target): Promise<void> {
  const startY = puppet.y;
  const hop = amp(P.puppet.dance.hop);
  await tweenAsync(scene, {
    targets: puppet,
    y: startY - hop,
    duration: P.puppet.dance.duration,
    yoyo: true,
    repeat: 3,
    ease: P.puppet.dance.ease,
  });
  puppet.y = startY;
}

/** Pop a splash / fill-burst sprite at its current position, then fade it out. */
export async function playSplash(scene: Phaser.Scene, fx: AlphaTarget): Promise<void> {
  fx.setAlpha(1);
  const sx = fx.scaleX;
  const sy = fx.scaleY;
  fx.setScale(sx * 0.4, sy * 0.4);
  await tweenAsync(scene, {
    targets: fx,
    scaleX: sx * P.color.splash.scale,
    scaleY: sy * P.color.splash.scale,
    duration: P.color.splash.duration,
    ease: P.color.splash.ease,
  });
  await tweenAsync(scene, {
    targets: fx,
    alpha: 0,
    duration: P.color.burst.duration,
    ease: P.color.burst.ease,
  });
}

/** Duration a region tint should take (the actual color swap is up to the scene). */
export function fillDuration(): number {
  return P.color.fill.duration;
}

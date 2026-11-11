// Basic walk-home / settle-in and train chug / arrive / hand-out helpers for
// Who Lives Here? and Picnic Train. These reuse the shared tween helpers and
// ANIM_PROFILE knobs so later game scenes can call them without a second stack.
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { amp } from './motion';
import { flyArc, tweenAsync, type FlyArcOptions } from './tweens';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

export type PackedArcOptions = Pick<FlyArcOptions, 'delay' | 'spin'>;

/** Walk an animal horizontally toward a home, with a gentle bob. */
export async function walkHome(
  scene: Phaser.Scene,
  animal: Target,
  toX: number,
  toY?: number,
): Promise<void> {
  const bob = amp(P.homes.walk.bob);
  const startY = animal.y;
  const endY = toY ?? startY;
  const half = P.homes.walk.duration / 2;
  await tweenAsync(scene, {
    targets: animal,
    x: (animal.x + toX) / 2,
    y: startY - bob,
    duration: half,
    ease: P.homes.walk.ease,
  });
  await tweenAsync(scene, {
    targets: animal,
    x: toX,
    y: endY,
    duration: half,
    ease: P.homes.walk.ease,
  });
}

/** Ease the animal into a home (slight scale-down settle). */
export function settleInHome(
  scene: Phaser.Scene,
  animal: Target,
  toX: number,
  toY: number,
  restScale = 1,
): Promise<void> {
  const scale = restScale * P.homes.settle.scale;
  return tweenAsync(scene, {
    targets: animal,
    x: toX,
    y: toY,
    scaleX: scale,
    scaleY: scale,
    duration: P.homes.settle.duration,
    ease: P.homes.settle.ease,
  });
}

/** A short looping chug bob. Returns the tween so callers can stop it. */
export function chugTrain(scene: Phaser.Scene, train: Target): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: train,
    y: train.y - amp(P.train.chug.bob),
    duration: P.train.chug.duration,
    yoyo: true,
    repeat: -1,
    ease: P.train.chug.ease,
  });
}

/** Slide the train in to its platform X (and optional Y). */
export function arriveTrain(scene: Phaser.Scene, train: Target, toX: number, toY?: number): Promise<void> {
  return tweenAsync(scene, {
    targets: train,
    x: toX,
    y: toY ?? train.y,
    duration: P.train.arrive.duration,
    ease: P.train.arrive.ease,
  });
}

/** Fly a picnic item to a passenger or empty seat. */
export function handOutItem(
  scene: Phaser.Scene,
  item: Target,
  toX: number,
  toY: number,
  opts: PackedArcOptions = {},
): Promise<void> {
  return flyArc(scene, item, toX, toY, {
    duration: P.train.handOut.duration,
    height: P.train.handOut.arcHeight,
    endScale: P.train.handOut.endScale,
    delay: opts.delay,
    spin: opts.spin,
  });
}

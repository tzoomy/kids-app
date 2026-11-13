// Sorting Beds motion helpers (Phaser). Equivalent to dropIntoBed / switchRule in src/anim/sortPackMotion.ts on
// PR #20 (not on this branch), built on the shared tween helpers and the frozen ANIM_PROFILE.sorting knobs.
// Imports Phaser, so unit tests never import this file.
// TODO(after #20 merges): consolidate with src/anim/sortPackMotion.ts (dropIntoBed / switchRule overlap). Until then
// this file stays self-contained and must not import #20.
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from '../../anim/profiles';
import { amp, ampScale } from '../../anim/motion';
import { flyArc, tweenAsync } from '../../anim/tweens';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

/** Flies a flower along an arc into a bed (ANIM_PROFILE.sorting.drop), then squash-settles into the soil (settle). */
export async function dropIntoBed(scene: Phaser.Scene, item: Target, toX: number, toY: number): Promise<void> {
  await flyArc(scene, item, toX, toY, {
    duration: P.sorting.drop.duration,
    height: P.sorting.drop.arcHeight,
    endScale: P.sorting.drop.endScale,
  });
  await settleInSoil(scene, item);
}

/** Squash on landing and spring back (ANIM_PROFILE.sorting.settle). */
export async function settleInSoil(scene: Phaser.Scene, item: Target): Promise<void> {
  const restX = item.scaleX;
  const restY = item.scaleY;
  const squash = ampScale(P.sorting.settle.squash);
  item.setScale(restX * (2 - squash), restY * squash);
  await tweenAsync(scene, {
    targets: item,
    scaleX: restX,
    scaleY: restY,
    duration: P.sorting.settle.duration,
    ease: P.sorting.settle.ease,
  });
}

/** Flips a rule sign closed and open again (ANIM_PROFILE.sorting.ruleSwitch); `mid` swaps the content while edge-on. */
export async function switchRule(scene: Phaser.Scene, sign: Target, mid?: () => void): Promise<void> {
  const half = P.sorting.ruleSwitch.duration / 2;
  const restX = sign.scaleX;
  await tweenAsync(scene, { targets: sign, scaleX: 0, duration: half, ease: P.sorting.ruleSwitch.ease });
  mid?.();
  await tweenAsync(scene, { targets: sign, scaleX: restX, duration: half, ease: 'Back.easeOut' });
}

/** Idle-hint demonstration: a short hop part of the way toward the bed and back to the basket. */
export async function hopToward(scene: Phaser.Scene, item: Target, toX: number, toY: number): Promise<void> {
  const fromX = item.x;
  const fromY = item.y;
  const midX = fromX + (toX - fromX) * 0.35;
  const midY = fromY + (toY - fromY) * 0.35;
  const lift = amp(55);
  await tweenAsync(scene, { targets: item, x: midX, y: midY - lift, duration: 260, ease: 'Quad.easeOut' });
  await tweenAsync(scene, { targets: item, x: fromX, y: fromY, duration: 260, ease: 'Quad.easeIn' });
}

/** Bed-full bloom: each planted flower stretches up and settles, staggered. */
export function bloomFlowers(scene: Phaser.Scene, flowers: readonly Target[]): Promise<void> {
  return Promise.all(
    flowers.map((f, i) => {
      const rx = f.scaleX;
      const ry = f.scaleY;
      return tweenAsync(scene, {
        targets: f,
        scaleX: rx * 1.08,
        scaleY: ry * ampScale(1.16),
        duration: 160,
        delay: i * 60,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => f.setScale(rx, ry),
      });
    }),
  ).then(() => undefined);
}

/**
 * Soft horizontal shake of a bed that always ends inside `withinMs` (the wrong-tap input lock), so a re-tap after the
 * lock never meets a running shake. Same distance and easing as ANIM_PROFILE.shakeSoft; the 3 back-and-forths are
 * timed to fit. Any earlier shake on the target is stopped and the bed is put back at `restX`.
 */
const activeShakes = new WeakMap<Target, Phaser.Tweens.Tween>();

export function shakeBed(scene: Phaser.Scene, target: Target, restX: number, withinMs: number): Promise<void> {
  activeShakes.get(target)?.stop();
  target.setX(restX);
  const cycles = P.shakeSoft.repeats + 1;
  const half = Math.min(P.shakeSoft.duration, Math.floor((withinMs - 20) / (cycles * 2)));
  return new Promise((resolve) => {
    const finish = () => {
      target.setX(restX);
      resolve();
    };
    const tween = scene.tweens.add({
      targets: target,
      x: restX + amp(P.shakeSoft.distance),
      duration: half,
      yoyo: true,
      repeat: P.shakeSoft.repeats,
      ease: P.shakeSoft.ease,
      onComplete: finish,
      onStop: finish,
    });
    activeShakes.set(target, tween);
  });
}

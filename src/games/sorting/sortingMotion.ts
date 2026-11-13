// Sorting Beds motion helpers (Phaser). Equivalent to dropIntoBed / switchRule in src/anim/sortPackMotion.ts on
// PR #20 (not on this branch), built on the shared tween helpers and the frozen ANIM_PROFILE.sorting knobs.
// Imports Phaser, so unit tests never import this file.
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

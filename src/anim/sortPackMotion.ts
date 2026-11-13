// Basic drop/settle, rule-switch, pack and bounce helpers for Sorting Beds
// and Travel Suitcase. These reuse the shared tween helpers and ANIM_PROFILE
// knobs so later game scenes can call them without a second animation stack.
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { amp, ampScale } from './motion';
import { bounce, flyArc, squashStretch, tweenAsync, type FlyArcOptions } from './tweens';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;

export type PackedArcOptions = Pick<FlyArcOptions, 'delay' | 'spin'>;

/** Fly a flower (or other sortable) into a bed and squash-settle on landing. */
export async function dropIntoBed(
  scene: Phaser.Scene,
  item: Target,
  toX: number,
  toY: number,
  opts: PackedArcOptions = {},
): Promise<void> {
  const restX = item.scaleX;
  const restY = item.scaleY;
  await flyArc(scene, item, toX, toY, {
    duration: P.sorting.drop.duration,
    height: P.sorting.drop.arcHeight,
    endScale: P.sorting.drop.endScale,
    delay: opts.delay,
    spin: opts.spin,
  });
  await squashStretch(scene, item, restX * P.sorting.drop.endScale, restY * P.sorting.drop.endScale);
}

/** Flip the rule sign (or its plaque/icon) closed and open again, like a rule change. */
export async function switchRule(scene: Phaser.Scene, sign: Target, mid?: () => void): Promise<void> {
  const half = P.sorting.ruleSwitch.duration / 2;
  const restX = sign.scaleX;
  const restY = sign.scaleY;
  await tweenAsync(scene, {
    targets: sign,
    scaleX: 0,
    duration: half,
    ease: P.sorting.ruleSwitch.ease,
  });
  mid?.();
  await tweenAsync(scene, {
    targets: sign,
    scaleX: restX,
    scaleY: restY,
    duration: half,
    ease: 'Back.easeOut',
  });
}

/** Fly a travel item into the open suitcase, shrinking slightly as it lands. */
export async function packIntoSuitcase(
  scene: Phaser.Scene,
  item: Target,
  toX: number,
  toY: number,
  opts: PackedArcOptions = {},
): Promise<void> {
  await flyArc(scene, item, toX, toY, {
    duration: P.suitcase.pack.duration,
    height: P.suitcase.pack.arcHeight,
    endScale: P.suitcase.pack.endScale,
    delay: opts.delay,
    spin: opts.spin,
  });
}

/** A short hop on a packed item (or the suitcase itself) after a landing. */
export function bouncePacked(scene: Phaser.Scene, target: Target, height?: number): Promise<void> {
  return bounce(scene, target, height ?? amp(P.suitcase.bounce.height));
}

/** Combined pack-then-bounce, the usual success motion for a packed item. */
export async function packAndBounce(
  scene: Phaser.Scene,
  item: Target,
  toX: number,
  toY: number,
  opts: PackedArcOptions = {},
): Promise<void> {
  await packIntoSuitcase(scene, item, toX, toY, opts);
  const packedScale = item.scaleX;
  await bouncePacked(scene, item);
  // Keep the packed scale after the bounce hop (bounce only moves y).
  item.setScale(packedScale);
}

/** Expose settle squash amount for tests and preview CSS that mirrors the feel. */
export function settleScale(): number {
  return ampScale(P.sorting.settle.squash);
}

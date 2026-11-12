/**
 * Kitchen Orchestra instrument tap / glow helpers. These reuse the shared tween
 * helpers and ANIM_PROFILE.orchestra knobs so the game scene can call them
 * without a second animation stack. (Who's Hiding? motion lives on PR #18.)
 */
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { pressSquash, tweenAsync } from './tweens';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
type AlphaTarget = Target & Phaser.GameObjects.Components.Alpha;

/** Press-squash a kitchen instrument after a tap. */
export function tapInstrument(scene: Phaser.Scene, instrument: Target): Promise<void> {
  return pressSquash(scene, instrument);
}

/** Fade a glow overlay in (or out) over an instrument. */
export function glowInstrument(scene: Phaser.Scene, glow: AlphaTarget, on = true): Promise<void> {
  return tweenAsync(scene, {
    targets: glow,
    alpha: on ? P.orchestra.glow.alpha : 0,
    duration: P.orchestra.glow.duration,
    ease: P.orchestra.glow.ease,
  });
}

/** Soft looping pulse on a visible glow overlay. */
export function pulseInstrumentGlow(scene: Phaser.Scene, glow: AlphaTarget): Phaser.Tweens.Tween {
  return scene.tweens.add({
    targets: glow,
    alpha: { from: P.orchestra.glow.alpha, to: 0.45 },
    duration: P.orchestra.glowPulse.duration,
    yoyo: true,
    repeat: -1,
    ease: P.orchestra.glowPulse.ease,
  });
}

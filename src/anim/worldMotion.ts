// Basic peek / rustle / reveal and instrument tap / glow helpers for Who's Hiding?
// and Kitchen Orchestra. These reuse the shared tween helpers and ANIM_PROFILE knobs
// so later game scenes can call them without a second animation stack.
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { amp } from './motion';
import { chainAsync, pressSquash, tweenAsync, type ChainStep } from './tweens';

type Target = Phaser.GameObjects.Components.Transform & Phaser.GameObjects.GameObject;
type AlphaTarget = Target & Phaser.GameObjects.Components.Alpha;

/** Shake a bush (or any hiding-spot prop) as if something rustled inside. */
export function rustleBush(scene: Phaser.Scene, bush: Target): Promise<void> {
  const { angle, duration, repeats, ease } = P.hiding.rustle;
  const a = amp(angle);
  const steps: ChainStep[] = [];
  let sign = 1;
  for (let i = 0; i <= repeats; i++) {
    const decay = 1 - i / (repeats + 1);
    steps.push({ targets: bush, angle: sign * a * decay, duration, ease });
    sign = -sign;
  }
  steps.push({ targets: bush, angle: 0, duration, ease });
  return chainAsync(scene, { tweens: steps });
}

/**
 * Rise an animal from a fully hidden Y to a peek Y (ears / head showing).
 * `hiddenY` is the resting feet (or container) Y when fully behind the bush.
 */
export function peekFromBush(scene: Phaser.Scene, animal: Target, hiddenY: number, peekY?: number): Promise<void> {
  const y = peekY ?? hiddenY - amp(P.hiding.peek.rise);
  return tweenAsync(scene, {
    targets: animal,
    y,
    duration: P.hiding.peek.duration,
    ease: P.hiding.peek.ease,
  });
}

/** Pop the animal fully out of the bush, ending at `shownY`. */
export function revealFromBush(scene: Phaser.Scene, animal: Target, shownY: number): Promise<void> {
  return tweenAsync(scene, {
    targets: animal,
    y: shownY,
    duration: P.hiding.reveal.duration,
    ease: P.hiding.reveal.ease,
  });
}

/** Ease the animal back down behind the bush. */
export function hideInBush(scene: Phaser.Scene, animal: Target, hiddenY: number): Promise<void> {
  return tweenAsync(scene, {
    targets: animal,
    y: hiddenY,
    duration: P.hiding.hide.duration,
    ease: P.hiding.hide.ease,
  });
}

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

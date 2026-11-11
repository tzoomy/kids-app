// Soft scene transitions (fade / iris / slide), total under 400 ms. The outgoing half
// covers the screen, then the target scene starts and the incoming half reveals it.
// The incoming half is attached to the target's CREATE event, so target scenes need no
// changes. Reduced motion always uses a plain fade.
import Phaser from 'phaser';
import { ANIM_PROFILE as P } from './profiles';
import { isReducedMotion } from './motion';
import { halfDurationFor } from './transitionTiming';

export type TransitionStyle = 'fade' | 'iris' | 'slide';

export interface TransitionOptions {
  style?: TransitionStyle;
  data?: object;
  /** Iris center in game coordinates (defaults to screen center). */
  originX?: number;
  originY?: number;
}

const leaving = new WeakSet<Phaser.Scene>();
const OVERLAY_DEPTH = 100000;

function rgb(color: number): [number, number, number] {
  return [(color >> 16) & 0xff, (color >> 8) & 0xff, color & 0xff];
}

function halfDuration(): number {
  return halfDurationFor(P.transition.duration);
}

function coverRadius(w: number, h: number, x: number, y: number): number {
  const dx = Math.max(x, w - x);
  const dy = Math.max(y, h - y);
  return Math.sqrt(dx * dx + dy * dy) + 8;
}

function playIn(scene: Phaser.Scene, style: TransitionStyle, ox: number, oy: number): void {
  const dur = halfDuration();
  const { width: w, height: h } = scene.scale;
  if (style === 'fade') {
    const [r, g, b] = rgb(P.transition.color);
    scene.cameras.main.fadeIn(dur, r, g, b);
    return;
  }
  if (style === 'iris') {
    const radius = coverRadius(w, h, ox, oy);
    const dot = scene.add.circle(ox, oy, radius, P.transition.color).setDepth(OVERLAY_DEPTH).setScrollFactor(0);
    scene.tweens.add({ targets: dot, scale: 0, duration: dur, ease: 'Cubic.easeIn', onComplete: () => dot.destroy() });
    return;
  }
  const panel = scene.add.rectangle(w / 2, h / 2, w, h, P.transition.color).setDepth(OVERLAY_DEPTH).setScrollFactor(0);
  scene.tweens.add({ targets: panel, x: -w / 2, duration: dur, ease: 'Cubic.easeIn', onComplete: () => panel.destroy() });
}

/**
 * Leaves `from` and starts scene `key` with a short soft transition. Repeated calls while
 * a transition is running are ignored (no double navigation from double taps).
 */
export function transitionTo(from: Phaser.Scene, key: string, opts: TransitionOptions = {}): void {
  if (leaving.has(from)) return;
  leaving.add(from);
  const style: TransitionStyle = isReducedMotion() ? 'fade' : (opts.style ?? 'fade');
  const { width: w, height: h } = from.scale;
  const ox = opts.originX ?? w / 2;
  const oy = opts.originY ?? h / 2;
  const dur = halfDuration();

  from.input.enabled = false;
  from.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    leaving.delete(from);
    from.input.enabled = true;
  });

  const target = from.scene.get(key);
  const go = () => {
    if (!from.sys.isActive() && !from.sys.isPaused()) return;
    target?.events.once(Phaser.Scenes.Events.CREATE, () => playIn(target, style, ox, oy));
    from.scene.start(key, opts.data);
  };

  if (style === 'fade') {
    const [r, g, b] = rgb(P.transition.color);
    from.cameras.main.once(Phaser.Cameras.Scene2D.Events.FADE_OUT_COMPLETE, go);
    from.cameras.main.fadeOut(dur, r, g, b);
    return;
  }
  if (style === 'iris') {
    const radius = coverRadius(w, h, ox, oy);
    const dot = from.add.circle(ox, oy, radius, P.transition.color).setDepth(OVERLAY_DEPTH).setScrollFactor(0).setScale(0);
    from.tweens.add({ targets: dot, scale: 1, duration: dur, ease: 'Cubic.easeOut', onComplete: go });
    return;
  }
  const panel = from.add.rectangle(w * 1.5, h / 2, w, h, P.transition.color).setDepth(OVERLAY_DEPTH).setScrollFactor(0);
  from.tweens.add({ targets: panel, x: w / 2, duration: dur, ease: 'Cubic.easeOut', onComplete: go });
}

// Workshop L20 view helpers: the rope (a tiled strip, never stretched), dashed socket markers, and the sleeping friends in
// their windows. Phaser-bound; the logic they show lives in l20Hints.ts / l20World.ts. Spec: docs/specs/workshop-l20.md.
import Phaser from 'phaser';
import { eggArt } from '../art';
import { displaySize } from '../assets';
import { eggAvailability } from '../voiceProvider';
import { BUST_SIZE, WINDOW_SIZE, type SleeperId } from './l20Level';

const ROPE_BROWN = 0x7a5532;
const ROPE_WIDTH = 4;

/** A rope between two points. `ws-rope` is a seamless 10x64 tile: a TileSprite whose length is cropped, never scaled. */
export class RopeView {
  private readonly tile: Phaser.GameObjects.TileSprite | null;
  private readonly line: Phaser.GameObjects.Graphics | null;
  private ends = { x1: 0, y1: 0, x2: 0, y2: 0 };

  constructor(scene: Phaser.Scene, depth: number) {
    if (eggAvailability.isReady('ws-rope') && scene.textures.exists('ws-rope')) {
      const { w } = displaySize('ws-rope');
      const frameWidth = scene.textures.get('ws-rope').getSourceImage().width;
      this.tile = scene.add.tileSprite(0, 0, w, 10, 'ws-rope').setOrigin(0.5, 0).setDepth(depth);
      this.tile.setTileScale(frameWidth > 0 ? w / frameWidth : 1);
      this.line = null;
    } else {
      this.tile = null;
      this.line = scene.add.graphics().setDepth(depth);
    }
  }

  /** From (x1,y1) (the top end) to (x2,y2). */
  set(x1: number, y1: number, x2: number, y2: number): void {
    this.ends = { x1, y1, x2, y2 };
    const len = Math.hypot(x2 - x1, y2 - y1);
    if (this.tile) {
      this.tile.setPosition(x1, y1);
      this.tile.setSize(this.tile.width, Math.max(1, len));
      // The strip hangs along +y; rotate it onto the line (a vertical rope has rotation 0).
      this.tile.setRotation(Math.atan2(x1 - x2, y2 - y1));
    } else if (this.line) {
      this.line.clear();
      this.line.lineStyle(ROPE_WIDTH, ROPE_BROWN, 1);
      this.line.lineBetween(x1, y1, x2, y2);
    }
  }

  get length(): number {
    return Math.hypot(this.ends.x2 - this.ends.x1, this.ends.y2 - this.ends.y1);
  }

  setVisible(on: boolean): void {
    this.tile?.setVisible(on);
    this.line?.setVisible(on);
  }

  destroy(): void {
    this.tile?.destroy();
    this.line?.destroy();
  }
}

/** A dashed circle (a socket marker) drawn in code, centred on (0,0) of `g`. */
export function drawDashedCircle(g: Phaser.GameObjects.Graphics, r: number, color: number, alpha: number, width = 4): void {
  const dashes = Math.max(10, Math.round((2 * Math.PI * r) / 18));
  g.lineStyle(width, color, alpha);
  for (let i = 0; i < dashes; i++) {
    const a0 = (i / dashes) * Math.PI * 2;
    g.beginPath();
    g.arc(0, 0, r, a0, a0 + (Math.PI * 2) / dashes / 2);
    g.strokePath();
  }
}

export type SleeperState = 'asleep' | 'awake';

/** One friend in a window: the sleeping or the waking bust behind a window frame. All motion is a tween; physics never moves it. */
export class SleeperView {
  readonly container: Phaser.GameObjects.Container;
  state: SleeperState = 'asleep';
  readonly history: SleeperState[] = ['asleep'];
  private readonly asleepArt: Phaser.GameObjects.Container;
  private readonly awakeArt: Phaser.GameObjects.Container;
  private breathe: Phaser.Tweens.Tween | null = null;
  private readonly baseY: number;

  constructor(
    private readonly scene: Phaser.Scene,
    readonly id: SleeperId,
    readonly x: number,
    readonly y: number,
    depth: number,
  ) {
    this.baseY = y;
    this.container = scene.add.container(x, y).setDepth(depth);
    this.asleepArt = eggArt(scene, `ws-sleeper-${id}-asleep`, 0, 0);
    this.awakeArt = eggArt(scene, `ws-sleeper-${id}-awake`, 0, 0).setVisible(false);
    this.container.add([this.asleepArt, this.awakeArt]);
    this.container.setSize(BUST_SIZE, BUST_SIZE);
    // The window frame sits IN FRONT of the bust, so it is a separate object one depth above.
    eggArt(scene, 'ws-window-frame', x, y).setDepth(depth + 1).setSize(WINDOW_SIZE, WINDOW_SIZE);
  }

  private alive(): boolean {
    return Boolean(this.container.scene);
  }

  private swap(to: SleeperState): void {
    if (this.state === to) return;
    this.state = to;
    this.history.push(to);
    this.asleepArt.setVisible(to === 'asleep');
    this.awakeArt.setVisible(to === 'awake');
  }

  /** Slow breathing while asleep: scaleY 1 -> 1.03, 1.4 s, yoyo, a different phase per friend. */
  startBreathing(phaseMs: number): void {
    this.stopBreathing();
    this.breathe = this.scene.tweens.add({ targets: this.container, scaleY: 1.03, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut', delay: phaseMs });
  }

  stopBreathing(): void {
    this.breathe?.stop();
    this.breathe = null;
    this.container.setScale(1);
    this.container.setPosition(this.x, this.baseY);
  }

  /** Mid-run twitch when a bell rings (cosmetic): a 6 px hop and a "z" puff; the still stays asleep. */
  twitch(): void {
    if (!this.alive() || this.state !== 'asleep') return;
    this.scene.tweens.add({ targets: this.container, y: this.baseY - 6, duration: 110, yoyo: true, ease: 'Sine.easeOut' });
    const z = this.scene.add.text(this.x + 30, this.y - 40, 'z', { fontFamily: 'sans-serif', fontSize: '26px', color: '#6b5b95', fontStyle: 'bold' }).setDepth(this.container.depth + 3);
    this.scene.tweens.add({ targets: z, y: z.y - 26, alpha: 0, duration: 800, onComplete: () => z.destroy() });
  }

  /** The win: a squash-stretch pop (0.9 -> 1.1 -> 1), asleep -> awake at the peak, then a wave of +-8 degrees, 3 cycles. */
  wakeUp(delayMs: number): void {
    this.stopBreathing();
    this.scene.time.delayedCall(delayMs, () => {
      if (!this.alive()) return;
      this.container.setScale(0.9);
      this.scene.tweens.add({
        targets: this.container,
        scale: 1.1,
        duration: 150,
        ease: 'Sine.easeOut',
        onUpdate: (tween) => {
          if (tween.progress > 0.9) this.swap('awake');
        },
        onComplete: () => {
          this.swap('awake');
          this.scene.tweens.add({ targets: this.container, scale: 1, duration: 130, ease: 'Back.easeOut' });
          this.container.setAngle(-8);
          this.scene.tweens.add({ targets: this.container, angle: 8, duration: 260, yoyo: true, repeat: 2, ease: 'Sine.easeInOut', onComplete: () => this.container.setAngle(0) });
        },
      });
    });
  }

  /** One-bell failure: awake for 0.8 s, then a slow droop (y +6, scaleY 0.95) and back to asleep. */
  wakeThenSleepAgain(): void {
    if (!this.alive()) return;
    this.stopBreathing();
    this.swap('awake');
    this.scene.tweens.add({ targets: this.container, scale: { from: 0.95, to: 1.05 }, duration: 160, yoyo: true });
    this.scene.time.delayedCall(800, () => {
      if (!this.alive()) return;
      this.scene.tweens.add({
        targets: this.container,
        y: this.baseY + 6,
        scaleY: 0.95,
        duration: 600,
        ease: 'Sine.easeIn',
        onComplete: () => {
          this.swap('asleep');
          this.container.setPosition(this.x, this.baseY);
          this.container.setScale(1);
          this.startBreathing(this.id.length * 90);
        },
      });
    });
  }
}

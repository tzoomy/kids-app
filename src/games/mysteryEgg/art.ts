// Mystery Egg art: every visual is a Container holding either the manifest's WebP (when it loaded) or a simple
// Phaser-drawn placeholder. Idle and reaction motion are tweens on the whole container (docs/specs/mystery-egg-assets.md).
import Phaser from 'phaser';
import { animatedSpriteSpec, displaySize, spriteFrameRects, spriteSpec, type SpriteSpec } from './assets';
import { RAMP_POLY } from './layout';
import { drawShellPlaceholder } from './shellArt';
import { eggAvailability } from './voiceProvider';

const BROWN = 0x8a5a33;
const DARK = 0x3b2a22;
const CREAM = 0xfff2d6;
const RED = 0xe2554f;
const GOLD = 0xf2b632;
const BLUE = 0x5b6fd6;
const PINK = 0xff7fb5;

type G = Phaser.GameObjects.Graphics;

function heart(g: G, x: number, y: number, s: number, color: number, alpha = 1): void {
  g.fillStyle(color, alpha);
  g.fillCircle(x - s * 0.5, y - s * 0.25, s * 0.55);
  g.fillCircle(x + s * 0.5, y - s * 0.25, s * 0.55);
  g.fillTriangle(x - s * 1.02, y - s * 0.05, x + s * 1.02, y - s * 0.05, x, y + s * 1.05);
}

function eggShape(g: G, x: number, y: number, w: number, h: number): void {
  g.fillStyle(CREAM, 1);
  g.fillEllipse(x, y, w, h);
  g.lineStyle(5, DARK, 1);
  g.strokeEllipse(x, y, w, h);
  g.fillStyle(0xd9a566, 1);
  for (const [dx, dy] of [[-22, -20], [14, -34], [28, 6], [-8, 22], [-30, 12]]) g.fillCircle(x + dx, y + dy, 6);
}

function catShape(g: G, awake: boolean, w: number, h: number): void {
  const fur = 0xe6a15a;
  if (!awake) {
    g.fillStyle(0xf3a6c5, 1); // blanket
    g.fillRoundedRect(-w / 2, h * 0.05, w, h * 0.42, 24);
    g.fillStyle(fur, 1);
    g.fillEllipse(-w * 0.1, h * 0.05, w * 0.5, h * 0.42); // curled body
    g.fillCircle(w * 0.22, -h * 0.02, h * 0.2); // head
    g.fillTriangle(w * 0.1, -h * 0.14, w * 0.14, -h * 0.34, w * 0.24, -h * 0.17);
    g.fillTriangle(w * 0.24, -h * 0.17, w * 0.34, -h * 0.34, w * 0.34, -h * 0.07);
    g.lineStyle(4, DARK, 1);
    g.lineBetween(w * 0.15, 0, w * 0.21, 4);
    g.lineBetween(w * 0.27, 0, w * 0.33, 4);
    g.fillStyle(0xffffff, 1);
    g.fillRoundedRect(w * 0.1, -h * 0.34, w * 0.26, h * 0.12, 8); // chef hat
    for (let i = 0; i < 3; i++) g.lineBetween(w * 0.38 + i * 12, -h * 0.28 - i * 18, w * 0.38 + i * 12 + 14, -h * 0.28 - i * 18);
    return;
  }
  g.fillStyle(fur, 1);
  g.fillEllipse(0, h * 0.18, w * 0.5, h * 0.55); // body
  g.fillCircle(0, -h * 0.12, h * 0.2); // head
  g.fillTriangle(-h * 0.2, -h * 0.2, -h * 0.17, -h * 0.4, -h * 0.03, -h * 0.28);
  g.fillTriangle(h * 0.2, -h * 0.2, h * 0.17, -h * 0.4, h * 0.03, -h * 0.28);
  g.fillStyle(0xffffff, 1);
  g.fillRoundedRect(-h * 0.17, -h * 0.5, h * 0.34, h * 0.14, 10); // chef hat
  g.fillStyle(DARK, 1);
  g.fillCircle(-h * 0.07, -h * 0.13, 5);
  g.fillCircle(h * 0.07, -h * 0.13, 5);
  g.lineStyle(4, DARK, 1);
  g.beginPath();
  g.arc(0, -h * 0.07, 12, 0.2, Math.PI - 0.2);
  g.strokePath();
}

/** Simple drawn stand-in for a manifest id, centred on (0,0), fitted to the manifest's display size. */
export function drawPlaceholder(g: G, id: string): void {
  const { w, h } = displaySize(id);
  const nest = /^egg-nest-(\d)$/.exec(id);
  if (nest) {
    const level = Number(nest[1]);
    for (let i = 0; i < 4; i++) {
      g.fillStyle(0xfff2a8, (0.05 + level * 0.035) * (4 - i) / 2);
      g.fillCircle(0, -20, 90 + level * 14 + i * 24);
    }
    g.fillStyle(0xa9743f, 1);
    g.fillEllipse(0, h * 0.28, w * 0.78, h * 0.3);
    eggShape(g, 0, -h * 0.06, w * 0.34, h * 0.5);
    g.fillStyle(0xc28a4d, 1);
    g.fillEllipse(0, h * 0.34, w * 0.78, h * 0.2);
    g.lineStyle(4, DARK, 1);
    g.strokeEllipse(0, h * 0.34, w * 0.78, h * 0.2);
    for (let i = 0; i < level; i++) {
      const a = -0.8 + i * 0.4;
      g.fillStyle(0xfff6b8, 0.9);
      g.fillCircle(Math.sin(a) * 120, -h * 0.3 - Math.cos(a) * 40, 7);
    }
    return;
  }
  switch (id) {
    case 'hub-bg':
      g.fillStyle(0xcdeaff, 1);
      g.fillRect(-w / 2, -h / 2, w, h * 0.62);
      g.fillStyle(0xb7e09a, 1);
      g.fillRect(-w / 2, h * 0.12, w, h * 0.38);
      g.fillStyle(0x9ad07c, 1);
      g.fillEllipse(-w * 0.3, h * 0.14, w * 0.7, 160);
      g.fillEllipse(w * 0.34, h * 0.16, w * 0.6, 140);
      break;
    case 'bunny':
      g.fillStyle(0xfdf3ee, 1);
      g.fillEllipse(-26, -h * 0.34, 44, 130);
      g.fillEllipse(26, -h * 0.34, 44, 130);
      g.fillEllipse(0, h * 0.2, w * 0.7, h * 0.5);
      g.fillCircle(0, -h * 0.08, w * 0.34);
      g.lineStyle(4, DARK, 1);
      g.strokeCircle(0, -h * 0.08, w * 0.34);
      g.fillStyle(0xb7a6e8, 1);
      g.fillRoundedRect(-w * 0.32, -h * 0.17, w * 0.64, 34, 14); // goggles
      g.fillStyle(DARK, 1);
      g.fillCircle(-16, -h * 0.12, 6);
      g.fillCircle(16, -h * 0.12, 6);
      g.fillStyle(0xa8d9c2, 1);
      g.fillRoundedRect(-w * 0.3, h * 0.1, w * 0.6, h * 0.3, 18); // overalls
      break;
    case 'robot':
      g.fillStyle(0xeae6f7, 1);
      g.fillRoundedRect(-w * 0.34, h * 0.0, w * 0.68, h * 0.42, 22);
      g.fillRoundedRect(-w * 0.42, -h * 0.4, w * 0.84, h * 0.4, 28);
      g.lineStyle(4, DARK, 1);
      g.strokeRoundedRect(-w * 0.42, -h * 0.4, w * 0.84, h * 0.4, 28);
      g.fillStyle(0x23253a, 1);
      g.fillRoundedRect(-w * 0.3, -h * 0.32, w * 0.6, h * 0.24, 16);
      g.fillStyle(0x4de3ff, 1);
      g.fillCircle(-w * 0.12, -h * 0.2, 11);
      g.fillCircle(w * 0.12, -h * 0.2, 11);
      g.lineStyle(4, 0x8a8fa8, 1);
      g.lineBetween(0, -h * 0.4, 0, -h * 0.5);
      g.fillStyle(RED, 1);
      g.fillCircle(0, -h * 0.52, 9);
      g.fillStyle(0xc9c2ea, 1);
      g.fillRoundedRect(-w * 0.2, h * 0.08, w * 0.4, h * 0.2, 10);
      break;
    case 'capybara':
      g.fillStyle(0xb98a5b, 1);
      g.fillRoundedRect(-w * 0.42, -h * 0.05, w * 0.84, h * 0.5, 40);
      g.fillRoundedRect(w * 0.1, -h * 0.4, w * 0.36, h * 0.46, 30);
      g.fillStyle(DARK, 1);
      g.fillCircle(w * 0.36, -h * 0.22, 5);
      g.fillCircle(w * 0.44, -h * 0.1, 6);
      g.fillRect(-w * 0.3, h * 0.4, 16, h * 0.1);
      g.fillRect(w * 0.1, h * 0.4, 16, h * 0.1);
      break;
    case 'cat-asleep':
      g.fillStyle(0x9a6b45, 1);
      g.fillRoundedRect(-w / 2, h * 0.26, w, h * 0.24, 8); // bed frame
      g.fillStyle(0xc9b6f2, 1);
      g.fillRoundedRect(-w * 0.12, -h * 0.05, w * 0.4, h * 0.32, 20); // pillow
      catShape(g, false, w, h);
      break;
    case 'cat-awake':
      catShape(g, true, w, h);
      break;
    case 'heart-panel':
      g.fillStyle(0xdad6ee, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 26);
      g.lineStyle(5, DARK, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 26);
      break;
    case 'slot-empty':
      g.fillStyle(0x9d97bd, 1);
      g.fillCircle(0, 0, w * 0.42);
      g.lineStyle(5, DARK, 0.7);
      g.strokeCircle(0, 0, w * 0.42);
      break;
    case 'slot-filled':
      g.fillStyle(0xfff2a8, 0.7);
      g.fillCircle(0, 0, w * 0.5);
      heart(g, 0, -4, w * 0.3, PINK);
      g.lineStyle(4, DARK, 1);
      g.strokeCircle(0, 0, w * 0.42);
      break;
    case 'part-ball':
      g.fillStyle(RED, 1);
      g.fillCircle(0, 0, w * 0.46);
      g.lineStyle(5, DARK, 1);
      g.strokeCircle(0, 0, w * 0.46);
      g.fillStyle(0xf7a3a0, 1);
      for (const [dx, dy] of [[-16, -14], [14, -22], [22, 12], [-6, 20], [-26, 14]]) g.fillCircle(dx, dy, 7);
      break;
    case 'part-ramp': {
      // A wedge sloping down to the right, the same polygon as the physics body (layout.ts RAMP_POLY).
      const pts = RAMP_POLY.map((p) => new Phaser.Math.Vector2(p.x, p.y));
      g.fillStyle(BLUE, 1);
      g.fillPoints(pts, true);
      g.lineStyle(4, DARK, 1);
      g.strokePoints(pts, true);
      g.fillStyle(0x7f93ee, 1);
      g.fillTriangle(RAMP_POLY[0].x + 8, RAMP_POLY[0].y + 10, RAMP_POLY[1].x - 14, RAMP_POLY[1].y - 4, RAMP_POLY[3].x + 14, RAMP_POLY[3].y - 8);
      break;
    }
    case 'part-bell':
      g.fillStyle(GOLD, 1);
      g.fillRoundedRect(-w * 0.34, -h * 0.34, w * 0.68, h * 0.62, 30);
      g.fillRect(-w * 0.44, h * 0.18, w * 0.88, h * 0.14);
      g.fillCircle(0, h * 0.4, 9);
      g.lineStyle(4, DARK, 1);
      g.strokeRoundedRect(-w * 0.34, -h * 0.34, w * 0.68, h * 0.62, 30);
      g.fillStyle(GOLD, 1);
      g.fillCircle(0, -h * 0.42, 8);
      break;
    case 'part-domino':
      g.fillStyle(0xf4eee0, 1);
      g.fillRoundedRect(-w * 0.3, -h * 0.45, w * 0.6, h * 0.9, 10);
      g.fillStyle(DARK, 1);
      for (const dy of [-0.25, 0.25]) for (const dx of [-0.12, 0.12]) g.fillCircle(w * dx, h * dy, 6);
      break;
    case 'part-spring':
      g.lineStyle(8, GOLD, 1);
      for (let i = 0; i < 5; i++) g.strokeEllipse(0, h * 0.35 - i * (h * 0.16), w * 0.7, 20);
      break;
    case 'feather':
      g.fillStyle(0x62c7c1, 1);
      g.fillEllipse(0, 0, w * 0.5, h * 0.9);
      g.lineStyle(4, DARK, 1);
      g.lineBetween(0, -h * 0.45, 0, h * 0.5);
      break;
    case 'confetti':
      g.fillStyle(PINK, 1);
      g.fillRect(-w * 0.3, -h * 0.15, w * 0.6, h * 0.3);
      break;
    default:
      if (drawShellPlaceholder(g, id, w, h)) return;
      g.fillStyle(0xcccccc, 0.5);
      g.fillRect(-w / 2, -h / 2, w, h);
  }
}

/** A manifest image as a Container: the loaded WebP at the manifest's display size, or the drawn placeholder. */
export function eggArt(scene: Phaser.Scene, id: string, x: number, y: number): Phaser.GameObjects.Container {
  const { w, h } = displaySize(id);
  const container = scene.add.container(x, y);
  container.setSize(w, h);
  if (eggAvailability.isReady(id) && scene.textures.exists(id)) {
    container.add(scene.add.image(0, 0, id).setDisplaySize(w, h));
    container.setData('placeholder', false);
  } else {
    const g = scene.add.graphics();
    drawPlaceholder(g, id);
    container.add(g);
    container.setData('placeholder', true);
  }
  return container;
}

/**
 * Splits a loaded horizontal strip into frames named "0".."n-1" (frame count, w and h from the manifest; the frame
 * width is the REAL texture width / frames, so a 1x or 2x file both work). Returns null when the strip did not load.
 */
export function ensureSpriteFrames(scene: Phaser.Scene, id: string): SpriteSpec | null {
  if (!eggAvailability.isReady(id) || !scene.textures.exists(id)) return null;
  const spec = spriteSpec(id);
  const texture = scene.textures.get(id);
  const source = texture.getSourceImage();
  const rects = spriteFrameRects(spec.frames, source.width, source.height);
  if (rects.length === 0 || source.width < spec.frames) return null;
  for (const r of rects) if (!texture.has(String(r.index))) texture.add(String(r.index), 0, r.x, r.y, r.width, r.height);
  return spec;
}

/** Frames plus a play-once animation (fps from the manifest). Null when the strip did not load or is not animated. */
export function ensureSpriteAnim(scene: Phaser.Scene, id: string): (SpriteSpec & { fps: number }) | null {
  if (!ensureSpriteFrames(scene, id)) return null;
  const spec = animatedSpriteSpec(id);
  if (!scene.anims.exists(id)) {
    scene.anims.create({
      key: id,
      frames: Array.from({ length: spec.frames }, (_, i) => ({ key: id, frame: String(i) })),
      frameRate: spec.fps,
      repeat: 0,
    });
  }
  return spec;
}

export interface PlaySpriteOptions {
  /** Extra scale on top of the manifest's single-frame display size. */
  scale?: number;
  /** Keep the last frame on screen this long after the animation ends. */
  holdMs?: number;
  depth?: number;
}

/**
 * Plays the sprite strip `id` once at (x, y), sized to the manifest's single-frame display size, holds the last frame
 * for `holdMs`, then resolves with the sprite (the caller destroys it). Resolves null when the strip is unavailable.
 */
export function playSpriteOnce(scene: Phaser.Scene, id: string, x: number, y: number, opts: PlaySpriteOptions = {}): Promise<Phaser.GameObjects.Sprite | null> {
  const spec = ensureSpriteAnim(scene, id);
  if (!spec) return Promise.resolve(null);
  const k = opts.scale ?? 1;
  const sprite = scene.add.sprite(x, y, id, '0').setDisplaySize(spec.w * k, spec.h * k).setDepth(opts.depth ?? 10);
  return new Promise((resolve) => {
    sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => {
      if (opts.holdMs && opts.holdMs > 0) scene.time.delayedCall(opts.holdMs, () => resolve(sprite));
      else resolve(sprite);
    });
    sprite.play(id);
  });
}

export interface RobotView {
  container: Phaser.GameObjects.Container;
  /** One blink now (the `robot-blink` strip, else a squash tween). */
  blink(): void;
  /** A cheering moment: the `robot` art (cheering eyes) for a while, bouncing, then back to the idle still. */
  cheer(ms?: number): void;
  /** Blinks every 3-5 s until the scene ends. */
  startIdleBlinks(): void;
}

/**
 * The robot. Idle still = `robot-blink` frame 0 (open eyes) when that strip loaded; `robot` (closed, cheering eyes) is
 * only used for cheer moments. When `robot-blink` is missing the drawn/loaded `robot` art is the idle still too, and
 * a blink is a squash tween. Sizes, frames and fps come from the manifest.
 */
export function createRobot(scene: Phaser.Scene, x: number, y: number): RobotView {
  const { w, h } = displaySize('robot');
  const container = scene.add.container(x, y);
  container.setSize(w, h);
  const blinkSpec = ensureSpriteAnim(scene, 'robot-blink');
  const sprite = blinkSpec ? scene.add.sprite(0, 0, 'robot-blink', '0').setDisplaySize(blinkSpec.w, blinkSpec.h) : null;
  const idle: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Visible = sprite ?? eggArt(scene, 'robot', 0, 0);
  const cheerArt = eggArt(scene, 'robot', 0, 0).setVisible(false);
  container.add([idle, cheerArt]);
  let cheering = false;
  const alive = (): boolean => Boolean(container.scene);
  const view: RobotView = {
    container,
    blink() {
      if (!alive() || cheering) return;
      if (sprite) {
        sprite.once(Phaser.Animations.Events.ANIMATION_COMPLETE, () => sprite.setFrame('0'));
        sprite.play('robot-blink');
      } else {
        scene.tweens.add({ targets: container, scaleY: container.scaleY * 0.92, duration: 80, yoyo: true });
      }
    },
    cheer(ms = 2200) {
      if (!alive()) return;
      cheering = true;
      idle.setVisible(false);
      cheerArt.setVisible(true);
      scene.tweens.add({ targets: container, y: container.y - 22, duration: 160, yoyo: true, repeat: 3, ease: 'Sine.easeOut' });
      scene.time.delayedCall(ms, () => {
        if (!alive()) return;
        cheering = false;
        cheerArt.setVisible(false);
        idle.setVisible(true);
      });
    },
    startIdleBlinks() {
      const next = (): void => {
        scene.time.delayedCall(3000 + Math.random() * 2000, () => {
          if (!alive()) return;
          view.blink();
          next();
        });
      };
      next();
    },
  };
  return view;
}

/** Cream rounded panel (cards, tray). */
export function panel(scene: Phaser.Scene, x: number, y: number, w: number, h: number, fill = CREAM): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(fill, 0.96);
  g.fillRoundedRect(x - w / 2, y - h / 2, w, h, 28);
  g.lineStyle(5, BROWN, 0.8);
  g.strokeRoundedRect(x - w / 2, y - h / 2, w, h, 28);
  return g;
}


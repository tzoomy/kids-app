// Mystery Egg: big picture-only buttons (no text, no reading), the goal card and the speech cue. Phaser-drawn.
import Phaser from 'phaser';
import { eggArt, panel } from './art';

/** Minimum tap target in board px (the brief asks for about 96). */
export const MIN_TAP = 96;

export interface EggButton {
  container: Phaser.GameObjects.Container;
  width: number;
  height: number;
  setEnabled(on: boolean): void;
}

type Drawer = (g: Phaser.GameObjects.Graphics, w: number, h: number) => void;

export function drawPlayIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(0x4caf50, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 30);
  g.lineStyle(6, 0x2e7d32, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 30);
  g.fillStyle(0xffffff, 1);
  const s = Math.min(w, h) * 0.3;
  g.fillTriangle(-s * 0.7, -s, -s * 0.7, s, s * 1.1, 0);
}

export function drawArrowIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(0x4caf50, 1);
  g.fillCircle(0, 0, Math.min(w, h) / 2);
  g.lineStyle(6, 0x2e7d32, 1);
  g.strokeCircle(0, 0, Math.min(w, h) / 2);
  g.fillStyle(0xffffff, 1);
  const s = Math.min(w, h) * 0.22;
  g.fillTriangle(-s * 0.6, -s, -s * 0.6, s, s * 1.2, 0);
}

export function drawHomeIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  // Drawn for a 96 px button; a bigger button (portrait, where the board is scaled down) scales the whole icon.
  const k = Math.min(w, h) / MIN_TAP;
  g.fillStyle(0xfff3d6, 0.95);
  g.fillCircle(0, 0, Math.min(w, h) / 2);
  g.lineStyle(5 * k, 0x8a5a33, 1);
  g.strokeCircle(0, 0, Math.min(w, h) / 2);
  g.fillStyle(0xc0504d, 1);
  g.fillTriangle(-24 * k, -2 * k, 24 * k, -2 * k, 0, -26 * k);
  g.fillStyle(0x8a5a33, 1);
  g.fillRect(-16 * k, -2 * k, 32 * k, 26 * k);
  g.fillStyle(0xfff3d6, 1);
  g.fillRect(-5 * k, 8 * k, 10 * k, 16 * k);
}

export function drawEarIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(0x4de3ff, 0.9);
  g.fillCircle(0, 0, Math.min(w, h) / 2);
  g.lineStyle(5, 0x23253a, 1);
  g.strokeCircle(0, 0, Math.min(w, h) / 2);
  g.lineStyle(7, 0x23253a, 1);
  g.beginPath();
  g.arc(0, -4, 20, Math.PI * 0.9, Math.PI * 2.1);
  g.strokePath();
  g.beginPath();
  g.arc(-2, 6, 9, Math.PI * 1.1, Math.PI * 2.0);
  g.strokePath();
  g.lineStyle(5, 0x23253a, 1);
  for (const r of [30, 38]) {
    g.beginPath();
    g.arc(0, -4, r, -0.6, 0.6);
    g.strokePath();
  }
}

/** Picture-only skip icon (code UI, no art id): a green round button with a double "next" arrow. */
export function drawSkipIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  const r = Math.min(w, h) / 2;
  g.fillStyle(0x4caf50, 1);
  g.fillCircle(0, 0, r);
  g.lineStyle(6, 0x2e7d32, 1);
  g.strokeCircle(0, 0, r);
  g.fillStyle(0xffffff, 1);
  const s = r * 0.32;
  for (const dx of [-s * 0.9, s * 0.7]) g.fillTriangle(dx - s * 0.7, -s, dx - s * 0.7, s, dx + s * 0.8, 0);
}

export function drawGearIcon(g: Phaser.GameObjects.Graphics, w: number, h: number): void {
  g.fillStyle(0xf2b632, 1);
  g.fillRoundedRect(-w / 2, -h / 2, w, h, 34);
  g.lineStyle(6, 0x8a5a33, 1);
  g.strokeRoundedRect(-w / 2, -h / 2, w, h, 34);
  g.fillStyle(0x8a5a33, 1);
  g.fillCircle(0, 0, 34);
  for (let i = 0; i < 8; i++) {
    const a = (i / 8) * Math.PI * 2;
    g.fillCircle(Math.cos(a) * 40, Math.sin(a) * 40, 9);
  }
  g.fillStyle(0xf2b632, 1);
  g.fillCircle(0, 0, 14);
}

/** A big tappable button drawn from `draw`; `onTap` fires on pointer-up inside after a press, with a squash for feedback. */
export function makeButton(
  scene: Phaser.Scene,
  x: number,
  y: number,
  w: number,
  h: number,
  draw: Drawer,
  onTap: () => void,
): EggButton {
  const width = Math.max(w, MIN_TAP);
  const height = Math.max(h, MIN_TAP);
  const container = scene.add.container(x, y);
  const g = scene.add.graphics();
  draw(g, width, height);
  container.add(g);
  container.setSize(width, height);
  container.setInteractive({ useHandCursor: true });
  let enabled = true;
  container.on('pointerdown', () => {
    if (!enabled) return;
    scene.tweens.add({ targets: container, scaleX: 0.92, scaleY: 0.92, duration: 70, yoyo: true });
    onTap();
  });
  return {
    container,
    width,
    height,
    setEnabled(on: boolean) {
      enabled = on;
      container.setAlpha(on ? 1 : 0.45);
    },
  };
}

/** Dotted arrow from (x1,y) to (x2,y) with a head, as on the picture-only goal card. */
function dottedArrow(scene: Phaser.Scene, container: Phaser.GameObjects.Container, x1: number, x2: number, y: number): void {
  const g = scene.add.graphics();
  g.fillStyle(0x8e5bd6, 1);
  for (let x = x1; x < x2 - 14; x += 14) g.fillCircle(x, y, 4);
  g.fillTriangle(x2 - 16, y - 12, x2 - 16, y + 12, x2 + 2, y);
  container.add(g);
}

/** Picture-only goal card: ball -> dotted arrow -> bell -> dotted arrow -> awake cat. Centre (x, y), 560 x 130 at scale 1. */
export function goalCard(scene: Phaser.Scene, x: number, y: number): Phaser.GameObjects.Container {
  const card = scene.add.container(x, y);
  card.add(panel(scene, 0, 0, 560, 130));
  card.add(eggArt(scene, 'part-ball', -210, 0).setScale(1.2));
  dottedArrow(scene, card, -150, -72, 0);
  card.add(eggArt(scene, 'part-bell', -30, 0).setScale(0.85));
  dottedArrow(scene, card, 30, 100, 0);
  card.add(eggArt(scene, 'cat-awake', 200, 4).setScale(0.36));
  card.setSize(560, 130);
  return card;
}

/** A small speech-bubble cue above (x, y): shows that a voice line is playing (also when its file is missing). */
export function speechCue(scene: Phaser.Scene, x: number, y: number, durationMs = 1800): Phaser.GameObjects.Container {
  const c = scene.add.container(x, y).setDepth(900);
  const g = scene.add.graphics();
  g.fillStyle(0xffffff, 0.95);
  g.fillRoundedRect(-34, -26, 68, 48, 16);
  g.fillTriangle(-6, 20, 10, 20, 0, 36);
  g.lineStyle(4, 0x3b2a22, 1);
  g.strokeRoundedRect(-34, -26, 68, 48, 16);
  g.fillStyle(0x3b2a22, 1);
  for (const dx of [-16, 0, 16]) g.fillCircle(dx, -2, 5);
  c.add(g);
  c.setScale(0);
  scene.tweens.add({ targets: c, scale: 1, duration: 140, ease: 'Back.easeOut' });
  // `Infinity`: the caller keeps the bubble up for as long as its line plays and calls `dismissCue` at the end.
  if (Number.isFinite(durationMs)) fadeCue(scene, c, durationMs);
  return c;
}

function fadeCue(scene: Phaser.Scene, c: Phaser.GameObjects.Container, delay: number): void {
  scene.tweens.add({ targets: c, alpha: 0, delay, duration: 250, onComplete: () => c.destroy() });
}

/** Fades a bubble made with an endless duration out and removes it. */
export function dismissCue(scene: Phaser.Scene, c: Phaser.GameObjects.Container): void {
  if (c.scene) fadeCue(scene, c, 0);
}

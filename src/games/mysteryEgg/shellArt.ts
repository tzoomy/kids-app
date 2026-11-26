// Game shell placeholders: simple Phaser-drawn stand-ins for the map, world tiles, frog, slides and nest pieces until
// Gemini's files land (docs/specs/mystery-egg-assets.md, "Game shell assets"). Centred on (0, 0), fitted to (w, h).
import type Phaser from 'phaser';
import { WORLDS } from './worlds';

type G = Phaser.GameObjects.Graphics;

const DARK = 0x3b2a22;

function house(g: G, w: number, h: number, wall: number, roof: number, glow: boolean): void {
  g.fillStyle(wall, 1);
  g.fillRoundedRect(-w * 0.34, -h * 0.12, w * 0.68, h * 0.5, 14);
  g.fillStyle(roof, 1);
  g.fillTriangle(-w * 0.42, -h * 0.1, w * 0.42, -h * 0.1, 0, -h * 0.46);
  g.lineStyle(5, DARK, 1);
  g.strokeRoundedRect(-w * 0.34, -h * 0.12, w * 0.68, h * 0.5, 14);
  g.strokeTriangle(-w * 0.42, -h * 0.1, w * 0.42, -h * 0.1, 0, -h * 0.46);
  g.fillStyle(glow ? 0xffd86b : 0x8a5a33, 1);
  g.fillRoundedRect(-w * 0.1, h * 0.08, w * 0.2, h * 0.3, { tl: 30, tr: 30, bl: 4, br: 4 });
  g.strokeRoundedRect(-w * 0.1, h * 0.08, w * 0.2, h * 0.3, { tl: 30, tr: 30, bl: 4, br: 4 });
}

function zzz(g: G, x: number, y: number, s: number): void {
  g.lineStyle(5, 0x6b5b95, 1);
  for (let i = 0; i < 3; i++) {
    const k = s * (0.6 + i * 0.35);
    const ox = x + i * s * 0.9;
    const oy = y - i * s * 0.9;
    g.beginPath();
    g.moveTo(ox - k / 2, oy - k / 2);
    g.lineTo(ox + k / 2, oy - k / 2);
    g.lineTo(ox - k / 2, oy + k / 2);
    g.lineTo(ox + k / 2, oy + k / 2);
    g.strokePath();
  }
}

function fog(g: G, w: number, h: number): void {
  g.fillStyle(0xffffff, 0.6);
  for (const [dx, dy, r] of [[-0.25, 0.3, 0.12], [-0.05, 0.36, 0.15], [0.2, 0.32, 0.13], [0.34, 0.38, 0.1]]) g.fillCircle(w * dx, h * dy, h * r);
}

function padlock(g: G, x: number, y: number): void {
  g.lineStyle(7, 0x8a8fa8, 1);
  g.beginPath();
  g.arc(x, y - 6, 12, Math.PI, 0);
  g.strokePath();
  g.fillStyle(0xf2b632, 1);
  g.fillRoundedRect(x - 16, y - 6, 32, 26, 6);
  g.lineStyle(4, DARK, 1);
  g.strokeRoundedRect(x - 16, y - 6, 32, 26, 6);
}

function owl(g: G, x: number, y: number, s: number, asleep: boolean): void {
  g.fillStyle(0xc9a074, 1);
  g.fillEllipse(x, y, s, s * 0.9);
  g.lineStyle(3, DARK, 1);
  g.strokeEllipse(x, y, s, s * 0.9);
  if (asleep) {
    g.beginPath();
    g.arc(x - s * 0.2, y - s * 0.05, s * 0.1, 0.1, Math.PI - 0.1);
    g.arc(x + s * 0.2, y - s * 0.05, s * 0.1, 0.1, Math.PI - 0.1);
    g.strokePath();
  } else {
    g.fillStyle(0xffffff, 1);
    g.fillCircle(x - s * 0.2, y - s * 0.05, s * 0.12);
    g.fillCircle(x + s * 0.2, y - s * 0.05, s * 0.12);
  }
}

const SLIDE_COLORS = [0xfde9c9, 0xe5dcf7, 0xd8efe4, 0xfbe0e6, 0xfde9c9, 0xd8efe4];

function slide(g: G, id: string, w: number, h: number): void {
  const n = Number(/(\d)$/.exec(id)?.[1] ?? 1);
  const idx = id.startsWith('shell-intro') ? n - 1 : 3 + n;
  g.fillStyle(SLIDE_COLORS[idx % SLIDE_COLORS.length], 1);
  g.fillRect(-w / 2, -h / 2, w, h);
  g.fillStyle(0xffffff, 0.55);
  g.fillEllipse(0, 20, w * 0.62, h * 0.62);
  g.fillStyle(0xf2b632, 1);
  g.fillCircle(0, 0, h * 0.13);
  g.lineStyle(6, DARK, 0.6);
  g.strokeCircle(0, 0, h * 0.13);
  g.fillStyle(0xff7fb5, 1);
  for (let i = 0; i < n; i++) g.fillCircle((i - (n - 1) / 2) * 56, h * 0.24, 14);
}

/** Draws the placeholder of a game shell id; false when `id` is not one of them. */
export function drawShellPlaceholder(g: G, id: string, w: number, h: number): boolean {
  if (id.startsWith('shell-')) {
    slide(g, id, w, h);
    return true;
  }
  const world = /^map-world-([a-z]+)-(open|closed)$/.exec(id);
  if (world) {
    const locked = world[2] === 'closed';
    switch (world[1]) {
      case 'workshop':
        house(g, w, h, 0xe7c79a, 0x9a6b45, true);
        g.fillStyle(0x8a5a33, 1);
        g.fillCircle(-w * 0.26, -h * 0.02, 16);
        g.fillCircle(w * 0.27, h * 0.02, 12);
        break;
      case 'bakery':
        house(g, w, h, 0xf6b9cf, 0xe0658f, !locked);
        g.fillStyle(0xfff3d6, 1);
        g.fillRoundedRect(-w * 0.28, -h * 0.02, w * 0.14, h * 0.16, 8);
        if (locked) {
          g.fillStyle(0xe6a15a, 1);
          g.fillCircle(-w * 0.21, h * 0.07, 14);
          zzz(g, -w * 0.12, -h * 0.08, 10);
        }
        break;
      case 'detective':
        house(g, w, h, 0xcdb7ee, 0x8a63c9, !locked);
        if (locked) {
          owl(g, 0, h * 0.2, w * 0.14, false);
          padlock(g, w * 0.3, h * 0.0);
          fog(g, w, h);
        }
        break;
      case 'jungle':
        g.lineStyle(26, 0x4f9a4a, 1);
        g.beginPath();
        g.arc(0, h * 0.18, w * 0.3, Math.PI, 0);
        g.strokePath();
        g.fillStyle(locked ? 0xe6f1ee : 0xa9dba0, 1);
        g.fillRect(-w * 0.3, h * 0.18, w * 0.6, h * 0.2);
        g.fillCircle(0, h * 0.18, w * 0.26);
        if (locked) {
          owl(g, -w * 0.2, -h * 0.18, w * 0.13, true);
          fog(g, w, h);
        }
        break;
      case 'garden':
        g.fillStyle(0x9ad07c, 1);
        g.fillEllipse(0, h * 0.2, w * 0.74, h * 0.62);
        g.fillStyle(0x8a5a33, 1);
        g.fillRoundedRect(-w * 0.1, h * 0.04, w * 0.2, h * 0.34, { tl: 34, tr: 34, bl: 4, br: 4 });
        g.lineStyle(5, DARK, 1);
        g.strokeRoundedRect(-w * 0.1, h * 0.04, w * 0.2, h * 0.34, { tl: 34, tr: 34, bl: 4, br: 4 });
        g.fillStyle(0xff7fb5, 1);
        for (const dx of [-0.08, 0, 0.08]) g.fillCircle(w * dx, h * 0.2, 9);
        break;
      default:
        return false;
    }
    return true;
  }
  switch (id) {
    case 'map-bg':
      g.fillStyle(0xfdeee0, 1);
      g.fillRect(-w / 2, -h / 2, w, h);
      g.fillStyle(0xcfe8b8, 1);
      for (const [x, y, rw, rh] of [[-0.42, -0.4, 0.36, 0.3], [0.42, -0.4, 0.36, 0.3], [-0.42, 0.42, 0.4, 0.3], [0.42, 0.42, 0.4, 0.3], [0, -0.5, 0.3, 0.18]]) g.fillEllipse(w * x, h * y, w * rw, h * rh);
      // The real art has the five cobblestone paths baked in; the placeholder draws them from the same polylines.
      g.lineStyle(46, 0xe8cfa6, 1);
      for (const world of WORLDS) {
        g.beginPath();
        world.path.forEach((p, i) => (i === 0 ? g.moveTo(p.x - w / 2, p.y - h / 2) : g.lineTo(p.x - w / 2, p.y - h / 2)));
        g.strokePath();
      }
      g.fillStyle(0xffffff, 0.7);
      for (const [x, y] of [[-0.3, 0.05], [0.3, -0.05], [-0.18, 0.4], [0.2, 0.35]]) g.fillCircle(w * x, h * y, 14);
      break;
    case 'map-frog-idle':
      g.fillStyle(0x8fd9a8, 1);
      g.fillEllipse(0, h * 0.14, w * 0.62, h * 0.52);
      g.fillCircle(0, -h * 0.14, w * 0.3);
      g.fillCircle(-w * 0.2, -h * 0.34, w * 0.12);
      g.fillCircle(w * 0.2, -h * 0.34, w * 0.12);
      g.lineStyle(4, DARK, 1);
      g.strokeCircle(0, -h * 0.14, w * 0.3);
      g.fillStyle(0xffffff, 1);
      g.fillCircle(-w * 0.2, -h * 0.34, w * 0.08);
      g.fillCircle(w * 0.2, -h * 0.34, w * 0.08);
      g.fillStyle(DARK, 1);
      g.fillCircle(-w * 0.2, -h * 0.34, 5);
      g.fillCircle(w * 0.2, -h * 0.34, 5);
      g.fillStyle(0xffe27a, 1);
      g.fillRoundedRect(-w * 0.14, h * 0.0, w * 0.28, h * 0.14, 8);
      break;
    default:
      return false;
  }
  return true;
}

/** A drawn nest piece (the feather has art; the others are placeholder shapes), centred on (0, 0), about `size` px. */
export function drawPieceShape(g: G, piece: string, size: number): void {
  const k = size / 120;
  switch (piece) {
    case 'knit-square':
      g.fillStyle(0xb7a6e8, 1);
      g.fillRoundedRect(-40 * k, -40 * k, 80 * k, 80 * k, 8 * k);
      g.lineStyle(3, 0x8e7bd0, 1);
      for (let i = -2; i <= 2; i++) g.lineBetween(-36 * k, i * 14 * k, 36 * k, i * 14 * k);
      break;
    case 'pebble':
      g.fillStyle(0xb9b4c4, 1);
      g.fillEllipse(0, 6 * k, 76 * k, 52 * k);
      g.lineStyle(4, DARK, 1);
      g.strokeEllipse(0, 6 * k, 76 * k, 52 * k);
      break;
    case 'leaf':
      g.fillStyle(0x62c05f, 1);
      g.fillEllipse(0, 0, 60 * k, 108 * k);
      g.lineStyle(4, DARK, 1);
      g.lineBetween(0, -48 * k, 0, 54 * k);
      break;
    case 'flower':
      g.fillStyle(0xff7fb5, 1);
      for (let i = 0; i < 6; i++) g.fillCircle(Math.cos((i / 6) * Math.PI * 2) * 26 * k, Math.sin((i / 6) * Math.PI * 2) * 26 * k, 18 * k);
      g.fillStyle(0xffe27a, 1);
      g.fillCircle(0, 0, 15 * k);
      break;
    default:
      g.fillStyle(0x62c7c1, 1);
      g.fillEllipse(0, 0, 50 * k, 100 * k);
  }
}

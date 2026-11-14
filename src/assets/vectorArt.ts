import Phaser from 'phaser';
import { colorOf, PALETTE } from './colors';
import { buildingArtKey } from '../anim/artRegistry';

const OUTLINE = 5;

function friendlyFace(g: Phaser.GameObjects.Graphics, cx: number, cy: number, size: number, smile = true): void {
  const eyeR = Math.max(2.5, size * 0.07);
  const eyeY = cy - size * 0.06;
  g.fillStyle(PALETTE.outline, 1);
  g.fillCircle(cx - size * 0.18, eyeY, eyeR);
  g.fillCircle(cx + size * 0.18, eyeY, eyeR);
  g.fillStyle(0xffffff, 0.85);
  g.fillCircle(cx - size * 0.18 - eyeR * 0.25, eyeY - eyeR * 0.3, eyeR * 0.35);
  g.fillCircle(cx + size * 0.18 - eyeR * 0.25, eyeY - eyeR * 0.3, eyeR * 0.35);
  if (smile) {
    g.lineStyle(Math.max(2.5, size * 0.06), PALETTE.outline, 1);
    g.beginPath();
    g.arc(cx, cy + size * 0.08, size * 0.2, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
    g.strokePath();
  }
}

function textureFromGraphics(
  scene: Phaser.Scene,
  key: string,
  g: Phaser.GameObjects.Graphics,
  w: number,
  h: number,
): Phaser.GameObjects.Image {
  // Hide before rasterizing so the raw Graphics at (0,0) never flashes,
  // and use make.image({add:false}) so the sprite is not also added to the scene.
  g.setVisible(false);
  g.generateTexture(key, w, h);
  g.destroy();
  return scene.make.image({ key, x: 0, y: 0, add: false });
}

/** Soft sky, sun, drifting clouds and a grassy island — shared home-map backdrop. */
export function paintMapBackdrop(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const g = scene.add.graphics();

  g.fillStyle(0x8ecfff, 1);
  g.fillRect(0, 0, w, h * 0.42);
  g.fillStyle(0xc5e7ff, 1);
  g.fillRect(0, h * 0.36, w, h * 0.12);
  g.fillStyle(0xffe7c2, 1);
  g.fillRect(0, h * 0.46, w, h * 0.54);

  // Sun
  const sunX = w * 0.12;
  const sunY = h * 0.16;
  g.fillStyle(0xffe066, 0.35);
  g.fillCircle(sunX, sunY, 70);
  g.fillStyle(0xffd93d, 1);
  g.fillCircle(sunX, sunY, 42);
  g.lineStyle(OUTLINE, PALETTE.outline, 1);
  g.strokeCircle(sunX, sunY, 42);

  // Island — slightly wider in portrait so the five landmarks stay on the grass.
  const portrait = h > w;
  const ix = w / 2;
  const iy = h * (portrait ? 0.66 : 0.62);
  const islandW = portrait ? w * 0.98 : w * 0.86;
  const islandH = portrait ? h * 0.5 : h * 0.48;
  g.fillStyle(0xe8c27a, 1);
  g.fillEllipse(ix, iy + 70, islandW, islandH);
  g.fillStyle(0x7bc47f, 1);
  g.fillEllipse(ix, iy + 30, islandW * 0.93, islandH * 0.88);
  g.fillStyle(0x64b86c, 1);
  g.fillEllipse(ix - w * 0.16, iy + 10, w * 0.28, h * 0.14);
  g.fillEllipse(ix + w * 0.18, iy + 28, w * 0.24, h * 0.12);
  g.lineStyle(OUTLINE, PALETTE.outline, 0.35);
  g.strokeEllipse(ix, iy + 70, islandW, islandH);

  // Flowers sit on open grass, away from building footprints.
  const flowers: Array<[number, number, number]> = [
    [ix + w * 0.32, iy + h * 0.14, PALETTE.pink],
    [ix + w * 0.22, iy + h * 0.18, PALETTE.yellow],
    [ix - w * 0.02, iy + h * 0.2, PALETTE.purple],
  ];
  for (const [fx, fy, col] of flowers) {
    g.fillStyle(colorOf('green'), 1);
    g.fillRect(fx - 2, fy, 4, 16);
    g.fillStyle(col, 1);
    g.fillCircle(fx, fy, 8);
    g.lineStyle(2, PALETTE.outline, 1);
    g.strokeCircle(fx, fy, 8);
  }
  g.setDepth(-10);

  // Drifting clouds
  for (let i = 0; i < 3; i++) {
    const cloud = scene.add.container(w * (0.28 + i * 0.25), h * (0.1 + (i % 2) * 0.06));
    const cg = scene.add.graphics();
    cg.fillStyle(0xffffff, 0.92);
    cg.fillCircle(-28, 6, 22);
    cg.fillCircle(0, 0, 28);
    cg.fillCircle(26, 8, 20);
    cloud.add(cg);
    cloud.setDepth(-5);
    scene.tweens.add({
      targets: cloud,
      x: cloud.x + 24,
      duration: 4200 + i * 600,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });
  }
}

/** Warm kitchen wall, floorboards and a serving counter for the restaurant. */
export function paintRestaurantKitchen(scene: Phaser.Scene): void {
  const w = scene.scale.width;
  const h = scene.scale.height;
  const g = scene.add.graphics();
  g.setDepth(-10);

  g.fillStyle(0xffe4c4, 1);
  g.fillRect(0, 0, w, h * 0.5);
  g.fillStyle(0xf7c59f, 1);
  g.fillRect(0, h * 0.48, w, h * 0.14);

  // Back wall window
  const wx = w * 0.16;
  const wy = h * 0.16;
  g.fillStyle(0x9ad8ff, 1);
  g.fillRoundedRect(wx, wy, 150, 110, 16);
  g.lineStyle(OUTLINE, PALETTE.outline, 1);
  g.strokeRoundedRect(wx, wy, 150, 110, 16);
  g.lineBetween(wx + 75, wy, wx + 75, wy + 110);
  g.lineBetween(wx, wy + 55, wx + 150, wy + 55);
  // Curtain
  g.fillStyle(0xff6fb5, 1);
  g.fillRoundedRect(wx - 8, wy - 12, 166, 18, 8);

  // Floor
  g.fillStyle(0xe0a36a, 1);
  g.fillRect(0, h * 0.62, w, h * 0.38);
  g.lineStyle(3, 0xc9894a, 0.8);
  for (let y = h * 0.62; y < h; y += 28) {
    g.lineBetween(0, y, w, y);
  }

  // Counter
  const cy = h * 0.58;
  g.fillStyle(0xa97155, 1);
  g.fillRoundedRect(w * 0.08, cy, w * 0.84, h * 0.16, 18);
  g.lineStyle(OUTLINE, PALETTE.outline, 1);
  g.strokeRoundedRect(w * 0.08, cy, w * 0.84, h * 0.16, 18);
  g.fillStyle(0xfff3d6, 1);
  g.fillRoundedRect(w * 0.08, cy, w * 0.84, 22, 8);
  g.strokeRoundedRect(w * 0.08, cy, w * 0.84, 22, 8);

  // Hanging lamp
  g.lineStyle(OUTLINE, PALETTE.outline, 1);
  g.lineBetween(w * 0.82, 0, w * 0.82, 48);
  g.fillStyle(0xffd93d, 1);
  g.fillTriangle(w * 0.82 - 28, 48, w * 0.82 + 28, 48, w * 0.82, 88);
  g.strokeTriangle(w * 0.82 - 28, 48, w * 0.82 + 28, 48, w * 0.82, 88);
}

/** Original rounded-outline food icon with a highlight (no face — shapes stay readable). */
export function drawFoodIcon(scene: Phaser.Scene, shape: string, color: string, size = 110): Phaser.GameObjects.Container {
  const key = `food-${shape}-${color}-${size}`;
  if (!scene.textures.exists(key)) {
    const pad = size * 0.7;
    const g = scene.add.graphics();
    g.translateCanvas(pad, pad);
    const c = colorOf(color);
    g.lineStyle(OUTLINE, PALETTE.outline, 1);
    const r = size * 0.42;

    const highlight = (x: number, y: number, rw: number, rh: number) => {
      g.fillStyle(0xffffff, 0.45);
      g.fillEllipse(x, y, rw, rh);
    };

    switch (shape) {
      case 'banana': {
        g.fillStyle(c, 1);
        g.fillRoundedRect(-r, -r * 0.42, r * 2.1, r * 0.85, r * 0.42);
        g.strokeRoundedRect(-r, -r * 0.42, r * 2.1, r * 0.85, r * 0.42);
        highlight(-r * 0.2, -r * 0.15, r * 0.7, r * 0.2);
        break;
      }
      case 'carrot': {
        g.fillStyle(c, 1);
        g.beginPath();
        g.moveTo(0, r * 1.15);
        g.lineTo(r * 0.55, -r * 0.55);
        g.lineTo(-r * 0.55, -r * 0.55);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.fillStyle(colorOf('green'), 1);
        g.beginPath();
        g.moveTo(0, -r * 0.5);
        g.lineTo(-r * 0.45, -r * 1.25);
        g.lineTo(0, -r * 0.8);
        g.lineTo(r * 0.45, -r * 1.25);
        g.closePath();
        g.fillPath();
        g.strokePath();
        break;
      }
      case 'grapes': {
        const spots = [
          [0, -r * 0.55],
          [-r * 0.48, 0],
          [r * 0.48, 0],
          [0, r * 0.5],
          [-r * 0.28, r * 0.95],
          [r * 0.28, r * 0.95],
        ];
        for (const [dx, dy] of spots) {
          g.fillStyle(c, 1);
          g.fillCircle(dx, dy, r * 0.42);
          g.strokeCircle(dx, dy, r * 0.42);
        }
        g.fillStyle(colorOf('green'), 1);
        g.fillEllipse(0, -r * 1.05, r * 0.4, r * 0.2);
        break;
      }
      case 'cheese': {
        g.fillStyle(c, 1);
        g.beginPath();
        g.moveTo(-r, r * 0.85);
        g.lineTo(r, r * 0.85);
        g.lineTo(r * 0.15, -r);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.fillStyle(0xfff6c2, 1);
        g.fillCircle(-r * 0.15, r * 0.2, r * 0.16);
        g.fillCircle(r * 0.28, r * 0.4, r * 0.12);
        break;
      }
      case 'strawberry': {
        g.fillStyle(c, 1);
        g.fillEllipse(0, r * 0.15, r * 1.55, r * 1.8);
        g.strokeEllipse(0, r * 0.15, r * 1.55, r * 1.8);
        g.fillStyle(colorOf('green'), 1);
        g.beginPath();
        g.moveTo(-r * 0.45, -r * 0.45);
        g.lineTo(0, -r * 0.95);
        g.lineTo(r * 0.45, -r * 0.45);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.fillStyle(0xffffff, 0.7);
        g.fillCircle(-r * 0.25, r * 0.05, r * 0.08);
        g.fillCircle(r * 0.2, r * 0.3, r * 0.07);
        break;
      }
      case 'broccoli': {
        g.fillStyle(colorOf('brown'), 1);
        g.fillRoundedRect(-r * 0.16, r * 0.15, r * 0.32, r * 0.75, 6);
        g.strokeRoundedRect(-r * 0.16, r * 0.15, r * 0.32, r * 0.75, 6);
        g.fillStyle(c, 1);
        ;[
          [-r * 0.4, -r * 0.05],
          [r * 0.4, -r * 0.05],
          [0, -r * 0.5],
        ].forEach(([dx, dy]) => {
          g.fillCircle(dx, dy, r * 0.48);
          g.strokeCircle(dx, dy, r * 0.48);
        });
        break;
      }
      case 'cookie': {
        g.fillStyle(c, 1);
        g.fillCircle(0, 0, r);
        g.strokeCircle(0, 0, r);
        g.fillStyle(colorOf('brown'), 1);
        ;[
          [-r * 0.4, -r * 0.3],
          [r * 0.3, -r * 0.1],
          [-r * 0.1, r * 0.4],
          [r * 0.4, r * 0.35],
        ].forEach(([dx, dy]) => g.fillCircle(dx, dy, r * 0.12));
        friendlyFace(g, 0, 0, size * 0.85);
        break;
      }
      case 'egg': {
        g.fillStyle(c, 1);
        g.fillEllipse(0, 0, r * 1.45, r * 1.9);
        g.strokeEllipse(0, 0, r * 1.45, r * 1.9);
        highlight(-r * 0.2, -r * 0.35, r * 0.4, r * 0.25);
        break;
      }
      case 'pear': {
        g.fillStyle(c, 1);
        g.fillCircle(0, r * 0.28, r * 0.85);
        g.fillCircle(0, -r * 0.38, r * 0.52);
        g.strokeCircle(0, r * 0.28, r * 0.85);
        g.strokeCircle(0, -r * 0.38, r * 0.52);
        g.fillStyle(colorOf('brown'), 1);
        g.fillRect(-r * 0.05, -r * 1.0, r * 0.1, r * 0.28);
        break;
      }
      case 'orange': {
        g.fillStyle(c, 1);
        g.fillCircle(0, 0, r);
        g.strokeCircle(0, 0, r);
        highlight(-r * 0.25, -r * 0.25, r * 0.4, r * 0.22);
        g.fillStyle(colorOf('green'), 1);
        g.fillEllipse(r * 0.15, -r * 0.95, r * 0.4, r * 0.18);
        break;
      }
      case 'fish': {
        g.fillStyle(c, 1);
        g.fillEllipse(0, 0, r * 2, r * 1.25);
        g.strokeEllipse(0, 0, r * 2, r * 1.25);
        g.beginPath();
        g.moveTo(r * 0.85, 0);
        g.lineTo(r * 1.5, -r * 0.55);
        g.lineTo(r * 1.5, r * 0.55);
        g.closePath();
        g.fillPath();
        g.strokePath();
        g.fillStyle(PALETTE.outline, 1);
        g.fillCircle(-r * 0.45, -r * 0.1, r * 0.1);
        break;
      }
      case 'apple':
      default: {
        g.fillStyle(c, 1);
        g.fillCircle(0, r * 0.08, r);
        g.strokeCircle(0, r * 0.08, r);
        highlight(-r * 0.25, -r * 0.15, r * 0.4, r * 0.22);
        g.fillStyle(colorOf('brown'), 1);
        g.fillRect(-r * 0.06, -r * 1.0, r * 0.12, r * 0.32);
        g.fillStyle(colorOf('green'), 1);
        g.fillEllipse(r * 0.28, -r * 0.9, r * 0.4, r * 0.18);
        break;
      }
    }

    textureFromGraphics(scene, key, g, pad * 2, pad * 2);
  }

  const img = scene.make.image({ key, x: 0, y: 0, add: false });
  img.setDisplaySize(size * 2.0, size * 2.0);
  const container = scene.add.container(0, 0, [img]);
  container.setSize(size * 2.0, size * 2.0);
  return container;
}

const ANIMAL_BODY_COLORS: Record<string, number> = {
  bear: colorOf('brown'),
  rabbit: colorOf('cream'),
  cat: colorOf('orange'),
  dog: 0xd9a066,
  panda: colorOf('white'),
  lion: colorOf('yellow'),
};

/** Original rounded animal mascot — each kind has a readable silhouette. */
export function drawAnimal(scene: Phaser.Scene, kind: string, size = 260): Phaser.GameObjects.Container {
  const key = `animal-${kind}-${size}`;
  if (!scene.textures.exists(key)) {
    const pad = size * 0.9;
    const g = scene.add.graphics();
    g.translateCanvas(pad, pad);
    const body = ANIMAL_BODY_COLORS[kind] ?? colorOf('brown');
    const r = size * 0.3;
    const headY = -size * 0.26;
    g.lineStyle(OUTLINE, PALETTE.outline, 1);

    // Body
    g.fillStyle(body, 1);
    g.fillCircle(0, size * 0.12, r * 1.35);
    g.strokeCircle(0, size * 0.12, r * 1.35);

    // Kind-specific features
    if (kind === 'lion') {
      g.fillStyle(0xff9f43, 1);
      for (let i = 0; i < 8; i++) {
        const a = (i / 8) * Math.PI * 2;
        g.fillCircle(Math.cos(a) * r * 1.05, headY + Math.sin(a) * r * 1.05, r * 0.38);
        g.strokeCircle(Math.cos(a) * r * 1.05, headY + Math.sin(a) * r * 1.05, r * 0.38);
      }
    }

    if (kind === 'rabbit') {
      g.fillStyle(body, 1);
      g.fillEllipse(-r * 0.45, headY - r * 1.05, r * 0.42, r * 1.15);
      g.fillEllipse(r * 0.45, headY - r * 1.05, r * 0.42, r * 1.15);
      g.strokeEllipse(-r * 0.45, headY - r * 1.05, r * 0.42, r * 1.15);
      g.strokeEllipse(r * 0.45, headY - r * 1.05, r * 0.42, r * 1.15);
      g.fillStyle(0xffc6d9, 1);
      g.fillEllipse(-r * 0.45, headY - r * 1.0, r * 0.2, r * 0.8);
      g.fillEllipse(r * 0.45, headY - r * 1.0, r * 0.2, r * 0.8);
    } else if (kind === 'cat') {
      g.fillStyle(body, 1);
      g.fillTriangle(-r * 0.95, headY, -r * 0.15, headY - r * 0.15, -r * 0.55, headY - r * 0.95);
      g.fillTriangle(r * 0.95, headY, r * 0.15, headY - r * 0.15, r * 0.55, headY - r * 0.95);
      g.strokeTriangle(-r * 0.95, headY, -r * 0.15, headY - r * 0.15, -r * 0.55, headY - r * 0.95);
      g.strokeTriangle(r * 0.95, headY, r * 0.15, headY - r * 0.15, r * 0.55, headY - r * 0.95);
    } else if (kind !== 'lion') {
      const earY = headY - size * 0.28;
      const earFill = kind === 'panda' ? PALETTE.outline : body;
      g.fillStyle(earFill, 1);
      g.fillCircle(-r * 0.85, earY, r * 0.38);
      g.fillCircle(r * 0.85, earY, r * 0.38);
      g.strokeCircle(-r * 0.85, earY, r * 0.38);
      g.strokeCircle(r * 0.85, earY, r * 0.38);
    }

    // Head
    g.fillStyle(body, 1);
    g.fillCircle(0, headY, r);
    g.strokeCircle(0, headY, r);

    if (kind === 'panda') {
      g.fillStyle(PALETTE.outline, 1);
      g.fillEllipse(-r * 0.38, headY - r * 0.05, r * 0.42, r * 0.32);
      g.fillEllipse(r * 0.38, headY - r * 0.05, r * 0.42, r * 0.32);
    }

    if (kind === 'bear' || kind === 'dog') {
      g.fillStyle(0xffe0c2, 1);
      g.fillEllipse(0, headY + r * 0.42, r * 0.55, r * 0.32);
      g.strokeEllipse(0, headY + r * 0.42, r * 0.55, r * 0.32);
    }

    friendlyFace(g, 0, headY, size * 0.55);
    textureFromGraphics(scene, key, g, pad * 2, pad * 2);
  }
  const img = scene.make.image({ key, x: 0, y: 0, add: false });
  const container = scene.add.container(0, 0, [img]);
  container.setSize(size, size);
  return container;
}

export const ANIMAL_KINDS = Object.keys(ANIMAL_BODY_COLORS);

/** Distinct building / landmark per world, same outline style. */
export function drawWorldBuilding(scene: Phaser.Scene, worldId: string, locked: boolean, size = 200): Phaser.GameObjects.Container {
  // Registered SVG building art (open buildings only; the lock overlay stays procedural).
  const artKey = locked ? undefined : buildingArtKey(worldId);
  if (artKey && scene.textures.exists(artKey)) {
    const art = scene.make.image({ key: artKey, x: 0, y: 0, add: false });
    art.setDisplaySize(size * 1.5, size * 1.5);
    const box = scene.add.container(0, 0, [art]);
    box.setSize(size, size);
    return box;
  }
  const key = `world-${worldId}-${locked ? 'locked' : 'open'}-${size}`;
  if (!scene.textures.exists(key)) {
    const pad = size * 0.75;
    const g = scene.add.graphics();
    g.translateCanvas(pad, pad);
    g.lineStyle(OUTLINE, PALETTE.outline, 1);
    const w = size * 0.85;
    const h = size * 0.55;

    const house = (roof: number, body = PALETTE.cream) => {
      g.fillStyle(body, 1);
      g.fillRoundedRect(-w / 2, 0, w, h, 16);
      g.strokeRoundedRect(-w / 2, 0, w, h, 16);
      g.fillStyle(roof, 1);
      g.beginPath();
      g.moveTo(-w / 2 - 14, 4);
      g.lineTo(0, -h * 0.95);
      g.lineTo(w / 2 + 14, 4);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(colorOf('brown'), 1);
      g.fillRoundedRect(-w * 0.12, h * 0.35, w * 0.24, h * 0.65, 6);
      g.strokeRoundedRect(-w * 0.12, h * 0.35, w * 0.24, h * 0.65, 6);
    };

    const window = (x: number, y: number, rw = 18, rh = 20) => {
      g.fillStyle(0x9ad8ff, 1);
      g.fillRoundedRect(x, y, rw, rh, 5);
      g.strokeRoundedRect(x, y, rw, rh, 5);
    };

    switch (worldId) {
      case 'language-house': {
        house(colorOf('orange'));
        window(-w * 0.36, h * 0.18);
        window(w * 0.2, h * 0.18);
        // Awning
        g.fillStyle(0xe2554f, 1);
        g.fillTriangle(-w * 0.22, h * 0.28, 0, h * 0.12, w * 0.22, h * 0.28);
        g.strokeTriangle(-w * 0.22, h * 0.28, 0, h * 0.12, w * 0.22, h * 0.28);
        break;
      }
      case 'number-garden': {
        // Greenhouse + garden beds
        g.fillStyle(0xcdeed0, 1);
        g.fillRoundedRect(-w * 0.45, -h * 0.15, w * 0.9, h * 1.1, 18);
        g.strokeRoundedRect(-w * 0.45, -h * 0.15, w * 0.9, h * 1.1, 18);
        g.fillStyle(colorOf('green'), 1);
        g.beginPath();
        g.moveTo(-w * 0.45, -h * 0.1);
        g.lineTo(0, -h * 0.95);
        g.lineTo(w * 0.45, -h * 0.1);
        g.closePath();
        g.fillPath();
        g.strokePath();
        window(-w * 0.22, h * 0.2, 22, 26);
        window(w * 0.02, h * 0.2, 22, 26);
        // Flowers in front
        g.fillStyle(PALETTE.yellow, 1);
        g.fillCircle(-w * 0.28, h * 0.95, 10);
        g.fillStyle(PALETTE.pink, 1);
        g.fillCircle(0, h * 1.0, 10);
        g.fillStyle(PALETTE.purple, 1);
        g.fillCircle(w * 0.28, h * 0.95, 10);
        g.lineStyle(OUTLINE, PALETTE.outline, 1);
        g.strokeCircle(-w * 0.28, h * 0.95, 10);
        g.strokeCircle(0, h * 1.0, 10);
        g.strokeCircle(w * 0.28, h * 0.95, 10);
        break;
      }
      case 'nature-lab': {
        house(colorOf('teal'), 0xe8fff8);
        // Round lab window
        g.fillStyle(0x9ad8ff, 1);
        g.fillCircle(-w * 0.22, h * 0.32, 16);
        g.strokeCircle(-w * 0.22, h * 0.32, 16);
        // Leaf on the roof
        g.fillStyle(colorOf('green'), 1);
        g.fillEllipse(w * 0.1, -h * 0.55, 28, 16);
        g.strokeEllipse(w * 0.1, -h * 0.55, 28, 16);
        break;
      }
      case 'science-world': {
        // Fallback for public/art/buildings/science-world.svg: lab house, porthole, green flask.
        house(0x6c8cff, 0xfff6e0);
        g.fillStyle(0x9ad8ff, 1);
        g.fillCircle(-w * 0.3, h * 0.36, 16);
        g.strokeCircle(-w * 0.3, h * 0.36, 16);
        g.fillStyle(0x7bd389, 1);
        g.fillCircle(w * 0.3, h * 0.6, 18);
        g.strokeCircle(w * 0.3, h * 0.6, 18);
        g.fillRoundedRect(w * 0.3 - 7, h * 0.2, 14, 20, 4);
        g.strokeRoundedRect(w * 0.3 - 7, h * 0.2, 14, 20, 4);
        break;
      }
      case 'art-studio': {
        house(colorOf('purple'), 0xfff0e0);
        window(-w * 0.34, h * 0.16, 22, 22);
        // Easel
        g.lineStyle(OUTLINE, PALETTE.outline, 1);
        g.lineBetween(w * 0.22, h * 1.05, w * 0.32, h * 0.35);
        g.lineBetween(w * 0.42, h * 1.05, w * 0.32, h * 0.35);
        g.fillStyle(0xffe066, 1);
        g.fillRoundedRect(w * 0.18, h * 0.28, 30, 26, 4);
        g.strokeRoundedRect(w * 0.18, h * 0.28, 30, 26, 4);
        break;
      }
      case 'leisure-corner': {
        // Bubble tree / fountain, not a house
        g.fillStyle(colorOf('brown'), 1);
        g.fillRoundedRect(-12, h * 0.2, 24, h * 0.9, 10);
        g.strokeRoundedRect(-12, h * 0.2, 24, h * 0.9, 10);
        const bubbles: Array<[number, number, number, number]> = [
          [0, -h * 0.15, 36, colorOf('pink')],
          [-38, h * 0.15, 28, colorOf('blue')],
          [40, h * 0.2, 24, colorOf('purple')],
          [8, h * 0.45, 20, colorOf('teal')],
        ];
        for (const [bx, by, br, col] of bubbles) {
          g.fillStyle(col, 0.85);
          g.fillCircle(bx, by, br);
          g.lineStyle(OUTLINE, PALETTE.outline, 1);
          g.strokeCircle(bx, by, br);
          g.fillStyle(0xffffff, 0.7);
          g.fillEllipse(bx - br * 0.3, by - br * 0.3, br * 0.45, br * 0.28);
        }
        break;
      }
      default:
        house(colorOf('orange'));
    }

    if (locked) {
      g.fillStyle(0xffffff, 0.55);
      g.fillRoundedRect(-26, -8, 52, 44, 10);
      g.fillStyle(PALETTE.outline, 1);
      g.fillRoundedRect(-18, 0, 36, 28, 6);
      g.lineStyle(OUTLINE, PALETTE.outline, 1);
      g.beginPath();
      g.arc(0, 0, 12, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
      g.strokePath();
    }

    textureFromGraphics(scene, key, g, pad * 2, pad * 2);
  }
  const img = scene.make.image({ key, x: 0, y: 0, add: false });
  const container = scene.add.container(0, 0, [img]);
  container.setSize(size, size);
  return container;
}

/** Original soft bubble with a highlight, used by the leisure bubble-pop corner. */
export function drawBubble(scene: Phaser.Scene, diameter: number): Phaser.GameObjects.Container {
  const key = `bubble-p-${diameter}`;
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    const r = diameter / 2;
    const pad = Math.ceil(r + 6);
    g.translateCanvas(pad, pad);
    g.fillStyle(0x7ec8ff, 0.45);
    g.fillCircle(0, 0, r);
    g.lineStyle(4, 0xffffff, 0.95);
    g.strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.85);
    g.fillEllipse(-r * 0.32, -r * 0.32, r * 0.5, r * 0.3);
    textureFromGraphics(scene, key, g, pad * 2, pad * 2);
  }
  const img = scene.make.image({ key, x: 0, y: 0, add: false });
  const container = scene.add.container(0, 0, [img]);
  container.setSize(diameter, diameter);
  return container;
}

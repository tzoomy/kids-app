import Phaser from 'phaser';
import { colorOf, PALETTE } from './colors';

const OUTLINE_WIDTH = 4;

function face(g: Phaser.GameObjects.Graphics, size: number, cx = 0, cy = 0): void {
  const eyeOffset = size * 0.18;
  const eyeY = cy - size * 0.05;
  const eyeR = Math.max(2, size * 0.07);
  g.fillStyle(PALETTE.outline, 1);
  g.fillCircle(cx - eyeOffset, eyeY, eyeR);
  g.fillCircle(cx + eyeOffset, eyeY, eyeR);
  g.lineStyle(Math.max(2, size * 0.05), PALETTE.outline, 1);
  g.beginPath();
  g.arc(cx, cy + size * 0.12, size * 0.18, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
  g.strokePath();
}

/** Original rounded-outline food icon with a friendly face, drawn as vector shapes (no external art). */
export function drawFoodIcon(scene: Phaser.Scene, shape: string, color: string, size = 100): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  // generateTexture rasterizes from the Graphics' local (0,0), so shift the origin
  // to the texture center before drawing shapes that extend into negative coordinates.
  g.translateCanvas(size * 1.6, size * 1.6);
  const c = colorOf(color);
  g.lineStyle(OUTLINE_WIDTH, PALETTE.outline, 1);
  const r = size * 0.42;

  switch (shape) {
    case 'banana': {
      g.fillStyle(c, 1);
      g.fillRoundedRect(-r, -r * 0.4, r * 2, r * 0.8, r * 0.4);
      g.strokeRoundedRect(-r, -r * 0.4, r * 2, r * 0.8, r * 0.4);
      break;
    }
    case 'carrot': {
      g.fillStyle(c, 1);
      g.beginPath();
      g.moveTo(0, -r);
      g.lineTo(r * 0.7, r);
      g.lineTo(-r * 0.7, r);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(colorOf('green'), 1);
      g.fillTriangle(-r * 0.3, -r, 0, -r * 1.5, r * 0.3, -r);
      break;
    }
    case 'grapes': {
      g.fillStyle(c, 1);
      const spots = [
        [0, -r * 0.5],
        [-r * 0.45, 0],
        [r * 0.45, 0],
        [0, r * 0.5],
        [-r * 0.3, r],
        [r * 0.3, r],
      ];
      for (const [dx, dy] of spots) {
        g.fillCircle(dx, dy, r * 0.42);
        g.strokeCircle(dx, dy, r * 0.42);
      }
      break;
    }
    case 'cheese': {
      g.fillStyle(c, 1);
      g.beginPath();
      g.moveTo(-r, r * 0.8);
      g.lineTo(r, r * 0.8);
      g.lineTo(0, -r);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(PALETTE.cream, 1);
      g.fillCircle(-r * 0.2, r * 0.2, r * 0.15);
      g.fillCircle(r * 0.25, r * 0.4, r * 0.12);
      break;
    }
    case 'strawberry': {
      g.fillStyle(c, 1);
      g.beginPath();
      g.moveTo(-r, -r * 0.2);
      g.lineTo(r, -r * 0.2);
      g.lineTo(0, r);
      g.closePath();
      g.fillPath();
      g.strokePath();
      g.fillStyle(colorOf('green'), 1);
      g.fillTriangle(-r * 0.5, -r * 0.2, r * 0.5, -r * 0.2, 0, -r * 0.8);
      break;
    }
    case 'broccoli': {
      g.fillStyle(colorOf('brown'), 1);
      g.fillRect(-r * 0.15, r * 0.3, r * 0.3, r * 0.6);
      g.fillStyle(c, 1);
      [[-r * 0.4, -r * 0.1], [r * 0.4, -r * 0.1], [0, -r * 0.5]].forEach(([dx, dy]) => {
        g.fillCircle(dx, dy, r * 0.5);
        g.strokeCircle(dx, dy, r * 0.5);
      });
      break;
    }
    case 'cookie': {
      g.fillStyle(c, 1);
      g.fillCircle(0, 0, r);
      g.strokeCircle(0, 0, r);
      g.fillStyle(colorOf('outline'), 1);
      [[-r * 0.4, -r * 0.3], [r * 0.3, -r * 0.1], [-r * 0.1, r * 0.4], [r * 0.4, r * 0.4]].forEach(([dx, dy]) =>
        g.fillCircle(dx, dy, r * 0.12),
      );
      break;
    }
    case 'egg': {
      g.fillStyle(c, 1);
      g.fillEllipse(0, 0, r * 1.5, r * 2);
      g.strokeEllipse(0, 0, r * 1.5, r * 2);
      break;
    }
    case 'pear': {
      g.fillStyle(c, 1);
      g.fillCircle(0, r * 0.25, r * 0.85);
      g.fillCircle(0, -r * 0.4, r * 0.5);
      g.strokeCircle(0, r * 0.25, r * 0.85);
      g.strokeCircle(0, -r * 0.4, r * 0.5);
      break;
    }
    case 'orange': {
      g.fillStyle(c, 1);
      g.fillCircle(0, 0, r);
      g.strokeCircle(0, 0, r);
      g.fillStyle(colorOf('green'), 1);
      g.fillRect(-r * 0.08, -r * 1.1, r * 0.16, r * 0.3);
      break;
    }
    case 'fish': {
      g.fillStyle(c, 1);
      g.fillEllipse(0, 0, r * 2, r * 1.3);
      g.strokeEllipse(0, 0, r * 2, r * 1.3);
      g.fillTriangle(r * 0.9, 0, r * 1.5, -r * 0.6, r * 1.5, r * 0.6);
      break;
    }
    case 'apple':
    default: {
      g.fillStyle(c, 1);
      g.fillCircle(0, r * 0.1, r);
      g.strokeCircle(0, r * 0.1, r);
      g.fillStyle(colorOf('brown'), 1);
      g.fillRect(-r * 0.06, -r * 1.05, r * 0.12, r * 0.3);
      g.fillStyle(colorOf('green'), 1);
      g.fillEllipse(r * 0.25, -r * 0.95, r * 0.35, r * 0.18);
      break;
    }
  }

  face(g, size);
  g.generateTexture(`food-${shape}-${color}`, size * 3.2, size * 3.2);
  g.destroy();

  const img = scene.add.image(0, 0, `food-${shape}-${color}`);
  const container = scene.add.container(0, 0, [img]);
  container.setSize(size * 1.6, size * 1.6);
  return container;
}

const ANIMAL_BODY_COLORS: Record<string, number> = {
  bear: colorOf('brown'),
  rabbit: colorOf('cream'),
  cat: colorOf('orange'),
  dog: colorOf('pink'),
  panda: colorOf('white'),
  lion: colorOf('yellow'),
};

/** Original rounded animal mascot used in the restaurant round — vector shapes, not emoji. */
export function drawAnimal(scene: Phaser.Scene, kind: string, size = 220): Phaser.GameObjects.Container {
  const key = `animal-${kind}`;
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    g.translateCanvas(size * 0.8, size * 0.8);
    const body = ANIMAL_BODY_COLORS[kind] ?? colorOf('brown');
    const r = size * 0.32;
    const headY = -size * 0.28;
    g.lineStyle(OUTLINE_WIDTH, PALETTE.outline, 1);
    g.fillStyle(body, 1);
    g.fillCircle(0, size * 0.08, r * 1.4);
    g.strokeCircle(0, size * 0.08, r * 1.4);
    g.fillCircle(0, headY, r);
    g.strokeCircle(0, headY, r);
    g.fillStyle(body, 1);
    g.fillCircle(-r * 0.85, headY - size * 0.27, r * 0.4);
    g.fillCircle(r * 0.85, headY - size * 0.27, r * 0.4);
    g.strokeCircle(-r * 0.85, headY - size * 0.27, r * 0.4);
    g.strokeCircle(r * 0.85, headY - size * 0.27, r * 0.4);
    face(g, size * 0.6, 0, headY);
    g.generateTexture(key, size * 1.6, size * 1.6);
    g.destroy();
  }
  const img = scene.add.image(0, 0, key);
  const container = scene.add.container(0, 0, [img]);
  container.setSize(size, size);
  return container;
}

export const ANIMAL_KINDS = Object.keys(ANIMAL_BODY_COLORS);

const WORLD_COLORS: Record<string, number> = {
  'language-house': colorOf('orange'),
  'number-garden': colorOf('green'),
  'nature-lab': colorOf('teal'),
  'art-studio': colorOf('purple'),
  'leisure-corner': colorOf('pink'),
};

/** Original rounded "building" icon for one world-map tile. */
export function drawWorldBuilding(scene: Phaser.Scene, worldId: string, locked: boolean, size = 180): Phaser.GameObjects.Container {
  const key = `world-${worldId}-${locked ? 'locked' : 'open'}`;
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    g.translateCanvas(size * 0.6, size * 0.6);
    const roof = WORLD_COLORS[worldId] ?? colorOf('orange');
    const w = size * 0.8;
    const h = size * 0.55;
    g.lineStyle(OUTLINE_WIDTH, PALETTE.outline, 1);
    g.fillStyle(PALETTE.cream, 1);
    g.fillRoundedRect(-w / 2, 0, w, h, 14);
    g.strokeRoundedRect(-w / 2, 0, w, h, 14);
    g.fillStyle(roof, 1);
    g.beginPath();
    g.moveTo(-w / 2 - 10, 0);
    g.lineTo(0, -h * 0.9);
    g.lineTo(w / 2 + 10, 0);
    g.closePath();
    g.fillPath();
    g.strokePath();
    g.fillStyle(colorOf('brown'), 1);
    g.fillRoundedRect(-w * 0.12, h * 0.42, w * 0.24, h * 0.58, 4);

    if (locked) {
      const lockY = -h * 0.1;
      g.fillStyle(PALETTE.outline, 1);
      g.fillRoundedRect(-w * 0.14, lockY, w * 0.28, h * 0.32, 6);
      g.lineStyle(OUTLINE_WIDTH, PALETTE.outline, 1);
      g.beginPath();
      g.arc(0, lockY, w * 0.12, Phaser.Math.DegToRad(180), Phaser.Math.DegToRad(360), false);
      g.strokePath();
    }

    g.generateTexture(key, size * 1.2, size * 1.2);
    g.destroy();
  }
  const img = scene.add.image(0, 0, key);
  const container = scene.add.container(0, 0, [img]);
  container.setSize(size, size);
  return container;
}

/** Original soft bubble with a highlight, used by the leisure bubble-pop corner. */
export function drawBubble(scene: Phaser.Scene, diameter: number): Phaser.GameObjects.Container {
  const key = `bubble-${diameter}`;
  if (!scene.textures.exists(key)) {
    const g = scene.add.graphics();
    const r = diameter / 2;
    g.translateCanvas(r, r);
    g.fillStyle(colorOf('blue'), 0.35);
    g.fillCircle(0, 0, r);
    g.lineStyle(3, 0xffffff, 0.9);
    g.strokeCircle(0, 0, r);
    g.fillStyle(0xffffff, 0.8);
    g.fillEllipse(-r * 0.35, -r * 0.35, r * 0.5, r * 0.3);
    g.generateTexture(key, diameter, diameter);
    g.destroy();
  }
  const img = scene.add.image(0, 0, key);
  const container = scene.add.container(0, 0, [img]);
  container.setSize(diameter, diameter);
  return container;
}

// Procedural fallback art for Sorting Beds, used whenever a texture key from the art PRs (#20, #42) is missing,
// so the game is clean and playable on its own. Drafted with Gemini (gemini-4-argon-high), reviewed and adapted.
import Phaser from 'phaser';
import type { FlowerColor, FlowerShape, FlowerSize, SortAttribute } from './types';

export type RuleIconKind = SortAttribute;

const OUTLINE = 0x3b2a22;
const LINE_WIDTH = 4;

const WOOD_DARK = 0x9c6236;
const WOOD_MID = 0xb87a4b;
const WOOD_LIGHT = 0xd99b66;
const WOOD_RIM = 0xe6b37e;
const SOIL_DARK = 0x472d1e;
const SOIL_MID = 0x593a28;
const SOIL_CLOD = 0x6b4732;
const PLAQUE_FACE = 0xfff5dc;

const STEM_GREEN = 0x4d9e45;
const LEAF_GREEN = 0x63b85a;
const SILHOUETTE_GREEN = 0x2f5e3d;
const SILHOUETTE_LIGHT = 0x488258;
const MUTED_FLOWER = 0x9aa694;

const COLOR_PALETTE: Record<FlowerColor, { main: number; light: number; core: number }> = {
  red: { main: 0xe84a3b, light: 0xff7a6b, core: 0xffe57f },
  yellow: { main: 0xf7c942, light: 0xffe57f, core: 0xfff8e1 },
  blue: { main: 0x3b8eea, light: 0x78b7ff, core: 0xffe57f },
};

function resolveColor(value: string): { main: number; light: number; core: number } {
  if (value === 'red' || value === 'yellow' || value === 'blue') {
    return COLOR_PALETTE[value];
  }
  return COLOR_PALETTE.red;
}

/**
 * Draws a 3-pointed tulip head, an 8-petal daisy, or a pompom round bloom centered at (cx, cy).
 */
function paintBloom(
  g: Phaser.GameObjects.Graphics,
  shape: FlowerShape,
  cx: number,
  cy: number,
  radius: number,
  mainColor: number,
  lightColor: number,
  coreColor: number,
  lineWidth = LINE_WIDTH,
  alpha = 1,
): void {
  if (shape === 'tulip') {
    const r = radius;
    const pad = lineWidth;

    // Dark brown outline silhouette behind the 3 tulip points and cup base
    g.fillStyle(OUTLINE, alpha);
    g.fillTriangle(
      cx - r * 0.92 - pad,
      cy + r * 0.12,
      cx - r * 0.76,
      cy - r * 0.96 - pad,
      cx - r * 0.04,
      cy + r * 0.24,
    );
    g.fillTriangle(
      cx + r * 0.92 + pad,
      cy + r * 0.12,
      cx + r * 0.76,
      cy - r * 0.96 - pad,
      cx + r * 0.04,
      cy + r * 0.24,
    );
    g.fillTriangle(
      cx - r * 0.56,
      cy + r * 0.18,
      cx,
      cy - r * 1.06 - pad,
      cx + r * 0.56,
      cy + r * 0.18,
    );
    g.fillEllipse(cx, cy + r * 0.14, r * 1.88 + pad * 2, r * 1.36 + pad * 2);

    // Side petals
    g.fillStyle(mainColor, alpha);
    g.fillTriangle(cx - r * 0.9, cy + r * 0.1, cx - r * 0.72, cy - r * 0.9, cx - r * 0.06, cy + r * 0.22);
    g.fillTriangle(cx + r * 0.9, cy + r * 0.1, cx + r * 0.72, cy - r * 0.9, cx + r * 0.06, cy + r * 0.22);

    // Central lighter point
    g.fillStyle(lightColor, alpha);
    g.fillTriangle(cx - r * 0.5, cy + r * 0.16, cx, cy - r * 1.0, cx + r * 0.5, cy + r * 0.16);

    // Cup bowl
    g.fillStyle(mainColor, alpha);
    g.fillEllipse(cx, cy + r * 0.14, r * 1.84, r * 1.32);

    // Soft inner cup highlight
    g.fillStyle(lightColor, alpha);
    g.fillEllipse(cx, cy + r * 0.18, r * 1.1, r * 0.86);

    // Cup bottom arc stroke
    g.lineStyle(lineWidth, OUTLINE, alpha);
    g.beginPath();
    g.arc(cx, cy + r * 0.06, r * 0.92, 0.08 * Math.PI, 0.92 * Math.PI, false);
    g.strokePath();
    return;
  }

  if (shape === 'daisy') {
    const petalDist = radius * 0.62;
    const petalR = radius * 0.36;

    for (let i = 0; i < 8; i++) {
      const angle = (i * Math.PI) / 4;
      const px = cx + Math.cos(angle) * petalDist;
      const py = cy + Math.sin(angle) * petalDist;
      g.fillStyle(mainColor, alpha);
      g.fillCircle(px, py, petalR);
      g.lineStyle(Math.max(2, lineWidth - 0.5), OUTLINE, alpha);
      g.strokeCircle(px, py, petalR);

      g.fillStyle(lightColor, alpha);
      g.fillCircle(px, py, petalR * 0.55);
    }

    // White/yellow daisy centre
    const centerR = radius * 0.42;
    g.fillStyle(0xfff8e1, alpha);
    g.fillCircle(cx, cy, centerR);
    g.fillStyle(coreColor, alpha);
    g.fillCircle(cx, cy, centerR * 0.72);
    g.lineStyle(lineWidth, OUTLINE, alpha);
    g.strokeCircle(cx, cy, centerR);
    return;
  }

  // 'round': circle pompom with inner ring
  const puffDist = radius * 0.72;
  const puffR = radius * 0.34;
  for (let i = 0; i < 8; i++) {
    const angle = (i * Math.PI) / 4;
    const px = cx + Math.cos(angle) * puffDist;
    const py = cy + Math.sin(angle) * puffDist;
    g.fillStyle(mainColor, alpha);
    g.fillCircle(px, py, puffR);
    g.lineStyle(Math.max(2, lineWidth - 0.5), OUTLINE, alpha);
    g.strokeCircle(px, py, puffR);
  }

  g.fillStyle(mainColor, alpha);
  g.fillCircle(cx, cy, radius * 0.88);
  g.lineStyle(lineWidth, OUTLINE, alpha);
  g.strokeCircle(cx, cy, radius * 0.88);

  // Inner ring
  g.fillStyle(lightColor, alpha);
  g.fillCircle(cx, cy, radius * 0.56);
  g.lineStyle(Math.max(2, lineWidth - 0.5), OUTLINE, alpha);
  g.strokeCircle(cx, cy, radius * 0.56);

  // Centre button
  g.fillStyle(mainColor, alpha);
  g.fillCircle(cx, cy, radius * 0.24);
  g.lineStyle(Math.max(2, lineWidth - 1), OUTLINE, alpha);
  g.strokeCircle(cx, cy, radius * 0.24);
}

/**
 * Draws the garden bed split into `back` (rear rim + dark soil ellipse) and `front` (front wooden rim).
 */
export function drawBedFallback(
  scene: Phaser.Scene,
  width = 520,
  height = 260,
): { back: Phaser.GameObjects.Container; front: Phaser.GameObjects.Container } {
  const backGfx = scene.add.graphics();

  // Rear wooden wall
  backGfx.fillStyle(WOOD_MID, 1);
  backGfx.fillRoundedRect(-width * 0.48, -height * 0.38, width * 0.96, height * 0.48, 28);
  backGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  backGfx.strokeRoundedRect(-width * 0.48, -height * 0.38, width * 0.96, height * 0.48, 28);

  // Top wood highlight strip
  backGfx.fillStyle(WOOD_LIGHT, 1);
  backGfx.fillRoundedRect(-width * 0.45, -height * 0.34, width * 0.9, height * 0.12, 12);

  // Soil ellipse
  backGfx.fillStyle(SOIL_MID, 1);
  backGfx.fillEllipse(0, -height * 0.03, width * 0.88, height * 0.54);
  backGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  backGfx.strokeEllipse(0, -height * 0.03, width * 0.88, height * 0.54);

  // Inner darker soil hollow and soft clods
  backGfx.fillStyle(SOIL_DARK, 1);
  backGfx.fillEllipse(0, -height * 0.04, width * 0.76, height * 0.38);
  backGfx.fillStyle(SOIL_CLOD, 1);
  backGfx.fillEllipse(-width * 0.22, -height * 0.06, width * 0.14, height * 0.08);
  backGfx.fillEllipse(0, -height * 0.09, width * 0.16, height * 0.09);
  backGfx.fillEllipse(width * 0.23, -height * 0.05, width * 0.13, height * 0.08);

  const frontGfx = scene.add.graphics();

  // Front wooden planter body covering lower stem bases
  frontGfx.fillStyle(WOOD_MID, 1);
  frontGfx.fillRoundedRect(-width * 0.49, -height * 0.01, width * 0.98, height * 0.4, 24);
  frontGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.49, -height * 0.01, width * 0.98, height * 0.4, 24);

  // Plank seam
  frontGfx.fillStyle(WOOD_DARK, 1);
  frontGfx.fillRoundedRect(-width * 0.46, height * 0.18, width * 0.92, height * 0.03, 4);

  // Front wooden top lip
  frontGfx.fillStyle(WOOD_LIGHT, 1);
  frontGfx.fillRoundedRect(-width * 0.5, -height * 0.06, width, height * 0.13, 14);
  frontGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.5, -height * 0.06, width, height * 0.13, 14);

  // Decorative wooden pegs
  const pegXs = [-width * 0.38, 0, width * 0.38];
  for (const px of pegXs) {
    frontGfx.fillStyle(WOOD_DARK, 1);
    frontGfx.fillCircle(px, height * 0.14, 7);
    frontGfx.lineStyle(3, OUTLINE, 1);
    frontGfx.strokeCircle(px, height * 0.14, 7);
  }

  const back = scene.add.container(0, 0, [backGfx]);
  back.setSize(width, height);
  const front = scene.add.container(0, 0, [frontGfx]);
  front.setSize(width, height);
  return { back, front };
}

/**
 * Draws a procedural flower with origin at the stem base (0, 0), growing upward to -totalHeight.
 * Large flowers are ~1.45x taller with a noticeably larger bloom.
 */
export function drawFlowerFallback(
  scene: Phaser.Scene,
  shape: FlowerShape,
  color: FlowerColor,
  size: FlowerSize,
  height = 90,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const palette = COLOR_PALETTE[color];
  const sizeMultiplier = size === 'large' ? 1.45 : 1;
  const totalHeight = Math.max(48, height * sizeMultiplier);
  const bloomRadius = Math.max(16, height * 0.24 * (size === 'large' ? 1.38 : 1));
  const bloomY = -totalHeight + bloomRadius * 0.9;
  const stemW = size === 'large' ? 10 : 7;
  const stemH = Math.max(20, -bloomY);

  // Leaves along the stem
  const leftLeafY = bloomY * 0.42;
  g.fillStyle(LEAF_GREEN, 1);
  g.fillEllipse(-stemW * 1.9, leftLeafY, bloomRadius * 0.92, bloomRadius * 0.44);
  g.lineStyle(LINE_WIDTH, OUTLINE, 1);
  g.strokeEllipse(-stemW * 1.9, leftLeafY, bloomRadius * 0.92, bloomRadius * 0.44);

  const rightLeafScale = size === 'large' ? 0.92 : 0.7;
  const rightLeafY = bloomY * (size === 'large' ? 0.6 : 0.5);
  g.fillStyle(LEAF_GREEN, 1);
  g.fillEllipse(stemW * 1.9, rightLeafY, bloomRadius * rightLeafScale, bloomRadius * 0.42);
  g.lineStyle(LINE_WIDTH, OUTLINE, 1);
  g.strokeEllipse(stemW * 1.9, rightLeafY, bloomRadius * rightLeafScale, bloomRadius * 0.42);

  // Stem from (0, 0) up to bloom centre
  g.fillStyle(STEM_GREEN, 1);
  g.fillRoundedRect(-stemW / 2, bloomY, stemW, stemH, stemW / 2);
  g.lineStyle(LINE_WIDTH, OUTLINE, 1);
  g.strokeRoundedRect(-stemW / 2, bloomY, stemW, stemH, stemW / 2);

  // Flower head at (0, bloomY)
  paintBloom(g, shape, 0, bloomY, bloomRadius, palette.main, palette.light, palette.core, LINE_WIDTH, 1);

  const container = scene.add.container(0, 0, [g]);
  container.setSize(bloomRadius * 2.2, totalHeight);
  return container;
}

/**
 * Draws a rule icon centered around (0, 0) for 'color', 'shape', or 'size'.
 */
export function drawRuleIconFallback(
  scene: Phaser.Scene,
  kind: RuleIconKind,
  value: string,
  size = 48,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const r = size * 0.38;

  if (kind === 'color') {
    const palette = resolveColor(value);
    const pad = 3.5;

    // Dark brown outline behind organic colour blob
    g.fillStyle(OUTLINE, 1);
    g.fillCircle(0, 0, r + pad);
    g.fillCircle(-r * 0.36, -r * 0.18, r * 0.68 + pad);
    g.fillCircle(r * 0.36, -r * 0.14, r * 0.64 + pad);
    g.fillCircle(0, r * 0.28, r * 0.72 + pad);

    // Inner colour swatch fill
    g.fillStyle(palette.main, 1);
    g.fillCircle(0, 0, r);
    g.fillCircle(-r * 0.36, -r * 0.18, r * 0.68);
    g.fillCircle(r * 0.36, -r * 0.14, r * 0.64);
    g.fillCircle(0, r * 0.28, r * 0.72);

    // Glossy highlight
    g.fillStyle(palette.light, 1);
    g.fillCircle(-r * 0.28, -r * 0.28, r * 0.26);
  } else if (kind === 'shape') {
    const shape: FlowerShape =
      value === 'tulip' || value === 'daisy' || value === 'round' ? value : 'round';
    paintBloom(
      g,
      shape,
      0,
      0,
      r * 0.95,
      SILHOUETTE_GREEN,
      SILHOUETTE_LIGHT,
      PLAQUE_FACE,
      3.5,
      1,
    );
  } else {
    // 'size': one flower in a neutral silhouette colour (so size is the only cue), short for 'small' and tall for
    // 'large', next to a faint outline of the other size for comparison.
    const isSmall = value === 'small';
    const baseY = size * 0.44;
    const drawSilhouette = (x: number, h: number, bloomR: number, fill: number, alpha: number, lw: number) => {
      const stemW = Math.max(3, size * 0.06);
      g.fillStyle(fill, alpha);
      g.fillRoundedRect(x - stemW / 2, baseY - h, stemW, h, stemW / 2);
      g.lineStyle(lw, OUTLINE, alpha);
      g.strokeRoundedRect(x - stemW / 2, baseY - h, stemW, h, stemW / 2);
      g.fillStyle(fill, alpha);
      g.fillCircle(x, baseY - h, bloomR);
      g.lineStyle(lw, OUTLINE, alpha);
      g.strokeCircle(x, baseY - h, bloomR);
      g.fillStyle(PLAQUE_FACE, alpha);
      g.fillCircle(x, baseY - h, bloomR * 0.38);
    };
    const smallH = size * 0.34;
    const largeH = size * 0.66;
    const activeX = isSmall ? -size * 0.14 : size * 0.12;
    const ghostX = isSmall ? size * 0.22 : -size * 0.26;
    // Faint comparison flower first, then the active one on top.
    drawSilhouette(ghostX, isSmall ? largeH : smallH, size * (isSmall ? 0.13 : 0.08), MUTED_FLOWER, 0.35, 2);
    drawSilhouette(activeX, isSmall ? smallH : largeH, size * (isSmall ? 0.1 : 0.17), SILHOUETTE_GREEN, 1, 3.5);
    // Ground line.
    g.lineStyle(3, OUTLINE, 1);
    g.beginPath();
    g.moveTo(-size * 0.4, baseY);
    g.lineTo(size * 0.4, baseY);
    g.strokePath();
  }

  const container = scene.add.container(0, 0, [g]);
  container.setSize(size, size);
  return container;
}

/**
 * Draws the wooden rule-sign plaque centered at (0, 0).
 */
export function drawPlaqueFallback(
  scene: Phaser.Scene,
  width = 136,
  height = 72,
): Phaser.GameObjects.Container {
  const g = scene.add.graphics();

  // Outer wooden border
  g.fillStyle(WOOD_MID, 1);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, 14);
  g.lineStyle(LINE_WIDTH, OUTLINE, 1);
  g.strokeRoundedRect(-width / 2, -height / 2, width, height, 14);

  // Warm parchment inner face
  const inset = 7;
  g.fillStyle(PLAQUE_FACE, 1);
  g.fillRoundedRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2, 9);
  g.lineStyle(2.5, WOOD_DARK, 1);
  g.strokeRoundedRect(-width / 2 + inset, -height / 2 + inset, width - inset * 2, height - inset * 2, 9);

  // Corner pins
  g.fillStyle(OUTLINE, 1);
  g.fillCircle(-width * 0.38, -height * 0.32, 3);
  g.fillCircle(width * 0.38, -height * 0.32, 3);

  const container = scene.add.container(0, 0, [g]);
  container.setSize(width, height);
  return container;
}

/**
 * Draws the vertical wooden sign post centered at (0, 0).
 */
export function drawPostFallback(scene: Phaser.Scene, height = 72): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  const width = Math.max(16, Math.round(height * 0.22));

  g.fillStyle(WOOD_DARK, 1);
  g.fillRoundedRect(-width / 2, -height / 2, width, height, 6);
  g.fillStyle(WOOD_MID, 1);
  g.fillRoundedRect(-width * 0.22, -height / 2 + 4, width * 0.44, height - 8, 3);
  g.lineStyle(LINE_WIDTH, OUTLINE, 1);
  g.strokeRoundedRect(-width / 2, -height / 2, width, height, 6);

  const container = scene.add.container(0, 0, [g]);
  container.setSize(width, height);
  return container;
}

/**
 * Draws the central wicker basket split into `back` (arched handle + rear opening)
 * and `front` (woven basket belly + braided front lip).
 */
export function drawBasketFallback(
  scene: Phaser.Scene,
  width = 220,
  height = 170,
): { back: Phaser.GameObjects.Container; front: Phaser.GameObjects.Container } {
  const backGfx = scene.add.graphics();

  // Arched wicker handle behind the opening
  const handleRadius = width * 0.34;
  const mouthY = -height * 0.05;
  backGfx.lineStyle(14, OUTLINE, 1);
  backGfx.beginPath();
  backGfx.arc(0, mouthY, handleRadius, Math.PI, 0, false);
  backGfx.strokePath();

  backGfx.lineStyle(8, WOOD_MID, 1);
  backGfx.beginPath();
  backGfx.arc(0, mouthY, handleRadius, Math.PI, 0, false);
  backGfx.strokePath();

  // Rear basket rim and dark interior opening
  backGfx.fillStyle(WOOD_MID, 1);
  backGfx.fillEllipse(0, mouthY, width * 0.88, height * 0.28);
  backGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  backGfx.strokeEllipse(0, mouthY, width * 0.88, height * 0.28);

  backGfx.fillStyle(SOIL_MID, 1);
  backGfx.fillEllipse(0, mouthY + 3, width * 0.78, height * 0.2);
  backGfx.lineStyle(3, OUTLINE, 1);
  backGfx.strokeEllipse(0, mouthY + 3, width * 0.78, height * 0.2);

  const frontGfx = scene.add.graphics();

  // Lower tapered basket base
  frontGfx.fillStyle(WOOD_MID, 1);
  frontGfx.fillRoundedRect(-width * 0.36, height * 0.06, width * 0.72, height * 0.36, 22);
  frontGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.36, height * 0.06, width * 0.72, height * 0.36, 22);

  // Upper woven belly
  frontGfx.fillStyle(WOOD_LIGHT, 1);
  frontGfx.fillRoundedRect(-width * 0.42, -height * 0.03, width * 0.84, height * 0.32, 24);
  frontGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.42, -height * 0.03, width * 0.84, height * 0.32, 24);

  // Woven horizontal ribs
  frontGfx.fillStyle(WOOD_RIM, 1);
  frontGfx.fillRoundedRect(-width * 0.38, height * 0.07, width * 0.76, height * 0.08, 8);
  frontGfx.lineStyle(3, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.38, height * 0.07, width * 0.76, height * 0.08, 8);

  frontGfx.fillStyle(WOOD_MID, 1);
  frontGfx.fillRoundedRect(-width * 0.34, height * 0.21, width * 0.68, height * 0.08, 8);
  frontGfx.lineStyle(3, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.34, height * 0.21, width * 0.68, height * 0.08, 8);

  // Braided front rim lip masking the flower's lower stem
  frontGfx.fillStyle(WOOD_RIM, 1);
  frontGfx.fillRoundedRect(-width * 0.46, -height * 0.09, width * 0.92, height * 0.12, 14);
  frontGfx.lineStyle(LINE_WIDTH, OUTLINE, 1);
  frontGfx.strokeRoundedRect(-width * 0.46, -height * 0.09, width * 0.92, height * 0.12, 14);

  const braidXs = [-width * 0.3, -width * 0.15, 0, width * 0.15, width * 0.3];
  for (const bx of braidXs) {
    frontGfx.fillStyle(WOOD_LIGHT, 1);
    frontGfx.fillEllipse(bx, -height * 0.03, width * 0.12, height * 0.06);
    frontGfx.lineStyle(2.5, OUTLINE, 1);
    frontGfx.strokeEllipse(bx, -height * 0.03, width * 0.12, height * 0.06);
  }

  const back = scene.add.container(0, 0, [backGfx]);
  back.setSize(width, height);
  const front = scene.add.container(0, 0, [frontGfx]);
  front.setSize(width, height);
  return { back, front };
}

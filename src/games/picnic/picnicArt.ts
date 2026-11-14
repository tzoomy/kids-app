// Picnic Train art: uses the approved SVGs already in the manifest (train pieces, picnic basket, foods, scene
// backgrounds) when their textures are loaded, and a clean procedural fallback otherwise. The go flag, the number
// cards, the shelf slots and the tally dots have no art yet: they are drawn in code (listed as placeholders in
// docs/specs/picnic-train.md, "Pass 1"; Pass 2 replaces them).
import Phaser from 'phaser';
import { foodArtKey, propArtKey, sceneArtKey, trainArtKey } from '../../anim/artRegistry';
import { PALETTE } from '../../assets/colors';
import type { TrainPieceLayout } from './picnicLayout';

const OUTLINE = PALETTE.outline;

function loaded(scene: Phaser.Scene, key: string | undefined): key is string {
  return Boolean(key && scene.textures.exists(key) && key !== '__MISSING');
}

/** Full-screen background (landscape or portrait art), or a soft procedural meadow. */
export function addBackground(scene: Phaser.Scene, width: number, height: number): Phaser.GameObjects.GameObject {
  const key = sceneArtKey('picnic-train', width >= height ? 'bg-landscape' : 'bg-portrait');
  if (loaded(scene, key)) return scene.add.image(width / 2, height / 2, key).setDisplaySize(width, height).setDepth(0);
  const g = scene.add.graphics().setDepth(0);
  g.fillStyle(0xcdeefa, 1);
  g.fillRect(0, 0, width, height);
  g.fillStyle(0xbfe6a8, 1);
  g.fillRect(0, height * 0.3, width, height);
  g.fillStyle(0xe8d7b0, 1);
  g.fillRect(0, height * 0.62, width, height * 0.04);
  return g;
}

/** One train piece (engine, car or single car) with its top-left at (0, 0) of a container. */
export function makeTrainPiece(scene: Phaser.Scene, piece: TrainPieceLayout, height: number): Phaser.GameObjects.Container {
  const name = piece.type === 'engine' ? 'engine' : piece.type === 'car' ? 'car' : 'car-single';
  const key = trainArtKey(name);
  const container = scene.add.container(piece.x, 0);
  if (loaded(scene, key)) {
    container.add(scene.add.image(0, 0, key).setOrigin(0, 0).setDisplaySize(piece.width, height));
    return container;
  }
  const g = scene.add.graphics();
  g.fillStyle(piece.type === 'engine' ? 0xd9694f : 0xcc926b, 1);
  g.lineStyle(6, OUTLINE, 1);
  g.fillRoundedRect(4, height * 0.35, piece.width - 8, height * 0.55, 16);
  g.strokeRoundedRect(4, height * 0.35, piece.width - 8, height * 0.55, 16);
  g.fillStyle(0x3d3532, 1);
  g.fillCircle(piece.width * 0.25, height * 0.92, height * 0.08);
  g.fillCircle(piece.width * 0.75, height * 0.92, height * 0.08);
  container.add(g);
  return container;
}

/** A pale dashed ghost of a picnic item (scaffold 'outline'), centred at (0, 0). */
export function makeGhostItem(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const key = trainArtKey('item-outline');
  if (loaded(scene, key)) return scene.add.container(0, 0, [scene.add.image(0, 0, key).setDisplaySize(size, size)]);
  const g = scene.add.graphics();
  g.fillStyle(0xfff6e8, 0.55);
  g.lineStyle(4, OUTLINE, 0.8);
  g.fillCircle(0, 0, size * 0.36);
  g.strokeCircle(0, 0, size * 0.36);
  return scene.add.container(0, 0, [g]);
}

/** A picnic item (food art by id), centred at (0, 0); a plain coloured disc when the art is not loaded. */
export function makeFood(scene: Phaser.Scene, foodId: string, size: number): Phaser.GameObjects.Container {
  const key = foodArtKey(foodId);
  if (loaded(scene, key)) return scene.add.container(0, 0, [scene.add.image(0, 0, key).setDisplaySize(size, size)]);
  const g = scene.add.graphics();
  g.fillStyle(0xe4572e, 1);
  g.lineStyle(5, OUTLINE, 1);
  g.fillCircle(0, 0, size * 0.4);
  g.strokeCircle(0, 0, size * 0.4);
  return scene.add.container(0, 0, [g]);
}

/** The picnic basket (256x256 art), centred at (0, 0). */
export function makeBasket(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const key = propArtKey('picnic-basket');
  if (loaded(scene, key)) return scene.add.container(0, 0, [scene.add.image(0, 0, key).setDisplaySize(size, size)]);
  const g = scene.add.graphics();
  g.fillStyle(0xcc926b, 1);
  g.lineStyle(6, OUTLINE, 1);
  g.fillRoundedRect(-size * 0.42, -size * 0.1, size * 0.84, size * 0.5, 14);
  g.strokeRoundedRect(-size * 0.42, -size * 0.1, size * 0.84, size * 0.5, 14);
  g.strokeEllipse(0, -size * 0.1, size * 0.7, size * 0.5);
  return scene.add.container(0, 0, [g]);
}

/** The green go flag on a round button (placeholder art), centred at (0, 0). */
export function makeGoFlag(scene: Phaser.Scene, size: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0xfffdf9, 1);
  g.lineStyle(6, OUTLINE, 1);
  g.fillCircle(0, 0, size * 0.46);
  g.strokeCircle(0, 0, size * 0.46);
  // Pole and flag.
  g.lineStyle(6, OUTLINE, 1);
  g.lineBetween(-size * 0.16, size * 0.3, -size * 0.16, -size * 0.3);
  g.fillStyle(0x4caf50, 1);
  g.fillTriangle(-size * 0.16, -size * 0.3, size * 0.28, -size * 0.14, -size * 0.16, size * 0.02);
  g.lineStyle(4, OUTLINE, 1);
  g.strokeTriangle(-size * 0.16, -size * 0.3, size * 0.28, -size * 0.14, -size * 0.16, size * 0.02);
  return scene.add.container(0, 0, [g]);
}

/** A number card (placeholder art): a rounded card with the digit, centred at (0, 0). */
export function makeNumberCard(scene: Phaser.Scene, value: number, size: number): Phaser.GameObjects.Container {
  const g = scene.add.graphics();
  g.fillStyle(0xfffdf9, 1);
  g.lineStyle(6, OUTLINE, 1);
  g.fillRoundedRect(-size / 2, -size / 2, size, size, 18);
  g.strokeRoundedRect(-size / 2, -size / 2, size, size, 18);
  const label = scene.add
    .text(0, 0, String(value), { fontFamily: '"Noto Sans", sans-serif', fontSize: `${Math.round(size * 0.58)}px`, fontStyle: 'bold', color: '#3B2A22' })
    .setOrigin(0.5);
  return scene.add.container(0, 0, [g, label]);
}

/** A faint empty cargo slot (placeholder art), centred at (0, 0). */
export function makeShelfSlot(scene: Phaser.Scene, size: number): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.fillStyle(0xfff6e8, 0.45);
  g.lineStyle(4, OUTLINE, 0.45);
  g.fillRoundedRect(-size / 2, -size / 2, size, size, 12);
  g.strokeRoundedRect(-size / 2, -size / 2, size, size, 12);
  return g;
}

/** One tally dot (placeholder art), centred at (0, 0). */
export function makeTallyDot(scene: Phaser.Scene, filled: boolean): Phaser.GameObjects.Graphics {
  const g = scene.add.graphics();
  g.lineStyle(3, OUTLINE, 1);
  g.fillStyle(filled ? 0xffb703 : 0xfff6e8, 1);
  g.fillCircle(0, 0, 9);
  g.strokeCircle(0, 0, 9);
  return g;
}

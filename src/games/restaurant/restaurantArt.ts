// Restaurant visuals with pluggable art: each piece uses a registered SVG texture when
// it is loaded and falls back to the procedural art otherwise. Fallback textures are
// generated once per game and reused.
import Phaser from 'phaser';
import { drawFoodIcon, paintRestaurantKitchen } from '../../assets/vectorArt';
import { PALETTE } from '../../assets/colors';
import { foodArtKey, propArtKey, sceneArtKey } from '../../anim/artRegistry';
import type { ChoiceOption } from '../templates/choiceServe';
import { ICON_GAP, iconSizeFor, plateWidthFor, type RestaurantLayout } from './restaurantLayout';

export const DEPTH = {
  background: -10,
  animal: 5,
  animalHit: 6,
  counter: 10,
  plates: 20,
  flyingFood: 40,
} as const;

function loaded(scene: Phaser.Scene, key: string | undefined): key is string {
  return Boolean(key && scene.textures.exists(key));
}

export function paintBackground(scene: Phaser.Scene, layout: RestaurantLayout): void {
  const key = sceneArtKey('restaurant', layout.landscape ? 'bg-landscape' : 'bg-portrait');
  if (loaded(scene, key)) {
    scene.add.image(layout.width / 2, layout.height / 2, key).setDisplaySize(layout.width, layout.height).setDepth(DEPTH.background);
    return;
  }
  paintRestaurantKitchen(scene);
}

/** Counter front drawn above the animal (so it stands behind it) and below the plates. */
export function addCounterFront(scene: Phaser.Scene, layout: RestaurantLayout): Phaser.GameObjects.Image {
  const art = sceneArtKey('restaurant', 'counter');
  if (loaded(scene, art)) {
    const img = scene.add.image(layout.width / 2, layout.counter.top, art).setOrigin(0.5, 0).setDepth(DEPTH.counter);
    img.setScale(layout.width / img.width);
    return img;
  }
  const { left, top, width, height, stripHeight } = layout.counter;
  const pad = 6;
  const key = `restaurant-counter-${Math.round(width)}x${Math.round(height)}`;
  if (!scene.textures.exists(key)) {
    const g = scene.make.graphics({ x: 0, y: 0 }, false);
    g.fillStyle(0xa97155, 1);
    g.fillRoundedRect(pad, pad, width, height, 18);
    g.lineStyle(5, PALETTE.outline, 1);
    g.strokeRoundedRect(pad, pad, width, height, 18);
    g.fillStyle(0xfff3d6, 1);
    g.fillRoundedRect(pad, pad, width, stripHeight, 8);
    g.strokeRoundedRect(pad, pad, width, stripHeight, 8);
    g.generateTexture(key, width + pad * 2, height + pad * 2);
    g.destroy();
  }
  return scene.add.image(left - pad, top - pad, key).setOrigin(0, 0).setDepth(DEPTH.counter);
}

export interface PlateView {
  choice: ChoiceOption;
  /** Position, hit area, press squash, hint pulse, wobble. */
  root: Phaser.GameObjects.Container;
  /** Pop-in and "tap me" breathing. */
  body: Phaser.GameObjects.Container;
  /** One container per food so each can fly to the animal. */
  foods: Phaser.GameObjects.Container[];
  invite?: Phaser.Tweens.Tween;
}

function buildFood(scene: Phaser.Scene, choice: ChoiceOption, iconSize: number): Phaser.GameObjects.Container {
  const key = foodArtKey(choice.item.id);
  if (loaded(scene, key)) {
    const img = scene.make.image({ key, x: 0, y: 0, add: false }).setDisplaySize(iconSize * 1.05, iconSize * 1.05);
    return scene.add.container(0, 0, [img]);
  }
  return drawFoodIcon(scene, choice.item.shape, choice.item.color, iconSize);
}

export function buildPlate(scene: Phaser.Scene, choice: ChoiceOption, spacing: number): PlateView {
  const iconSize = iconSizeFor(spacing, choice.count);
  const plateW = plateWidthFor(iconSize, choice.count);
  const plateH = Math.max(46, iconSize * 0.62);
  const plateY = Math.max(iconSize, 70) * 0.42;
  const root = scene.add.container(0, 0).setDepth(DEPTH.plates);
  const body = scene.add.container(0, 0);
  root.add(body);

  const shadowKey = propArtKey('plate-shadow');
  if (loaded(scene, shadowKey)) {
    body.add(scene.make.image({ key: shadowKey, x: 0, y: plateY + plateH * 0.25, add: false }).setDisplaySize(plateW * 1.05, plateH * 0.7));
  } else {
    body.add(scene.add.ellipse(0, plateY + plateH * 0.22, plateW * 0.96, plateH * 0.75, 0x000000, 0.12));
  }
  const plateKey = propArtKey('plate');
  if (loaded(scene, plateKey)) {
    body.add(scene.make.image({ key: plateKey, x: 0, y: plateY, add: false }).setDisplaySize(plateW, plateW * (140 / 320)));
  } else {
    const plate = scene.add.ellipse(0, plateY, plateW, plateH, 0xf7f1e1);
    plate.setStrokeStyle(4, PALETTE.outline);
    body.add(plate);
    body.add(scene.add.ellipse(0, plateY - plateH * 0.08, plateW * 0.7, plateH * 0.5, 0xffffff, 0.55));
  }

  const totalWidth = choice.count * iconSize + (choice.count - 1) * ICON_GAP;
  const foods: Phaser.GameObjects.Container[] = [];
  for (let i = 0; i < choice.count; i++) {
    const food = buildFood(scene, choice, iconSize);
    food.setPosition(-totalWidth / 2 + iconSize / 2 + i * (iconSize + ICON_GAP), 0);
    body.add(food);
    foods.push(food);
  }

  root.setSize(Math.max(128, plateW + 16), 200);
  return { choice, root, body, foods };
}

/** Moves a food out of its plate into scene space, keeping its on-screen transform. */
export function detachFood(scene: Phaser.Scene, food: Phaser.GameObjects.Container): void {
  const m = food.getWorldTransformMatrix();
  const x = m.tx;
  const y = m.ty;
  const scale = Math.sqrt(m.a * m.a + m.b * m.b);
  food.parentContainer?.remove(food);
  if (!food.displayList) scene.add.existing(food);
  food.setPosition(x, y).setScale(scale).setAngle(0).setDepth(DEPTH.flyingFood);
}

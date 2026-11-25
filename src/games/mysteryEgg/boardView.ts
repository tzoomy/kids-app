// Mystery Egg: a 1280x800 "board" drawn in world coordinates and fitted into whatever canvas the app has
// (landscape 1280x800 = zoom 1; portrait letterboxes). Also maps board rectangles to page CSS px for the e2e hook.
import type Phaser from 'phaser';
import { gameRectToPageRect } from '../../testing/pageRect';
import { BOARD } from './layout';
import type { EggPageRect } from './types';

export const BOARD_CENTER = { x: BOARD.width / 2, y: BOARD.height / 2 } as const;

export function fitBoard(scene: Phaser.Scene, background: string): number {
  const cam = scene.cameras.main;
  const zoom = Math.min(scene.scale.width / BOARD.width, scene.scale.height / BOARD.height);
  cam.setZoom(zoom);
  cam.centerOn(BOARD_CENTER.x, BOARD_CENTER.y);
  cam.setBackgroundColor(background);
  return zoom;
}

/** Board-space rectangle given by its centre and size -> page CSS px. */
export function boardRectToPage(scene: Phaser.Scene, cx: number, cy: number, w: number, h: number): EggPageRect {
  const zoom = scene.cameras.main.zoom;
  const gw = scene.scale.width;
  const gh = scene.scale.height;
  const gameRect = {
    x: (cx - w / 2 - BOARD_CENTER.x) * zoom + gw / 2,
    y: (cy - h / 2 - BOARD_CENTER.y) * zoom + gh / 2,
    width: w * zoom,
    height: h * zoom,
  };
  const box = scene.game.canvas.getBoundingClientRect();
  return gameRectToPageRect(gameRect, { x: box.left, y: box.top, width: box.width, height: box.height }, { width: gw, height: gh });
}

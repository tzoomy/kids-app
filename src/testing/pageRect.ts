/** Pure geometry for e2e hooks: maps a rectangle in game coordinates to page CSS pixels. */

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface Size {
  width: number;
  height: number;
}

/**
 * Converts a rectangle in game coordinates into page CSS pixels (top-left + size, relative to the
 * viewport, as Playwright's page.mouse uses).
 *
 * The game of size `gameSize` is drawn "contain"-fitted and centred inside `canvasRect` (the canvas
 * element's getBoundingClientRect()). With Phaser's FIT scale mode the canvas element already has
 * the game's aspect ratio, so the fit is exact and the offset is zero; if the canvas box is ever
 * larger than the drawn game (letterboxing), the centred offset is added.
 */
export function gameRectToPageRect(gameRect: Rect, canvasRect: Rect, gameSize: Size): Rect {
  const scale = Math.min(canvasRect.width / gameSize.width, canvasRect.height / gameSize.height);
  const offsetX = (canvasRect.width - gameSize.width * scale) / 2;
  const offsetY = (canvasRect.height - gameSize.height * scale) / 2;
  return {
    x: canvasRect.x + offsetX + gameRect.x * scale,
    y: canvasRect.y + offsetY + gameRect.y * scale,
    width: gameRect.width * scale,
    height: gameRect.height * scale,
  };
}

// Game shell back button (docs/specs/game-shell.md AC-22): the home button of the map keeps its CSS-pixel size when the
// 1280x800 board is scaled down (portrait), by growing in board px by the inverse of the board's display scale.
import { BOARD } from './layout';

/** Minimum child-facing tap target in CSS px (the same 96 as the board buttons at zoom 1: `MIN_TAP` in ui.ts). */
export const BACK_BUTTON_CSS_PX = 96;
/** Gap between the button and the visible canvas corner, in CSS px (22 at the landscape zoom, as before). */
const MARGIN_CSS_PX = 22;

export interface BackButtonPlacement {
  /** Centre in board px (it may lie outside the board, in the letterbox, when the canvas is not 16:10). */
  x: number;
  y: number;
  /** Square side in board px. */
  size: number;
}

/**
 * The button sits in the top-left corner of the VISIBLE canvas: `zoom` is the camera zoom of the fitted board and
 * `cssPerGamePx` the canvas element's CSS px per game px, so one board px is `zoom * cssPerGamePx` CSS px.
 */
export function backButtonPlacement(v: { gameWidth: number; gameHeight: number; zoom: number; cssPerGamePx: number }): BackButtonPlacement {
  const cssPerBoard = v.zoom * v.cssPerGamePx;
  const size = Math.max(BACK_BUTTON_CSS_PX / cssPerBoard, BACK_BUTTON_CSS_PX);
  const margin = MARGIN_CSS_PX / cssPerBoard;
  // Board coordinates of the visible canvas' top-left corner.
  const left = BOARD.width / 2 - v.gameWidth / (2 * v.zoom);
  const top = BOARD.height / 2 - v.gameHeight / (2 * v.zoom);
  return { x: round(left + margin + size / 2), y: round(top + margin + size / 2), size: round(size) };
}

const round = (n: number): number => Math.round(n * 1000) / 1000;

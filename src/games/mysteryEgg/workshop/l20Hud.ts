// Workshop L20 HUD layout (world px, 1280x800): where the buttons, the tray and the robot sit. Pure data, no Phaser, so a unit test can
// check the buttons against the machine's geometry (tests/unit/workshop-l20.hud.test.ts). Spec: docs/specs/workshop-l20.md (AC-18).

export interface Box {
  x0: number;
  y0: number;
  x1: number;
  y1: number;
}
export interface ButtonSpot {
  x: number;
  y: number;
  w: number;
  h: number;
}

/** The box of a button centred on (x, y). */
export function buttonBox(b: ButtonSpot): Box {
  return { x0: b.x - b.w / 2, y0: b.y - b.h / 2, x1: b.x + b.w / 2, y1: b.y + b.h / 2 };
}

export const PLAY_BUTTON: ButtonSpot = { x: 955, y: 750, w: 210, h: 100 };
export const HOME_BUTTON: ButtonSpot = { x: 1218, y: 68, w: 96, h: 96 };
/**
 * The ear / speaker button (repeats the goal hint). Review fix F1: at (1200,620) it covered the lever's right tip and its stop
 * (tip (1203.5,563.3)); it now sits in the free floor band between the table (bottom y 584) and the tray row, left of the robot's
 * speech bubble and above the Play button.
 */
export const EAR_BUTTON: ButtonSpot = { x: 1020, y: 642, w: 96, h: 96 };
export const TRAY_PANEL: Box = { x0: 230, y0: 704, x1: 830, y1: 796 };
export const ROBOT_POS = { x: 1190, y: 748 } as const;
/** The robot (scale 0.55) and the speech bubble the scene puts up for its lines (speechCue at robot - (70, 90): 68 x 62). */
export const ROBOT_BOX: Box = { x0: ROBOT_POS.x - 55, y0: ROBOT_POS.y - 50, x1: ROBOT_POS.x + 55, y1: ROBOT_POS.y + 50 };
export const ROBOT_CUE_BOX: Box = { x0: ROBOT_POS.x - 70 - 34, y0: ROBOT_POS.y - 90 - 26, x1: ROBOT_POS.x - 70 + 34, y1: ROBOT_POS.y - 90 + 36 };

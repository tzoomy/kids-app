// The two supported game sizes: landscape 1280x800 and portrait 800x1280 (matches the two tablet orientations).
// Pure, no Phaser; `createGame` boots with it and the Mystery Egg scenes follow it when the window rotates.

export interface GameSize {
  width: number;
  height: number;
}

export const LANDSCAPE_SIZE: GameSize = { width: 1280, height: 800 };
export const PORTRAIT_SIZE: GameSize = { width: 800, height: 1280 };

/** The game size for a window: landscape (also for a square window) or portrait. */
export function baseSizeFor(windowWidth: number, windowHeight: number): GameSize {
  return windowWidth >= windowHeight ? { ...LANDSCAPE_SIZE } : { ...PORTRAIT_SIZE };
}

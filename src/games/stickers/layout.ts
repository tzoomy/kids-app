// Pure Sticker Board layout in canvas (game) units; equals CSS px at 1280x800 and 800x1280.
// Guarantees non-overlapping regions and >= 64 unit tap targets in both orientations.
import type { StickerAgeTrack } from './types';

export interface UnitRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface StickerBoardGeometry {
  board: UnitRect;
  tray: UnitRect[];
  backgrounds: UnitRect[];
  crayons: UnitRect[];
  tools: {
    undo: UnitRect;
    clear: UnitRect;
    save?: UnitRect;
    album?: UnitRect;
    requestToggle?: UnitRect;
  };
  requestBubble?: UnitRect;
}

const TRAY_COUNT = 12;
const BG_COUNT = 3;
const TOP = 88;
const EDGE = 24;
const GAP = 10;
const INNER_GAP = 16;

export function computeStickerBoardLayout(
  width: number,
  height: number,
  ageTrack: StickerAgeTrack,
  crayonCount: number,
): StickerBoardGeometry {
  const landscape = width >= height;
  const tray: UnitRect[] = [];
  const backgrounds: UnitRect[] = [];
  const crayons: UnitRect[] = [];

  if (landscape) {
    const trayBtn = 84;
    const trayColW = 2 * trayBtn + GAP;
    const trayX = width - EDGE - trayColW;
    for (let i = 0; i < TRAY_COUNT; i++) {
      const row = Math.floor(i / 2);
      const col = i % 2;
      tray.push({
        x: trayX + col * (trayBtn + GAP),
        y: TOP + row * (trayBtn + GAP),
        width: trayBtn,
        height: trayBtn,
      });
    }

    const leftBtn = 72;
    const bgX = EDGE;
    for (let i = 0; i < BG_COUNT; i++) {
      backgrounds.push({
        x: bgX,
        y: TOP + i * (leftBtn + GAP),
        width: leftBtn,
        height: leftBtn,
      });
    }

    const toolX = bgX + leftBtn + GAP;
    const toolAt = (i: number): UnitRect => ({
      x: toolX,
      y: TOP + i * (leftBtn + GAP),
      width: leftBtn,
      height: leftBtn,
    });
    const tools: StickerBoardGeometry['tools'] = {
      undo: toolAt(0),
      clear: toolAt(1),
      ...(ageTrack === 'age5'
        ? { save: toolAt(2), album: toolAt(3), requestToggle: toolAt(4) }
        : {}),
    };

    const boardLeft = toolX + leftBtn + INNER_GAP;
    const boardRight = trayX - INNER_GAP;
    const boardWidth = Math.max(200, boardRight - boardLeft);

    const crayonSize = 64;
    const crayonGap = 12;
    const crayonY = height - 20 - crayonSize;
    const crayonsW = crayonCount * crayonSize + Math.max(0, crayonCount - 1) * crayonGap;
    const crayonsX = Math.round(boardLeft + (boardWidth - crayonsW) / 2);
    for (let i = 0; i < crayonCount; i++) {
      crayons.push({
        x: crayonsX + i * (crayonSize + crayonGap),
        y: crayonY,
        width: crayonSize,
        height: crayonSize,
      });
    }

    const board: UnitRect = {
      x: boardLeft,
      y: TOP,
      width: boardWidth,
      height: Math.max(200, crayonY - INNER_GAP - TOP),
    };

    const requestBubble =
      ageTrack === 'age5' ? { x: boardLeft, y: 12, width: 96, height: 64 } : undefined;

    return { board, tray, backgrounds, crayons, tools, requestBubble };
  }

  // Portrait: 2 rows of 6 tray buttons at the bottom; crayons above tray; tools + bgs above crayons; board above.
  const trayBtn = 84;
  const trayGap = 12;
  const trayCols = 6;
  const trayW = trayCols * trayBtn + (trayCols - 1) * trayGap;
  const trayH = 2 * trayBtn + trayGap;
  const trayX = Math.round((width - trayW) / 2);
  const trayY = height - 20 - trayH;
  for (let i = 0; i < TRAY_COUNT; i++) {
    const row = Math.floor(i / trayCols);
    const col = i % trayCols;
    tray.push({
      x: trayX + col * (trayBtn + trayGap),
      y: trayY + row * (trayBtn + trayGap),
      width: trayBtn,
      height: trayBtn,
    });
  }

  const crayonSize = 64;
  const crayonGap = 10;
  const crayonY = trayY - INNER_GAP - crayonSize;
  const crayonsW = crayonCount * crayonSize + Math.max(0, crayonCount - 1) * crayonGap;
  const crayonsX = Math.round((width - crayonsW) / 2);
  for (let i = 0; i < crayonCount; i++) {
    crayons.push({
      x: crayonsX + i * (crayonSize + crayonGap),
      y: crayonY,
      width: crayonSize,
      height: crayonSize,
    });
  }

  const barBtn = 64;
  const barY = crayonY - INNER_GAP - barBtn;
  const toolAt = (i: number): UnitRect => ({
    x: EDGE + i * (barBtn + GAP),
    y: barY,
    width: barBtn,
    height: barBtn,
  });
  const tools: StickerBoardGeometry['tools'] = {
    undo: toolAt(0),
    clear: toolAt(1),
    ...(ageTrack === 'age5'
      ? { save: toolAt(2), album: toolAt(3), requestToggle: toolAt(4) }
      : {}),
  };

  for (let i = 0; i < BG_COUNT; i++) {
    backgrounds.push({
      x: width - EDGE - barBtn - i * (barBtn + GAP),
      y: barY,
      width: barBtn,
      height: barBtn,
    });
  }

  const board: UnitRect = {
    x: EDGE,
    y: TOP,
    width: width - 2 * EDGE,
    height: Math.max(200, barY - INNER_GAP - TOP),
  };

  const requestBubble =
    ageTrack === 'age5' ? { x: 164, y: 12, width: 96, height: 64 } : undefined;

  return { board, tray, backgrounds, crayons, tools, requestBubble };
}

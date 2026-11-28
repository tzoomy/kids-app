// The HUD buttons sit clear of the machine (review fix F1: the ear button covered the lever's right tip and its stop). Pure geometry:
// the ear button's 96 x 96 box in world px against every part of the board, the lever's whole swing, the cord and the other buttons.
import { describe, expect, it } from 'vitest';
import { EAR_BUTTON, HOME_BUTTON, PLAY_BUTTON, ROBOT_BOX, ROBOT_CUE_BOX, TRAY_PANEL, buttonBox, type Box } from '../../src/games/mysteryEgg/workshop/l20Hud';
import { CORD, CUP, DOMINO, DOMINO_SLOTS, DOMINO_Y, FIXED_DOMINOES, L20_SOCKETS, LEDGE, LEVER_PIVOT, MORNING_BELL, POST, COCO_BELL, BELL_RADIUS, TABLE, WALLS } from '../../src/games/mysteryEgg/workshop/l20Level';
import { LEVER, leverGeometry } from '../../src/games/mysteryEgg/workshop/lever';
import { socketZoneSize } from '../../src/games/mysteryEgg/workshop/l20Sockets';

type P = { x: number; y: number };
const ear = buttonBox(EAR_BUTTON);
const inside = (b: Box, p: P): boolean => p.x >= b.x0 && p.x <= b.x1 && p.y >= b.y0 && p.y <= b.y1;
const boxesOverlap = (a: Box, b: Box): boolean => a.x0 < b.x1 && b.x0 < a.x1 && a.y0 < b.y1 && b.y0 < a.y1;
const segmentHits = (b: Box, a: P, c: P): boolean => {
  const n = Math.ceil(Math.hypot(c.x - a.x, c.y - a.y));
  for (let i = 0; i <= n; i++) if (inside(b, { x: a.x + ((c.x - a.x) * i) / n, y: a.y + ((c.y - a.y) * i) / n })) return true;
  return false;
};
const rad = (d: number): number => (d * Math.PI) / 180;
const box = (x: number, y: number, w: number, h: number): Box => ({ x0: x - w / 2, y0: y - h / 2, x1: x + w / 2, y1: y + h / 2 });

describe('workshop L20 HUD layout', () => {
  it('[AC-18] the ear button is 96 x 96 world px: >= 48 CSS px at the smallest board scale (portrait 800 wide = 0.625)', () => {
    expect(EAR_BUTTON.w).toBeGreaterThanOrEqual(96);
    expect(EAR_BUTTON.h).toBeGreaterThanOrEqual(96);
    expect(Math.min(EAR_BUTTON.w, EAR_BUTTON.h) * 0.625).toBeGreaterThanOrEqual(48);
  });

  it('[AC-18] it is inside the board and clear of the other buttons, the tray, the robot and its speech bubble', () => {
    expect(ear.x0).toBeGreaterThanOrEqual(0);
    expect(ear.x1).toBeLessThanOrEqual(1280);
    expect(ear.y1).toBeLessThanOrEqual(800);
    // The Play button pulses to 1.05x: compare against the grown box.
    const play = buttonBox({ ...PLAY_BUTTON, w: PLAY_BUTTON.w * 1.05, h: PLAY_BUTTON.h * 1.05 });
    for (const [name, other] of Object.entries({ play, home: buttonBox(HOME_BUTTON), tray: TRAY_PANEL, robot: ROBOT_BOX, robotCue: ROBOT_CUE_BOX })) {
      expect(boxesOverlap(ear, other), `ear vs ${name}`).toBe(false);
    }
  });

  it('[AC-18] it does not touch the lever: the whole swing of both arms (rest to the 30 degree down-stop), its post, its two stops, or the cord leg', () => {
    const g = leverGeometry(LEVER_PIVOT);
    const half = LEVER.length / 2;
    expect(inside(ear, g.rightTip)).toBe(false);
    for (const stop of [g.rightStop, g.downStop, POST]) expect(boxesOverlap(ear, stop), JSON.stringify(stop)).toBe(false);
    // Right tip angle (down positive) runs from the rest angle up to rest - downStopDeg; the left arm is the mirror image.
    for (let d = LEVER.restDeg; d >= LEVER.restDeg - LEVER.downStopDeg; d -= 0.5) {
      const tip = { x: LEVER_PIVOT.x + half * Math.cos(rad(d)), y: LEVER_PIVOT.y + half * Math.sin(rad(d)) };
      const left = { x: LEVER_PIVOT.x - half * Math.cos(rad(d)), y: LEVER_PIVOT.y - half * Math.sin(rad(d)) };
      expect(segmentHits(ear, LEVER_PIVOT, tip), `right arm at ${d} deg`).toBe(false);
      expect(segmentHits(ear, LEVER_PIVOT, left), `left arm at ${d} deg`).toBe(false);
      // The live cord leg: the tip -> P0.
      expect(segmentHits(ear, tip, CORD.P0), `cord leg at ${d} deg`).toBe(false);
    }
  });

  it('[AC-18] it does not touch the cord path (P0 -> P1 -> P2 -> the handle)', () => {
    const pts = [CORD.P0, CORD.P1, CORD.P2, CORD.handle];
    for (let i = 0; i < pts.length - 1; i++) expect(segmentHits(ear, pts[i], pts[i + 1]), `segment ${i}`).toBe(false);
  });

  it('[AC-18] it covers no socket zone, domino (fixed or in a slot), bell, table, cup, ledge or wall', () => {
    for (const s of L20_SOCKETS) {
      const z = socketZoneSize(s.type, 48);
      expect(boxesOverlap(ear, box(s.x, s.y, z.w, z.h)), `socket ${s.id}`).toBe(false);
    }
    for (const x of [...FIXED_DOMINOES, ...DOMINO_SLOTS]) expect(boxesOverlap(ear, box(x, DOMINO_Y, DOMINO.w, DOMINO.h)), `domino ${x}`).toBe(false);
    for (const b of [COCO_BELL, MORNING_BELL]) expect(boxesOverlap(ear, box(b.x, b.y, BELL_RADIUS * 2, BELL_RADIUS * 2))).toBe(false);
    for (const [name, r] of Object.entries({ table: TABLE, cupLip: CUP.lip, cupFloor: CUP.floor, ledge: { x0: LEDGE.x0, y0: LEDGE.top, x1: LEDGE.x1, y1: LEDGE.top + LEDGE.thickness }, ...WALLS })) {
      expect(boxesOverlap(ear, r), name).toBe(false);
    }
  });
});

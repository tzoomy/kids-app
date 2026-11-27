// Workshop L20 typed sockets and the config the child's placements make (docs/specs/workshop-l20.md AC-04).
import { describe, expect, it } from 'vitest';
import { L20_SOCKETS } from '../../src/games/mysteryEgg/workshop/l20Level';
import { configFromPlacements, resolveL20Drop, type Placement } from '../../src/games/mysteryEgg/workshop/l20Sockets';

const none = new Set<string>();

describe('workshop L20 typed sockets', () => {
  it('[AC-04] the socket table is R1 (ramp), strip slots 460/500/580/620 (domino), string A and B (scissors)', () => {
    expect(L20_SOCKETS.map((s) => [s.id, s.type, s.accepts, s.x, s.y])).toEqual([
      ['R1', 'ramp', 'ramp', 200, 440],
      ['slot-460', 'strip', 'domino', 460, 505],
      ['slot-500', 'strip', 'domino', 500, 505],
      ['slot-580', 'strip', 'domino', 580, 505],
      ['slot-620', 'strip', 'domino', 620, 505],
      ['string-A', 'string', 'scissors', 860, 110],
      ['string-B', 'string', 'scissors', 640, 110],
    ]);
  });

  it('[AC-04] each part snaps to the socket that accepts it', () => {
    expect(resolveL20Drop('ramp', { x: 215, y: 470 }, none)).toEqual({ accepted: true, socketId: 'R1', x: 200, y: 440 });
    expect(resolveL20Drop('domino', { x: 462, y: 520 }, none)).toMatchObject({ accepted: true, socketId: 'slot-460' });
    expect(resolveL20Drop('domino', { x: 498, y: 500 }, none)).toMatchObject({ accepted: true, socketId: 'slot-500' });
    expect(resolveL20Drop('domino', { x: 622, y: 500 }, none)).toMatchObject({ accepted: true, socketId: 'slot-620' });
    expect(resolveL20Drop('scissors', { x: 850, y: 130 }, none)).toEqual({ accepted: true, socketId: 'string-A', x: 860, y: 110 });
    expect(resolveL20Drop('scissors', { x: 650, y: 100 }, none)).toMatchObject({ accepted: true, socketId: 'string-B' });
  });

  it('[AC-04] a part dropped on a socket that does not accept it springs back with {accepted:false, reason}', () => {
    expect(resolveL20Drop('domino', { x: 205, y: 445 }, none)).toEqual({ accepted: false, reason: 'wrong-part' });
    expect(resolveL20Drop('scissors', { x: 460, y: 505 }, none)).toEqual({ accepted: false, reason: 'wrong-part' });
    expect(resolveL20Drop('ramp', { x: 580, y: 505 }, none)).toEqual({ accepted: false, reason: 'wrong-part' });
    expect(resolveL20Drop('domino', { x: 860, y: 112 }, none)).toEqual({ accepted: false, reason: 'wrong-part' });
    expect(resolveL20Drop('ramp', { x: 640, y: 112 }, none)).toEqual({ accepted: false, reason: 'wrong-part' });
  });

  it('[AC-04] a drop far from every socket springs back (too-far); a taken socket springs back (occupied)', () => {
    expect(resolveL20Drop('domino', { x: 700, y: 330 }, none)).toEqual({ accepted: false, reason: 'too-far' });
    expect(resolveL20Drop('ramp', { x: 1000, y: 600 }, none)).toEqual({ accepted: false, reason: 'too-far' });
    expect(resolveL20Drop('domino', { x: 462, y: 505 }, new Set(['slot-460']))).toEqual({ accepted: false, reason: 'occupied' });
    expect(resolveL20Drop('ramp', { x: 200, y: 440 }, new Set(['R1']))).toEqual({ accepted: false, reason: 'occupied' });
  });

  it('[AC-04] strip slots only 40 px apart: the nearest slot wins and never hops to a neighbour when taken', () => {
    expect(resolveL20Drop('domino', { x: 478, y: 505 }, none)).toMatchObject({ socketId: 'slot-460' });
    expect(resolveL20Drop('domino', { x: 482, y: 505 }, none)).toMatchObject({ socketId: 'slot-500' });
    expect(resolveL20Drop('domino', { x: 466, y: 505 }, new Set(['slot-460']))).toEqual({ accepted: false, reason: 'occupied' });
  });

  it('[AC-04] the config follows the placements: ramp direction, sorted slots, the string under the scissors', () => {
    const placed: Placement[] = [
      { part: 'ramp', socketId: 'R1', flipped: false },
      { part: 'domino', socketId: 'slot-620' },
      { part: 'domino', socketId: 'slot-460' },
      { part: 'scissors', socketId: 'string-A' },
    ];
    expect(configFromPlacements(placed)).toEqual({ ramp: 'down-right', slots: [460, 620], scissors: 'A' });
    expect(configFromPlacements([{ part: 'ramp', socketId: 'R1', flipped: true }, { part: 'scissors', socketId: 'string-B' }])).toEqual({ ramp: 'down-left', slots: [], scissors: 'B' });
    expect(configFromPlacements([])).toEqual({ ramp: 'none', slots: [], scissors: 'none' });
  });
});

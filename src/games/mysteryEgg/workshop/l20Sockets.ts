// Workshop L20 typed sockets (v4 §1.4): which part a socket accepts, where a drop lands, and the physics config the
// placements make. Pure TS, no Phaser. Spec: docs/specs/workshop-l20.md (AC-04).
import { L20_SOCKETS, type L20Config, type L20PartKind, type L20Socket } from './l20Level';

export interface Point {
  x: number;
  y: number;
}

export type L20DropReason = 'too-far' | 'wrong-part' | 'occupied';
export type L20Drop = { accepted: true; socketId: string; x: number; y: number } | { accepted: false; reason: L20DropReason };

/**
 * Snap radius per socket type (board px). Strip slots are only 40 px apart, so their radius is small and the NEAREST socket
 * decides; the ramp socket and the strings are far from each other and from the strip, so theirs are generous.
 */
export const SNAP_RADIUS: Record<L20Socket['type'], number> = { ramp: 150, strip: 60, string: 110 };

/**
 * Where a dropped part lands. The nearest socket within its own radius decides: if it accepts the part and is free the part
 * snaps to it; a socket of another type springs the part back (`wrong-part`), a taken one too (`occupied`, never hopping to
 * a neighbour); nothing in range is `too-far`. A return is always harmless: the part goes back to the tray.
 */
export function resolveL20Drop(part: L20PartKind, at: Point, occupied: ReadonlySet<string>, sockets: readonly L20Socket[] = L20_SOCKETS): L20Drop {
  let nearest: { socket: L20Socket; d: number } | null = null;
  for (const socket of sockets) {
    const d = Math.hypot(at.x - socket.x, at.y - socket.y);
    if (d > SNAP_RADIUS[socket.type]) continue;
    if (!nearest || d < nearest.d) nearest = { socket, d };
  }
  if (!nearest) return { accepted: false, reason: 'too-far' };
  const { socket } = nearest;
  if (socket.accepts !== part) return { accepted: false, reason: 'wrong-part' };
  if (occupied.has(socket.id)) return { accepted: false, reason: 'occupied' };
  return { accepted: true, socketId: socket.id, x: socket.x, y: socket.y };
}

/** One placed part: the socket it sits in and, for the ramp, its direction. */
export interface Placement {
  part: L20PartKind;
  socketId: string;
  /** The ramp only: false = down to the right (as it arrives), true = flipped, down to the left. */
  flipped?: boolean;
}

/** The physics configuration the child's placements make. */
export function configFromPlacements(placed: readonly Placement[]): L20Config {
  const ramp = placed.find((p) => p.part === 'ramp' && p.socketId === 'R1');
  const slots = placed
    .filter((p) => p.part === 'domino')
    .map((p) => /^slot-(\d+)$/.exec(p.socketId))
    .filter((m): m is RegExpExecArray => m !== null)
    .map((m) => Number(m[1]))
    .sort((a, b) => a - b);
  const scissors = placed.find((p) => p.part === 'scissors');
  return {
    ramp: !ramp ? 'none' : ramp.flipped ? 'down-left' : 'down-right',
    slots,
    scissors: scissors?.socketId === 'string-A' ? 'A' : scissors?.socketId === 'string-B' ? 'B' : 'none',
  };
}

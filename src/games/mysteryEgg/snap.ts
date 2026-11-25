// Mystery Egg: forgiving drag-and-snap rules. Pure TS, no Phaser. Spec: docs/specs/mystery-egg.md (AC-02, AC-03).

export type PartKind = 'ball' | 'ramp' | 'bell';

export interface SlotDef {
  id: string;
  /** Slot centre in board (game) coordinates. */
  x: number;
  y: number;
  /** Part kinds this slot accepts. */
  accepts: readonly PartKind[];
}

export interface Point {
  x: number;
  y: number;
}

/** Generous on purpose: a 5-year-old drops a big part roughly near the glowing slot. Board px (1280x800). */
export const SNAP_RADIUS = 160;

export type ReturnReason = 'too-far' | 'wrong-part' | 'occupied';

export type DropResult =
  | { kind: 'snap'; slotId: string; x: number; y: number }
  | { kind: 'return'; reason: ReturnReason };

const dist = (a: Point, b: Point): number => Math.hypot(a.x - b.x, a.y - b.y);

/**
 * Decides what happens when a part is dropped at `drop`.
 * - The nearest free, compatible slot within `radius` wins and the part snaps to its centre.
 * - Otherwise the part goes back to the tray; `reason` says why (nothing in range, a slot in range that does not
 *   accept this part, or the only compatible slot in range is already taken). A return is always harmless.
 * `occupied` holds the ids of slots that already hold a part (callers remove the part being moved first).
 */
export function resolveDrop(
  part: PartKind,
  drop: Point,
  slots: readonly SlotDef[],
  occupied: ReadonlySet<string>,
  radius: number = SNAP_RADIUS,
): DropResult {
  let best: { slot: SlotDef; d: number } | null = null;
  let sawWrongPart = false;
  let sawOccupied = false;
  for (const slot of slots) {
    const d = dist(drop, slot);
    if (d > radius) continue;
    if (!slot.accepts.includes(part)) {
      sawWrongPart = true;
      continue;
    }
    if (occupied.has(slot.id)) {
      sawOccupied = true;
      continue;
    }
    if (!best || d < best.d) best = { slot, d };
  }
  if (best) return { kind: 'snap', slotId: best.slot.id, x: best.slot.x, y: best.slot.y };
  if (sawOccupied) return { kind: 'return', reason: 'occupied' };
  if (sawWrongPart) return { kind: 'return', reason: 'wrong-part' };
  return { kind: 'return', reason: 'too-far' };
}

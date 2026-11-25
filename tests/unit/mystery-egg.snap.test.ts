import { describe, expect, it } from 'vitest';
import { SNAP_RADIUS, resolveDrop, type SlotDef } from '../../src/games/mysteryEgg/snap';

const slot: SlotDef = { id: 'ramp-slot', x: 500, y: 440, accepts: ['ramp'] };
const other: SlotDef = { id: 'far-slot', x: 900, y: 200, accepts: ['ramp'] };

describe('mystery-egg snap', () => {
  it('[AC-02] a drop on the slot snaps to it and reports the slot centre', () => {
    expect(resolveDrop('ramp', { x: 500, y: 440 }, [slot], new Set())).toEqual({ kind: 'snap', slotId: 'ramp-slot', x: 500, y: 440 });
  });

  it('[AC-02] the snap radius is generous: a drop 150 px away still snaps', () => {
    expect(SNAP_RADIUS).toBeGreaterThanOrEqual(150);
    const res = resolveDrop('ramp', { x: 500 + 150, y: 440 }, [slot], new Set());
    expect(res.kind).toBe('snap');
  });

  it('[AC-02] with several compatible slots in range the nearest one wins', () => {
    const near: SlotDef = { id: 'near', x: 560, y: 440, accepts: ['ramp'] };
    const far: SlotDef = { id: 'farther', x: 420, y: 440, accepts: ['ramp'] };
    const res = resolveDrop('ramp', { x: 540, y: 440 }, [far, near], new Set(), 200);
    expect(res).toMatchObject({ kind: 'snap', slotId: 'near' });
  });

  it('[AC-02] a slot that is already occupied is skipped in favour of the next free one', () => {
    const second: SlotDef = { id: 'second', x: 600, y: 440, accepts: ['ramp'] };
    const res = resolveDrop('ramp', { x: 500, y: 440 }, [slot, second], new Set(['ramp-slot']), 200);
    expect(res).toMatchObject({ kind: 'snap', slotId: 'second' });
  });

  it('[AC-03] a drop outside the radius returns to the tray', () => {
    expect(resolveDrop('ramp', { x: 500 + SNAP_RADIUS + 1, y: 440 }, [slot], new Set())).toEqual({ kind: 'return', reason: 'too-far' });
    expect(resolveDrop('ramp', { x: 0, y: 0 }, [slot, other], new Set())).toEqual({ kind: 'return', reason: 'too-far' });
  });

  it('[AC-03] a part the slot does not accept returns to the tray, even on top of the slot', () => {
    expect(resolveDrop('ball', { x: 500, y: 440 }, [slot], new Set())).toEqual({ kind: 'return', reason: 'wrong-part' });
    expect(resolveDrop('bell', { x: 510, y: 450 }, [slot], new Set())).toEqual({ kind: 'return', reason: 'wrong-part' });
  });

  it('[AC-03] a drop on a slot that is the only compatible one but occupied returns to the tray', () => {
    expect(resolveDrop('ramp', { x: 500, y: 440 }, [slot], new Set(['ramp-slot']))).toEqual({ kind: 'return', reason: 'occupied' });
  });

  it('[AC-03] no slots at all is a harmless return', () => {
    expect(resolveDrop('ramp', { x: 1, y: 1 }, [], new Set())).toEqual({ kind: 'return', reason: 'too-far' });
  });
});

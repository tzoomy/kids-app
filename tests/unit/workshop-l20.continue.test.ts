// Workshop L20 win screen (docs/specs/workshop-l20.md AC-19): Continue must not look like Play.
import { describe, expect, it } from 'vitest';
import { CONTINUE_COLOURS, drawContinueIcon } from '../../src/games/mysteryEgg/workshop/l20Icons';

/** Play's base fill (ui.ts drawPlayIcon): green. */
const PLAY_GREEN = 0x4caf50;

type Call = [string, ...unknown[]];
/** A recording stand-in for Phaser's Graphics: every fill/line colour and shape call, in order. */
function recorder(): { g: never; calls: Call[] } {
  const calls: Call[] = [];
  const g = new Proxy({}, { get: (_t, name: string) => (...args: unknown[]) => { calls.push([name, ...args]); return g; } });
  return { g: g as never, calls };
}
const colours = (calls: Call[]): Set<number> => new Set(calls.filter(([n]) => n === 'fillStyle' || n === 'lineStyle').map((c) => (c[0] === 'fillStyle' ? (c[1] as number) : (c[2] as number))));

describe('workshop L20 Continue button', () => {
  it('[AC-19] Continue is drawn in its own colour (not the green of Play) and is not a play triangle', () => {
    const next = recorder();
    drawContinueIcon(next.g, 180, 112);
    const GREEN = [0x4caf50, 0x2e7d32];
    for (const c of colours(next.calls)) expect(GREEN, `colour ${c.toString(16)}`).not.toContain(c);
    // The base colour (the first fill) differs from Play's.
    expect(next.calls.find(([n]) => n === 'fillStyle')![1]).toBe(CONTINUE_COLOURS.base);
    expect(CONTINUE_COLOURS.base).not.toBe(PLAY_GREEN);
    // A door (a filled rectangle) and an arrow (a triangle head + a shaft), drawn inside the button.
    expect(next.calls.filter(([n]) => n === 'fillRect' || n === 'fillRoundedRect').length).toBeGreaterThanOrEqual(3);
    expect(next.calls.filter(([n]) => n === 'fillTriangle').length).toBeGreaterThanOrEqual(1);
  });

  it('[AC-19] everything is drawn inside the button box', () => {
    const { g, calls } = recorder();
    drawContinueIcon(g, 180, 112);
    for (const [name, ...a] of calls) {
      if (name === 'fillRect' || name === 'fillRoundedRect' || name === 'strokeRoundedRect') {
        const [x, y, w, h] = a as number[];
        expect(x).toBeGreaterThanOrEqual(-90);
        expect(y).toBeGreaterThanOrEqual(-56);
        expect(x + w).toBeLessThanOrEqual(90);
        expect(y + h).toBeLessThanOrEqual(56);
      }
    }
  });
});

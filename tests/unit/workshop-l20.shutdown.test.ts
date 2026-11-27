// Workshop L20 scene hygiene (docs/specs/workshop-l20.md AC-10): every input listener the scene registers is removed on SHUTDOWN.
// A static check (the scene needs Phaser and a canvas, which unit tests do not have): the #119 review found `gameout` registered
// next to pointermove/pointerup but never removed.
import { readFileSync } from 'node:fs';
import { describe, expect, it } from 'vitest';

const source = readFileSync('src/games/mysteryEgg/workshop/WorkshopL20Scene.ts', 'utf8');

describe('workshop L20 scene shutdown', () => {
  it('[AC-10] every `this.input.on(<event>, ...)` has a matching `this.input.off(<event>, ...)`', () => {
    const on = [...source.matchAll(/this\.input\.on\('(\w+)'/g)].map((m) => m[1]);
    const off = new Set([...source.matchAll(/this\.input\.off\('(\w+)'/g)].map((m) => m[1]));
    expect(on).toEqual(expect.arrayContaining(['pointermove', 'pointerup', 'gameout']));
    for (const event of on) expect(off.has(event), `${event} is registered but never removed on shutdown`).toBe(true);
  });
});

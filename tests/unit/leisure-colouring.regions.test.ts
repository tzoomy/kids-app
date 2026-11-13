// Pure region logic for Colouring Time (AC-07, AC-29, AC-30).
import { describe, it, expect } from 'vitest';
import { fillTarget, hitTest, hitTestableRegions, effectiveColour, type ColouringRegionDef } from '../../src/games/colouring/regions';
import { COLOURING_PAGES, pageRegions } from '../shared/leisureColouringPages';

const cat: ColouringRegionDef[] = pageRegions(COLOURING_PAGES.find((p) => p.id === 'cat')!);

/** A simple rectangle world in viewBox units, used as the injected contains/distance. */
const BOXES: Record<string, { x: number; y: number; w: number; h: number }> = {
  'cat-body': { x: 200, y: 300, w: 400, h: 300 },
  'cat-belly': { x: 280, y: 380, w: 200, h: 140 }, // fine, on top of body
  'cat-head': { x: 300, y: 80, w: 200, h: 180 },
};

function contains(id: string, x: number, y: number): boolean {
  const b = BOXES[id];
  if (!b) return false;
  return x >= b.x && x <= b.x + b.w && y >= b.y && y <= b.y + b.h;
}

function distance(id: string, x: number, y: number): number {
  const b = BOXES[id];
  if (!b) return Infinity;
  const dx = Math.max(b.x - x, 0, x - (b.x + b.w));
  const dy = Math.max(b.y - y, 0, y - (b.y + b.h));
  if (dx === 0 && dy === 0) return 0;
  return Math.hypot(dx, dy);
}

const base = { regions: cat, contains, distance, snapRadiusVu: 20 };

describe('leisure-colouring regions', () => {
  it('[AC-07] a new age-2 profile only hit-tests coarse regions, and a tap on a fine area fills the parent; age 5 hit-tests all regions', () => {
    const coarse = hitTestableRegions(cat, 'age2');
    const all = hitTestableRegions(cat, 'age5');
    expect(coarse.every((r) => r.age2)).toBe(true);
    expect(coarse.length).toBeLessThan(all.length);
    expect(all.map((r) => r.id)).toEqual(cat.map((r) => r.id));
    expect(fillTarget('cat-belly', cat, 'age2')).toBe('cat-body');
    expect(fillTarget('cat-belly', cat, 'age5')).toBe('cat-belly');
    expect(hitTest(300, 420, { ...base, ageTrack: 'age2' })).toBe('cat-body');
    expect(hitTest(300, 420, { ...base, ageTrack: 'age5' })).toBe('cat-belly');
  });

  it('[AC-29] hitTest: region under the finger wins (topmost if several); outline or within 20 vu snaps to the nearest; farther is a no-op; age 2 ignores fine regions', () => {
    // Inside body only.
    expect(hitTest(220, 320, { ...base, ageTrack: 'age5' })).toBe('cat-body');
    // Inside belly (also inside body): topmost / later in document order wins.
    expect(hitTest(300, 420, { ...base, ageTrack: 'age5' })).toBe('cat-belly');
    // Just outside the body, within 20 vu.
    expect(hitTest(190, 450, { ...base, ageTrack: 'age5' })).toBe('cat-body');
    // Far away.
    expect(hitTest(20, 20, { ...base, ageTrack: 'age5' })).toBeNull();
    // Age 2: the belly area fills the parent (belly is not hit-testable).
    expect(hitTest(300, 420, { ...base, ageTrack: 'age2' })).toBe('cat-body');
  });

  it('[AC-30] unit tests inject contains() and this module does not import Phaser; Path2D is the runtime plan (implemented in step 2)', () => {
    const source = require('node:fs').readFileSync(require('node:path').resolve(__dirname, '../../src/games/colouring/regions.ts'), 'utf8') as string;
    expect(source).not.toMatch(/from ['"]phaser['"]/);
    expect(source).toMatch(/Path2D/);
    expect(source).toMatch(/isPointInPath/);
    expect(source).not.toMatch(/getImageData|createImageData|id raster/i);
    // Calling hitTest with the injected contains is the unit-test contract; it must not throw once implemented.
    expect(hitTest(220, 320, { ...base, ageTrack: 'age5' })).toBe('cat-body');
  });

  it('[AC-07] effective colour uses the explicit fill, else a fine region shows its parent colour, else paper', () => {
    expect(effectiveColour('cat-body', { 'cat-body': 'red' }, cat)).toBe('red');
    expect(effectiveColour('cat-belly', { 'cat-body': 'red' }, cat)).toBe('red');
    expect(effectiveColour('cat-belly', { 'cat-body': 'red', 'cat-belly': 'blue' }, cat)).toBe('blue');
    expect(effectiveColour('cat-head', {}, cat)).toBe('#FFFDF9');
  });
});

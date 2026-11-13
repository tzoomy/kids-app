import { describe, it, expect } from 'vitest';
import { computeOrchestraLayout, PORTRAIT_COUNTER_TOP } from '../../src/games/orchestra/orchestraLayout';

describe('Kitchen Orchestra layout', () => {
  it('plants the chef on the counter in portrait, behind the instruments, not in the wall', () => {
    const layout = computeOrchestraLayout(800, 1280, 3);
    expect(layout.portrait).toBe(true);
    // Counter top in public/art/scenes/kitchen/bg-portrait.svg is y=856.
    expect(PORTRAIT_COUNTER_TOP).toBeCloseTo(856 / 1280);
    expect(layout.chef.feetY).toBeCloseTo(800 * 0 + 1280 * PORTRAIT_COUNTER_TOP);
    expect(layout.chef.feetY).toBeCloseTo(856);
    const instrumentY = layout.instruments[0]!.y;
    // Feet sit on the counter, at or just above the instrument row, not up in the wallpaper.
    expect(layout.chef.feetY).toBeGreaterThan(1280 * 0.64);
    expect(layout.chef.feetY).toBeLessThanOrEqual(instrumentY);
    expect(Math.abs(layout.chef.feetY - instrumentY)).toBeLessThan(30);
    // Head stays below the HUD band (y≈86) and the pendant lamp.
    expect(layout.chef.feetY - layout.chef.displayHeight).toBeGreaterThan(200);
    expect(layout.chef.depth).toBeLessThan(3);
    expect(layout.chef.depth).toBeGreaterThan(0);
  });

  it('keeps the landscape chef on the floor to the left of the instruments', () => {
    const layout = computeOrchestraLayout(1280, 800, 3);
    expect(layout.portrait).toBe(false);
    expect(layout.chef.x).toBeCloseTo(1280 * 0.2);
    expect(layout.chef.feetY).toBeCloseTo(800 * 0.78);
    expect(layout.chef.displayHeight).toBe(340);
    expect(layout.chef.x).toBeLessThan(layout.instruments[0]!.x);
    expect(layout.chef.depth).toBe(4);
  });

  it('still plants the portrait chef on the counter when there are four or five instruments', () => {
    for (const count of [4, 5]) {
      const layout = computeOrchestraLayout(800, 1280, count);
      expect(layout.chef.feetY).toBeCloseTo(856);
      expect(layout.instruments).toHaveLength(count);
      expect(layout.chef.depth).toBeLessThan(3);
    }
  });
});

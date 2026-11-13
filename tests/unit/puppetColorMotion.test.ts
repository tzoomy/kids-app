import { describe, it, expect } from 'vitest';
import { ANIM_PROFILE } from '../../src/anim/profiles';
import {
  PUPPET_CANVAS,
  PUPPET_HOTSPOTS,
  PUPPET_HOTSPOT_IDS,
  COLORING_PAGES,
  COLORING_PAGE_IDS,
  CRAYON_IDS,
  CRAYON_SHADE_FAMILIES,
  MIX_RECIPES,
} from '../../src/assets/art/puppetColor';

describe('Puppet Says knobs and hotspots', () => {
  it('keeps verb poses short and gentle', () => {
    expect(ANIM_PROFILE.puppet.jump.height).toBeGreaterThan(24);
    expect(ANIM_PROFILE.puppet.jump.height).toBeLessThanOrEqual(120);
    expect(ANIM_PROFILE.puppet.jump.duration).toBeLessThanOrEqual(800);
    expect(ANIM_PROFILE.puppet.clap.distance).toBeGreaterThan(24);
    expect(ANIM_PROFILE.puppet.clap.repeats).toBeGreaterThan(0);
    expect(ANIM_PROFILE.puppet.wave.angle).toBeGreaterThan(0);
    expect(ANIM_PROFILE.puppet.wave.angle).toBeLessThanOrEqual(45);
    expect(ANIM_PROFILE.puppet.sleep.headAngle).toBeGreaterThan(0);
    expect(ANIM_PROFILE.puppet.sleep.headAngle).toBeLessThanOrEqual(20);
    expect(ANIM_PROFILE.puppet.dance.hop).toBeLessThanOrEqual(32);
  });

  it('defines a tap hotspot for every poseable body part inside the canvas', () => {
    const required: typeof PUPPET_HOTSPOT_IDS = [
      'head',
      'ear-left',
      'ear-right',
      'eyes',
      'nose',
      'mouth',
      'tummy',
      'hand-left',
      'hand-right',
      'foot-left',
      'foot-right',
    ];
    expect(PUPPET_HOTSPOT_IDS.slice().sort()).toEqual(required.slice().sort());
    for (const id of required) {
      const box = PUPPET_HOTSPOTS[id];
      expect(box.width, id).toBeGreaterThanOrEqual(40);
      expect(box.height, id).toBeGreaterThanOrEqual(40);
      expect(box.x, id).toBeGreaterThanOrEqual(0);
      expect(box.y, id).toBeGreaterThanOrEqual(0);
      expect(box.x + box.width, id).toBeLessThanOrEqual(PUPPET_CANVAS.width);
      expect(box.y + box.height, id).toBeLessThanOrEqual(PUPPET_CANVAS.height);
    }
  });
});

describe('Color the World pages and palette data', () => {
  it('lists 6–8 pages with stable fill-region ids', () => {
    expect(COLORING_PAGE_IDS.length).toBeGreaterThanOrEqual(6);
    expect(COLORING_PAGE_IDS.length).toBeLessThanOrEqual(8);
    const seen = new Set<string>();
    for (const page of COLORING_PAGE_IDS) {
      const ids = COLORING_PAGES[page];
      expect(ids.length, page).toBeGreaterThanOrEqual(3);
      for (const id of ids) {
        expect(id.startsWith(`${page}-`), id).toBe(true);
        expect(seen.has(id), `duplicate id ${id}`).toBe(false);
        seen.add(id);
      }
    }
  });

  it('keeps fill and splash knobs short, and has close shades plus mix recipes', () => {
    expect(ANIM_PROFILE.color.fill.duration).toBeGreaterThan(0);
    expect(ANIM_PROFILE.color.fill.duration).toBeLessThanOrEqual(600);
    expect(ANIM_PROFILE.color.splash.scale).toBeGreaterThan(1);
    expect(ANIM_PROFILE.color.splash.duration).toBeLessThanOrEqual(600);
    expect(CRAYON_IDS).toEqual(expect.arrayContaining(['red', 'red-light', 'red-dark', 'blue', 'blue-light', 'blue-dark']));
    expect(CRAYON_SHADE_FAMILIES.red).toContain('red-light');
    expect(MIX_RECIPES.map((r) => r.result).sort()).toEqual(['green', 'orange', 'purple']);
  });
});

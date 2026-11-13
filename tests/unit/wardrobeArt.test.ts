// Wardrobe accessory art contract (docs/contracts/wardrobe-art.md). Art only; Claude owns the Wardrobe logic.
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import anchors from '@/content/wardrobe/anchors.json';
import { WARDROBE_ART_MANIFEST, WARDROBE_ITEMS, wardrobeArtKey } from '@/assets/art/wardrobeManifest';
import { ANIMAL_ART_KINDS, ANIMAL_RIGS, CHARACTER_RIGS } from '@/assets/art/rigs';

const PUBLIC_DIR = path.resolve(__dirname, '../../public');
const SLOTS = ['head', 'eyes', 'neck', 'headSide'] as const;

type Anchor = { attach: string; x: number; y: number; scale: number; rotate: number; layer?: string };
const characters = anchors.characters as Record<string, { rig: string; slots: Record<string, Anchor | null> }>;

describe('wardrobe accessory art', () => {
  it('has 8 items with unique ids, known slots and a manifest key each', () => {
    expect(WARDROBE_ITEMS).toHaveLength(8);
    expect(new Set(WARDROBE_ITEMS.map((i) => i.id)).size).toBe(8);
    for (const item of WARDROBE_ITEMS) {
      expect(SLOTS).toContain(item.slot);
      expect(item.pivot.x).toBeGreaterThanOrEqual(0);
      expect(item.pivot.x).toBeLessThanOrEqual(1);
      expect(item.pivot.y).toBeGreaterThanOrEqual(0);
      expect(item.pivot.y).toBeLessThanOrEqual(1);
      expect(WARDROBE_ART_MANIFEST.find((e) => e.key === wardrobeArtKey(item.id))?.url).toBe(item.url);
    }
  });

  it('every accessory file exists as a clean SVG under 15 KB whose size matches the manifest', () => {
    for (const item of WARDROBE_ITEMS) {
      const file = path.join(PUBLIC_DIR, item.url);
      expect(fs.existsSync(file), item.url).toBe(true);
      const svg = fs.readFileSync(file, 'utf8');
      expect(Buffer.byteLength(svg), item.url).toBeLessThan(15 * 1024);
      expect(svg, item.url).not.toMatch(/<text|<image|<script|<filter|Gradient|href=|url\(|data:/i);
      expect(svg, item.url).toContain(`viewBox="0 0 ${item.width} ${item.height}"`);
    }
  });

  it('anchors.json is valid: one entry per existing character, every slot a valid anchor or null', () => {
    expect(anchors.version).toBe(1);
    const known = { ...ANIMAL_RIGS, ...CHARACTER_RIGS };
    // Every restaurant animal and the chef can be dressed.
    for (const kind of [...ANIMAL_ART_KINDS, 'chef']) expect(characters[kind], kind).toBeDefined();
    for (const [kind, entry] of Object.entries(characters)) {
      expect(known[kind], `${kind} must be an existing rig`).toBeDefined();
      expect(['animal', 'character']).toContain(entry.rig);
      expect(Object.keys(entry.slots).sort()).toEqual([...SLOTS].sort());
      for (const slot of SLOTS) {
        const a = entry.slots[slot];
        if (a === null) continue;
        expect(['head', 'body']).toContain(a.attach);
        for (const n of [a.x, a.y, a.scale, a.rotate]) expect(Number.isFinite(n), `${kind}.${slot}`).toBe(true);
        expect(a.scale).toBeGreaterThan(0.3);
        expect(a.scale).toBeLessThan(2);
        expect(Math.abs(a.rotate)).toBeLessThanOrEqual(45);
        // Anchors stay on the character (480 px tall reference, feet at 0).
        expect(Math.abs(a.x)).toBeLessThanOrEqual(200);
        expect(a.y).toBeLessThanOrEqual(0);
        expect(a.y).toBeGreaterThanOrEqual(-480);
        if (a.layer !== undefined) expect(a.layer).toBe('front');
      }
    }
  });

  it('the chef keeps the approved chef hat: no head-slot items on the chef', () => {
    expect(characters.chef.slots.head).toBeNull();
    expect(WARDROBE_ITEMS.some((i) => i.id === 'chef-hat')).toBe(false);
  });
});

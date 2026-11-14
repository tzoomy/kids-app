// Wardrobe layout and layering helper (docs/specs/wardrobe.md AC-07, docs/contracts/wardrobe-art.md).
// Pure math, no Phaser. RED until src/core/wardrobe/layout.ts exists.
import { describe, expect, it } from 'vitest';
import anchorsJson from '@/content/wardrobe/anchors.json';
import { WARDROBE_ITEMS, WARDROBE_SLOT_ORDER } from '@/assets/art/wardrobeManifest';
import { layoutOutfit, slotAnchor, type PlacedItem } from '@/core/wardrobe/layout';

type Anchor = { attach: 'head' | 'body'; x: number; y: number; scale: number; rotate: number; layer?: 'front' };
type AnchorsFile = { characters: Record<string, { rig: string; slots: Record<string, Anchor | null> }> };
const anchors = anchorsJson as unknown as AnchorsFile;

const FITTED = Object.keys(anchors.characters);
const item = (id: string) => {
  const found = WARDROBE_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`no item ${id}`);
  return found;
};
const orderOf = (placed: PlacedItem[]) => placed.map((p) => p.itemId);

describe('wardrobe layout', () => {
  it('[AC-07] the fitted characters are the six restaurant animals and the chef', () => {
    expect([...FITTED].sort()).toEqual(['bear', 'cat', 'chef', 'dog', 'lion', 'panda', 'rabbit']);
  });

  it('[AC-07] an item is drawn at anchor minus pivot times size, and rotated and scaled around its pivot (bear flower-clip)', () => {
    // bear headSide: x 72, y -128, scale 0.9, rotate 15; flower-clip 110 x 110, pivot (0.5, 0.5).
    const [placed] = layoutOutfit('bear', [item('flower-clip')]);
    expect(placed.itemId).toBe('flower-clip');
    expect(placed.attach).toBe('head');
    expect(placed.left).toBeCloseTo(72 - 0.5 * 110, 6);
    expect(placed.top).toBeCloseTo(-128 - 0.5 * 110, 6);
    expect(placed.originX).toBeCloseTo(0.5 * 110, 6); // pivot in item px: the rotate/scale origin
    expect(placed.originY).toBeCloseTo(0.5 * 110, 6);
    expect(placed.scale).toBeCloseTo(0.9, 6);
    expect(placed.rotate).toBe(15);
  });

  it('[AC-07] the anchor and pivot formula holds for every fitted character, slot and item', () => {
    for (const kind of FITTED) {
      for (const wi of WARDROBE_ITEMS) {
        const anchor = anchors.characters[kind].slots[wi.slot];
        const placed = layoutOutfit(kind, [wi]);
        if (!anchor) {
          expect(placed, `${kind}/${wi.id} has no anchor`).toEqual([]);
          continue;
        }
        expect(placed, `${kind}/${wi.id}`).toHaveLength(1);
        const p = placed[0];
        expect(p.left, `${kind}/${wi.id} left`).toBeCloseTo(anchor.x - wi.pivot.x * wi.width, 6);
        expect(p.top, `${kind}/${wi.id} top`).toBeCloseTo(anchor.y - wi.pivot.y * wi.height, 6);
        expect(p.scale, `${kind}/${wi.id} scale`).toBeCloseTo(anchor.scale, 6);
        expect(p.rotate, `${kind}/${wi.id} rotate`).toBe(anchor.rotate);
        expect(p.attach, `${kind}/${wi.id} attach`).toBe(anchor.attach);
      }
    }
  });

  it('[AC-07] draw order follows slotOrder inside a layer: eyes, head, headSide, with the front-layer neck last', () => {
    expect(WARDROBE_SLOT_ORDER).toEqual(['neck', 'eyes', 'head', 'headSide']);
    const full = [item('flower-clip'), item('crown'), item('glasses'), item('scarf')];
    expect(orderOf(layoutOutfit('bear', full))).toEqual(['glasses', 'crown', 'flower-clip', 'scarf']);
  });

  it('[AC-07] the result does not depend on the order the worn items are passed in', () => {
    const a = [item('scarf'), item('flower-clip'), item('party-hat'), item('glasses')];
    const b = [...a].reverse();
    expect(orderOf(layoutOutfit('rabbit', a))).toEqual(orderOf(layoutOutfit('rabbit', b)));
    expect(orderOf(layoutOutfit('rabbit', a))).toEqual(['glasses', 'party-hat', 'flower-clip', 'scarf']);
  });

  it('[AC-07] the scarf (neck, attach body, layer front) is drawn above the head group, on every fitted character', () => {
    for (const kind of FITTED) {
      const placed = layoutOutfit(kind, [item('scarf'), item('glasses'), item('flower-clip'), item('beanie')]);
      const scarf = placed.find((p) => p.itemId === 'scarf');
      expect(scarf, kind).toBeDefined();
      expect(scarf!.attach, kind).toBe('body');
      expect(scarf!.band, kind).toBe('front');
      const scarfIndex = placed.findIndex((p) => p.itemId === 'scarf');
      expect(scarfIndex, kind).toBe(placed.length - 1);
      for (const p of placed.filter((q) => q.attach === 'head')) expect(p.band, `${kind}/${p.itemId}`).toBe('head');
    }
  });

  it('[AC-07] a body item without layer front draws between the body and the head (before every head item)', () => {
    const custom = {
      characters: {
        bear: {
          rig: 'animal',
          slots: {
            head: { attach: 'head', x: 0, y: -154, scale: 1, rotate: 0 },
            eyes: { attach: 'head', x: 0, y: -76, scale: 1, rotate: 0 },
            neck: { attach: 'body', x: 0, y: -146, scale: 1, rotate: 0 },
            headSide: { attach: 'head', x: 72, y: -128, scale: 0.9, rotate: 15 },
          },
        },
      },
    };
    const placed = layoutOutfit('bear', [item('crown'), item('scarf'), item('glasses')], custom);
    expect(orderOf(placed)).toEqual(['scarf', 'glasses', 'crown']);
    expect(placed[0].band).toBe('behindHead');
  });

  it('[AC-07] headSide sits at positive x (screen-right, the same side as the right ear) with no mirroring, on every fitted character', () => {
    for (const kind of FITTED) {
      const anchor = slotAnchor(kind, 'headSide');
      expect(anchor, kind).not.toBeNull();
      expect(anchor!.x, `${kind} headSide anchor x`).toBeGreaterThan(0);
      for (const id of ['flower-clip', 'hair-bow']) {
        const [placed] = layoutOutfit(kind, [item(id)]);
        expect(placed.flipX, `${kind}/${id}`).toBe(false);
        expect(placed.scale, `${kind}/${id}`).toBeGreaterThan(0);
        // The pivot lands on the anchor: item centre = left + originX is on the +x side.
        expect(placed.left + placed.originX, `${kind}/${id}`).toBeGreaterThan(0);
      }
    }
  });

  it('[AC-07] the chef cannot wear a head item: the approved chef hat stays (slot anchor null)', () => {
    expect(slotAnchor('chef', 'head')).toBeNull();
    expect(layoutOutfit('chef', [item('crown'), item('party-hat'), item('beanie'), item('sun-hat')])).toEqual([]);
    // The other chef slots still work.
    expect(orderOf(layoutOutfit('chef', [item('crown'), item('scarf'), item('flower-clip')]))).toEqual(['flower-clip', 'scarf']);
  });

  it('[AC-07] an unfitted character (habitat animals) draws nothing and does not throw', () => {
    expect(slotAnchor('bird', 'head')).toBeNull();
    expect(layoutOutfit('bird', [item('crown')])).toEqual([]);
    expect(layoutOutfit('bear', [])).toEqual([]);
  });

  it('[AC-07] an empty outfit draws nothing and every placement carries finite numbers', () => {
    for (const kind of FITTED) {
      for (const p of layoutOutfit(kind, WARDROBE_ITEMS)) {
        for (const n of [p.left, p.top, p.originX, p.originY, p.scale, p.rotate]) expect(Number.isFinite(n), `${kind}/${p.itemId}`).toBe(true);
      }
    }
  });
});

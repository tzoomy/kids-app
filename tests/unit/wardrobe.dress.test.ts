// Wardrobe Pass 2 (docs/specs/wardrobe.md AC-17): the bear wears the current profile's outfit on the map
// and in games through Character.setAccessories. RED until src/core/wardrobe/dress.ts exists.
//
// Intended production API (src/core/wardrobe/dress.ts, no Phaser import at runtime):
//   wearsOutfit(kind)                              -> true only for 'bear' (pending Maor decision)
//   outfitPlacements(kind, items)                  -> layoutOutfit(kind, items) for a dressed kind, [] otherwise
//   outfitArtEntries(kind, items)                  -> the manifest entries to lazy-load for those items ([] when nothing is worn)
//   currentOutfitItems(storage, profileId, track)  -> wornItems(loadWardrobeState(...), track)
//   dressCharacter(scene, character, kind, items)  -> mounts the placements through character.setAccessories and
//                                                     returns the item ids actually mounted, in draw order
import { describe, expect, it, vi } from 'vitest';
import { WARDROBE_ART_MANIFEST, WARDROBE_ITEMS, wardrobeArtKey } from '@/assets/art/wardrobeManifest';
import { layoutOutfit } from '@/core/wardrobe/layout';
import { createWardrobeState, equipItem, wornItems } from '@/core/wardrobe/model';
import { saveWardrobeState } from '@/core/wardrobe/store';
import type { StorageDriver } from '@/core/storage/store';
import {
  currentOutfitItems,
  dressCharacter,
  outfitArtEntries,
  outfitPlacements,
  wearsOutfit,
} from '@/core/wardrobe/dress';

const item = (id: string) => {
  const found = WARDROBE_ITEMS.find((i) => i.id === id);
  if (!found) throw new Error(`no item ${id}`);
  return found;
};

class MemoryStorage implements StorageDriver {
  private data = new Map<string, string>();
  getItem(key: string): string | null {
    return this.data.has(key) ? this.data.get(key)! : null;
  }
  setItem(key: string, value: string): void {
    this.data.set(key, value);
  }
  keys(): string[] {
    return [...this.data.keys()];
  }
}

/** A structural stand-in for the Phaser scene/image bits the helper touches. No Phaser needed. */
interface FakeImage {
  key: string;
  x: number;
  y: number;
  originX: number;
  originY: number;
  scale: number;
  angle: number;
  flipX: boolean;
  input: unknown;
  setInteractive: ReturnType<typeof vi.fn>;
  setOrigin(x: number, y?: number): FakeImage;
  setScale(s: number): FakeImage;
  setAngle(a: number): FakeImage;
  setFlipX(f: boolean): FakeImage;
}

function makeFakeScene(loadedKeys: readonly string[] = WARDROBE_ART_MANIFEST.map((e) => e.key)) {
  const images: FakeImage[] = [];
  const makeConfigs: Array<Record<string, unknown>> = [];
  const scene = {
    textures: { exists: (key: string) => loadedKeys.includes(key) },
    make: {
      image(cfg: { key: string; x: number; y: number; add?: boolean }) {
        makeConfigs.push(cfg);
        const img: FakeImage = {
          key: cfg.key,
          x: cfg.x,
          y: cfg.y,
          originX: 0.5,
          originY: 0.5,
          scale: 1,
          angle: 0,
          flipX: false,
          input: null,
          setInteractive: vi.fn(),
          setOrigin(x, y = x) {
            img.originX = x;
            img.originY = y;
            return img;
          },
          setScale(s) {
            img.scale = s;
            return img;
          },
          setAngle(a) {
            img.angle = a;
            return img;
          },
          setFlipX(f) {
            img.flipX = f;
            return img;
          },
        };
        images.push(img);
        return img;
      },
    },
  };
  return { scene, images, makeConfigs };
}

type Layers = { behindHead: FakeImage[]; head: FakeImage[]; front: FakeImage[] };

function makeFakeCharacter() {
  const calls: Layers[] = [];
  return { calls, character: { setAccessories: vi.fn((layers: Layers) => void calls.push(layers)) } };
}

const idsOf = (layers: Layers) => [...layers.behindHead, ...layers.head, ...layers.front].map((i) => i.key);
const keyOf = (id: string) => wardrobeArtKey(id);

describe('wardrobe dress helper: bear only', () => {
  it('[AC-17] only the bear wears the outfit; every other kind (animals, chef, habitat animals) stays undressed', () => {
    expect(wearsOutfit('bear')).toBe(true);
    for (const kind of ['rabbit', 'cat', 'dog', 'panda', 'lion', 'chef', 'fox', 'owl', 'hedgehog', '']) {
      expect(wearsOutfit(kind), kind).toBe(false);
    }
  });

  it('[AC-17] a non-bear kind gets no placements, no art to load, and dressing it is a no-op', () => {
    const worn = [item('beanie'), item('flower-clip'), item('scarf')];
    for (const kind of ['rabbit', 'cat', 'dog', 'panda', 'lion', 'chef']) {
      expect(outfitPlacements(kind, worn), kind).toEqual([]);
      expect(outfitArtEntries(kind, worn), kind).toEqual([]);
      const { scene, images } = makeFakeScene();
      const { character } = makeFakeCharacter();
      expect(dressCharacter(scene as never, character as never, kind, worn), kind).toEqual([]);
      expect(character.setAccessories, kind).not.toHaveBeenCalled();
      expect(images, kind).toHaveLength(0);
    }
  });
});

describe('wardrobe dress helper: reuses layoutOutfit', () => {
  it('[AC-17] a bear gets exactly the layoutOutfit placements (draw order by slotOrder and band, scarf last)', () => {
    const worn = [item('scarf'), item('flower-clip'), item('beanie')]; // deliberately unsorted input
    expect(outfitPlacements('bear', worn)).toEqual(layoutOutfit('bear', worn));
    expect(outfitPlacements('bear', worn).map((p) => p.itemId)).toEqual(['beanie', 'flower-clip', 'scarf']);
  });

  it('[AC-17] headSide is flipX false at a positive x (screen right) and nothing is mirrored', () => {
    const [placed] = outfitPlacements('bear', [item('flower-clip')]);
    expect(placed.slot).toBe('headSide');
    expect(placed.flipX).toBe(false);
    expect(placed.left + placed.originX).toBeGreaterThan(0); // the anchor, in the head group
    const { scene, images } = makeFakeScene();
    const { character } = makeFakeCharacter();
    dressCharacter(scene as never, character as never, 'bear', [item('flower-clip')]);
    expect(images).toHaveLength(1);
    expect(images[0].flipX).toBe(false);
    expect(images[0].x).toBeGreaterThan(0);
  });

  it('[AC-17] dressCharacter passes the layout through: each image sits at left+origin with the layout pivot, scale and angle', () => {
    const worn = [item('party-hat'), item('flower-clip'), item('scarf')];
    const placements = layoutOutfit('bear', worn);
    const { scene, images } = makeFakeScene();
    const { character } = makeFakeCharacter();
    const applied = dressCharacter(scene as never, character as never, 'bear', worn);

    expect(applied).toEqual(placements.map((p) => p.itemId));
    expect(images.map((i) => i.key)).toEqual(placements.map((p) => keyOf(p.itemId)));
    placements.forEach((p, n) => {
      const img = images[n];
      const def = item(p.itemId);
      expect(img.x, p.itemId).toBeCloseTo(p.left + p.originX, 6);
      expect(img.y, p.itemId).toBeCloseTo(p.top + p.originY, 6);
      expect(img.originX, p.itemId).toBeCloseTo(def.pivot.x, 6);
      expect(img.originY, p.itemId).toBeCloseTo(def.pivot.y, 6);
      expect(img.scale, p.itemId).toBeCloseTo(p.scale, 6);
      expect(img.angle, p.itemId).toBe(p.rotate);
      expect(img.flipX, p.itemId).toBe(p.flipX);
    });
  });

  it('[AC-17] the images are handed to Character.setAccessories in the layout bands: behindHead, head, then front (scarf last)', () => {
    const worn = [item('beanie'), item('flower-clip'), item('scarf'), item('glasses')];
    const placements = layoutOutfit('bear', worn);
    const { scene } = makeFakeScene();
    const { character, calls } = makeFakeCharacter();
    dressCharacter(scene as never, character as never, 'bear', worn);

    expect(character.setAccessories).toHaveBeenCalledTimes(1);
    const layers = calls[0];
    const expectBand = (band: 'behindHead' | 'head' | 'front') =>
      placements.filter((p) => p.band === band).map((p) => keyOf(p.itemId));
    expect(layers.behindHead.map((i) => i.key)).toEqual(expectBand('behindHead'));
    expect(layers.head.map((i) => i.key)).toEqual(expectBand('head'));
    expect(layers.front.map((i) => i.key)).toEqual(expectBand('front'));
    expect(layers.front.map((i) => i.key)).toEqual([keyOf('scarf')]);
    // Concatenated bands are the global draw order, with the scarf last.
    expect(idsOf(layers)).toEqual(placements.map((p) => keyOf(p.itemId)));
    expect(idsOf(layers).at(-1)).toBe(keyOf('scarf'));
  });
});

describe('wardrobe dress helper: never blocks taps', () => {
  it('[AC-17] accessories are created off-display-list and are never made interactive', () => {
    const worn = [item('beanie'), item('flower-clip'), item('scarf'), item('glasses'), item('crown')];
    const { scene, images, makeConfigs } = makeFakeScene();
    const { character } = makeFakeCharacter();
    dressCharacter(scene as never, character as never, 'bear', worn);

    expect(images.length).toBeGreaterThan(0);
    for (const cfg of makeConfigs) expect(cfg.add, 'add:false so Character owns the image').toBe(false);
    for (const img of images) {
      expect(img.setInteractive, img.key).not.toHaveBeenCalled();
      expect(img.input, img.key).toBeNull(); // no input plugin entry: not a pointer target
    }
  });
});

describe('wardrobe dress helper: what is dressed', () => {
  it('[AC-17] an empty outfit draws nothing: no images, and any accessory call carries empty layers (clears stale ones)', () => {
    const { scene, images } = makeFakeScene();
    const { character, calls } = makeFakeCharacter();
    expect(dressCharacter(scene as never, character as never, 'bear', [])).toEqual([]);
    expect(images).toHaveLength(0);
    for (const layers of calls) expect(idsOf(layers)).toEqual([]);
    expect(outfitArtEntries('bear', [])).toEqual([]);
  });

  it('[AC-17] an item whose art has not loaded is skipped and not reported as mounted', () => {
    const { scene, images } = makeFakeScene([keyOf('beanie')]); // only the beanie texture exists
    const { character, calls } = makeFakeCharacter();
    const applied = dressCharacter(scene as never, character as never, 'bear', [item('beanie'), item('scarf')]);
    expect(applied).toEqual(['beanie']);
    expect(images.map((i) => i.key)).toEqual([keyOf('beanie')]);
    expect(idsOf(calls[0])).toEqual([keyOf('beanie')]);
  });

  it('[AC-17] the art to lazy-load is exactly the manifest entries of the worn items (nothing at boot)', () => {
    const entries = outfitArtEntries('bear', [item('beanie'), item('scarf')]);
    expect(entries.map((e) => e.key).sort()).toEqual([keyOf('beanie'), keyOf('scarf')].sort());
    for (const e of entries) expect(WARDROBE_ART_MANIFEST).toContainEqual(e);
  });

  it('[AC-17] currentOutfitItems dresses the profile\'s worn items for the age track, via wornItems', () => {
    const storage = new MemoryStorage();
    let state = createWardrobeState();
    state = { ...state, unlocked: [...state.unlocked, 'beanie', 'glasses'] };
    state = equipItem(state, 'age5', 'beanie');
    state = equipItem(state, 'age5', 'flower-clip');
    state = equipItem(state, 'age5', 'glasses');
    saveWardrobeState(storage, 'a', state);

    const age5 = currentOutfitItems(storage, 'a', 'age5');
    expect(age5).toEqual(wornItems(state, 'age5'));
    expect(age5.map((i) => i.id).sort()).toEqual(['beanie', 'flower-clip', 'glasses']);

    // Age 2 does not offer glasses: it is not dressed, and the saved state is untouched.
    expect(currentOutfitItems(storage, 'a', 'age2').map((i) => i.id).sort()).toEqual(['beanie', 'flower-clip']);
  });

  it('[AC-17] profiles never share an outfit: another profile or an empty store dresses nothing', () => {
    const storage = new MemoryStorage();
    saveWardrobeState(storage, 'a', equipItem({ ...createWardrobeState(), unlocked: ['flower-clip', 'beanie'] }, 'age2', 'beanie'));
    expect(currentOutfitItems(storage, 'a', 'age2').map((i) => i.id)).toEqual(['beanie']);
    expect(currentOutfitItems(storage, 'b', 'age2')).toEqual([]);
  });
});

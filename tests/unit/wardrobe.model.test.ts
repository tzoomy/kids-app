// Wardrobe unlock and equip model (docs/specs/wardrobe.md, AC-03, AC-12). Pure: no Phaser, no DOM.
// RED until src/core/wardrobe/model.ts exists.
import { describe, expect, it, vi } from 'vitest';
import {
  createWardrobeState,
  equipItem,
  offeredItems,
  recordCompletedRound,
  toggleItem,
  unequipSlot,
  wornItems,
  type WardrobeState,
} from '@/core/wardrobe/model';
import { WARDROBE_ITEMS } from '@/assets/art/wardrobeManifest';

type Track = 'age2' | 'age5';

const AGE2_IDS = ['beanie', 'flower-clip', 'party-hat', 'scarf'];
const AGE5_ONLY_IDS = ['crown', 'glasses', 'hair-bow', 'sun-hat'];
const ALL_IDS = [...AGE2_IDS, ...AGE5_ONLY_IDS].sort();

const ids = (items: Array<{ id: string }>) => items.map((i) => i.id).sort();
const unlocked = (state: WardrobeState) => [...state.unlocked].sort();

/** Applies completed rounds in order and returns the final state. */
function play(track: Track, rounds: Array<[string, string]>, from: WardrobeState = createWardrobeState()): WardrobeState {
  return rounds.reduce((s, [worldId, gameId]) => recordCompletedRound(s, track, { worldId, gameId }).state, from);
}

/** A state with the given items unlocked (and the starter), no history. */
function withUnlocked(extra: string[]): WardrobeState {
  const base = createWardrobeState();
  return { ...base, unlocked: [...new Set([...base.unlocked, ...extra])] };
}

describe('wardrobe model: offered items', () => {
  it('[AC-03] age 2 is offered only items whose ages include 2; age 5 is offered all 8', () => {
    expect(ids(offeredItems('age2'))).toEqual(AGE2_IDS);
    expect(ids(offeredItems('age5'))).toEqual(ALL_IDS);
    expect(WARDROBE_ITEMS).toHaveLength(8);
  });
});

describe('wardrobe model: unlock rules', () => {
  it('[AC-03] a new profile has exactly the starter flower-clip unlocked, at both ages, and an empty outfit', () => {
    const state = createWardrobeState();
    expect(state.unlocked).toEqual(['flower-clip']);
    expect(state.outfit).toEqual({});
    expect(state.completed).toEqual({});
  });

  it.each([
    ['language-house', 'animal-restaurant', 'beanie'],
    ['number-garden', 'sorting-beds', 'scarf'],
    ['nature-lab', 'who-is-hiding', 'party-hat'],
  ])('[AC-03] the first completed round in %s (%s) unlocks %s at both ages', (worldId, gameId, itemId) => {
    for (const track of ['age2', 'age5'] as Track[]) {
      const result = recordCompletedRound(createWardrobeState(), track, { worldId, gameId });
      expect(result.newlyUnlocked, `${track}`).toContain(itemId);
      expect(result.state.unlocked, `${track}`).toContain(itemId);
    }
  });

  it('[AC-03] a world unlocks only its own item: one Language House round does not unlock scarf or party-hat', () => {
    const state = play('age5', [['language-house', 'animal-restaurant']]);
    expect(unlocked(state)).toEqual(['beanie', 'flower-clip']);
  });

  it('[AC-03] recording a round is idempotent: a second round in the same world unlocks nothing new and never re-announces', () => {
    const first = recordCompletedRound(createWardrobeState(), 'age2', { worldId: 'language-house', gameId: 'animal-restaurant' });
    expect(first.newlyUnlocked).toEqual(['beanie']);
    const second = recordCompletedRound(first.state, 'age2', { worldId: 'language-house', gameId: 'animal-restaurant' });
    expect(second.newlyUnlocked).toEqual([]);
    expect(unlocked(second.state)).toEqual(unlocked(first.state));
  });

  it('[AC-03] recording a round does not mutate the state it was given', () => {
    const before = createWardrobeState();
    const snapshot = JSON.stringify(before);
    recordCompletedRound(before, 'age5', { worldId: 'language-house', gameId: 'animal-restaurant' });
    expect(JSON.stringify(before)).toBe(snapshot);
  });

  it('[AC-03] hair-bow unlocks after a round in art-studio at age 5', () => {
    const result = recordCompletedRound(createWardrobeState(), 'age5', { worldId: 'art-studio', gameId: 'sticker-board' });
    expect(result.newlyUnlocked).toEqual(['hair-bow']);
  });

  it('[AC-03] glasses unlock after a round in nature-lab or science-world at age 5', () => {
    const nature = recordCompletedRound(createWardrobeState(), 'age5', { worldId: 'nature-lab', gameId: 'seed-to-flower' });
    expect(nature.newlyUnlocked).toEqual(expect.arrayContaining(['glasses', 'party-hat']));
    const science = recordCompletedRound(createWardrobeState(), 'age5', { worldId: 'science-world', gameId: 'potion-lab' });
    expect(science.newlyUnlocked).toEqual(['glasses']);
  });

  it('[AC-03] sun-hat needs three different games in the same world; three rounds of one game do not count', () => {
    const sameGame = play('age5', [
      ['language-house', 'animal-restaurant'],
      ['language-house', 'animal-restaurant'],
      ['language-house', 'animal-restaurant'],
    ]);
    expect(sameGame.unlocked).not.toContain('sun-hat');

    const twoGames = play('age5', [
      ['language-house', 'animal-restaurant'],
      ['language-house', 'kitchen-orchestra'],
    ]);
    expect(twoGames.unlocked).not.toContain('sun-hat');

    const threeGames = recordCompletedRound(twoGames, 'age5', { worldId: 'language-house', gameId: 'letter-monster' });
    expect(threeGames.newlyUnlocked).toEqual(['sun-hat']);
  });

  it('[AC-03] sun-hat does not count games spread over different worlds', () => {
    const state = play('age5', [
      ['language-house', 'animal-restaurant'],
      ['number-garden', 'sorting-beds'],
      ['nature-lab', 'who-is-hiding'],
      ['science-world', 'potion-lab'],
    ]);
    expect(state.unlocked).not.toContain('sun-hat');
  });

  it('[AC-03] crown unlocks only once every other age-5 item is unlocked', () => {
    const sevenOthers = ['beanie', 'scarf', 'party-hat', 'hair-bow', 'sun-hat', 'glasses'];
    // Every other item except one: no crown.
    for (const missing of sevenOthers) {
      const state = withUnlocked(sevenOthers.filter((i) => i !== missing));
      // Any recorded round re-evaluates crown; an Art Studio round also unlocks hair-bow.
      const next = recordCompletedRound(state, 'age5', { worldId: 'art-studio', gameId: 'sticker-board' });
      const expectCrown = missing === 'hair-bow'; // the Art Studio round itself unlocks hair-bow, completing the set
      expect(next.state.unlocked.includes('crown'), `missing ${missing}`).toBe(expectCrown);
    }
    const all = recordCompletedRound(withUnlocked(sevenOthers), 'age5', { worldId: 'language-house', gameId: 'animal-restaurant' });
    expect(all.newlyUnlocked).toEqual(['crown']);
    expect(unlocked(all.state)).toEqual(ALL_IDS);
  });

  it('[AC-03] a full age-5 journey through every learning world unlocks all 8 items and crown comes last', () => {
    const rounds: Array<[string, string]> = [
      ['language-house', 'animal-restaurant'],
      ['language-house', 'kitchen-orchestra'],
      ['language-house', 'letter-monster'],
      ['number-garden', 'sorting-beds'],
      ['nature-lab', 'who-is-hiding'],
      ['science-world', 'potion-lab'],
      ['art-studio', 'sticker-board'],
    ];
    let state = createWardrobeState();
    let crownIndex = -1;
    rounds.forEach(([worldId, gameId], index) => {
      const r = recordCompletedRound(state, 'age5', { worldId, gameId });
      if (r.newlyUnlocked.includes('crown')) crownIndex = index;
      state = r.state;
    });
    expect(unlocked(state)).toEqual(ALL_IDS);
    expect(crownIndex).toBe(rounds.length - 1);
  });

  it('[AC-03] age 2 never unlocks hair-bow, sun-hat, glasses or crown, even when those progress events happen', () => {
    const state = play('age2', [
      ['language-house', 'animal-restaurant'],
      ['language-house', 'kitchen-orchestra'],
      ['language-house', 'letter-monster'],
      ['number-garden', 'sorting-beds'],
      ['nature-lab', 'who-is-hiding'],
      ['science-world', 'potion-lab'],
      ['art-studio', 'sticker-board'],
    ]);
    expect(unlocked(state)).toEqual(AGE2_IDS);
    for (const id of AGE5_ONLY_IDS) expect(state.unlocked).not.toContain(id);
  });

  it('[AC-03] leisure-corner rounds never count toward any unlock', () => {
    const state = play('age5', [
      ['leisure-corner', 'bubbles'],
      ['leisure-corner', 'leisure-colouring'],
      ['leisure-corner', 'bubbles-2'],
      ['leisure-corner', 'bubbles-3'],
    ]);
    expect(unlocked(state)).toEqual(['flower-clip']);
    expect(state.completed['leisure-corner'] ?? []).toEqual([]);
  });

  it('[AC-03] an unknown world id unlocks nothing and does not throw', () => {
    expect(() => play('age5', [['not-a-world', 'x']])).not.toThrow();
    expect(unlocked(play('age5', [['not-a-world', 'x']]))).toEqual(['flower-clip']);
  });

  it('[AC-03] the history records distinct game ids per world (enough to evaluate sun-hat later)', () => {
    const state = play('age2', [
      ['language-house', 'animal-restaurant'],
      ['language-house', 'animal-restaurant'],
      ['language-house', 'kitchen-orchestra'],
    ]);
    expect([...state.completed['language-house']].sort()).toEqual(['animal-restaurant', 'kitchen-orchestra']);
  });
});

describe('wardrobe model: equip and unequip', () => {
  const ready = withUnlocked(['beanie', 'party-hat', 'scarf', 'hair-bow', 'sun-hat', 'crown', 'glasses']);

  it('[AC-03] equipping an unlocked item puts it in its slot', () => {
    const state = equipItem(ready, 'age5', 'beanie');
    expect(state.outfit).toEqual({ head: 'beanie' });
  });

  it('[AC-03] equipping a second item in the same slot replaces the first (one item per slot)', () => {
    const state = equipItem(equipItem(ready, 'age5', 'beanie'), 'age5', 'party-hat');
    expect(state.outfit.head).toBe('party-hat');
    expect(Object.keys(state.outfit)).toEqual(['head']);
  });

  it('[AC-03] head and headSide may be worn together because exclusiveSlots is empty', () => {
    const state = equipItem(equipItem(ready, 'age5', 'crown'), 'age5', 'hair-bow');
    expect(state.outfit).toEqual({ head: 'crown', headSide: 'hair-bow' });
  });

  it('[AC-03] flower-clip and hair-bow share the headSide slot: the second replaces the first', () => {
    const state = equipItem(equipItem(ready, 'age5', 'flower-clip'), 'age5', 'hair-bow');
    expect(state.outfit.headSide).toBe('hair-bow');
  });

  it('[AC-03] unequipping a slot removes only that slot', () => {
    const dressed = equipItem(equipItem(ready, 'age5', 'beanie'), 'age5', 'flower-clip');
    const state = unequipSlot(dressed, 'head');
    expect(state.outfit).toEqual({ headSide: 'flower-clip' });
    expect(unequipSlot(state, 'head').outfit).toEqual({ headSide: 'flower-clip' });
  });

  it('[AC-03] toggling the worn item takes it off; toggling another puts it on', () => {
    const on = toggleItem(ready, 'age5', 'scarf');
    expect(on.outfit.neck).toBe('scarf');
    const off = toggleItem(on, 'age5', 'scarf');
    expect(off.outfit.neck).toBeUndefined();
  });

  it('[AC-03] a locked item cannot be equipped or toggled on', () => {
    const fresh = createWardrobeState();
    expect(equipItem(fresh, 'age5', 'beanie').outfit).toEqual({});
    expect(toggleItem(fresh, 'age5', 'crown').outfit).toEqual({});
  });

  it('[AC-03] an item not offered for the age cannot be equipped, even if it is unlocked', () => {
    const state = equipItem(ready, 'age2', 'crown');
    expect(state.outfit).toEqual({});
    expect(toggleItem(ready, 'age2', 'glasses').outfit).toEqual({});
  });

  it('[AC-03] an unknown item id changes nothing', () => {
    expect(equipItem(ready, 'age5', 'top-hat').outfit).toEqual({});
  });

  it('[AC-03] wornItems returns the worn items in slotOrder (neck, eyes, head, headSide) and drops items not offered for the age', () => {
    const dressed: WardrobeState = {
      ...ready,
      outfit: { headSide: 'flower-clip', head: 'crown', eyes: 'glasses', neck: 'scarf' },
    };
    expect(wornItems(dressed, 'age5').map((i) => i.id)).toEqual(['scarf', 'glasses', 'crown', 'flower-clip']);
    expect(wornItems(dressed, 'age2').map((i) => i.id)).toEqual(['scarf', 'flower-clip']);
  });

  it('[AC-03] wornItems drops an outfit entry whose item is locked', () => {
    const odd: WardrobeState = { ...createWardrobeState(), outfit: { head: 'crown' } };
    expect(wornItems(odd, 'age5')).toEqual([]);
  });
});

describe('wardrobe model: no purchases, ads or time gates', () => {
  it('[AC-12] elapsed time unlocks nothing: a state created a year later is still only the starter', () => {
    vi.useFakeTimers();
    try {
      vi.setSystemTime(new Date('2026-11-14T08:00:00Z'));
      const first = createWardrobeState();
      vi.setSystemTime(new Date('2027-11-14T08:00:00Z'));
      const later = createWardrobeState();
      expect(unlocked(first)).toEqual(['flower-clip']);
      expect(unlocked(later)).toEqual(['flower-clip']);
      expect(unlocked(play('age5', [], later))).toEqual(['flower-clip']);
    } finally {
      vi.useRealTimers();
    }
  });

  it('[AC-12] the state has no currency, price, ad or timer fields', () => {
    expect(Object.keys(createWardrobeState()).sort()).toEqual(['completed', 'outfit', 'unlocked', 'v']);
  });

  it('[AC-12] item content has no price, cost, ad or time-gate fields', () => {
    const allowed = new Set(['id', 'slot', 'url', 'width', 'height', 'pivot', 'ages', 'starter']);
    for (const item of WARDROBE_ITEMS) {
      for (const key of Object.keys(item)) expect(allowed.has(key), `${item.id}.${key}`).toBe(true);
    }
  });

  it('[AC-12] the only items unlocked without a completed round are the starters', () => {
    expect(WARDROBE_ITEMS.filter((i) => i.starter).map((i) => i.id)).toEqual(['flower-clip']);
    expect(createWardrobeState().unlocked).toEqual(['flower-clip']);
  });
});

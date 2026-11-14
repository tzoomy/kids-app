import { describe, expect, it } from 'vitest';
import {
  WORD_TRAIN_PHASES,
  arrive,
  arriveLoad,
  arriveSpell,
  createLoadRound,
  createSpellRound,
  pickObject,
  placeTile,
  tapTile,
  type WordTrainSpellState,
  type WordTrainState,
} from '@/games/wordTrain/wordTrainMachine';

function createLcg(seed: number): () => number {
  let s = seed >>> 0;
  return () => {
    s = (Math.imul(1664525, s) + 1013904223) >>> 0;
    return s / 4294967296;
  };
}

function spellStateKey(s: WordTrainSpellState): string {
  const slots = s.slots.map((c) => c ?? '_').join('');
  const tiles = s.tiles.map((t) => `${t.letter}:${t.placedAt ?? '_'}`).join(',');
  return `${s.phase}|${slots}|${tiles}`;
}

function canReachDeparting(start: WordTrainSpellState): boolean {
  if (start.phase === 'departing') return true;
  const visited = new Set<string>([spellStateKey(start)]);
  const queue: WordTrainSpellState[] = [start];

  while (queue.length > 0) {
    const cur = queue.shift()!;
    const nextStates: WordTrainState[] = [];
    for (let t = 0; t < cur.tiles.length; t++) {
      nextStates.push(tapTile(cur, t).state);
      for (let slot = 0; slot < cur.slots.length; slot++) {
        nextStates.push(placeTile(cur, t, slot).state);
      }
    }
    for (const next of nextStates) {
      if (next.mode !== 'spell') continue;
      if (next.phase === 'departing') return true;
      const key = spellStateKey(next);
      if (!visited.has(key)) {
        visited.add(key);
        queue.push(next);
      }
    }
  }
  return false;
}

describe('wordTrainMachine', () => {
  it('[AC-02] load mode: asked-for object returns loaded and enters departing; other object returns other, keeps request and increments tries', () => {
    const s0 = createLoadRound({ choices: ['apple', 'ball', 'hat'], target: 'apple' });
    expect(s0.phase).toBe('asking');
    expect(s0.target).toBe('apple');
    expect(s0.tries).toBe(0);

    // Picking another object keeps the request and stays in 'asking'.
    const rOther = pickObject(s0, 'ball');
    expect(rOther.event).toEqual({ kind: 'other', id: 'ball', target: 'apple', tries: 1 });
    expect(rOther.state.mode).toBe('load');
    expect(rOther.state.phase).toBe('asking');
    if (rOther.state.mode === 'load') {
      expect(rOther.state.target).toBe('apple');
      expect(rOther.state.tries).toBe(1);
    }

    // Picking the asked-for object transitions to 'departing'.
    const rLoaded = pickObject(rOther.state, 'apple');
    expect(rLoaded.event).toEqual({ kind: 'loaded', id: 'apple', tries: 2 });
    expect(rLoaded.state.phase).toBe('departing');

    // Further picks while departing return 'busy'.
    expect(pickObject(rLoaded.state, 'hat').event).toEqual({ kind: 'busy' });

    // arriveLoad starts the next request cleanly.
    const sNext = arriveLoad(rLoaded.state, { choices: ['egg', 'fish'], target: 'fish' });
    expect(sNext).toEqual({
      mode: 'load',
      phase: 'asking',
      choices: ['egg', 'fish'],
      target: 'fish',
      tries: 0,
    });

    // Unknown ids throw.
    expect(() => pickObject(s0, 'unknown')).toThrow();
  });

  it('[AC-03] spell mode: right letter locks in, wrong/distractor/filled slot bounces, tap targets first empty slot, and last letter spells word', () => {
    // Word "sun" with distractor 'b': tiles ['b', 'n', 's', 'u']
    const s0 = createSpellRound({ word: 'sun', letters: ['b', 'n', 's', 'u'] });
    expect(s0.phase).toBe('spelling');
    expect(s0.slots).toEqual([null, null, null]);

    // Distractor 'b' bounces at slot 0.
    const b1 = placeTile(s0, 0, 0);
    expect(b1.event).toEqual({ kind: 'bounced', tileIndex: 0, letter: 'b' });
    expect(b1.state.mode === 'spell' && b1.state.bounces).toBe(1);

    // Right letter 'n' in wrong wagon (slot 0) bounces.
    const b2 = tapTile(b1.state, 1); // first empty slot is 0, tile 1 is 'n' != 's'
    expect(b2.event).toEqual({ kind: 'bounced', tileIndex: 1, letter: 'n' });
    expect(b2.state.mode === 'spell' && b2.state.bounces).toBe(2);

    // Drag 'n' directly onto slot 2 -> placed!
    const p1 = placeTile(b2.state, 1, 2);
    expect(p1.event).toEqual({ kind: 'placed', tileIndex: 1, slotIndex: 2, letter: 'n' });
    expect(p1.state.phase).toBe('spelling');
    if (p1.state.mode === 'spell') {
      expect(p1.state.slots).toEqual([null, null, 'n']);
      expect(p1.state.tiles[1].placedAt).toBe(2);
    }

    // Placed tile cannot be moved again (busy).
    expect(placeTile(p1.state, 1, 0).event).toEqual({ kind: 'busy' });
    expect(tapTile(p1.state, 1).event).toEqual({ kind: 'busy' });

    // Dropping a tile on an already-filled slot (slot 2) bounces.
    const b3 = placeTile(p1.state, 2, 2);
    expect(b3.event).toEqual({ kind: 'bounced', tileIndex: 2, letter: 's' });

    // Tap 's' (index 2) -> goes to first empty slot (0) -> placed.
    const p2 = tapTile(b3.state, 2);
    expect(p2.event).toEqual({ kind: 'placed', tileIndex: 2, slotIndex: 0, letter: 's' });

    // Tap 'u' (index 3) -> goes to first empty slot (1) -> spelled and enters departing!
    const p3 = tapTile(p2.state, 3);
    expect(p3.event).toEqual({ kind: 'spelled', word: 'sun', bounces: 3 });
    expect(p3.state.phase).toBe('departing');

    // Busy once departing.
    expect(tapTile(p3.state, 0).event).toEqual({ kind: 'busy' });
    expect(placeTile(p3.state, 0, 0).event).toEqual({ kind: 'busy' });

    // arriveSpell / arrive starts next word cleanly.
    const sNext = arriveSpell(p3.state, { word: 'hat', letters: ['t', 'a', 'h'] });
    expect(sNext.phase).toBe('spelling');
    expect(sNext.word).toBe('hat');
    expect(arrive(p3.state, { mode: 'load', choices: ['apple', 'hat'], target: 'hat' }).mode).toBe('load');

    // Unknown indices throw.
    expect(() => tapTile(s0, -1)).toThrow();
    expect(() => tapTile(s0, 99)).toThrow();
    expect(() => placeTile(s0, 0, -1)).toThrow();
    expect(() => placeTile(s0, 0, 3)).toThrow();
  });

  it('[AC-04] no failure state: WORD_TRAIN_PHASES has only asking, spelling, departing; exhaustive bounded search keeps word completable and never unplaces a letter', () => {
    expect(WORD_TRAIN_PHASES).toEqual(['asking', 'spelling', 'departing']);

    const cases = [
      { word: 'sun', letters: ['s', 'u', 'n', 'b'] },
      { word: 'egg', letters: ['g', 'e', 'g'] },
      { word: 'ball', letters: ['l', 'b', 'a', 'l', 'd'] },
    ];

    for (const cfg of cases) {
      const initial = createSpellRound(cfg);
      const visited = new Map<string, WordTrainSpellState>([[spellStateKey(initial), initial]]);
      const queue: WordTrainSpellState[] = [initial];
      const MAX_STATES = 3000;

      while (queue.length > 0 && visited.size < MAX_STATES) {
        const cur = queue.shift()!;
        expect(WORD_TRAIN_PHASES).toContain(cur.phase);
        expect(canReachDeparting(cur)).toBe(true);

        const transitions: WordTrainState[] = [];
        for (let t = 0; t < cur.tiles.length; t++) {
          transitions.push(tapTile(cur, t).state);
          for (let slot = 0; slot < cur.slots.length; slot++) {
            transitions.push(placeTile(cur, t, slot).state);
          }
        }

        for (const next of transitions) {
          expect(WORD_TRAIN_PHASES).toContain(next.phase);
          if (next.mode !== 'spell') continue;
          // Monotonicity: a placed letter / filled slot is never removed.
          for (let i = 0; i < cur.slots.length; i++) {
            if (cur.slots[i] !== null) expect(next.slots[i]).toBe(cur.slots[i]);
          }
          for (let i = 0; i < cur.tiles.length; i++) {
            if (cur.tiles[i].placedAt !== null) {
              expect(next.tiles[i].placedAt).toBe(cur.tiles[i].placedAt);
            }
          }
          const key = spellStateKey(next);
          if (!visited.has(key)) {
            visited.set(key, next);
            queue.push(next);
          }
        }
      }

      expect(queue.length).toBe(0);
      expect(visited.size).toBeGreaterThan(2);
    }
  });

  it('[AC-04] random tap and place sequences never mutate input, throw, or leave WORD_TRAIN_PHASES', () => {
    const initialLoad = createLoadRound({ choices: ['apple', 'ball'], target: 'apple' });
    const snapLoad = structuredClone(initialLoad);
    pickObject(initialLoad, 'ball');
    expect(initialLoad).toEqual(snapLoad);

    const initialSpell = createSpellRound({ word: 'cup', letters: ['p', 'c', 'u', 'm'] });
    const snapSpell = structuredClone(initialSpell);
    placeTile(initialSpell, 0, 1);
    tapTile(initialSpell, 1);
    expect(initialSpell).toEqual(snapSpell);

    for (let seed = 1; seed <= 10; seed++) {
      const rand = createLcg(seed * 131);
      let state: WordTrainSpellState = createSpellRound({ word: 'book', letters: ['o', 'b', 'k', 'o', 't'] });
      for (let step = 0; step < 60; step++) {
        const tileIdx = Math.floor(rand() * state.tiles.length);
        const prevPlaced = state.tiles.filter((t) => t.placedAt !== null).length;
        const res =
          rand() < 0.5
            ? tapTile(state, tileIdx)
            : placeTile(state, tileIdx, Math.floor(rand() * state.slots.length));
        expect(WORD_TRAIN_PHASES).toContain(res.state.phase);
        if (res.state.mode === 'spell') {
          state = res.state;
          expect(state.tiles.filter((t) => t.placedAt !== null).length).toBeGreaterThanOrEqual(prevPlaced);
        }
      }
    }
  });
});

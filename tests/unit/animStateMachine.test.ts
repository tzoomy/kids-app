import { describe, it, expect } from 'vitest';
import { CharacterStateMachine, canTransition, TRANSITIONS, type CharacterState } from '../../src/anim/stateMachine';

describe('CharacterStateMachine', () => {
  it('starts hidden and runs the normal restaurant flow', () => {
    const sm = new CharacterStateMachine();
    expect(sm.state).toBe('hidden');
    const t1 = sm.request('enter');
    expect(t1).toBeGreaterThan(0);
    expect(sm.settle(t1)).toBe(true);
    expect(sm.state).toBe('idle');
    const t2 = sm.request('talking');
    expect(sm.settle(t2)).toBe(true);
    sm.request('munch');
    sm.request('happy');
    expect(sm.state).toBe('happy');
    sm.request('exit');
    expect(sm.request('gone')).toBeGreaterThan(0);
    expect(sm.state).toBe('gone');
  });

  it('does not let talking interrupt busy states (happy, munch)', () => {
    expect(canTransition('happy', 'talking')).toBe(false);
    expect(canTransition('munch', 'talking')).toBe(false);
    expect(canTransition('hmm', 'talking')).toBe(true);
    const sm = new CharacterStateMachine();
    sm.request('idle');
    sm.request('munch');
    expect(sm.request('talking')).toBe(-1);
    expect(sm.state).toBe('munch');
  });

  it('settle is ignored when a newer action superseded the token', () => {
    const sm = new CharacterStateMachine();
    sm.request('idle');
    const hmm = sm.request('hmm');
    const talk = sm.request('talking');
    expect(sm.settle(hmm)).toBe(false);
    expect(sm.state).toBe('talking');
    expect(sm.isCurrent(talk)).toBe(true);
  });

  it('exit and gone are terminal', () => {
    const sm = new CharacterStateMachine();
    sm.request('idle');
    sm.request('exit');
    for (const s of ['idle', 'talking', 'happy', 'munch', 'hmm', 'enter'] as CharacterState[]) {
      expect(sm.request(s)).toBe(-1);
    }
    expect(sm.settle(sm.token)).toBe(false);
    sm.request('gone');
    expect(TRANSITIONS.gone).toHaveLength(0);
  });

  it('every visible state can exit, and only hidden can enter', () => {
    for (const s of ['enter', 'idle', 'talking', 'happy', 'munch', 'hmm'] as CharacterState[]) {
      expect(canTransition(s, 'exit')).toBe(true);
    }
    const enterFrom = (Object.keys(TRANSITIONS) as CharacterState[]).filter((s) => canTransition(s, 'enter'));
    expect(enterFrom).toEqual(['hidden']);
  });

  it('notifies listeners and supports unsubscribe', () => {
    const sm = new CharacterStateMachine();
    const seen: string[] = [];
    const off = sm.onChange((to, from) => seen.push(`${from}->${to}`));
    sm.request('enter');
    off();
    sm.request('idle');
    expect(seen).toEqual(['hidden->enter']);
  });
});

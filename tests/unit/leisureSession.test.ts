import { describe, expect, it } from 'vitest';
import { LeisureSession } from '@/core/leisure';
import { defaultProfileState } from '@/core/storage/schema';

describe('LeisureSession', () => {
  it('redeems one balance second per real second while visible', () => {
    const state = defaultProfileState('2026-11-10');
    state.balanceSec = 10;
    const session = new LeisureSession(state, 5, true);
    session.tick(1);
    expect(state.balanceSec).toBe(9);
  });

  it('does not redeem while hidden', () => {
    const state = defaultProfileState('2026-11-10');
    state.balanceSec = 10;
    const session = new LeisureSession(state, 5, true);
    session.setHidden(true);
    session.tick(1);
    expect(state.balanceSec).toBe(10);
  });

  it('enters a grace period when balance reaches zero, then signals end once grace runs out', () => {
    const state = defaultProfileState('2026-11-10');
    state.balanceSec = 1;
    const session = new LeisureSession(state, 3, true);

    const first = session.tick(1); // spends last second, balance hits 0
    expect(state.balanceSec).toBe(0);
    expect(first.endedNow).toBe(false);
    expect(session.isInGrace).toBe(true);

    session.tick(1);
    session.tick(1);
    const last = session.tick(1); // grace of 3s consumed
    expect(last.endedNow).toBe(true);
    expect(session.isInGrace).toBe(false);
  });

  it('isolates balances across profiles — redeeming one never touches another', () => {
    const stateA = defaultProfileState('2026-11-10');
    const stateB = defaultProfileState('2026-11-10');
    stateA.balanceSec = 20;
    stateB.balanceSec = 20;
    const sessionA = new LeisureSession(stateA, 5, true);
    sessionA.tick(5);
    expect(stateA.balanceSec).toBe(15);
    expect(stateB.balanceSec).toBe(20);
  });
});

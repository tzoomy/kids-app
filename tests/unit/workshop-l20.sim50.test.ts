// Workshop L20 v5.1: the 50-run table with +-2 px jitter, matching workshop-v5-notes sim/results-v5.1.1-ts125.txt row by row
// (live physics config: timeScale 1.25 + the Phaser-plugin resolver pin; the world builds exactly that).
// Valid sets win 50/50, every listed wrong choice 0/50. The AC time = 1.5 x the sim p95 of the morning bell, rounded up to 0.5 s.
import { describe, expect, it } from 'vitest';
import MatterModule from 'phaser/src/physics/matter-js/CustomMain.js';
import type { L20Config } from '../../src/games/mysteryEgg/workshop/l20Level';
import { simulateL20, type L20Matter } from '../../src/games/mysteryEgg/workshop/l20World';

const Matter = MatterModule as unknown as L20Matter;
const N = 50;
const sol = (slots: number[]): L20Config => ({ ramp: 'down-right', slots, scissors: 'A' });

interface Row {
  wins: number;
  times: number[];
  reasons: Record<string, number>;
}
function table(config: L20Config): Row {
  const row: Row = { wins: 0, times: [], reasons: {} };
  for (let seed = 1; seed <= N; seed++) {
    const out = simulateL20(Matter, config, { seed, jitter: 2 });
    row.reasons[out.run.reason ?? '-'] = (row.reasons[out.run.reason ?? '-'] ?? 0) + 1;
    if (out.run.result === 'win') {
      row.wins++;
      row.times.push((out.events.find((e) => e.id === 'goal:morning')?.step ?? NaN) / 60);
    }
  }
  return row;
}
const pct = (xs: number[], p: number): number => [...xs].sort((a, b) => a - b)[Math.min(xs.length - 1, Math.floor(p * xs.length))];
const report: string[] = [];
const run = (name: string, config: L20Config, expectedWins: number): Row => {
  const row = table(config);
  const t = row.times.length ? `${pct(row.times, 0.5).toFixed(2)} / ${pct(row.times, 0.95).toFixed(2)} s` : '-';
  report.push(`${name.padEnd(34)} ${String(row.wins).padStart(2)}/${N}  median/p95 ${t}  ${JSON.stringify(row.reasons)}`);
  expect(row.wins, name).toBe(expectedWins);
  return row;
};

describe('workshop L20 v5.1: 50 jittered runs per row (timeScale 1.25, resolver pin)', () => {
  it('[AC-01] ramp down-right + {460,620} + scissors A: 50/50, the morning bell by the seesaw in about 6.2 s (sim 6.17 s)', () => {
    const row = run('{460,620} + A', sol([460, 620]), N);
    expect(pct(row.times, 0.5)).toBeGreaterThan(5.5);
    expect(pct(row.times, 0.5)).toBeLessThan(7);
    // AC time: 1.5 x p95 rounded up to 0.5 s.
    const budget = Math.ceil(pct(row.times, 0.95) * 1.5 * 2) / 2;
    expect(Math.max(...row.times)).toBeLessThanOrEqual(budget);
    expect(budget).toBeLessThanOrEqual(10.5);
  });

  it('[AC-01] ramp down-right + {500,620} + scissors A: 50/50 (sim 6.25 s)', () => {
    const row = run('{500,620} + A', sol([500, 620]), N);
    expect(pct(row.times, 0.5)).toBeLessThan(7);
  });

  const WRONG: Array<[string, L20Config]> = [
    ['scissors B', { ramp: 'down-right', slots: [460, 620], scissors: 'B' }],
    ['{460,500} + A', sol([460, 500])],
    ['{580,620} + A', sol([580, 620])],
    ['{500,580} + A', sol([500, 580])],
    ['{460,580} + A', sol([460, 580])],
    ['ramp down-left + {460,620} + A', { ramp: 'down-left', slots: [460, 620], scissors: 'A' }],
    ['no ramp + {460,620} + A', { ramp: 'none', slots: [460, 620], scissors: 'A' }],
    ['no scissors', { ramp: 'down-right', slots: [460, 620], scissors: 'none' }],
  ];
  for (const [name, config] of WRONG) {
    it(`[AC-02] ${name}: 0/50`, () => {
      run(name, config, 0);
    });
  }

  it('[AC-01] prints the table (for the PR)', () => {
    // eslint-disable-next-line no-console
    console.log(`\nL20 v5.1 50-run table (+-2 px)\n${report.join('\n')}`);
    expect(report.length).toBeGreaterThan(0);
  });
});

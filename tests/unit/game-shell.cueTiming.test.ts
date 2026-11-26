// Game shell slides: a slide clip's speech bubble stays up as long as the clip plays, and falls back to the old 1.8 s when
// there is no clip (docs/specs/game-shell.md AC-31). Pure timing logic over injected clock and scheduler.
import { describe, expect, it } from 'vitest';
import { CUE_FALLBACK_MS, cueRemainingMs, holdCueWhilePlaying } from '../../src/games/mysteryEgg/cueTiming';

function harness(chimed: boolean) {
  let t = 0;
  const log: string[] = [];
  const timers: { at: number; fn: () => void; live: boolean }[] = [];
  const deps = {
    now: () => t,
    chimed: () => chimed,
    schedule: (fn: () => void, ms: number) => {
      const timer = { at: t + ms, fn, live: true };
      timers.push(timer);
      return () => {
        timer.live = false;
      };
    },
    hide: () => log.push(`hide@${t}`),
  };
  const advance = async (ms: number) => {
    const to = t + ms;
    for (;;) {
      const next = timers.filter((x) => x.live && x.at <= to).sort((a, b) => a.at - b.at)[0];
      if (!next) break;
      t = next.at;
      next.live = false;
      next.fn();
    }
    t = to;
    await Promise.resolve();
    await Promise.resolve();
  };
  return { deps, log, advance };
}

describe('game-shell slide speech bubble timing', () => {
  it('[AC-31] the fallback is the old 1.8 s, and the remaining time after a clip settles follows the source', () => {
    expect(CUE_FALLBACK_MS).toBe(1800);
    expect(cueRemainingMs({ elapsedMs: 5000, chimed: false })).toBe(0);
    expect(cueRemainingMs({ elapsedMs: 600, chimed: false })).toBe(0);
    expect(cueRemainingMs({ elapsedMs: 0, chimed: true })).toBe(1800);
    expect(cueRemainingMs({ elapsedMs: 700, chimed: true })).toBe(1100);
    expect(cueRemainingMs({ elapsedMs: 4000, chimed: true })).toBe(0);
  });

  it('[AC-31] with a real clip the bubble hides when the clip ends (after 6.9 s, not after 1.8 s)', async () => {
    const h = harness(false);
    let end!: () => void;
    holdCueWhilePlaying(new Promise<void>((r) => (end = r)), h.deps);
    await h.advance(1800);
    await h.advance(3000);
    expect(h.log).toEqual([]);
    await h.advance(2100);
    end();
    await h.advance(0);
    expect(h.log).toEqual(['hide@6900']);
  });

  it('[AC-31] with no clip (missing file: a chime that settles at once) the bubble stays the old 1.8 s, no longer and no shorter', async () => {
    const h = harness(true);
    holdCueWhilePlaying(Promise.resolve(), h.deps);
    await h.advance(1799);
    expect(h.log).toEqual([]);
    await h.advance(2);
    expect(h.log).toEqual(['hide@1800']);
  });

  it('[AC-31] a tap that advances hides the bubble at once: the returned cancel stops the pending hide and hides nothing twice', async () => {
    const h = harness(false);
    let end!: () => void;
    const cancel = holdCueWhilePlaying(new Promise<void>((r) => (end = r)), h.deps);
    await h.advance(1000);
    cancel();
    end();
    await h.advance(5000);
    expect(h.log).toEqual([]);
  });

  it('[AC-31] a rejected clip counts as ended', async () => {
    const h = harness(false);
    holdCueWhilePlaying(Promise.reject(new Error('x')), h.deps);
    await h.advance(0);
    expect(h.log).toEqual(['hide@0']);
  });
});

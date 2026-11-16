// Balloon Pop floating stage (docs/specs/balloon-pop.md, "Floating stage"): cadence, motion and respawn (AC-18),
// hit areas (AC-19), difficulty mapping (AC-20). Pure module, no Phaser.
import { describe, expect, it } from 'vitest';
import { loadBalloonPop } from '@/content/loadContent';
import { BalloonPopContentSchema } from '@/content/schema';
import balloonJson from '@/content/games/balloon-pop.json';
import {
  MAX_FLOAT_SPEED,
  floatAlpha,
  floatArea,
  floatHitRect,
  floatSpeed,
  initialFloatBalloons,
  isFloatingTrial,
  pickFloatBalloon,
  stepFloat,
} from '@/games/balloon/balloonFloat';

const content = loadBalloonPop();
const cfg = content.floating!;
const SIZES = [
  [1280, 800],
  [800, 1280],
] as const;

function seeded(seed: number): () => number {
  let s = seed;
  return () => {
    s = (s * 9301 + 49297) % 233280;
    return s / 233280;
  };
}

describe('balloon-pop floating stage: cadence and motion (AC-18)', () => {
  it('[AC-18] content enables the floating stage on every 3rd trial of a visit', () => {
    expect(cfg.everyNthTrial).toBe(3);
    const floating = Array.from({ length: 9 }, (_, i) => isFloatingTrial(i + 1, cfg));
    expect(floating).toEqual([false, false, true, false, false, true, false, false, true]);
    expect(isFloatingTrial(1, { everyNthTrial: 1 })).toBe(true);
  });

  it('[AC-18] every balloon starts visible, below the HUD line and inside the screen', () => {
    for (const [w, h] of SIZES) {
      for (let n = 2; n <= 6; n++) {
        const balloons = initialFloatBalloons(w, h, n, seeded(n));
        const area = floatArea(w, h, balloons[0].ry);
        expect(balloons).toHaveLength(n);
        for (const b of balloons) {
          expect(b.y, `${w}x${h} n=${n}`).toBeGreaterThan(area.top);
          expect(b.y + b.ry * 0.6).toBeLessThanOrEqual(h + 0.001);
          expect(b.x - b.rx).toBeGreaterThanOrEqual(0);
          expect(b.x + b.rx).toBeLessThanOrEqual(w);
        }
        // Spread over the sky, not one shelf.
        const ys = balloons.map((b) => b.y);
        expect(new Set(ys.map((y) => Math.round(y))).size).toBe(n);
      }
    }
  });

  it('[AC-18] balloons rise slowly and sway inside their own lane', () => {
    const [w, h] = [800, 1280];
    const balloons = initialFloatBalloons(w, h, 4, seeded(3));
    const area = floatArea(w, h, balloons[0].ry);
    const before = balloons.map((b) => b.y);
    stepFloat(balloons, 50, 50, 40, area, cfg.swayPx);
    balloons.forEach((b, i) => {
      if (b.loops === 0) expect(before[i] - b.y).toBeCloseTo(2, 5); // 40 px/s * 0.05 s
    });
    const laneW = w / 4;
    for (let t = 0; t < 600; t++) {
      stepFloat(balloons, 16, t * 16, 40, area, cfg.swayPx);
      for (const b of balloons) {
        expect(Math.abs(b.x - b.laneX)).toBeLessThanOrEqual(Math.max(0, laneW / 2 - b.rx) + 1e-6);
      }
    }
  });

  it('[AC-18] a balloon that drifts past the top re-enters from the bottom at once (never escapes)', () => {
    const [w, h] = [800, 1280];
    const balloons = initialFloatBalloons(w, h, 3, seeded(9));
    const area = floatArea(w, h, balloons[0].ry);
    // Two minutes of play at the fastest allowed speed: always 3 balloons, always on screen.
    for (let t = 0; t < 120_000; t += 16) {
      stepFloat(balloons, 16, t, MAX_FLOAT_SPEED, area, cfg.swayPx);
      expect(balloons).toHaveLength(3);
      for (const b of balloons) {
        expect(b.y).toBeGreaterThanOrEqual(area.top);
        expect(b.y - b.ry).toBeLessThan(h); // some of the body is always in view
      }
    }
    expect(balloons.every((b) => b.loops > 0)).toBe(true);
  });

  it('[AC-18] a balloon fades out just before it loops, and is fully opaque in the open sky', () => {
    const area = floatArea(800, 1280, 60);
    expect(floatAlpha({ y: area.top + 500, ry: 60 }, area)).toBe(1);
    expect(floatAlpha({ y: area.top + 36, ry: 60 }, area)).toBeCloseTo(0.5, 5);
    expect(floatAlpha({ y: area.top, ry: 60 }, area)).toBe(0);
    // A freshly respawned balloon is opaque.
    expect(floatAlpha({ y: area.spawnY, ry: 60 }, area)).toBe(1);
  });

  it('[AC-18] a long frame (background tab) cannot teleport a balloon', () => {
    const balloons = initialFloatBalloons(800, 1280, 2, seeded(1));
    const area = floatArea(800, 1280, balloons[0].ry);
    const y0 = balloons.map((b) => b.y);
    stepFloat(balloons, 60_000, 0, 40, area, 0);
    balloons.forEach((b, i) => expect(y0[i] - b.y).toBeLessThanOrEqual(4 + 1e-6));
  });

  it('[AC-18] no fail state: the stage has no timer or miss limit in content', () => {
    const keys = Object.keys(cfg).sort();
    expect(keys).toEqual(['everyNthTrial', 'hitScale', 'minHitCssPx', 'speed', 'speedStepPerLevel', 'swayPx']);
  });
});

describe('balloon-pop floating stage: hit areas (AC-19)', () => {
  it('[AC-19] the hit area is at least 1.5x the drawn body and at least the minimum side', () => {
    expect(cfg.hitScale).toBeGreaterThanOrEqual(1.5);
    expect(cfg.minHitCssPx).toBeGreaterThanOrEqual(64);
    const b = { x: 400, y: 600, rx: 50, ry: 61 };
    const r = floatHitRect(b, cfg.hitScale, 0);
    expect(r.right - r.left).toBeGreaterThanOrEqual(2 * b.rx * 1.5);
    expect(r.bottom - r.top).toBeGreaterThanOrEqual(2 * b.ry * 1.5);
    // A tiny balloon still gets the minimum side.
    const small = floatHitRect({ x: 0, y: 0, rx: 10, ry: 12 }, 1.5, 140);
    expect(small.right - small.left).toBeGreaterThanOrEqual(140);
    expect(small.bottom - small.top).toBeGreaterThanOrEqual(140);
    // A content value below 1.5 is never used.
    const forced = floatHitRect(b, 1, 0);
    expect(forced.right - forced.left).toBeGreaterThanOrEqual(150);
  });

  it('[AC-19] on a 360 CSS px wide portrait phone every hit side is >= 64 CSS px for 2-6 balloons', () => {
    const gamePxPerCss = 800 / 360;
    for (let n = 2; n <= 6; n++) {
      for (const b of initialFloatBalloons(800, 1280, n, seeded(n))) {
        const r = floatHitRect(b, cfg.hitScale, cfg.minHitCssPx * gamePxPerCss);
        expect((r.right - r.left) / gamePxPerCss).toBeGreaterThanOrEqual(64 - 1e-9);
        expect((r.bottom - r.top) / gamePxPerCss).toBeGreaterThanOrEqual(64 - 1e-9);
      }
    }
  });

  it('[AC-19] a tap goes to the nearest balloon whose hit area holds it, and outside all of them to none', () => {
    const balloons = [
      { x: 100, y: 500, rx: 50, ry: 61 },
      { x: 220, y: 500, rx: 50, ry: 61 },
    ];
    // Inside both (overlapping generous areas): nearest centre wins.
    expect(pickFloatBalloon(balloons, 150, 500, 1.5, 0)).toBe(0);
    expect(pickFloatBalloon(balloons, 175, 500, 1.5, 0)).toBe(1);
    // Outside the body but inside the 1.5x area still counts.
    expect(pickFloatBalloon(balloons, 100, 500 - 61 * 1.4, 1.5, 0)).toBe(0);
    expect(pickFloatBalloon(balloons, 600, 100, 1.5, 0)).toBe(-1);
  });
});

describe('balloon-pop floating stage: difficulty mapping (AC-20)', () => {
  const tracks = content.adaptive.tracks;

  it('[AC-20] speed rises with the level inside each track; age 2 at its first level is the slowest', () => {
    const all: number[] = [];
    for (const age of ['age2', 'age5'] as const) {
      const { min, max } = tracks[age];
      let prev = 0;
      for (let level = min; level <= max; level++) {
        const v = floatSpeed(cfg, age, level, min);
        expect(v).toBeGreaterThan(prev);
        expect(v).toBeLessThanOrEqual(MAX_FLOAT_SPEED);
        prev = v;
        all.push(v);
      }
    }
    expect(Math.min(...all)).toBe(floatSpeed(cfg, 'age2', tracks.age2.min, tracks.age2.min));
    expect(floatSpeed(cfg, 'age2', tracks.age2.max, tracks.age2.min)).toBeLessThan(floatSpeed(cfg, 'age5', tracks.age5.max, tracks.age5.min));
  });

  it('[AC-20] the slowest case takes at least 15 s to cross the portrait sky (slow for a 2-year-old)', () => {
    const v = floatSpeed(cfg, 'age2', tracks.age2.min, tracks.age2.min);
    const area = floatArea(800, 1280, 60);
    expect((area.spawnY - area.top) / v).toBeGreaterThanOrEqual(15);
  });

  it('[AC-20] speed is clamped even for a far-off level, and the balloon count is the level choiceCount', () => {
    expect(floatSpeed(cfg, 'age5', 500, tracks.age5.min)).toBe(MAX_FLOAT_SPEED);
    for (const level of content.adaptive.levels) {
      expect(initialFloatBalloons(800, 1280, level.choiceCount ?? 2)).toHaveLength(level.choiceCount ?? 2);
    }
  });

  it('[AC-20] the schema rejects an age-2 speed faster than age 5 or a hit scale under 1.5', () => {
    const bad = (patch: Record<string, unknown>) =>
      BalloonPopContentSchema.safeParse({ ...balloonJson, floating: { ...balloonJson.floating, ...patch } }).success;
    expect(bad({})).toBe(true);
    expect(bad({ speed: { age2: 80, age5: 60 } })).toBe(false);
    expect(bad({ hitScale: 1.2 })).toBe(false);
    expect(bad({ minHitCssPx: 40 })).toBe(false);
  });
});

// Game shell map rules (docs/specs/game-shell.md): the map-phase tap guard and the non-stacking wiggle. Pure modules only.
import { describe, expect, it } from 'vitest';
import { WiggleGuard, mapTapAllowed, worldTapAllowed } from '../../src/games/mysteryEgg/mapRules';
import { backButtonPlacement, backButtonPlacementForView, BACK_BUTTON_CSS_PX } from '../../src/games/mysteryEgg/backButton';
import { facingFor, friendRoute, polylineLength, pointAtDistance } from '../../src/games/mysteryEgg/walk';
import { FRIEND_HOMES, MAP_FRIENDS, WORLDS } from '../../src/games/mysteryEgg/worlds';
import type { EggPhase } from '../../src/games/mysteryEgg/types';

describe('game-shell map tap guard', () => {
  it('[AC-20] a world tap (open or closed) is only allowed on a live, ready map in phase `map`', () => {
    const phases: EggPhase[] = ['hub', 'intro', 'map', 'walking', 'entry', 'build', 'success'];
    for (const phase of phases) {
      expect(worldTapAllowed({ alive: true, ready: true, phase }), phase).toBe(phase === 'map');
    }
    expect(worldTapAllowed({ alive: false, ready: true, phase: 'map' })).toBe(false);
    expect(worldTapAllowed({ alive: true, ready: false, phase: 'map' })).toBe(false);
  });

  it('[AC-30] friend, nest and world taps share one guard: all of them count only on a live, ready map in phase `map`', () => {
    const phases: EggPhase[] = ['hub', 'intro', 'map', 'walking', 'entry', 'build', 'success'];
    for (const phase of phases) {
      expect(mapTapAllowed({ alive: true, ready: true, phase }), phase).toBe(phase === 'map');
      expect(mapTapAllowed({ alive: true, ready: true, phase }), phase).toBe(worldTapAllowed({ alive: true, ready: true, phase }));
    }
    expect(mapTapAllowed({ alive: false, ready: true, phase: 'map' })).toBe(false);
    expect(mapTapAllowed({ alive: true, ready: false, phase: 'map' })).toBe(false);
  });
});

interface FakeTween {
  stopped: boolean;
  stop(): void;
}

describe('game-shell wiggle guard', () => {
  const setup = () => {
    const target = { angle: 0 };
    const log: string[] = [];
    const guard = new WiggleGuard<{ angle: number }>((t) => {
      t.angle = 0;
      log.push('restore');
    });
    const tweens: FakeTween[] = [];
    const run = () => {
      const tween: FakeTween = { stopped: false, stop() { this.stopped = true; } };
      tweens.push(tween);
      log.push('start');
      return tween;
    };
    return { target, log, guard, tweens, run };
  };

  it('[AC-19] a second tap stops the running wiggle and restores the rest angle before it starts the new one', () => {
    const { target, log, guard, tweens, run } = setup();
    guard.start(target, run);
    target.angle = 4; // mid-wiggle
    guard.start(target, run);
    expect(tweens[0].stopped).toBe(true);
    expect(tweens[1].stopped).toBe(false);
    expect(log).toEqual(['restore', 'start', 'restore', 'start']);
    expect(target.angle).toBe(0);
  });

  it('[AC-19] many quick taps leave exactly one running wiggle; finishing it clears the guard', () => {
    const { target, guard, tweens, run } = setup();
    for (let i = 0; i < 6; i++) guard.start(target, run);
    expect(tweens.filter((t) => !t.stopped)).toHaveLength(1);
    expect(guard.isRunning(target)).toBe(true);
    guard.finish(target);
    expect(guard.isRunning(target)).toBe(false);
  });

  it('[AC-19] wiggles of different targets do not stop each other', () => {
    const a = { angle: 0 };
    const b = { angle: 0 };
    const guard = new WiggleGuard<{ angle: number }>((t) => { t.angle = 0; });
    const tweens: FakeTween[] = [];
    const run = () => {
      const tween: FakeTween = { stopped: false, stop() { this.stopped = true; } };
      tweens.push(tween);
      return tween;
    };
    guard.start(a, run);
    guard.start(b, run);
    expect(tweens.map((t) => t.stopped)).toEqual([false, false]);
  });
});

describe('game-shell friend facing', () => {
  it('[AC-21] a walking friend faces its heading (left flips, right and up or down keep the current side)', () => {
    expect(facingFor({ moving: true, angle: 0, current: 1 })).toBe(1);
    expect(facingFor({ moving: true, angle: Math.PI, current: 1 })).toBe(-1);
    expect(facingFor({ moving: true, angle: Math.PI * 0.9, current: 1 })).toBe(-1);
    // Walking straight up or down does not flip the friend back and forth.
    expect(facingFor({ moving: true, angle: -Math.PI / 2, current: -1 })).toBe(-1);
    expect(facingFor({ moving: true, angle: Math.PI / 2, current: 1 })).toBe(1);
    expect(facingFor({ moving: true, angle: 0.1, current: -1 })).toBe(1);
  });

  it('[AC-21] a friend that is not walking always faces the default side again, whatever it did before', () => {
    expect(facingFor({ moving: false, angle: Math.PI, current: -1 })).toBe(1);
    expect(facingFor({ moving: false, angle: 0, current: -1 })).toBe(1);
    expect(facingFor({ moving: false, angle: Math.PI, current: 1 })).toBe(1);
  });

  it('[AC-21] the walks to the left-hand worlds do flip a friend on the way, so the reset on arrival matters', () => {
    const w = WORLDS.find((x) => x.id === 'workshop');
    if (!w) throw new Error('no workshop');
    let facing: 1 | -1 = 1;
    let flipped = false;
    const route = friendRoute(FRIEND_HOMES[MAP_FRIENDS[0]], w);
    for (let d = 0; d <= polylineLength(route); d += 4) {
      facing = facingFor({ moving: true, angle: pointAtDistance(route, d).angle, current: facing });
      if (facing === -1) flipped = true;
    }
    expect(flipped).toBe(true);
    expect(facingFor({ moving: false, angle: 0, current: facing })).toBe(1);
  });
});

describe('game-shell back button', () => {
  const css = (gw: number, gh: number, r = 1) => {
    const zoom = Math.min(gw / 1280, gh / 800);
    const b = backButtonPlacement({ gameWidth: gw, gameHeight: gh, zoom, cssPerGamePx: r });
    const scale = zoom * r;
    const left = (640 - gw / (2 * zoom)) ;
    const top = (400 - gh / (2 * zoom));
    return { b, size: b.size * scale, x: (b.x - b.size / 2 - left) * scale, y: (b.y - b.size / 2 - top) * scale };
  };

  it('[AC-22] on the 1280x800 landscape board the button is where it always was: 96 px at (70, 70)', () => {
    expect(backButtonPlacement({ gameWidth: 1280, gameHeight: 800, zoom: 1, cssPerGamePx: 1 })).toEqual({ x: 70, y: 70, size: 96 });
  });

  it('[AC-22] the button is at least 96 CSS px in landscape, portrait and odd tablets, and sits inside the visible canvas corner', () => {
    expect(BACK_BUTTON_CSS_PX).toBe(96);
    for (const [gw, gh, r] of [[800, 1280, 1], [800, 1280, 0.9], [1280, 800, 1], [1366, 768, 1], [1920, 1200, 0.667], [600, 1024, 1]] as const) {
      const c = css(gw, gh, r);
      expect(c.size, `${gw}x${gh}`).toBeGreaterThanOrEqual(96 - 0.01);
      expect(c.x, `${gw}x${gh}`).toBeGreaterThanOrEqual(16);
      expect(c.y, `${gw}x${gh}`).toBeGreaterThanOrEqual(16);
    }
  });

  it('[AC-22] in portrait the board is scaled down by 0.625, so the button grows by the inverse to stay 96 CSS px', () => {
    const c = css(800, 1280);
    expect(c.b.size).toBeCloseTo(96 / 0.625, 5);
    expect(c.size).toBeCloseTo(96, 5);
  });
});

describe('game-shell back button on rotate', () => {
  /** The button in page CSS px for a canvas of `gw x gh` game px shown `cssW` CSS px wide (FIT: the same aspect ratio). */
  const shown = (gw: number, gh: number, cssW: number) => {
    const b = backButtonPlacementForView({ gameWidth: gw, gameHeight: gh, canvasCssWidth: cssW });
    const zoom = Math.min(gw / 1280, gh / 800);
    const k = zoom * (cssW / gw); // CSS px per board px
    const left = 640 - gw / (2 * zoom);
    const top = 400 - gh / (2 * zoom);
    return { b, size: b.size * k, x: (b.x - b.size / 2 - left) * k, y: (b.y - b.size / 2 - top) * k, canvasH: (cssW / gw) * gh };
  };

  it('[AC-28] a landscape game (1280x800) rotated into an 800x1280 window is drawn 800 CSS px wide: the button must be re-placed to stay 96 CSS px and in the corner', () => {
    const rotated = shown(1280, 800, 800);
    expect(rotated.size).toBeCloseTo(96, 3);
    expect(rotated.x).toBeGreaterThanOrEqual(16);
    expect(rotated.y).toBeGreaterThanOrEqual(16);
    // The creation-time placement of the landscape view (what the scene used to keep) would be 60 CSS px here.
    const stale = backButtonPlacement({ gameWidth: 1280, gameHeight: 800, zoom: 1, cssPerGamePx: 1 });
    expect(stale.size * (800 / 1280)).toBeLessThan(96 - 30);
  });

  it('[AC-28] a portrait game (800x1280) rotated into a 1280x800 window is drawn 500 CSS px wide: 96 CSS px, inside the canvas corner', () => {
    const rotated = shown(800, 1280, 500);
    expect(rotated.size).toBeCloseTo(96, 3);
    expect(rotated.x).toBeGreaterThanOrEqual(16);
    expect(rotated.y).toBeGreaterThanOrEqual(16);
    expect(rotated.x + rotated.size).toBeLessThanOrEqual(500);
    expect(rotated.y + rotated.size).toBeLessThanOrEqual(800);
  });

  it('[AC-28] the view-based placement equals the explicit one for the unrotated views, and an unmeasured canvas (width 0) falls back to 1 CSS px per game px', () => {
    expect(backButtonPlacementForView({ gameWidth: 1280, gameHeight: 800, canvasCssWidth: 1280 })).toEqual({ x: 70, y: 70, size: 96 });
    expect(backButtonPlacementForView({ gameWidth: 800, gameHeight: 1280, canvasCssWidth: 800 })).toEqual(
      backButtonPlacement({ gameWidth: 800, gameHeight: 1280, zoom: 0.625, cssPerGamePx: 1 }),
    );
    expect(backButtonPlacementForView({ gameWidth: 1280, gameHeight: 800, canvasCssWidth: 0 })).toEqual({ x: 70, y: 70, size: 96 });
  });
});

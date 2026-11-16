import { test, expect, type Page, type TestInfo } from '@playwright/test';
import { GAME_SCENE, getStableBox, tapTestId, tapWorldBuilding, waitForScene, type PageRect } from './helpers/journey';

// Regression spec for the game HUD top bar + prompt bubble on a PHONE in portrait (portrait-phone audit, items C1, H3, M3).
// Bug: on 360x800 / 412x915 the top bar (`.shell-top-bar`: back, `.shell-progress` min(50vw,320px), `.shell-row` with stars,
// timer and help; flex-wrap) wraps to two rows, so (M3) the help pill drops below the others and overlaps the top of the game
// canvas, (C1) the fixed prompt bubble (`#prompt-bubble`, top assumes a single-row bar, later in the DOM so on top) covers
// `hud-help` (Picnic Train: only ~15% of help is tappable) and the bottom of `hud-back`, and (H3) the bubble IS the "replay
// voice" tap target but a one-line bubble is only ~28 px tall and overlaps help/back.
// Out of scope here: the Phaser speaker button inside the playfield (M1), Sticker Board, Colouring, map, wardrobe, picker cards.
//
// Target behaviour asserted below (per game, per phone viewport):
//   1. The top bar is a single row: back, stars, timer, help (and the progress bar) share one row; the bar is not taller than a control.
//   2. `hud-back`, `hud-help` and `prompt-bubble` are fully tappable (document.elementFromPoint hits the control or a descendant
//      at its centre and near its 4 corners).
//   3. Sizes: back and help >= 64x64 CSS px; the prompt bubble (the replay control) >= 48 px tall and >= 48 px wide.
//   4. The prompt bubble overlaps no top-bar control and does not intrude into the top 25% of the game canvas; every control is
//      inside the viewport.
// The landscape tablet layout (1280x800) must stay unchanged: a guard pins its single row, sizes, bubble offset and progress width.
//
// Rules (docs/PROCESS.md section 4): every test enters through the real map building and the real picker card (real taps via the
// journey helpers; no goToScreen). Hooks only read state (active scenes, building hit rectangle). Geometry assertions are
// `expect.soft`, so one run reports every violation of every game; hard expects stay only where later code depends on them.
// No screenshots: everything is asserted from DOM geometry. Taps are mouse clicks like the other journey specs.
//
// Orientation gating (@single-orientation): the phone viewports override the project viewport, so each phone test would run
// twice. They run in the portrait project only; the landscape guard runs in the landscape project only.
//
// Games with no prompt bubble at their default level: none expected (the audit lists a bubble in all 8). If a game does not show
// one within the wait, `prompt bubble shown` fails softly and the bar checks still run.

const PORTRAIT_PROJECT = 'portrait-800x1280';
const LANDSCAPE_PROJECT = 'landscape-1280x800';
const MIN_TAP = 64;
const MIN_BUBBLE = 48;
const CANVAS_BAND = 0.25; // top share of the game canvas the bubble must stay out of
const BAR_HEIGHT_SLACK = 4; // px: bar may be at most this much taller than its tallest control
const OVERLAP_TOLERANCE = 0.5; // px, sub-pixel layout rounding
const GEOMETRY_TOLERANCE = 2; // px, landscape pin

const PHONE_VIEWPORTS = [
  { width: 360, height: 800 },
  { width: 412, height: 915 },
] as const;

interface GameEntry {
  gameId: string;
  worldId: string;
  name: string;
}

const GAMES: readonly GameEntry[] = [
  { gameId: 'picnic-train', worldId: 'number-garden', name: 'Picnic Train' }, // Hebrew prompt wraps to 2 lines: the worst case
  { gameId: 'sorting-beds', worldId: 'number-garden', name: 'Sorting Beds' },
  { gameId: 'who-lives-here', worldId: 'nature-lab', name: 'Who Lives Here' },
  { gameId: 'who-is-hiding', worldId: 'nature-lab', name: 'Who Is Hiding' },
  { gameId: 'animal-restaurant', worldId: 'language-house', name: 'Animal Restaurant' },
  { gameId: 'balloon-pop', worldId: 'number-garden', name: 'Balloon Pop' },
  { gameId: 'shadow-match', worldId: 'nature-lab', name: 'Shadow Match' },
  { gameId: 'kitchen-orchestra', worldId: 'language-house', name: 'Kitchen Orchestra' },
];

function onlyProject(testInfo: TestInfo, projectName: string): void {
  if (testInfo.project.name !== projectName) test.skip();
}

const fmt = (r: PageRect | null): string =>
  r ? `[x ${r.x.toFixed(1)}, y ${r.y.toFixed(1)}, w ${r.width.toFixed(1)}, h ${r.height.toFixed(1)}]` : '[absent]';

const overlaps = (a: PageRect, b: PageRect): boolean =>
  a.x < b.x + b.width - OVERLAP_TOLERANCE &&
  b.x < a.x + a.width - OVERLAP_TOLERANCE &&
  a.y < b.y + b.height - OVERLAP_TOLERANCE &&
  b.y < a.y + a.height - OVERLAP_TOLERANCE;

/** Real taps: map building -> picker/trail card (scrolled into view first: the portrait trail may scroll) -> game scene. */
async function enterGameByTap(page: Page, game: GameEntry): Promise<void> {
  await tapWorldBuilding(page, 'profile-a', game.worldId);
  const card = page.locator(`[data-testid="game-picker-${game.gameId}"]`);
  await card.waitFor({ state: 'visible', timeout: 10_000 });
  await card.scrollIntoViewIfNeeded();
  await tapTestId(page, `game-picker-${game.gameId}`);
  await waitForScene(page, GAME_SCENE[game.gameId]);
}

interface TapProbe {
  /** Points whose topmost element is neither the control nor one of its descendants, with what was hit instead. */
  misses: string[];
  /** Points that were probed (centre + 4 inset corners). */
  probed: number;
}

/**
 * `document.elementFromPoint` at the centre and at the 4 corners of a control. Corners are inset by 4 px plus the part of the
 * corner radius that cuts the box (r * (1 - 1/sqrt 2)), because Chrome hit-tests rounded corners: a point at 4 px from the
 * corner of a 20 px-radius pill is outside the pill even though it is inside its bounding box.
 */
async function probeTaps(page: Page, testId: string): Promise<TapProbe> {
  return page.evaluate((id) => {
    const target = document.querySelector<HTMLElement>(`[data-testid="${id}"]`);
    if (!target) return { misses: [`${id}: element not found`], probed: 0 };
    const r = target.getBoundingClientRect();
    const radius = Math.min(parseFloat(getComputedStyle(target).borderTopLeftRadius) || 0, r.width / 2, r.height / 2);
    const inset = Math.min(4 + radius * (1 - Math.SQRT1_2), r.width / 2 - 0.5, r.height / 2 - 0.5);
    const points: [string, number, number][] = [
      ['centre', r.left + r.width / 2, r.top + r.height / 2],
      ['top-left', r.left + inset, r.top + inset],
      ['top-right', r.right - inset, r.top + inset],
      ['bottom-left', r.left + inset, r.bottom - inset],
      ['bottom-right', r.right - inset, r.bottom - inset],
    ];
    const describe = (n: Element | null): string => {
      if (!n) return 'nothing (point outside the viewport)';
      const testid = (n as HTMLElement).dataset?.testid;
      return `<${n.tagName.toLowerCase()}${n.id ? `#${n.id}` : ''}${n.className && typeof n.className === 'string' ? `.${n.className.trim().split(/\s+/).join('.')}` : ''}${testid ? ` data-testid=${testid}` : ''}>`;
    };
    const misses: string[] = [];
    for (const [name, x, y] of points) {
      const hit = document.elementFromPoint(x, y);
      if (!hit || (hit !== target && !target.contains(hit))) misses.push(`${name} (${x.toFixed(1)}, ${y.toFixed(1)}) hits ${describe(hit)}`);
    }
    return { misses, probed: points.length };
  }, testId);
}

async function maybeBox(page: Page, selector: string): Promise<PageRect | null> {
  const loc = page.locator(selector).first();
  if ((await loc.count()) === 0 || !(await loc.isVisible())) return null;
  return loc.boundingBox();
}

interface Measured {
  back: PageRect;
  help: PageRect;
  stars: PageRect;
  balance: PageRect;
  progress: PageRect | null;
  bar: PageRect | null;
  bubble: PageRect | null;
  canvas: PageRect | null;
}

/** Waits for the HUD and (when it shows) the prompt bubble to settle, then reads every box once. */
async function measure(page: Page, label: string): Promise<Measured> {
  // Hard: later code depends on these. Each also waits until the element is visible and has stopped moving.
  const back = await getStableBox(page, 'hud-back');
  const help = await getStableBox(page, 'hud-help');
  const stars = await getStableBox(page, 'star-count');
  const balance = await getStableBox(page, 'leisure-balance');
  let bubble: PageRect | null = null;
  try {
    bubble = await getStableBox(page, 'prompt-bubble', 15_000);
  } catch {
    // reported by the caller as a soft failure; the bar checks still run
  }
  // Re-read the bubble last: the text can change after the first stable read (the prompt is set when the round starts).
  if (bubble) bubble = await maybeBox(page, '[data-testid="prompt-bubble"]');
  const progress = await maybeBox(page, '.shell-progress');
  const bar = await maybeBox(page, '.shell-top-bar');
  const canvas = await maybeBox(page, '#game-root canvas');
  expect(canvas, `${label}: game canvas present`).not.toBeNull();
  return { back, help, stars, balance, progress, bar, bubble, canvas };
}

function controlsOf(m: Measured): [string, PageRect][] {
  const list: [string, PageRect][] = [
    ['hud-back', m.back],
    ['star-count', m.stars],
    ['leisure-balance', m.balance],
    ['hud-help', m.help],
  ];
  if (m.progress) list.push(['.shell-progress', m.progress]);
  return list;
}

const boxesText = (m: Measured): string =>
  [...controlsOf(m), ['.shell-top-bar', m.bar] as [string, PageRect | null], ['prompt-bubble', m.bubble] as [string, PageRect | null], ['canvas', m.canvas] as [string, PageRect | null]]
    .map(([n, b]) => `${n} ${fmt(b)}`)
    .join('; ');

/** Assertions 1-3 and the bubble/controls overlap of assertion 4: shared by the phone matrix and the landscape guard. */
async function assertTopBar(page: Page, label: string, m: Measured, opts: { viewportWidth: number; viewportHeight: number; bubbleMinSize: boolean }): Promise<void> {
  const ctx = boxesText(m);
  const controls = controlsOf(m);

  // 1) One row: every control's vertical span overlaps every other's (max top < min bottom); the bar is no taller than a control.
  const maxTop = Math.max(...controls.map(([, b]) => b.y));
  const minBottom = Math.min(...controls.map(([, b]) => b.y + b.height));
  expect.soft(maxTop, `${label}: top bar is ONE row (max control top ${maxTop.toFixed(1)} < min control bottom ${minBottom.toFixed(1)}): ${ctx}`).toBeLessThan(minBottom);
  expect(m.bar, `${label}: .shell-top-bar present`).not.toBeNull();
  const tallest = Math.max(...controls.map(([, b]) => b.height));
  expect.soft(m.bar!.height, `${label}: .shell-top-bar height ${m.bar!.height.toFixed(1)} <= tallest control ${tallest.toFixed(1)} + ${BAR_HEIGHT_SLACK}: ${ctx}`).toBeLessThanOrEqual(tallest + BAR_HEIGHT_SLACK);

  // Every control stays inside the viewport.
  for (const [name, b] of controls) {
    expect.soft(b.x, `${label}: ${name} left edge inside viewport: ${ctx}`).toBeGreaterThanOrEqual(0);
    expect.soft(b.x + b.width, `${label}: ${name} right edge inside viewport ${opts.viewportWidth}: ${ctx}`).toBeLessThanOrEqual(opts.viewportWidth + OVERLAP_TOLERANCE);
    expect.soft(b.y, `${label}: ${name} top edge inside viewport: ${ctx}`).toBeGreaterThanOrEqual(0);
    expect.soft(b.y + b.height, `${label}: ${name} bottom edge inside viewport ${opts.viewportHeight}: ${ctx}`).toBeLessThanOrEqual(opts.viewportHeight + OVERLAP_TOLERANCE);
  }

  // 3) Sizes.
  for (const [name, b] of [['hud-back', m.back], ['hud-help', m.help]] as const) {
    expect.soft(b.width, `${label}: ${name} width >= ${MIN_TAP}: ${ctx}`).toBeGreaterThanOrEqual(MIN_TAP);
    expect.soft(b.height, `${label}: ${name} height >= ${MIN_TAP}: ${ctx}`).toBeGreaterThanOrEqual(MIN_TAP);
  }
  expect.soft(m.bubble !== null, `${label}: prompt bubble shown: ${ctx}`).toBe(true);
  if (m.bubble && opts.bubbleMinSize) {
    expect.soft(m.bubble.height, `${label}: prompt-bubble (replay control) height >= ${MIN_BUBBLE}: ${ctx}`).toBeGreaterThanOrEqual(MIN_BUBBLE);
    expect.soft(m.bubble.width, `${label}: prompt-bubble (replay control) width >= ${MIN_BUBBLE}: ${ctx}`).toBeGreaterThanOrEqual(MIN_BUBBLE);
  }
  if (m.bubble) {
    expect.soft(m.bubble.x, `${label}: prompt-bubble left edge inside viewport: ${ctx}`).toBeGreaterThanOrEqual(0);
    expect.soft(m.bubble.x + m.bubble.width, `${label}: prompt-bubble right edge inside viewport ${opts.viewportWidth}: ${ctx}`).toBeLessThanOrEqual(opts.viewportWidth + OVERLAP_TOLERANCE);
  }

  // 4a) The bubble overlaps no top-bar control.
  if (m.bubble) {
    for (const [name, b] of controls) {
      expect.soft(overlaps(m.bubble, b), `${label}: prompt-bubble overlaps ${name}: ${ctx}`).toBe(false);
    }
  }

  // 2) Tappability: back, help and the bubble answer taps at the centre and near the corners.
  const tapTargets = ['hud-back', 'hud-help', ...(m.bubble ? ['prompt-bubble'] : [])];
  for (const id of tapTargets) {
    const probe = await probeTaps(page, id);
    expect.soft(probe.misses, `${label}: ${id} fully tappable (${probe.probed} points probed), misses: ${probe.misses.join(' | ') || 'none'}; ${ctx}`).toEqual([]);
  }
}

for (const viewport of PHONE_VIEWPORTS) {
  test.describe(`game top bar and prompt bubble on a phone in portrait ${viewport.width}x${viewport.height} @single-orientation`, () => {
    test.use({ viewport });

    for (const game of GAMES) {
      test(`${game.name}: one-row top bar, tappable 64 px back/help, tappable prompt bubble that covers neither the bar nor the playfield top`, async ({ page }, testInfo) => {
        onlyProject(testInfo, PORTRAIT_PROJECT);
        test.setTimeout(60_000);
        await enterGameByTap(page, game);
        const label = `${game.name} @${viewport.width}x${viewport.height}`;
        const m = await measure(page, label);
        await assertTopBar(page, label, m, { viewportWidth: viewport.width, viewportHeight: viewport.height, bubbleMinSize: true });

        // 4b) The bubble stays out of the top 25% band of the playfield (game canvas).
        if (m.bubble && m.canvas) {
          const band: PageRect = { x: m.canvas.x, y: m.canvas.y, width: m.canvas.width, height: CANVAS_BAND * m.canvas.height };
          expect.soft(overlaps(m.bubble, band), `${label}: prompt-bubble ${fmt(m.bubble)} intrudes into the top ${CANVAS_BAND * 100}% of the canvas ${fmt(band)}`).toBe(false);
        }
      });
    }
  });
}

test.describe('game top bar and prompt bubble in landscape 1280x800 stay unchanged @single-orientation', () => {
  test.use({ viewport: { width: 1280, height: 800 } });

  // Guard, not RED: these pass on main. Pins the tablet layout so the portrait fix cannot move it.
  for (const game of GAMES.filter((g) => g.gameId === 'picnic-train' || g.gameId === 'sorting-beds')) {
    test(`${game.name}: single-row bar, tappable 64 px controls, bubble clear of the bar, bubble offset and progress width as before`, async ({ page }, testInfo) => {
      onlyProject(testInfo, LANDSCAPE_PROJECT);
      test.setTimeout(60_000);
      await enterGameByTap(page, game);
      const label = `${game.name} @1280x800`;
      const m = await measure(page, label);
      await assertTopBar(page, label, m, { viewportWidth: 1280, viewportHeight: 800, bubbleMinSize: false }); // landscape: bubble size is not pinned (about 49 px today)

      // Current desktop formula (shell.css): bubble top = max(1.5vmin, safe-area) + 64px + 1.2vmin, vmin = 8 px at 1280x800.
      const vmin = 8;
      const expectedTop = Math.max(1.5 * vmin, 0) + 64 + 1.2 * vmin;
      expect(m.bubble, `${label}: prompt bubble shown`).not.toBeNull();
      expect.soft(Math.abs(m.bubble!.y - expectedTop), `${label}: prompt-bubble top ${m.bubble!.y.toFixed(1)} vs ${expectedTop.toFixed(1)} (+-${GEOMETRY_TOLERANCE})`).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
      // .shell-progress width is min(50vw, 320px) = 320 at 1280.
      expect(m.progress, `${label}: .shell-progress shown`).not.toBeNull();
      expect.soft(Math.abs(m.progress!.width - Math.min(0.5 * 1280, 320)), `${label}: .shell-progress width ${m.progress!.width.toFixed(1)} vs 320 (+-${GEOMETRY_TOLERANCE})`).toBeLessThanOrEqual(GEOMETRY_TOLERANCE);
    });
  }
});

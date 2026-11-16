// Geometry checks for the absolutely positioned DOM chrome of Sticker Board and Colouring Time
// (portrait audit 2026-11-16, H1/H2; src/ui/phoneChromeLayout.ts).
// Not a test file. Everything is read from the DOM: no screenshots, no hooks that act.
import { expect, type Page } from '@playwright/test';

export interface Rect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface ControlProbe {
  id: string;
  /** Rendered box (getBoundingClientRect, includes the selected-swatch scale). */
  rect: Rect;
  /** Untransformed layout box: layer box + offsetLeft/Top/Width/Height. */
  layout: Rect;
  /** Probe point label → testid of the element `document.elementFromPoint` returned there ('' = none, or not inside this control). */
  misses: Array<{ point: string; got: string }>;
}

/** Sub-pixel layout rounding. */
export const TOLERANCE = 1;

/**
 * Probes every visible control matching `selector` inside `layerSelector`: its boxes, and `elementFromPoint` at the
 * centre, at the four points 25 % in from each edge (on the centre lines) and at the four points 25 % in from both
 * edges. A probe point only passes when the hit element is the control itself or inside it.
 */
export async function probeControls(page: Page, layerSelector: string, selector: string): Promise<ControlProbe[]> {
  return page.evaluate(
    ([layerSel, sel]) => {
      const layer = document.querySelector(layerSel) as HTMLElement | null;
      if (!layer) return [];
      const lb = layer.getBoundingClientRect();
      const nodes = Array.from(layer.querySelectorAll<HTMLElement>(sel)).filter((n) => {
        const b = n.getBoundingClientRect();
        return b.width > 0 && b.height > 0 && getComputedStyle(n).visibility !== 'hidden';
      });
      return nodes.map((n) => {
        const b = n.getBoundingClientRect();
        const pts: Record<string, [number, number]> = {
          centre: [0.5, 0.5],
          'left-25': [0.25, 0.5],
          'right-25': [0.75, 0.5],
          'top-25': [0.5, 0.25],
          'bottom-25': [0.5, 0.75],
          'top-left-25': [0.25, 0.25],
          'top-right-25': [0.75, 0.25],
          'bottom-left-25': [0.25, 0.75],
          'bottom-right-25': [0.75, 0.75],
        };
        const misses: Array<{ point: string; got: string }> = [];
        for (const [label, [fx, fy]] of Object.entries(pts)) {
          const hit = document.elementFromPoint(b.left + b.width * fx, b.top + b.height * fy);
          if (!hit || !(hit === n || n.contains(hit))) {
            const owner = hit?.closest('[data-testid]') as HTMLElement | null;
            misses.push({ point: label, got: owner?.dataset.testid ?? hit?.tagName ?? '' });
          }
        }
        return {
          id: n.dataset.testid ?? n.className,
          rect: { x: b.x, y: b.y, width: b.width, height: b.height },
          layout: { x: lb.left + n.offsetLeft, y: lb.top + n.offsetTop, width: n.offsetWidth, height: n.offsetHeight },
          misses,
        };
      });
    },
    [layerSelector, selector] as const,
  );
}

export const intersects = (a: Rect, b: Rect): boolean =>
  a.x < b.x + b.width - TOLERANCE && b.x < a.x + a.width - TOLERANCE && a.y < b.y + b.height - TOLERANCE && b.y < a.y + a.height - TOLERANCE;

export const fmt = (r: Rect): string => `[x ${r.x.toFixed(1)}, y ${r.y.toFixed(1)}, w ${r.width.toFixed(1)}, h ${r.height.toFixed(1)}]`;

/** Polls until two consecutive probes report the same layout boxes (rotation, art load and pop-ins have settled). */
export async function probeStable(page: Page, layerSelector: string, selector: string, expectedCount: number): Promise<ControlProbe[]> {
  let previous = '';
  let probes: ControlProbe[] = [];
  await expect
    .poll(
      async () => {
        probes = await probeControls(page, layerSelector, selector);
        const key = JSON.stringify(probes.map((p) => [p.id, Math.round(p.layout.x), Math.round(p.layout.y), Math.round(p.layout.width)]));
        const settled = probes.length === expectedCount && key === previous;
        previous = key;
        return settled;
      },
      { timeout: 15_000, intervals: [250] },
    )
    .toBe(true);
  return probes;
}

/**
 * The regression contract: every control is fully hittable at its centre and 25 % points, lies inside the viewport,
 * no two controls intersect, none covers the drawing surface (`surface`, unless listed in `mayCoverSurface`), and each
 * is at least `minSize` CSS px. Soft assertions, so one run reports every violation.
 */
export function expectHittableChrome(
  probes: readonly ControlProbe[],
  viewport: { width: number; height: number },
  opts: { minSize: number; surface?: Rect; mayCoverSurface?: readonly string[] },
): void {
  for (const p of probes) {
    expect.soft(p.misses, `${p.id} ${fmt(p.rect)}: elementFromPoint hit another element`).toEqual([]);
    expect.soft(p.rect.x, `${p.id} ${fmt(p.rect)} left edge off-screen`).toBeGreaterThanOrEqual(-TOLERANCE);
    expect.soft(p.rect.y, `${p.id} ${fmt(p.rect)} top edge off-screen`).toBeGreaterThanOrEqual(-TOLERANCE);
    expect.soft(p.rect.x + p.rect.width, `${p.id} ${fmt(p.rect)} right edge off-screen (viewport ${viewport.width})`).toBeLessThanOrEqual(viewport.width + TOLERANCE);
    expect.soft(p.rect.y + p.rect.height, `${p.id} ${fmt(p.rect)} bottom edge off-screen (viewport ${viewport.height})`).toBeLessThanOrEqual(viewport.height + TOLERANCE);
    expect.soft(Math.min(p.layout.width, p.layout.height), `${p.id} ${fmt(p.layout)} smaller than ${opts.minSize} px`).toBeGreaterThanOrEqual(opts.minSize - TOLERANCE);
    if (opts.surface && !opts.mayCoverSurface?.includes(p.id)) {
      expect.soft(intersects(p.rect, opts.surface), `${p.id} ${fmt(p.rect)} covers the drawing surface ${fmt(opts.surface)}`).toBe(false);
    }
  }
  for (let i = 0; i < probes.length; i++) {
    for (let j = i + 1; j < probes.length; j++) {
      const a = probes[i];
      const b = probes[j];
      expect.soft(intersects(a.rect, b.rect), `${a.id} ${fmt(a.rect)} intersects ${b.id} ${fmt(b.rect)}`).toBe(false);
    }
  }
}

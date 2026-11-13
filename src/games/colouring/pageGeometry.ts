// Colouring Time page geometry: parses a page SVG into per-region Path2D + painted bounding boxes (viewBox units),
// and resolves taps with Path2D.isPointInPath. DOM-dependent (needs a canvas 2D context); no Phaser.
import {
  hitTest,
  path2dContains,
  type ColouringAgeTrack,
  type ColouringRegionDef,
} from './regions';

export const VIEWBOX = 800;

export interface VuRect {
  x: number;
  y: number;
  width: number;
  height: number;
}

export interface PageGeometry {
  paths: Map<string, Path2D>;
  bboxes: Map<string, VuRect>;
}

/** Parses the page SVG text. Region bounding boxes are measured with getBBox in a hidden, detached-from-layout host. */
export function parsePageSvg(svgText: string, regionIds: readonly string[]): PageGeometry {
  const paths = new Map<string, Path2D>();
  const bboxes = new Map<string, VuRect>();
  const host = document.createElement('div');
  host.style.cssText = 'position:absolute;left:-9999px;top:0;width:0;height:0;overflow:hidden;visibility:hidden';
  host.innerHTML = svgText;
  document.body.appendChild(host);
  try {
    for (const id of regionIds) {
      const node = host.querySelector<SVGPathElement>(`path[id="${id}"]`);
      const d = node?.getAttribute('d');
      if (!node || !d) continue;
      paths.set(id, new Path2D(d));
      const b = node.getBBox();
      bboxes.set(id, { x: b.x, y: b.y, width: b.width, height: b.height });
    }
  } finally {
    host.remove();
  }
  return { paths, bboxes };
}

export interface PageTester {
  /** Resolves a tap in viewBox units, or null for a no-op. */
  resolve(x: number, y: number, snapRadiusVu: number): string | null;
  contains(regionId: string, x: number, y: number): boolean;
}

export function createPageTester(
  geometry: PageGeometry,
  regions: ColouringRegionDef[],
  ageTrack: ColouringAgeTrack,
): PageTester {
  const ctx = document.createElement('canvas').getContext('2d');
  if (!ctx) throw new Error('2D canvas context unavailable');
  const contains = (id: string, x: number, y: number): boolean => {
    const path = geometry.paths.get(id);
    return path ? path2dContains(ctx, path, x, y) : false;
  };
  /** Distance to the path edge, found by bisecting the stroke width; Infinity beyond maxRadius. */
  const distance = (id: string, x: number, y: number, maxRadius: number): number => {
    const path = geometry.paths.get(id);
    if (!path) return Infinity;
    ctx.lineWidth = 2 * maxRadius;
    if (!ctx.isPointInStroke(path, x, y)) return Infinity;
    let lo = 0;
    let hi = maxRadius;
    for (let i = 0; i < 8; i++) {
      const mid = (lo + hi) / 2;
      ctx.lineWidth = 2 * mid;
      if (ctx.isPointInStroke(path, x, y)) hi = mid;
      else lo = mid;
    }
    return hi;
  };
  return {
    contains,
    resolve(x, y, snapRadiusVu) {
      return hitTest(x, y, {
        regions,
        ageTrack,
        contains,
        snapRadiusVu,
        distance: (id, px, py) => distance(id, px, py, snapRadiusVu),
      });
    },
  };
}

/**
 * Picks a point inside the region's own path that taps resolve back to this region (no snapping),
 * preferring one whose neighbours also resolve to it, then the one nearest the bounding-box centre.
 */
export function chooseTapPoint(regionId: string, bbox: VuRect, tester: PageTester): { x: number; y: number } {
  const steps = 24;
  const probe = 5;
  const cx = bbox.x + bbox.width / 2;
  const cy = bbox.y + bbox.height / 2;
  let best: { x: number; y: number } | null = null;
  let bestScore = -1;
  let bestDist = Infinity;
  for (let i = 0; i <= steps; i++) {
    for (let j = 0; j <= steps; j++) {
      const x = bbox.x + (bbox.width * i) / steps;
      const y = bbox.y + (bbox.height * j) / steps;
      if (tester.resolve(x, y, 0) !== regionId) continue;
      let score = 0;
      for (const [dx, dy] of [[-1, 0], [1, 0], [0, -1], [0, 1], [-1, -1], [1, 1], [-1, 1], [1, -1]]) {
        if (tester.resolve(x + dx * probe, y + dy * probe, 0) === regionId) score++;
      }
      const dist = Math.hypot(x - cx, y - cy);
      if (score > bestScore || (score === bestScore && dist < bestDist)) {
        best = { x, y };
        bestScore = score;
        bestDist = dist;
      }
    }
  }
  return best ?? { x: cx, y: cy };
}

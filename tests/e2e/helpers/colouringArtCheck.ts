// Chromium geometry checks for Colouring Time pages (PR #49 review M6). Each page is rendered
// at 800x800, so 1 CSS px = 1 viewBox unit. Region masks come from Path2D fills (alpha >= 128),
// the outline mask from the real `outlines` group drawn as an image. No new dependencies.
import type { Page } from '@playwright/test';
import type { ColouringRegionSpec } from '../../shared/leisureColouringPages';

export interface ArtLimits { coarseDiscMin: number; fineDiscMin: number; outlineHalf: number; seamTolerance: number }

export interface RegionReport {
  id: string;
  age2: boolean;
  parent?: string;
  /** Painted pixel count (nonzero rule). */
  area: number;
  /** |nonzero - evenodd| pixel count: > 0 means a bow-tie, a hole, or an overlapping subpath. */
  windingDiff: number;
  /** Diameter of the largest disc inside the visible area minus half the outline, per track (null if not hit-testable). */
  discAge2: number | null;
  discAge5: number;
  /** Fine regions only: pixels farther than seamTolerance outside the parent. */
  outsideParent: number;
  /** Disc-centre tap point per track and whether the topmost-containing rule (AC-29 step 1) resolves it to this region. */
  tapAge2: { x: number; y: number; resolves: boolean } | null;
  tapAge5: { x: number; y: number; resolves: boolean };
}

export interface PageReport {
  missing: string[];
  regions: RegionReport[];
  /** Enclosed pixels that are neither fill nor outline, as components larger than 4 px. */
  gaps: Array<{ size: number; x: number; y: number }>;
  /** Region-boundary pixels with no outline pixel within seamTolerance. */
  seamMisses: number;
  seamSample: Array<[number, number]>;
  /** Outline pixels farther than 20 units from every hit-testable region, per track (a tap there would be a dead no-op). */
  orphanOutlineAge2: number;
  orphanOutlineAge5: number;
  /** A page corner farther than 20 units from every region resolves to nothing (AC-29 step 3). */
  farCornerNoop: boolean;
  idMapAge2: string;
  idMapAge5: string;
}

export async function analyseColouringPage(page: Page, svg: string, regions: ColouringRegionSpec[], limits: ArtLimits): Promise<PageReport> {
  await page.setContent('<!doctype html><html><body style="margin:0"></body></html>');
  return page.evaluate(async ({ svg, regions, limits }) => {
    const N = 800;
    const doc = new DOMParser().parseFromString(svg, 'image/svg+xml');
    const fills = doc.getElementById('fills');
    const dById = new Map<string, string>();
    for (const el of Array.from(fills?.children ?? [])) dById.set(el.getAttribute('id') ?? '', el.getAttribute('d') ?? '');
    const missing = regions.filter((r) => !dById.has(r.id)).map((r) => r.id);

    const canvas = document.createElement('canvas');
    canvas.width = N; canvas.height = N;
    const ctx = canvas.getContext('2d', { willReadFrequently: true })!;
    const readMask = (): Uint8Array => {
      const a = ctx.getImageData(0, 0, N, N).data;
      const m = new Uint8Array(N * N);
      for (let i = 0; i < N * N; i++) m[i] = a[i * 4 + 3] >= 128 ? 1 : 0;
      return m;
    };
    const pathMask = (d: string, rule: CanvasFillRule): Uint8Array => {
      ctx.clearRect(0, 0, N, N);
      ctx.fillStyle = '#000';
      if (d) ctx.fill(new Path2D(d), rule);
      return readMask();
    };
    const count = (m: Uint8Array) => { let c = 0; for (let i = 0; i < m.length; i++) c += m[i]; return c; };

    // Squared Euclidean distance transform (Felzenszwalb-Huttenlocher), distance to nearest "seed".
    const edt = (seed: Uint8Array): Float32Array => {
      const INF = 1e12;
      const g = new Float32Array(N * N);
      for (let i = 0; i < N * N; i++) g[i] = seed[i] ? 0 : INF;
      const f = new Float64Array(N), d = new Float64Array(N), z = new Float64Array(N + 1);
      const v = new Int32Array(N);
      const pass = (get: (k: number) => number, set: (k: number, val: number) => void) => {
        for (let q = 0; q < N; q++) f[q] = get(q);
        let k = 0; v[0] = 0; z[0] = -INF; z[1] = INF;
        for (let q = 1; q < N; q++) {
          let s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]);
          while (s <= z[k]) { k--; s = ((f[q] + q * q) - (f[v[k]] + v[k] * v[k])) / (2 * q - 2 * v[k]); }
          k++; v[k] = q; z[k] = s; z[k + 1] = INF;
        }
        k = 0;
        for (let q = 0; q < N; q++) { while (z[k + 1] < q) k++; d[q] = (q - v[k]) * (q - v[k]) + f[v[k]]; }
        for (let q = 0; q < N; q++) set(q, d[q]);
      };
      for (let x = 0; x < N; x++) pass((q) => g[q * N + x], (q, val) => { g[q * N + x] = val; });
      for (let y = 0; y < N; y++) pass((q) => g[y * N + q], (q, val) => { g[y * N + q] = val; });
      return g;
    };

    const masks = regions.map((r) => pathMask(dById.get(r.id) ?? '', 'nonzero'));
    const windingDiff = regions.map((r, i) => Math.abs(count(masks[i]) - count(pathMask(dById.get(r.id) ?? '', 'evenodd'))));

    // Outline mask: the real outlines group, drawn as an image.
    const outlinesEl = doc.getElementById('outlines');
    const outlineSvg = `<svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">${outlinesEl ? new XMLSerializer().serializeToString(outlinesEl) : ''}</svg>`;
    const img = new Image();
    img.src = `data:image/svg+xml;charset=utf-8,${encodeURIComponent(outlineSvg)}`;
    await img.decode();
    ctx.clearRect(0, 0, N, N);
    ctx.drawImage(img, 0, 0, N, N);
    const outline = readMask();

    const idMap = (age2Only: boolean): Int16Array => {
      const m = new Int16Array(N * N).fill(-1);
      regions.forEach((r, i) => {
        if (age2Only && !r.age2) return;
        const mk = masks[i];
        for (let p = 0; p < N * N; p++) if (mk[p]) m[p] = i;
      });
      return m;
    };
    const map2 = idMap(true), map5 = idMap(false);

    const disc = (map: Int16Array, i: number): { d: number; x: number; y: number } => {
      const seed = new Uint8Array(N * N);
      let any = false;
      for (let p = 0; p < N * N; p++) { if (map[p] === i) any = true; else seed[p] = 1; }
      if (!any) return { d: 0, x: -1, y: -1 };
      const dist = edt(seed);
      let best = 0, at = 0;
      for (let p = 0; p < N * N; p++) if (map[p] === i && dist[p] > best) { best = dist[p]; at = p; }
      return { d: Math.max(0, 2 * (Math.sqrt(best) - limits.outlineHalf)), x: at % N + 0.5, y: Math.floor(at / N) + 0.5 };
    };
    // AC-29 step 1 with real geometry: topmost hit-testable path containing the point (nonzero).
    const paths = regions.map((r) => new Path2D(dById.get(r.id) ?? ''));
    const resolve = (x: number, y: number, age2Only: boolean): number => {
      for (let k = regions.length - 1; k >= 0; k--) {
        if (age2Only && !regions[k].age2) continue;
        if (ctx.isPointInPath(paths[k], x, y, 'nonzero')) return k;
      }
      return -1;
    };

    const reports = regions.map((r, i) => {
      let outsideParent = 0;
      if (r.parent) {
        const pi = regions.findIndex((x) => x.id === r.parent);
        if (pi >= 0) {
          const dist = edt(masks[pi]);
          const t2 = limits.seamTolerance * limits.seamTolerance;
          for (let p = 0; p < N * N; p++) if (masks[i][p] && dist[p] > t2) outsideParent++;
        }
      }
      const d2 = r.age2 ? disc(map2, i) : null;
      const d5 = disc(map5, i);
      return {
        id: r.id, age2: r.age2, parent: r.parent, area: count(masks[i]), windingDiff: windingDiff[i],
        discAge2: d2 ? Math.round(d2.d) : null, discAge5: Math.round(d5.d), outsideParent,
        tapAge2: d2 ? { x: d2.x, y: d2.y, resolves: resolve(d2.x, d2.y, true) === i } : null,
        tapAge5: { x: d5.x, y: d5.y, resolves: resolve(d5.x, d5.y, false) === i },
      };
    });

    // Gaps: flood the background from the border through pixels that are neither fill nor outline.
    const solid = new Uint8Array(N * N);
    for (let p = 0; p < N * N; p++) solid[p] = outline[p] || map5[p] >= 0 ? 1 : 0;
    const seen = new Uint8Array(N * N);
    const flood = (start: number): number => {
      const stack = [start]; seen[start] = 1; let size = 0;
      while (stack.length) {
        const p = stack.pop()!; size++;
        const x = p % N, y = (p / N) | 0;
        const nb = [x > 0 ? p - 1 : -1, x < N - 1 ? p + 1 : -1, y > 0 ? p - N : -1, y < N - 1 ? p + N : -1];
        for (const q of nb) if (q >= 0 && !seen[q] && !solid[q]) { seen[q] = 1; stack.push(q); }
      }
      return size;
    };
    for (let k = 0; k < N; k++) for (const p of [k, (N - 1) * N + k, k * N, k * N + N - 1]) if (!solid[p] && !seen[p]) flood(p);
    const gaps: Array<{ size: number; x: number; y: number }> = [];
    for (let p = 0; p < N * N; p++) if (!solid[p] && !seen[p]) { const size = flood(p); if (size > 4) gaps.push({ size, x: p % N, y: (p / N) | 0 }); }

    // Seams: every pixel where the visible (age-5) region id changes needs an outline pixel nearby.
    const toOutline = edt(outline);
    const t2 = limits.seamTolerance * limits.seamTolerance;
    let seamMisses = 0;
    const seamSample: Array<[number, number]> = [];
    for (let y = 0; y < N - 1; y++) for (let x = 0; x < N - 1; x++) {
      const p = y * N + x;
      if ((map5[p] !== map5[p + 1] || map5[p] !== map5[p + N]) && toOutline[p] > t2) {
        seamMisses++;
        if (seamSample.length < 8) seamSample.push([x, y]);
      }
    }

    // Snap reach (AC-29 step 2): every outline pixel should be within 20 units of a hit-testable region.
    const orphans = (map: Int16Array): { n: number; dist: Float32Array } => {
      const seed = new Uint8Array(N * N);
      for (let p = 0; p < N * N; p++) seed[p] = map[p] >= 0 ? 1 : 0;
      const dist = edt(seed);
      let n = 0;
      for (let p = 0; p < N * N; p++) if (outline[p] && dist[p] > 400) n++;
      return { n, dist };
    };
    const o2 = orphans(map2), o5 = orphans(map5);
    const corners = [[2, 2], [797, 2], [2, 797], [797, 797]];
    const farCornerNoop = corners.some(([x, y]) => o5.dist[y * N + x] > 400 && resolve(x + 0.5, y + 0.5, false) === -1);

    const png = (map: Int16Array): string => {
      const im = ctx.createImageData(N, N);
      for (let p = 0; p < N * N; p++) {
        const i = map[p];
        const o = p * 4;
        if (outline[p]) { im.data[o] = 59; im.data[o + 1] = 42; im.data[o + 2] = 34; }
        else if (i < 0) { im.data[o] = im.data[o + 1] = im.data[o + 2] = 255; }
        else { const h = (i * 137.508) % 360; const c = `hsl(${h},70%,${regions[i].age2 ? 70 : 52}%)`; ctx.fillStyle = c; const m = /#(..)(..)(..)/.exec(ctx.fillStyle as string)!; im.data[o] = parseInt(m[1], 16); im.data[o + 1] = parseInt(m[2], 16); im.data[o + 2] = parseInt(m[3], 16); }
        im.data[o + 3] = 255;
      }
      ctx.putImageData(im, 0, 0);
      return canvas.toDataURL('image/png');
    };

    return { missing, regions: reports, gaps, seamMisses, seamSample, orphanOutlineAge2: o2.n, orphanOutlineAge5: o5.n, farCornerNoop, idMapAge2: png(map2), idMapAge5: png(map5) };
  }, { svg, regions, limits });
}

/** Human-readable contract failures for one page report (empty = pass). */
export function artFailures(r: PageReport, limits: ArtLimits, tol = { seam: 12, winding: 12, outside: 12 }): string[] {
  const out: string[] = [];
  for (const id of r.missing) out.push(`${id}: missing`);
  for (const g of r.regions) {
    if (g.windingDiff > tol.winding) out.push(`${g.id}: self-intersection/hole (${g.windingDiff} px differ nonzero vs evenodd)`);
    if (g.discAge2 !== null && g.discAge2 < limits.coarseDiscMin) out.push(`${g.id}: age-2 visible disc ${g.discAge2} < ${limits.coarseDiscMin}`);
    if (g.discAge5 < limits.fineDiscMin) out.push(`${g.id}: age-5 visible disc ${g.discAge5} < ${limits.fineDiscMin}`);
    if (g.tapAge2 && !g.tapAge2.resolves) out.push(`${g.id}: age-2 tap at (${g.tapAge2.x},${g.tapAge2.y}) does not resolve to it`);
    if (!g.tapAge5.resolves) out.push(`${g.id}: age-5 tap at (${g.tapAge5.x},${g.tapAge5.y}) does not resolve to it`);
    if (g.outsideParent > tol.outside) out.push(`${g.id}: ${g.outsideParent} px outside parent ${g.parent}`);
  }
  for (const g of r.gaps) out.push(`gap: ${g.size} px enclosed, unpainted, unoutlined near (${g.x},${g.y})`);
  if (r.orphanOutlineAge2 > tol.seam) out.push(`outline: ${r.orphanOutlineAge2} px more than 20 units from any age-2 region`);
  if (r.orphanOutlineAge5 > tol.seam) out.push(`outline: ${r.orphanOutlineAge5} px more than 20 units from any region`);
  if (!r.farCornerNoop) out.push('no page corner is a far no-op (leave a margin of more than 20 units somewhere)');
  if (r.seamMisses > tol.seam) out.push(`seams: ${r.seamMisses} boundary px without an outline within tolerance, e.g. ${JSON.stringify(r.seamSample)}`);
  return out;
}

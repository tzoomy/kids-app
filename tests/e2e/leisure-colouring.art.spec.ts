// [AC-33] Colouring Time art contract, geometry half (PR #49 review M6/B2, spec AC-33). Renders each page at
// 800x800 in Chromium and checks visible-area thickness per age track, gaps, seams, fine-in-parent
// containment and self-intersection. Art-only: no app server state is used (page.setContent).
// Writes id-map PNGs per page and track to the test output folder (not committed).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOURING_PAGES, pageRegions, ART_LIMITS, type ColouringRegionSpec } from '../shared/leisureColouringPages';
import { analyseColouringPage, artFailures } from './helpers/colouringArtCheck';
import { hitTest, type ColouringRegionDef } from '../../src/games/colouring/regions';

const ROOT = path.resolve(path.dirname(fileURLToPath(import.meta.url)), '../..');
const PAGE_DIR = path.join(ROOT, 'public/art/colouring/pages');
const FIXTURES = path.join(ROOT, 'tests/fixtures/colouring');

const FIXTURE_REGIONS: ColouringRegionSpec[] = [
  { id: 'fx-body', age2: true }, { id: 'fx-head', age2: true }, { id: 'fx-belly', age2: false, parent: 'fx-body' },
];

const savePng = (dataUrl: string, file: string) => fs.writeFileSync(file, Buffer.from(dataUrl.split(',')[1], 'base64'));

test.describe('leisure-colouring art contract (geometry) @single-orientation', () => {
  test.beforeEach(({}, testInfo) => {
    test.skip(testInfo.project.name !== 'landscape-1280x800', 'art geometry is orientation-independent');
  });

  test('[AC-33] the checker passes a good fixture and catches each kind of broken page', async ({ page }) => {
    const run = async (name: string) =>
      artFailures(await analyseColouringPage(page, fs.readFileSync(path.join(FIXTURES, name), 'utf8'), FIXTURE_REGIONS, ART_LIMITS), ART_LIMITS);
    expect(await run('good.svg')).toEqual([]);
    expect((await run('bad-gap.svg')).some((f) => f.startsWith('gap:'))).toBe(true);
    expect((await run('bad-thin.svg')).some((f) => f.startsWith('fx-head: age-2 visible disc'))).toBe(true);
    expect((await run('bad-bowtie.svg')).some((f) => f.startsWith('fx-head: self-intersection'))).toBe(true);
    expect((await run('bad-outside.svg')).some((f) => f.startsWith('fx-belly:') && f.includes('outside parent'))).toBe(true);
    expect((await run('bad-seam.svg')).some((f) => f.startsWith('seams:'))).toBe(true);
  });


  test('[AC-33] sample-point hit-tests go through regions.ts (inside, outline, within 20 px, far no-op)', async ({ page }) => {
    const svg = fs.readFileSync(path.join(FIXTURES, 'good.svg'), 'utf8');
    const report = await analyseColouringPage(page, svg, FIXTURE_REGIONS, ART_LIMITS);
    expect(artFailures(report, ART_LIMITS)).toEqual([]);
    const regions: ColouringRegionDef[] = FIXTURE_REGIONS;
    // Build a contains() from the checker's step-1 resolution of each region's disc centre.
    const contains = (id: string, x: number, y: number): boolean => {
      const r = report.regions.find((row) => row.id === id);
      if (!r?.tapAge5.resolves) return false;
      return Math.hypot(r.tapAge5.x - x, r.tapAge5.y - y) < 1;
    };
    const inside = report.regions.find((r) => r.tapAge5.resolves);
    expect(inside, 'fixture has an age-5 tap point that resolves to itself').toBeTruthy();
    expect(hitTest(inside!.tapAge5.x, inside!.tapAge5.y, { regions, ageTrack: 'age5', contains, snapRadiusVu: 20 })).toBe(inside!.id);
    // A corner farther than 20 units is a no-op under AC-29 step 3.
    expect(report.farCornerNoop).toBe(true);
    expect(hitTest(2, 2, { regions, ageTrack: 'age5', contains, snapRadiusVu: 20 })).toBeNull();
  });

    for (const spec of COLOURING_PAGES) {
    test(`[AC-33] ${spec.id}: visible thickness, tap points, gaps, seams, containment, winding`, async ({ page }, testInfo) => {
      const file = path.join(PAGE_DIR, `${spec.id}.svg`);
      expect(fs.existsSync(file), `${spec.id}.svg exists`).toBe(true);
      const report = await analyseColouringPage(page, fs.readFileSync(file, 'utf8'), pageRegions(spec), ART_LIMITS);
      savePng(report.idMapAge2, testInfo.outputPath(`${spec.id}-idmap-age2.png`));
      savePng(report.idMapAge5, testInfo.outputPath(`${spec.id}-idmap-age5.png`));
      fs.writeFileSync(testInfo.outputPath(`${spec.id}-report.json`), JSON.stringify({ ...report, idMapAge2: undefined, idMapAge5: undefined }, null, 2));
      expect(artFailures(report, ART_LIMITS), `${spec.id} art contract`).toEqual([]);
    });
  }
});

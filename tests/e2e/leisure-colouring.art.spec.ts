// [AC-26] Colouring Time art contract, geometry half (PR #49 review M6/B2). Renders each page at
// 800x800 in Chromium and checks visible-area thickness per age track, gaps, seams, fine-in-parent
// containment and self-intersection. Art-only: no app server state is used (page.setContent).
// Writes id-map PNGs per page and track to the test output folder (not committed).
import { test, expect } from '@playwright/test';
import fs from 'node:fs';
import path from 'node:path';
import { fileURLToPath } from 'node:url';
import { COLOURING_PAGES, pageRegions, ART_LIMITS, type ColouringRegionSpec } from '../shared/leisureColouringPages';
import { analyseColouringPage, artFailures } from './helpers/colouringArtCheck';

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

  test('[AC-26] the checker passes a good fixture and catches each kind of broken page', async ({ page }) => {
    const run = async (name: string) =>
      artFailures(await analyseColouringPage(page, fs.readFileSync(path.join(FIXTURES, name), 'utf8'), FIXTURE_REGIONS, ART_LIMITS), ART_LIMITS);
    expect(await run('good.svg')).toEqual([]);
    expect((await run('bad-gap.svg')).some((f) => f.startsWith('gap:'))).toBe(true);
    expect((await run('bad-thin.svg')).some((f) => f.startsWith('fx-head: age-2 visible disc'))).toBe(true);
    expect((await run('bad-bowtie.svg')).some((f) => f.startsWith('fx-head: self-intersection'))).toBe(true);
    expect((await run('bad-outside.svg')).some((f) => f.startsWith('fx-belly:') && f.includes('outside parent'))).toBe(true);
    expect((await run('bad-seam.svg')).some((f) => f.startsWith('seams:'))).toBe(true);
  });

  for (const spec of COLOURING_PAGES) {
    test(`[AC-26] ${spec.id}: visible thickness, gaps, seams, containment, winding`, async ({ page }, testInfo) => {
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

// Workshop level 20 "Bonjour, Ville des Surprises !" (docs/specs/workshop-l20.md). Real pointer drags and taps only; the
// ?e2e=1 hooks only READ state (getMysteryEggInfo -> WorkshopL20Info, getSpokenLines, getActiveScenes). The level is entered by
// the preview route `?level=20` (no map building exists for it yet).
import { test, expect, type Page } from '@playwright/test';
import type { WorkshopL20Info } from '../../src/games/mysteryEgg/types';
import { getActiveScenes, getSpokenLines, waitForScene } from './helpers/journey';

const LANDSCAPE = 'landscape-1280x800';
type Rect = { x: number; y: number; width: number; height: number };
const centre = (r: Rect) => ({ x: r.x + r.width / 2, y: r.y + r.height / 2 });

function landscapeOnly(testInfo: { project: { name: string } }): void {
  if (testInfo.project.name !== LANDSCAPE) test.skip();
}

async function info(page: Page): Promise<WorkshopL20Info | null> {
  return page.evaluate(() => {
    const hooks = (window as unknown as { __testHooks__?: { getMysteryEggInfo: () => unknown } }).__testHooks__;
    const i = hooks?.getMysteryEggInfo() as { scene?: string } | null;
    return (i && i.scene === 'WorkshopL20Scene' ? i : null) as never;
  });
}

async function waitInfo(page: Page, check: (i: WorkshopL20Info) => boolean, message: string, timeout = 40_000): Promise<WorkshopL20Info> {
  const deadline = Date.now() + timeout;
  let last: WorkshopL20Info | null = null;
  for (;;) {
    last = await info(page);
    if (last && check(last)) return last;
    if (Date.now() > deadline) throw new Error(`${message}; last: ${JSON.stringify(last && { phase: last.phase, run: last.run, events: last.events.map((e) => e.id), config: last.config })}`);
    await page.waitForTimeout(100);
  }
}

async function openL20(page: Page): Promise<WorkshopL20Info> {
  await page.goto('./?level=20&e2e=1');
  await waitForScene(page, 'WorkshopL20Scene');
  return waitInfo(page, (i) => i.ready && Boolean(i.rects.playBtn) && Boolean(i.rects.partRamp), 'L20 never became ready');
}

/** A real pointer drag between two page points. */
async function drag(page: Page, from: { x: number; y: number }, to: { x: number; y: number }): Promise<void> {
  await page.mouse.move(from.x, from.y);
  await page.mouse.down();
  await page.mouse.move((from.x + to.x) / 2, (from.y + to.y) / 2, { steps: 6 });
  await page.mouse.move(to.x, to.y, { steps: 8 });
  await page.mouse.up();
}

type PartId = 'ramp' | 'domino1' | 'domino2' | 'scissors';
const PART_RECT = { ramp: 'partRamp', domino1: 'partDomino1', domino2: 'partDomino2', scissors: 'partScissors' } as const;

/** Drags a part from where it is onto a socket (both positions read from the hook), then waits until the hook agrees. */
async function dragPartToSocket(page: Page, part: PartId, socketId: string): Promise<WorkshopL20Info> {
  const i = await waitInfo(page, (x) => Boolean(x.rects[PART_RECT[part]]) && x.sockets.some((s) => s.id === socketId), 'part or socket missing');
  const from = centre(i.rects[PART_RECT[part]] as Rect);
  const to = centre(i.sockets.find((s) => s.id === socketId)!.rect);
  await drag(page, from, to);
  // Snapped AND settled: the snap tween (160 ms) has put the part on the socket centre.
  return waitInfo(
    page,
    (x) => {
      const p = x.parts.find((q) => q.id === part);
      const s = x.sockets.find((q) => q.id === socketId);
      return p?.socketId === socketId && Math.abs(p.x - s!.x) < 2 && Math.abs(p.y - s!.y) < 2;
    },
    `${part} never snapped to ${socketId}`,
  );
}

async function tapRect(page: Page, rect: Rect): Promise<void> {
  const c = centre(rect);
  await page.mouse.click(c.x, c.y);
}

async function tapPlay(page: Page): Promise<void> {
  const i = await waitInfo(page, (x) => x.phase === 'build' && Boolean(x.rects.playBtn), 'Play never became tappable');
  await tapRect(page, i.rects.playBtn as Rect);
}

async function placeSolution(page: Page): Promise<void> {
  await dragPartToSocket(page, 'ramp', 'R1');
  await dragPartToSocket(page, 'domino1', 'slot-460');
  await dragPartToSocket(page, 'domino2', 'slot-620');
  await dragPartToSocket(page, 'scissors', 'string-A');
}

const spoken = async (page: Page): Promise<string[]> => (await getSpokenLines(page)).map((l) => l.lineId);

test.describe('workshop L20', () => {
  test.setTimeout(90_000);

  test('[AC-10] ?level=20 boots straight into the L20 board: no profile screen, no map, six sleepers, seven typed sockets, four tray parts', async ({ page }) => {
    const i = await openL20(page);
    expect(await getActiveScenes(page)).toContain('WorkshopL20Scene');
    expect(await getActiveScenes(page)).not.toContain('MapScene');
    expect(i.level).toBe(20);
    expect(i.phase).toBe('build');
    expect(i.background).toBe('dawn');
    expect(Object.keys(i.sleepers).sort()).toEqual(['bruno', 'cocopom', 'grandpere', 'moustache', 'pip', 'plume']);
    expect(Object.values(i.sleepers).every((s) => s.state === 'asleep')).toBe(true);
    expect(i.sockets.map((s) => s.id)).toEqual(['R1', 'slot-460', 'slot-500', 'slot-580', 'slot-620', 'string-A', 'string-B']);
    expect(i.partsInTrayCount).toBe(4);
    expect(i.config).toEqual({ ramp: 'none', slots: [], scissors: 'none' });
    expect(i.leverTripped).toBe(false);
    expect(i.scissorsClosed).toBe(false);
    await expect(page.locator('[data-testid="profile-a"]')).toHaveCount(0);
    // The story line is requested at the start.
    await expect.poll(async () => spoken(page)).toContain('vo-fr-ws-l20-story');
  });

  test('[AC-10] slow assets (2.5 s per webp): the board still builds, with no page error (the touch refresh waits for the bunny)', async ({ page }) => {
    const pageErrors: string[] = [];
    page.on('pageerror', (e) => pageErrors.push(e.message));
    await page.setViewportSize({ width: 1180, height: 820 });
    await page.route('**/*.webp', async (route) => {
      await new Promise((r) => setTimeout(r, 2500));
      await route.continue().catch(() => undefined);
    });
    await page.goto('./?level=20&e2e=1');
    await waitForScene(page, 'WorkshopL20Scene');
    const i = await waitInfo(page, (x) => x.ready && x.sockets.length === 7 && x.partsInTrayCount === 4, 'slow-asset L20 board never rendered', 60_000);
    expect(i.phase).toBe('build');
    expect(pageErrors).toEqual([]);
  });

  test('[AC-04] @single-orientation the dragged scissors already face left (the board facing), not only after the drop; a dragged unflipped ramp keeps facing right', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    const start = await waitInfo(page, (x) => Boolean(x.rects.partScissors) && Boolean(x.rects.partRamp), 'parts missing');
    const scissorsAt = centre(start.rects.partScissors as Rect);
    await page.mouse.move(scissorsAt.x, scissorsAt.y);
    await page.mouse.down();
    await page.mouse.move(scissorsAt.x + 40, scissorsAt.y - 200, { steps: 8 });
    const mid = await waitInfo(page, (x) => x.parts.find((p) => p.id === 'scissors')!.y < 650, 'the scissors never left the tray');
    expect(mid.parts.find((p) => p.id === 'scissors')!.scaleX, 'scissors scaleX while dragging').toBeLessThan(0);
    await page.mouse.up();
    await waitInfo(page, (x) => x.parts.find((p) => p.id === 'scissors')!.inTray, 'the wrong drop never returned the scissors');
    const rampAt = centre(start.rects.partRamp as Rect);
    await page.mouse.move(rampAt.x, rampAt.y);
    await page.mouse.down();
    await page.mouse.move(rampAt.x + 40, rampAt.y - 200, { steps: 8 });
    const rampMid = await waitInfo(page, (x) => x.parts.find((p) => p.id === 'ramp')!.y < 650, 'the ramp never left the tray');
    expect(rampMid.parts.find((p) => p.id === 'ramp')!.scaleX, 'ramp scaleX while dragging').toBeGreaterThan(0);
    await page.mouse.up();
  });

  test('[AC-08] @single-orientation the intro story line is the real recorded file: the .ogg answers HTTP 200 and the spy logs it as a clip (no chime, no device TTS)', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    const ogg = page.waitForResponse((r) => r.url().endsWith('/audio/mystery-egg/vo-fr-ws-l20-story.ogg'), { timeout: 30_000 });
    await openL20(page);
    const res = await ogg;
    // An <audio> element asks with a Range header, so a healthy static server answers 206 (Partial Content); 200 when it does not.
    expect([200, 206], `HTTP ${res.status()}`).toContain(res.status());
    expect(res.url()).toContain('/kids-app/audio/mystery-egg/vo-fr-ws-l20-story.ogg');
    await expect.poll(async () => (await getSpokenLines(page)).filter((l) => l.lineId === 'vo-fr-ws-l20-story').length).toBeGreaterThan(0);
    const story = (await getSpokenLines(page)).filter((l) => l.lineId === 'vo-fr-ws-l20-story');
    expect(story.every((l) => l.source === 'clip'), JSON.stringify(story)).toBe(true);
    // No placeholder anywhere in the intro so far.
    expect((await getSpokenLines(page)).filter((l) => l.source !== 'clip')).toEqual([]);
  });

  test('[AC-11] @single-orientation without ?level the app boots exactly as before: the profile screen, no L20 scene', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await page.goto('./?e2e=1');
    await expect(page.locator('[data-testid="profile-a"]')).toBeVisible();
    await expect(page.locator('[data-testid="profile-b"]')).toBeVisible();
    // No game exists yet on the profile screen (the hook is only installed with the Phaser game).
    const scenes = await page.evaluate(() => (window as unknown as { __testHooks__?: { getActiveScenes?: () => string[] } }).__testHooks__?.getActiveScenes?.() ?? []);
    expect(scenes).not.toContain('WorkshopL20Scene');
    expect(scenes).not.toContain('MapScene');
  });

  test('[AC-04] [AC-12] @single-orientation typed sockets: a wrong part springs back with {accepted:false, reason}; the ramp flips by tap; a placed part can be dragged off', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    // A domino on the ramp socket and the scissors on a strip slot spring back to the tray.
    let i = (await info(page))!;
    await drag(page, centre(i.rects.partDomino1 as Rect), centre(i.sockets.find((s) => s.id === 'R1')!.rect));
    i = await waitInfo(page, (x) => x.lastDrop?.part === 'domino1', 'no drop recorded');
    expect(i.lastDrop).toMatchObject({ accepted: false, reason: 'wrong-part' });
    i = await waitInfo(page, (x) => x.parts.find((p) => p.id === 'domino1')!.inTray, 'domino1 never returned to the tray');
    await drag(page, centre(i.rects.partScissors as Rect), centre(i.sockets.find((s) => s.id === 'slot-500')!.rect));
    i = await waitInfo(page, (x) => x.lastDrop?.part === 'scissors', 'no drop recorded');
    expect(i.lastDrop).toMatchObject({ accepted: false, reason: 'wrong-part' });
    await waitInfo(page, (x) => x.parts.find((p) => p.id === 'scissors')!.inTray, 'scissors never returned to the tray');
    // The ramp arrives down-right; a tap on the placed ramp flips it.
    i = await dragPartToSocket(page, 'ramp', 'R1');
    expect(i.lastDrop).toMatchObject({ accepted: true, socketId: 'R1' });
    expect(i.config.ramp).toBe('down-right');
    await tapRect(page, i.rects.partRamp as Rect);
    i = await waitInfo(page, (x) => x.config.ramp === 'down-left', 'the tap never flipped the ramp');
    await tapRect(page, i.rects.partRamp as Rect);
    await waitInfo(page, (x) => x.config.ramp === 'down-right', 'the second tap never flipped it back');
    // A placed part can be dragged back off the board: it returns to the tray and the socket is free again.
    i = (await info(page))!;
    await drag(page, centre(i.rects.partRamp as Rect), { x: 640, y: 600 });
    i = await waitInfo(page, (x) => x.config.ramp === 'none' && x.parts.find((p) => p.id === 'ramp')!.inTray, 'the ramp never returned to the tray');
    expect(i.sockets.find((s) => s.id === 'R1')!.occupiedBy).toBeNull();
  });

  test('[AC-05] [AC-06] [AC-12] [AC-19] the one chain by real drags: ramp down-right, dominoes {460,620}, scissors on A, tap Play -> bell:coco, lever:tripped, snip:A, goal:morning, the town wakes, the egg piece completes the egg', async ({ page }) => {
    await openL20(page);
    await placeSolution(page);
    let i = (await info(page))!;
    expect(i.config).toEqual({ ramp: 'down-right', slots: [460, 620], scissors: 'A' });
    // [AC-05] the scissors sit on the TOP of string A (y 110), under the ceiling, never over the sack, and stay open until the cord pulls them.
    const scissors = i.parts.find((p) => p.id === 'scissors')!;
    expect(scissors.socketId).toBe('string-A');
    expect(Math.abs(scissors.y - 110)).toBeLessThan(2);
    expect(Math.abs(scissors.x - 860)).toBeLessThan(2);
    expect(i.scissorsClosed).toBe(false);
    await tapPlay(page);
    i = await waitInfo(page, (x) => x.run.state !== 'idle', 'the run never started');
    // [AC-05] no snip at Play: nothing is cut while the chain has not reached the lever.
    expect(i.events.map((e) => e.id)).not.toContain('snip:A');
    expect(i.leverTripped).toBe(false);
    expect(i.scissorsClosed).toBe(false);
    // The chain: the small bell stirs the friends (cosmetic), the domino hits the lever, the cord closes the scissors on A.
    i = await waitInfo(page, (x) => x.events.some((e) => e.id === 'snip:A'), 'no snip event', 60_000);
    expect(i.leverTripped).toBe(true);
    await waitInfo(page, (x) => x.scissorsClosed, 'the scissors never closed');
    // [AC-01] one goal, by the right bodies, in the AC time (1.5 x the sim p95 6.5 s, rounded up to 0.5 s = 10 s).
    i = await waitInfo(page, (x) => x.run.state === 'ended', 'the run never ended', 60_000);
    const ids = i.events.map((e) => e.id);
    expect(ids.some((id) => /^bell:coco:dom\d+$/.test(id))).toBe(true);
    expect(ids.filter((id) => id.startsWith('goal:'))).toEqual(['goal:morning']);
    // The order check: bell:coco -> lever:tripped -> snip:A -> goal:morning.
    const at = ['bell:coco:', 'lever:tripped', 'snip:A', 'goal:morning'].map((p) => ids.findIndex((id) => id.startsWith(p)));
    expect(at.every((n) => n >= 0), JSON.stringify(ids)).toBe(true);
    expect(at).toEqual([...at].sort((a, b) => a - b));
    const goalStep = i.events.find((e) => e.id === 'goal:morning')!.step;
    expect(goalStep).toBeLessThanOrEqual(10 * 60);
    expect(i.run).toMatchObject({ result: 'win', reason: 'goal' });
    // [AC-06] the finale: everyone awake, the morning background, the egg piece in the nest, Continue.
    i = await waitInfo(page, (x) => x.phase === 'success' && x.eggPieceInNest, 'the finale never reached the nest', 30_000);
    expect(Object.values(i.sleepers).every((s) => s.state === 'awake')).toBe(true);
    expect(i.background).toBe('morning');
    expect(i.eggPiece).toBe(true);
    expect(i.eggLevel).toBe(5);
    expect(i.capybara === 'cheer' || i.capybara === 'idle').toBe(true);
    const lines = await spoken(page);
    expect(lines).toContain('vo-fr-ws-l20-bonjour');
    await expect.poll(async () => spoken(page), { timeout: 20_000 }).toContain('vo-fr-ws-l20-success');
    // [AC-19] the win screen: the tray Play button is gone (hidden, not just dimmed) and nothing can start another run.
    i = (await info(page))!;
    expect(i.phase).toBe('success');
    expect(i.rects.playBtn).toBeUndefined();
    i = await waitInfo(page, (x) => Boolean(x.rects.continueBtn), 'Continue never appeared', 20_000);
    expect(i.rects.playBtn).toBeUndefined();
    expect(i.rects.continueBtn).toBeTruthy();
    expect(Math.min((i.rects.continueBtn as Rect).width, (i.rects.continueBtn as Rect).height)).toBeGreaterThanOrEqual(48);
    // Persisted once: the profile's save holds the egg piece.
    const saved = await page.evaluate(() => Object.entries(window.localStorage).filter(([k]) => k.startsWith('kids-app-mystery-egg:')).map(([, v]) => JSON.parse(v)));
    expect(saved.some((s) => s.eggPiece === true)).toBe(true);
  });

  test('[AC-02] @single-orientation scissors on B (the wrong string): the lever trips, the lantern string is cut and the lantern drops, no goal, the "wrong string" marker sits on string B', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    await dragPartToSocket(page, 'ramp', 'R1');
    await dragPartToSocket(page, 'domino1', 'slot-460');
    await dragPartToSocket(page, 'domino2', 'slot-620');
    await dragPartToSocket(page, 'scissors', 'string-B');
    expect((await info(page))!.config).toEqual({ ramp: 'down-right', slots: [460, 620], scissors: 'B' });
    await tapPlay(page);
    const i = await waitInfo(page, (x) => x.run.state === 'ended', 'the run never ended', 60_000);
    const ids = i.events.map((e) => e.id);
    expect(ids).toContain('lever:tripped');
    expect(ids).toContain('snip:B');
    expect(ids).toContain('lantern:floor');
    expect(ids.some((id) => id.startsWith('goal:'))).toBe(false);
    expect(i.run).toMatchObject({ result: 'fail', reason: 'wrong-string' });
    const after = await waitInfo(page, (x) => x.phase === 'feedback', 'no failure feedback', 20_000);
    expect(after.scissorsClosed).toBe(true);
    expect(after.breakPoint).toMatchObject({ kind: 'wrong-string', x: 640, y: 110 });
    expect(after.eggPiece).toBe(false);
    expect(after.phase).not.toBe('success');
  });

  // Live regression (QA 2026-11-27): the listed-wrong set {500,580} + ramp down-right + scissors on A won live because Phaser's Matter
  // plugin changed the global resolver constants and the fixed domino stood exactly where the fallen 580 reaches. Real drags only.
  // v5.1: the row stops, so the lever is never hit: no small bell, no cord, no snip, no goal ("lever not hit").
  for (const slots of [[500, 580], [460, 580]]) {
    test(`[AC-02] @single-orientation the distractor set {${slots.join(',')}} + ramp down-right + scissors on A: the row stops, the lever is not hit, nothing is cut, no goal (fail, no win)`, async ({ page }, testInfo) => {
      landscapeOnly(testInfo);
      await openL20(page);
      await dragPartToSocket(page, 'ramp', 'R1');
      await dragPartToSocket(page, 'domino1', `slot-${slots[0]}`);
      await dragPartToSocket(page, 'domino2', `slot-${slots[1]}`);
      await dragPartToSocket(page, 'scissors', 'string-A');
      expect((await info(page))!.config).toEqual({ ramp: 'down-right', slots, scissors: 'A' });
      await tapPlay(page);
      const i = await waitInfo(page, (x) => x.run.state === 'ended', 'the run never ended', 60_000);
      const ids = i.events.map((e) => e.id);
      expect(ids.some((id) => id.startsWith('bell:coco:'))).toBe(false);
      expect(ids).not.toContain('lever:tripped');
      expect(ids.some((id) => id.startsWith('snip:'))).toBe(false);
      expect(ids.some((id) => id.startsWith('goal:'))).toBe(false);
      expect(ids).not.toContain('domino:710:fallen');
      expect(i.run).toMatchObject({ result: 'fail', reason: 'lever-not-hit' });
      const after = await waitInfo(page, (x) => x.phase === 'feedback' || x.phase === 'build', 'no failure feedback', 20_000);
      expect(after.scissorsClosed).toBe(false);
      expect(after.eggPiece).toBe(false);
      expect(after.phase).not.toBe('success');
    });
  }

  // [AC-18] touch targets: every interactive hit rect (the hook's `rects` ARE the hit rects) is at least 48 CSS px on its shortest
  // side at every supported viewport; the viewport is set BEFORE navigation (the board is letterboxed in portrait).
  const VIEWPORTS = [
    { name: 'landscape 1280x800', width: 1280, height: 800 },
    { name: 'landscape 1180x820', width: 1180, height: 820 },
    { name: 'portrait 820x1180', width: 820, height: 1180 },
    { name: 'portrait 800x1280', width: 800, height: 1280 },
  ];
  const shortest = (i: WorkshopL20Info): Array<[string, number]> =>
    Object.entries(i.rects)
      .filter(([, r]) => Boolean(r))
      .map(([k, r]) => [k, Math.min((r as Rect).width, (r as Rect).height)] as [string, number]);
  const expectAllHitsBig = (i: WorkshopL20Info, label: string): number => {
    const sizes = shortest(i);
    expect(sizes.length, `${label}: rects reported`).toBeGreaterThanOrEqual(15);
    const small = sizes.filter(([, v]) => v < 48);
    expect(small, `${label}: hit rects under 48 CSS px`).toEqual([]);
    return Math.min(...sizes.map(([, v]) => v));
  };

  test('[AC-18] every interactive hit rect is at least 48 CSS px in the project viewport, at the start and with the parts placed', async ({ page }, testInfo) => {
    let i = await openL20(page);
    const start = expectAllHitsBig(i, 'start');
    for (const k of ['playBtn', 'earBtn', 'backBtn', 'bunny', 'partRamp', 'partDomino1', 'partDomino2', 'partScissors', 'socket-R1', 'socket-slot-460', 'socket-string-A']) expect(i.rects[k as keyof typeof i.rects], k).toBeTruthy();
    await placeSolution(page);
    i = (await info(page))!;
    const placed = expectAllHitsBig(i, 'placed');
    testInfo.annotations.push({ type: 'min-hit-css-px', description: `${page.viewportSize()?.width}x${page.viewportSize()?.height}: start ${start.toFixed(1)}, placed ${placed.toFixed(1)}` });
  });

  for (const vp of VIEWPORTS) {
    test(`[AC-18] hit rects at the explicit viewport ${vp.name}: all at least 48 CSS px, also after the parts are placed`, async ({ page }, testInfo) => {
      await page.setViewportSize({ width: vp.width, height: vp.height });
      let i = await openL20(page);
      const start = expectAllHitsBig(i, `${vp.name} start`);
      await placeSolution(page);
      i = (await info(page))!;
      const placed = expectAllHitsBig(i, `${vp.name} placed`);
      // A rotation (or a resize) re-applies the sizes: the next viewport's minimum holds without a reload.
      await page.setViewportSize({ width: vp.height, height: vp.width });
      i = await waitInfo(page, (x) => shortest(x).every(([, v]) => v >= 48) && x.ready, `${vp.name} rotated: hit rects did not grow back to 48 CSS px`, 10_000);
      const rotated = expectAllHitsBig(i, `${vp.name} rotated`);
      testInfo.annotations.push({ type: 'min-hit-css-px', description: `${vp.name}: start ${start.toFixed(1)}, placed ${placed.toFixed(1)}, rotated ${rotated.toFixed(1)}` });
    });
  }

  test('[AC-18] @single-orientation portrait 820x1180: dropping a domino on each strip slot centre lands in that slot, and a press on a placed domino picks the NEAREST centre (slots are 40 px apart)', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await page.setViewportSize({ width: 820, height: 1180 });
    await openL20(page);
    const slotCentre = async (id: string) => centre((await info(page))!.sockets.find((s) => s.id === id)!.rect);
    // Both dominoes next to each other first (the worst overlap): 500 then 460.
    await dragPartToSocket(page, 'domino2', 'slot-500');
    await dragPartToSocket(page, 'domino1', 'slot-460');
    // A press exactly on the placed 500 picks domino2, a press on 460 picks domino1 (not the neighbour with the overlapping hit).
    await drag(page, centre((await info(page))!.rects.partDomino2 as Rect), await slotCentre('slot-580'));
    let i = await waitInfo(page, (x) => x.parts.find((p) => p.id === 'domino2')?.socketId === 'slot-580', 'domino2 was not the one picked from slot 500');
    expect(i.parts.find((p) => p.id === 'domino1')?.socketId).toBe('slot-460');
    // Every slot centre, one after another, with the other domino standing beside it.
    for (const slot of ['slot-500', 'slot-620', 'slot-500', 'slot-460']) {
      await drag(page, centre((await info(page))!.rects.partDomino1 as Rect), await slotCentre(slot));
      i = await waitInfo(page, (x) => x.parts.find((p) => p.id === 'domino1')?.socketId === slot && x.lastDrop?.accepted === true, `a domino dropped on the centre of ${slot} did not land there`);
      expect(i.lastDrop).toMatchObject({ part: 'domino1', accepted: true, socketId: slot });
      expect(i.parts.find((p) => p.id === 'domino2')?.socketId).toBe('slot-580');
    }
  });

  test('[AC-07] @single-orientation an empty board: Play fails with no win, no buzzer; the capybara mimes and Bip hints; the board resets', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    await tapPlay(page);
    let i = await waitInfo(page, (x) => x.phase === 'feedback', 'no failure feedback', 60_000);
    expect(i.run).toMatchObject({ state: 'ended', result: 'fail', reason: 'lever-not-hit' });
    expect(i.failedRuns).toBe(1);
    expect(i.feedback).toMatchObject({ kind: 'no-bell', capybara: 'facepalm', sfx: null, sleepersFallAsleep: [] });
    expect(i.eggPiece).toBe(false);
    expect(Object.values(i.sleepers).every((s) => s.state === 'asleep')).toBe(true);
    // Nothing reached the lever: no targeted hint on the first failure (the scissors line is for a tripped lever without the goal).
    expect(await spoken(page)).not.toContain('vo-he-ws-scissors-which');
    // Never a win and never a buzzer-like line; the board resets for another try.
    expect(await spoken(page)).not.toEqual(expect.arrayContaining([expect.stringMatching(/buzz|wrong|error/i)]));
    i = await waitInfo(page, (x) => x.phase === 'build', 'the board never reset', 15_000);
    expect(i.eggPiece).toBe(false);
    expect(i.background).toBe('dawn');
  });

  test('[AC-07] [AC-09] @single-orientation no scissors: the cord pulls an empty hook; the small bell had stirred the friends, they fall asleep again, the capybara rings an imaginary bell, the gag and the "which string" hint play', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    await dragPartToSocket(page, 'ramp', 'R1');
    await dragPartToSocket(page, 'domino1', 'slot-460');
    await dragPartToSocket(page, 'domino2', 'slot-620');
    await tapPlay(page);
    let i = await waitInfo(page, (x) => x.phase === 'feedback', 'no failure feedback', 60_000);
    expect(i.run).toMatchObject({ result: 'fail', reason: 'empty-hook' });
    const ids = i.events.map((e) => e.id);
    expect(ids).toContain('lever:tripped');
    expect(ids.some((id) => id.startsWith('snip:'))).toBe(false);
    expect(i.leverTripped).toBe(true);
    expect(i.scissorsClosed).toBe(false);
    expect(i.breakPoint).toMatchObject({ kind: 'empty-hook', x: 860, y: 110 });
    expect(i.feedback).toMatchObject({ kind: 'one-bell', capybara: 'ring', sfx: 'sfx-ws-yawn' });
    expect(i.feedback?.sleepersFallAsleep).toEqual(['moustache', 'bruno', 'cocopom']);
    // The voices play in sequence (playVoices awaits each clip): one-bell is 4.6 s, then 250 ms, then the 7.0 s hint starts; the default 5 s poll raced it.
    await expect.poll(async () => spoken(page), { timeout: 20_000 }).toContain('vo-fr-ws-l20-one-bell');
    await expect.poll(async () => spoken(page), { timeout: 20_000 }).toContain('vo-he-ws-scissors-which');
    // They woke, then fell asleep again: asleep -> awake -> asleep.
    i = await waitInfo(page, (x) => x.sleepers.cocopom.history.join('>') === 'asleep>awake>asleep', 'the friends never fell asleep again', 15_000);
    expect(i.sleepers.pip.history).toEqual(['asleep']);
    expect(i.eggPiece).toBe(false);
    expect(i.background).toBe('dawn');
  });

  test('[AC-13] [AC-14] [AC-15] [AC-17] @single-orientation empty board, real Play taps: break-point marker after each failure, the 4th shows the trajectory, the 5th the ramp ghost, the 6th has Bip place the ramp (only)', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    test.setTimeout(300_000);
    await openL20(page);
    const failOnce = async (n: number): Promise<WorkshopL20Info> => {
      await tapPlay(page);
      // [AC-15] hidden the moment Play is tapped, shown again after the failed run.
      await waitInfo(page, (x) => x.phase === 'playing', 'the run never started');
      const playing = (await info(page))!;
      expect(playing.breakPoint).toBeNull();
      // [AC-17] the trajectory is hidden while a run plays.
      if (n > 4) expect(playing.trajectory?.visible).toBe(false);
      const i = await waitInfo(page, (x) => x.phase === 'feedback' && x.failedRuns === n, `failure ${n} never came`, 90_000);
      expect(i.run).toMatchObject({ result: 'fail', reason: 'lever-not-hit' });
      return i;
    };
    for (const n of [1, 2, 3]) {
      const i = await failOnce(n);
      // [AC-15] the empty board never reached the ramp: the pulsing circle sits on the R1 socket.
      expect(i.breakPoint).toMatchObject({ kind: 'ramp', x: 200, y: 440 });
      expect(i.ghost).toBeNull();
      expect(i.bipPlaced).toEqual([]);
      expect(i.hintRung).toBe(n);
      // [AC-17] no trajectory before the 4th failure.
      expect(i.trajectory).toBeNull();
      await waitInfo(page, (x) => x.phase === 'build', 'the board never reset', 15_000);
    }
    // [AC-17] 4th failure: the dotted trajectory of the empty board (the ball drops straight down from the chute); no ghost yet.
    let i = await failOnce(4);
    expect(i.hintRung).toBe(4);
    expect(i.ghost).toBeNull();
    expect(i.bipPlaced).toEqual([]);
    i = await waitInfo(page, (x) => x.phase === 'build' && x.trajectory?.visible === true, 'the trajectory never showed after the 4th failure', 15_000);
    expect(i.trajectory!.points).toBeGreaterThan(5);
    expect(Math.abs(i.trajectory!.first.x - 200)).toBeLessThan(10);
    expect(i.trajectory!.last.y).toBeGreaterThan(600);
    expect(Math.abs(i.trajectory!.last.x - 200)).toBeLessThan(42);
    const emptyLast = i.trajectory!.last;
    expect(await spoken(page)).not.toContain('vo-fr-robot-regarde');
    // [AC-17] placing the ramp in R1 by a real drag changes the path: its last point moves right (into the cup).
    i = await dragPartToSocket(page, 'ramp', 'R1');
    i = await waitInfo(page, (x) => x.trajectory?.visible === true && x.trajectory.last.x > 280, 'the trajectory never followed the ramp', 10_000);
    expect(i.trajectory!.last.x).toBeGreaterThan(emptyLast.x + 80);
    // Dragging the ramp off puts the empty-board path back.
    await drag(page, centre(i.rects.partRamp as Rect), { x: 640, y: 600 });
    i = await waitInfo(page, (x) => x.config.ramp === 'none' && x.trajectory?.visible === true && Math.abs(x.trajectory.last.x - 200) < 42, 'the trajectory never went back to the empty board', 10_000);
    // [AC-13] 5th failure: the ghost of the ramp (down-right) in R1, "Regarde ici !"; the trajectory stays on; nothing is placed for her.
    // [AC-15] touching the board hides the marker (a tap on a tray part is enough).
    await tapRect(page, i.rects.partDomino1 as Rect);
    await waitInfo(page, (x) => x.breakPoint === null, 'the marker stayed after a touch');
    i = await failOnce(5);
    expect(i.hintRung).toBe(5);
    expect(i.ghost).toEqual({ part: 'ramp', socketId: 'R1', orientation: 'down-right' });
    expect(i.breakPoint).toMatchObject({ kind: 'ramp' });
    await expect.poll(async () => spoken(page), { timeout: 15_000 }).toContain('vo-fr-robot-regarde');
    i = await waitInfo(page, (x) => x.phase === 'build' && x.trajectory?.visible === true, 'the trajectory did not come back after the run', 15_000);
    expect(i.ghost).not.toBeNull();
    expect(i.bipPlaced).toEqual([]);
    expect(i.partsInTrayCount).toBe(4);
    // [AC-14] 6th failure: Bip places the ramp into R1 (the ONLY part), with its voice; she never pressed Play for it.
    i = await failOnce(6);
    expect(i.hintRung).toBe(6);
    i = await waitInfo(page, (x) => x.bipPlaced.length === 1, 'Bip never placed a part', 15_000);
    expect(i.bipPlaced[0]).toMatchObject({ part: 'ramp', socketId: 'R1', run: 6 });
    i = await waitInfo(page, (x) => x.parts.find((p) => p.id === 'ramp')?.socketId === 'R1' && Math.abs(x.parts.find((p) => p.id === 'ramp')!.x - 200) < 2, 'the ramp never landed in R1');
    expect(i.config).toEqual({ ramp: 'down-right', slots: [], scissors: 'none' });
    expect(i.ghost).toBeNull();
    expect(i.breakPoint).toBeNull();
    expect(i.parts.find((p) => p.id === 'ramp')!.inTray).toBe(false);
    for (const id of ['domino1', 'domino2', 'scissors']) expect(i.parts.find((p) => p.id === id)!.inTray).toBe(true);
    expect(i.partsInTrayCount).toBe(3);
    expect(i.run.state).toBe('ended');
    await expect.poll(async () => spoken(page), { timeout: 15_000 }).toContain('vo-fr-robot-aide');
    // [AC-17] the trajectory stays on with Bip's ramp and follows it.
    i = await waitInfo(page, (x) => x.trajectory?.visible === true && x.trajectory.last.x > 280, 'the trajectory did not follow Bip\'s ramp', 10_000);
  });
});

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
    await expect(page.locator('[data-testid="profile-a"]')).toHaveCount(0);
    // The story line is requested at the start (a missing file plays a chime).
    await expect.poll(async () => spoken(page)).toContain('vo-fr-ws-l20-story');
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

  test('[AC-12] the solution by real drags: ramp down-right, dominoes {460,620}, scissors on A, tap Play -> both bells, the town wakes, the egg piece completes the egg', async ({ page }) => {
    await openL20(page);
    await placeSolution(page);
    let i = (await info(page))!;
    expect(i.config).toEqual({ ramp: 'down-right', slots: [460, 620], scissors: 'A' });
    // [AC-05] the scissors sit on the TOP of string A (y 110), under the ceiling, never over the sack.
    const scissors = i.parts.find((p) => p.id === 'scissors')!;
    expect(scissors.socketId).toBe('string-A');
    expect(Math.abs(scissors.y - 110)).toBeLessThan(2);
    expect(Math.abs(scissors.x - 860)).toBeLessThan(2);
    await tapPlay(page);
    i = await waitInfo(page, (x) => x.run.state !== 'idle', 'the run never started');
    // [AC-05] the snip is the first event of the run.
    i = await waitInfo(page, (x) => x.events.some((e) => e.id === 'snip:A'), 'no snip event');
    expect(i.events[0].id).toBe('snip:A');
    // [AC-01] both bells, by the right bodies, within 11.5 s of the run.
    i = await waitInfo(page, (x) => x.run.state === 'ended', 'the run never ended', 60_000);
    const ids = i.events.map((e) => e.id);
    expect(ids.some((id) => /^bell:coco:dom\d+$/.test(id))).toBe(true);
    expect(ids).toContain('bell:morning:seesaw');
    const bellSteps = i.events.filter((e) => e.id.startsWith('bell:')).map((e) => e.step);
    expect(Math.max(...bellSteps)).toBeLessThanOrEqual(11.5 * 60);
    expect(i.run).toMatchObject({ result: 'win', reason: 'both-bells' });
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
    i = await waitInfo(page, (x) => Boolean(x.rects.continueBtn), 'Continue never appeared', 20_000);
    // Persisted once: the profile's save holds the egg piece.
    const saved = await page.evaluate(() => Object.entries(window.localStorage).filter(([k]) => k.startsWith('kids-app-mystery-egg:')).map(([, v]) => JSON.parse(v)));
    expect(saved.some((s) => s.eggPiece === true)).toBe(true);
  });

  test('[AC-07] @single-orientation an empty board: Play fails with no win, no buzzer; the capybara mimes and Bip hints; the board resets', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    await tapPlay(page);
    let i = await waitInfo(page, (x) => x.phase === 'feedback', 'no failure feedback', 60_000);
    expect(i.run).toMatchObject({ state: 'ended', result: 'fail', reason: 'no-bell' });
    expect(i.failedRuns).toBe(1);
    expect(i.feedback).toMatchObject({ kind: 'no-bell', capybara: 'facepalm', sfx: null, sleepersFallAsleep: [] });
    expect(i.eggPiece).toBe(false);
    expect(Object.values(i.sleepers).every((s) => s.state === 'asleep')).toBe(true);
    await expect.poll(async () => spoken(page)).toContain('vo-he-ws-scissors-which');
    // Never a win and never a buzzer-like line; the board resets for another try.
    expect(await spoken(page)).not.toEqual(expect.arrayContaining([expect.stringMatching(/buzz|wrong|error/i)]));
    i = await waitInfo(page, (x) => x.phase === 'build', 'the board never reset', 15_000);
    expect(i.eggPiece).toBe(false);
    expect(i.background).toBe('dawn');
  });

  test('[AC-07] [AC-09] @single-orientation exactly one bell rang (no scissors): the friends who woke fall asleep again, the capybara rings an imaginary bell, the gag line plays', async ({ page }, testInfo) => {
    landscapeOnly(testInfo);
    await openL20(page);
    await dragPartToSocket(page, 'ramp', 'R1');
    await dragPartToSocket(page, 'domino1', 'slot-460');
    await dragPartToSocket(page, 'domino2', 'slot-620');
    await tapPlay(page);
    let i = await waitInfo(page, (x) => x.phase === 'feedback', 'no failure feedback', 60_000);
    expect(i.run).toMatchObject({ result: 'fail', reason: 'coco-only' });
    expect(i.feedback).toMatchObject({ kind: 'one-bell', capybara: 'ring', sfx: 'sfx-ws-yawn' });
    expect(i.feedback?.sleepersFallAsleep).toEqual(['moustache', 'bruno', 'cocopom']);
    await expect.poll(async () => spoken(page)).toContain('vo-fr-ws-l20-one-bell');
    // They woke, then fell asleep again: asleep -> awake -> asleep.
    i = await waitInfo(page, (x) => x.sleepers.cocopom.history.join('>') === 'asleep>awake>asleep', 'the friends never fell asleep again', 15_000);
    expect(i.sleepers.pip.history).toEqual(['asleep']);
    expect(i.eggPiece).toBe(false);
    expect(i.background).toBe('dawn');
  });
});

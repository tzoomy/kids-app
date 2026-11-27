// Workshop level 20 "Bonjour, Ville des Surprises !" (docs/specs/workshop-l20.md): the finale board. The physics is the
// Phaser-free L20World (the same code the unit tests run), stepped here at a fixed 1/60 s on a FRESH engine for every Play.
// The scene only draws what the world says, takes drags onto typed sockets, and plays the reactions (sound, tweens, voice).
// Media (art, sfx, voice) arrives later from Gemini: every key has a code-drawn / synth / chime placeholder and a missing
// file never breaks the level (art.ts, eggSound.ts, voiceProvider.ts).
import Phaser from 'phaser';
import type { AppContext } from '../../../game/appContext';
import { setAppScreen } from '../../../pwa';
import { transitionTo } from '../../../anim/transitions';
import { displaySize, workshopManifest } from '../assets';
import { createRobot, ensureSpriteAnim, ensureSpriteFrames, eggArt, panel, type RobotView } from '../art';
import { boardRectToPage, fitBoard } from '../boardView';
import { loadEggAssets } from '../eggAssetLoader';
import { playEggSfx, type EggSfx } from '../eggSound';
import { BALL_ART_SCALE, RAMP_POLY } from '../layout';
import { followOrientation } from '../orientation';
import { eggLevel, loadProgress, recordEggPieceAndSave, type MysteryEggProgress } from '../progress';
import { eggSpeechRequest } from '../speech';
import { showContinueAfterVoice } from '../successTiming';
import type { EggPhase, EggTarget, WorkshopL20Info } from '../types';
import { drawArrowIcon, drawEarIcon, drawHomeIcon, drawPlayIcon, makeButton, speechCue, type EggButton } from '../ui';
import { eggAvailability } from '../voiceProvider';
import { EAR_LINE, planFailure, type FailPlan, type NextNeeded } from './l20Hints';
import { dotsAlong, trajectoryFor, type TrajectoryPoint } from './l20Trajectory';
import { chooseBreakPoint, type BreakPoint } from './l20BreakPoint';
import {
  BALL_START,
  BELL_RADIUS,
  CAPYBARA,
  COCO_BELL,
  DOMINO_Y,
  EGG_NEST,
  FIXED_DOMINOES,
  L20_SOCKETS,
  L20_STEP_MS,
  L20_WORLD,
  LANTERN,
  MORNING_BELL,
  PIVOT,
  ROPE_A,
  ROPE_B,
  SANDBAG,
  SCISSORS_Y,
  SEESAW,
  SLEEPERS,
  type L20Config,
  type L20PartKind,
  type L20Socket,
  type SleeperId,
} from './l20Level';
import { configFromPlacements, resolveL20Drop, type Placement } from './l20Sockets';
import { L20World, type L20Event, type L20Matter, type L20Run } from './l20World';
import { RopeView, SleeperView, drawDashedCircle } from './l20Views';
import { BELL_FRIENDS } from './l20Hints';

/** Art the L20 scene needs: the reused 1.1 keys and every Workshop art key. */
const REUSED_ART = ['part-ramp', 'part-bell', 'part-ball', 'capybara', 'bunny', 'robot', 'robot-blink', 'confetti', 'egg-nest-0', 'egg-nest-1', 'egg-nest-2', 'egg-nest-3', 'egg-nest-4', 'egg-nest-5'];
export function l20ArtIds(): string[] {
  const own = Object.entries(workshopManifest())
    .filter(([, e]) => e.kind === 'webp' || e.kind === 'sprite')
    .map(([id]) => id);
  return [...REUSED_ART, ...own];
}

interface PartDef {
  id: 'ramp' | 'domino1' | 'domino2' | 'scissors';
  kind: L20PartKind;
  art: string;
  home: { x: number; y: number };
  /** Display scale in the tray; on the board every part is drawn at scale 1 (world px = art px). */
  trayScale: number;
  /** Smallest tap target (board px) in the tray. */
  minHit: number;
}

const TRAY_Y = 752;
const TRAY = { x: 530, y: 750, w: 600, h: 92 } as const;
const PARTS: readonly PartDef[] = [
  { id: 'ramp', kind: 'ramp', art: 'part-ramp', home: { x: 290, y: TRAY_Y }, trayScale: 0.5, minHit: 80 },
  { id: 'domino1', kind: 'domino', art: 'ws-domino', home: { x: 420, y: TRAY_Y }, trayScale: 0.78, minHit: 56 },
  { id: 'domino2', kind: 'domino', art: 'ws-domino', home: { x: 490, y: TRAY_Y }, trayScale: 0.78, minHit: 56 },
  { id: 'scissors', kind: 'scissors', art: 'ws-scissors', home: { x: 640, y: TRAY_Y }, trayScale: 0.9, minHit: 70 },
];
const PLAY_POS = { x: 955, y: 750, w: 210, h: 100 } as const;
const ROBOT_POS = { x: 1190, y: 748 } as const;
const BUNNY_POS = { x: 60, y: 748 } as const;
const EAR_POS = { x: 1200, y: 620 } as const;
/** A drag counts once the finger moved this far (board px); less is a tap (a tap on the placed ramp flips it). */
const DRAG_THRESHOLD = 8;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_MS = 100;
/** The scissors open and close before the cut (12 fps x 2 frames, then back), then the world is released. */
const SNIP_MS = 200;
/** A failed run is shown this long before the board resets. */
const FEEDBACK_MS = 2800;
const SEESAW_REST_ANGLE = Math.asin(Math.min(0.99, (SEESAW.ledge.top - 8 - PIVOT.y) / SEESAW.armRight));
/** Vertical offsets from an image centre to the physics body centre (sandbag: image (42,56) of 84x96; lantern: (28,44) of 56x76). */
const SANDBAG_OFFSET = 8;
const LANTERN_OFFSET = 6;
/** Rope pieces below the cut (the cut is at the scissors, y 110). */
const PIECE_A = ROPE_A.bottom - SCISSORS_Y;
const PIECE_B = ROPE_B.bottom - SCISSORS_Y;
const STUB_FULL = SCISSORS_Y - ROPE_A.top;
const STUB_SHORT = 30;

const PALETTE = { wall: '#f1dcc2' } as const;
/** Bip's step-6 placement tween, and the break-point circle radius (board px). */
const BIP_PLACE_MS = 700;
const BREAK_RADIUS = 46;
/** Trajectory dots (board px): spacing along the path, radius, the debounce after the last board change, the depth (behind the parts). */
const TRAJ_SPACING = 30;
const TRAJ_DOT = 5.5;
const TRAJ_DEBOUNCE_MS = 200;
const TRAJ_DEPTH = 12.5;
const TRAJ_COLOR = 0x5b6fd6;

interface PartView {
  def: PartDef;
  container: Phaser.GameObjects.Container;
  socketId: string | null;
  flipped: boolean;
  artW: number;
  artH: number;
}

interface MarkerView {
  socket: L20Socket;
  marker: Phaser.GameObjects.Graphics;
  glow: Phaser.GameObjects.Graphics;
}

type CapyPose = 'idle' | 'ring' | 'facepalm' | 'cheer';

const delay = (ms: number): Promise<void> => new Promise((r) => setTimeout(r, ms));

export class WorkshopL20Scene extends Phaser.Scene {
  private context!: AppContext;
  private profileId = '';
  private progress!: MysteryEggProgress;
  private phase: EggPhase = 'build';
  private ready = false;
  private alive = false;

  private world: L20World | null = null;
  /** The last finished run (kept for the read hook after the board resets). */
  private lastRun: { run: L20Run; events: L20Event[] } | null = null;
  private capyBob: Phaser.Tweens.Tween | null = null;
  private accumulator = 0;
  private eventsSeen = 0;
  private config: L20Config = { ramp: 'none', slots: [], scissors: 'none' };

  private readonly parts = new Map<string, PartView>();
  private readonly markers = new Map<string, MarkerView>();
  private readonly buttons = new Map<EggTarget, EggButton>();
  private dragging: { part: PartView; dx: number; dy: number; startX: number; startY: number; moved: boolean } | null = null;
  private lastDrop: WorkshopL20Info['lastDrop'] = null;
  private playBtn!: EggButton;
  private continueBtn: EggButton | null = null;
  private cancelContinue: (() => void) | null = null;

  // Views.
  private bgMorning!: Phaser.GameObjects.Container;
  private sleepers = new Map<SleeperId, SleeperView>();
  private dominoViews = new Map<string, Phaser.GameObjects.Container>();
  private seesawView!: Phaser.GameObjects.Container;
  private sandbagView!: Phaser.GameObjects.Container;
  private lanternView!: Phaser.GameObjects.Container;
  private ballView!: Phaser.GameObjects.Container;
  private ropeA!: RopeView;
  private ropeB!: RopeView;
  private stubs: Partial<Record<'A' | 'B', RopeView>> = {};
  private pieces: Partial<Record<'A' | 'B', RopeView>> = {};
  private stubLength = { A: STUB_FULL, B: STUB_FULL };
  private cutDone: { A: boolean; B: boolean } = { A: false, B: false };
  private cocoBell!: Phaser.GameObjects.Container;
  private morningBell!: Phaser.GameObjects.Container;
  private morningBellRope!: RopeView;
  private snipSprite: Phaser.GameObjects.Sprite | null = null;
  private capy!: Phaser.GameObjects.Container;
  private capyPose: CapyPose = 'idle';
  private nest!: Phaser.GameObjects.Container;
  private bunny!: Phaser.GameObjects.Container;
  private robot!: RobotView;
  private robotView!: Phaser.GameObjects.Container;

  // State for the hook.
  private failedRuns = 0;
  private oneBellFails = 0;
  private hintsGiven = 0;
  private hintGlow: string | null = null;
  private hintRung = 0;
  private ghost: NextNeeded | null = null;
  private ghostView: Phaser.GameObjects.Container | null = null;
  private bipPlaced: WorkshopL20Info['bipPlaced'] = [];
  private breakPoint: BreakPoint | null = null;
  private breakView: Phaser.GameObjects.Graphics | null = null;
  private trajectoryOn = false;
  private trajectoryPoints: readonly TrajectoryPoint[] = [];
  private trajectoryView: Phaser.GameObjects.Graphics | null = null;
  private trajectoryTimer: Phaser.Time.TimerEvent | null = null;
  private feedback: WorkshopL20Info['feedback'] = null;
  private introDone = false;
  private introCut = false;
  private eggPieceInNest = false;
  private morningShown = false;
  private runToken = 0;

  constructor() {
    // No Matter plugin here: the world builds its own engine from Phaser's bundled library, fresh for every Play.
    super({ key: 'WorkshopL20Scene' });
  }

  // ---------------------------------------------------------------- lifecycle

  create(): void {
    setAppScreen('mystery-egg-build');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.profileId = this.context.requireProfileId();
    this.progress = loadProgress(window.localStorage, this.profileId);
    this.phase = 'build';
    this.ready = false;
    this.alive = true;
    this.world = null;
    this.lastRun = null;
    this.accumulator = 0;
    this.eventsSeen = 0;
    this.config = { ramp: 'none', slots: [], scissors: 'none' };
    this.parts.clear();
    this.markers.clear();
    this.buttons.clear();
    this.sleepers.clear();
    this.dominoViews.clear();
    this.stubs = {};
    this.pieces = {};
    this.stubLength = { A: STUB_FULL, B: STUB_FULL };
    this.cutDone = { A: false, B: false };
    this.dragging = null;
    this.lastDrop = null;
    this.continueBtn = null;
    this.cancelContinue?.();
    this.cancelContinue = null;
    this.failedRuns = 0;
    this.oneBellFails = 0;
    this.hintsGiven = 0;
    this.hintGlow = null;
    this.hintRung = 0;
    this.ghost = null;
    this.ghostView = null;
    this.bipPlaced = [];
    this.breakPoint = null;
    this.breakView = null;
    this.trajectoryOn = false;
    this.trajectoryPoints = [];
    this.trajectoryView = null;
    this.trajectoryTimer = null;
    this.feedback = null;
    this.introDone = false;
    this.introCut = false;
    this.eggPieceInNest = false;
    this.morningShown = false;
    this.capyPose = 'idle';
    this.runToken++;
    this.context.shell.clearChrome();
    followOrientation(this);
    fitBoard(this, PALETTE.wall);
    const refit = (): void => {
      if (this.alive) fitBoard(this, PALETTE.wall);
    };
    this.scale.on('resize', refit);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', refit);
      this.alive = false;
      this.cancelContinue?.();
      this.cancelContinue = null;
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.input.off('gameout', this.onPointerUp, this);
      this.trajectoryTimer?.remove(false);
      this.trajectoryTimer = null;
      this.context.audio.stopAll();
    });
    loadEggAssets(
      this,
      import.meta.env.BASE_URL,
      () => {
        if (!this.alive) return;
        this.build();
        this.ready = true;
        window.__GAME_READY__ = true;
      },
      l20ArtIds(),
    );
  }

  update(_time: number, delta: number): void {
    this.updateRopeStubs();
    if (this.phase !== 'playing' || !this.world || this.world.run.state !== 'running') return;
    this.accumulator += Math.min(delta, MAX_FRAME_MS);
    let steps = 0;
    while (this.accumulator >= L20_STEP_MS && steps < MAX_STEPS_PER_FRAME && this.world.run.state === 'running') {
      this.accumulator -= L20_STEP_MS;
      steps++;
      this.world.step();
      this.consumeEvents();
    }
    this.syncViews();
    if ((this.world.run.state as string) === 'ended') this.onRunEnd();
  }

  // ---------------------------------------------------------------- build

  private build(): void {
    this.drawBoard();
    this.drawSockets();
    this.drawMachine();
    this.drawTown();
    this.drawCharacters();
    this.drawTrayAndButtons();
    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('gameout', this.onPointerUp, this);
    this.restViews();
    this.refreshMarkers();
    this.startSnore();
    this.startIntro();
  }

  /** Background (dawn, with the morning one waiting on top at alpha 0), then the static fixtures layer. Static bodies are invisible. */
  private drawBoard(): void {
    const wall = this.add.graphics().setDepth(-1);
    wall.fillStyle(0xf1dcc2, 1);
    wall.fillRect(-400, -400, L20_WORLD.width + 800, L20_WORLD.height + 800);
    eggArt(this, 'ws-l20-bg-dawn', 640, 400).setDepth(0);
    this.bgMorning = eggArt(this, 'ws-l20-bg-morning', 640, 400).setDepth(1).setAlpha(0);
    eggArt(this, 'ws-l20-fixtures', 640, 400).setDepth(5);
  }

  /** Socket markers: a faint ramp outline at R1, dots on the strip slots, dashed circles on the strings; plus the hint glow. */
  private drawSockets(): void {
    for (const socket of L20_SOCKETS) {
      const marker = this.add.graphics().setDepth(6);
      const glow = this.add.graphics().setDepth(7).setVisible(false);
      if (socket.type === 'ramp') {
        const pts = RAMP_POLY.map((p) => ({ x: socket.x + p.x, y: socket.y + p.y }));
        marker.lineStyle(4, 0x5b6fd6, 0.55);
        marker.strokePoints(pts as never, true);
        glow.fillStyle(0xfff176, 0.45);
        glow.fillPoints(pts as never, true);
        glow.lineStyle(6, 0xffc400, 1);
        glow.strokePoints(pts as never, true);
      } else if (socket.type === 'string') {
        marker.setPosition(socket.x, socket.y);
        drawDashedCircle(marker, 26, 0x6b4a2e, 0.9);
        glow.setPosition(socket.x, socket.y);
        glow.fillStyle(0xfff176, 0.5);
        glow.fillCircle(0, 0, 44);
        drawDashedCircle(glow, 34, 0xffc400, 1, 6);
        this.tweens.add({ targets: marker, alpha: 0.45, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      } else {
        marker.setPosition(socket.x, 548);
        drawDashedCircle(marker, 12, 0x6b4a2e, 0.7, 3);
        glow.setPosition(socket.x, DOMINO_Y);
        glow.fillStyle(0xfff176, 0.5);
        glow.fillRoundedRect(-22, -64, 44, 128, 12);
        glow.lineStyle(5, 0xffc400, 1);
        glow.strokeRoundedRect(-22, -64, 44, 128, 12);
      }
      this.tweens.add({ targets: glow, alpha: 0.4, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.markers.set(socket.id, { socket, marker, glow });
    }
  }

  /** Everything that moves in a run, drawn at its rest pose (restViews puts it there again after a failed run). */
  private drawMachine(): void {
    // Ropes, the hung objects, the seesaw, the dominoes, the ball, both bells.
    this.ropeA = new RopeView(this, 8);
    this.ropeB = new RopeView(this, 8);
    this.sandbagView = this.hangingObject('ws-sandbag', SANDBAG.x, SANDBAG.y, SANDBAG_OFFSET).setDepth(13);
    this.lanternView = this.hangingObject('ws-lantern', LANTERN.x, LANTERN.y, LANTERN_OFFSET).setDepth(13);
    this.tweens.add({ targets: this.lanternView.getAt(0), alpha: 0.8, duration: 1600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.seesawView = eggArt(this, 'ws-seesaw', PIVOT.x, PIVOT.y).setDepth(9);
    for (const x of [FIXED_DOMINOES[0], FIXED_DOMINOES[1], ...FIXED_DOMINOES.slice(2)]) {
      this.dominoViews.set(`dom${x}`, eggArt(this, 'ws-domino', x, DOMINO_Y).setDepth(12));
    }
    this.ballView = eggArt(this, 'part-ball', BALL_START.x, BALL_START.y).setDepth(30).setScale(BALL_ART_SCALE);

    // Coco's bell stands on a small pedestal on the table.
    const stand = this.add.graphics().setDepth(11);
    stand.fillStyle(0x9a6b45, 1);
    stand.fillRect(COCO_BELL.x - 8, COCO_BELL.y + 50, 16, 40);
    stand.lineStyle(3, 0x3b2a22, 1);
    stand.strokeRect(COCO_BELL.x - 8, COCO_BELL.y + 50, 16, 40);
    this.cocoBell = eggArt(this, 'part-bell', COCO_BELL.x, COCO_BELL.y).setDepth(12).setScale((BELL_RADIUS * 2 + 8) / displaySize('part-bell').w);

    // The morning bell: its body centre (sensor) is the image centre; it swings about the hook at 8% of the image height.
    const { w: bw, h: bh } = displaySize('ws-bell-morning');
    const imageTop = MORNING_BELL.y - bh / 2;
    const pivotY = imageTop + 0.08 * bh;
    this.morningBell = this.add.container(MORNING_BELL.x, pivotY).setDepth(12);
    const bellArt = eggArt(this, 'ws-bell-morning', 0, MORNING_BELL.y - pivotY);
    this.morningBell.add(bellArt);
    void bw;
    this.morningBellRope = new RopeView(this, 8);
    this.morningBellRope.set(MORNING_BELL.x, 60, MORNING_BELL.x, imageTop + 6);
  }

  /** A hung object: the container sits on the BODY centre; the art is offset up so its centre-of-mass point is the body centre. */
  private hangingObject(id: string, x: number, y: number, offset: number): Phaser.GameObjects.Container {
    const c = this.add.container(x, y);
    c.add(eggArt(this, id, 0, -offset));
    return c;
  }

  /** Six windows with their sleeping friends behind the machines, y 140-380. */
  private drawTown(): void {
    SLEEPERS.forEach((s, i) => {
      const view = new SleeperView(this, s.id, s.x, s.y, 2);
      view.startBreathing(i * 230);
      this.sleepers.set(s.id, view);
    });
  }

  private drawCharacters(): void {
    this.capy = eggArt(this, 'capybara', CAPYBARA.x, CAPYBARA.y).setScale(CAPYBARA.scale).setDepth(10);
    this.capyBob = this.tweens.add({ targets: this.capy, y: CAPYBARA.y - 3, duration: 1500, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.nest = eggArt(this, `egg-nest-${eggLevel(this.progress)}`, EGG_NEST.x, EGG_NEST.y).setScale(EGG_NEST.scale).setDepth(10);
    this.bunny = eggArt(this, 'bunny', BUNNY_POS.x, BUNNY_POS.y).setDepth(25).setScale(0.38);
    this.bunny.setSize(120, 200).setInteractive({ useHandCursor: true });
    this.bunny.on('pointerdown', () => {
      if (this.phase === 'build') void this.speak('vo-fr-ws-l20-story');
    });
    this.robot = createRobot(this, ROBOT_POS.x, ROBOT_POS.y);
    this.robotView = this.robot.container.setDepth(25).setScale(0.55);
    this.robot.startIdleBlinks();
  }

  private drawTrayAndButtons(): void {
    panel(this, TRAY.x, TRAY.y, TRAY.w, TRAY.h).setDepth(20);
    for (const def of PARTS) this.makePart(def);
    this.playBtn = makeButton(this, PLAY_POS.x, PLAY_POS.y, PLAY_POS.w, PLAY_POS.h, drawPlayIcon, () => this.onPlay());
    this.playBtn.container.setDepth(60);
    this.tweens.add({ targets: this.playBtn.container, scale: 1.05, duration: 800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.buttons.set('playBtn', this.playBtn);
    const ear = makeButton(this, EAR_POS.x, EAR_POS.y, 96, 96, drawEarIcon, () => this.onEar());
    ear.container.setDepth(700);
    this.buttons.set('earBtn', ear);
    const back = makeButton(this, 1218, 68, 96, 96, drawHomeIcon, () => this.goBack());
    back.container.setDepth(700);
    this.buttons.set('backBtn', back);
  }

  private makePart(def: PartDef): void {
    const { w, h } = displaySize(def.art);
    const container = eggArt(this, def.art, def.home.x, def.home.y).setDepth(50).setScale(def.trayScale);
    const part: PartView = { def, container, socketId: null, flipped: false, artW: w, artH: h };
    this.parts.set(def.id, part);
    this.applyHit(part, def.trayScale);
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPartDown(part, pointer));
    if (def.id === 'ramp') this.tweens.add({ targets: container, angle: 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  /** Hit area at least `minHit` board px at the current scale (thin parts like the domino get a wider target). */
  private applyHit(part: PartView, scale: number): void {
    const c = part.container;
    const min = part.def.minHit / Math.max(0.1, Math.abs(scale));
    c.setSize(Math.max(part.artW, min), Math.max(part.artH, min));
    // Resize the existing hit area in place: removeInteractive + setInteractive in one frame loses the interactive (Phaser
    // queues the removal and nulls the new input on the next pre-update).
    if (c.input?.hitArea) (c.input.hitArea as Phaser.Geom.Rectangle).setSize(c.width, c.height);
    else c.setInteractive({ useHandCursor: true });
  }

  // ---------------------------------------------------------------- voice

  /** Requests a manifest voice line (the file, else a chime) at the in-game rate, with a speech cue by the speaker. */
  private speak(lineId: string): Promise<boolean> {
    const request = eggSpeechRequest(lineId, 'game');
    if (!request) return Promise.resolve(false);
    const done = this.context.audio.play(request).catch(() => false);
    if (this.alive) this.cueFor(lineId);
    return done;
  }

  private cueFor(lineId: string): void {
    if (lineId === 'vo-fr-ws-l20-one-bell') speechCue(this, 300, 120);
    else if (lineId === 'vo-fr-ws-l20-bonjour') speechCue(this, 640, 110);
    else if (lineId.startsWith('vo-he-') || lineId.startsWith('vo-fr-robot')) speechCue(this, this.robotView.x - 70, this.robotView.y - 90);
    else speechCue(this, this.bunny.x + 60, this.bunny.y - 100);
  }

  /** The intro: the French story, then the goal hint (never cut by a drag; Play cuts it). */
  private startIntro(): void {
    void this.speak('vo-fr-ws-l20-story').then(() => {
      if (!this.alive || this.introCut) {
        this.introDone = true;
        return undefined;
      }
      return this.speak(EAR_LINE).then(() => {
        this.introDone = true;
      });
    });
  }

  private cutIntro(): void {
    this.introCut = true;
    this.introDone = true;
  }

  private onEar(): void {
    if (!this.alive || this.phase === 'success') return;
    playEggSfx('sfx-robot-beep-2');
    this.tweens.add({ targets: this.robotView, angle: { from: -5, to: 5 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.robotView.setAngle(0) });
    this.cutIntro();
    void this.speak(EAR_LINE);
  }

  /** Soft snoring now and then while the town sleeps (low volume; stops on the win). */
  private startSnore(): void {
    this.time.addEvent({
      delay: 7000,
      loop: true,
      callback: () => {
        if (this.alive && this.phase !== 'success') playEggSfx('sfx-ws-snore', { volume: 0.2 });
      },
    });
  }

  // ---------------------------------------------------------------- dragging

  private worldPoint(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private onPartDown(part: PartView, pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'build' || this.dragging) return;
    this.hideBreakPoint();
    const p = this.worldPoint(pointer);
    this.dragging = { part, dx: part.container.x - p.x, dy: part.container.y - p.y, startX: p.x, startY: p.y, moved: false };
    part.container.setDepth(400);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    const drag = this.dragging;
    if (!drag) return;
    const p = this.worldPoint(pointer);
    if (!drag.moved && Math.hypot(p.x - drag.startX, p.y - drag.startY) > DRAG_THRESHOLD) {
      drag.moved = true;
      const { part } = drag;
      // Lifting a placed part opens its socket again; every lifted part is drawn at board size (1:1 with the physics).
      if (part.socketId) this.release(part);
      this.tweens.killTweensOf(part.container);
      part.container.setAngle(0).setScale(1.04 * (part.flipped ? -1 : 1), 1.04);
      this.applyHit(part, 1);
    }
    if (drag.moved) drag.part.container.setPosition(p.x + drag.dx, p.y + drag.dy);
  }

  private onPointerUp(): void {
    const drag = this.dragging;
    if (!drag) return;
    this.dragging = null;
    const { part } = drag;
    if (!drag.moved) {
      // A tap: the placed ramp flips down-right <-> down-left; any other part just settles.
      part.container.setDepth(part.socketId ? 14 : 50);
      if (part.socketId && part.def.kind === 'ramp') this.flipRamp(part);
      return;
    }
    const occupied = new Set(this.occupiedSockets());
    const drop = resolveL20Drop(part.def.kind, { x: part.container.x, y: part.container.y }, occupied);
    if (drop.accepted) {
      this.lastDrop = { part: part.def.id, accepted: true, reason: null, socketId: drop.socketId };
      this.place(part, drop.socketId, drop.x, drop.y);
    } else {
      this.lastDrop = { part: part.def.id, accepted: false, reason: drop.reason, socketId: null };
      this.returnToTray(part, drop.reason === 'wrong-part');
    }
  }

  private occupiedSockets(): string[] {
    return [...this.parts.values()].map((p) => p.socketId).filter((s): s is string => s !== null);
  }

  private release(part: PartView): void {
    part.socketId = null;
    this.syncConfig();
  }

  private place(part: PartView, socketId: string, x: number, y: number, duration = 160, ease = 'Back.easeOut'): void {
    part.socketId = socketId;
    part.container.setDepth(14);
    playEggSfx('sfx-pop');
    this.tweens.add({ targets: part.container, x, y, angle: 0, scaleX: part.flipped ? -1 : 1, scaleY: 1, duration, ease });
    this.syncConfig();
  }

  private returnToTray(part: PartView, shake: boolean): void {
    const { def } = part;
    part.flipped = false;
    part.container.setDepth(50);
    this.applyHit(part, def.trayScale);
    this.tweens.add({
      targets: part.container,
      x: def.home.x,
      y: def.home.y,
      scaleX: def.trayScale,
      scaleY: def.trayScale,
      angle: 0,
      duration: shake ? 320 : 220,
      ease: shake ? 'Bounce.easeOut' : 'Back.easeOut',
    });
    this.syncConfig();
  }

  private flipRamp(part: PartView): void {
    part.flipped = !part.flipped;
    playEggSfx('sfx-pop');
    this.tweens.add({ targets: part.container, scaleX: part.flipped ? -1 : 1, duration: 160, ease: 'Back.easeOut' });
    this.syncConfig();
  }

  /** Recomputes the physics config from the placements and refreshes the socket markers. */
  private syncConfig(): void {
    const placed: Placement[] = [...this.parts.values()]
      .filter((p) => p.socketId)
      .map((p) => ({ part: p.def.kind, socketId: p.socketId as string, flipped: p.flipped }));
    this.config = configFromPlacements(placed);
    this.refreshMarkers();
    this.scheduleTrajectory();
  }

  private glowSatisfied(id: string): boolean {
    if (id === 'R1') return this.config.ramp === 'down-right';
    if (id === 'string-A') return this.config.scissors === 'A';
    const m = /^slot-(\d+)$/.exec(id);
    return m ? this.config.slots.includes(Number(m[1])) : false;
  }

  private refreshMarkers(): void {
    const taken = new Set(this.occupiedSockets());
    if (this.hintGlow && this.glowSatisfied(this.hintGlow)) this.hintGlow = null;
    if (this.ghost && this.glowSatisfied(this.ghost.socketId)) this.setGhost(null);
    for (const [id, m] of this.markers) {
      m.marker.setVisible(!taken.has(id));
      m.glow.setVisible(this.hintGlow === id);
    }
  }

  // ---------------------------------------------------------------- hint rungs 4-5 and the break-point marker

  /** Step 5: a translucent ghost of the right part, in the right orientation, pulsing in its socket until it is placed. */
  private setGhost(next: NextNeeded | null): void {
    if (this.ghostView) {
      this.tweens.killTweensOf(this.ghostView);
      this.ghostView.destroy();
      this.ghostView = null;
    }
    this.ghost = next;
    const socket = next ? L20_SOCKETS.find((s) => s.id === next.socketId) : undefined;
    const def = next ? PARTS.find((d) => d.id === next.partId) : undefined;
    if (!next || !socket || !def) {
      this.ghost = null;
      return;
    }
    const view = eggArt(this, def.art, socket.x, socket.y).setDepth(13).setAlpha(0.5);
    this.tweens.add({ targets: view, alpha: 0.22, duration: 650, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.ghostView = view;
  }

  /** Step 6: Bip places ONE correct part, tweening it from the tray (or from the wrong socket it frees first) into the socket. */
  private bipPlace(next: NextNeeded, run: number): void {
    const part = this.parts.get(next.partId);
    const socket = L20_SOCKETS.find((s) => s.id === next.socketId);
    if (!part || !socket) return;
    this.hideBreakPoint();
    if (part.socketId) this.release(part);
    part.flipped = false;
    this.tweens.killTweensOf(part.container);
    part.container.setAngle(0);
    this.applyHit(part, 1);
    this.place(part, socket.id, socket.x, socket.y, BIP_PLACE_MS, 'Sine.easeInOut');
    this.bipPlaced.push({ part: part.def.id, socketId: socket.id, run });
    this.tweens.add({ targets: this.robotView, angle: { from: -5, to: 5 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.robotView.setAngle(0) });
  }

  /** The pulsing circle where the chain first stopped; cosmetic. */
  private showBreakPoint(bp: BreakPoint | null): void {
    this.hideBreakPoint();
    if (!bp) return;
    this.breakPoint = bp;
    const g = this.add.graphics().setDepth(16).setPosition(bp.x, bp.y);
    g.fillStyle(0xff7043, 0.18);
    g.fillCircle(0, 0, BREAK_RADIUS);
    g.lineStyle(7, 0xff7043, 0.95);
    g.strokeCircle(0, 0, BREAK_RADIUS);
    this.tweens.add({ targets: g, scale: { from: 0.82, to: 1.12 }, alpha: { from: 1, to: 0.55 }, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.breakView = g;
  }

  private hideBreakPoint(): void {
    this.breakPoint = null;
    if (!this.breakView) return;
    this.tweens.killTweensOf(this.breakView);
    this.breakView.destroy();
    this.breakView = null;
  }

  // ---------------------------------------------------------------- trajectory preview (ladder step 4 and later)

  /** Turns the preview on (from the 4th failure) and draws the path of the current setup at once. */
  private enableTrajectory(): void {
    this.trajectoryOn = true;
    this.refreshTrajectory();
  }

  /** The board changed: redraw the path once she stops touching it (debounced, never every drag frame). */
  private scheduleTrajectory(): void {
    if (!this.trajectoryOn || !this.alive) return;
    this.trajectoryTimer?.remove(false);
    this.trajectoryTimer = this.time.delayedCall(TRAJ_DEBOUNCE_MS, () => {
      this.trajectoryTimer = null;
      if (!this.alive || !this.trajectoryOn) return;
      if (this.dragging) this.scheduleTrajectory();
      else if (this.phase === 'build') this.refreshTrajectory();
    });
  }

  /** The path of the CURRENT placements from a fresh headless world (the same code as Play; cached by config), drawn as soft dots. */
  private refreshTrajectory(): void {
    this.trajectoryTimer?.remove(false);
    this.trajectoryTimer = null;
    const matter = (Phaser.Physics.Matter as unknown as { Matter: L20Matter }).Matter;
    this.trajectoryPoints = trajectoryFor(matter, this.config);
    const dots = dotsAlong(this.trajectoryPoints, TRAJ_SPACING);
    const g = this.trajectoryView ?? this.add.graphics().setDepth(TRAJ_DEPTH);
    this.trajectoryView = g;
    g.clear();
    dots.forEach((d, i) => {
      const t = dots.length > 1 ? i / (dots.length - 1) : 0;
      const alpha = 0.85 - 0.5 * t;
      g.fillStyle(0xffffff, alpha * 0.45);
      g.fillCircle(d.x, d.y, TRAJ_DOT + 3);
      g.fillStyle(TRAJ_COLOR, alpha);
      g.fillCircle(d.x, d.y, TRAJ_DOT);
    });
    g.setVisible(this.phase === 'build');
  }

  private trajectoryInfo(): NonNullable<WorkshopL20Info['trajectory']> {
    const pts = this.trajectoryPoints;
    return { points: pts.length, visible: this.trajectoryView?.visible === true, first: { ...pts[0] }, last: { ...pts[pts.length - 1] } };
  }

  private hideTrajectory(): void {
    this.trajectoryTimer?.remove(false);
    this.trajectoryTimer = null;
    this.trajectoryView?.setVisible(false);
  }

  // ---------------------------------------------------------------- rest pose and sync

  /** Every moving thing at its rest pose: a fresh board, as at the start and after a failed run. */
  private restViews(): void {
    this.sandbagView.setPosition(SANDBAG.x, SANDBAG.y).setRotation(0).setScale(1);
    this.lanternView.setPosition(LANTERN.x, LANTERN.y).setRotation(0);
    this.seesawView.setPosition(PIVOT.x, PIVOT.y).setRotation(SEESAW_REST_ANGLE);
    for (const [label, v] of this.dominoViews) v.setPosition(Number(label.slice(3)), DOMINO_Y).setRotation(0);
    for (const part of this.parts.values()) {
      if (part.def.kind === 'domino' && part.socketId) {
        const x = Number(part.socketId.slice(5));
        part.container.setPosition(x, DOMINO_Y).setRotation(0);
      }
    }
    this.ballView.setPosition(BALL_START.x, BALL_START.y).setRotation(0).setVisible(true);
    this.cutDone = { A: false, B: false };
    for (const k of ['A', 'B'] as const) {
      this.stubs[k]?.destroy();
      this.pieces[k]?.destroy();
      delete this.stubs[k];
      delete this.pieces[k];
      this.stubLength[k] = STUB_FULL;
    }
    this.ropeA.setVisible(true);
    this.ropeB.setVisible(true);
    this.syncRopes(null);
    this.morningBell.setRotation(0);
    this.cocoBell.setAngle(0);
    for (const part of this.parts.values()) {
      if (part.def.kind === 'scissors') part.container.setAlpha(1);
    }
    this.snipSprite?.destroy();
    this.snipSprite = null;
  }

  /** The rope end at the top of a hung object's image: 48 px above the image centre, which is `offset` above the body centre. */
  private imageTop(body: { position: { x: number; y: number }; angle: number }, offset: number, imageHalf: number): { x: number; y: number } {
    const up = offset + imageHalf;
    return { x: body.position.x + up * Math.sin(body.angle), y: body.position.y - up * Math.cos(body.angle) };
  }

  private syncRopes(world: L20World | null): void {
    const a = world ? this.imageTop(world.bodies.sandbag, SANDBAG_OFFSET, displaySize('ws-sandbag').h / 2) : { x: SANDBAG.x, y: ROPE_A.bottom };
    const b = world ? this.imageTop(world.bodies.lantern, LANTERN_OFFSET, displaySize('ws-lantern').h / 2) : { x: LANTERN.x, y: ROPE_B.bottom };
    const aAngle = world ? world.bodies.sandbag.angle : 0;
    const bAngle = world ? world.bodies.lantern.angle : 0;
    for (const [key, rope, end, angle, piece] of [['A', this.ropeA, a, aAngle, PIECE_A], ['B', this.ropeB, b, bAngle, PIECE_B]] as const) {
      if (this.cutDone[key]) {
        // Below the cut: a short piece rides on the object. Above: the stub (updateRopeStubs).
        rope.setVisible(false);
        const top = { x: end.x + piece * Math.sin(angle), y: end.y - piece * Math.cos(angle) };
        let p = this.pieces[key];
        if (!p) {
          p = new RopeView(this, 8);
          this.pieces[key] = p;
        }
        p.set(top.x, top.y, end.x, end.y);
      } else {
        const x = key === 'A' ? SANDBAG.x : LANTERN.x;
        rope.set(x, 60, end.x, end.y);
      }
    }
  }

  private updateRopeStubs(): void {
    for (const key of ['A', 'B'] as const) {
      const stub = this.stubs[key];
      if (stub) stub.set(key === 'A' ? SANDBAG.x : LANTERN.x, 60, key === 'A' ? SANDBAG.x : LANTERN.x, 60 + this.stubLength[key]);
    }
  }

  private syncViews(): void {
    const w = this.world;
    if (!w) return;
    const put = (c: Phaser.GameObjects.Container, b: { position: { x: number; y: number }; angle: number }): void => {
      c.setPosition(b.position.x, b.position.y).setRotation(b.angle);
    };
    put(this.sandbagView, w.bodies.sandbag);
    put(this.lanternView, w.bodies.lantern);
    put(this.seesawView, w.bodies.seesaw);
    for (const d of w.bodies.dominoes) {
      const view = this.dominoViewFor(d.label);
      if (view) put(view, d);
    }
    if (w.bodies.ball) put(this.ballView, w.bodies.ball);
    this.syncRopes(w);
  }

  /** A domino body's view: a fixed domino's own image, or the placed part sitting in that slot. */
  private dominoViewFor(label: string): Phaser.GameObjects.Container | undefined {
    const fixed = this.dominoViews.get(label);
    if (fixed) return fixed;
    const x = Number(label.slice(3));
    return [...this.parts.values()].find((p) => p.def.kind === 'domino' && p.socketId === `slot-${x}`)?.container;
  }

  // ---------------------------------------------------------------- play

  private onPlay(): void {
    if (this.phase !== 'build' || this.dragging || !this.alive) return;
    this.cutIntro();
    this.context.audio.stopAll();
    this.hideBreakPoint();
    this.hideTrajectory();
    this.ghostView?.setVisible(false);
    this.phase = 'playing';
    this.accumulator = 0;
    this.eventsSeen = 0;
    const token = ++this.runToken;
    this.playBtn.setEnabled(false);
    const matter = (Phaser.Physics.Matter as unknown as { Matter: L20Matter }).Matter;
    // A fresh engine for every Play; the 60 settle steps run before the cut (invisible: the objects only settle on their ropes).
    this.restViews();
    this.world = new L20World(matter, { ...this.config, slots: [...this.config.slots] });
    this.syncViews();
    this.ballView.setVisible(false);
    const scissors = this.parts.get('scissors');
    const cutting = this.config.scissors !== 'none';
    if (cutting) this.playSnip(scissors);
    this.time.delayedCall(cutting ? SNIP_MS : 120, () => {
      if (!this.alive || token !== this.runToken || !this.world) return;
      this.releaseWorld();
    });
  }

  /** The scissors snip at the top of the string: the 2-frame strip (open, closed, open) or a scaleX squeeze. */
  private playSnip(part: PartView | undefined): void {
    if (!part) return;
    playEggSfx('sfx-ws-snip');
    const spec = ensureSpriteAnim(this, 'ws-scissors-snip');
    if (spec) {
      const sprite = this.add.sprite(part.container.x, part.container.y, 'ws-scissors-snip', '0').setDisplaySize(spec.w, spec.h).setDepth(15);
      this.snipSprite = sprite;
      part.container.setAlpha(0);
      if (!this.anims.exists('ws-scissors-snip-cycle')) {
        this.anims.create({ key: 'ws-scissors-snip-cycle', frames: [{ key: 'ws-scissors-snip', frame: '0' }, { key: 'ws-scissors-snip', frame: '1' }, { key: 'ws-scissors-snip', frame: '0' }], frameRate: spec.fps });
      }
      sprite.play('ws-scissors-snip-cycle');
    } else {
      this.tweens.add({ targets: part.container, scaleX: 0.6, duration: 80, yoyo: true, ease: 'Sine.easeInOut', onComplete: () => part.container.setScale(1) });
    }
  }

  /** The cut and the release of the ball happen on the same step (like the sim); then the run is stepped by `update`. */
  private releaseWorld(): void {
    const w = this.world;
    if (!w) return;
    const which = this.config.scissors;
    w.cut();
    w.release();
    if (which !== 'none') {
      this.cutDone[which] = true;
      this.stubLength[which] = STUB_FULL;
      this.stubs[which] = new RopeView(this, 8);
      this.tweens.add({ targets: this.stubLength, [which]: STUB_SHORT, duration: 300, ease: 'Sine.easeOut' });
      playEggSfx('sfx-ws-rope-swish');
    }
    playEggSfx('sfx-ws-trapdoor');
    playEggSfx('sfx-ball-roll');
    this.ballView.setVisible(true);
    this.consumeEvents();
    this.syncViews();
  }

  /** Turns the world's new events into sound and tweens. Cosmetic only: nothing here touches a body. */
  private consumeEvents(): void {
    const w = this.world;
    if (!w) return;
    while (this.eventsSeen < w.events.length) {
      const e = w.events[this.eventsSeen++];
      const [kind, a, b] = e.id.split(':');
      if (kind === 'domino' && b === 'fallen') {
        const pitch = 1 + (((Number(a) * 7) % 17) - 8) / 100;
        playEggSfx('sfx-ws-domino-clack', { pitch });
      } else if (e.id === 'sandbag:hit-seesaw') {
        playEggSfx('sfx-ws-sandbag-thump');
        this.tweens.add({ targets: this.sandbagView, scaleY: { from: 0.85, to: 1 }, duration: 150 });
        this.time.delayedCall(120, () => playEggSfx('sfx-ws-seesaw-creak'));
      } else if (kind === 'bell' && a === 'coco') {
        playEggSfx('sfx-bell');
        this.tweens.add({ targets: this.cocoBell, angle: { from: -14, to: 14 }, duration: 110, yoyo: true, repeat: 5, onComplete: () => this.cocoBell.setAngle(0) });
        this.twitchFriends('coco');
      } else if (kind === 'bell' && a === 'morning') {
        playEggSfx('sfx-ws-bell-morning');
        this.ringMorningBell();
        this.twitchFriends('morning');
      } else if (e.id === 'lantern:floor') {
        playEggSfx('sfx-ws-lantern-clonk');
      }
    }
  }

  private twitchFriends(bell: 'coco' | 'morning'): void {
    for (const id of BELL_FRIENDS[bell]) this.sleepers.get(id)?.twitch();
  }

  /** Swing +-18 degrees about the hook, 3 swings in 1.2 s, plus two expanding sound arcs. */
  private ringMorningBell(): void {
    this.tweens.add({ targets: this.morningBell, angle: { from: -18, to: 18 }, duration: 200, yoyo: true, repeat: 5, onComplete: () => this.morningBell.setAngle(0) });
    for (let i = 0; i < 2; i++) {
      const arc = this.add.graphics().setDepth(11).setPosition(MORNING_BELL.x, MORNING_BELL.y);
      arc.lineStyle(5, 0xf2b632, 1);
      arc.strokeCircle(0, 0, BELL_RADIUS);
      this.tweens.add({ targets: arc, scale: 2.4, alpha: 0, duration: 900, delay: i * 250, ease: 'Sine.easeOut', onComplete: () => arc.destroy() });
    }
  }

  // ---------------------------------------------------------------- run end

  private onRunEnd(): void {
    const w = this.world;
    if (!w || this.phase !== 'playing') return;
    this.lastRun = { run: { ...w.run }, events: w.events.map((e) => ({ ...e })) };
    if (w.run.result === 'win') this.onWin();
    else this.onFail(w);
  }

  // ---------------------------------------------------------------- failure

  private onFail(w: L20World): void {
    this.phase = 'feedback';
    this.failedRuns++;
    const reason = w.run.reason ?? 'no-bell';
    if (reason === 'coco-only' || reason === 'morning-only') this.oneBellFails++;
    const plan: FailPlan = planFailure({
      failedRuns: this.failedRuns,
      oneBellFails: reason === 'coco-only' || reason === 'morning-only' ? this.oneBellFails : 0,
      reason,
      dominoRowStopped: w.dominoRowStopped,
      config: this.config,
      parts: [...this.parts.values()].map((p) => ({ id: p.def.id, kind: p.def.kind, socketId: p.socketId, flipped: p.flipped })),
    });
    this.hintRung = plan.rung;
    this.setGhost(plan.ghost);
    if (plan.trajectory) this.trajectoryOn = true;
    this.showBreakPoint(chooseBreakPoint({ reason, events: w.events, config: this.config }));
    this.feedback = {
      kind: plan.feedback.kind,
      sleepersFallAsleep: plan.feedback.sleepersFallAsleep,
      capybara: plan.feedback.capybara,
      sfx: plan.feedback.sfx,
      voices: plan.voices,
    };
    if (plan.hint) this.hintsGiven++;
    // No buzzer, ever: the friends who woke fall asleep again with a yawn, the capybara mimes, Bip speaks.
    for (const id of plan.feedback.sleepersFallAsleep) this.sleepers.get(id)?.wakeThenSleepAgain();
    if (plan.feedback.sfx) playEggSfx(plan.feedback.sfx as EggSfx);
    this.capybaraPose(plan.feedback.capybara, 1500);
    void this.playVoices(plan.voices);
    this.hintGlow = plan.hint?.glow ?? null;
    this.refreshMarkers();
    const token = this.runToken;
    this.time.delayedCall(FEEDBACK_MS, () => {
      if (!this.alive || token !== this.runToken || this.phase !== 'feedback') return;
      this.restViews();
      this.world = null;
      this.phase = 'build';
      this.playBtn.setEnabled(true);
      this.ghostView?.setVisible(true);
      // Step 4+: the dotted path of the current setup comes back after the run (the 4th failure beeps once for the new dots).
      if (plan.trajectory) {
        this.enableTrajectory();
        if (plan.trajectorySfx) playEggSfx(plan.trajectorySfx);
      }
      // Step 6: Bip places ONE part (never presses Play); the rest stays hers.
      if (plan.bip) {
        if (plan.bipSfx) playEggSfx(plan.bipSfx);
        this.bipPlace(plan.bip, this.failedRuns);
      }
    });
    this.playBtn.setEnabled(false);
  }

  /** Plays the lines one after another; a new Play (stopAll) or leaving the scene ends the chain. */
  private async playVoices(ids: string[]): Promise<void> {
    const token = this.runToken;
    for (const id of ids) {
      if (!this.alive || token !== this.runToken) return;
      await this.speak(id);
      await delay(250);
    }
  }

  // ---------------------------------------------------------------- capybara

  /** The capybara's mime: the pose art when it loaded, else a tween on the base art. */
  private capybaraPose(pose: Exclude<CapyPose, 'idle'>, ms: number): void {
    this.capyPose = pose;
    this.capyBob?.pause();
    this.capy.y = CAPYBARA.y;
    this.time.delayedCall(ms, () => {
      if (!this.alive) return;
      this.capy.y = CAPYBARA.y;
      this.capyBob?.resume();
    });
    const key = `ws-capybara-${pose}`;
    const baseY = CAPYBARA.y;
    if (eggAvailability.isReady(key) && this.textures.exists(key)) {
      const art = eggArt(this, key, this.capy.x, this.capy.y).setScale(CAPYBARA.scale).setDepth(11);
      this.capy.setVisible(false);
      this.time.delayedCall(ms, () => {
        if (!this.alive) return;
        art.destroy();
        this.capy.setVisible(true);
        this.capyPose = 'idle';
      });
      if (pose === 'cheer') this.tweens.add({ targets: art, y: art.y - 26, duration: 180, yoyo: true, repeat: 3, ease: 'Sine.easeOut' });
      if (pose === 'ring') this.tweens.add({ targets: art, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 7, onComplete: () => art.setAngle(0) });
      return;
    }
    if (pose === 'ring') {
      this.tweens.add({ targets: this.capy, angle: { from: -8, to: 8 }, duration: 90, yoyo: true, repeat: 7, onComplete: () => this.capy.setAngle(0) });
    } else if (pose === 'cheer') {
      this.tweens.add({ targets: this.capy, y: baseY - 30, duration: 180, yoyo: true, repeat: 3, ease: 'Sine.easeOut' });
    } else {
      this.tweens.add({ targets: this.capy, scaleY: CAPYBARA.scale * 0.9, angle: -6, duration: 300, yoyo: true, hold: ms - 700, ease: 'Sine.easeInOut', onComplete: () => this.capy.setAngle(0).setScale(CAPYBARA.scale) });
    }
    this.time.delayedCall(ms, () => {
      if (this.alive) this.capyPose = 'idle';
    });
  }

  // ---------------------------------------------------------------- win

  private onWin(): void {
    this.phase = 'success';
    const token = ++this.runToken;
    this.playBtn.setEnabled(false);
    this.setGhost(null);
    this.hintGlow = null;
    this.refreshMarkers();
    // Progress: the egg piece is the final shell piece, set once.
    const saved = recordEggPieceAndSave(window.localStorage, this.profileId);
    this.progress = saved.progress;

    // Everyone wakes, staggered 150 ms; the town crossfades to morning; confetti; the capybara cheers.
    SLEEPERS.forEach((s, i) => this.sleepers.get(s.id)?.wakeUp(i * 150));
    this.crossfadeToMorning();
    playEggSfx('sfx-ws-town-wake');
    this.confetti();
    this.capybaraPose('cheer', 1800);
    this.robot.cheer();
    this.time.delayedCall(600, () => this.glowNest());
    this.time.delayedCall(1500, () => {
      if (this.alive && token === this.runToken) this.flyEggPiece();
    });

    // Voice: the chorus, then Lumi's bravo (as the piece flies), then Bip's optional line when it lands.
    const voices = (async (): Promise<void> => {
      await this.speak('vo-fr-ws-l20-bonjour');
      await delay(300);
      if (!this.alive || token !== this.runToken) return;
      await this.speak('vo-fr-ws-l20-success');
      await delay(300);
      if (!this.alive || token !== this.runToken) return;
      await this.speak('vo-he-ws-egg-piece');
    })();
    this.cancelContinue?.();
    this.cancelContinue = showContinueAfterVoice(voices, () => {
      this.cancelContinue = null;
      if (this.alive && token === this.runToken) this.addContinue();
    });
  }

  private crossfadeToMorning(): void {
    this.morningShown = true;
    this.tweens.add({ targets: this.bgMorning, alpha: 1, duration: 1200, ease: 'Sine.easeInOut' });
  }

  private glowNest(): void {
    if (!this.alive) return;
    const halo = this.add.graphics().setDepth(9).setPosition(EGG_NEST.x, EGG_NEST.y - 6);
    for (let i = 0; i < 4; i++) {
      halo.fillStyle(0xfff2a8, 0.18);
      halo.fillCircle(0, 0, 40 + i * 18);
    }
    this.tweens.add({ targets: halo, alpha: 0.5, scale: 1.15, duration: 600, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.tweens.add({ targets: this.nest, angle: { from: -4, to: 4 }, duration: 160, yoyo: true, repeat: 5, onComplete: () => this.nest.setAngle(0) });
  }

  /** `ws-egg-piece` flies from the morning bell to the nest: an arc, 720 degrees of spin, scale 1.2 -> 0.6, 1.1 s. */
  private flyEggPiece(): void {
    const piece = eggArt(this, 'ws-egg-piece', MORNING_BELL.x, MORNING_BELL.y).setDepth(900).setScale(1.2);
    const from = { x: MORNING_BELL.x, y: MORNING_BELL.y };
    const to = { x: EGG_NEST.x, y: EGG_NEST.y };
    const t = { v: 0 };
    this.tweens.add({
      targets: t,
      v: 1,
      duration: 1100,
      ease: 'Sine.easeInOut',
      onUpdate: () => {
        piece.setPosition(from.x + (to.x - from.x) * t.v, from.y + (to.y - from.y) * t.v - Math.sin(Math.PI * t.v) * 120);
        piece.setAngle(720 * t.v);
        piece.setScale(1.2 - 0.6 * t.v);
      },
      onComplete: () => {
        piece.destroy();
        if (!this.alive) return;
        playEggSfx('sfx-success');
        // The egg is complete: the full-glow nest takes over with a pop.
        const bigger = eggArt(this, 'egg-nest-5', EGG_NEST.x, EGG_NEST.y).setScale(EGG_NEST.scale).setDepth(10);
        this.nest.destroy();
        this.nest = bigger;
        this.tweens.add({ targets: bigger, scale: { from: EGG_NEST.scale * 1.3, to: EGG_NEST.scale }, duration: 420, ease: 'Back.easeOut' });
        this.tweens.add({ targets: bigger, angle: { from: -5, to: 5 }, duration: 220, yoyo: true, repeat: 3, onComplete: () => bigger.setAngle(0) });
        this.eggPieceInNest = true;
      },
    });
  }

  /** Confetti from the `confetti` strip (a tinted square while it is missing), exploding from the morning bell's side. */
  private confetti(): void {
    const colors = [0xff5252, 0xffd93d, 0x4d96ff, 0x6bcb77, 0xff6fb5, 0x9b5de5];
    const strip = ensureSpriteFrames(this, 'confetti');
    const frameWidth = strip ? this.textures.getFrame('confetti', '0').width : 0;
    const drawn = strip && frameWidth > 0 ? strip.w / frameWidth : 1;
    const emitter = this.add.particles(640, 420, strip ? 'confetti' : this.confettiTexture(), {
      ...(strip ? { frame: Array.from({ length: strip.frames }, (_, i) => String(i)) } : { tint: colors }),
      speed: { min: 240, max: 620 },
      angle: { min: 205, max: 335 },
      gravityY: 800,
      lifespan: 2200,
      rotate: { min: 0, max: 360 },
      scale: { start: drawn, end: drawn * 0.6 },
      emitting: false,
    });
    playEggSfx('sfx-pop');
    emitter.setDepth(250);
    emitter.explode(80);
    this.time.delayedCall(2600, () => emitter.destroy());
  }

  private confettiTexture(): string {
    const key = 'egg-confetti-px';
    if (!this.textures.exists(key)) {
      const g = this.add.graphics();
      g.fillStyle(0xffffff, 1);
      g.fillRect(0, 0, 16, 10);
      g.generateTexture(key, 16, 10);
      g.destroy();
    }
    return key;
  }

  private addContinue(): void {
    if (!this.alive || this.continueBtn) return;
    const btn = makeButton(this, 640, 640, 180, 112, drawArrowIcon, () => this.goHub());
    btn.container.setDepth(1000);
    this.tweens.add({ targets: btn.container, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.continueBtn = btn;
    this.buttons.set('continueBtn', btn);
  }

  // ---------------------------------------------------------------- leaving

  private goHub(): void {
    this.context.sfx.tap();
    transitionTo(this, 'MysteryEggScene', { style: 'fade' });
  }

  private goBack(): void {
    this.context.sfx.tap();
    transitionTo(this, 'MysteryEggScene', { style: 'fade' });
  }

  // ---------------------------------------------------------------- e2e read hook

  /** ?e2e=1 read hook: state and page-px rectangles of everything the child can tap or drag. Reads only. */
  getWorkshopL20Info(): WorkshopL20Info {
    const rects: WorkshopL20Info['rects'] = {};
    for (const [target, b] of this.buttons) {
      if (b.ready) rects[target] = boardRectToPage(this, b.container.x, b.container.y, b.width, b.height);
    }
    rects.bunny = boardRectToPage(this, this.bunny.x, this.bunny.y, 120, 200);
    const targetOf = { ramp: 'partRamp', domino1: 'partDomino1', domino2: 'partDomino2', scissors: 'partScissors' } as const;
    const parts: WorkshopL20Info['parts'] = [];
    for (const part of this.parts.values()) {
      const c = part.container;
      const rect = boardRectToPage(this, c.x, c.y, c.width * Math.abs(c.scaleX), c.height * Math.abs(c.scaleY));
      rects[targetOf[part.def.id]] = rect;
      const atHome = Math.abs(c.x - part.def.home.x) < 2 && Math.abs(c.y - part.def.home.y) < 2;
      parts.push({ id: part.def.id, kind: part.def.kind, x: c.x, y: c.y, socketId: part.socketId, inTray: !part.socketId && this.dragging?.part !== part && atHome, flipped: part.flipped, rect });
    }
    const taken = new Map<string, string>();
    for (const part of this.parts.values()) if (part.socketId) taken.set(part.socketId, part.def.id);
    const sockets: WorkshopL20Info['sockets'] = L20_SOCKETS.map((s) => {
      const rect = boardRectToPage(this, s.x, s.y, s.type === 'ramp' ? 240 : 60, s.type === 'ramp' ? 140 : 60);
      rects[`socket-${s.id}`] = rect;
      return { id: s.id, type: s.type, accepts: s.accepts, x: s.x, y: s.y, occupiedBy: taken.get(s.id) ?? null, glowing: this.hintGlow === s.id, rect };
    });
    const sleepers = {} as WorkshopL20Info['sleepers'];
    for (const [id, v] of this.sleepers) sleepers[id] = { state: v.state, history: [...v.history] };
    const w = this.world;
    return {
      scene: 'WorkshopL20Scene',
      level: 20,
      phase: this.phase,
      ready: this.ready,
      introDone: this.introDone,
      failedRuns: this.failedRuns,
      hintsGiven: this.hintsGiven,
      eggPiece: this.progress?.eggPiece === true,
      eggLevel: this.progress ? eggLevel(this.progress) : 0,
      config: { ...this.config, slots: [...this.config.slots] },
      sockets,
      parts,
      lastDrop: this.lastDrop,
      run: w ? { ...w.run } : (this.lastRun?.run ?? { state: 'idle', result: null, reason: null, endStep: null }),
      events: w ? w.events.map((e) => ({ ...e })) : (this.lastRun?.events ?? []),
      sleepers,
      background: this.morningShown ? 'morning' : 'dawn',
      capybara: this.capyPose,
      feedback: this.feedback,
      hintGlow: this.hintGlow,
      hintRung: this.hintRung,
      ghost: this.ghost ? { part: this.ghost.partId, socketId: this.ghost.socketId, orientation: this.ghost.orientation } : null,
      trajectory: this.trajectoryPoints.length > 0 ? this.trajectoryInfo() : null,
      bipPlaced: this.bipPlaced.map((b) => ({ ...b })),
      breakPoint: this.breakPoint ? { ...this.breakPoint } : null,
      eggPieceInNest: this.eggPieceInNest,
      partsInTrayCount: parts.filter((p) => p.inTray).length,
      rects,
    };
  }
}

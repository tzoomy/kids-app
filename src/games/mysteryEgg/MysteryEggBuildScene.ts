// Mystery Egg mission 1.1 (docs/specs/mystery-egg.md): intro, build, play, help and success on one Matter.js board.
// Physics (Matter) is enabled for THIS scene only, through the scene config below; other scenes are untouched.
// The simulation is stepped here at a fixed 60 Hz (autoUpdate off), so outcomes do not depend on frame times.
// Logic lives in pure modules: snap.ts (drops), run.ts (outcome, failed runs, hints), machine.ts (bodies), progress.ts.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { transitionTo } from '../../anim/transitions';
import { floatIdle } from '../../anim/tweens';
import { assetEntry, displaySize } from './assets';
import { createRobot, ensureSpriteAnim, ensureSpriteFrames, eggArt, playSpriteOnce, panel, type RobotView } from './art';
import { boardRectToPage, fitBoard } from './boardView';
import { loadEggAssets } from './eggAssetLoader';
import { playEggSfx } from './eggSound';
import { BALL, BELL, BOARD, FLOOR, PIT_WALL, RAMP_BODY, RAMP_SLOT, RIGHT_WALL, SHELF, SLOTS, TABLE, BED, heartSlotCentres } from './layout';
import { Machine, RUN_WATCHER_CONFIG, type MatterLib } from './machine';
import { HEART_SLOT_COUNT, eggLevel, litHearts, loadProgress, recordMissionAndSave, type MysteryEggProgress } from './progress';
import { EAR_LINE_ID, RunWatcher, STEP_MS, createRunTracker, isNearMiss, recordRun, type HintDue, type RunResult, type RunTrackerState } from './run';
import { resolveDrop, type PartKind } from './snap';
import type { EggPhase, EggTarget, MysteryEggInfo } from './types';
import { IntroVoice, type VoiceAction } from './introVoice';
import { drawArrowIcon, drawEarIcon, drawHomeIcon, drawPlayIcon, goalCard, makeButton, speechCue, type EggButton } from './ui';

const MISSION_ID = '1.1';
/** Display scale of each tray part, and its home in the tray (board px). */
const TRAY = { x: 540, y: 722, w: 600, h: 140 } as const;
// Manifest display sizes (half of the 2x files): ball 64, ramp 240x140, bell 96x110. Tray parts are drawn larger (big touch targets).
const PART_HOME: Record<PartKind, { x: number; y: number; scale: number }> = {
  ball: { x: 340, y: 722, scale: 1.6 },
  ramp: { x: 540, y: 722, scale: 0.95 },
  bell: { x: 740, y: 722, scale: 1.1 },
};
const BALL_SCALE = (BALL.radius * 2) / displaySize('part-ball').w;
const BELL_SCALE = (BELL.radius * 2 + 8) / displaySize('part-bell').w;
const CAT_POS = { x: BED.x + 20, y: 290 } as const;
/** The cat art is drawn at 1.15x; asleep and awake/wake art share the bed line (their bottoms line up). */
const CAT_SCALE = 1.15;
const CAT_BOTTOM = CAT_POS.y + (displaySize('cat-asleep').h * CAT_SCALE) / 2;
const CAT_AWAKE_Y = CAT_BOTTOM - (displaySize('cat-awake').h * CAT_SCALE) / 2;
/** The heart panel in the success view: 1.5x its 1x manifest size. */
const HEART_VIEW = { x: 640, y: 150, scale: 1.5 } as const;
/** The cat wake-up holds its last frame this long before swapping to the awake art. */
const CAT_WAKE_HOLD_MS = 500;
const ROBOT_POS = { x: 1170, y: 660 } as const;
const EAR_POS = { x: 1170, y: 500 } as const;
const PLAY_POS = { x: 955, y: 725, w: 210, h: 120 } as const;
const MAX_STEPS_PER_FRAME = 6;
const MAX_FRAME_MS = 100;

interface PartView {
  kind: PartKind;
  container: Phaser.GameObjects.Container;
  /** Slot the part sits in, if any. */
  slotId: string | null;
}

export class MysteryEggBuildScene extends Phaser.Scene {
  private context!: AppContext;
  private profileId = '';
  private progress!: MysteryEggProgress;
  private phase: EggPhase = 'intro';
  private ready = false;
  private alive = false;

  private machine!: Machine;
  private watcher = new RunWatcher(RUN_WATCHER_CONFIG);
  private tracker: RunTrackerState = createRunTracker();
  private accumulator = 0;

  private ballView!: Phaser.GameObjects.Container;
  private catView!: Phaser.GameObjects.Container;
  private bellView!: Phaser.GameObjects.Container;
  private robot!: RobotView;
  private robotView!: Phaser.GameObjects.Container;
  private introVoice = new IntroVoice();
  private bunnyView!: Phaser.GameObjects.Container;
  private slotGlow!: Phaser.GameObjects.Container;
  private hintPointer: Phaser.GameObjects.Container | null = null;
  private hintActive = false;
  private readonly parts = new Map<PartKind, PartView>();
  private readonly occupied = new Set<string>();
  private dragging: { part: PartView; dx: number; dy: number } | null = null;
  private playBtn!: EggButton;
  private readonly buttons = new Map<EggTarget, EggButton>();
  private introLayer: Phaser.GameObjects.Container | null = null;
  private continueBtn: EggButton | null = null;
  private featherArrived = false;
  private successToken = 0;

  constructor() {
    super({
      key: 'MysteryEggBuildScene',
      // Matter for this scene only. autoUpdate is off: update() steps the engine at a fixed 60 Hz.
      physics: { default: 'matter', matter: { gravity: { x: 0, y: 1 }, autoUpdate: false, debug: false } },
    });
  }

  // ---------------------------------------------------------------- lifecycle

  create(): void {
    setAppScreen('mystery-egg-build');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.profileId = this.context.requireProfileId();
    this.progress = loadProgress(window.localStorage, this.profileId);
    this.phase = 'intro';
    this.ready = false;
    this.alive = true;
    this.watcher = new RunWatcher(RUN_WATCHER_CONFIG);
    this.tracker = createRunTracker();
    this.accumulator = 0;
    this.hintPointer = null;
    this.hintActive = false;
    this.parts.clear();
    this.occupied.clear();
    this.buttons.clear();
    this.dragging = null;
    this.introVoice = new IntroVoice();
    this.introLayer = null;
    this.continueBtn = null;
    this.featherArrived = false;
    this.successToken++;
    // The map's DOM chrome (top bar, world labels, egg button) must not stay on top of this canvas scene.
    this.context.shell.clearChrome();
    fitBoard(this, '#f1dcc2');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.input.off('pointermove', this.onPointerMove, this);
      this.input.off('pointerup', this.onPointerUp, this);
      this.context.audio.stopAll();
    });
    loadEggAssets(this, import.meta.env.BASE_URL, () => {
      if (!this.alive) return;
      this.build();
      this.ready = true;
      window.__GAME_READY__ = true;
    });
  }

  update(_time: number, delta: number): void {
    if (this.phase !== 'playing') return;
    // Fixed timestep: a slow frame runs more steps (capped), never a longer step.
    this.accumulator += Math.min(delta, MAX_FRAME_MS);
    let steps = 0;
    while (this.accumulator >= STEP_MS && steps < MAX_STEPS_PER_FRAME && this.phase === 'playing') {
      this.accumulator -= STEP_MS;
      steps++;
      const result = this.watcher.update(this.machine.step());
      if (result.status !== 'running') {
        this.syncBall();
        this.onRunEnd(result);
        return;
      }
    }
    this.syncBall();
  }

  // ---------------------------------------------------------------- build

  private build(): void {
    const matter = (Phaser.Physics.Matter as unknown as { Matter: MatterLib }).Matter;
    this.machine = new Machine(matter, this.matter.world.engine as unknown as { world: unknown });

    this.drawBoard();

    // Cat, bell, ball.
    this.catView = eggArt(this, 'cat-asleep', CAT_POS.x, CAT_POS.y).setDepth(10).setScale(CAT_SCALE);
    this.tweens.add({ targets: this.catView, scaleY: CAT_SCALE * 1.025, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.bellView = eggArt(this, 'part-bell', BELL.x, BELL.y).setDepth(12).setScale(BELL_SCALE);
    this.ballView = eggArt(this, 'part-ball', BALL.x, BALL.y).setDepth(30).setScale(BALL_SCALE);

    // The one glowing slot.
    // The glow hugs the ramp's board (same centre, angle and size the physics body will have).
    this.slotGlow = this.add.container(RAMP_SLOT.x + RAMP_BODY.dx, RAMP_SLOT.y + RAMP_BODY.dy).setDepth(8).setRotation(RAMP_SLOT.angle);
    const glow = this.add.graphics();
    const gw = RAMP_BODY.w + 36;
    const gh = RAMP_BODY.h + 40;
    glow.fillStyle(0xfff176, 0.35);
    glow.fillRoundedRect(-gw / 2, -gh / 2, gw, gh, 16);
    glow.lineStyle(6, 0xffc400, 1);
    glow.strokeRoundedRect(-gw / 2, -gh / 2, gw, gh, 16);
    this.slotGlow.add(glow);
    this.tweens.add({ targets: this.slotGlow, alpha: 0.45, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });

    // Goal card (top-left), friends, tray.
    goalCard(this, 310, 85).setDepth(40);
    // The bunny replays the French request at any time (it sits above the intro overlay while the intro is up).
    this.bunnyView = eggArt(this, 'bunny', 120, 640).setDepth(10).setScale(0.9).setInteractive({ useHandCursor: true });
    this.bunnyView.on('pointerdown', () => this.onBunny());
    this.robot = createRobot(this, ROBOT_POS.x, ROBOT_POS.y);
    this.robotView = this.robot.container.setDepth(10).setScale(1.2);
    floatIdle(this, this.robotView, 6, 1600);
    this.robot.startIdleBlinks();
    panel(this, TRAY.x, TRAY.y, TRAY.w, TRAY.h).setDepth(20);
    for (const kind of ['ball', 'ramp', 'bell'] as const) this.makePart(kind);

    // Buttons: Play, the robot's ear (always available), back to the hub.
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

    this.input.on('pointermove', this.onPointerMove, this);
    this.input.on('pointerup', this.onPointerUp, this);
    this.input.on('gameout', this.onPointerUp, this);

    this.showIntro();
  }

  /** Fixed scenery, drawn from the same layout numbers the physics uses. */
  private drawBoard(): void {
    const wall = this.add.graphics().setDepth(0);
    wall.fillStyle(0xf1dcc2, 1);
    wall.fillRect(-400, -400, BOARD.width + 800, BOARD.height + 800);
    wall.fillStyle(0xe6c9a6, 1);
    for (let x = -200; x < BOARD.width + 200; x += 160) wall.fillRect(x, -400, 6, BOARD.height + 800);

    const plank = (cx: number, cy: number, w: number, h: number, angle = 0, color = 0xb8814f): void => {
      const c = this.add.container(cx, cy).setDepth(5).setRotation(angle);
      const g = this.add.graphics();
      g.fillStyle(color, 1);
      g.fillRoundedRect(-w / 2, -h / 2, w, h, 6);
      g.lineStyle(4, 0x3b2a22, 1);
      g.strokeRoundedRect(-w / 2, -h / 2, w, h, 6);
      c.add(g);
    };
    plank(SHELF.x, SHELF.y, SHELF.w, SHELF.h, SHELF.angle);
    plank(SHELF.x - 100, SHELF.y + 120, 24, 180, 0, 0x9a6b45);
    plank(TABLE.x, TABLE.y, TABLE.w, TABLE.h);
    plank(TABLE.x - 120, TABLE.y + 70, 22, 120, 0, 0x9a6b45);
    plank(RIGHT_WALL.x, RIGHT_WALL.y, RIGHT_WALL.w, RIGHT_WALL.h, 0, 0x9a6b45);
    plank(856, 372, 124, 14, 0, 0x9a6b45); // bracket the bell hangs from
    plank(FLOOR.x, FLOOR.y, FLOOR.w, FLOOR.h, 0, 0x8c6a47);
    plank(PIT_WALL.x, PIT_WALL.y, PIT_WALL.w, PIT_WALL.h, 0, 0x9a6b45);
    const rope = this.add.graphics().setDepth(11);
    rope.lineStyle(5, 0x3b2a22, 1);
    rope.lineBetween(BELL.x, 379, BELL.x, BELL.y - BELL.radius);
  }

  private makePart(kind: PartKind): void {
    const home = PART_HOME[kind];
    const container = eggArt(this, `part-${kind}`, home.x, home.y).setDepth(50).setScale(home.scale);
    container.setInteractive({ useHandCursor: true });
    const part: PartView = { kind, container, slotId: null };
    this.parts.set(kind, part);
    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => this.onPartDown(part, pointer));
    if (kind === 'ramp') this.tweens.add({ targets: container, angle: 3, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
  }

  // ---------------------------------------------------------------- intro

  private showIntro(): void {
    this.phase = 'intro';
    const layer = this.add.container(0, 0).setDepth(500);
    const dim = this.add.rectangle(640, 400, BOARD.width + 800, BOARD.height + 800, 0x2b1d14, 0.6).setInteractive();
    layer.add(dim);
    layer.add(panel(this, 640, 400, 960, 600));
    const cat = eggArt(this, 'cat-asleep', 640, 300).setScale(1.7);
    this.tweens.add({ targets: cat, scaleY: 1.75, duration: 1400, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    layer.add(cat);
    layer.add(goalCard(this, 640, 520).setScale(1.2));
    const go = makeButton(this, 640, 700, 160, 112, drawArrowIcon, () => this.endIntro());
    go.container.setDepth(600);
    this.tweens.add({ targets: go.container, scale: 1.08, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.buttons.set('goBtn', go);
    this.introLayer = layer;
    // The story line first; when it ends the request follows, once (introVoice.ts). Go before that cuts the story and
    // plays the request at build start. The bunny rises above the dim so it can be tapped during the intro.
    this.bunnyView.setDepth(650);
    this.runVoice(this.introVoice.start());
  }

  /** Turns the sequencer's actions into audio calls. A speak of the story chains `storyEnded` when its promise settles. */
  private runVoice(actions: VoiceAction[]): void {
    for (const action of actions) {
      if (action.type === 'stop') {
        this.context.audio.stopAll();
      } else if (action.lineId === 'vo-fr-story') {
        void this.speak('vo-fr-story').then(() => {
          if (this.alive) this.runVoice(this.introVoice.storyEnded());
        });
      } else {
        void this.speak(action.lineId);
      }
    }
  }

  /** The bunny: replays the French request at any time, cutting whatever line is playing first. */
  private onBunny(): void {
    if (!this.alive || this.phase === 'success') return;
    this.tweens.add({ targets: this.bunnyView, angle: { from: -4, to: 4 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.bunnyView.setAngle(0) });
    this.runVoice(this.introVoice.bunnyTapped());
  }

  private endIntro(): void {
    if (this.phase !== 'intro') return;
    this.context.sfx.tap();
    this.buttons.get('goBtn')?.container.destroy();
    this.buttons.delete('goBtn');
    this.introLayer?.destroy();
    this.introLayer = null;
    this.bunnyView.setDepth(10);
    this.phase = 'build';
    // The request must be heard by the time the build starts, even when Go was tapped before the story ended.
    this.runVoice(this.introVoice.goTapped());
  }

  // ---------------------------------------------------------------- voice and help

  /** Requests a manifest voice line (file if it exists, otherwise a chime) and shows a speech cue by the speaker. */
  private speak(lineId: string): Promise<boolean> {
    const entry = assetEntry(lineId);
    if (entry.kind !== 'vo' || !entry.lang || !entry.transcript) return Promise.resolve(false);
    // Any voice other than the intro's own French lines takes the floor: the story must not chain the request after it.
    if (lineId !== 'vo-fr-story' && lineId !== 'vo-fr-instruction') this.introVoice.otherVoice();
    const done = this.context.audio.play({ lineId, lang: entry.lang, text: entry.transcript }).catch(() => false);
    if (entry.lang === 'he' || lineId.startsWith('vo-fr-robot')) speechCue(this, this.robotView.x - 90, this.robotView.y - 190);
    else speechCue(this, this.catView.x - 210, this.catView.y - 110);
    return done;
  }

  /** The robot's ear button: Hebrew help (the goal hint, `vo-he-robot-help-1`) at any time; not a ladder step. */
  private onEar(): void {
    if (!this.alive) return;
    playEggSfx('sfx-robot-beep-2');
    this.tweens.add({ targets: this.robotView, angle: { from: -5, to: 5 }, duration: 90, yoyo: true, repeat: 2, onComplete: () => this.robotView.setAngle(0) });
    void this.speak(EAR_LINE_ID);
  }

  /** One rung of the help ladder (run.ts): the goal hint says it in Hebrew; the slot hint adds the pulsing pointer. */
  private showHint(hint: HintDue): void {
    if (hint.pointer) this.hintActive = true;
    playEggSfx('sfx-robot-beep-1');
    void this.speak(hint.lineId);
    this.refreshHintPointer();
  }

  /** A bobbing arrow pulsing at the empty slot; shown only while the slot is empty. */
  private refreshHintPointer(): void {
    // The glow marks the EMPTY slot: it goes away once the ramp sits in it (and comes back if the ramp is lifted).
    this.slotGlow.setVisible(!this.occupied.has('ramp-slot'));
    const show = this.hintActive && !this.occupied.has('ramp-slot') && this.phase !== 'success';
    if (show && !this.hintPointer) {
      const c = this.add.container(RAMP_SLOT.x, RAMP_SLOT.y - 110).setDepth(300);
      const g = this.add.graphics();
      g.fillStyle(0xff5252, 1);
      g.fillTriangle(-34, -30, 34, -30, 0, 34);
      g.fillRoundedRect(-14, -90, 28, 64, 8);
      g.lineStyle(5, 0x3b2a22, 1);
      g.strokeTriangle(-34, -30, 34, -30, 0, 34);
      c.add(g);
      this.tweens.add({ targets: c, y: c.y + 26, scale: 1.15, duration: 520, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
      this.hintPointer = c;
    } else if (!show && this.hintPointer) {
      this.tweens.killTweensOf(this.hintPointer);
      this.hintPointer.destroy();
      this.hintPointer = null;
    }
  }

  // ---------------------------------------------------------------- dragging

  private worldPoint(pointer: Phaser.Input.Pointer): Phaser.Math.Vector2 {
    return this.cameras.main.getWorldPoint(pointer.x, pointer.y);
  }

  private onPartDown(part: PartView, pointer: Phaser.Input.Pointer): void {
    if (this.phase !== 'build' || this.dragging) return;
    const p = this.worldPoint(pointer);
    this.dragging = { part, dx: part.container.x - p.x, dy: part.container.y - p.y };
    if (part.slotId) {
      // Lifting the placed ramp opens the slot again.
      this.occupied.delete(part.slotId);
      part.slotId = null;
      if (part.kind === 'ramp') this.machine.removeRamp();
      this.refreshHintPointer();
    }
    this.tweens.killTweensOf(part.container);
    part.container.setDepth(400).setAngle(0).setScale(PART_HOME[part.kind].scale * 1.1);
  }

  private onPointerMove(pointer: Phaser.Input.Pointer): void {
    if (!this.dragging) return;
    const p = this.worldPoint(pointer);
    this.dragging.part.container.setPosition(p.x + this.dragging.dx, p.y + this.dragging.dy);
  }

  private onPointerUp(): void {
    const drag = this.dragging;
    if (!drag) return;
    this.dragging = null;
    const { part } = drag;
    const drop = resolveDrop(part.kind, { x: part.container.x, y: part.container.y }, SLOTS, this.occupied);
    part.container.setDepth(50);
    if (drop.kind === 'snap') {
      this.occupied.add(drop.slotId);
      part.slotId = drop.slotId;
      if (part.kind === 'ramp') this.machine.placeRamp();
      playEggSfx('sfx-pop');
      const art = part.container.width;
      this.tweens.add({
        targets: part.container,
        x: drop.x,
        y: drop.y,
        rotation: 0,
        scale: RAMP_SLOT.w / art,
        duration: 160,
        ease: 'Back.easeOut',
      });
      this.refreshHintPointer();
      return;
    }
    // Back to the tray: harmless, no penalty. A wrong part gets a small shake first.
    this.returnToTray(part, drop.reason === 'wrong-part');
  }

  private returnToTray(part: PartView, shake: boolean): void {
    const home = PART_HOME[part.kind];
    this.tweens.add({
      targets: part.container,
      x: home.x,
      y: home.y,
      scale: home.scale,
      angle: 0,
      duration: shake ? 320 : 220,
      ease: shake ? 'Bounce.easeOut' : 'Back.easeOut',
    });
  }

  // ---------------------------------------------------------------- play

  private onPlay(): void {
    if (this.phase !== 'build' || this.dragging) return;
    this.phase = 'playing';
    this.accumulator = 0;
    this.watcher = new RunWatcher(RUN_WATCHER_CONFIG);
    this.playBtn.setEnabled(false);
    this.machine.launch();
    playEggSfx('sfx-ball-roll');
  }

  private syncBall(): void {
    const { position, angle } = this.machine.ball;
    this.ballView.setPosition(position.x, position.y).setRotation(angle);
  }

  private onRunEnd(result: RunResult): void {
    if (result.status === 'success') {
      this.onSuccess();
      return;
    }
    // A failed run: no buzzer, no "wrong". The ball goes back, the parts stay where they are.
    const outcome = recordRun(this.tracker, 'fail');
    this.tracker = outcome.state;
    this.phase = 'build';
    this.time.delayedCall(350, () => {
      if (!this.alive || this.phase !== 'build') return;
      this.machine.resetBall();
      this.syncBall();
      this.playBtn.setEnabled(true);
    });
    // The ball is parked right away in the pure model; the view eases back with the delayed reset above.
    this.playBtn.setEnabled(false);
    if (outcome.hint) this.showHint(outcome.hint);
    else if (isNearMiss(this.watcher.minBellDistance, RUN_WATCHER_CONFIG.reach)) void this.speak('vo-fr-presque');
  }

  // ---------------------------------------------------------------- success

  private onSuccess(): void {
    this.phase = 'success';
    const token = ++this.successToken;
    this.tracker = recordRun(this.tracker, 'success').state;
    const before = eggLevel(this.progress);
    const saved = recordMissionAndSave(window.localStorage, this.profileId, MISSION_ID);
    this.progress = saved.progress;
    this.refreshHintPointer();

    playEggSfx('sfx-bell');
    this.tweens.add({ targets: this.bellView, angle: { from: -14, to: 14 }, duration: 110, yoyo: true, repeat: 5, onComplete: () => this.bellView.setAngle(0) });
    this.time.delayedCall(600, () => playEggSfx('sfx-success'));
    void this.wakeCat();
    void this.speak('vo-fr-cat-croissants');
    this.robot.cheer();
    this.celebrate();
    this.time.delayedCall(2200, () => {
      if (this.alive && token === this.successToken) this.showSuccessPanel(saved.newlyCompleted ? before : eggLevel(this.progress));
    });
  }

  /**
   * The cat wakes: the `cat-wake` strip plays once (frames and fps from the manifest) and holds its last frame for
   * 0.5 s, then the awake art takes over. Without the strip: the awake art appears with a stretch tween.
   */
  private async wakeCat(): Promise<void> {
    let playedStrip = false;
    if (ensureSpriteAnim(this, 'cat-wake')) {
      this.catView.setVisible(false);
      const sprite = await playSpriteOnce(this, 'cat-wake', this.catView.x, CAT_AWAKE_Y, { scale: CAT_SCALE, holdMs: CAT_WAKE_HOLD_MS });
      if (!this.alive) return;
      sprite?.destroy();
      playedStrip = sprite !== null;
    }
    if (!this.alive) return;
    const awake = eggArt(this, 'cat-awake', this.catView.x, CAT_AWAKE_Y).setDepth(10).setScale(CAT_SCALE);
    this.catView.destroy();
    this.catView = awake;
    if (!playedStrip) {
      this.tweens.add({
        targets: awake,
        scaleY: { from: CAT_SCALE * 0.85, to: CAT_SCALE * 1.12 },
        scaleX: { from: CAT_SCALE * 1.1, to: CAT_SCALE * 0.95 },
        duration: 260,
        yoyo: true,
        ease: 'Sine.easeOut',
        onComplete: () => awake.setScale(CAT_SCALE),
      });
    }
  }

  /** Croissants and confetti, all drawn. */
  private celebrate(): void {
    const colors = [0xff5252, 0xffd93d, 0x4d96ff, 0x6bcb77, 0xff6fb5, 0x9b5de5];
    // Particle frames 0-5 of the `confetti` strip (pink rect, mint rect, lavender curl, star, dot, heart) when it loaded;
    // otherwise a generated square, tinted. The strip is not an animation (no fps).
    const strip = ensureSpriteFrames(this, 'confetti');
    const frameWidth = strip ? this.textures.getFrame('confetti', '0').width : 0;
    const drawn = strip && frameWidth > 0 ? (strip.w / frameWidth) : 1;
    const emitter = this.add.particles(CAT_POS.x, CAT_POS.y - 40, strip ? 'confetti' : this.confettiTexture(), {
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
    emitter.explode(70);
    this.time.delayedCall(2600, () => emitter.destroy());
    // Croissants pop up in a row in front of the bed (drawn; no croissant art exists), clear of the cat's face.
    for (let i = 0; i < 5; i++) {
      const c = this.add.container(CAT_POS.x - 190 + i * 72, CAT_BOTTOM - 30).setDepth(260);
      const g = this.add.graphics();
      g.fillStyle(0xd9902f, 1);
      g.fillEllipse(0, 0, 66, 34);
      g.fillStyle(0xe8a94a, 1);
      g.fillEllipse(-4, -4, 46, 20);
      g.lineStyle(3, 0x3b2a22, 1);
      g.strokeEllipse(0, 0, 66, 34);
      g.lineBetween(-12, -14, -6, 12);
      g.lineBetween(8, -14, 14, 10);
      c.add(g);
      c.setScale(0);
      const top = CAT_BOTTOM + 4 - (i % 2) * 20;
      this.tweens.add({ targets: c, scale: 1, y: top, duration: 420, delay: 200 + i * 90, ease: 'Back.easeOut' });
      this.tweens.add({ targets: c, y: top + 14, duration: 700, delay: 700 + i * 90, yoyo: true, repeat: 2, ease: 'Sine.easeInOut' });
    }
  }

  /** Fallback confetti piece (a white square, tinted by the emitter) while the `confetti` strip is missing. */
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

  /**
   * The nest, the egg and the robot's hearts: the feather flies to the nest, the egg glows brighter, exactly one heart
   * lights up. `levelBefore` is the egg level to start from (the current level on a replay: nothing new changes).
   */
  private showSuccessPanel(levelBefore: number): void {
    const layer = this.add.container(0, 0).setDepth(800);
    layer.add(this.add.rectangle(640, 400, BOARD.width + 800, BOARD.height + 800, 0x2b1d14, 0.55).setInteractive());
    layer.add(panel(this, 640, 390, 1000, 640));
    const lit = new Set(litHearts(this.progress));
    const newLevel = eggLevel(this.progress);
    const newlyLit = levelBefore < newLevel;

    layer.add(eggArt(this, 'heart-panel', HEART_VIEW.x, HEART_VIEW.y).setScale(HEART_VIEW.scale));
    const sockets = heartSlotCentres(HEART_VIEW.x, HEART_VIEW.y, displaySize('heart-panel'), HEART_VIEW.scale);
    const slots: Phaser.GameObjects.Container[] = [];
    for (let i = 0; i < HEART_SLOT_COUNT; i++) {
      // Slots about to light start empty; they flip when the feather lands.
      const filled = lit.has(i) && !(newlyLit && i === 0);
      const s = eggArt(this, filled ? 'slot-filled' : 'slot-empty', sockets[i].x, sockets[i].y).setScale(HEART_VIEW.scale);
      slots.push(s);
      layer.add(s);
    }
    let egg = eggArt(this, `egg-nest-${levelBefore}`, 640, 400);
    layer.add(egg);
    const feather = eggArt(this, 'feather', CAT_POS.x, CAT_POS.y - 60).setDepth(900);
    if (newlyLit) {
      feather.setScale(1);
      this.tweens.add({
        targets: feather,
        x: 700,
        y: 450,
        angle: 720 - 35,
        scale: 0.7,
        duration: 1100,
        ease: 'Sine.easeInOut',
        onComplete: () => {
          if (!this.alive) return;
          this.featherArrived = true;
          const bigger = eggArt(this, `egg-nest-${newLevel}`, 640, 400);
          layer.add(bigger);
          egg.destroy();
          egg = bigger;
          this.tweens.add({ targets: bigger, scale: { from: 1.18, to: 1 }, duration: 420, ease: 'Back.easeOut' });
          const idx = [...lit][0] ?? 0;
          const filled = eggArt(this, 'slot-filled', sockets[idx].x, sockets[idx].y).setScale(HEART_VIEW.scale);
          layer.add(filled);
          slots[idx]?.destroy();
          this.tweens.add({ targets: filled, scale: { from: HEART_VIEW.scale * 0.2, to: HEART_VIEW.scale * 1.15 }, duration: 480, yoyo: true, ease: 'Back.easeOut', onComplete: () => filled.setScale(HEART_VIEW.scale) });
          playEggSfx('sfx-robot-beep-3');
          void this.speak('vo-fr-success');
          this.time.delayedCall(700, () => this.addContinue());
        },
      });
    } else {
      feather.destroy();
      this.featherArrived = true;
      void this.speak('vo-fr-success');
      this.time.delayedCall(700, () => this.addContinue());
    }
    this.tweens.add({ targets: egg, angle: 2, duration: 700, yoyo: true, repeat: -1 });
  }

  private addContinue(): void {
    if (!this.alive || this.continueBtn) return;
    const btn = makeButton(this, 640, 700, 180, 112, drawArrowIcon, () => this.goHub());
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

  /** ?e2e=1 read hook: state and page-px rectangles of everything the child can tap or drag. */
  getMysteryEggInfo(): MysteryEggInfo {
    const rects: MysteryEggInfo['rects'] = {};
    for (const [target, b] of this.buttons) {
      rects[target] = boardRectToPage(this, b.container.x, b.container.y, b.width, b.height);
    }
    rects.bunny = boardRectToPage(this, this.bunnyView.x, this.bunnyView.y, this.bunnyView.width * this.bunnyView.scaleX, this.bunnyView.height * this.bunnyView.scaleY);
    rects.slot = boardRectToPage(this, RAMP_SLOT.x, RAMP_SLOT.y, RAMP_SLOT.w, 120);
    const partTarget = { ball: 'partBall', ramp: 'partRamp', bell: 'partBell' } as const;
    const inTray: PartKind[] = [];
    for (const [kind, part] of this.parts) {
      const c = part.container;
      rects[partTarget[kind]] = boardRectToPage(this, c.x, c.y, c.width * c.scaleX, c.height * c.scaleY);
      const home = PART_HOME[kind];
      if (!part.slotId && this.dragging?.part !== part && Math.abs(c.x - home.x) < 2 && Math.abs(c.y - home.y) < 2) inTray.push(kind);
    }
    const ballStart = Math.hypot(this.machine?.ball.position.x - BALL.x, this.machine?.ball.position.y - BALL.y) < 3;
    return {
      scene: 'MysteryEggBuildScene',
      phase: this.phase,
      ready: this.ready,
      heartsLit: litHearts(this.progress),
      eggLevel: eggLevel(this.progress),
      featherInNest: this.featherArrived,
      failedRuns: this.tracker.failedRuns,
      hintsGiven: this.tracker.hintsGiven,
      hintVisible: this.hintPointer !== null,
      slotFilled: this.occupied.has('ramp-slot'),
      ballAtStart: this.phase !== 'playing' && ballStart,
      partsInTray: inTray,
      rects,
    };
  }
}

// Magic Magnet (docs/specs/magic-magnet.md), Pass 1: a no-fail magnetism cause-effect game in Science World.
// Pure rules live in ./magnetMachine.ts (state machine) and ./magnetRound.ts (levels, selection, trials, lines).
// Test handles: `getMagnetInfo()` / `seedMagnetLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, MagicMagnetContent, MagnetObject } from '../../content/schema';
import { loadMagicMagnet } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, popIn, pressSquash, tweenAsync, wait, wobble } from '../../anim/tweens';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import {
  createMagnetRound,
  predict,
  touch,
  type MagnetEvent,
  type MagnetState,
} from './magnetMachine';
import {
  pickRoundObjects,
  planForLevel,
  questionLines,
  reactionLines,
  rightLine,
  roundStartLines,
  surpriseLine,
  testLine,
  trialForReveal,
  trialForTouch,
  wordLine,
  type MagnetPlan,
} from './magnetRound';
import type { MagnetInfo } from './magnetTypes';

let cachedContent: MagicMagnetContent | null = null;
function content(): MagicMagnetContent {
  cachedContent ??= loadMagicMagnet();
  return cachedContent;
}

const DEPTH = { background: -10, table: -5, glow: 15, objects: 20, buttons: 35, stuck: 45, magnet: 50, flying: 300 } as const;
const OUTLINE_COLOR = 0x3b2a22;
const MAGNET_SIZE = 200;
/** Pole tips sit at the bottom centre between the two legs (~0.85 of magnet height from the top). */
const MAGNET_TIP_OFFSET_Y = MAGNET_SIZE * 0.35;
const OBJECT_SIZE = 150;
const STUCK_SCALE = 0.8;
const REACH_PX = 90;
const BUTTON_W = 220;
const BUTTON_H = 128;
const LINE_MAX_MS = 2200;
const ROUND_HOLD_MS = 600;

const CLUSTER_OFFSETS: readonly Point[] = [
  { x: -26, y: 12 },
  { x: 26, y: 12 },
  { x: 0, y: 34 },
  { x: -34, y: 36 },
  { x: 34, y: 36 },
];

interface Point {
  x: number;
  y: number;
}

interface Layout {
  tableY: number;
  magnetHome: Point;
  buttonSticks: Point;
  buttonNotSticks: Point;
  objectSpots: Point[];
}

function computeLayout(w: number, h: number, count: number): Layout {
  if (w >= h) {
    const spacing = count >= 5 ? 210 : 230;
    const startX = w / 2 - ((count - 1) * spacing) / 2;
    const objY = h * 0.6;
    const objectSpots = Array.from({ length: count }, (_, i) => ({ x: startX + i * spacing, y: objY }));
    return {
      tableY: h * 0.48,
      magnetHome: { x: w / 2, y: h * 0.25 },
      buttonSticks: { x: w / 2 + 150, y: h * 0.84 },
      buttonNotSticks: { x: w / 2 - 150, y: h * 0.84 },
      objectSpots,
    };
  }

  let objectSpots: Point[];
  if (count <= 4) {
    const spacing = 175;
    const startX = w / 2 - ((count - 1) * spacing) / 2;
    const objY = h * 0.56;
    objectSpots = Array.from({ length: count }, (_, i) => ({ x: startX + i * spacing, y: objY }));
  } else {
    const topCount = Math.ceil(count / 2);
    const botCount = count - topCount;
    const topSpacing = 210;
    const botSpacing = 220;
    const topStart = w / 2 - ((topCount - 1) * topSpacing) / 2;
    const botStart = w / 2 - ((botCount - 1) * botSpacing) / 2;
    objectSpots = [
      ...Array.from({ length: topCount }, (_, i) => ({ x: topStart + i * topSpacing, y: h * 0.51 })),
      ...Array.from({ length: botCount }, (_, i) => ({ x: botStart + i * botSpacing, y: h * 0.67 })),
    ];
  }

  return {
    tableY: h * 0.4,
    magnetHome: { x: w / 2, y: h * 0.23 },
    buttonSticks: { x: w / 2 + 145, y: h * 0.84 },
    buttonNotSticks: { x: w / 2 - 145, y: h * 0.84 },
    objectSpots,
  };
}

interface ObjectView {
  id: string;
  metal: boolean;
  rest: Point;
  container: Phaser.GameObjects.Container;
  slotIndex: number | null;
  flying: boolean;
}

export class MagnetScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: Layout;
  private lang: Lang | null = null;
  private plan!: MagnetPlan;
  private magnet!: MagnetState;
  private levelNo = 1;
  private magnetView?: Phaser.GameObjects.Container;
  private glowRing?: Phaser.GameObjects.Arc;
  private glowTween?: Phaser.Tweens.Tween;
  private sticksBtn?: Phaser.GameObjects.Container;
  private notSticksBtn?: Phaser.GameObjects.Container;
  private objectViews: ObjectView[] = [];
  private stuckCount = 0;
  private inReach = new Set<string>();
  private lastRoundIds: string[] = [];
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();
  private ready = false;
  private gliding = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPending = true;
  private lastEvent: MagnetEvent['kind'] | null = null;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('MagnetScene');
  }

  create(): void {
    setAppScreen('magic-magnet');
    this.context = this.game.registry.get('appContext') as AppContext;
    const c = content();
    this.ageConfig = c.ageTracks[this.context.currentAgeTrack()];
    this.skills = this.context.createSkillSession(
      c.world,
      c.id,
      buildMeta({ levelCount: c.adaptive.levels.length, tracks: c.adaptive.tracks, rules: c.adaptive.rules }),
    );
    this.lang = null;
    this.ready = false;
    this.gliding = false;
    this.stepHinted = false;
    this.helpOpen = false;
    this.introPending = true;
    this.lastEvent = null;
    this.stuckCount = 0;
    this.inReach = new Set();
    this.lastRoundIds = [];
    this.objectViews = [];
    this.activeTransients = new Set();
    this.magnetView = undefined;
    this.glowRing = undefined;
    this.glowTween = undefined;
    this.sticksBtn = undefined;
    this.notSticksBtn = undefined;
    this.hintTimer = undefined;
    this.layout = computeLayout(this.scale.width, this.scale.height, 4);

    this.session = this.context.createLearningSession();
    this.session.start();
    this.visibilityHandler = () => {
      this.session.setHidden(document.hidden);
      if (document.hidden) this.context.audio.stopAll();
    };
    document.addEventListener('visibilitychange', this.visibilityHandler);
    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.session.tick(1);
        this.context.store.persist();
        this.updateHud();
      },
    });

    this.paintBackground();
    this.buildGlowRing();
    this.buildMagnet();
    this.buildPredictionButtons();
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startRound(++this.visitToken, true);

    window.__GAME_READY__ = true;
  }

  private destroyObject(obj: Phaser.GameObjects.GameObject | undefined): void {
    if (!obj) return;
    this.activeTransients.delete(obj);
    this.tweens.killTweensOf(obj);
    if (obj.scene) obj.destroy();
  }

  private cleanup(): void {
    this.visitToken++;
    this.speechBatch++;
    this.hintTimer?.remove();
    this.glowTween?.stop();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const obj of [...this.activeTransients]) this.destroyObject(obj);
    for (const entry of this.objectViews) this.tweens.killTweensOf(entry.container);
    if (this.magnetView) this.tweens.killTweensOf(this.magnetView);
    if (this.sticksBtn) this.tweens.killTweensOf(this.sticksBtn);
    if (this.notSticksBtn) this.tweens.killTweensOf(this.notSticksBtn);
    if (this.glowRing) this.tweens.killTweensOf(this.glowRing);
    this.context.audio.stopAll();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
  }

  // ---------------------------------------------------------------- scene

  private paintBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    this.cameras.main.setBackgroundColor('#d9f0ff');
    const tableH = h - this.layout.tableY;
    this.add.rectangle(w / 2, this.layout.tableY + tableH / 2, w, tableH, 0xd8a46f).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, this.layout.tableY + 5, w, 10, 0xb8814f).setDepth(DEPTH.table);
    this.add.rectangle(w / 2, this.layout.tableY, w, 4, OUTLINE_COLOR).setDepth(DEPTH.table);
  }

  private buildGlowRing(): void {
    const ring = this.add.circle(0, 0, OBJECT_SIZE * 0.56, 0xfff59d, 0.25)
      .setStrokeStyle(6, 0xffd54f, 0.9)
      .setDepth(DEPTH.glow)
      .setVisible(false);
    this.glowRing = ring;
  }

  private buildMagnet(): void {
    const { x, y } = this.layout.magnetHome;
    const container = this.add.container(x, y).setDepth(DEPTH.magnet);
    if (this.textures.exists('magnet-magnet')) {
      container.add(this.add.image(0, 0, 'magnet-magnet').setDisplaySize(MAGNET_SIZE, MAGNET_SIZE));
    } else {
      const g = this.add.graphics();
      // Procedural red horseshoe magnet fallback matching the 256x256 asset proportions.
      g.fillStyle(0xf24c4c, 1);
      g.fillRoundedRect(-54, -76, 108, 92, { tl: 54, tr: 54, bl: 0, br: 0 });
      g.fillStyle(0xd9f0ff, 1);
      g.fillRoundedRect(-20, -34, 40, 56, { tl: 20, tr: 20, bl: 0, br: 0 });
      g.fillStyle(0xf24c4c, 1);
      g.fillRect(-54, -22, 34, 72);
      g.fillRect(20, -22, 34, 72);
      g.fillStyle(0xc9ced6, 1);
      g.fillRoundedRect(-54, 46, 34, 32, { tl: 0, tr: 0, bl: 8, br: 8 });
      g.fillRoundedRect(20, 46, 34, 32, { tl: 0, tr: 0, bl: 8, br: 8 });
      g.lineStyle(5, OUTLINE_COLOR, 1);
      g.strokeRect(-54, 46, 34, 32);
      g.strokeRect(20, 46, 34, 32);
      g.strokeRoundedRect(-54, -76, 108, 154, { tl: 54, tr: 54, bl: 8, br: 8 });
      container.add(g);
    }

    container.setSize(MAGNET_SIZE, MAGNET_SIZE);
    container.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(container);

    container.on('dragstart', () => {
      if (!this.isMagnetLive() || this.gliding) return;
      this.session.reportInteraction();
    });
    container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.isMagnetLive() || this.gliding) return;
      const half = MAGNET_SIZE / 2;
      const cx = Phaser.Math.Clamp(dragX, half, this.scale.width - half);
      const cy = Phaser.Math.Clamp(dragY, half, this.scale.height - half);
      container.setPosition(cx, cy);
      this.updateClusterPositions();
      this.checkMagnetReach();
    });

    this.magnetView = container;
  }

  private buildPredictionButtons(): void {
    const c = content();
    this.sticksBtn = this.createPredictionButton(
      this.layout.buttonSticks,
      c.linesHe.buttonSticks,
      true,
      () => void this.onPredict(true),
    );
    this.notSticksBtn = this.createPredictionButton(
      this.layout.buttonNotSticks,
      c.linesHe.buttonNotSticks,
      false,
      () => void this.onPredict(false),
    );
  }

  private createPredictionButton(
    pos: Point,
    label: string,
    sticks: boolean,
    onTap: () => void,
  ): Phaser.GameObjects.Container {
    const container = this.add.container(pos.x, pos.y).setDepth(DEPTH.buttons).setVisible(false);
    const bg = this.add.graphics();
    bg.fillStyle(sticks ? 0xe8f8ec : 0xfff3e0, 1);
    bg.fillRoundedRect(-BUTTON_W / 2, -BUTTON_H / 2, BUTTON_W, BUTTON_H, 24);
    bg.lineStyle(5, OUTLINE_COLOR, 1);
    bg.strokeRoundedRect(-BUTTON_W / 2, -BUTTON_H / 2, BUTTON_W, BUTTON_H, 24);
    container.add(bg);

    // Tiny procedural icon above the label.
    const icon = this.add.graphics();
    if (sticks) {
      icon.lineStyle(5, 0x2e7d32, 1);
      icon.beginPath();
      icon.moveTo(-16, -24);
      icon.lineTo(-4, -12);
      icon.lineTo(18, -36);
      icon.strokePath();
    } else {
      icon.lineStyle(5, 0xc62828, 1);
      icon.beginPath();
      icon.moveTo(-13, -36);
      icon.lineTo(13, -12);
      icon.moveTo(13, -36);
      icon.lineTo(-13, -12);
      icon.strokePath();
    }
    container.add(icon);

    const text = this.add
      .text(0, 24, label, {
        fontFamily: "'Noto Sans Hebrew', 'Noto Sans', system-ui, Arial, sans-serif",
        fontSize: '30px',
        fontStyle: 'bold',
        color: '#3B2A22',
        align: 'center',
      })
      .setOrigin(0.5);
    container.add(text);

    container.setSize(BUTTON_W, BUTTON_H);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', onTap);
    return container;
  }

  private createObjectView(obj: MagnetObject, spot: Point, index: number): ObjectView {
    const container = this.add.container(spot.x, spot.y).setDepth(DEPTH.objects);
    if (this.textures.exists(obj.art)) {
      container.add(this.add.image(0, 0, obj.art).setDisplaySize(OBJECT_SIZE, OBJECT_SIZE));
    } else {
      container.add(this.drawObjectFallback(obj.id));
    }
    container.setSize(OBJECT_SIZE, OBJECT_SIZE);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => void this.onObjectTap(obj.id));
    void popIn(this, container, 80 + index * 60);

    return {
      id: obj.id,
      metal: obj.metal,
      rest: { ...spot },
      container,
      slotIndex: null,
      flying: false,
    };
  }

  private drawObjectFallback(id: string): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    g.lineStyle(5, OUTLINE_COLOR, 1);
    switch (id) {
      case 'paperclip':
        g.strokeRoundedRect(-24, -42, 48, 84, 22);
        g.strokeRoundedRect(-12, -26, 24, 52, 12);
        break;
      case 'nail':
        g.fillStyle(0xb0bec5, 1).fillRect(-8, -42, 16, 78);
        g.fillStyle(0xb0bec5, 1).fillRect(-24, -50, 48, 12);
        g.strokeRect(-8, -42, 16, 78);
        g.strokeRect(-24, -50, 48, 12);
        break;
      case 'screw':
        g.fillStyle(0x90a4ae, 1).fillRect(-10, -34, 20, 74);
        g.fillStyle(0xb0bec5, 1).fillRoundedRect(-26, -50, 52, 18, 6);
        g.strokeRect(-10, -34, 20, 74);
        g.strokeRoundedRect(-26, -50, 52, 18, 6);
        break;
      case 'bottle-cap':
        g.fillStyle(0x42a5f5, 1).fillCircle(0, 0, 42);
        g.strokeCircle(0, 0, 42);
        break;
      case 'ball':
        g.fillStyle(0xff7043, 1).fillCircle(0, 0, 46);
        g.strokeCircle(0, 0, 46);
        break;
      case 'leaf':
        g.fillStyle(0x66bb6a, 1).fillEllipse(0, 0, 64, 92);
        g.strokeEllipse(0, 0, 64, 92);
        break;
      case 'feather':
        g.fillStyle(0x81d4fa, 1).fillEllipse(0, 0, 42, 98);
        g.strokeEllipse(0, 0, 42, 98);
        break;
      default:
        g.fillStyle(0xef5350, 1).fillCircle(0, 6, 42);
        g.strokeCircle(0, 6, 42);
        break;
    }
    return g;
  }

  // ---------------------------------------------------------------- HUD

  private profileState() {
    return this.context.store.getProfileState(this.context.requireProfileId(), new Date(this.context.nowMs()));
  }

  private buildHud(): void {
    const state = this.profileState();
    const settings = this.context.store.getState().settings;
    this.context.shell.setRestaurantChrome({
      starCount: state.stars,
      balanceSec: state.balanceSec,
      earnedTodaySec: state.earnedTodaySec,
      dailyCapSec: settings.dailyEarnCapMinutes * 60,
      showTime: this.context.isTimeEarningEnabled(),
      onBack: () => this.goBack(),
      onHelp: () => this.showHelp(),
    });
  }

  private updateHud(): void {
    const state = this.profileState();
    const settings = this.context.store.getState().settings;
    this.context.shell.updateRestaurantChrome({
      balanceSec: state.balanceSec,
      earnedTodaySec: state.earnedTodaySec,
      dailyCapSec: settings.dailyEarnCapMinutes * 60,
    });
  }

  private goBack(): void {
    this.context.audio.stopAll();
    this.context.store.persist();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    this.hintTimer?.remove();
    this.speechBatch++;
    void this.speak({ lineId: 'magnet.help.he', lang: 'he', text: content().helpTextHe });
    this.context.shell.showHelp(content().helpTextHe, () => {
      this.helpOpen = false;
      this.session.reportInteraction();
      this.context.audio.stopAll();
      this.scheduleHint();
    });
  }

  private speak(request: SpeechRequest, maxMs = LINE_MAX_MS): Promise<void> {
    const seq = ++this.speakSeq;
    this.session.reportListening(true);
    const played = this.context.audio.play(request);
    const done = () => {
      if (seq === this.speakSeq) this.session.reportListening(false);
    };
    void played.finally(done);
    return Promise.race([played.then(() => undefined), wait(this, maxMs)]).then(done);
  }

  private async speakSequence(requests: readonly SpeechRequest[], token: number): Promise<void> {
    const batch = ++this.speechBatch;
    for (const req of requests) {
      if (token !== this.visitToken || batch !== this.speechBatch || !this.sys.isActive()) return;
      await this.speak(req);
    }
  }

  // ---------------------------------------------------------------- round & gameplay

  private isMagnetLive(): boolean {
    return (
      this.ready &&
      !this.helpOpen &&
      (this.magnet.phase === 'exploring' || this.magnet.phase === 'testing')
    );
  }

  private tipsPoint(): Point {
    const m = this.magnetView;
    return m ? { x: m.x, y: m.y + MAGNET_TIP_OFFSET_Y } : { ...this.layout.magnetHome };
  }

  private slotPoint(slotIndex: number): Point {
    const offset = CLUSTER_OFFSETS[slotIndex % CLUSTER_OFFSETS.length];
    const tips = this.tipsPoint();
    return { x: tips.x + offset.x, y: tips.y + offset.y };
  }

  private updateClusterPositions(): void {
    for (const entry of this.objectViews) {
      if (entry.slotIndex !== null && !entry.flying) {
        const pt = this.slotPoint(entry.slotIndex);
        entry.container.setPosition(pt.x, pt.y);
      }
    }
  }

  private refreshRoundPlan(): void {
    const c = content();
    const settings = this.context.store.getState().settings;
    this.lang = nextRoundLanguage(
      this.lang,
      this.lang === null || this.skills.atRoundBoundary(this.lang),
      settings.languages,
    );
    this.levelNo = this.skills.level(this.lang);
    this.plan = planForLevel(c.adaptive.levels[this.levelNo - 1]);
  }

  private clearRoundObjects(): void {
    for (const entry of this.objectViews) {
      this.tweens.killTweensOf(entry.container);
      if (entry.container.scene) entry.container.destroy();
    }
    this.objectViews = [];
    this.stuckCount = 0;
    this.inReach.clear();
  }

  private startRound(token: number, fromCreate = false): void {
    // During create() the scene status is CREATING, so isActive() is still false.
    if (token !== this.visitToken || (!fromCreate && !this.sys.isActive())) return;
    const c = content();
    this.refreshRoundPlan();
    this.clearRoundObjects();

    const roundObjects = pickRoundObjects(c.objects, this.plan.objectCount, this.lastRoundIds);
    this.lastRoundIds = roundObjects.map((o) => o.id);
    this.layout = computeLayout(this.scale.width, this.scale.height, roundObjects.length);
    this.magnet = createMagnetRound({ mode: this.plan.mode, objects: roundObjects });

    this.stepHinted = false;
    this.lastEvent = null;
    this.ready = false;
    this.gliding = false;

    if (this.magnetView) {
      this.tweens.killTweensOf(this.magnetView);
      this.magnetView.setPosition(this.layout.magnetHome.x, this.layout.magnetHome.y);
      this.magnetView.setAlpha(this.plan.mode === 'predict' ? 0.55 : 1);
    }

    this.objectViews = roundObjects.map((obj, idx) => this.createObjectView(obj, this.layout.objectSpots[idx], idx));
    const buttonsIn = this.updatePredictionUi(true);

    const startSpeech = () => {
      if (token !== this.visitToken || !this.sys.isActive()) return;
      const includeIntro = this.introPending;
      this.introPending = false;
      const lines = roundStartLines(c, {
        includeIntro,
        mode: this.plan.mode,
        targetId: this.currentTarget()?.id,
        lang: this.lang,
        audioOnly: this.plan.audioOnly,
      });
      if (lines.length > 0) void this.speakSequence(lines, token);
    };
    if (fromCreate) {
      // Phaser keeps scene status CREATING (so isActive() is false) until create() returns and emits CREATE.
      this.events.once(Phaser.Scenes.Events.CREATE, startSpeech);
    } else {
      startSpeech();
    }

    void Promise.all([wait(this, 80 + roundObjects.length * 60 + 260), buttonsIn]).then(() => {
      if (token !== this.visitToken || !this.sys.isActive()) return;
      this.ready = true;
      this.scheduleHint();
    });
  }

  private currentTarget(): { id: string; metal: boolean; stuck: boolean } | null {
    if (this.magnet.targetIndex === null) return null;
    return this.magnet.objects[this.magnet.targetIndex] ?? null;
  }

  private questionLinesFor(id: string): SpeechRequest[] {
    return questionLines(content(), id, this.lang!, this.plan.audioOnly);
  }

  /** Resolves when the prediction buttons have finished popping in, so taps are not lost mid-tween. */
  private updatePredictionUi(animateButtons = false): Promise<void> {
    const pops: Promise<unknown>[] = [];
    const predicting = this.magnet.phase === 'predicting';
    const showButtons = predicting;
    if (this.sticksBtn) {
      this.sticksBtn.setVisible(showButtons);
      if (showButtons && animateButtons) pops.push(popIn(this, this.sticksBtn, 40));
    }
    if (this.notSticksBtn) {
      this.notSticksBtn.setVisible(showButtons);
      if (showButtons && animateButtons) pops.push(popIn(this, this.notSticksBtn, 90));
    }

    if (this.magnetView) {
      this.magnetView.setAlpha(predicting ? 0.55 : 1);
    }

    this.glowTween?.stop();
    this.glowTween = undefined;
    const target = this.currentTarget();
    const targetView = target ? this.objectViews.find((v) => v.id === target.id) : undefined;
    if (
      this.glowRing &&
      targetView &&
      !this.plan.audioOnly &&
      (this.magnet.phase === 'predicting' || this.magnet.phase === 'testing')
    ) {
      this.glowRing.setPosition(targetView.rest.x, targetView.rest.y).setScale(1).setVisible(true);
      if (!isReducedMotion()) {
        this.glowTween = this.tweens.add({
          targets: this.glowRing,
          scale: 1.1,
          alpha: { from: 0.95, to: 0.55 },
          duration: 900,
          yoyo: true,
          repeat: -1,
          ease: 'Sine.easeInOut',
        });
      }
    } else if (this.glowRing) {
      this.glowRing.setVisible(false);
    }
    return Promise.all(pops).then(() => undefined);
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen || this.magnet.phase === 'done') return;
    this.stepHinted = true;
    this.context.sfx.hint();
    const c = content();

    if (this.magnet.phase === 'exploring') {
      const nextMetal = this.magnet.objects.find((o) => o.metal && !o.stuck);
      const view = nextMetal ? this.objectViews.find((v) => v.id === nextMetal.id) : undefined;
      if (view) void hintPulse(this, view.container);
      return;
    }

    const target = this.currentTarget();
    if (!target || !this.lang) return;

    if (this.magnet.phase === 'predicting') {
      if (this.plan.hintPulse) {
        if (this.sticksBtn) void hintPulse(this, this.sticksBtn);
        if (this.notSticksBtn) void hintPulse(this, this.notSticksBtn);
      }
      void this.speakSequence(this.questionLinesFor(target.id), this.visitToken);
      return;
    }

    if (this.magnet.phase === 'testing') {
      if (this.plan.audioOnly) {
        void this.speakSequence([wordLine(c, target.id, this.lang)], this.visitToken);
      } else {
        const view = this.objectViews.find((v) => v.id === target.id);
        if (view) void hintPulse(this, view.container);
      }
    }
  }

  private async onPredict(sticks: boolean): Promise<void> {
    const btn = sticks ? this.sticksBtn : this.notSticksBtn;
    if (btn) void pressSquash(this, btn);
    if (!this.ready || this.helpOpen || this.magnet.phase !== 'predicting') return;

    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();

    const { state, event } = predict(this.magnet, sticks);
    this.magnet = state;
    this.lastEvent = event.kind;
    if (event.kind !== 'predicted') return;

    void this.updatePredictionUi(false);
    void this.speakSequence([testLine(content())], this.visitToken);
    this.scheduleHint();
  }

  private checkMagnetReach(): void {
    const tips = this.tipsPoint();
    for (const entry of this.objectViews) {
      if (entry.slotIndex !== null) continue;
      const dist = Phaser.Math.Distance.Between(tips.x, tips.y, entry.rest.x, entry.rest.y);
      if (dist <= REACH_PX) {
        if (!this.inReach.has(entry.id)) {
          this.inReach.add(entry.id);
          void this.handleTouch(entry.id);
        }
      } else {
        this.inReach.delete(entry.id);
      }
    }
  }

  private async onObjectTap(id: string): Promise<void> {
    if (!this.isMagnetLive() || this.gliding || !this.magnetView) return;
    const entry = this.objectViews.find((v) => v.id === id);
    if (!entry || entry.slotIndex !== null) return;

    const token = this.visitToken;
    this.gliding = true;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();

    const targetX = Phaser.Math.Clamp(entry.rest.x, MAGNET_SIZE / 2, this.scale.width - MAGNET_SIZE / 2);
    const targetY = Phaser.Math.Clamp(entry.rest.y - MAGNET_TIP_OFFSET_Y, MAGNET_SIZE / 2, this.scale.height - MAGNET_SIZE / 2);
    await tweenAsync(this, {
      targets: this.magnetView,
      x: targetX,
      y: targetY,
      duration: isReducedMotion() ? 120 : 350,
      ease: 'Sine.easeInOut',
      onUpdate: () => this.updateClusterPositions(),
    });
    this.gliding = false;
    if (token !== this.visitToken || !this.sys.isActive()) return;

    this.inReach.add(id);
    await this.handleTouch(id);
  }

  private async attachToMagnet(entry: ObjectView, token: number): Promise<void> {
    const slot = this.stuckCount++;
    entry.slotIndex = slot;
    entry.flying = true;
    entry.container.setDepth(DEPTH.stuck);
    const fromX = entry.container.x;
    const fromY = entry.container.y;
    const startScale = entry.container.scaleX;
    const arcHeight = isReducedMotion() ? 14 : 46;
    const duration = isReducedMotion() ? 120 : 280;

    await tweenAsync(this, {
      targets: { t: 0 },
      t: 1,
      duration,
      ease: 'Cubic.easeOut',
      onUpdate: (tween) => {
        const t = tween.getValue() ?? 0;
        const dest = this.slotPoint(slot);
        const x = fromX + (dest.x - fromX) * t;
        const y = fromY + (dest.y - fromY) * t - Math.sin(t * Math.PI) * arcHeight;
        entry.container.setPosition(x, y);
        entry.container.setScale(startScale + (STUCK_SCALE - startScale) * t);
      },
    });
    entry.flying = false;
    if (token !== this.visitToken || !this.sys.isActive()) return;
    const finalPt = this.slotPoint(slot);
    entry.container.setPosition(finalPt.x, finalPt.y);
    entry.container.setScale(STUCK_SCALE);
  }

  private async releaseStuckObjects(token: number): Promise<void> {
    const attached = this.objectViews.filter((v) => v.slotIndex !== null);
    if (attached.length === 0) return;
    const duration = isReducedMotion() ? 120 : 320;
    await Promise.all(
      attached.map((entry) => {
        entry.slotIndex = null;
        entry.flying = false;
        entry.container.setDepth(DEPTH.objects);
        return tweenAsync(this, {
          targets: entry.container,
          x: entry.rest.x,
          y: entry.rest.y,
          scale: 1,
          angle: 0,
          duration,
          ease: 'Bounce.easeOut',
        });
      }),
    );
    this.stuckCount = 0;
    if (token !== this.visitToken || !this.sys.isActive()) return;
  }

  private async returnMagnetHome(token: number): Promise<void> {
    if (!this.magnetView) return;
    const duration = isReducedMotion() ? 120 : 300;
    await tweenAsync(this, {
      targets: this.magnetView,
      x: this.layout.magnetHome.x,
      y: this.layout.magnetHome.y,
      duration,
      ease: 'Sine.easeInOut',
    });
    if (token !== this.visitToken || !this.sys.isActive()) return;
  }

  private async handleTouch(id: string): Promise<void> {
    if (!this.isMagnetLive() || !this.lang) return;
    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();
    const lang = this.lang;

    const { state, event } = touch(this.magnet, id);
    this.lastEvent = event.kind;
    if (event.kind === 'busy') {
      this.scheduleHint();
      return;
    }

    this.magnet = state;
    this.hintTimer?.remove();
    this.session.reportInteraction();

    const entry = this.objectViews.find((v) => v.id === id);
    const juice = Juice.for(this);

    if (event.kind === 'wiggled') {
      this.skills.record(lang, trialForTouch(id));
      this.stepHinted = false;
      this.context.sfx.tap();
      if (entry) {
        void wobble(this, entry.container);
        juice.burst('sparkle', entry.container.x, entry.container.y, 6);
      }
      void this.speakSequence(reactionLines(c, id, lang), token);
      this.scheduleHint();
      return;
    }

    if (event.kind === 'stuck') {
      this.skills.record(lang, trialForTouch(id));
      this.stepHinted = false;
      this.context.sfx.yay();
      if (entry) void this.attachToMagnet(entry, token);
      const tips = this.tipsPoint();
      juice.burst('sparkle', tips.x, tips.y, 8);

      if (!event.roundComplete) {
        void this.speakSequence(reactionLines(c, id, lang), token);
        this.scheduleHint();
        return;
      }

      // Free round complete: award one star, celebrate, drop stuck objects, start next round.
      this.ready = false;
      this.awardStar(tips.x, tips.y);
      await this.speakSequence([...reactionLines(c, id, lang), heLine('praise.0')], token);
      if (!alive()) return;
      await wait(this, ROUND_HOLD_MS);
      if (!alive()) return;
      await this.releaseStuckObjects(token);
      if (!alive()) return;
      this.session.reportCelebrating(false);
      this.startRound(token);
      return;
    }

    // Predict mode reveal (`event.kind === 'revealed'`)
    if (event.kind !== 'revealed') return;
    this.ready = false;
    this.skills.record(lang, trialForReveal(event, this.stepHinted));
    this.stepHinted = false;
    this.context.sfx.yay();

    if (event.sticks && entry) {
      await this.attachToMagnet(entry, token);
      if (!alive()) return;
    } else if (entry) {
      void wobble(this, entry.container);
    }

    const fxPoint = event.sticks ? this.tipsPoint() : (entry ? { x: entry.container.x, y: entry.container.y } : this.tipsPoint());
    const feedback = event.correct ? rightLine(c) : surpriseLine(c);

    if (event.roundComplete) {
      this.awardStar(fxPoint.x, fxPoint.y);
      await this.speakSequence([...reactionLines(c, id, lang), feedback, heLine('praise.0')], token);
      if (!alive()) return;
      await wait(this, ROUND_HOLD_MS);
      if (!alive()) return;
      await this.releaseStuckObjects(token);
      if (!alive()) return;
      await this.returnMagnetHome(token);
      if (!alive()) return;
      this.session.reportCelebrating(false);
      this.startRound(token);
      return;
    }

    juice.burst('sparkle', fxPoint.x, fxPoint.y, 10);
    await this.speakSequence([...reactionLines(c, id, lang), feedback], token);
    if (!alive()) return;
    if (event.sticks) {
      await this.releaseStuckObjects(token);
      if (!alive()) return;
    }
    await this.returnMagnetHome(token);
    if (!alive()) return;
    this.inReach.clear();
    const buttonsIn = this.updatePredictionUi(true);
    const nextTarget = this.currentTarget();
    if (nextTarget) void this.speakSequence(this.questionLinesFor(nextTarget.id), token);
    await buttonsIn;
    if (!alive()) return;
    this.ready = true;
    this.scheduleHint();
  }

  private awardStar(fxX: number, fxY: number): void {
    this.session.complete();
    this.context.recordCompletedRound('science-world', 'magic-magnet');
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    const juice = Juice.for(this);
    juice.burst('confetti', fxX, fxY);
    juice.burst('star', fxX, fxY);
    this.flyStarToCounter(fxX, fxY);
  }

  private trackTransient<T extends Phaser.GameObjects.GameObject>(obj: T): T {
    this.activeTransients.add(obj);
    return obj;
  }

  private flyStarToCounter(fromX: number, fromY: number): void {
    const finish = () => {
      if (!this.sys.isActive()) return;
      this.context.shell.updateRestaurantChrome({ starCount: this.profileState().stars });
      this.context.shell.bumpStarPill(isReducedMotion() ? 1.08 : 1.35);
    };
    const target = this.starPillGamePoint();
    if (!target) {
      finish();
      return;
    }
    const star = this.trackTransient(this.add.image(fromX, fromY, fxTextureKey(this, 'star')).setDepth(DEPTH.flying).setScale(0.9));
    void flyArc(this, star, target.x, target.y, { duration: 650, height: 120, endScale: 0.55, spin: 180 }).then(() => {
      this.destroyObject(star);
      finish();
    });
  }

  private starPillGamePoint(): Point | undefined {
    const r = this.context.shell.starPillRect();
    const canvas = this.game.canvas;
    if (!r || !canvas) return undefined;
    const c = canvas.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) return undefined;
    return {
      x: ((r.left + r.width / 2 - c.left) / c.width) * this.scale.width,
      y: ((r.top + r.height / 2 - c.top) / c.height) * this.scale.height,
    };
  }

  // ---------------------------------------------------------------- e2e (read only)

  getMagnetInfo(): MagnetInfo | null {
    if (!this.magnet || !this.lang || !this.magnetView) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const toPage = (r: Rect): Rect => gameRectToPageRect(r, canvasRect, size);

    const objects = this.magnet.objects.map((o) => {
      const view = this.objectViews.find((v) => v.id === o.id);
      const isAttached = view !== undefined && view.slotIndex !== null;
      const cx = isAttached ? view.container.x : (view?.rest.x ?? 0);
      const cy = isAttached ? view.container.y : (view?.rest.y ?? 0);
      const s = isAttached ? view.container.scaleX : 1;
      const side = OBJECT_SIZE * s;
      return {
        id: o.id,
        metal: o.metal,
        stuck: o.stuck,
        rect: toPage({ x: cx - side / 2, y: cy - side / 2, width: side, height: side }),
      };
    });

    const m = this.magnetView;
    const magnetRect = toPage({ x: m.x - MAGNET_SIZE / 2, y: m.y - MAGNET_SIZE / 2, width: MAGNET_SIZE, height: MAGNET_SIZE });
    const tipPage = toPage({ x: m.x, y: m.y + MAGNET_TIP_OFFSET_Y, width: 0, height: 0 });
    const target = this.currentTarget();

    let buttons: { sticks: Rect; notSticks: Rect } | null = null;
    if (this.magnet.phase === 'predicting' && this.sticksBtn && this.notSticksBtn) {
      buttons = {
        sticks: toPage({
          x: this.sticksBtn.x - BUTTON_W / 2,
          y: this.sticksBtn.y - BUTTON_H / 2,
          width: BUTTON_W,
          height: BUTTON_H,
        }),
        notSticks: toPage({
          x: this.notSticksBtn.x - BUTTON_W / 2,
          y: this.notSticksBtn.y - BUTTON_H / 2,
          width: BUTTON_W,
          height: BUTTON_H,
        }),
      };
    }

    return {
      phase: this.magnet.phase,
      mode: this.plan.mode,
      level: this.levelNo,
      skillKey: this.skills.key(this.lang),
      language: this.lang,
      audioOnly: this.plan.audioOnly,
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen && !this.gliding,
      hinted: this.stepHinted,
      lastEvent: this.lastEvent,
      target: target ? target.id : null,
      prediction: this.magnet.prediction,
      objects,
      magnet: magnetRect,
      tips: { x: tipPage.x, y: tipPage.y },
      buttons,
    };
  }
}

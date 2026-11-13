// Sink or Float (docs/specs/sink-or-float.md), Pass 1: a no-fail buoyancy experiment in Science World.
// Pure rules live in ./sinkFloatMachine.ts (state machine) and ./sinkFloatRound.ts (levels, trials, lines).
// Test handles: `getSinkFloatInfo()` / `seedSinkFloatLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, SinkOrFloatContent } from '../../content/schema';
import { loadSinkOrFloat } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, popIn, pressSquash, squashStretch, tweenAsync, wait } from '../../anim/tweens';
import { propArtKey } from '../../anim/artRegistry';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import {
  createSinkFloat,
  offerFor,
  settle,
  tapObject,
  tapPrediction,
  type FloatObjectId,
  type FloatOutcome,
  type SinkFloatEvent,
  type SinkFloatState,
} from './sinkFloatMachine';
import {
  askLine,
  introLine,
  letsSeeLine,
  namingLines,
  planForLevel,
  trialForDrop,
  trialForPrediction,
  type SinkFloatPlan,
} from './sinkFloatRound';
import type { SinkFloatInfo } from './sinkFloatTypes';

let cachedContent: SinkOrFloatContent | null = null;
function content(): SinkOrFloatContent {
  cachedContent ??= loadSinkOrFloat();
  return cachedContent;
}

const DEPTH = { background: -10, table: -5, tank: 20, inTank: 25, props: 30, objects: 40, flying: 300 } as const;
const OUTLINE_COLOR = 0x3b2a22;

const TANK_SIZE = 320;
const OBJ_SIZE = 128;
const BTN_SIZE = 136;

/** Native prop-water-tank SVG y=90 (surface) and y=290 (bottom) relative to tank center (160). */
const WATER_SURFACE_OFFSET_Y = 90 - TANK_SIZE / 2;
const WATER_BOTTOM_OFFSET_Y = 290 - TANK_SIZE / 2 - 44;
const TANK_ENTRY_OFFSET_Y = -TANK_SIZE / 2 - 20;

const LINE_MAX_MS = 2200;
const HOLD_MS = 750;

interface Point {
  x: number;
  y: number;
}

interface Layout {
  tableY: number;
  tank: Point;
  objects: readonly [Point, Point, Point];
  buttons: {
    floats: Point;
    sinks: Point;
  };
}

function computeLayout(w: number, h: number): Layout {
  if (w >= h) {
    // Landscape (1280x800): tank centre, three objects beside it on the left, float/sink buttons on the right.
    const objY = h * 0.58;
    return {
      tableY: h * 0.48,
      tank: { x: w / 2, y: h * 0.46 },
      objects: [
        { x: 115, y: objY },
        { x: 258, y: objY },
        { x: 401, y: objY },
      ],
      buttons: {
        floats: { x: 960, y: 300 },
        sinks: { x: 960, y: 465 },
      },
    };
  }
  // Portrait (800x1280): tank above, objects in a row under it, prediction buttons below the objects.
  const objY = h * 0.62;
  const btnY = h * 0.80;
  return {
    tableY: h * 0.42,
    tank: { x: w / 2, y: h * 0.34 },
    objects: [
      { x: 180, y: objY },
      { x: 400, y: objY },
      { x: 620, y: objY },
    ],
    buttons: {
      floats: { x: 290, y: btnY },
      sinks: { x: 510, y: btnY },
    },
  };
}

export class SinkFloatScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: Layout;
  private lang: Lang | null = null;
  private plan!: SinkFloatPlan;
  private machine!: SinkFloatState;
  private levelNo = 1;
  private tankView?: Phaser.GameObjects.Container;
  private objectViews = new Map<FloatObjectId, Phaser.GameObjects.Container>();
  private floatBtn?: Phaser.GameObjects.Container;
  private sinkBtn?: Phaser.GameObjects.Container;
  private selectionRing?: Phaser.GameObjects.Arc;
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();
  private ready = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPending = true;
  private trialCount = 0;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('SinkFloatScene');
  }

  create(): void {
    setAppScreen('sink-or-float');
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
    this.stepHinted = false;
    this.helpOpen = false;
    this.introPending = true;
    this.trialCount = 0;
    this.objectViews = new Map();
    this.activeTransients = new Set();
    this.tankView = undefined;
    this.floatBtn = undefined;
    this.sinkBtn = undefined;
    this.selectionRing = undefined;
    this.hintTimer = undefined;
    this.layout = computeLayout(this.scale.width, this.scale.height);

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
    this.buildTank();
    this.buildSelectionRing();
    this.buildPredictionButtons();
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startVisit();

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
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const obj of [...this.activeTransients]) this.destroyObject(obj);
    for (const view of this.objectViews.values()) this.destroyObject(view);
    this.objectViews.clear();
    if (this.tankView) this.tweens.killTweensOf(this.tankView);
    if (this.floatBtn) this.tweens.killTweensOf(this.floatBtn);
    if (this.sinkBtn) this.tweens.killTweensOf(this.sinkBtn);
    if (this.selectionRing) this.tweens.killTweensOf(this.selectionRing);
    this.context.audio.stopAll();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
  }

  // ---------------------------------------------------------------- scene art

  private paintBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    // Same pale blue lab wall and wooden table band as Potion Lab.
    this.cameras.main.setBackgroundColor('#d9f0ff');
    const tableH = h - this.layout.tableY;
    this.add.rectangle(w / 2, this.layout.tableY + tableH / 2, w, tableH, 0xd8a46f).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, this.layout.tableY + 5, w, 10, 0xb8814f).setDepth(DEPTH.table);
    this.add.rectangle(w / 2, this.layout.tableY, w, 4, OUTLINE_COLOR).setDepth(DEPTH.table);
  }

  private buildTank(): void {
    const { x, y } = this.layout.tank;
    const container = this.add.container(x, y).setDepth(DEPTH.tank);
    const key = propArtKey('water-tank');
    if (key && this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(TANK_SIZE, TANK_SIZE));
    } else {
      const g = this.add.graphics();
      g.fillStyle(0x8c5230, 0.2).fillEllipse(0, 142, 230, 22);
      g.fillStyle(0xe6f4f9, 1).fillRoundedRect(-124, -126, 248, 260, 18);
      g.fillStyle(0x8bd3f7, 0.78).fillRect(-114, -70, 228, 196);
      g.lineStyle(5, 0xffffff, 0.75).beginPath();
      g.moveTo(-112, -70);
      g.lineTo(112, -70);
      g.strokePath();
      g.lineStyle(6, OUTLINE_COLOR, 1).strokeRoundedRect(-124, -126, 248, 260, 18);
      container.add(g);
    }
    container.setSize(TANK_SIZE, TANK_SIZE);
    this.tankView = container;
  }

  private buildSelectionRing(): void {
    const ring = this.add
      .circle(0, 0, OBJ_SIZE * 0.56, 0xfff3b0, 0.35)
      .setStrokeStyle(5, 0xffb703)
      .setDepth(DEPTH.props)
      .setVisible(false);
    this.selectionRing = ring;
  }

  private buildPredictionButtons(): void {
    this.floatBtn = this.makePredictionButton('floats', this.layout.buttons.floats);
    this.sinkBtn = this.makePredictionButton('sinks', this.layout.buttons.sinks);
  }

  private makePredictionButton(kind: FloatOutcome, pos: Point): Phaser.GameObjects.Container {
    const container = this.add.container(pos.x, pos.y).setDepth(DEPTH.objects).setVisible(false);
    const card = this.add
      .graphics()
      .fillStyle(0xfffdf9, 1)
      .fillRoundedRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE, 24)
      .lineStyle(6, OUTLINE_COLOR, 1)
      .strokeRoundedRect(-BTN_SIZE / 2, -BTN_SIZE / 2, BTN_SIZE, BTN_SIZE, 24);
    container.add(card);

    const icon = this.add.graphics();
    if (kind === 'floats') {
      // Water at the lower half with a wave line and a bright ball floating on top.
      icon.fillStyle(0x8bd3f7, 0.85).fillRoundedRect(-48, 6, 96, 44, { tl: 0, tr: 0, bl: 14, br: 14 });
      icon.lineStyle(5, 0x2b7bb9, 1).beginPath();
      icon.moveTo(-48, 6);
      icon.lineTo(-24, -2);
      icon.lineTo(0, 8);
      icon.lineTo(24, -2);
      icon.lineTo(48, 6);
      icon.strokePath();
      icon.fillStyle(0xffd43b, 1).fillCircle(0, -14, 20);
      icon.lineStyle(5, OUTLINE_COLOR, 1).strokeCircle(0, -14, 20);
    } else {
      // Water filling the tank icon with a wave at the top and a heavy ball resting at the bottom.
      icon.fillStyle(0x8bd3f7, 0.85).fillRoundedRect(-48, -32, 96, 82, 12);
      icon.lineStyle(5, 0x2b7bb9, 1).beginPath();
      icon.moveTo(-48, -28);
      icon.lineTo(-24, -36);
      icon.lineTo(0, -26);
      icon.lineTo(24, -36);
      icon.lineTo(48, -28);
      icon.strokePath();
      icon.fillStyle(0x8d99ae, 1).fillCircle(0, 26, 20);
      icon.lineStyle(5, OUTLINE_COLOR, 1).strokeCircle(0, 26, 20);
    }
    container.add(icon);
    container.setSize(BTN_SIZE, BTN_SIZE);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => void this.onPrediction(kind));
    return container;
  }

  private drawObjectFallback(id: FloatObjectId): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    switch (id) {
      case 'ball':
        g.fillStyle(0xffd43b, 1).fillCircle(0, 0, 44);
        g.fillStyle(0xf25c54, 1).fillRect(-40, -10, 80, 20);
        g.lineStyle(6, OUTLINE_COLOR, 1).strokeCircle(0, 0, 44);
        break;
      case 'leaf':
        g.fillStyle(0x57c457, 1).fillEllipse(4, -2, 82, 48);
        g.lineStyle(6, OUTLINE_COLOR, 1).strokeEllipse(4, -2, 82, 48);
        g.lineStyle(5, OUTLINE_COLOR, 1).beginPath().moveTo(-44, 14).lineTo(30, -6).strokePath();
        break;
      case 'apple':
        g.fillStyle(0xf24c4c, 1).fillCircle(0, 6, 40);
        g.lineStyle(6, OUTLINE_COLOR, 1).strokeCircle(0, 6, 40);
        g.fillStyle(0x57c457, 1).fillEllipse(14, -36, 26, 14);
        g.lineStyle(5, OUTLINE_COLOR, 1).beginPath().moveTo(0, -30).lineTo(4, -46).strokePath();
        break;
      case 'stone':
        g.fillStyle(0x9aa5b1, 1).fillEllipse(0, 6, 88, 62);
        g.lineStyle(6, OUTLINE_COLOR, 1).strokeEllipse(0, 6, 88, 62);
        break;
      case 'key':
        g.fillStyle(0xf4b942, 1).fillCircle(-24, 0, 22);
        g.fillRect(-4, -8, 50, 16);
        g.fillRect(26, 8, 12, 16);
        g.lineStyle(5, OUTLINE_COLOR, 1).strokeCircle(-24, 0, 22);
        g.strokeRect(-4, -8, 50, 16);
        break;
      case 'spoon':
        g.fillStyle(0xcbd5e1, 1).fillEllipse(-24, 0, 42, 28);
        g.fillRoundedRect(-4, -6, 52, 12, 6);
        g.lineStyle(5, OUTLINE_COLOR, 1).strokeEllipse(-24, 0, 42, 28);
        g.strokeRoundedRect(-4, -6, 52, 12, 6);
        break;
    }
    return g;
  }

  /** Builds the offered objects; resolves when their pop-in is done (taps during it would miss). */
  private buildOfferedObjects(animate: boolean): Promise<void> {
    const pops: Promise<void>[] = [];
    for (const view of this.objectViews.values()) this.destroyObject(view);
    this.objectViews.clear();
    this.selectionRing?.setVisible(false);

    this.machine.offered.forEach((id, idx) => {
      const pos = this.layout.objects[idx];
      const container = this.add.container(pos.x, pos.y).setDepth(DEPTH.objects);
      const key = propArtKey(`float-${id}`);
      if (key && this.textures.exists(key)) {
        container.add(this.add.image(0, 0, key).setDisplaySize(OBJ_SIZE, OBJ_SIZE));
      } else {
        container.add(this.drawObjectFallback(id));
      }
      container.setSize(OBJ_SIZE, OBJ_SIZE);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => void this.onObjectTap(id));
      this.objectViews.set(id, container);
      if (animate) pops.push(popIn(this, container, 70 + idx * 65));
    });
    return Promise.all(pops).then(() => undefined);
  }

  private syncButtonVisibility(): void {
    const show = this.plan.mode === 'predict';
    const active = this.machine.phase === 'predicting';
    for (const btn of [this.floatBtn, this.sinkBtn]) {
      if (!btn) continue;
      btn.setVisible(show);
      btn.setAlpha(active ? 1 : 0.52);
    }
  }

  // ---------------------------------------------------------------- HUD & speech

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
    void this.speak({ lineId: 'sinkFloat.help.he', lang: 'he', text: content().helpTextHe });
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

  // ---------------------------------------------------------------- round & game flow

  private refreshRoundPlan(): void {
    const c = content();
    const settings = this.context.store.getState().settings;
    this.lang = nextRoundLanguage(this.lang, this.lang === null || this.skills.atRoundBoundary(this.lang), settings.languages);
    this.levelNo = this.skills.level(this.lang);
    this.plan = planForLevel(c.adaptive.levels[this.levelNo - 1]);
  }

  private startVisit(): void {
    const token = ++this.visitToken;
    const c = content();
    this.refreshRoundPlan();
    const offered = offerFor(c.objects, null);
    this.machine = createSinkFloat({ mode: this.plan.mode, offered });
    this.stepHinted = false;
    this.ready = false;

    const objectsIn = this.buildOfferedObjects(true);
    this.syncButtonVisibility();

    if (this.introPending) {
      this.introPending = false;
      void this.speakSequence([introLine(c, this.plan.mode)], token);
    }

    const tankIn = this.tankView ? popIn(this, this.tankView, 40) : Promise.resolve();
    void Promise.all([tankIn, objectsIn]).then(() => {
      if (token !== this.visitToken) return;
      this.ready = true;
      this.scheduleHint();
    });
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen || this.machine.phase === 'watching') return;
    this.stepHinted = true;
    this.context.sfx.hint();
    if (this.machine.phase === 'choosing') {
      const firstView = this.objectViews.get(this.machine.offered[0]);
      if (firstView) void hintPulse(this, firstView);
      return;
    }
    if (this.plan.hintPulse) {
      if (this.floatBtn) void hintPulse(this, this.floatBtn);
      if (this.sinkBtn) void hintPulse(this, this.sinkBtn);
    }
    void this.speakSequence([askLine(content())], this.visitToken);
  }

  private async onObjectTap(id: FloatObjectId): Promise<void> {
    const view = this.objectViews.get(id);
    if (view) void pressSquash(this, view);
    if (!this.ready || this.helpOpen) return;

    const { state, event } = tapObject(this.machine, id);
    if (event.kind === 'busy') return;

    this.machine = state;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();

    if (event.kind === 'asked') {
      this.syncButtonVisibility();
      if (view && this.selectionRing) {
        this.selectionRing.setPosition(view.x, view.y).setVisible(true);
        void popIn(this, this.selectionRing, 0);
      }
      // The buttons are already on screen (dimmed): light them up with a pulse, never a pop-in
      // from scale 0, so a quick tap right after choosing always lands.
      if (this.plan.hintPulse) {
        if (this.floatBtn) void hintPulse(this, this.floatBtn);
        if (this.sinkBtn) void hintPulse(this, this.sinkBtn);
      }
      void this.speakSequence([askLine(content())], this.visitToken);
      this.scheduleHint();
      return;
    }

    if (event.kind === 'dropped') {
      this.ready = false;
      await this.playDropAndReveal(event, this.visitToken);
    }
  }

  private async onPrediction(guess: FloatOutcome): Promise<void> {
    const btn = guess === 'floats' ? this.floatBtn : this.sinkBtn;
    if (btn) void pressSquash(this, btn);
    if (!this.ready || this.helpOpen) return;

    const { state, event } = tapPrediction(this.machine, guess);
    if (event.kind !== 'revealed') return;

    this.machine = state;
    this.ready = false;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();
    this.syncButtonVisibility();

    await this.playDropAndReveal(event, this.visitToken);
  }

  private spawnSplashRipple(x: number, y: number): void {
    const ripple = this.trackTransient(
      this.add.ellipse(x, y, 40, 14, 0xffffff, 0).setStrokeStyle(4, 0xffffff, 0.85).setDepth(DEPTH.inTank + 1),
    );
    void tweenAsync(this, {
      targets: ripple,
      scaleX: 2.6,
      scaleY: 1.8,
      alpha: 0,
      duration: isReducedMotion() ? 160 : 420,
      ease: 'Quad.easeOut',
    }).then(() => this.destroyObject(ripple));
  }

  private async playDropAndReveal(
    event: Extract<SinkFloatEvent, { kind: 'dropped' | 'revealed' }>,
    token: number,
  ): Promise<void> {
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();
    const lang = this.lang!;
    const objView = this.objectViews.get(event.objectId);
    this.selectionRing?.setVisible(false);

    // Wrong prediction starts with gentle "let's see..." while the object drops into the tank.
    this.speechBatch++;
    const letsSeePromise =
      event.kind === 'revealed' && !event.correct ? this.speak(letsSeeLine(c), 1200) : Promise.resolve();

    const tankX = this.layout.tank.x;
    const waterY = this.layout.tank.y + WATER_SURFACE_OFFSET_Y;
    const bottomY = this.layout.tank.y + WATER_BOTTOM_OFFSET_Y;

    if (objView) {
      objView.setDepth(DEPTH.flying);
      await flyArc(this, objView, tankX, this.layout.tank.y + TANK_ENTRY_OFFSET_Y, {
        duration: isReducedMotion() ? 110 : 240,
        height: 70,
        endScale: 0.82,
      });
      if (!alive()) return;

      objView.setDepth(DEPTH.inTank);
      await tweenAsync(this, {
        targets: objView,
        y: waterY,
        scale: 0.78,
        duration: isReducedMotion() ? 100 : 200,
        ease: 'Quad.easeIn',
      });
      if (!alive()) return;

      Juice.for(this).burst('sparkle', tankX, waterY, 10);
      this.spawnSplashRipple(tankX, waterY);
      if (this.tankView) void squashStretch(this, this.tankView);

      if (event.outcome === 'floats') {
        await tweenAsync(this, {
          targets: objView,
          y: waterY - 8,
          duration: isReducedMotion() ? 120 : 260,
          yoyo: true,
          repeat: isReducedMotion() ? 0 : 1,
          ease: 'Sine.easeInOut',
        });
      } else {
        await tweenAsync(this, {
          targets: objView,
          y: bottomY,
          duration: isReducedMotion() ? 220 : 800,
          ease: 'Sine.easeInOut',
        });
      }
      if (!alive()) return;
    }

    await letsSeePromise;
    if (!alive()) return;

    // Record adaptive trial and learning session completion; wrong predictions never penalize.
    const trial =
      event.kind === 'dropped' ? trialForDrop(event) : trialForPrediction(event, this.stepHinted);
    this.skills.record(lang, trial);
    this.stepHinted = false;
    this.trialCount++;
    const earnedStar = this.trialCount % this.plan.dropsPerStar === 0;

    this.context.sfx.yay();
    this.session.complete();
    const juice = Juice.for(this);
    const burstY = this.layout.tank.y - 40;
    if (earnedStar) {
      const state = this.profileState();
      state.stars++;
      this.context.store.persist();
      juice.burst('confetti', tankX, burstY);
      juice.burst('star', tankX, burstY);
      this.flyStarToCounter(tankX, burstY);
    } else {
      juice.burst('sparkle', tankX, burstY, 8);
    }

    const [heResult, learnResult] = namingLines(c, event.objectId, lang);
    const lines = earnedStar ? [heResult, learnResult, heLine('praise.0')] : [heResult, learnResult];
    await this.speakSequence(lines, token);
    if (!alive()) return;
    await wait(this, HOLD_MS);
    if (!alive()) return;

    this.session.reportCelebrating(false);
    this.refreshRoundPlan();
    const nextOffered = offerFor(c.objects, this.machine.offered);
    const { state: nextState } = settle(this.machine, nextOffered, this.plan.mode);
    this.machine = nextState;
    this.syncButtonVisibility();
    await this.buildOfferedObjects(true);
    if (!alive()) return;
    this.ready = true;
    this.scheduleHint();
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
    const star = this.trackTransient(
      this.add.image(fromX, fromY, fxTextureKey(this, 'star')).setDepth(DEPTH.flying).setScale(0.9),
    );
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

  getSinkFloatInfo(): SinkFloatInfo | null {
    if (!this.machine || !this.lang) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const toPage = (center: Point, w: number, h: number): Rect =>
      gameRectToPageRect({ x: center.x - w / 2, y: center.y - h / 2, width: w, height: h }, canvasRect, size);

    const objects: Partial<Record<FloatObjectId, Rect>> = {};
    this.machine.offered.forEach((id, idx) => {
      objects[id] = toPage(this.layout.objects[idx], OBJ_SIZE, OBJ_SIZE);
    });

    return {
      phase: this.machine.phase,
      mode: this.machine.mode,
      level: this.levelNo,
      skillKey: this.skills.key(this.lang),
      language: this.lang,
      audioOnly: this.plan.audioOnly,
      offered: this.machine.offered,
      selected: this.machine.selected,
      lastOutcome: this.machine.lastOutcome,
      lastCorrect: this.machine.lastCorrect,
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      objects,
      tank: toPage(this.layout.tank, TANK_SIZE, TANK_SIZE),
      buttons: {
        floats: toPage(this.layout.buttons.floats, BTN_SIZE, BTN_SIZE),
        sinks: toPage(this.layout.buttons.sinks, BTN_SIZE, BTN_SIZE),
      },
    };
  }
}

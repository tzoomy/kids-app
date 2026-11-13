// Potion Lab (docs/specs/potion-lab.md), Pass 1: a no-fail color-mixing game in Science World.
// Pure rules live in ./potionMachine.ts (state machine) and ./potionRound.ts (levels, trials, lines).
// Test handles: `getPotionInfo()` / `seedPotionLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, PotionLabContent } from '../../content/schema';
import { loadPotionLab } from '../../content/loadContent';
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
  PRIMARY_COLORS,
  createPotion,
  potsFor,
  resetBowl,
  tapPot,
  type PotionColor,
  type PotionEvent,
  type PotionState,
  type PrimaryColor,
  type SecondaryColor,
} from './potionMachine';
import {
  colorLine,
  introLine,
  namingLines,
  nextRequest,
  planForLevel,
  requestLine,
  trialForMix,
  trialForRequest,
  tryAgainLine,
  type PotionPlan,
} from './potionRound';
import type { PotionInfo } from './potionTypes';

let cachedContent: PotionLabContent | null = null;
function content(): PotionLabContent {
  cachedContent ??= loadPotionLab();
  return cachedContent;
}

const DEPTH = { background: -10, table: -5, props: 20, pots: 40, flying: 300 } as const;
const OUTLINE_COLOR = 0x3b2a22;
/** Pot and bowl display sizes in game coordinates (stay well above 64 CSS px in both orientations). */
const POT_SIZE = 176;
const BOWL_W = 320;
const BOWL_H = 240;
/** Procedural fallback pot: paint ellipse in a 200x200 frame (only used when the palette pot art is missing). */
const POT_SVG_SIZE = 200;
const POT_PAINT_CY = 61;
const POT_PAINT_RX = 50;
const POT_PAINT_RY = 11;
/** Native prop-mixing-bowl SVG coordinates for the liquid region (x 40..280, y 76..176 on 320x240). */
const BOWL_LIQUID_TOP_Y = 94 - BOWL_H / 2;
const BOWL_LIQUID_RX = 119;
const BOWL_LIQUID_RY_BOTTOM = 82;
const BOWL_LIQUID_RY_TOP = 13;

const LINE_MAX_MS = 2200;
const MIX_HOLD_MS = 1000;

interface Point {
  x: number;
  y: number;
}

interface Layout {
  tableY: number;
  bowl: Point;
  swatch: Point;
  pots: Record<PrimaryColor, Point>;
}

function computeLayout(w: number, h: number): Layout {
  if (w >= h) {
    const potY = h * 0.77;
    return {
      tableY: h * 0.46,
      bowl: { x: w / 2, y: h * 0.44 },
      swatch: { x: w / 2 + 250, y: h * 0.42 },
      pots: {
        red: { x: w / 2 - 260, y: potY },
        yellow: { x: w / 2, y: potY },
        blue: { x: w / 2 + 260, y: potY },
      },
    };
  }
  const potY = h * 0.72;
  return {
    tableY: h * 0.40,
    bowl: { x: w / 2, y: h * 0.38 },
    swatch: { x: w / 2 + 260, y: h * 0.36 },
    pots: {
      red: { x: w / 2 - 230, y: potY },
      yellow: { x: w / 2, y: potY },
      blue: { x: w / 2 + 230, y: potY },
    },
  };
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

function colorHex(c: PotionLabContent, color: PotionColor): number {
  return hexToNumber(c.colors[color].hex);
}

export class PotionScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: Layout;
  private lang: Lang | null = null;
  private plan!: PotionPlan;
  private potion!: PotionState;
  private levelNo = 1;
  private bowlView?: Phaser.GameObjects.Container;
  private liquidGraphics?: Phaser.GameObjects.Graphics;
  private swatchView?: Phaser.GameObjects.Container;
  private swatchFill?: Phaser.GameObjects.Arc;
  private pots = new Map<PrimaryColor, Phaser.GameObjects.Container>();
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();
  private ready = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPending = true;
  private freeMixCount = 0;
  private lastRequest: SecondaryColor | null = null;
  private lastEvent: PotionEvent['kind'] | null = null;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('PotionScene');
  }

  create(): void {
    setAppScreen('potion-lab');
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
    this.freeMixCount = 0;
    this.lastRequest = null;
    this.lastEvent = null;
    this.pots = new Map();
    this.activeTransients = new Set();
    this.bowlView = undefined;
    this.liquidGraphics = undefined;
    this.swatchView = undefined;
    this.swatchFill = undefined;
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
    this.buildBowl();
    this.buildSwatch();
    PRIMARY_COLORS.forEach((color, idx) => this.buildPot(color, idx));
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
    for (const pot of this.pots.values()) this.tweens.killTweensOf(pot);
    if (this.bowlView) this.tweens.killTweensOf(this.bowlView);
    if (this.swatchView) this.tweens.killTweensOf(this.swatchView);
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
    // Pale blue lab wall and a wooden table band across the lower portion.
    this.cameras.main.setBackgroundColor('#d9f0ff');
    const tableH = h - this.layout.tableY;
    this.add.rectangle(w / 2, this.layout.tableY + tableH / 2, w, tableH, 0xd8a46f).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, this.layout.tableY + 5, w, 10, 0xb8814f).setDepth(DEPTH.table);
    this.add.rectangle(w / 2, this.layout.tableY, w, 4, OUTLINE_COLOR).setDepth(DEPTH.table);
  }

  private buildBowl(): void {
    const { x, y } = this.layout.bowl;
    const container = this.add.container(x, y).setDepth(DEPTH.props);
    const key = propArtKey('mixing-bowl');
    if (key && this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(BOWL_W, BOWL_H));
    } else {
      const fallback = this.add.graphics();
      fallback.fillStyle(0xcfe8f3, 1).fillRect(-46, 56, 92, 34);
      fallback.lineStyle(6, OUTLINE_COLOR, 1).strokeRect(-46, 56, 92, 34);
      fallback.fillStyle(0xdff2fa, 1).fillEllipse(0, 0, BOWL_W - 40, BOWL_H * 0.72);
      fallback.lineStyle(6, OUTLINE_COLOR, 1).strokeEllipse(0, 0, BOWL_W - 40, BOWL_H * 0.72);
      container.add(fallback);
    }
    const liquid = this.add.graphics();
    container.add(liquid);
    container.setSize(BOWL_W, BOWL_H);
    this.bowlView = container;
    this.liquidGraphics = liquid;
  }

  private renderBowlLiquid(color: PotionColor | null): void {
    const g = this.liquidGraphics;
    if (!g) return;
    g.clear();
    if (!color) return;

    const hex = colorHex(content(), color);
    const pts: Phaser.Math.Vector2[] = [];
    const steps = 20;
    // Lower half-ellipse inside the bowl's white liquid area (x 40..280, y 94..176).
    for (let i = 0; i <= steps; i++) {
      const a = (i / steps) * Math.PI;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * BOWL_LIQUID_RX, BOWL_LIQUID_TOP_Y + Math.sin(a) * BOWL_LIQUID_RY_BOTTOM));
    }
    // Gentle curved top surface across the rim of the liquid.
    for (let i = 1; i < steps; i++) {
      const a = Math.PI + (i / steps) * Math.PI;
      pts.push(new Phaser.Math.Vector2(Math.cos(a) * BOWL_LIQUID_RX, BOWL_LIQUID_TOP_Y + Math.sin(a) * BOWL_LIQUID_RY_TOP));
    }
    g.fillStyle(hex, 0.94);
    g.fillPoints(pts, true);
    g.lineStyle(4, 0xffffff, 0.45);
    g.strokeEllipse(0, BOWL_LIQUID_TOP_Y + 2, BOWL_LIQUID_RX * 1.4, BOWL_LIQUID_RY_TOP * 1.1);
  }

  private buildSwatch(): void {
    const { x, y } = this.layout.swatch;
    const container = this.add.container(x, y).setDepth(DEPTH.props).setVisible(false);
    const frame = this.add.circle(0, 0, 54, 0xfffdf9).setStrokeStyle(6, OUTLINE_COLOR);
    const fill = this.add.circle(0, 0, 40, 0xffffff).setStrokeStyle(4, OUTLINE_COLOR);
    container.add([frame, fill]);
    container.setSize(108, 108);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (!this.ready || this.helpOpen || !this.potion.request || !this.lang) return;
      this.session.reportInteraction();
      this.context.sfx.tap();
      void pressSquash(this, container);
      const c = content();
      void this.speakSequence([requestLine(c, this.potion.request), colorLine(c, this.potion.request, this.lang)], this.visitToken);
    });
    this.swatchView = container;
    this.swatchFill = fill;
  }

  private renderTargetSwatch(animate = false): void {
    if (!this.swatchView || !this.swatchFill) return;
    const req = this.potion.request;
    if (this.plan.mode !== 'request' || this.plan.audioOnly || req === null) {
      this.swatchView.setVisible(false);
      return;
    }
    this.swatchFill.setFillStyle(colorHex(content(), req));
    this.swatchView.setVisible(true);
    if (animate) void popIn(this, this.swatchView, 60);
  }

  private buildPot(color: PrimaryColor, index: number): void {
    const pos = this.layout.pots[color];
    const container = this.add.container(pos.x, pos.y).setDepth(DEPTH.pots);
    const scale = POT_SIZE / POT_SVG_SIZE;
    const paintY = (POT_PAINT_CY - POT_SVG_SIZE / 2) * scale;
    const paintW = POT_PAINT_RX * 2 * scale;
    const paintH = POT_PAINT_RY * 2 * scale;
    const hex = colorHex(content(), color);

    // The shared palette pots (public/art/palette/pot-<color>.svg) already carry their paint colour.
    const key = `pot-${color}`;
    if (this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(POT_SIZE, POT_SIZE));
    } else {
      const body = this.add.rectangle(0, 12 * scale, POT_SIZE * 0.62, POT_SIZE * 0.56, 0xf3e9d8).setStrokeStyle(6, OUTLINE_COLOR);
      const rim = this.add.ellipse(0, -42 * scale, POT_SIZE * 0.66, POT_SIZE * 0.22, 0xfffbf2).setStrokeStyle(6, OUTLINE_COLOR);
      // Paint surface ellipse drawn procedurally on top in the palette color.
      container.add([body, rim, this.add.ellipse(0, paintY, paintW, paintH, hex)]);
    }

    container.setSize(POT_SIZE, POT_SIZE);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => void this.onPot(color));
    this.pots.set(color, container);
    void popIn(this, container, 100 + index * 70);
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
    void this.speak({ lineId: 'potion.help.he', lang: 'he', text: content().helpTextHe });
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

  // ---------------------------------------------------------------- round & mixing

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
    const req = this.plan.mode === 'request' ? nextRequest(this.lastRequest) : null;
    this.lastRequest = req;
    this.potion = createPotion({ request: req });
    this.stepHinted = false;
    this.lastEvent = null;
    this.ready = false;
    this.renderBowlLiquid(null);
    this.renderTargetSwatch(true);

    const intro = this.introPending ? introLine(c, this.plan.mode) : undefined;
    this.introPending = false;
    const lines: SpeechRequest[] = [];
    if (intro) lines.push(intro);
    if (req !== null && this.lang) {
      lines.push(requestLine(c, req), colorLine(c, req, this.lang));
    }
    if (lines.length > 0) void this.speakSequence(lines, token);

    if (this.bowlView) {
      void popIn(this, this.bowlView, 60).then(() => {
        if (token !== this.visitToken) return;
        this.ready = true;
        this.scheduleHint();
      });
    } else {
      this.ready = true;
      this.scheduleHint();
    }
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen || this.potion.phase !== 'pouring') return;
    this.stepHinted = true;
    this.context.sfx.hint();
    const c = content();
    if (this.potion.request === null) {
      const potColor = this.potion.firstColor === PRIMARY_COLORS[0] ? PRIMARY_COLORS[1] : PRIMARY_COLORS[0];
      const pot = this.pots.get(potColor);
      if (pot) void hintPulse(this, pot);
      return;
    }
    if (this.plan.hintPulse) {
      for (const color of potsFor(this.potion.request)) {
        const pot = this.pots.get(color);
        if (pot) void hintPulse(this, pot);
      }
    }
    if (this.lang) {
      void this.speakSequence([requestLine(c, this.potion.request), colorLine(c, this.potion.request, this.lang)], this.visitToken);
    }
  }

  private async onPot(color: PrimaryColor): Promise<void> {
    const pot = this.pots.get(color);
    if (pot) void pressSquash(this, pot);
    if (!this.ready || this.helpOpen) return;

    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    this.ready = false;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();

    // Short pour drop tween from the tapped pot into the bowl.
    const potPos = this.layout.pots[color];
    const drop = this.trackTransient(
      this.add.circle(potPos.x, potPos.y - 30, 18, colorHex(content(), color)).setStrokeStyle(4, OUTLINE_COLOR).setDepth(DEPTH.flying),
    );
    await flyArc(this, drop, this.layout.bowl.x, this.layout.bowl.y + BOWL_LIQUID_TOP_Y, {
      duration: isReducedMotion() ? 100 : 240,
      height: 90,
      endScale: 0.7,
    });
    this.destroyObject(drop);
    if (!alive()) return;

    const { state, event } = tapPot(this.potion, color);
    this.potion = state;
    this.lastEvent = event.kind;

    if (event.kind === 'busy') {
      this.ready = true;
      return;
    }

    if (event.kind === 'poured') {
      this.renderBowlLiquid(state.bowlColor);
      Juice.for(this).burst('sparkle', this.layout.bowl.x, this.layout.bowl.y + BOWL_LIQUID_TOP_Y, 6);
      if (this.bowlView) void squashStretch(this, this.bowlView);
      this.ready = true;
      this.scheduleHint();
      return;
    }

    await this.onMixResult(event, token);
  }

  private async playSwirl(token: number): Promise<void> {
    if (this.bowlView) void squashStretch(this, this.bowlView);
    const swirl = this.trackTransient(
      this.add.container(this.layout.bowl.x, this.layout.bowl.y + BOWL_LIQUID_TOP_Y + 18).setDepth(DEPTH.props + 2),
    );
    const arc = this.add.graphics();
    arc.lineStyle(6, 0xffffff, 0.8);
    arc.beginPath();
    arc.arc(0, 0, 44, 0, Math.PI * 1.25);
    arc.strokePath();
    arc.beginPath();
    arc.arc(0, 0, 22, Math.PI, Math.PI * 2.2);
    arc.strokePath();
    swirl.add(arc);

    await tweenAsync(this, {
      targets: swirl,
      angle: isReducedMotion() ? 90 : 360,
      alpha: { from: 0.95, to: 0 },
      duration: isReducedMotion() ? 140 : 400,
      ease: 'Cubic.easeOut',
    });
    this.destroyObject(swirl);
    if (token !== this.visitToken || !this.sys.isActive()) return;
  }

  private async onMixResult(
    event: Extract<PotionEvent, { kind: 'mixed' | 'matched' | 'mixed-other' }>,
    token: number,
  ): Promise<void> {
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();
    const lang = this.lang!;

    this.renderBowlLiquid(this.potion.bowlColor);
    await this.playSwirl(token);
    if (!alive()) return;

    const juice = Juice.for(this);
    const burstY = this.layout.bowl.y - 30;
    const [heColor, learnColor] = namingLines(c, event.result, lang);

    if (event.kind === 'mixed-other') {
      juice.burst('sparkle', this.layout.bowl.x, burstY, 8);
      await this.speakSequence([heColor, learnColor, tryAgainLine(c, event.target)], token);
      if (!alive()) return;
      await wait(this, MIX_HOLD_MS);
      if (!alive()) return;

      this.potion = resetBowl(this.potion);
      this.renderBowlLiquid(null);
      this.ready = true;
      this.scheduleHint();
      return;
    }

    // Both `mixed` (free mode) and `matched` (request mode) celebrate and record an adaptive trial.
    let earnedStar = false;
    if (event.kind === 'mixed') {
      this.skills.record(lang, trialForMix(event));
      this.stepHinted = false;
      this.freeMixCount++;
      earnedStar = this.freeMixCount % this.plan.mixesPerStar === 0;
    } else {
      this.skills.record(lang, trialForRequest(event, this.stepHinted));
      this.stepHinted = false;
      earnedStar = true;
    }

    this.context.sfx.yay();
    this.session.complete();
    if (earnedStar) {
      const state = this.profileState();
      state.stars++;
      this.context.store.persist();
      juice.burst('confetti', this.layout.bowl.x, burstY);
      juice.burst('star', this.layout.bowl.x, burstY);
      this.flyStarToCounter(this.layout.bowl.x, burstY);
    } else {
      juice.burst('sparkle', this.layout.bowl.x, burstY, 10);
    }

    const lines = earnedStar ? [heColor, learnColor, heLine('praise.0')] : [heColor, learnColor];
    await this.speakSequence(lines, token);
    if (!alive()) return;
    await wait(this, MIX_HOLD_MS);
    if (!alive()) return;

    // Celebration ends when the next round / request begins.
    this.session.reportCelebrating(false);
    this.refreshRoundPlan();
    const nextReq = this.plan.mode === 'request' ? nextRequest(this.lastRequest) : null;
    this.lastRequest = nextReq;
    this.potion = resetBowl(this.potion, nextReq);
    this.renderBowlLiquid(null);
    this.renderTargetSwatch(nextReq !== null);
    this.ready = true;
    this.scheduleHint();

    if (nextReq !== null && this.lang) {
      void this.speakSequence([requestLine(c, nextReq), colorLine(c, nextReq, this.lang)], token);
    }
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

  getPotionInfo(): PotionInfo | null {
    if (!this.potion || !this.lang) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const potRect = (color: PrimaryColor): Rect => {
      const p = this.layout.pots[color];
      return gameRectToPageRect({ x: p.x - POT_SIZE / 2, y: p.y - POT_SIZE / 2, width: POT_SIZE, height: POT_SIZE }, canvasRect, size);
    };
    const b = this.layout.bowl;
    const bowlGame: Rect = { x: b.x - BOWL_W / 2, y: b.y - BOWL_H / 2, width: BOWL_W, height: BOWL_H };
    return {
      phase: this.potion.phase,
      bowlColor: this.potion.bowlColor,
      request: this.potion.request,
      level: this.levelNo,
      skillKey: this.skills.key(this.lang),
      language: this.lang,
      mode: this.plan.mode,
      audioOnly: this.plan.audioOnly,
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      lastEvent: this.lastEvent,
      pots: {
        red: potRect('red'),
        yellow: potRect('yellow'),
        blue: potRect('blue'),
      },
      bowl: gameRectToPageRect(bowlGame, canvasRect, size),
    };
  }
}

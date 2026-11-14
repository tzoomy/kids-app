// Number Bridge (docs/specs/number-bridge.md), Pass 1: a no-fail stepping-stone counting game in Number Garden.
// Pure rules live in ./bridgeMachine.ts (state machine & sequence generator) and ./bridgeRound.ts (levels, trials, lines).
// Test handles: `getNumberBridgeInfo()` / `seedNumberBridgeLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, NumberBridgeContent } from '../../content/schema';
import { loadNumberBridge } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, popIn, pressSquash, squashStretch, wait, wobble } from '../../anim/tweens';
import { propArtKey, sceneArtKey } from '../../anim/artRegistry';
import { drawAnimal } from '../../assets/vectorArt';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import {
  buildBridge,
  createBridge,
  nextBridge,
  tapChoice,
  tapPile,
  type BridgeEvent,
  type BridgeState,
  type PreviousBridge,
} from './bridgeMachine';
import {
  countUpToGapLines,
  crossedLine,
  introLine,
  notThisLine,
  numberLine,
  oneMoreLine,
  planForLevel,
  trialForBridge,
  type NumberBridgePlan,
} from './bridgeRound';
import type { NumberBridgeInfo } from './numberBridgeTypes';

let cachedContent: NumberBridgeContent | null = null;
function content(): NumberBridgeContent {
  cachedContent ??= loadNumberBridge();
  return cachedContent;
}

const DEPTH = { background: -10, stream: -5, gaps: 10, stones: 20, choices: 30, rabbit: 60, flying: 300 } as const;
const OUTLINE_COLOR = 0x3b2a22;
const LINE_MAX_MS = 2200;
const HOP_LINE_MAX_MS = 950;
const BRIDGE_HOLD_MS = 700;

interface Point {
  x: number;
  y: number;
}

interface BridgeLayout {
  streamY: number;
  streamH: number;
  nearBank: Point;
  farBank: Point;
  stones: Point[];
  stoneW: number;
  stoneH: number;
  pile: Point;
  pileW: number;
  pileH: number;
  choices: Point[];
  choiceW: number;
  choiceH: number;
  rabbitSize: number;
}

function computeLayout(w: number, h: number, stoneCount: number): BridgeLayout {
  const portrait = h > w;
  if (!portrait) {
    const streamY = h * 0.5;
    const streamH = 190;
    const bankY = h * 0.45;
    const leftX = 290;
    const rightX = w - 290;
    const span = rightX - leftX;
    const stones: Point[] = [];
    for (let i = 0; i < stoneCount; i++) {
      const t = stoneCount === 1 ? 0.5 : i / (stoneCount - 1);
      stones.push({ x: leftX + span * t, y: streamY + 4 });
    }
    const stoneW = stoneCount >= 5 ? 144 : 160;
    const stoneH = Math.round(stoneW * 0.7);
    const lowerY = h * 0.8;
    return {
      streamY,
      streamH,
      nearBank: { x: 135, y: bankY },
      farBank: { x: w - 135, y: bankY },
      stones,
      stoneW,
      stoneH,
      pile: { x: w / 2, y: lowerY },
      pileW: 210,
      pileH: 152,
      choices: [
        { x: w / 2 - 240, y: lowerY },
        { x: w / 2, y: lowerY },
        { x: w / 2 + 240, y: lowerY },
      ],
      choiceW: 164,
      choiceH: 115,
      rabbitSize: 150,
    };
  }

  // Portrait (800x1280): stream runs across the middle; choices sit under it.
  const streamY = h * 0.46;
  const streamH = 220;
  const marginX = stoneCount >= 5 ? 120 : stoneCount === 4 ? 145 : 190;
  const span = w - marginX * 2;
  const stones: Point[] = [];
  for (let i = 0; i < stoneCount; i++) {
    const t = stoneCount === 1 ? 0.5 : i / (stoneCount - 1);
    stones.push({ x: marginX + span * t, y: streamY + 8 });
  }
  const stoneW = stoneCount >= 5 ? 124 : stoneCount === 4 ? 136 : 148;
  const stoneH = Math.round(stoneW * 0.71);
  const lowerY = h * 0.72;
  return {
    streamY,
    streamH,
    nearBank: { x: 115, y: h * 0.32 },
    farBank: { x: w - 115, y: h * 0.32 },
    stones,
    stoneW,
    stoneH,
    pile: { x: w / 2, y: lowerY },
    pileW: 210,
    pileH: 152,
    choices: [
      { x: w / 2 - 225, y: lowerY },
      { x: w / 2, y: lowerY },
      { x: w / 2 + 225, y: lowerY },
    ],
    choiceW: 160,
    choiceH: 112,
    rabbitSize: 140,
  };
}

export class NumberBridgeScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: BridgeLayout;
  private lang: Lang | null = null;
  private plan!: NumberBridgePlan;
  private bridge!: BridgeState;
  private previousBridge: PreviousBridge | null = null;
  private levelNo = 1;

  private rabbit?: Phaser.GameObjects.Container;
  private stoneViews = new Map<number, Phaser.GameObjects.Container>();
  private gapViews = new Map<number, Phaser.GameObjects.Container>();
  private choiceViews = new Map<number, Phaser.GameObjects.Container>();
  private pileView?: Phaser.GameObjects.Container;
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();

  private ready = false;
  private stepHinted = false;
  private helpOpen = false;
  private introPending = true;
  private lastEvent: BridgeEvent['kind'] | null = null;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;

  constructor() {
    super('NumberBridgeScene');
  }

  create(): void {
    setAppScreen('number-bridge');
    this.context = this.game.registry.get('appContext') as AppContext;
    const c = content();
    this.ageConfig = c.ageTracks[this.context.currentAgeTrack()];
    this.skills = this.context.createSkillSession(
      c.world,
      c.id,
      buildMeta({ levelCount: c.adaptive.levels.length, tracks: c.adaptive.tracks, rules: c.adaptive.rules }),
    );
    this.lang = null;
    this.previousBridge = null;
    this.ready = false;
    this.stepHinted = false;
    this.helpOpen = false;
    this.introPending = true;
    this.lastEvent = null;
    this.stoneViews = new Map();
    this.gapViews = new Map();
    this.choiceViews = new Map();
    this.pileView = undefined;
    this.rabbit = undefined;
    this.activeTransients = new Set();
    this.hintTimer = undefined;

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

    this.refreshRoundPlan();
    this.layout = computeLayout(this.scale.width, this.scale.height, this.plan.stones);
    this.paintBackground();
    this.buildRabbit();
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    void this.startVisit();

    window.__GAME_READY__ = true;
  }

  private destroyObject(obj: Phaser.GameObjects.GameObject | undefined): void {
    if (!obj) return;
    this.activeTransients.delete(obj);
    this.tweens.killTweensOf(obj);
    if (obj.scene) obj.destroy();
  }

  private clearBridgeObjects(): void {
    for (const view of this.stoneViews.values()) this.destroyObject(view);
    this.stoneViews.clear();
    for (const view of this.gapViews.values()) this.destroyObject(view);
    this.gapViews.clear();
    for (const view of this.choiceViews.values()) this.destroyObject(view);
    this.choiceViews.clear();
    this.destroyObject(this.pileView);
    this.pileView = undefined;
  }

  private cleanup(): void {
    this.visitToken++;
    this.speechBatch++;
    this.hintTimer?.remove();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const obj of [...this.activeTransients]) this.destroyObject(obj);
    this.clearBridgeObjects();
    if (this.rabbit) this.tweens.killTweensOf(this.rabbit);
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
    const bgName = w >= h ? 'bg-landscape' : 'bg-portrait';
    const bgKey = sceneArtKey('number-garden', bgName);
    if (bgKey && this.textures.exists(bgKey)) {
      this.add.image(w / 2, h / 2, bgKey).setDisplaySize(w, h).setDepth(DEPTH.background);
    } else {
      const bg = this.add.graphics().setDepth(DEPTH.background);
      bg.fillStyle(0xb8e6ff, 1).fillRect(0, 0, w, h);
      bg.fillStyle(0x98d886, 1).fillRect(0, h * 0.25, w, h * 0.75);
    }

    // Procedural blue stream band across the middle of the garden.
    const { streamY, streamH } = this.layout;
    const g = this.add.graphics().setDepth(DEPTH.stream);
    const half = streamH / 2;
    g.fillStyle(0xdcc296, 1).fillRect(0, streamY - half - 14, w, streamH + 28);
    g.lineStyle(4, OUTLINE_COLOR, 0.65);
    g.lineBetween(0, streamY - half - 14, w, streamY - half - 14);
    g.lineBetween(0, streamY + half + 14, w, streamY + half + 14);

    g.fillStyle(0x5eb8ff, 1).fillRect(0, streamY - half, w, streamH);
    g.fillStyle(0x7ecbff, 0.75).fillRect(0, streamY - half + 10, w, streamH * 0.32);
    g.lineStyle(4, OUTLINE_COLOR, 0.75);
    g.lineBetween(0, streamY - half, w, streamY - half);
    g.lineBetween(0, streamY + half, w, streamY + half);

    // Gentle water wave highlights along the stream.
    g.lineStyle(4, 0xdcf4ff, 0.85);
    for (let x = 60; x < w - 40; x += 190) {
      const yOffset = (x % 380 === 60 ? -1 : 1) * (streamH * 0.2);
      g.beginPath();
      g.arc(x, streamY + yOffset, 28, Math.PI * 0.15, Math.PI * 0.85, false);
      g.strokePath();
    }
  }

  private buildRabbit(): void {
    const rabbit = drawAnimal(this, 'rabbit', this.layout.rabbitSize);
    rabbit.setPosition(this.layout.nearBank.x, this.layout.nearBank.y).setDepth(DEPTH.rabbit);
    this.rabbit = rabbit;
  }

  private makeStoneView(x: number, y: number, w: number, h: number, labelNum: number | null, showDots: boolean): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(DEPTH.stones);
    const key = propArtKey('bridge-stone');
    if (key && this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(w, h));
    } else {
      const fallback = this.add.graphics();
      fallback.fillStyle(0xb2a898, 1).fillRoundedRect(-w * 0.44, -h * 0.25, w * 0.88, h * 0.65, 22);
      fallback.lineStyle(5, OUTLINE_COLOR, 1).strokeRoundedRect(-w * 0.44, -h * 0.25, w * 0.88, h * 0.65, 22);
      fallback.fillStyle(0xefe9dc, 1).fillEllipse(0, -h * 0.06, w * 0.88, h * 0.72);
      fallback.lineStyle(5, OUTLINE_COLOR, 1).strokeEllipse(0, -h * 0.06, w * 0.88, h * 0.72);
      container.add(fallback);
    }

    if (labelNum !== null) {
      const textY = showDots ? -h * 0.16 : -h * 0.05;
      const fontSize = Math.round(h * (showDots ? 0.36 : 0.44));
      const numText = this.add
        .text(0, textY, String(labelNum), {
          fontFamily: "'Fredoka', 'Noto Sans', sans-serif",
          fontSize: `${fontSize}px`,
          fontStyle: 'bold',
          color: '#3B2A22',
        })
        .setOrigin(0.5);
      container.add(numText);

      if (showDots) {
        container.add(this.makeDotsGraphics(labelNum, h));
      }
    }

    container.setSize(w, h);
    return container;
  }

  private makeDotsGraphics(count: number, stoneH: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const r = Math.max(4, stoneH * 0.052);
    const dx = r * 2.7;
    const rows = count <= 3 ? [count] : count === 4 ? [2, 2] : [3, 2];
    const baseY = rows.length === 1 ? stoneH * 0.16 : stoneH * 0.1;
    const rowGap = r * 2.4;

    rows.forEach((nInRow, rowIdx) => {
      const y = baseY + rowIdx * rowGap;
      const startX = -((nInRow - 1) * dx) / 2;
      for (let i = 0; i < nInRow; i++) {
        const cx = startX + i * dx;
        g.fillStyle(0x4d96ff, 1).fillCircle(cx, y, r);
        g.lineStyle(2, OUTLINE_COLOR, 1).strokeCircle(cx, y, r);
      }
    });
    return g;
  }

  private makeGapView(x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(DEPTH.gaps);
    const g = this.add.graphics();
    g.fillStyle(0x3a9be8, 0.35).fillEllipse(0, 0, w * 0.82, h * 0.62);
    g.lineStyle(4, 0xffffff, 0.9).strokeEllipse(0, 0, w * 0.82, h * 0.62);
    g.lineStyle(3, 0xdcf4ff, 0.75).strokeEllipse(0, 0, w * 0.56, h * 0.4);
    container.add(g);
    container.setSize(w, h);
    return container;
  }

  private makePileView(x: number, y: number, w: number, h: number): Phaser.GameObjects.Container {
    const container = this.add.container(x, y).setDepth(DEPTH.choices);
    const key = propArtKey('stone-pile');
    if (key && this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(w, h));
    } else {
      const fallback = this.add.graphics();
      fallback.fillStyle(0xddd5c3, 1).fillEllipse(-16, 18, w * 0.58, h * 0.36);
      fallback.lineStyle(5, OUTLINE_COLOR, 1).strokeEllipse(-16, 18, w * 0.58, h * 0.36);
      fallback.fillStyle(0xe5dec9, 1).fillEllipse(20, 16, w * 0.54, h * 0.34);
      fallback.lineStyle(5, OUTLINE_COLOR, 1).strokeEllipse(20, 16, w * 0.54, h * 0.34);
      fallback.fillStyle(0xf2ece0, 1).fillEllipse(0, -10, w * 0.62, h * 0.38);
      fallback.lineStyle(5, OUTLINE_COLOR, 1).strokeEllipse(0, -10, w * 0.62, h * 0.38);
      container.add(fallback);
    }
    container.setSize(w, h);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => void this.onPileTap());
    return container;
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
    void this.speak({ lineId: 'bridge.help.he', lang: 'he', text: content().helpTextHe });
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

  private async speakSequence(requests: readonly SpeechRequest[], token: number, maxMs = LINE_MAX_MS): Promise<void> {
    const batch = ++this.speechBatch;
    for (const req of requests) {
      if (token !== this.visitToken || batch !== this.speechBatch || !this.sys.isActive()) return;
      await this.speak(req, maxMs);
    }
  }

  // ---------------------------------------------------------------- bridge lifecycle

  private refreshRoundPlan(): void {
    const c = content();
    const settings = this.context.store.getState().settings;
    this.lang = nextRoundLanguage(this.lang, this.lang === null || this.skills.atRoundBoundary(this.lang), settings.languages);
    this.levelNo = this.skills.level(this.lang);
    this.plan = planForLevel(c.adaptive.levels[this.levelNo - 1]);
  }

  private async startVisit(): Promise<void> {
    const token = ++this.visitToken;
    const spec = buildBridge(this.plan, this.previousBridge);
    this.previousBridge = { sequence: spec.sequence, gaps: spec.gaps };
    this.bridge = createBridge(spec);
    await this.presentBridge(token);
  }

  private async startNextBridge(token: number): Promise<void> {
    this.refreshRoundPlan();
    this.layout = computeLayout(this.scale.width, this.scale.height, this.plan.stones);
    const spec = buildBridge(this.plan, this.previousBridge);
    this.previousBridge = { sequence: spec.sequence, gaps: spec.gaps };
    const { state, event } = nextBridge(this.bridge, spec);
    this.bridge = state;
    this.lastEvent = event.kind;
    await this.presentBridge(token);
  }

  private async presentBridge(token: number): Promise<void> {
    const alive = () => token === this.visitToken && this.sys.isActive();
    this.stepHinted = false;
    this.ready = false;
    this.clearBridgeObjects();

    if (this.rabbit) {
      this.tweens.killTweensOf(this.rabbit);
      this.rabbit.setPosition(this.layout.nearBank.x, this.layout.nearBank.y).setScale(1).setAngle(0);
    }

    const popPromises: Promise<void>[] = [];
    const showNums = this.bridge.mode === 'missing';
    const gapSet = new Set(this.bridge.gaps);

    this.bridge.sequence.forEach((num, idx) => {
      const pos = this.layout.stones[idx];
      if (gapSet.has(idx)) {
        const gap = this.makeGapView(pos.x, pos.y, this.layout.stoneW, this.layout.stoneH);
        this.gapViews.set(idx, gap);
        popPromises.push(popIn(this, gap, idx * 45));
      } else {
        const stone = this.makeStoneView(pos.x, pos.y, this.layout.stoneW, this.layout.stoneH, showNums ? num : null, this.plan.dots);
        this.stoneViews.set(idx, stone);
        popPromises.push(popIn(this, stone, idx * 45));
      }
    });

    if (this.bridge.mode === 'one-more') {
      const pile = this.makePileView(this.layout.pile.x, this.layout.pile.y, this.layout.pileW, this.layout.pileH);
      this.pileView = pile;
      popPromises.push(popIn(this, pile, 100));
    } else {
      this.bridge.choices.forEach((num, idx) => {
        const pos = this.layout.choices[idx];
        const choice = this.makeStoneView(pos.x, pos.y, this.layout.choiceW, this.layout.choiceH, num, this.plan.dots);
        choice.setDepth(DEPTH.choices);
        choice.setInteractive({ useHandCursor: true });
        choice.on('pointerdown', () => void this.onChoiceTap(num));
        this.choiceViews.set(num, choice);
        popPromises.push(popIn(this, choice, 100 + idx * 55));
      });
    }

    if (this.introPending) {
      this.introPending = false;
      void this.speakSequence([introLine(content(), this.bridge.mode)], token);
    }

    await Promise.all(popPromises);
    if (!alive()) return;
    this.ready = true;
    this.scheduleHint();
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen || this.bridge.phase !== 'building') return;
    this.stepHinted = true;
    this.context.sfx.hint();

    if (this.bridge.mode === 'one-more') {
      if (this.pileView) void hintPulse(this, this.pileView);
      return;
    }

    if (!this.plan.audioOnly && this.bridge.answer !== null) {
      const rightChoice = this.choiceViews.get(this.bridge.answer);
      if (rightChoice) void hintPulse(this, rightChoice);
    }
    if (this.lang) {
      void this.speakSequence(countUpToGapLines(content(), this.bridge, this.lang), this.visitToken);
    }
  }

  // ---------------------------------------------------------------- interactions

  private async onPileTap(): Promise<void> {
    if (this.pileView) void pressSquash(this, this.pileView);
    if (!this.ready || this.helpOpen) return;

    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    this.ready = false;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();

    const { state, event } = tapPile(this.bridge);
    this.bridge = state;
    this.lastEvent = event.kind;

    if (event.kind === 'busy') {
      this.ready = true;
      return;
    }

    if (event.kind !== 'placed' && event.kind !== 'complete') return;

    const lang = this.lang!;
    void this.speakSequence([oneMoreLine(content(), lang)], token);

    await this.flyStoneIntoGap(event.gapIndex, this.layout.pile, null, token);
    if (!alive()) return;

    if (event.kind === 'placed') {
      this.ready = true;
      this.scheduleHint();
      return;
    }

    await this.runCrossing(token);
  }

  private async onChoiceTap(picked: number): Promise<void> {
    const choiceView = this.choiceViews.get(picked);
    if (choiceView) void pressSquash(this, choiceView);
    if (!this.ready || this.helpOpen) return;

    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    this.ready = false;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();

    const { state, event } = tapChoice(this.bridge, picked);
    this.bridge = state;
    this.lastEvent = event.kind;

    if (event.kind === 'busy') {
      this.ready = true;
      return;
    }

    const lang = this.lang!;
    if (event.kind === 'not-this-one') {
      const gapIdx = this.bridge.gaps[0];
      const gapView = gapIdx !== undefined ? this.gapViews.get(gapIdx) : undefined;
      if (gapView) void hintPulse(this, gapView);
      const wobblePromise = choiceView ? wobble(this, choiceView) : Promise.resolve();
      const lines = [notThisLine(content()), ...countUpToGapLines(content(), this.bridge, lang)];
      await Promise.all([wobblePromise, this.speakSequence(lines, token)]);
      if (!alive()) return;
      this.ready = true;
      this.scheduleHint();
      return;
    }

    if (event.kind === 'complete') {
      const idx = this.bridge.choices.indexOf(picked);
      const from = this.layout.choices[idx] ?? this.layout.pile;
      if (choiceView) choiceView.setVisible(false);
      await this.flyStoneIntoGap(event.gapIndex, from, picked, token);
      if (!alive()) return;
      await this.runCrossing(token);
    }
  }

  private async flyStoneIntoGap(gapIndex: number, from: Point, labelNum: number | null, token: number): Promise<void> {
    const alive = () => token === this.visitToken && this.sys.isActive();
    const target = this.layout.stones[gapIndex];
    const flyer = this.trackTransient(
      this.makeStoneView(from.x, from.y, this.layout.stoneW, this.layout.stoneH, labelNum, this.plan.dots).setDepth(DEPTH.flying),
    );
    await flyArc(this, flyer, target.x, target.y, {
      duration: isReducedMotion() ? 120 : 280,
      height: 100,
      endScale: 1,
    });
    this.destroyObject(flyer);
    if (!alive()) return;

    this.destroyObject(this.gapViews.get(gapIndex));
    this.gapViews.delete(gapIndex);

    const placed = this.makeStoneView(target.x, target.y, this.layout.stoneW, this.layout.stoneH, labelNum, this.plan.dots);
    this.stoneViews.set(gapIndex, placed);
    Juice.for(this).burst('sparkle', target.x, target.y, 6);
    void squashStretch(this, placed);
  }

  private async runCrossing(token: number): Promise<void> {
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();
    const lang = this.lang!;

    this.skills.record(lang, trialForBridge(this.bridge, this.stepHinted));
    this.stepHinted = false;
    this.session.complete();

    // Rabbit hops stone by stone while each number is spoken in the learning language.
    for (let i = 0; i < this.bridge.sequence.length; i++) {
      if (!alive()) return;
      const num = this.bridge.sequence[i];
      const pos = this.layout.stones[i];
      const hopY = pos.y - this.layout.stoneH * 0.25;
      const hop = this.rabbit
        ? flyArc(this, this.rabbit, pos.x, hopY, {
            duration: isReducedMotion() ? 120 : 280,
            height: 60,
            endScale: 1,
          })
        : Promise.resolve();
      await Promise.all([hop, this.speak(numberLine(c, num, lang), HOP_LINE_MAX_MS)]);
      if (!alive()) return;
      if (this.rabbit) void squashStretch(this, this.rabbit);
      const stone = this.stoneViews.get(i);
      if (stone) void pressSquash(this, stone);
    }

    if (this.rabbit) {
      await flyArc(this, this.rabbit, this.layout.farBank.x, this.layout.farBank.y, {
        duration: isReducedMotion() ? 120 : 280,
        height: 65,
        endScale: 1,
      });
      if (!alive()) return;
      void squashStretch(this, this.rabbit);
    }

    // Far bank celebration + star.
    this.context.sfx.yay();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();

    const juice = Juice.for(this);
    const fxX = this.layout.farBank.x;
    const fxY = this.layout.farBank.y - 30;
    juice.burst('confetti', fxX, fxY);
    juice.burst('star', fxX, fxY);
    this.flyStarToCounter(fxX, fxY);

    await this.speakSequence([crossedLine(c), heLine('praise.0')], token);
    if (!alive()) return;
    await wait(this, BRIDGE_HOLD_MS);
    if (!alive()) return;

    this.session.reportCelebrating(false);
    await this.startNextBridge(token);
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

  getNumberBridgeInfo(): NumberBridgeInfo | null {
    if (!this.bridge || !this.lang) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const toPageRect = (x: number, y: number, width: number, height: number): Rect =>
      gameRectToPageRect({ x: x - width / 2, y: y - height / 2, width, height }, canvasRect, size);

    const choiceRects: Record<string, Rect> = {};
    if (this.bridge.mode === 'missing') {
      this.bridge.choices.forEach((num, idx) => {
        const pos = this.layout.choices[idx];
        if (pos) choiceRects[String(num)] = toPageRect(pos.x, pos.y, this.layout.choiceW, this.layout.choiceH);
      });
    }

    const gapRects: Rect[] = this.bridge.gaps.map((idx) => {
      const pos = this.layout.stones[idx];
      return toPageRect(pos.x, pos.y, this.layout.stoneW, this.layout.stoneH);
    });

    return {
      phase: this.bridge.phase,
      mode: this.bridge.mode,
      level: this.levelNo,
      skillKey: this.skills.key(this.lang),
      language: this.lang,
      sequence: [...this.bridge.sequence],
      gaps: [...this.bridge.gaps],
      answer: this.bridge.answer,
      choices: [...this.bridge.choices],
      tries: this.bridge.tries,
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      lastEvent: this.lastEvent,
      pile:
        this.bridge.mode === 'one-more'
          ? toPageRect(this.layout.pile.x, this.layout.pile.y, this.layout.pileW, this.layout.pileH)
          : null,
      choiceRects,
      gapRects,
    };
  }
}

// Word Train (docs/specs/word-train.md), Pass 1: English-only load & spelling train game in Language House.
// Pure rules live in ./wordTrainMachine.ts (state machine) and ./wordTrainRound.ts (levels, selection, trials, lines).
// Test handles: `getWordTrainInfo()` / `seedWordTrainLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, WordTrainContent, WordTrainObject, WordTrainWord } from '../../content/schema';
import { loadWordTrain } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, popIn, pressSquash, tweenAsync, wait, wobble } from '../../anim/tweens';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import type { SpeechRequest } from '../../core/audio/types';
import {
  arriveLoad,
  arriveSpell,
  createLoadRound,
  createSpellRound,
  pickObject,
  placeTile,
  tapTile,
  type WordTrainEvent,
  type WordTrainState,
} from './wordTrainMachine';
import {
  buildTiles,
  introLine,
  letterLine,
  loadLine,
  nameLine,
  otherLine,
  pickLoadRound,
  pickWord,
  planForLevel,
  spellLine,
  trialForLoad,
  trialForWord,
  wordLine,
  type WordTrainPlan,
} from './wordTrainRound';
import type { WordTrainInfo } from './wordTrainTypes';

let cachedContent: WordTrainContent | null = null;
function content(): WordTrainContent {
  cachedContent ??= loadWordTrain();
  return cachedContent;
}

const DEPTH = {
  background: -10,
  sign: 5,
  cargo: 18,
  train: 20,
  wagonPanel: 24,
  objects: 30,
  tiles: 30,
  dragging: 100,
  flying: 300,
} as const;

const OUTLINE_COLOR = 0x3b2a22;
const CREAM_FILL = 0xfff8ee;
const FONT_FAMILY = "'Nunito', 'Fredoka', 'Varela Round', 'Noto Sans', system-ui, Arial, sans-serif";

const ENGINE_W = 360;
const WAGON_W = 200;
const WAGON_H = 260;
const COUPLER_OVERLAP = 4;
const WAGON_STEP = WAGON_W - COUPLER_OVERLAP;
const WAGON_PANEL_H = 88;
const WAGON_PANEL_OFFSET_Y = 34; // y=164 in 260-tall wagon centred at y=130
const WAGON_CARGO_OFFSET_Y = -44;

const OBJECT_SIZE = 150;
const TILE_SIZE = 124;
const LINE_MAX_MS = 2200;
const ROUND_HOLD_MS = 380;

interface Point {
  x: number;
  y: number;
}

interface WagonView {
  slotIndex: number;
  localX: number;
  container: Phaser.GameObjects.Container;
  ghostText?: Phaser.GameObjects.Text;
}

interface ObjectView {
  id: string;
  rest: Point;
  container: Phaser.GameObjects.Container;
  dragStarted: boolean;
  startPos: Point;
  loaded: boolean;
}

interface TileView {
  index: number;
  letter: string;
  rest: Point;
  container: Phaser.GameObjects.Container;
  dragStarted: boolean;
  startPos: Point;
  placed: boolean;
}

interface Layout {
  trainY: number;
  trainScale: number;
  totalTrainW: number;
  signCenter: Point;
  signBoardW: number;
  signBoardH: number;
  choiceY: number;
  choiceSpots: Point[];
  tileSpots: Point[];
}

function computeLayout(
  w: number,
  h: number,
  wagonCount: number,
  choiceCount: number,
  tileCount: number,
): Layout {
  const isLandscape = w >= h;
  const marginX = isLandscape ? 40 : 20;
  const totalUnscaledW = ENGINE_W + wagonCount * WAGON_STEP;
  const maxTrainScale = isLandscape ? 0.92 : 0.95;
  const trainScale = Math.min(maxTrainScale, (w - marginX * 2) / totalUnscaledW);
  const totalTrainW = totalUnscaledW * trainScale;

  // Align wheels cleanly with the rails on picnic-train-bg-landscape (1280x800) / -portrait (800x1280).
  const trainBottomY = isLandscape ? h * 0.765 : h * 0.683;
  const trainY = trainBottomY - (WAGON_H * trainScale) / 2;

  const signBoardW = isLandscape ? 204 : 250;
  const signBoardH = isLandscape ? 168 : 208;
  const signCenter: Point = isLandscape ? { x: w / 2, y: 196 } : { x: w / 2, y: 360 };

  const choiceY = isLandscape ? h * 0.885 : h * 0.81;
  const choiceSpacing = isLandscape ? 240 : choiceCount >= 3 ? 220 : 260;
  const choiceStartX = w / 2 - ((choiceCount - 1) * choiceSpacing) / 2;
  const choiceSpots = Array.from({ length: choiceCount }, (_, i) => ({
    x: choiceStartX + i * choiceSpacing,
    y: choiceY,
  }));

  const tileGap = isLandscape ? 32 : 20;
  const tileStep = TILE_SIZE + tileGap;
  const tileStartX = w / 2 - ((tileCount - 1) * tileStep) / 2;
  const tileSpots = Array.from({ length: tileCount }, (_, i) => ({
    x: tileStartX + i * tileStep,
    y: choiceY,
  }));

  return {
    trainY,
    trainScale,
    totalTrainW,
    signCenter,
    signBoardW,
    signBoardH,
    choiceY,
    choiceSpots,
    tileSpots,
  };
}

export class WordTrainScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private plan!: WordTrainPlan;
  private state!: WordTrainState;
  private layout!: Layout;
  private levelNo = 1;
  private loadProgress = 0;
  private lastLoadTarget: string | null = null;
  private lastSpellWordId: string | null = null;
  private currentWord: WordTrainWord | null = null;

  private trainContainer?: Phaser.GameObjects.Container;
  private signContainer?: Phaser.GameObjects.Container;
  private wagonViews: WagonView[] = [];
  private objectViews: ObjectView[] = [];
  private tileViews: TileView[] = [];
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();

  private ready = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPendingMode: 'load' | 'spell' | null = null;
  private lastEvent: WordTrainEvent['kind'] | null = null;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('WordTrainScene');
  }

  create(): void {
    setAppScreen('word-train');
    this.context = this.game.registry.get('appContext') as AppContext;
    const c = content();
    this.ageConfig = c.ageTracks[this.context.currentAgeTrack()];
    this.skills = this.context.createSkillSession(
      c.world,
      c.id,
      buildMeta({ levelCount: c.adaptive.levels.length, tracks: c.adaptive.tracks, rules: c.adaptive.rules }),
    );

    this.ready = false;
    this.stepHinted = false;
    this.helpOpen = false;
    this.introPendingMode = null;
    this.lastEvent = null;
    this.loadProgress = 0;
    this.lastLoadTarget = null;
    this.lastSpellWordId = null;
    this.currentWord = null;
    this.trainContainer = undefined;
    this.signContainer = undefined;
    this.wagonViews = [];
    this.objectViews = [];
    this.tileViews = [];
    this.activeTransients = new Set();
    this.hintTimer = undefined;
    this.input.dragDistanceThreshold = 10;

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
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    for (const obj of [...this.activeTransients]) this.destroyObject(obj);
    this.clearRoundViews();
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
    const bgKey = w >= h ? 'picnic-train-bg-landscape' : 'picnic-train-bg-portrait';
    if (this.textures.exists(bgKey)) {
      const img = this.add.image(w / 2, h / 2, bgKey).setDepth(DEPTH.background);
      const scale = Math.max(w / img.width, h / img.height);
      img.setScale(scale);
      return;
    }

    // Procedural sky/grass/track fallback
    this.cameras.main.setBackgroundColor('#b8e6ff');
    const trackTop = w >= h ? h * 0.65 : h * 0.61;
    const trackH = 140;
    this.add.rectangle(w / 2, h - (h - trackTop) / 2, w, h - trackTop, 0x57c457).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, trackTop + trackH / 2, w, trackH, 0xf0dec2).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, trackTop + 50, w, 12, 0xc08552).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, trackTop + 88, w, 14, 0xc08552).setDepth(DEPTH.background);
  }

  private createEngineView(x: number, y: number): Phaser.GameObjects.GameObject {
    if (this.textures.exists('train-engine')) {
      return this.add.image(x, y, 'train-engine');
    }
    const g = this.add.graphics({ x, y });
    g.fillStyle(0xee6c62, 1);
    g.fillRoundedRect(-122, -24, 164, 90, 22);
    g.fillRoundedRect(30, -74, 122, 140, 14);
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(18, -88, 144, 22, 11);
    g.fillStyle(0x3d3532, 1);
    g.fillCircle(-88, 95, 32);
    g.fillCircle(8, 95, 32);
    g.fillCircle(104, 95, 32);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-122, -24, 164, 90, 22);
    g.strokeRoundedRect(30, -74, 122, 140, 14);
    return g;
  }

  private createWagonGraphic(x: number, y: number): Phaser.GameObjects.GameObject {
    if (this.textures.exists('word-train-wagon')) {
      return this.add.image(x, y, 'word-train-wagon');
    }
    const g = this.add.graphics({ x, y });
    g.fillStyle(0xffd166, 1);
    g.fillRoundedRect(-82, -10, 164, 76, 14);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-82, -10, 164, 76, 14);
    g.fillStyle(CREAM_FILL, 1);
    g.fillRoundedRect(-65, -10, 130, 88, 12);
    g.lineStyle(5, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-65, -10, 130, 88, 12);
    g.fillStyle(0x3d3532, 1);
    g.fillCircle(-42, 95, 32);
    g.fillCircle(42, 95, 32);
    return g;
  }

  private buildTrain(wagonCount: number, word: string | null, ghost: boolean): void {
    const totalUnscaledW = ENGINE_W + wagonCount * WAGON_STEP;
    const train = this.add.container(this.scale.width + this.layout.totalTrainW / 2 + 80, this.layout.trainY);
    train.setDepth(DEPTH.train).setScale(this.layout.trainScale);

    const engineLocalX = -totalUnscaledW / 2 + ENGINE_W / 2;
    train.add(this.createEngineView(engineLocalX, 0));

    this.wagonViews = [];
    for (let i = 0; i < wagonCount; i++) {
      const wagonLocalX = -totalUnscaledW / 2 + ENGINE_W - COUPLER_OVERLAP + i * WAGON_STEP + WAGON_W / 2;
      const wagonContainer = this.add.container(wagonLocalX, 0);
      wagonContainer.add(this.createWagonGraphic(0, 0));

      let ghostText: Phaser.GameObjects.Text | undefined;
      if (word !== null && ghost) {
        ghostText = this.add
          .text(0, WAGON_PANEL_OFFSET_Y, word[i], {
            fontFamily: FONT_FAMILY,
            fontSize: '60px',
            fontStyle: 'bold',
            color: '#3B2A22',
            align: 'center',
          })
          .setOrigin(0.5)
          .setAlpha(0.28);
        wagonContainer.add(ghostText);
      }

      train.add(wagonContainer);
      this.wagonViews.push({ slotIndex: i, localX: wagonLocalX, container: wagonContainer, ghostText });
    }

    this.trainContainer = train;
  }

  private buildStationSign(word: WordTrainWord): void {
    const { signCenter, signBoardW, signBoardH, trainY } = this.layout;
    const container = this.add.container(signCenter.x, signCenter.y).setDepth(DEPTH.sign);

    // The post ends at the train line (it stands behind the train), never below the wheels.
    const postH = Math.max(40, trainY - (WAGON_H * this.layout.trainScale) / 4 - signCenter.y - signBoardH / 2);
    const g = this.add.graphics();
    // Wooden post down toward the track behind the train.
    g.fillStyle(0xb87d56, 1);
    g.fillRoundedRect(-12, signBoardH / 2 - 8, 24, postH, 8);
    g.lineStyle(5, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-12, signBoardH / 2 - 8, 24, postH, 8);

    // Cream rounded board with dark-brown outline.
    g.fillStyle(CREAM_FILL, 1);
    g.fillRoundedRect(-signBoardW / 2, -signBoardH / 2, signBoardW, signBoardH, 24);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-signBoardW / 2, -signBoardH / 2, signBoardW, signBoardH, 24);
    container.add(g);

    const artSize = Math.min(signBoardW, signBoardH) * 0.76;
    if (this.textures.exists(word.art)) {
      container.add(this.add.image(0, 0, word.art).setDisplaySize(artSize, artSize));
    } else {
      container.add(this.drawFallbackPicture(word.id, artSize * 0.4));
    }

    container.setSize(signBoardW, signBoardH);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (!this.isRoundLive()) return;
      this.session.reportInteraction();
      this.context.sfx.tap();
      void pressSquash(this, container);
      void this.speakSequence([spellLine(content(), word.id)], this.visitToken);
    });

    this.signContainer = container;
  }

  private drawFallbackPicture(id: string, radius: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const colorById: Record<string, number> = {
      apple: 0xef5350,
      banana: 0xffd54f,
      carrot: 0xff8a65,
      ball: 0x42a5f5,
      hat: 0xab47bc,
      book: 0x66bb6a,
      egg: 0xffe0b2,
      fish: 0x26c6da,
      sun: 0xffd43b,
      cup: 0x4d96ff,
      pear: 0x9ccc65,
    };
    g.fillStyle(colorById[id] ?? 0xffb74d, 1);
    g.fillCircle(0, 0, radius);
    g.lineStyle(5, OUTLINE_COLOR, 1);
    g.strokeCircle(0, 0, radius);
    return g;
  }

  private createLoadObjectView(obj: WordTrainObject, spot: Point, index: number): { view: ObjectView; pop: Promise<void> } {
    const container = this.add.container(spot.x, spot.y).setDepth(DEPTH.objects);
    if (this.textures.exists(obj.art)) {
      container.add(this.add.image(0, 0, obj.art).setDisplaySize(OBJECT_SIZE, OBJECT_SIZE));
    } else {
      container.add(this.drawFallbackPicture(obj.id, OBJECT_SIZE * 0.36));
    }
    container.setSize(OBJECT_SIZE, OBJECT_SIZE);
    container.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(container);

    const view: ObjectView = {
      id: obj.id,
      rest: { ...spot },
      container,
      dragStarted: false,
      startPos: { ...spot },
      loaded: false,
    };

    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      view.dragStarted = false;
      view.startPos = { x: pointer.x, y: pointer.y };
    });

    container.on('dragstart', () => {
      if (!this.isRoundLive() || view.loaded) return;
      view.dragStarted = true;
      container.setDepth(DEPTH.dragging);
      this.session.reportInteraction();
    });

    container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.isRoundLive() || view.loaded) return;
      const half = OBJECT_SIZE / 2;
      container.setPosition(
        Phaser.Math.Clamp(dragX, half, this.scale.width - half),
        Phaser.Math.Clamp(dragY, half, this.scale.height - half),
      );
    });

    container.on('dragend', (pointer: Phaser.Input.Pointer) => {
      if (view.loaded) return;
      container.setDepth(DEPTH.objects);
      const moved = Phaser.Math.Distance.Between(view.startPos.x, view.startPos.y, pointer.x, pointer.y);
      if (moved < 14) {
        container.setPosition(view.rest.x, view.rest.y);
        if (this.isRoundLive()) void this.handleLoadPick(view.id);
        return;
      }
      if (!this.isRoundLive()) {
        this.slideBack(container, view.rest);
        return;
      }
      if (this.isOverWagon(container.x, container.y, 0)) {
        void this.handleLoadPick(view.id);
      } else {
        this.slideBack(container, view.rest);
      }
    });

    container.on('pointerup', () => {
      if (view.dragStarted || view.loaded || !this.isRoundLive()) return;
      void this.handleLoadPick(view.id);
    });

    const pop = popIn(this, container, 60 + index * 55);
    return { view, pop };
  }

  private createTileView(letter: string, spot: Point, index: number): { view: TileView; pop: Promise<void> } {
    const container = this.add.container(spot.x, spot.y).setDepth(DEPTH.tiles);
    const bg = this.add.graphics();
    bg.fillStyle(CREAM_FILL, 1);
    bg.fillRoundedRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 22);
    bg.lineStyle(6, OUTLINE_COLOR, 1);
    bg.strokeRoundedRect(-TILE_SIZE / 2, -TILE_SIZE / 2, TILE_SIZE, TILE_SIZE, 22);
    container.add(bg);

    const text = this.add
      .text(0, 0, letter, {
        fontFamily: FONT_FAMILY,
        fontSize: '68px',
        fontStyle: 'bold',
        color: '#3B2A22',
        align: 'center',
      })
      .setOrigin(0.5);
    container.add(text);

    container.setSize(TILE_SIZE, TILE_SIZE);
    container.setInteractive({ useHandCursor: true, draggable: true });
    this.input.setDraggable(container);

    const view: TileView = {
      index,
      letter,
      rest: { ...spot },
      container,
      dragStarted: false,
      startPos: { ...spot },
      placed: false,
    };

    container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
      view.dragStarted = false;
      view.startPos = { x: pointer.x, y: pointer.y };
    });

    container.on('dragstart', () => {
      if (!this.isRoundLive() || view.placed) return;
      view.dragStarted = true;
      container.setDepth(DEPTH.dragging);
      this.session.reportInteraction();
    });

    container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
      if (!this.isRoundLive() || view.placed) return;
      const half = TILE_SIZE / 2;
      container.setPosition(
        Phaser.Math.Clamp(dragX, half, this.scale.width - half),
        Phaser.Math.Clamp(dragY, half, this.scale.height - half),
      );
    });

    container.on('dragend', (pointer: Phaser.Input.Pointer) => {
      if (view.placed) return;
      container.setDepth(DEPTH.tiles);
      const moved = Phaser.Math.Distance.Between(view.startPos.x, view.startPos.y, pointer.x, pointer.y);
      if (moved < 14) {
        container.setPosition(view.rest.x, view.rest.y);
        if (this.isRoundLive()) void this.handleTileTap(view.index);
        return;
      }
      if (!this.isRoundLive()) {
        this.slideBack(container, view.rest);
        return;
      }
      const slotIndex = this.findDropWagonSlot(container.x, container.y);
      if (slotIndex !== null) {
        void this.handleTileDrop(view.index, slotIndex);
      } else {
        this.slideBack(container, view.rest);
      }
    });

    container.on('pointerup', () => {
      if (view.dragStarted || view.placed || !this.isRoundLive()) return;
      void this.handleTileTap(view.index);
    });

    const pop = popIn(this, container, 60 + index * 50);
    return { view, pop };
  }

  private slideBack(container: Phaser.GameObjects.Container, rest: Point): void {
    this.tweens.killTweensOf(container);
    void tweenAsync(this, {
      targets: container,
      x: rest.x,
      y: rest.y,
      scale: 1,
      angle: 0,
      duration: isReducedMotion() ? 100 : 220,
      ease: 'Back.easeOut',
    });
  }

  private wagonWorldRect(slotIndex: number): Rect {
    const wagon = this.wagonViews[slotIndex];
    const tx = this.trainContainer?.x ?? this.scale.width / 2;
    const ty = this.trainContainer?.y ?? this.layout.trainY;
    const s = this.layout.trainScale;
    const w = WAGON_W * s;
    const h = WAGON_H * s;
    const cx = tx + (wagon?.localX ?? 0) * s;
    return { x: cx - w / 2, y: ty - h / 2, width: w, height: h };
  }

  private isOverWagon(x: number, y: number, slotIndex: number): boolean {
    const r = this.wagonWorldRect(slotIndex);
    const pad = 32;
    return x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad;
  }

  private findDropWagonSlot(x: number, y: number): number | null {
    let bestSlot: number | null = null;
    let bestDist = Infinity;
    for (const wagon of this.wagonViews) {
      if (!this.isOverWagon(x, y, wagon.slotIndex)) continue;
      const r = this.wagonWorldRect(wagon.slotIndex);
      const cx = r.x + r.width / 2;
      const cy = r.y + r.height / 2;
      const dist = Phaser.Math.Distance.Between(x, y, cx, cy);
      if (dist < bestDist) {
        bestDist = dist;
        bestSlot = wagon.slotIndex;
      }
    }
    return bestSlot;
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
    void this.speak({ lineId: 'wordtrain.help.he', lang: 'he', text: content().helpTextHe });
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

  private async speakSequence(requests: readonly SpeechRequest[], token: number, allowInactiveFirst = false): Promise<void> {
    const batch = ++this.speechBatch;
    let first = allowInactiveFirst;
    for (const req of requests) {
      if (token !== this.visitToken || batch !== this.speechBatch || (!first && !this.sys.isActive())) return;
      first = false;
      await this.speak(req);
    }
  }

  // ---------------------------------------------------------------- round & gameplay

  private isRoundLive(): boolean {
    return (
      this.ready &&
      !this.helpOpen &&
      (this.state.phase === 'asking' || this.state.phase === 'spelling')
    );
  }

  private clearRoundViews(): void {
    if (this.trainContainer) {
      this.tweens.killTweensOf(this.trainContainer);
      if (this.trainContainer.scene) this.trainContainer.destroy(true);
      this.trainContainer = undefined;
    }
    if (this.signContainer) {
      this.tweens.killTweensOf(this.signContainer);
      if (this.signContainer.scene) this.signContainer.destroy(true);
      this.signContainer = undefined;
    }
    for (const entry of this.objectViews) {
      this.tweens.killTweensOf(entry.container);
      if (entry.container.scene) entry.container.destroy(true);
    }
    for (const entry of this.tileViews) {
      this.tweens.killTweensOf(entry.container);
      if (entry.container.scene) entry.container.destroy(true);
    }
    this.wagonViews = [];
    this.objectViews = [];
    this.tileViews = [];
  }

  private refreshRoundPlan(): void {
    const c = content();
    this.levelNo = this.skills.level('en');
    this.plan = planForLevel(c.adaptive.levels[this.levelNo - 1]);
  }

  private startRound(token: number, fromCreate = false): void {
    // During create() the scene status is CREATING, so isActive() is still false.
    if (token !== this.visitToken || (!fromCreate && !this.sys.isActive())) return;
    const c = content();
    this.refreshRoundPlan();
    this.clearRoundViews();

    this.ready = false;
    this.stepHinted = false;
    this.lastEvent = null;

    const popPromises: Promise<void>[] = [];
    const lines: SpeechRequest[] = [];

    if (this.plan.mode === 'load') {
      const picked = pickLoadRound(c.objects, this.plan.choiceCount, this.lastLoadTarget);
      this.lastLoadTarget = picked.target.id;
      this.currentWord = null;

      const choiceIds = picked.choices.map((o) => o.id);
      this.state = this.state
        ? arriveLoad(this.state, { choices: choiceIds, target: picked.target.id })
        : createLoadRound({ choices: choiceIds, target: picked.target.id });

      this.layout = computeLayout(this.scale.width, this.scale.height, 1, picked.choices.length, 0);
      this.buildTrain(1, null, false);

      picked.choices.forEach((obj, idx) => {
        const { view, pop } = this.createLoadObjectView(obj, this.layout.choiceSpots[idx], idx);
        this.objectViews.push(view);
        popPromises.push(pop);
      });

      if (this.introPendingMode === null) {
        this.introPendingMode = 'load';
        lines.push(introLine(c, 'load'));
      }
      lines.push(loadLine(c, picked.target.id));
    } else {
      const wordObj = pickWord(c.words, this.plan.wordLength, this.lastSpellWordId);
      this.lastSpellWordId = wordObj.id;
      this.currentWord = wordObj;

      const letters = buildTiles(wordObj.word, this.plan.distractors, c.distractorLetters);
      this.state = this.state
        ? arriveSpell(this.state, { word: wordObj.word, letters })
        : createSpellRound({ word: wordObj.word, letters });

      this.layout = computeLayout(this.scale.width, this.scale.height, wordObj.word.length, 0, letters.length);
      this.buildStationSign(wordObj);
      this.buildTrain(wordObj.word.length, wordObj.word, this.plan.ghost);
      if (this.signContainer) popPromises.push(popIn(this, this.signContainer, 20));

      letters.forEach((ch, idx) => {
        const { view, pop } = this.createTileView(ch, this.layout.tileSpots[idx], idx);
        this.tileViews.push(view);
        popPromises.push(pop);
      });

      if (this.introPendingMode !== 'spell') {
        this.introPendingMode = 'spell';
        lines.push(introLine(c, 'spell'));
      }
      lines.push(spellLine(c, wordObj.id));
    }

    const trainArrive = this.trainContainer
      ? tweenAsync(this, {
          targets: this.trainContainer,
          x: this.scale.width / 2,
          duration: isReducedMotion() ? 140 : 460,
          ease: 'Cubic.easeOut',
        })
      : Promise.resolve();

    if (lines.length > 0) void this.speakSequence(lines, token, fromCreate);

    void Promise.all([trainArrive, ...popPromises]).then(() => {
      if (token !== this.visitToken || !this.sys.isActive()) return;
      this.ready = true;
      this.scheduleHint();
    });
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen || this.state.phase === 'departing') return;
    this.stepHinted = true;
    this.context.sfx.hint();
    const c = content();

    if (this.state.mode === 'load') {
      const targetId = this.state.target;
      const targetView = this.objectViews.find((v) => v.id === targetId);
      if (targetView) void hintPulse(this, targetView.container);
      void this.speakSequence([loadLine(c, targetId)], this.visitToken);
      this.scheduleHint();
      return;
    }

    const nextSlot = this.state.slots.findIndex((s) => s === null);
    if (nextSlot < 0) return;
    if (this.plan.audioOnly && this.currentWord) {
      void this.speakSequence([spellLine(c, this.currentWord.id)], this.visitToken);
      this.scheduleHint();
      return;
    }
    const expectedLetter = this.state.word[nextSlot];
    const tile = this.state.tiles.find((t) => t.placedAt === null && t.letter === expectedLetter);
    const tileView = tile ? this.tileViews.find((v) => v.index === tile.index) : undefined;
    if (tileView) void hintPulse(this, tileView.container);
    void this.speakSequence([letterLine(expectedLetter)], this.visitToken);
    this.scheduleHint();
  }

  private async departTrain(token: number): Promise<void> {
    if (!this.trainContainer) return;
    const offLeft = -this.layout.totalTrainW / 2 - 90;
    await tweenAsync(this, {
      targets: this.trainContainer,
      x: offLeft,
      duration: isReducedMotion() ? 150 : 520,
      ease: 'Cubic.easeIn',
    });
    if (token !== this.visitToken || !this.sys.isActive()) return;
  }

  private async handleLoadPick(id: string): Promise<void> {
    if (!this.isRoundLive() || this.state.mode !== 'load') return;
    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();

    const { state, event } = pickObject(this.state, id);
    this.lastEvent = event.kind;
    if (event.kind === 'busy') return;

    this.state = state;
    this.hintTimer?.remove();
    this.session.reportInteraction();

    const entry = this.objectViews.find((v) => v.id === id);
    const juice = Juice.for(this);

    if (event.kind === 'other') {
      this.context.sfx.tap();
      if (entry) {
        this.slideBack(entry.container, entry.rest);
        void wobble(this, entry.container);
        juice.burst('sparkle', entry.rest.x, entry.rest.y, 5);
      }
      void this.speakSequence([otherLine(c, id), loadLine(c, event.target)], token);
      this.scheduleHint();
      return;
    }

    if (event.kind !== 'loaded') return;
    this.ready = false;
    this.skills.record('en', trialForLoad(event));
    this.stepHinted = false;
    this.loadProgress++;

    const wagonRect = this.wagonWorldRect(0);
    const wagonCenterX = wagonRect.x + wagonRect.width / 2;
    const wagonCenterY = wagonRect.y + wagonRect.height / 2;
    const cargoTargetY = wagonCenterY + WAGON_CARGO_OFFSET_Y * this.layout.trainScale;

    if (entry) {
      entry.loaded = true;
      this.tweens.killTweensOf(entry.container);
      entry.container.disableInteractive();
      entry.container.setDepth(DEPTH.flying);
      const fromX = entry.container.x;
      const fromY = entry.container.y;
      const startScale = entry.container.scaleX;
      const endScale = 0.62 * this.layout.trainScale;
      const arcHeight = isReducedMotion() ? 18 : 70;
      const duration = isReducedMotion() ? 120 : 280;

      await tweenAsync(this, {
        targets: { t: 0 },
        t: 1,
        duration,
        ease: 'Cubic.easeOut',
        onUpdate: (tween) => {
          const t = tween.getValue() ?? 0;
          const x = fromX + (wagonCenterX - fromX) * t;
          const y = fromY + (cargoTargetY - fromY) * t - Math.sin(t * Math.PI) * arcHeight;
          entry.container.setPosition(x, y);
          entry.container.setScale(startScale + (endScale - startScale) * t);
        },
      });
      if (!alive()) return;

      // Tuck cargo into trainContainer behind the wagon wall so it rides away with the train.
      if (this.trainContainer && this.wagonViews[0]) {
        const wagonView = this.wagonViews[0];
        entry.container.setPosition(wagonView.localX, WAGON_CARGO_OFFSET_Y);
        entry.container.setScale(0.62);
        this.trainContainer.addAt(entry.container, 1);
      }
    }

    juice.burst('sparkle', wagonCenterX, cargoTargetY, 8);
    this.context.sfx.toot();

    const earnedStar = this.loadProgress >= this.plan.loadsPerStar;
    const lines: SpeechRequest[] = [nameLine(c, id)];
    if (earnedStar) {
      this.loadProgress = 0;
      this.context.sfx.yay();
      this.awardStar(wagonCenterX, wagonCenterY - 24);
      lines.push(heLine('praise.0'));
    }

    await this.speakSequence(lines, token);
    if (!alive()) return;
    await wait(this, isReducedMotion() ? 120 : ROUND_HOLD_MS);
    if (!alive()) return;
    await this.departTrain(token);
    if (!alive()) return;
    this.session.reportCelebrating(false);
    this.startRound(token);
  }

  private handleTileTap(tileIndex: number): Promise<void> {
    if (!this.isRoundLive() || this.state.mode !== 'spell') return Promise.resolve();
    const result = tapTile(this.state, tileIndex);
    return this.applySpellResult(tileIndex, result);
  }

  private handleTileDrop(tileIndex: number, slotIndex: number): Promise<void> {
    if (!this.isRoundLive() || this.state.mode !== 'spell') return Promise.resolve();
    const result = placeTile(this.state, tileIndex, slotIndex);
    return this.applySpellResult(tileIndex, result);
  }

  private async applySpellResult(
    tileIndex: number,
    result: { state: WordTrainState; event: WordTrainEvent },
  ): Promise<void> {
    const { state, event } = result;
    this.lastEvent = event.kind;
    if (event.kind === 'busy') return;

    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();

    this.state = state;
    this.hintTimer?.remove();
    this.session.reportInteraction();

    const tileView = this.tileViews.find((v) => v.index === tileIndex);
    const juice = Juice.for(this);

    if (event.kind === 'bounced') {
      this.context.sfx.tap();
      if (tileView) {
        this.slideBack(tileView.container, tileView.rest);
        void wobble(this, tileView.container);
        juice.burst('sparkle', tileView.rest.x, tileView.rest.y, 4);
      }
      void this.speakSequence([letterLine(event.letter)], token);
      this.scheduleHint();
      return;
    }

    if (event.kind === 'placed') {
      this.context.sfx.tap();
      await this.snapTileToWagon(tileView, event.slotIndex, token);
      if (!alive()) return;
      void this.speakSequence([letterLine(event.letter)], token);
      this.scheduleHint();
      return;
    }

    if (event.kind !== 'spelled' || this.state.mode !== 'spell') return;
    this.ready = false;
    const lastSlotIndex = this.state.tiles[tileIndex]?.placedAt ?? this.state.slots.length - 1;
    const wordObj = this.currentWord;
    this.skills.record('en', trialForWord(event, this.stepHinted, wordObj?.id ?? event.word));
    this.stepHinted = false;

    await this.snapTileToWagon(tileView, lastSlotIndex, token);
    if (!alive()) return;

    const wagonRect = this.wagonWorldRect(lastSlotIndex);
    const fxX = wagonRect.x + wagonRect.width / 2;
    const fxY = wagonRect.y + wagonRect.height / 2;

    this.context.sfx.yay();
    this.context.sfx.toot();
    this.awardStar(fxX, fxY - 24);

    const lines = wordObj ? [wordLine(c, wordObj.id), heLine('praise.0')] : [heLine('praise.0')];
    await this.speakSequence(lines, token);
    if (!alive()) return;
    await wait(this, isReducedMotion() ? 120 : ROUND_HOLD_MS);
    if (!alive()) return;
    await this.departTrain(token);
    if (!alive()) return;
    this.session.reportCelebrating(false);
    this.startRound(token);
  }

  private async snapTileToWagon(
    tileView: TileView | undefined,
    slotIndex: number,
    token: number,
  ): Promise<void> {
    const wagonView = this.wagonViews[slotIndex];
    if (!tileView || !wagonView) return;
    tileView.placed = true;
    tileView.container.disableInteractive();
    this.tweens.killTweensOf(tileView.container);
    tileView.container.setDepth(DEPTH.wagonPanel);

    if (wagonView.ghostText) wagonView.ghostText.setVisible(false);

    const wagonRect = this.wagonWorldRect(slotIndex);
    const panelCenterX = wagonRect.x + wagonRect.width / 2;
    const panelCenterY = wagonRect.y + wagonRect.height / 2 + WAGON_PANEL_OFFSET_Y * this.layout.trainScale;
    const targetWorldScale = Math.min(0.84, (WAGON_PANEL_H * 0.88 * this.layout.trainScale) / TILE_SIZE);

    await tweenAsync(this, {
      targets: tileView.container,
      x: panelCenterX,
      y: panelCenterY,
      scale: targetWorldScale,
      angle: 0,
      duration: isReducedMotion() ? 90 : 200,
      ease: 'Back.easeOut',
    });
    if (token !== this.visitToken || !this.sys.isActive()) return;

    Juice.for(this).burst('sparkle', panelCenterX, panelCenterY, 6);

    if (this.trainContainer) {
      tileView.container.setPosition(wagonView.localX, WAGON_PANEL_OFFSET_Y);
      tileView.container.setScale(targetWorldScale / this.layout.trainScale);
      this.trainContainer.add(tileView.container);
    }
  }

  private awardStar(fxX: number, fxY: number): void {
    this.session.complete();
    this.context.recordCompletedRound('language-house', 'word-train');
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

  getWordTrainInfo(): WordTrainInfo | null {
    if (!this.state || !this.layout) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const toPage = (r: Rect): Rect => gameRectToPageRect(r, canvasRect, size);

    const isLoad = this.state.mode === 'load';
    const objects = isLoad
      ? this.objectViews.map((v) => {
          const s = v.loaded ? 0.62 * this.layout.trainScale : 1;
          const side = OBJECT_SIZE * s;
          let cx = v.rest.x;
          let cy = v.rest.y;
          if (v.loaded) {
            if (this.trainContainer && v.container.parentContainer === this.trainContainer) {
              cx = this.trainContainer.x + v.container.x * this.layout.trainScale;
              cy = this.trainContainer.y + v.container.y * this.layout.trainScale;
            } else {
              cx = v.container.x;
              cy = v.container.y;
            }
          }
          return {
            id: v.id,
            rect: toPage({ x: cx - side / 2, y: cy - side / 2, width: side, height: side }),
          };
        })
      : [];

    const wagonRect = isLoad ? toPage(this.wagonWorldRect(0)) : null;

    const tiles =
      this.state.mode === 'spell'
        ? this.state.tiles.map((t) => {
            const v = this.tileViews.find((tv) => tv.index === t.index);
            const placed = t.placedAt !== null;
            if (placed && t.placedAt !== null) {
              const wr = this.wagonWorldRect(t.placedAt);
              const side = Math.min(0.84, (WAGON_PANEL_H * 0.88 * this.layout.trainScale) / TILE_SIZE) * TILE_SIZE;
              const cx = wr.x + wr.width / 2;
              const cy = wr.y + wr.height / 2 + WAGON_PANEL_OFFSET_Y * this.layout.trainScale;
              return {
                index: t.index,
                letter: t.letter,
                placed: true,
                rect: toPage({ x: cx - side / 2, y: cy - side / 2, width: side, height: side }),
              };
            }
            const cx = v?.rest.x ?? 0;
            const cy = v?.rest.y ?? 0;
            return {
              index: t.index,
              letter: t.letter,
              placed: false,
              rect: toPage({ x: cx - TILE_SIZE / 2, y: cy - TILE_SIZE / 2, width: TILE_SIZE, height: TILE_SIZE }),
            };
          })
        : [];

    const slots =
      this.state.mode === 'spell'
        ? this.state.slots.map((filledLetter, i) => ({
            index: i,
            letter: this.state.mode === 'spell' ? this.state.word[i] : '',
            filled: filledLetter !== null,
            rect: toPage(this.wagonWorldRect(i)),
          }))
        : [];

    return {
      mode: this.state.mode,
      phase: this.state.phase,
      level: this.levelNo,
      skillKey: this.skills.key('en'),
      language: 'en',
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      lastEvent: this.lastEvent,
      target: this.state.mode === 'load' ? this.state.target : (this.currentWord?.id ?? null),
      word: this.state.mode === 'spell' ? this.state.word : null,
      objects,
      wagonRect,
      tiles,
      slots,
    };
  }
}

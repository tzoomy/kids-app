// Seed to Flower (docs/specs/seed-to-flower.md), Pass 1: a no-fail cause-and-effect game in Nature Lab.
// Pure rules live in ./seedFlowerMachine.ts (state machine) and ./seedFlowerRound.ts (levels, trials, lines).
// Test handles: `getSeedFlowerInfo()` / `seedSeedFlowerLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, SeedToFlowerContent } from '../../content/schema';
import { loadSeedToFlower } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, popIn, pressSquash, wait, wobble } from '../../anim/tweens';
import { flowerArtKey, propArtKey, sceneArtKey } from '../../anim/artRegistry';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import { applyTool, createPlant, nextTool, stageId, type PlantEvent, type PlantState, type StageId, type Tool } from './seedFlowerMachine';
import { bloomFor, planForLevel, seedHeLine, speaksStage, stageLine, trialForGrowth, type SeedFlowerPlan } from './seedFlowerRound';
import type { SeedFlowerInfo } from './seedFlowerTypes';

let cachedContent: SeedToFlowerContent | null = null;
function content(): SeedToFlowerContent {
  cachedContent ??= loadSeedToFlower();
  return cachedContent;
}

const DEPTH = { background: -10, bedBack: 10, plant: 20, bedFront: 30, tools: 40, flying: 300 } as const;
/** Tool tap targets in game units (the canvas is at most 1:1, so these stay well above 64 CSS px). */
const TOOL_SIZE = 190;
/** Pause on the flower before the next seed. */
const BLOOM_HOLD_MS = 2200;
const BLOOM_LINE_MAX_MS = 3500;

interface Layout {
  plantX: number;
  groundY: number;
  water: { x: number; y: number };
  sun: { x: number; y: number };
  bedWidth: number;
}

function computeLayout(w: number, h: number): Layout {
  if (w >= h) {
    return { plantX: w / 2, groundY: h * 0.8, water: { x: w * 0.2, y: h * 0.56 }, sun: { x: w * 0.8, y: h * 0.4 }, bedWidth: 420 };
  }
  return { plantX: w / 2, groundY: h * 0.62, water: { x: w * 0.26, y: h * 0.84 }, sun: { x: w * 0.74, y: h * 0.84 }, bedWidth: 440 };
}

export class SeedFlowerScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: Layout;
  private lang: Lang | null = null;
  private plan!: SeedFlowerPlan;
  private plant!: PlantState;
  private levelNo = 1;
  private plantView?: Phaser.GameObjects.Container;
  private bedBack?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private bedFront?: Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse;
  private tools = new Map<Tool, Phaser.GameObjects.Container>();
  private ready = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPending = true;
  private plantsBloomed = 0;
  private lastEvent: PlantEvent['kind'] | null = null;
  private plantToken = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('SeedFlowerScene');
  }

  create(): void {
    setAppScreen('seed-flower');
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
    this.plantsBloomed = 0;
    this.lastEvent = null;
    this.tools = new Map();
    this.plantView = undefined;
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
    this.buildBed();
    this.buildTool('water', 'watering-can');
    this.buildTool('sun', 'sun');
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startPlant();

    window.__GAME_READY__ = true;
  }

  private cleanup(): void {
    this.plantToken++;
    this.hintTimer?.remove();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
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
    const key = sceneArtKey('hiding', w >= h ? 'bg-landscape' : 'bg-portrait');
    if (key && this.textures.exists(key)) {
      this.add.image(w / 2, h / 2, key).setDisplaySize(w, h).setDepth(DEPTH.background);
      return;
    }
    this.cameras.main.setBackgroundColor('#b8e6ff');
    this.add.rectangle(w / 2, h * 0.8, w, h * 0.4, 0x8ae07e).setDepth(DEPTH.background);
  }

  private buildBed(): void {
    const { plantX, groundY, bedWidth } = this.layout;
    const bedHeight = bedWidth / 2;
    const backKey = propArtKey('garden-bed-back');
    const frontKey = propArtKey('garden-bed-front');
    // Centred so the plant's foot (groundY) lands in the middle of the bed's soil.
    const bedY = groundY - bedHeight * 0.04;
    if (backKey && frontKey && this.textures.exists(backKey) && this.textures.exists(frontKey)) {
      this.bedBack = this.add.image(plantX, bedY, backKey).setDisplaySize(bedWidth, bedHeight).setDepth(DEPTH.bedBack);
      this.bedFront = this.add.image(plantX, bedY, frontKey).setDisplaySize(bedWidth, bedHeight).setDepth(DEPTH.bedFront);
    } else {
      this.bedBack = this.add.ellipse(plantX, groundY, bedWidth, bedHeight * 0.5, 0x7a4b2a).setDepth(DEPTH.bedBack);
      this.bedFront = this.add.ellipse(plantX, groundY + bedHeight * 0.18, bedWidth, bedHeight * 0.4, 0x5e3a20).setDepth(DEPTH.bedFront);
    }
  }

  private buildTool(tool: Tool, art: string): void {
    const pos = this.layout[tool];
    const container = this.add.container(pos.x, pos.y).setDepth(DEPTH.tools);
    const key = propArtKey(art);
    if (key && this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(TOOL_SIZE, TOOL_SIZE));
    } else if (tool === 'sun') {
      container.add(this.add.circle(0, 0, TOOL_SIZE * 0.36, 0xffd43b).setStrokeStyle(6, 0x3b2a22));
    } else {
      container.add(this.add.rectangle(0, 0, TOOL_SIZE * 0.6, TOOL_SIZE * 0.5, 0x5bb8f0).setStrokeStyle(6, 0x3b2a22));
    }
    container.setSize(TOOL_SIZE, TOOL_SIZE);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => this.onTool(tool));
    this.tools.set(tool, container);
    void popIn(this, container, tool === 'water' ? 120 : 220);
  }

  /** Rebuilds the plant for the current stage, foot at the soil line. */
  private renderPlant(stage: StageId): Phaser.GameObjects.Container {
    this.plantView?.destroy();
    const view = this.add.container(this.layout.plantX, this.layout.groundY).setDepth(DEPTH.plant);
    const u = 1.15;
    const tex = (key: string | undefined) => (key && this.textures.exists(key) ? key : undefined);
    if (stage === 'seed') {
      const k = tex(propArtKey('seed'));
      if (k) view.add(this.add.image(0, 0, k).setOrigin(0.5, 0.94).setDisplaySize(110, 110));
      else view.add(this.add.ellipse(0, -30, 70, 50, 0xa0632e).setStrokeStyle(6, 0x3b2a22));
      view.setSize(110, 110);
    } else if (stage === 'sprout') {
      const k = tex(propArtKey('sprout'));
      if (k) view.add(this.add.image(0, 0, k).setOrigin(0.5, 1).setDisplaySize(160 * u, 200 * u));
      else view.add(this.add.rectangle(0, -90, 16, 180, 0x57c457).setStrokeStyle(4, 0x3b2a22));
      view.setSize(160 * u, 200 * u);
    } else {
      const big = stage === 'flower';
      const stemH = big ? 280 : 200;
      const stemKey = tex(flowerArtKey(big ? 'stem-large' : 'stem-small'));
      if (stemKey) view.add(this.add.image(0, 0, stemKey).setOrigin(0.5, 1).setDisplaySize(160 * u, stemH * u));
      else view.add(this.add.rectangle(0, -((stemH - 80) * u) / 2, 18, (stemH - 80) * u, 0x57c457).setStrokeStyle(4, 0x3b2a22));
      const topY = -(stemH - 80) * u;
      if (big) {
        const size = 170;
        const bloomKey = tex(flowerArtKey(`bloom-${bloomFor(content(), this.plantsBloomed)}`));
        if (bloomKey) view.add(this.add.image(0, topY - size * 0.22, bloomKey).setDisplaySize(size, size));
        else view.add(this.add.circle(0, topY - size * 0.22, size * 0.4, 0xffd43b).setStrokeStyle(6, 0x3b2a22));
        view.setSize(size, (stemH - 80) * u + size * 0.72);
      } else {
        const budKey = tex(propArtKey('flower-bud'));
        const size = 120;
        if (budKey) view.add(this.add.image(0, topY + 12, budKey).setOrigin(0.5, 1).setDisplaySize(size, size));
        else view.add(this.add.ellipse(0, topY - size * 0.4, size * 0.5, size * 0.75, 0xff8fb1).setStrokeStyle(6, 0x3b2a22));
        view.setSize(160 * u, (stemH - 80) * u + size);
      }
    }
    this.plantView = view;
    return view;
  }

  private setSoilWet(wet: boolean): void {
    const tint = 0x9a7a66;
    for (const part of [this.bedBack, this.bedFront]) {
      if (!part) continue;
      if (part instanceof Phaser.GameObjects.Image) {
        if (wet) part.setTint(tint);
        else part.clearTint();
      } else {
        part.setAlpha(wet ? 0.8 : 1);
      }
    }
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
    void this.speak(seedHeLine(content(), 'help'));
    this.context.shell.showHelp(content().helpTextHe, () => {
      this.helpOpen = false;
      this.session.reportInteraction();
      this.context.audio.stopAll();
      this.scheduleHint();
    });
  }

  private async speak(request: SpeechRequest): Promise<void> {
    this.session.reportListening(true);
    try {
      await this.context.audio.play(request);
    } finally {
      this.session.reportListening(false);
    }
  }

  // ---------------------------------------------------------------- plant

  private startPlant(): void {
    const token = ++this.plantToken;
    const c = content();
    const settings = this.context.store.getState().settings;
    // One plant = one engine round (3 growth steps), in one language.
    this.lang = nextRoundLanguage(this.lang, this.lang === null || this.skills.atRoundBoundary(this.lang), settings.languages);
    this.levelNo = this.skills.level(this.lang);
    this.plan = planForLevel(c.adaptive.levels[this.levelNo - 1]);
    this.plant = createPlant(this.plan.stages, this.plan.mode);
    this.stepHinted = false;
    this.lastEvent = null;
    this.ready = false;
    this.setSoilWet(false);
    const view = this.renderPlant(stageId(this.plant));
    void popIn(this, view, 150).then(() => {
      if (token !== this.plantToken) return;
      this.ready = true;
      this.scheduleHint();
    });
    if (this.introPending) {
      this.introPending = false;
      void this.speak(seedHeLine(c, this.plan.mode === 'free' ? 'intro.free' : 'intro.ordered'));
    }
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen) return;
    const tool = nextTool(this.plant);
    if (!tool) return;
    this.stepHinted = true;
    this.context.sfx.hint();
    if (this.plan.audioOnly) {
      void this.speak(seedHeLine(content(), tool === 'water' ? 'needWater' : 'needSun'));
    } else {
      const target = this.tools.get(tool);
      if (target) void hintPulse(this, target);
    }
  }

  private onTool(tool: Tool): void {
    const target = this.tools.get(tool);
    if (target) void pressSquash(this, target);
    if (!this.ready || this.helpOpen) return;
    this.session.reportInteraction();
    this.context.sfx.tap();
    const { state, event } = applyTool(this.plant, tool);
    this.plant = state;
    this.lastEvent = event.kind;
    const c = content();
    const juice = Juice.for(this);
    const { plantX, groundY } = this.layout;
    switch (event.kind) {
      case 'watered':
        this.setSoilWet(true);
        juice.burst('sparkle', plantX, groundY - 20, 6);
        if (this.plantView) void wobble(this, this.plantView);
        this.scheduleHint();
        return;
      case 'needs-water': {
        this.context.sfx.hint();
        const can = this.tools.get('water');
        if (can && !this.plan.audioOnly) void hintPulse(this, can);
        void this.speak(seedHeLine(c, 'needWater'));
        this.scheduleHint();
        return;
      }
      case 'needs-sun': {
        const sun = this.tools.get('sun');
        if (sun && !this.plan.audioOnly) void hintPulse(this, sun);
        void this.speak(seedHeLine(c, 'needSun'));
        this.scheduleHint();
        return;
      }
      case 'resting':
        return;
      case 'grew':
        this.onGrew(event);
        return;
    }
  }

  private onGrew(event: Extract<PlantEvent, { kind: 'grew' }>): void {
    const lang = this.lang!;
    this.skills.record(lang, trialForGrowth(event, this.stepHinted));
    this.stepHinted = false;
    this.setSoilWet(false);
    const view = this.renderPlant(event.to);
    // Basic Pass-1 growth: the new stage swells up from a little smaller, anchored at its foot.
    view.setScale(0.7);
    this.tweens.add({ targets: view, scale: 1, duration: isReducedMotion() ? 120 : 380, ease: 'Back.easeOut' });
    Juice.for(this).burst('sparkle', this.layout.plantX, this.layout.groundY - view.height * 0.6, 8);
    const line = speaksStage(this.plan, event.to) ? stageLine(content(), event.to, lang) : undefined;
    if (event.bloomed) {
      void this.onBloom(line);
      return;
    }
    if (line) void this.speak(line);
    this.scheduleHint();
  }

  private async onBloom(line: SpeechRequest | undefined): Promise<void> {
    const token = this.plantToken;
    const alive = () => token === this.plantToken && this.sys.isActive();
    this.ready = false;
    this.hintTimer?.remove();
    this.context.sfx.yay();
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    const view = this.plantView;
    const topY = view ? view.y - view.height * 0.8 : this.layout.groundY - 300;
    const juice = Juice.for(this);
    juice.burst('confetti', this.layout.plantX, topY);
    juice.burst('star', this.layout.plantX, topY);
    this.flyStarToCounter(this.layout.plantX, topY);
    if (line) await Promise.race([this.speak(line), wait(this, BLOOM_LINE_MAX_MS)]);
    if (!alive()) return;
    void this.speak(heLine('praise.0'));
    await wait(this, BLOOM_HOLD_MS);
    if (!alive()) return;
    this.session.reportCelebrating(false);
    this.plantsBloomed++;
    this.startPlant();
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
    const star = this.add.image(fromX, fromY, fxTextureKey(this, 'star')).setDepth(DEPTH.flying).setScale(0.9);
    void flyArc(this, star, target.x, target.y, { duration: 650, height: 120, endScale: 0.55, spin: 180 }).then(() => {
      if (star.scene) star.destroy();
      finish();
    });
  }

  private starPillGamePoint(): { x: number; y: number } | undefined {
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

  getSeedFlowerInfo(): SeedFlowerInfo | null {
    if (!this.plant || !this.lang) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const toolRect = (tool: Tool): Rect => {
      const p = this.layout[tool];
      return gameRectToPageRect({ x: p.x - TOOL_SIZE / 2, y: p.y - TOOL_SIZE / 2, width: TOOL_SIZE, height: TOOL_SIZE }, canvasRect, size);
    };
    const v = this.plantView;
    const plantGame: Rect = v
      ? { x: v.x - v.width / 2, y: v.y - v.height, width: v.width, height: v.height }
      : { x: this.layout.plantX, y: this.layout.groundY, width: 0, height: 0 };
    return {
      level: this.levelNo,
      skillKey: this.skills.key(this.lang),
      language: this.lang,
      mode: this.plan.mode,
      naming: this.plan.naming,
      audioOnly: this.plan.audioOnly,
      stages: [...this.plant.stages],
      stage: stageId(this.plant),
      stageIndex: this.plant.stageIndex,
      watered: this.plant.watered,
      bloomed: this.plant.phase === 'bloomed',
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      plantsBloomed: this.plantsBloomed,
      lastEvent: this.lastEvent,
      water: toolRect('water'),
      sun: toolRect('sun'),
      plant: gameRectToPageRect(plantGame, canvasRect, size),
    };
  }
}

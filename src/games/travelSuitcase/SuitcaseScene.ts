// Travel Suitcase (docs/specs/travel-suitcase.md), Pass 1: EN/FR packing game in Language House.
// Pure rules live in ./suitcaseMachine.ts (state machine) and ./suitcaseRound.ts (levels, selection, trials, lines).
// Test handles: `getSuitcaseInfo()` / `seedSuitcaseLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, TravelSuitcaseContent } from '../../content/schema';
import { loadTravelSuitcase } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { packAndBounce } from '../../anim/sortPackMotion';
import { transitionTo } from '../../anim/transitions';
import { bounce, flyArc, hintPulse, killTweensOfProps, popIn, popOut, squashStretch, tweenAsync, wait, wobble } from '../../anim/tweens';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import type { SpeechRequest } from '../../core/audio/types';
import type { Lang } from '../templates/choiceServe';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import {
  createCase,
  nextRequest,
  pick,
  type SuitcaseChoice,
  type SuitcaseEvent,
  type SuitcaseState,
} from './suitcaseMachine';
import {
  artKeyForChoice,
  buildRequest,
  closedLine,
  introLine,
  nameLine,
  otherLine,
  planForLevel,
  requestLine,
  trialForRequest,
  type BuiltRequestSpec,
  type SuitcasePlan,
} from './suitcaseRound';
import type { SuitcaseInfo } from './suitcaseTypes';

let cachedContent: TravelSuitcaseContent | null = null;
function content(): TravelSuitcaseContent {
  cachedContent ??= loadTravelSuitcase();
  return cachedContent;
}

const DEPTH = {
  background: -10,
  case: 15,
  floorChoices: 30,
  dragging: 100,
  flying: 300,
} as const;

const CASE_ART_W = 640;
const CASE_ART_H = 440;
const OBJECT_SIZE = 150;
const PACKED_WORLD_SCALE = 0.6;
const OUTLINE_COLOR = 0x3b2a22;
const LINE_MAX_MS = 2400;
const REQUEST_PAUSE_MS = 380;
const CASE_CLOSE_HOLD_MS = 420;

interface Point {
  x: number;
  y: number;
}

/** Open-tray interior slots in unscaled 640x440 suitcase coordinates (centre = 0,0). */
const PACK_SLOTS: readonly Point[] = [
  { x: -130, y: 42 },
  { x: -44, y: 58 },
  { x: 44, y: 42 },
  { x: 130, y: 58 },
];

interface ChoiceView {
  id: string;
  itemId: string;
  color: string | null;
  rest: Point;
  container: Phaser.GameObjects.Container;
  dragStarted: boolean;
  startPos: Point;
  packed: boolean;
  slotIndex: number | null;
}

interface Layout {
  caseCenter: Point;
  caseScale: number;
  choiceSpots: Point[];
}

function computeLayout(w: number, h: number, choiceCount: number): Layout {
  const isLandscape = w >= h;
  if (isLandscape) {
    const caseScale = 520 / CASE_ART_W;
    const caseCenter: Point = { x: 320, y: 435 };
    const centerX = 935;
    let choiceSpots: Point[];
    if (choiceCount <= 3) {
      const spacing = choiceCount === 2 ? 230 : 195;
      const startX = centerX - ((choiceCount - 1) * spacing) / 2;
      choiceSpots = Array.from({ length: choiceCount }, (_, i) => ({
        x: startX + i * spacing,
        y: 465,
      }));
    } else {
      const cols = Math.ceil(choiceCount / 2);
      const colStep = 230;
      const rowStep = 210;
      const startX = centerX - ((cols - 1) * colStep) / 2;
      const startY = 435 - rowStep / 2;
      choiceSpots = Array.from({ length: choiceCount }, (_, i) => ({
        x: startX + (i % cols) * colStep,
        y: startY + Math.floor(i / cols) * rowStep,
      }));
    }
    return { caseCenter, caseScale, choiceSpots };
  }

  // Portrait (800x1280)
  const caseScale = 600 / CASE_ART_W;
  const caseCenter: Point = { x: w / 2, y: 365 };
  let choiceSpots: Point[];
  if (choiceCount <= 4) {
    const spacing = choiceCount === 2 ? 240 : choiceCount === 3 ? 210 : 186;
    const startX = w / 2 - ((choiceCount - 1) * spacing) / 2;
    choiceSpots = Array.from({ length: choiceCount }, (_, i) => ({
      x: startX + i * spacing,
      y: 785,
    }));
  } else {
    const cols = Math.ceil(choiceCount / 2);
    const colStep = 200;
    const rowStep = 200;
    const startX = w / 2 - ((cols - 1) * colStep) / 2;
    const startY = 710;
    choiceSpots = Array.from({ length: choiceCount }, (_, i) => ({
      x: startX + (i % cols) * colStep,
      y: startY + Math.floor(i / cols) * rowStep,
    }));
  }
  return { caseCenter, caseScale, choiceSpots };
}

export class SuitcaseScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private plan!: SuitcasePlan;
  private state!: SuitcaseState;
  private layout!: Layout;
  private levelNo = 1;
  private roundLang: Lang | null = null;
  private currentReqSpec!: BuiltRequestSpec;
  private previousKey: string | null = null;

  private caseContainer?: Phaser.GameObjects.Container;
  private packedLayer?: Phaser.GameObjects.Container;
  private floorViews: ChoiceView[] = [];
  private packedViews: ChoiceView[] = [];
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();

  private ready = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPending = true;
  private lastEvent: SuitcaseEvent['kind'] | null = null;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('SuitcaseScene');
  }

  create(): void {
    setAppScreen('travel-suitcase');
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
    this.introPending = true;
    this.lastEvent = null;
    this.roundLang = null;
    this.previousKey = null;
    this.caseContainer = undefined;
    this.packedLayer = undefined;
    this.floorViews = [];
    this.packedViews = [];
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
    this.buildSuitcase();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startCase(++this.visitToken, true);

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
    this.clearFloorViews();
    this.clearPackedViews();
    if (this.caseContainer) {
      this.tweens.killTweensOf(this.caseContainer);
      if (this.caseContainer.scene) this.caseContainer.destroy(true);
      this.caseContainer = undefined;
      this.packedLayer = undefined;
    }
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
    const bgKey = w >= h ? 'language-house-bg-landscape' : 'language-house-bg-portrait';
    if (this.textures.exists(bgKey)) {
      const img = this.add.image(w / 2, h / 2, bgKey).setDepth(DEPTH.background);
      const scale = Math.max(w / img.width, h / img.height);
      img.setScale(scale);
      return;
    }

    // Procedural Language House room fallback
    this.cameras.main.setBackgroundColor('#fde9d9');
    const floorTop = w >= h ? h * 0.56 : h * 0.44;
    this.add.rectangle(w / 2, floorTop + (h - floorTop) / 2, w, h - floorTop, 0xf0dec2).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, floorTop, w, 10, 0xd9be9a).setDepth(DEPTH.background);
  }

  private createCaseBack(): Phaser.GameObjects.GameObject {
    if (this.textures.exists('suitcase-back')) {
      return this.add.image(0, 0, 'suitcase-back');
    }
    const g = this.add.graphics();
    g.fillStyle(0xd4622a, 1);
    g.fillRoundedRect(-236, -194, 472, 190, 26);
    g.fillStyle(0xf7dec0, 1);
    g.fillRoundedRect(-214, -176, 428, 154, 18);
    g.fillStyle(0xd4622a, 1);
    g.fillRoundedRect(-272, -10, 544, 190, 28);
    g.fillStyle(0xfff2d6, 1);
    g.fillRoundedRect(-236, 12, 472, 136, 16);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-236, -194, 472, 190, 26);
    g.strokeRoundedRect(-272, -10, 544, 190, 28);
    return g;
  }

  private createCaseFront(): Phaser.GameObjects.GameObject {
    if (this.textures.exists('suitcase-front')) {
      return this.add.image(0, 0, 'suitcase-front');
    }
    const g = this.add.graphics();
    g.fillStyle(0xd4622a, 1);
    g.fillRoundedRect(-272, 86, 544, 94, 24);
    g.fillStyle(0xb04816, 1);
    g.fillRoundedRect(-270, 148, 540, 32, 14);
    g.fillStyle(0xc08552, 1);
    g.fillRoundedRect(-172, 82, 38, 32, 8);
    g.fillRoundedRect(134, 82, 38, 32, 8);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeRoundedRect(-272, 86, 544, 94, 24);
    return g;
  }

  private buildSuitcase(): void {
    const initialLayout = computeLayout(this.scale.width, this.scale.height, 2);
    this.layout = initialLayout;
    const container = this.add
      .container(initialLayout.caseCenter.x, initialLayout.caseCenter.y)
      .setDepth(DEPTH.case)
      .setScale(initialLayout.caseScale);

    container.add(this.createCaseBack());
    const packedLayer = this.add.container(0, 0);
    container.add(packedLayer);
    container.add(this.createCaseFront());

    this.caseContainer = container;
    this.packedLayer = packedLayer;
  }

  private drawFallbackItem(color: string | null, radius: number): Phaser.GameObjects.Graphics {
    const fillByColor: Record<string, number> = {
      red: 0xf24c4c,
      yellow: 0xffd43b,
      blue: 0x4d96ff,
    };
    const g = this.add.graphics();
    g.fillStyle(color ? (fillByColor[color] ?? 0xffb74d) : 0xffb74d, 1);
    g.fillCircle(0, 0, radius);
    g.lineStyle(5, OUTLINE_COLOR, 1);
    g.strokeCircle(0, 0, radius);
    return g;
  }

  private createChoiceView(
    choice: SuitcaseChoice,
    spot: Point,
    index: number,
  ): { view: ChoiceView; pop: Promise<void> } {
    const c = content();
    const artKey = artKeyForChoice(c, choice.id);
    const container = this.add.container(spot.x, spot.y).setDepth(DEPTH.floorChoices);
    if (this.textures.exists(artKey)) {
      container.add(this.add.image(0, 0, artKey).setDisplaySize(OBJECT_SIZE, OBJECT_SIZE));
    } else {
      container.add(this.drawFallbackItem(choice.color, OBJECT_SIZE * 0.36));
    }
    container.setSize(OBJECT_SIZE, OBJECT_SIZE);

    const view: ChoiceView = {
      id: choice.id,
      itemId: choice.itemId,
      color: choice.color,
      rest: { ...spot },
      container,
      dragStarted: false,
      startPos: { ...spot },
      packed: false,
      slotIndex: null,
    };

    const allowDrag = this.context.currentAgeTrack() === 'age5';
    if (allowDrag) {
      container.setInteractive({ useHandCursor: true, draggable: true });
      this.input.setDraggable(container);

      container.on('pointerdown', (pointer: Phaser.Input.Pointer) => {
        view.dragStarted = false;
        view.startPos = { x: pointer.x, y: pointer.y };
      });

      container.on('dragstart', () => {
        if (!this.isRoundLive() || view.packed) return;
        view.dragStarted = true;
        container.setDepth(DEPTH.dragging);
        this.session.reportInteraction();
      });

      container.on('drag', (_pointer: Phaser.Input.Pointer, dragX: number, dragY: number) => {
        if (!this.isRoundLive() || view.packed) return;
        const half = OBJECT_SIZE / 2;
        container.setPosition(
          Phaser.Math.Clamp(dragX, half, this.scale.width - half),
          Phaser.Math.Clamp(dragY, half, this.scale.height - half),
        );
      });

      container.on('dragend', (pointer: Phaser.Input.Pointer) => {
        if (view.packed) return;
        container.setDepth(DEPTH.floorChoices);
        const moved = Phaser.Math.Distance.Between(view.startPos.x, view.startPos.y, pointer.x, pointer.y);
        if (moved < 14) {
          container.setPosition(view.rest.x, view.rest.y);
          if (this.isRoundLive()) void this.handlePick(view.id);
          return;
        }
        if (!this.isRoundLive()) {
          this.slideBack(container, view.rest);
          return;
        }
        if (this.isOverCase(container.x, container.y)) {
          void this.handlePick(view.id);
        } else {
          this.slideBack(container, view.rest);
        }
      });

      container.on('pointerup', () => {
        if (view.dragStarted || view.packed || !this.isRoundLive()) return;
        void this.handlePick(view.id);
      });
    } else {
      container.setInteractive({ useHandCursor: true });
      container.on('pointerup', () => {
        if (view.packed || !this.isRoundLive()) return;
        void this.handlePick(view.id);
      });
    }

    const pop = popIn(this, container, 50 + index * 55);
    return { view, pop };
  }

  private slideBack(container: Phaser.GameObjects.Container, rest: Point): void {
    killTweensOfProps(this, container, ['x', 'y', 'scale', 'scaleX', 'scaleY']);
    void tweenAsync(this, {
      targets: container,
      x: rest.x,
      y: rest.y,
      scale: 1,
      duration: isReducedMotion() ? 100 : 220,
      ease: 'Back.easeOut',
    });
  }

  private caseWorldRect(): Rect {
    const cx = this.caseContainer?.x ?? this.layout.caseCenter.x;
    const cy = this.caseContainer?.y ?? this.layout.caseCenter.y;
    const s = this.layout.caseScale;
    const w = CASE_ART_W * s;
    const h = CASE_ART_H * s;
    return { x: cx - w / 2, y: cy - h / 2, width: w, height: h };
  }

  private isOverCase(x: number, y: number): boolean {
    const r = this.caseWorldRect();
    const pad = 32;
    return x >= r.x - pad && x <= r.x + r.width + pad && y >= r.y - pad && y <= r.y + r.height + pad;
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
    void this.speak({ lineId: 'suitcase.help.he', lang: 'he', text: content().helpTextHe });
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

  private async speakSequence(
    requests: readonly SpeechRequest[],
    token: number,
    allowInactiveFirst = false,
  ): Promise<void> {
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
    return this.ready && !this.helpOpen && this.state?.phase === 'asking';
  }

  private clearFloorViews(): void {
    for (const entry of this.floorViews) {
      this.tweens.killTweensOf(entry.container);
      if (entry.container.scene) entry.container.destroy(true);
    }
    this.floorViews = [];
  }

  private clearPackedViews(): void {
    for (const entry of this.packedViews) {
      this.tweens.killTweensOf(entry.container);
      if (entry.container.scene) entry.container.destroy(true);
    }
    this.packedViews = [];
  }

  private refreshLanguageAndPlan(atBoundary: boolean): Lang {
    const c = content();
    const setting = this.context.store.getState().settings.languages;
    const lang = nextRoundLanguage(this.roundLang, atBoundary, setting);
    this.roundLang = lang;
    if (atBoundary) {
      this.levelNo = this.skills.level(lang);
      this.plan = planForLevel(c.adaptive.levels[this.levelNo - 1]);
    }
    return lang;
  }

  private startCase(token: number, fromCreate = false): void {
    // During create() the scene status is CREATING, so isActive() is still false.
    if (token !== this.visitToken || (!fromCreate && !this.sys.isActive())) return;
    const c = content();
    const lang = this.refreshLanguageAndPlan(true);

    this.clearFloorViews();
    this.clearPackedViews();

    this.ready = false;
    this.stepHinted = false;
    this.lastEvent = null;

    const built = buildRequest(c, this.plan, this.previousKey, Math.random, [], lang);
    this.previousKey = built.request.key;
    this.currentReqSpec = built.request;

    this.state = createCase({
      choices: built.choices,
      request: {
        kind: built.request.kind,
        targets: built.request.targets,
        needed: built.request.needed,
      },
      requestsPerCase: this.plan.requestsPerCase,
    });

    this.layout = computeLayout(this.scale.width, this.scale.height, built.choices.length);
    if (this.caseContainer) {
      this.caseContainer.setPosition(this.layout.caseCenter.x, this.layout.caseCenter.y);
      this.caseContainer.setScale(this.layout.caseScale);
    }

    const popPromises = this.spawnFloorChoices(built.choices);

    const lines: SpeechRequest[] = [];
    if (this.introPending) {
      this.introPending = false;
      lines.push(introLine(c));
    }
    lines.push(requestLine(c, built.request, lang));
    void this.speakSequence(lines, token, fromCreate);

    void Promise.all(popPromises).then(() => {
      if (token !== this.visitToken || !this.sys.isActive()) return;
      this.ready = true;
      this.scheduleHint();
    });
  }

  private spawnFloorChoices(choices: readonly SuitcaseChoice[]): Promise<void>[] {
    const pops: Promise<void>[] = [];
    choices.forEach((choice, idx) => {
      const { view, pop } = this.createChoiceView(choice, this.layout.choiceSpots[idx], idx);
      this.floorViews.push(view);
      pops.push(pop);
    });
    return pops;
  }

  private async advanceRequest(token: number): Promise<void> {
    if (token !== this.visitToken || !this.sys.isActive()) return;
    const c = content();
    const lang = this.refreshLanguageAndPlan(false);

    // Pop out remaining unpacked floor items before laying out the fresh choice set.
    const remaining = this.floorViews.filter((v) => !v.packed);
    await Promise.all(
      remaining.map((v, i) => {
        v.container.disableInteractive();
        return popOut(this, v.container, i * 25);
      }),
    );
    if (token !== this.visitToken || !this.sys.isActive()) return;
    this.clearFloorViews();

    const packedItemIds = this.packedViews.map((v) => v.itemId);
    const built = buildRequest(c, this.plan, this.previousKey, Math.random, packedItemIds, lang);
    this.previousKey = built.request.key;
    this.currentReqSpec = built.request;

    this.state = nextRequest(this.state, {
      choices: built.choices,
      request: {
        kind: built.request.kind,
        targets: built.request.targets,
        needed: built.request.needed,
      },
    });

    this.stepHinted = false;
    this.layout = computeLayout(this.scale.width, this.scale.height, built.choices.length);
    const popPromises = this.spawnFloorChoices(built.choices);

    void this.speakSequence([requestLine(c, built.request, lang)], token);

    await Promise.all(popPromises);
    if (token !== this.visitToken || !this.sys.isActive()) return;
    this.ready = true;
    this.scheduleHint();
  }

  private scheduleHint(): void {
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(): void {
    if (!this.ready || this.helpOpen || this.state.phase !== 'asking') return;
    this.stepHinted = true;
    this.context.sfx.hint();
    const c = content();
    const lang = this.roundLang ?? 'en';

    if (this.plan.hintPulse) {
      const rightId = this.state.request.targets.find((id) => !this.state.packed.includes(id));
      const targetView = rightId ? this.floorViews.find((v) => v.id === rightId && !v.packed) : undefined;
      if (targetView) void hintPulse(this, targetView.container);
    }
    void this.speakSequence([requestLine(c, this.currentReqSpec, lang)], this.visitToken);
  }

  private async handlePick(choiceId: string): Promise<void> {
    if (!this.isRoundLive()) return;
    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();
    const lang = this.roundLang ?? 'en';

    const { state, event } = pick(this.state, choiceId);
    this.lastEvent = event.kind;
    if (event.kind === 'busy') return;

    this.state = state;
    this.hintTimer?.remove();
    this.session.reportInteraction();

    const entry = this.floorViews.find((v) => v.id === choiceId && !v.packed);
    const juice = Juice.for(this);

    if (event.kind === 'other') {
      this.context.sfx.tap();
      if (entry) {
        this.slideBack(entry.container, entry.rest);
        void wobble(this, entry.container);
        juice.burst('sparkle', entry.rest.x, entry.rest.y, 5);
      }
      void this.speakSequence([otherLine(c, choiceId, lang), requestLine(c, this.currentReqSpec, lang)], token);
      this.scheduleHint();
      return;
    }

    if (event.kind !== 'packed') return;

    if (event.requestDone) {
      this.ready = false;
      this.skills.record(lang, trialForRequest(this.state.tries, this.stepHinted, this.currentReqSpec.itemId));
      this.stepHinted = false;
    }

    const slotIndex = this.packedViews.length;
    const slotLocal = PACK_SLOTS[slotIndex % PACK_SLOTS.length];
    const targetWorldX = (this.caseContainer?.x ?? this.layout.caseCenter.x) + slotLocal.x * this.layout.caseScale;
    const targetWorldY = (this.caseContainer?.y ?? this.layout.caseCenter.y) + slotLocal.y * this.layout.caseScale;

    if (entry) {
      entry.packed = true;
      entry.slotIndex = slotIndex;
      this.floorViews = this.floorViews.filter((v) => v !== entry);
      this.packedViews.push(entry);
      this.tweens.killTweensOf(entry.container);
      entry.container.disableInteractive();
      entry.container.setDepth(DEPTH.flying);

      await packAndBounce(this, entry.container, targetWorldX, targetWorldY);
      if (!alive()) return;

      await tweenAsync(this, {
        targets: entry.container,
        scale: PACKED_WORLD_SCALE,
        duration: isReducedMotion() ? 60 : 120,
        ease: 'Quad.easeOut',
      });
      if (!alive()) return;

      if (this.packedLayer) {
        entry.container.setPosition(slotLocal.x, slotLocal.y);
        entry.container.setScale(PACKED_WORLD_SCALE / this.layout.caseScale);
        this.packedLayer.add(entry.container);
      }
    }

    juice.burst('sparkle', targetWorldX, targetWorldY, 8);
    this.context.sfx.tap();

    if (!event.requestDone) {
      void this.speakSequence([nameLine(c, choiceId, lang)], token);
      if (this.ready) this.scheduleHint();
      return;
    }

    if (!event.caseDone) {
      await this.speakSequence([nameLine(c, choiceId, lang)], token);
      if (!alive()) return;
      await wait(this, isReducedMotion() ? 100 : REQUEST_PAUSE_MS);
      if (!alive()) return;
      await this.advanceRequest(token);
      return;
    }

    // Full case! Celebrate, award star, hop suitcase, clear packed items, start next case.
    const remaining = this.floorViews.filter((v) => !v.packed);
    await Promise.all(
      remaining.map((v, i) => {
        v.container.disableInteractive();
        return popOut(this, v.container, i * 25);
      }),
    );
    if (!alive()) return;
    this.clearFloorViews();

    const caseX = this.caseContainer?.x ?? this.layout.caseCenter.x;
    const caseY = this.caseContainer?.y ?? this.layout.caseCenter.y;
    this.context.sfx.yay();
    this.awardStar(caseX, caseY - 40);

    const hopPromise = this.caseContainer
      ? (async () => {
          await squashStretch(this, this.caseContainer!, this.layout.caseScale, this.layout.caseScale);
          if (!alive() || !this.caseContainer) return;
          await bounce(this, this.caseContainer, 30);
        })()
      : Promise.resolve();

    await Promise.all([
      hopPromise,
      this.speakSequence([nameLine(c, choiceId, lang), closedLine(c), heLine('praise.0')], token),
    ]);
    if (!alive()) return;

    await wait(this, isReducedMotion() ? 120 : CASE_CLOSE_HOLD_MS);
    if (!alive()) return;

    await Promise.all(this.packedViews.map((v, i) => popOut(this, v.container, i * 30)));
    if (!alive()) return;

    this.session.reportCelebrating(false);
    this.startCase(token);
  }

  private awardStar(fxX: number, fxY: number): void {
    this.session.complete();
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

  getSuitcaseInfo(): SuitcaseInfo | null {
    if (!this.state || !this.layout || !this.roundLang) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const toPage = (r: Rect): Rect => gameRectToPageRect(r, canvasRect, size);

    const floorInfos = this.floorViews.map((v) => ({
      id: v.id,
      itemId: v.itemId,
      color: v.color,
      packed: false,
      rect: toPage({
        x: v.rest.x - OBJECT_SIZE / 2,
        y: v.rest.y - OBJECT_SIZE / 2,
        width: OBJECT_SIZE,
        height: OBJECT_SIZE,
      }),
    }));

    const packedSide = OBJECT_SIZE * PACKED_WORLD_SCALE;
    const packedInfos = this.packedViews.map((v) => {
      const slot = PACK_SLOTS[(v.slotIndex ?? 0) % PACK_SLOTS.length];
      const cx = (this.caseContainer?.x ?? this.layout.caseCenter.x) + slot.x * this.layout.caseScale;
      const cy = (this.caseContainer?.y ?? this.layout.caseCenter.y) + slot.y * this.layout.caseScale;
      return {
        id: v.id,
        itemId: v.itemId,
        color: v.color,
        packed: true,
        rect: toPage({
          x: cx - packedSide / 2,
          y: cy - packedSide / 2,
          width: packedSide,
          height: packedSide,
        }),
      };
    });

    const rightIds =
      this.state.phase === 'asking'
        ? this.state.request.targets.filter((id) => !this.state.packed.includes(id))
        : [];

    return {
      phase: this.state.phase,
      request: this.state.request.kind,
      level: this.levelNo,
      skillKey: this.skills.key(this.roundLang),
      language: this.roundLang,
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      lastEvent: this.lastEvent,
      rightIds,
      packedCount: this.state.packed.length,
      requestIndex: this.state.requestIndex,
      requestsPerCase: this.state.requestsPerCase,
      choices: [...packedInfos, ...floorInfos],
      caseRect: toPage(this.caseWorldRect()),
    };
  }
}

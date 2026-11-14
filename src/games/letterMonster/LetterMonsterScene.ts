// Letter Monster (docs/specs/letter-monster.md), Pass 1: a no-fail color & initial-letter game in Language House.
// Pure rules live in ./monsterMachine.ts and ./monsterRound.ts.
// Test handles: `getLetterMonsterInfo()` / `seedLetterMonsterLevel(level)` under ?e2e=1 (src/game/createGame.ts),
// and the shared HUD test ids (hud-back, hud-help, help-card, star-count, leisure-balance).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, LetterMonsterContent, LetterMonsterFood } from '../../content/schema';
import { loadLetterMonster } from '../../content/loadContent';
import { Juice, fxTextureKey } from '../../anim/juice';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { bounce, flyArc, popIn, pressSquash, squashStretch, wait, wobble } from '../../anim/tweens';
import { foodArtKey, propArtKey } from '../../anim/artRegistry';
import { drawFoodIcon } from '../../assets/vectorArt';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect, type Rect } from '../../testing/pageRect';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import {
  buildRound,
  createMonster,
  nextMonsterRound,
  tapFood,
  type MonsterEvent,
  type MonsterState,
} from './monsterMachine';
import {
  fedLines,
  introLine,
  notThisLine,
  planForLevel,
  requestLines,
  trialForRequest,
  type MonsterPlan,
} from './monsterRound';
import type { LetterMonsterInfo } from './letterMonsterTypes';

let cachedContent: LetterMonsterContent | null = null;
function content(): LetterMonsterContent {
  cachedContent ??= loadLetterMonster();
  return cachedContent;
}

const DEPTH = { background: -10, counter: -5, props: 20, foods: 40, flying: 300 } as const;
const OUTLINE_COLOR = 0x3b2a22;
const MONSTER_SIZE_LANDSCAPE = 260;
const MONSTER_SIZE_PORTRAIT = 270;
const SIGN_SIZE = 148;
const FOOD_HIT_SIZE = 168;
const FOOD_IMG_SIZE = 132;
const LINE_MAX_MS = 2200;
const NEXT_ROUND_DELAY_MS = 450;

interface Point {
  x: number;
  y: number;
}

interface Layout {
  counterY: number;
  monster: Point;
  monsterSize: number;
  sign: Point;
  foodY: number;
  foodSpacing2: number;
  foodSpacing3: number;
}

function computeLayout(w: number, h: number): Layout {
  if (w >= h) {
    return {
      counterY: h * 0.575,
      monster: { x: w / 2 - 40, y: 295 },
      monsterSize: MONSTER_SIZE_LANDSCAPE,
      sign: { x: w / 2 + 205, y: 270 },
      foodY: h * 0.74,
      foodSpacing2: 320,
      foodSpacing3: 280,
    };
  }
  return {
    counterY: h * 0.56,
    monster: { x: w / 2 - 60, y: 470 },
    monsterSize: MONSTER_SIZE_PORTRAIT,
    sign: { x: w / 2 + 195, y: 445 },
    foodY: h * 0.72,
    foodSpacing2: 290,
    foodSpacing3: 235,
  };
}

function hexToNumber(hex: string): number {
  return Number.parseInt(hex.slice(1), 16);
}

export class LetterMonsterScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: Layout;
  private lang: Lang | null = null;
  private plan!: MonsterPlan;
  private monster!: MonsterState;
  private levelNo = 1;
  private monsterView?: Phaser.GameObjects.Container;
  private monsterClosedView?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private monsterOpenView?: Phaser.GameObjects.Image | Phaser.GameObjects.Graphics;
  private signView?: Phaser.GameObjects.Container;
  private signColorDot?: Phaser.GameObjects.Arc;
  private signLetterText?: Phaser.GameObjects.Text;
  private foodViews = new Map<string, { container: Phaser.GameObjects.Container; pos: Point }>();
  private activeTransients = new Set<Phaser.GameObjects.GameObject>();
  private ready = false;
  private stepHinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private helpOpen = false;
  private introPending = true;
  private lastEvent: MonsterEvent['kind'] | null = null;
  private visitToken = 0;
  private speakSeq = 0;
  private speechBatch = 0;
  private visibilityHandler?: () => void;

  constructor() {
    super('LetterMonsterScene');
  }

  create(): void {
    setAppScreen('letter-monster');
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
    this.lastEvent = null;
    this.foodViews = new Map();
    this.activeTransients = new Set();
    this.monsterView = undefined;
    this.monsterClosedView = undefined;
    this.monsterOpenView = undefined;
    this.signView = undefined;
    this.signColorDot = undefined;
    this.signLetterText = undefined;
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
    this.buildMonster();
    this.buildSign();
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

  private clearFoods(): void {
    for (const entry of this.foodViews.values()) {
      this.destroyObject(entry.container);
    }
    this.foodViews.clear();
  }

  private cleanup(): void {
    this.visitToken++;
    this.speechBatch++;
    this.hintTimer?.remove();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.clearFoods();
    for (const obj of [...this.activeTransients]) this.destroyObject(obj);
    if (this.monsterView) this.tweens.killTweensOf(this.monsterView);
    if (this.signView) this.tweens.killTweensOf(this.signView);
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
    const cy = this.layout.counterY;
    this.cameras.main.setBackgroundColor('#ffe8cf');
    // Warm lower wall trim above the counter.
    this.add.rectangle(w / 2, cy - 28, w, 56, 0xf7cfa8).setDepth(DEPTH.background);
    // Wooden counter across the lower portion.
    const counterH = h - cy;
    this.add.rectangle(w / 2, cy + counterH / 2, w, counterH, 0xd8a46f).setDepth(DEPTH.background);
    this.add.rectangle(w / 2, cy + 12, w, 24, 0xfff3d6).setDepth(DEPTH.counter);
    this.add.rectangle(w / 2, cy, w, 5, OUTLINE_COLOR).setDepth(DEPTH.counter);
    this.add.rectangle(w / 2, cy + 24, w, 4, OUTLINE_COLOR).setDepth(DEPTH.counter);
  }

  private createMonsterFallback(open: boolean, size: number): Phaser.GameObjects.Graphics {
    const g = this.add.graphics();
    const r = size * 0.36;
    // Little ear tufts
    g.fillStyle(0x9b5de5, 1);
    g.fillCircle(-r * 0.6, -r * 0.78, r * 0.24);
    g.fillCircle(r * 0.6, -r * 0.78, r * 0.24);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeCircle(-r * 0.6, -r * 0.78, r * 0.24);
    g.strokeCircle(r * 0.6, -r * 0.78, r * 0.24);
    // Round purple blob body
    g.fillStyle(0x9b5de5, 1);
    g.fillCircle(0, 0, r);
    g.lineStyle(6, OUTLINE_COLOR, 1);
    g.strokeCircle(0, 0, r);
    // Simple dot eyes
    g.fillStyle(OUTLINE_COLOR, 1);
    g.fillCircle(-r * 0.32, -r * 0.24, r * 0.11);
    g.fillCircle(r * 0.32, -r * 0.24, r * 0.11);
    // Mouth
    if (open) {
      g.fillStyle(0x5a263a, 1);
      g.fillEllipse(0, r * 0.24, r * 0.72, r * 0.62);
      g.lineStyle(6, OUTLINE_COLOR, 1);
      g.strokeEllipse(0, r * 0.24, r * 0.72, r * 0.62);
    } else {
      g.lineStyle(6, OUTLINE_COLOR, 1);
      g.beginPath();
      g.arc(0, r * 0.1, r * 0.32, Phaser.Math.DegToRad(20), Phaser.Math.DegToRad(160), false);
      g.strokePath();
    }
    return g;
  }

  private buildMonster(): void {
    const { x, y } = this.layout.monster;
    const size = this.layout.monsterSize;
    const container = this.add.container(x, y).setDepth(DEPTH.props);

    const closedKey = propArtKey('monster-closed');
    const openKey = propArtKey('monster-open');
    const closedView =
      closedKey && this.textures.exists(closedKey)
        ? this.add.image(0, 0, closedKey).setDisplaySize(size, size)
        : this.createMonsterFallback(false, size);
    const openView =
      openKey && this.textures.exists(openKey)
        ? this.add.image(0, 0, openKey).setDisplaySize(size, size)
        : this.createMonsterFallback(true, size);

    openView.setVisible(false);
    container.add([closedView, openView]);
    container.setSize(size, size);
    container.setInteractive({ useHandCursor: true });
    container.on('pointerdown', () => {
      if (!this.ready || this.helpOpen || this.monster.phase !== 'asking' || !this.lang) return;
      this.session.reportInteraction();
      this.context.sfx.tap();
      void pressSquash(this, container);
      void this.speakSequence(requestLines(content(), this.monster.request, this.lang), this.visitToken);
    });

    this.monsterView = container;
    this.monsterClosedView = closedView;
    this.monsterOpenView = openView;
  }

  private setMonsterOpen(open: boolean): void {
    this.monsterClosedView?.setVisible(!open);
    this.monsterOpenView?.setVisible(open);
  }

  private buildSign(): void {
    const { x, y } = this.layout.sign;
    const container = this.add.container(x, y).setDepth(DEPTH.props).setVisible(false);
    const post = this.add.rectangle(0, SIGN_SIZE * 0.62, 18, SIGN_SIZE * 0.55, 0xa97155).setStrokeStyle(5, OUTLINE_COLOR);
    const board = this.add
      .rectangle(0, 0, SIGN_SIZE, SIGN_SIZE, 0xfffdf9)
      .setStrokeStyle(6, OUTLINE_COLOR);
    const dot = this.add.circle(0, 0, 44, 0xffffff).setStrokeStyle(5, OUTLINE_COLOR).setVisible(false);
    const letter = this.add
      .text(0, 0, '', {
        fontFamily: '"Noto Sans", Arial, sans-serif',
        fontSize: '78px',
        fontStyle: 'bold',
        color: '#3B2A22',
      })
      .setOrigin(0.5)
      .setVisible(false);

    container.add([post, board, dot, letter]);
    container.setSize(SIGN_SIZE, SIGN_SIZE);
    this.signView = container;
    this.signColorDot = dot;
    this.signLetterText = letter;
  }

  private renderSign(animate = false): void {
    if (!this.signView || !this.signColorDot || !this.signLetterText) return;
    if (this.plan.audioOnly) {
      this.signView.setVisible(false);
      return;
    }
    const req = this.monster.request;
    if (req.kind === 'color') {
      this.signColorDot.setFillStyle(hexToNumber(content().colors[req.color].hex));
      this.signColorDot.setVisible(true);
      this.signLetterText.setVisible(false);
    } else {
      this.signLetterText.setText(req.letter);
      this.signLetterText.setVisible(true);
      this.signColorDot.setVisible(false);
    }
    this.signView.setVisible(true);
    if (animate) void popIn(this, this.signView, 40);
  }

  private foodPositions(count: number): Point[] {
    const cx = this.scale.width / 2;
    const y = this.layout.foodY;
    if (count === 2) {
      const half = this.layout.foodSpacing2 / 2;
      return [
        { x: cx - half, y },
        { x: cx + half, y },
      ];
    }
    const step = this.layout.foodSpacing3;
    return [
      { x: cx - step, y },
      { x: cx, y },
      { x: cx + step, y },
    ];
  }

  private buildFoodSprite(food: LetterMonsterFood): Phaser.GameObjects.GameObject {
    const key = foodArtKey(food.id);
    if (key && this.textures.exists(key)) {
      return this.add.image(0, 0, key).setDisplaySize(FOOD_IMG_SIZE, FOOD_IMG_SIZE);
    }
    return drawFoodIcon(this, food.id, food.color, FOOD_IMG_SIZE * 0.52);
  }

  private renderOfferedFoods(): Promise<void[]> {
    this.clearFoods();
    const c = content();
    const byId = new Map(c.foods.map((f) => [f.id, f]));
    const positions = this.foodPositions(this.monster.offeredIds.length);
    const pops: Promise<void>[] = [];

    this.monster.offeredIds.forEach((foodId, idx) => {
      const food = byId.get(foodId);
      if (!food) return;
      const pos = positions[idx];
      const container = this.add.container(pos.x, pos.y).setDepth(DEPTH.foods);
      const coaster = this.add.ellipse(0, 10, FOOD_HIT_SIZE * 0.92, FOOD_HIT_SIZE * 0.56, 0xfffdf9).setStrokeStyle(5, OUTLINE_COLOR);
      const sprite = this.buildFoodSprite(food);
      container.add([coaster, sprite]);
      container.setSize(FOOD_HIT_SIZE, FOOD_HIT_SIZE);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => void this.onFoodTap(foodId));
      this.foodViews.set(foodId, { container, pos });
      pops.push(popIn(this, container, 60 + idx * 70));
    });

    return Promise.all(pops);
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
    void this.speak({ lineId: 'monster.help.he', lang: 'he', text: content().helpTextHe });
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

  // ---------------------------------------------------------------- round flow

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
    const lang = this.lang!;
    const round = buildRound(c.foods, this.plan.requestKind, lang, this.plan.choices, null);
    this.monster = createMonster(round);
    this.stepHinted = false;
    this.lastEvent = null;
    this.ready = false;
    this.setMonsterOpen(false);
    this.renderSign(true);

    const lines: SpeechRequest[] = [];
    if (this.introPending) {
      lines.push(introLine(c));
      this.introPending = false;
    }
    lines.push(...requestLines(c, round.request, lang));
    void this.speakSequence(lines, token);

    const monsterPop = this.monsterView ? popIn(this, this.monsterView, 40) : Promise.resolve();
    void Promise.all([monsterPop, this.renderOfferedFoods()]).then(() => {
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
    if (!this.ready || this.helpOpen || this.monster.phase !== 'asking') return;
    this.stepHinted = true;
    this.context.sfx.hint();
    if (this.plan.hintWiggle) {
      const match = this.foodViews.get(this.monster.matchId);
      if (match) void wobble(this, match.container);
    }
    if (this.lang) {
      void this.speakSequence(requestLines(content(), this.monster.request, this.lang), this.visitToken);
    }
  }

  private async onFoodTap(foodId: string): Promise<void> {
    if (!this.ready || this.helpOpen) return;
    const { state, event } = tapFood(this.monster, foodId);
    if (event.kind === 'busy') return;

    const token = this.visitToken;
    const alive = () => token === this.visitToken && this.sys.isActive();
    const c = content();
    const lang = this.lang!;
    const foodEntry = this.foodViews.get(foodId);

    this.ready = false;
    this.hintTimer?.remove();
    this.session.reportInteraction();
    this.context.sfx.tap();
    this.monster = state;
    this.lastEvent = event.kind;

    if (event.kind === 'not-this-one') {
      await Promise.all([
        this.monsterView ? wobble(this, this.monsterView) : Promise.resolve(),
        foodEntry ? bounce(this, foodEntry.container) : Promise.resolve(),
        this.speakSequence([notThisLine(c)], token),
      ]);
      if (!alive()) return;
      this.ready = true;
      this.scheduleHint();
      return;
    }

    if (event.kind !== 'fed') return; // a food tap only ever feeds or says "not this one"

    // Matching food: press squash, open mouth, fly arc into the mouth, munch squash, close, star & speak.
    if (foodEntry) {
      await pressSquash(this, foodEntry.container);
      if (!alive()) return;
    }

    this.setMonsterOpen(true);
    const mouthX = this.layout.monster.x;
    const mouthY = this.layout.monster.y + this.layout.monsterSize * 0.12;

    if (foodEntry) {
      this.foodViews.delete(foodId);
      this.activeTransients.add(foodEntry.container);
      foodEntry.container.setDepth(DEPTH.flying);
      await flyArc(this, foodEntry.container, mouthX, mouthY, {
        duration: isReducedMotion() ? 100 : 320,
        height: 110,
        endScale: 0.35,
      });
      this.destroyObject(foodEntry.container);
      if (!alive()) return;
    }

    if (this.monsterView) void squashStretch(this, this.monsterView);
    this.setMonsterOpen(false);

    const juice = Juice.for(this);
    juice.burst('crumb', mouthX, mouthY, 6);
    juice.burst('confetti', this.layout.monster.x, this.layout.monster.y - 20);
    juice.burst('star', this.layout.monster.x, this.layout.monster.y - 20);

    this.context.sfx.yay();
    this.session.complete();
    const profile = this.profileState();
    profile.stars++;
    this.context.store.persist();
    this.flyStarToCounter(this.layout.monster.x, this.layout.monster.y - 20);

    this.skills.record(lang, trialForRequest(event, this.stepHinted));
    this.stepHinted = false;

    await this.speakSequence(fedLines(c, foodId, lang), token);
    if (!alive()) return;
    await wait(this, NEXT_ROUND_DELAY_MS);
    if (!alive()) return;

    this.session.reportCelebrating(false);
    this.refreshRoundPlan();
    const nextLang = this.lang!;
    const round = buildRound(c.foods, this.plan.requestKind, nextLang, this.plan.choices, this.monster.request);
    const { state: nextState, event: nextEvt } = nextMonsterRound(this.monster, round);
    this.monster = nextState;
    this.lastEvent = nextEvt.kind;
    this.renderSign(true);
    void this.speakSequence(requestLines(c, round.request, nextLang), token);

    await this.renderOfferedFoods();
    if (!alive()) return;
    this.ready = true;
    this.scheduleHint();
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
    this.activeTransients.add(star);
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

  getLetterMonsterInfo(): LetterMonsterInfo | null {
    if (!this.monster || !this.lang) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const canvasRect = { x: box.left, y: box.top, width: box.width, height: box.height };
    const size = { width: this.scale.width, height: this.scale.height };
    const foods: Record<string, Rect> = {};
    for (const [id, entry] of this.foodViews.entries()) {
      foods[id] = gameRectToPageRect(
        {
          x: entry.pos.x - FOOD_HIT_SIZE / 2,
          y: entry.pos.y - FOOD_HIT_SIZE / 2,
          width: FOOD_HIT_SIZE,
          height: FOOD_HIT_SIZE,
        },
        canvasRect,
        size,
      );
    }
    const m = this.layout.monster;
    const ms = this.layout.monsterSize;
    return {
      phase: this.monster.phase,
      request: this.monster.request,
      level: this.levelNo,
      skillKey: this.skills.key(this.lang),
      language: this.lang,
      mode: this.plan.requestKind,
      audioOnly: this.plan.audioOnly,
      offeredIds: [...this.monster.offeredIds],
      matchId: this.monster.matchId,
      tries: this.monster.tries,
      stars: this.profileState().stars,
      ready: this.ready && !this.helpOpen,
      hinted: this.stepHinted,
      lastEvent: this.lastEvent,
      signVisible: Boolean(this.signView?.visible),
      foods,
      monster: gameRectToPageRect({ x: m.x - ms / 2, y: m.y - ms / 2, width: ms, height: ms }, canvasRect, size),
    };
  }
}

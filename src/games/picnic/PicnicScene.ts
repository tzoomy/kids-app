// PicnicScene: Picnic Train (Number Garden). Spec: docs/specs/picnic-train.md.
//
// CONTRACT (implemented against the tests; do not change these without a spec change):
// - Scene key: 'PicnicScene'. Started from the Number Garden game picker (src/worlds/MapScene.ts).
// - create() calls setAppScreen('picnic') and sets window.__GAME_READY__ = true.
// - `getPicnicInfo(): PicnicInfo | null` (./types.ts). Rectangles are page CSS px (src/testing/pageRect.ts).
//   `ready` is true only while input is accepted (not animating, not departing, not inside the 400 ms wrong-tap lock).
// - Hooks live in src/game/createGame.ts under ?e2e=1: `getPicnicInfo()` and `seedPicnicLevel(level)`.
//   They only read or seed state; they never act in the game or navigate.
// - Chrome test ids: hud-back, hud-help, prompt-bubble, help-card, help-card-close, star-count, leisure-balance.
// - Pure rules live in ./picnicLogic.ts (TrainRound, PicnicTrialTracker), layout in ./picnicLayout.ts, art (with
//   procedural fallbacks) in ./picnicArt.ts. One train = one adaptive trial = one round.
// - Tap targets are at least 64 CSS px in both orientations; the train is panned, never shrunk, while it is tapped.
//   While nothing on the train is tapped (load, answer) it is shown whole, scaled to fit, so the child can count.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import type { LearningSession } from '../../core/leisure';
import { buildMeta, type GameLevelsMeta, type SkillSession } from '../../core/adaptive';
import type { AgeTrackConfig, PicnicTrainContent } from '../../content/schema';
import { Character } from '../../anim/Character';
import { Juice } from '../../anim/juice';
import { transitionTo } from '../../anim/transitions';
import { arriveTrain, handOutItem } from '../../anim/homesTrainMotion';
import { bounce, hintPulse, popIn, popOut, tweenAsync, wait } from '../../anim/tweens';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import { rtlIsolate } from '../sorting/sortingVoice';
import {
  HELP_LINE,
  MISSING_GIVE_LINE,
  PICNIC_FOODS,
  PicnicTrialTracker,
  READY_LINE,
  TrainRound,
  WRONG_COUNT_LINE,
  WRONG_GIVEN_LINE,
  WRONG_TAP_LOCK_MS,
  askLine,
  buildTrain,
  isLocked,
  levelLevers,
  numberLine,
  trainSizeCandidates,
  type LineRequest,
  type TrainPassenger,
  type TrainPlan,
} from './picnicLogic';
import { cardRects, computePicnicLayout, trainBand, type LayoutRect, type PicnicLayout } from './picnicLayout';
import {
  addBackground,
  makeBasket,
  makeFood,
  makeGhostItem,
  makeGoFlag,
  makeNumberCard,
  makeShelfSlot,
  makeTallyDot,
  makeTrainPiece,
} from './picnicArt';
import { PICNIC_LINE_TEXT } from './picnicVoice';
import type { PicnicInfo } from './types';

export type { PicnicInfo, PicnicPassengerInfo, PicnicTask, PageRect } from './types';

/** Longest wait for a Hebrew guidance line before the game moves on (device TTS can hang without a voice). */
const HE_LINE_MAX_MS = 3600;
/** Longest wait for one English or French token. */
const WORD_LINE_MAX_MS = 1600;
const ROUND_END_HOLD_MS = 700;
const HELD_ITEM_SIZE = 56;
const DEPTH = { train: 10, shelf: 12, tally: 14, cargo: 30, basket: 40, basketItem: 45, flying: 60 } as const;

interface PassengerView {
  plan: TrainPassenger;
  character: Character;
  zone: Phaser.GameObjects.Zone;
  held: Phaser.GameObjects.Container | null;
  ghost: Phaser.GameObjects.Container | null;
}

export class PicnicScene extends Phaser.Scene {
  private context!: AppContext;
  private content!: PicnicTrainContent;
  private session!: LearningSession;
  private skills!: SkillSession;
  private meta!: GameLevelsMeta;
  private ageConfig!: AgeTrackConfig;
  private layout!: PicnicLayout;
  private plan: TrainPlan | null = null;
  private round: TrainRound | null = null;
  private tracker: PicnicTrialTracker | null = null;
  private roundLevel = 1;
  private roundLang: Lang = 'en';
  private ready = false;
  private tries = 0;
  private lockedUntil = 0;
  private token = 0;
  private speakSeq = 0;
  /** True from a line request until the audio really ends (the speak caps may clear `speaking` earlier). */
  private linePlaying = false;
  private speaking = false;
  private helpOpen = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;

  // Scene objects of the current train.
  private trainRoot: Phaser.GameObjects.Container | null = null;
  private passengers = new Map<string, PassengerView>();
  private zones: Phaser.GameObjects.Zone[] = [];
  private extras: Phaser.GameObjects.GameObject[] = [];
  private basket: Phaser.GameObjects.Container | null = null;
  private basketItem: Phaser.GameObjects.Container | null = null;
  private goFlag: Phaser.GameObjects.Container | null = null;
  private cargo: Phaser.GameObjects.Container[] = [];
  private tallyDots: Phaser.GameObjects.Graphics[] = [];
  private cardViews: Array<{ value: number; root: Phaser.GameObjects.Container; zone: Phaser.GameObjects.Zone }> = [];
  private foodOrder: string[] = [];
  private foodCursor = 0;

  constructor() {
    super('PicnicScene');
  }

  create(): void {
    setAppScreen('picnic');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.content = this.context.content.picnic;
    const profileId = this.context.requireProfileId();
    const profile = this.context.store.getState().profiles.find((p) => p.id === profileId);
    const track = profile?.ageTrack ?? 'age5';
    const adaptive = this.content.adaptive;
    this.ageConfig = this.content.ageTracks[track];
    this.meta = buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules });
    this.skills = this.context.createSkillSession(this.content.world, this.content.id, this.meta);
    this.session = this.context.createLearningSession();
    this.session.start();
    this.plan = null;
    this.round = null;
    this.tracker = null;
    this.ready = false;
    this.helpOpen = false;
    this.speaking = false;
    this.linePlaying = false;
    this.lockedUntil = 0;
    this.trainRoot = null;
    this.passengers = new Map();
    this.zones = [];
    this.extras = [];
    this.cargo = [];
    this.tallyDots = [];
    this.cardViews = [];
    this.basket = null;
    this.basketItem = null;
    this.goFlag = null;
    this.token++;

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

    addBackground(this, this.scale.width, this.scale.height);
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startRound(true);
    window.__GAME_READY__ = true;
  }

  // -------------------------------------------------------------------------------------------
  // Hook data
  // -------------------------------------------------------------------------------------------

  getPicnicInfo(): PicnicInfo | null {
    const plan = this.plan;
    const round = this.round;
    if (!plan || !round || !this.layout) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const toPage = (r: LayoutRect) =>
      gameRectToPageRect(r, { x: box.left, y: box.top, width: box.width, height: box.height }, { width: this.scale.width, height: this.scale.height });
    const phase = round.phase;
    const overview = phase !== 'give' && phase !== 'depart';
    const { width, height } = this.scale;
    return {
      level: this.roundLevel,
      task: plan.task,
      lang: this.roundLang,
      size: plan.size,
      target: plan.target,
      phase,
      scaffold: plan.scaffoldKind,
      ghostItems: plan.scaffold.ghostItems,
      tally: plan.scaffold.tally,
      passengers: plan.passengers.map((p) => {
        const seat = this.layout.seats[p.seat];
        return {
          id: p.id,
          seat: p.seat,
          kind: p.kind,
          hasItem: round.hasItem(p.id),
          visible: seat.visible && !overview,
          hit: toPage(seat.hit),
        };
      }),
      nextFreeId: round.nextFreeId,
      basket: { hit: toPage(this.layout.basket.hit) },
      loaded: round.loaded,
      cargoHits: this.layout.shelf.slots.slice(0, round.loaded).map(toPage),
      go: plan.task === 'load' && phase === 'load' ? { hit: toPage(this.layout.go.hit) } : null,
      cards:
        phase === 'answer'
          ? cardRects(width, height, plan.size - 1).map((r, i) => ({ value: i + 1, hit: toPage(r) }))
          : null,
      tries: this.tries,
      hinted: this.tracker?.isHinted ?? false,
      ready: this.ready && !isLocked(this.time.now, this.lockedUntil) && phase !== 'depart',
    };
  }

  // -------------------------------------------------------------------------------------------
  // Lifecycle and chrome
  // -------------------------------------------------------------------------------------------

  private cleanup(): void {
    this.token++;
    this.hintTimer?.remove();
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
    this.plan = null;
    this.round = null;
    this.tracker = null;
    this.passengers = new Map();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
  }

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
    this.context.shell.clearPromptBubble();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    void this.say(HELP_LINE, HE_LINE_MAX_MS);
    this.context.shell.showHelp(PICNIC_LINE_TEXT[HELP_LINE.lineId] ?? '', () => {
      this.helpOpen = false;
      this.session.reportInteraction();
    });
  }

  // -------------------------------------------------------------------------------------------
  // Voice
  // -------------------------------------------------------------------------------------------

  /** Requests one line; resolves when it ends or after `maxMs`, whichever comes first. Never blocks forever. */
  private say(line: LineRequest, maxMs: number): Promise<void> {
    const seq = ++this.speakSeq;
    this.speaking = true;
    this.linePlaying = true;
    this.session.reportListening(true);
    const text = PICNIC_LINE_TEXT[line.lineId] ?? '';
    const played = this.context.audio.play({ lineId: line.lineId, lang: line.lang, text });
    const done = () => {
      if (seq === this.speakSeq) {
        this.speaking = false;
        this.session.reportListening(false);
      }
    };
    void played.finally(() => {
      if (seq === this.speakSeq) this.linePlaying = false;
      done();
    });
    return Promise.race([played.then(() => undefined), wait(this, maxMs)]).then(done);
  }

  private sayWord(n: number): Promise<void> {
    return this.say(numberLine(n, this.roundLang), WORD_LINE_MAX_MS);
  }

  private showAskBubble(): void {
    if (!this.plan) return;
    const line = askLine(this.plan);
    this.context.shell.setPromptBubble(rtlIsolate(PICNIC_LINE_TEXT[line.lineId] ?? ''), () => this.replayAsk());
  }

  // -------------------------------------------------------------------------------------------
  // Trains (one train = one adaptive trial = one round)
  // -------------------------------------------------------------------------------------------

  /**
   * Level timing: the train's level is read here, once per round, and the plan is fixed for the train. A level change
   * recorded during the train (right after a wrong tap or at the finish) is shown from the NEXT train.
   */
  private startRound(first: boolean): void {
    const token = ++this.token;
    this.hintTimer?.remove();
    this.ready = false;
    this.tries = 0;
    this.lockedUntil = 0;
    this.session.reportCelebrating(false);

    const settings = this.context.store.getState().settings;
    this.roundLang = nextRoundLanguage(first ? null : this.roundLang, this.skills.atRoundBoundary(this.roundLang), settings.languages);
    this.roundLevel = this.skills.level(this.roundLang);
    const levers = levelLevers(this.content.adaptive.levels[this.roundLevel - 1]);
    // The engine chooses the train size among the level's candidates (a known size right after a level drop).
    const sizeId = this.skills.selectNextItem(this.roundLang, trainSizeCandidates(levers.setSize));
    this.plan = buildTrain({ levers, sizeId, random: Math.random });
    this.round = new TrainRound(this.plan);
    this.tracker = new PicnicTrialTracker(sizeId, this.roundLang);
    this.foodOrder = this.shuffledFoods();
    this.foodCursor = 0;

    this.buildTrainScene();
    this.showAskBubble();
    void (async () => {
      const root = this.trainRoot;
      const target = this.round && this.round.phase === 'give' ? this.focusTransform().x : this.overviewTransform().x;
      if (root) await arriveTrain(this, root, target);
      if (token !== this.token) return;
      this.positionZones();
      this.ready = true;
      void this.say(askLine(this.plan!), HE_LINE_MAX_MS);
      this.scheduleHint(token);
    })();
  }

  private shuffledFoods(): string[] {
    const foods = [...PICNIC_FOODS];
    for (let i = foods.length - 1; i > 0; i--) {
      const j = Math.floor(Math.random() * (i + 1));
      [foods[i], foods[j]] = [foods[j], foods[i]];
    }
    return foods;
  }

  private nextFoodId(): string {
    return this.foodOrder[this.foodCursor % this.foodOrder.length];
  }

  /** Where the train sits while it is tapped: full size, panned to the focus seat. */
  private focusTransform(): { x: number; y: number; scale: number } {
    return { x: this.layout.originX - this.layout.offsetX, y: 0, scale: 1 };
  }

  /** Where the train sits while it is only looked at (load, answer): the whole train, scaled to fit the screen. */
  private overviewTransform(): { x: number; y: number; scale: number } {
    const { width } = this.scale;
    const scale = Math.min(1, (width - 32) / this.layout.contentWidth);
    return { x: (width - this.layout.contentWidth * scale) / 2, y: this.layout.trainTop * (1 - scale), scale };
  }

  private clearTrainScene(): void {
    for (const view of this.passengers.values()) view.character.destroy();
    this.passengers = new Map();
    this.trainRoot?.destroy(true);
    this.trainRoot = null;
    for (const z of this.zones) z.destroy();
    this.zones = [];
    for (const e of this.extras) e.destroy();
    this.extras = [];
    for (const c of this.cargo) c.destroy(true);
    this.cargo = [];
    for (const d of this.tallyDots) d.destroy();
    this.tallyDots = [];
    for (const card of this.cardViews) {
      card.root.destroy(true);
      card.zone.destroy();
    }
    this.cardViews = [];
    this.basket?.destroy(true);
    this.basket = null;
    this.basketItem?.destroy(true);
    this.basketItem = null;
    this.goFlag?.destroy(true);
    this.goFlag = null;
  }

  private addZone(rect: LayoutRect, onTap: () => void): Phaser.GameObjects.Zone {
    const zone = this.add.zone(rect.x + rect.width / 2, rect.y + rect.height / 2, rect.width, rect.height).setDepth(70);
    zone.setInteractive();
    zone.on('pointerdown', onTap);
    this.zones.push(zone);
    return zone;
  }

  private buildTrainScene(): void {
    this.clearTrainScene();
    const plan = this.plan!;
    const round = this.round!;
    const { width, height } = this.scale;
    const first = plan.passengers.find((p) => p.id === round.nextFreeId) ?? plan.passengers[0];
    this.layout = computePicnicLayout(width, height, { seatCount: plan.seatCount, focusSeat: first.seat });
    const layout = this.layout;

    // The train: pieces, empty seats, passengers, items.
    const root = this.add.container(0, 0).setDepth(DEPTH.train);
    this.trainRoot = root;
    for (const piece of layout.pieces) {
      root.add(makeTrainPiece(this, piece, layout.trainHeight).setPosition(piece.x, layout.trainTop));
    }
    const seated = new Set(plan.passengers.map((p) => p.seat));
    layout.seats.forEach((seat) => {
      if (seated.has(seat.index)) return;
      const key = 'train-seat-outline';
      if (this.textures.exists(key)) {
        root.add(this.add.image(seat.cx, seat.feetY + 8, key).setOrigin(0.5, 1).setDisplaySize(layout.passengerHeight * 0.9, layout.passengerHeight * 1.02).setAlpha(0.8));
      }
    });

    for (const p of plan.passengers) {
      const seat = layout.seats[p.seat];
      const character = new Character(this, { kind: p.kind, x: seat.cx, y: seat.feetY, displayHeight: layout.passengerHeight });
      root.add(character.root);
      const zone = this.addZone(seat.hit, () => this.onPassengerTap(p.id));
      const view: PassengerView = { plan: p, character, zone, held: null, ghost: null };
      this.passengers.set(p.id, view);
      if (round.hasItem(p.id)) {
        view.held = this.addHeldItem(view, this.nextFoodId());
        this.foodCursor++;
      } else if (plan.scaffold.ghostItems) {
        const ghost = makeGhostItem(this, HELD_ITEM_SIZE + 8);
        ghost.setPosition(seat.cx, seat.feetY - layout.passengerHeight - 38);
        root.add(ghost);
        view.ghost = ghost;
      }
    }

    // Basket (the item source) and its current item.
    const b = layout.basket;
    this.basket = makeBasket(this, b.width).setPosition(b.x, b.y).setDepth(DEPTH.basket);
    this.addZone(b.hit, () => this.onBasketTap());
    this.basketItem = makeFood(this, this.nextFoodId(), 76).setPosition(b.x, b.y - b.height * 0.2).setDepth(DEPTH.basketItem);
    void popIn(this, this.basketItem, 200);

    if (plan.task === 'load') {
      layout.shelf.slots.forEach((slot, i) => {
        const g = makeShelfSlot(this, slot.width).setPosition(slot.x + slot.width / 2, slot.y + slot.height / 2).setDepth(DEPTH.shelf);
        this.extras.push(g);
        this.addZone(slot, () => this.onSlotTap(i));
      });
      const go = layout.go;
      this.goFlag = makeGoFlag(this, go.width).setPosition(go.x, go.y).setDepth(DEPTH.basket);
      this.addZone(go.hit, () => this.onGoTap());
    }

    // Transform: tapped trains are shown full size and panned; looked-at trains are shown whole.
    const t = round.phase === 'give' ? this.focusTransform() : this.overviewTransform();
    root.setPosition(width + 300, t.y).setScale(t.scale);
    this.refreshTally();
    if (round.phase === 'answer') this.buildCards();
  }

  private addHeldItem(view: PassengerView, foodId: string): Phaser.GameObjects.Container {
    const seat = this.layout.seats[view.plan.seat];
    const item = makeFood(this, foodId, HELD_ITEM_SIZE);
    item.setPosition(seat.cx, seat.feetY - this.layout.passengerHeight * 0.2);
    this.trainRoot?.add(item);
    return item;
  }

  /** Keeps the passenger tap zones on their (panned) rectangles. */
  private positionZones(): void {
    for (const view of this.passengers.values()) {
      const hit = this.layout.seats[view.plan.seat].hit;
      view.zone.setPosition(hit.x + hit.width / 2, hit.y + hit.height / 2);
      view.zone.setSize(hit.width, hit.height);
    }
  }

  private refreshTally(): void {
    for (const d of this.tallyDots) d.destroy();
    this.tallyDots = [];
    const plan = this.plan;
    const round = this.round;
    if (!plan || !round || plan.scaffold.tally === null) return;
    const n = plan.scaffold.tally;
    const filled = plan.task === 'load' ? round.loaded : round.servedCount;
    const { width, height } = this.scale;
    const y = trainBand(width, height).below - 22;
    const gap = 30;
    const left = width / 2 - ((n - 1) * gap) / 2;
    for (let i = 0; i < n; i++) {
      const dot = makeTallyDot(this, i < filled).setPosition(left + i * gap, y).setDepth(DEPTH.tally);
      this.tallyDots.push(dot);
    }
  }

  private buildCards(): void {
    const plan = this.plan!;
    const { width, height } = this.scale;
    const rects = cardRects(width, height, plan.size - 1);
    rects.forEach((rect, i) => {
      const value = i + 1;
      const root = makeNumberCard(this, value, rect.width).setPosition(rect.x + rect.width / 2, rect.y + rect.height / 2).setDepth(DEPTH.basket);
      const zone = this.addZone(rect, () => this.onCardTap(value));
      this.cardViews.push({ value, root, zone });
      void popIn(this, root, 80 + i * 40);
    });
  }

  // -------------------------------------------------------------------------------------------
  // Idle hint (age 2) and replay
  // -------------------------------------------------------------------------------------------

  private scheduleHint(token: number): void {
    this.hintTimer?.remove();
    this.hintTimer = undefined;
    if (this.ageConfig.hintMode !== 'demonstrate') return; // age 5: no idle hint (hint only after a mistake)
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(token));
  }

  private giveHint(token: number): void {
    const round = this.round;
    const tracker = this.tracker;
    if (token !== this.token || !round || !tracker || !this.ready || tracker.isRecorded || round.phase === 'depart') return;
    if (tracker.isHinted) return; // one idle hint per train
    if (this.helpOpen || this.speaking || this.linePlaying) {
      // Wait out a playing line or the open help card, then retry after another hintDelayMs.
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(token));
      return;
    }
    this.hintTimer = undefined;
    tracker.onHint();
    this.context.sfx.hint();
    if (round.phase === 'give') {
      const view = round.nextFreeId ? this.passengers.get(round.nextFreeId) : undefined;
      if (view) {
        void this.pulse(view.character.root, view.character.root.scaleX);
        const seat = this.layout.seats[view.plan.seat];
        Juice.for(this).burst('sparkle', seat.pageCx, seat.feetY - this.layout.passengerHeight * 0.5);
      }
      if (this.basketItem) void bounce(this, this.basketItem, 40);
    } else if (round.phase === 'load') {
      const target = this.plan && round.loaded < this.plan.target ? this.basket : this.goFlag;
      if (target) void this.pulse(target, 1);
    } else if (round.phase === 'answer') {
      const card = this.cardViews.find((c) => c.value === this.plan?.target);
      if (card) void this.pulse(card.root, 1);
    }
    void this.say(askLine(this.plan!), HE_LINE_MAX_MS);
  }

  private pulse(target: Phaser.GameObjects.Container, restScale: number): Promise<void> {
    return hintPulse(this, target, restScale);
  }

  private replayAsk(): void {
    this.session.reportInteraction();
    if (!this.plan) return;
    this.tracker?.onReplay();
    void this.say(askLine(this.plan), HE_LINE_MAX_MS);
    // A replay is activity: restart the idle-hint countdown (age 2, before the trial's hint or result).
    if (this.ready && this.tracker && !this.tracker.isHinted && !this.tracker.isRecorded) this.scheduleHint(this.token);
  }

  // -------------------------------------------------------------------------------------------
  // Taps
  // -------------------------------------------------------------------------------------------

  private acceptingTaps(): boolean {
    const round = this.round;
    return Boolean(round && this.tracker && this.ready && round.phase !== 'depart' && !isLocked(this.time.now, this.lockedUntil));
  }

  /** A wrong tap: counted once, recorded as the train's miss (first time only), locks taps for 400 ms. */
  private registerMistake(): void {
    this.tries++;
    this.lockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    const result = this.tracker?.onMistake();
    if (result) this.skills.record(this.roundLang, result);
    this.context.sfx.hint();
  }

  private onBasketTap(): void {
    if (!this.acceptingTaps()) return;
    const round = this.round!;
    if (round.phase !== 'load') {
      // Give and answer phases: the basket repeats the instruction (a voluntary replay, never a hint).
      this.replayAsk();
      return;
    }
    this.session.reportInteraction();
    this.context.sfx.tap();
    const out = round.load();
    if (out.kind === 'full') {
      if (this.basket) void bounce(this, this.basket, 14);
      return;
    }
    if (out.kind !== 'loaded') return;
    this.scheduleHint(this.token);
    const slot = this.layout.shelf.slots[out.count - 1];
    const item = this.flyBasketItemTo(slot.x + slot.width / 2, slot.y + slot.height / 2, slot.width * 0.84);
    this.cargo.push(item);
    this.refreshTally();
    void this.sayWord(out.count);
  }

  /** Copies the current basket item and flies the copy to a point; returns the copy (depth DEPTH.cargo). */
  private flyBasketItemTo(toX: number, toY: number, size: number): Phaser.GameObjects.Container {
    const b = this.layout.basket;
    const item = makeFood(this, this.nextFoodId(), 76).setPosition(b.x, b.y - b.height * 0.2).setDepth(DEPTH.flying);
    this.foodCursor++;
    this.refreshBasketItem();
    const scale = size / 76;
    void handOutItem(this, item, toX, toY).then(() => {
      if (item.scene) {
        item.setDepth(DEPTH.cargo).setScale(scale);
      }
    });
    return item;
  }

  private refreshBasketItem(): void {
    if (!this.basketItem || !this.basket) return;
    const b = this.layout.basket;
    this.basketItem.destroy(true);
    this.basketItem = makeFood(this, this.nextFoodId(), 76).setPosition(b.x, b.y - b.height * 0.2).setDepth(DEPTH.basketItem);
    void popIn(this, this.basketItem, 120);
  }

  private onSlotTap(index: number): void {
    if (!this.acceptingTaps()) return;
    const round = this.round!;
    if (round.phase !== 'load' || index >= round.loaded) return;
    this.session.reportInteraction();
    this.context.sfx.tap();
    const count = round.unload();
    if (count === null) return;
    this.scheduleHint(this.token);
    const item = this.cargo.pop();
    if (item) this.returnToBasket(item);
    this.refreshTally();
  }

  private returnToBasket(item: Phaser.GameObjects.Container): void {
    const b = this.layout.basket;
    item.setDepth(DEPTH.flying);
    void handOutItem(this, item, b.x, b.y - b.height * 0.2).then(() => item.destroy(true));
  }

  private onGoTap(): void {
    if (!this.acceptingTaps()) return;
    const round = this.round!;
    if (round.phase !== 'load') return;
    this.session.reportInteraction();
    this.context.sfx.tap();
    const out = round.go();
    if (out.kind === 'ready') {
      void this.finishTrain(this.token);
      return;
    }
    if (out.kind !== 'wrong') return;
    // Wrong count: the cargo goes back to the basket and she can try again. Counting again slowly is shown by the
    // returning items; the first wrong go records the miss.
    this.registerMistake();
    const items = this.cargo.splice(0);
    items.forEach((item, i) => {
      this.time.delayedCall(i * 70, () => {
        if (item.scene) this.returnToBasket(item);
      });
    });
    this.refreshTally();
    if (this.goFlag) void this.pulse(this.goFlag, 1);
    void this.say(WRONG_COUNT_LINE, HE_LINE_MAX_MS);
    this.scheduleHint(this.token);
  }

  private onCardTap(value: number): void {
    if (!this.acceptingTaps()) return;
    const round = this.round!;
    if (round.phase !== 'answer') return;
    this.session.reportInteraction();
    this.context.sfx.tap();
    const out = round.answer(value);
    if (out.kind === 'wrong') {
      this.registerMistake();
      // Hint: the passengers who still have no item pulse, so she can count them.
      for (const view of this.passengers.values()) {
        if (!round.hasItem(view.plan.id)) void this.pulse(view.character.root, view.character.root.scaleX);
      }
      void this.say(WRONG_COUNT_LINE, HE_LINE_MAX_MS);
      this.scheduleHint(this.token);
      return;
    }
    if (out.kind !== 'right') return;
    void this.openGivePhase(this.token, out.missing);
  }

  /** After the right number card: the cards leave, the train zooms in, the missing count is said, then the child gives. */
  private async openGivePhase(token: number, missing: number): Promise<void> {
    this.ready = false;
    this.hintTimer?.remove();
    const cards = this.cardViews;
    this.cardViews = [];
    for (const c of cards) {
      c.zone.destroy();
      this.zones = this.zones.filter((z) => z !== c.zone);
      void popOut(this, c.root).then(() => c.root.destroy(true));
    }
    await this.refocus(token);
    if (token !== this.token) return;
    await this.say(numberLine(missing, this.roundLang), WORD_LINE_MAX_MS);
    if (token !== this.token) return;
    await this.say(MISSING_GIVE_LINE, HE_LINE_MAX_MS);
    if (token !== this.token) return;
    this.ready = true;
    this.scheduleHint(token);
  }

  private onPassengerTap(id: string): void {
    if (!this.acceptingTaps()) return;
    const round = this.round!;
    if (round.phase !== 'give') return;
    this.session.reportInteraction();
    this.context.sfx.tap();
    const out = round.tapPassenger(id);
    const view = this.passengers.get(id);
    if (!view) return;
    if (out.kind === 'already') {
      this.registerMistake();
      void view.character.hmm();
      const free = round.nextFreeId ? this.passengers.get(round.nextFreeId) : undefined;
      if (free) {
        void this.pulse(free.character.root, free.character.root.scaleX);
        if (free.ghost) void this.pulse(free.ghost, 1);
      }
      void this.say(WRONG_GIVEN_LINE, HE_LINE_MAX_MS);
      this.scheduleHint(this.token);
      return;
    }
    if (out.kind !== 'given') return;
    void this.giveTo(view, out.count, out.done);
  }

  private async giveTo(view: PassengerView, count: number, done: boolean): Promise<void> {
    const token = this.token;
    this.ready = false;
    this.hintTimer?.remove();
    const seat = this.layout.seats[view.plan.seat];
    const b = this.layout.basket;
    const foodId = this.nextFoodId();
    const flying = makeFood(this, foodId, 76).setPosition(b.x, b.y - b.height * 0.2).setDepth(DEPTH.flying);
    this.foodCursor++;
    this.refreshBasketItem();
    await handOutItem(this, flying, seat.pageCx, seat.feetY - this.layout.passengerHeight * 0.2);
    flying.destroy(true);
    if (token !== this.token) return;
    view.ghost?.destroy(true);
    view.ghost = null;
    view.held = this.addHeldItem(view, foodId);
    void popIn(this, view.held, 0);
    this.context.sfx.pop();
    void view.character.happy();
    this.refreshTally();
    if (done) {
      await this.sayWord(count);
      if (token !== this.token) return;
      await this.finishTrain(token);
      return;
    }
    void this.sayWord(count);
    await this.refocus(token);
    if (token !== this.token) return;
    this.ready = true;
    this.scheduleHint(token);
  }

  /** Pans (or zooms in from the overview) so the next free passenger is on screen and tappable. */
  private async refocus(token: number): Promise<void> {
    const plan = this.plan;
    const round = this.round;
    const root = this.trainRoot;
    if (!plan || !round || !root) return;
    const next = plan.passengers.find((p) => p.id === round.nextFreeId);
    const focusSeat = next ? next.seat : plan.passengers[0].seat;
    this.layout = computePicnicLayout(this.scale.width, this.scale.height, {
      seatCount: plan.seatCount,
      focusSeat,
      currentOffsetX: root.scaleX === 1 ? this.layout.offsetX : undefined,
    });
    const t = this.focusTransform();
    const moving = Math.abs(root.x - t.x) > 0.5 || Math.abs(root.y - t.y) > 0.5 || root.scaleX !== 1;
    if (moving) {
      await tweenAsync(this, { targets: root, x: t.x, y: t.y, scaleX: 1, scaleY: 1, duration: 280, ease: 'Sine.easeInOut' });
      if (token !== this.token) return;
    }
    this.positionZones();
  }

  // -------------------------------------------------------------------------------------------
  // Train ready
  // -------------------------------------------------------------------------------------------

  private async finishTrain(token: number): Promise<void> {
    this.ready = false;
    this.hintTimer?.remove();
    const result = this.tracker?.onComplete();
    if (result) this.skills.record(this.roundLang, result);
    this.session.complete();
    this.context.recordCompletedRound('number-garden', 'picnic-train');
    this.session.reportCelebrating(true);
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    this.context.shell.updateRestaurantChrome({ starCount: state.stars });
    this.context.sfx.yay();
    const juice = Juice.for(this);
    juice.burst('confetti', this.scale.width / 2, this.scale.height * 0.35);
    for (const view of this.passengers.values()) void view.character.happy();
    await this.say(READY_LINE, HE_LINE_MAX_MS);
    if (token !== this.token) return;

    // The train sets off: it slides out of the screen (basic animation; Pass 2 adds the chug and steam).
    const root = this.trainRoot;
    if (root) await arriveTrain(this, root, -(this.layout.contentWidth + 400));
    if (token !== this.token) return;
    this.session.reportCelebrating(false);
    await wait(this, ROUND_END_HOLD_MS);
    if (token !== this.token) return;
    this.startRound(false);
  }
}

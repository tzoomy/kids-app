import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig } from '../../content/schema';
import { colorOf } from '../../assets/colors';
import { Juice, fxTextureKey } from '../../anim/juice';
import { ANIM_PROFILE } from '../../anim/profiles';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { floatIdle, flyArc, hintPulse, pressSquash, tweenAsync, wait, wobble } from '../../anim/tweens';
import { sceneArtKey } from '../../anim/artRegistry';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { TrialTracker, nextRoundLanguage } from '../restaurant/trialTracker';
import { crossedWholeMinute, shouldPraise, shouldSayRetry } from '../restaurant/voiceRules';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import { gameRectToPageRect, type Rect as PageRect } from '../../testing/pageRect';
import { balloonLevel, buildBalloonRound, eligibleItemIds, isCorrectBalloon, type BalloonChoice, type BalloonRoundSpec } from './balloonRound';
import { BOB_DISTANCE, computeBalloonLayout, type BalloonLayout, type BalloonSlot } from './balloonLayout';
import type { BalloonInfo } from './types';

interface BalloonView {
  choice: BalloonChoice;
  slot: BalloonSlot;
  root: Phaser.GameObjects.Container;
  zone: Phaser.GameObjects.Zone;
  bob?: Phaser.Tweens.Tween;
}

interface ActiveRound extends BalloonRoundSpec {
  done: boolean;
  tries: number;
  tracker: TrialTracker;
  levelNo: number;
  skillKey: string;
}

/** Balloon taps are ignored this long after a wrong tap, so a double tap counts as one try. */
const WRONG_TAP_LOCK_MS = 400;
/** While the intro or help is speaking, a pending hint looks again after this delay. */
const HINT_DEFER_POLL_MS = 300;
/** Pause after a wrong tap so the wobble reads before the retry speech. */
const HINT_AFTER_WOBBLE_MS = 450;
const POPPED_MAX_WAIT_MS = 2200;
const FOLLOWUP_MAX_WAIT_MS = 3500;
const RISE_MS = 700;
const RISE_STAGGER_MS = 110;
const OUTLINE = 0x3b2a22;

const DEPTH = { background: -10, balloon: 10, zone: 100, ui: 200, flying: 300 } as const;

const INTRO_LINE_ID = 'he.balloon.intro';
const HELP_LINE_ID = 'he.balloon.help';

export class BalloonScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private ageConfig!: AgeTrackConfig;
  private skills!: SkillSession;
  private roundLang: Lang | null = null;
  private layout!: BalloonLayout;
  private round: ActiveRound | null = null;
  private balloons: BalloonView[] = [];
  private replayButton?: Phaser.GameObjects.Container;
  private ready = false;
  private hinted = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private retryTimer?: Phaser.Time.TimerEvent;
  private inputLockedUntil = 0;
  private visibilityHandler?: () => void;
  private roundToken = 0;
  private lastTargetId = '';
  private helpOpen = false;
  private introPending = true;
  private introPlaying = false;
  private helpPlaying = false;
  /** A trial was answered while the help card was open; the next one starts when it closes. */
  private advancePending = false;
  private correctCount = 0;
  private lastBalanceSec = 0;
  private earnedPending = false;
  private speakSeq = 0;

  constructor() {
    super('BalloonScene');
  }

  create(): void {
    setAppScreen('balloon');
    this.context = this.game.registry.get('appContext') as AppContext;
    const content = this.context.content.balloon;
    const adaptive = content.adaptive;
    this.ageConfig = content.ageTracks[this.context.currentAgeTrack()];
    this.skills = this.context.createSkillSession(
      content.world,
      content.id,
      buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    );
    this.roundLang = null;
    this.round = null;
    this.balloons = [];
    this.replayButton = undefined;
    this.ready = false;
    this.hinted = false;
    this.helpOpen = false;
    this.introPending = true;
    this.introPlaying = false;
    this.helpPlaying = false;
    this.advancePending = false;
    this.correctCount = 0;
    this.earnedPending = false;
    this.speakSeq = 0;
    this.inputLockedUntil = 0;
    this.retryTimer = undefined;
    this.hintTimer = undefined;
    this.lastTargetId = '';

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
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.buildHud();
    this.lastBalanceSec = this.profileState().balanceSec;
    this.startRound();

    window.__GAME_READY__ = true;
  }

  private cleanup(): void {
    this.roundToken++;
    this.round = null;
    this.clearBalloons();
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
  }

  private paintBackground(): void {
    const w = this.scale.width;
    const h = this.scale.height;
    const key = sceneArtKey('number-garden', w >= h ? 'bg-landscape' : 'bg-portrait');
    if (key && this.textures.exists(key)) {
      this.add.image(w / 2, h / 2, key).setDisplaySize(w, h).setDepth(DEPTH.background);
      return;
    }
    this.cameras.main.setBackgroundColor('#b8e6ff');
    this.add.rectangle(w / 2, h * 0.9, w, h * 0.2, 0x8ae07e).setDepth(DEPTH.background);
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
    if (crossedWholeMinute(this.lastBalanceSec, state.balanceSec)) this.earnedPending = true;
    this.lastBalanceSec = state.balanceSec;
  }

  private goBack(): void {
    this.context.audio.stopAll();
    this.context.store.persist();
    this.context.shell.clearPromptBubble();
    transitionTo(this, 'MapScene', { style: 'iris' });
  }

  private toPageRect(x: number, y: number, width: number, height: number): PageRect {
    const box = this.game.canvas.getBoundingClientRect();
    return gameRectToPageRect(
      { x, y, width, height },
      { x: box.left, y: box.top, width: box.width, height: box.height },
      { width: this.scale.width, height: this.scale.height },
    );
  }

  private speakerAvoidRect(): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.layout) return undefined;
    const { x, y, radius } = this.layout.replay;
    return this.toPageRect(x - radius, y - radius, radius * 2, radius * 2);
  }

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    this.hintTimer?.remove();
    const content = this.context.content.balloon;
    const seq = ++this.speakSeq;
    this.introPlaying = false;
    this.helpPlaying = true;
    this.session.reportListening(true);
    void this.context.audio.play({ lineId: HELP_LINE_ID, lang: 'he', text: content.helpTextHe }).finally(() => {
      if (seq !== this.speakSeq) return;
      this.helpPlaying = false;
      this.session.reportListening(false);
      if (!this.helpOpen) this.scheduleIdleHint();
    });
    this.context.shell.showHelp(
      content.helpTextHe,
      () => {
        this.helpOpen = false;
        this.helpPlaying = false;
        this.session.reportInteraction();
        if (this.advancePending) {
          this.advancePending = false;
          this.startRound();
          return;
        }
        this.scheduleIdleHint();
        if (this.round && !this.round.done && this.ready) void this.speakPrompt();
      },
      this.speakerAvoidRect(),
    );
  }

  // ---------------------------------------------------------------- round

  private startRound(): void {
    const token = ++this.roundToken;
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.clearBalloons();
    this.hintTimer?.remove();
    this.retryTimer?.remove();
    this.retryTimer = undefined;
    this.inputLockedUntil = 0;
    this.ready = false;
    this.hinted = false;

    const content = this.context.content.balloon;
    const settings = this.context.store.getState().settings;
    // One round = trialsPerRound trials in the same language, so each round feeds one skill.
    this.roundLang = nextRoundLanguage(
      this.roundLang,
      this.roundLang === null || this.skills.atRoundBoundary(this.roundLang),
      settings.languages,
    );
    const language = this.roundLang;
    const levelNumber = this.skills.level(language);
    const descriptor = content.adaptive.levels[levelNumber - 1];
    const ids = eligibleItemIds(content, balloonLevel(descriptor));
    // The engine picks the item; avoid the same request twice in a row when there is a choice.
    const candidates = ids.length > 1 ? ids.filter((id) => id !== this.lastTargetId) : ids;
    const targetId = this.skills.selectNextItem(language, candidates);
    this.lastTargetId = targetId;
    const spec = buildBalloonRound(content, descriptor, language, targetId);
    this.round = {
      ...spec,
      done: false,
      tries: 0,
      tracker: new TrialTracker(spec.targetItemId, language),
      levelNo: levelNumber,
      skillKey: this.skills.key(language),
    };

    this.layout = computeBalloonLayout(this.scale.width, this.scale.height, spec.choices.length);
    this.buildReplayButton();
    const rises = spec.choices.map((choice, i) => this.buildBalloon(choice, this.layout.balloons[i], i));
    this.context.shell.setPromptBubble(spec.promptText, () => this.replay());

    void Promise.all(rises).then(() => {
      if (token !== this.roundToken || !this.round || this.round.done) return;
      this.ready = true;
      const intro = this.introPending ? { lineId: INTRO_LINE_ID, lang: 'he' as const, text: content.introHe } : undefined;
      this.introPending = false;
      void this.speakPrompt(intro);
      if (!intro) this.scheduleIdleHint();
    });
  }

  private clearBalloons(): void {
    for (const b of this.balloons) {
      b.bob?.stop();
      this.tweens.killTweensOf(b.root);
      b.root.destroy();
      b.zone.destroy();
    }
    this.balloons = [];
    if (this.replayButton) this.tweens.killTweensOf(this.replayButton);
    this.replayButton?.destroy();
    this.replayButton = undefined;
  }

  /** Simple-shape balloon (Pass 1): string, body, knot, highlight, and the numeral on digit levels. */
  private drawBalloon(choice: BalloonChoice, slot: BalloonSlot): Phaser.GameObjects.Container {
    const { rx, ry, stringLength } = slot;
    const g = this.add.graphics();
    g.lineStyle(3, OUTLINE, 0.8);
    g.beginPath();
    g.moveTo(0, ry + 8);
    g.lineTo(-6, ry + 8 + stringLength * 0.5);
    g.lineTo(4, ry + 8 + stringLength);
    g.strokePath();
    const fill = colorOf(choice.color);
    g.fillStyle(fill, 1);
    g.lineStyle(6, OUTLINE, 1);
    g.fillEllipse(0, 0, rx * 2, ry * 2);
    g.strokeEllipse(0, 0, rx * 2, ry * 2);
    g.fillTriangle(-10, ry + 10, 10, ry + 10, 0, ry - 4);
    g.lineStyle(4, OUTLINE, 1);
    g.strokeTriangle(-10, ry + 10, 10, ry + 10, 0, ry - 4);
    g.fillStyle(0xffffff, 0.45);
    g.fillEllipse(-rx * 0.38, -ry * 0.42, rx * 0.34, ry * 0.42);
    const parts: Phaser.GameObjects.GameObject[] = [g];
    if (choice.label !== null) {
      const text = this.add
        .text(0, 0, choice.label, {
          fontFamily: '"Noto Sans", sans-serif',
          fontSize: `${Math.round(ry * 1.05)}px`,
          fontStyle: 'bold',
          color: '#3b2a22',
        })
        .setOrigin(0.5, 0.52);
      parts.push(text);
    }
    return this.add.container(slot.x, slot.y, parts).setDepth(DEPTH.balloon + slot.row);
  }

  /** One balloon; resolves once it has risen into place. */
  private buildBalloon(choice: BalloonChoice, slot: BalloonSlot, index: number): Promise<void> {
    const root = this.drawBalloon(choice, slot);
    const hit = slot.hit;
    const zone = this.add
      .zone((hit.left + hit.right) / 2, (hit.top + hit.bottom) / 2, hit.right - hit.left, hit.bottom - hit.top)
      .setDepth(DEPTH.zone)
      .setInteractive({ useHandCursor: true });
    const view: BalloonView = { choice, slot, root, zone };
    zone.on('pointerdown', () => this.choose(view));
    this.balloons.push(view);

    root.y = this.layout.riseFromY + slot.row * 120;
    const delay = 80 + index * Math.max(RISE_STAGGER_MS, ANIM_PROFILE.popIn.stagger);
    return tweenAsync(this, { targets: root, y: slot.y, delay, duration: isReducedMotion() ? 250 : RISE_MS, ease: 'Back.easeOut' }).then(() => {
      if (root.scene) view.bob = floatIdle(this, root, BOB_DISTANCE, 1500 + index * 120);
    });
  }

  private buildReplayButton(): void {
    const { x, y, radius } = this.layout.replay;
    const circle = this.add.circle(0, 0, radius, 0xffffff).setStrokeStyle(5, OUTLINE);
    const g = this.add.graphics();
    g.fillStyle(OUTLINE, 1);
    g.fillRect(-20, -9, 12, 18);
    g.fillTriangle(-8, -9, 8, -22, 8, 22);
    g.fillTriangle(-8, 9, 8, -22, 8, 22);
    g.lineStyle(4, OUTLINE, 1);
    g.beginPath();
    g.arc(10, 0, 11, -0.9, 0.9);
    g.strokePath();
    g.beginPath();
    g.arc(10, 0, 21, -0.9, 0.9);
    g.strokePath();
    const button = this.add.container(x, y, [circle, g]).setDepth(DEPTH.ui);
    button.setInteractive(new Phaser.Geom.Circle(0, 0, radius), Phaser.Geom.Circle.Contains);
    if (button.input) button.input.cursor = 'pointer';
    button.on('pointerdown', () => {
      void pressSquash(this, button);
      this.replay();
    });
    this.replayButton = button;
  }

  /** A voluntary replay (speaker or prompt bubble). It is not a hint and never touches the tracker. */
  private replay(): void {
    if (!this.round || this.round.done || !this.ready || this.helpOpen) return;
    this.session.reportInteraction();
    void this.speakPrompt();
  }

  /** Speaks the request (device TTS for EN/FR), optionally after one Hebrew line. A newer call supersedes an older one. */
  private async speakPrompt(before?: SpeechRequest): Promise<void> {
    if (!this.round || this.helpOpen) return;
    const seq = ++this.speakSeq;
    const round = this.round;
    this.session.reportListening(true);
    try {
      if (before) {
        this.introPlaying = before.lineId === INTRO_LINE_ID;
        try {
          await this.context.audio.play(before);
        } finally {
          if (seq === this.speakSeq) this.introPlaying = false;
        }
        if (seq !== this.speakSeq || round.done || this.round !== round) {
          if (seq === this.speakSeq) this.session.reportListening(false);
          return;
        }
        if (before.lineId === INTRO_LINE_ID) this.scheduleIdleHint();
      }
      await this.context.audio.play({ lineId: round.lineId, lang: round.language, text: round.promptText });
    } finally {
      if (seq === this.speakSeq) this.session.reportListening(false);
    }
  }

  getBalloonInfo(): BalloonInfo | null {
    if (!this.round || this.round.done) return null;
    const round = this.round;
    const { x, y, radius } = this.layout.replay;
    return {
      mode: round.level.mode,
      level: round.levelNo,
      language: round.language,
      skillKey: round.skillKey,
      targetItemId: round.targetItemId,
      promptText: round.promptText,
      balloons: this.balloons.map((b) => ({
        itemId: b.choice.itemId,
        color: b.choice.color,
        label: b.choice.label,
        hit: this.toPageRect(b.slot.hit.left, b.slot.hit.top, b.slot.hit.right - b.slot.hit.left, b.slot.hit.bottom - b.slot.hit.top),
      })),
      replay: this.toPageRect(x - radius, y - radius, radius * 2, radius * 2),
      tries: round.tries,
      hinted: this.hinted,
      correctCount: this.correctCount,
      ready: this.ready,
    };
  }

  // ---------------------------------------------------------------- hints and taps

  /** Start (or restart) the age-2 idle auto-hint clock from now. */
  private scheduleIdleHint(): void {
    if (this.ageConfig.hintMode !== 'demonstrate') return;
    if (!this.round || this.round.done || !this.ready) return;
    if (this.helpOpen || this.introPlaying || this.helpPlaying) return;
    this.hintTimer?.remove();
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
  }

  private giveHint(before?: SpeechRequest): void {
    const round = this.round;
    if (!round || round.done) return;
    // Do not talk over the intro or the help; look again shortly, so a wrong tap during them still gets
    // its retry line and hint. (retryTimer, not hintTimer: the intro's end restarts the idle clock.)
    if (this.helpOpen || this.introPlaying || this.helpPlaying) {
      this.retryTimer?.remove();
      this.retryTimer = this.time.delayedCall(HINT_DEFER_POLL_MS, () => this.giveHint(before));
      return;
    }
    // One hint at a time: a hint after a wrong tap also cancels the pending idle hint.
    this.hintTimer?.remove();
    round.tracker.onHint();
    if (round.tries === 0) this.hinted = true;
    const view = this.balloons.find((b) => isCorrectBalloon(b.choice.itemId, round.targetItemId));
    if (view) {
      void hintPulse(this, view.root, 1);
      Juice.for(this).burst('sparkle', view.slot.x, view.slot.y - view.slot.ry);
    }
    this.context.sfx.hint();
    // After the hinted prompt, restart the age-2 idle clock so an idle child keeps getting hints.
    void this.speakPrompt(before).then(() => {
      if (this.round === round && !round.done) this.scheduleIdleHint();
    });
  }

  private retryLine(): SpeechRequest {
    // Only the generic retry clips; retry.2 talks about an animal.
    return heLine(Math.random() < 0.5 ? 'retry.0' : 'retry.1');
  }

  private choose(view: BalloonView): void {
    const round = this.round;
    if (!round || round.done || !this.ready) return;
    if (this.time.now < this.inputLockedUntil) return;
    this.session.reportInteraction();

    const correct = isCorrectBalloon(view.choice.itemId, round.targetItemId);
    const result = round.tracker.onPlateTap(correct, 0);
    if (result) this.skills.record(round.language, result);

    if (correct) {
      round.done = true;
      this.hintTimer?.remove();
      this.retryTimer?.remove();
      void this.onCorrect(view);
      return;
    }

    round.tries++;
    // The wrong tap gets its own retry/hint below; drop the pending idle hint so it cannot fire twice.
    this.hintTimer?.remove();
    this.inputLockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    void wobble(this, view.root);
    const token = this.roundToken;
    const retry = shouldSayRetry(round.tries) ? this.retryLine() : undefined;
    const later = (fn: () => void) => {
      this.retryTimer?.remove();
      this.retryTimer = this.time.delayedCall(HINT_AFTER_WOBBLE_MS, () => {
        if (token === this.roundToken && this.round && !this.round.done) fn();
      });
    };
    if (this.ageConfig.hintMode === 'demonstrate') {
      this.context.sfx.tap();
      later(() => this.giveHint(retry));
    } else {
      this.context.sfx.hint();
      if (round.tries >= 2) later(() => this.giveHint());
      else later(() => void this.speakPrompt(retry));
    }
  }

  // ---------------------------------------------------------------- success

  private async onCorrect(view: BalloonView): Promise<void> {
    const token = this.roundToken;
    const alive = () => token === this.roundToken;
    const round = this.round!;
    const juice = Juice.for(this);
    const { x, y } = view.root;

    this.context.sfx.pop();
    this.context.sfx.yay();
    this.speakSeq++;
    this.correctCount++;
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();

    for (const b of this.balloons) b.zone.disableInteractive();
    view.bob?.stop();
    juice.burst('confetti', x, y);
    juice.burst('star', x, y);
    this.flyStarToCounter(x, y);
    const popped = tweenAsync(this, { targets: view.root, scale: 1.35, alpha: 0, duration: 220, ease: 'Quad.easeOut' });
    // The other balloons drift away up.
    this.balloons.forEach((b, i) => {
      if (b === view) return;
      b.bob?.stop();
      void tweenAsync(this, { targets: b.root, y: -260, delay: 150 + i * 60, duration: 1200, ease: 'Sine.easeIn' });
    });

    const lang = round.language;
    const lines = this.context.content.balloon.popped[lang];
    const index = Math.floor(Math.random() * lines.length);
    const line = this.context.audio.play({ lineId: `balloon.popped.${lang}.${index}`, lang, text: lines[index] });
    await popped;
    if (!alive()) return;
    await Promise.race([line, wait(this, POPPED_MAX_WAIT_MS)]);
    if (!alive()) return;
    await this.afterPop(alive);
    if (!alive()) return;

    this.session.reportCelebrating(false);
    // Never start the next trial behind the help card: it starts when the card closes.
    if (this.helpOpen) {
      this.advancePending = true;
      return;
    }
    this.startRound();
  }

  /** Optional Hebrew follow-up: praise every 3rd win, else the leisure-earned line. */
  private async afterPop(alive: () => boolean): Promise<void> {
    const praise = shouldPraise(this.correctCount);
    if ((!praise && !this.earnedPending) || this.helpOpen) return;
    if (!alive()) return;
    const line = praise ? heLine('praise.0') : heLine('leisure.earned');
    if (!praise) this.earnedPending = false;
    await Promise.race([this.context.audio.play(line), wait(this, FOLLOWUP_MAX_WAIT_MS)]);
  }

  private flyStarToCounter(fromX: number, fromY: number): void {
    const target = this.starPillGamePoint();
    const finish = () => {
      if (!this.sys.isActive()) return;
      this.context.shell.updateRestaurantChrome({ starCount: this.profileState().stars });
      this.context.shell.bumpStarPill(isReducedMotion() ? 1.08 : 1.35);
    };
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
}

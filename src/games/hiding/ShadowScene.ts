import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig, HidingAnimal } from '../../content/schema';
import { Character } from '../../anim/Character';
import { Juice, fxTextureKey } from '../../anim/juice';
import { ANIM_PROFILE } from '../../anim/profiles';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, popIn, pressSquash, tweenAsync, wait, wobble } from '../../anim/tweens';
import { sceneArtKey } from '../../anim/artRegistry';
import { applySilhouette } from '../../anim/silhouette';
import { heLine } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { TrialTracker, nextRoundLanguage } from '../restaurant/trialTracker';
import { crossedWholeMinute, shouldPraise, shouldSayRetry } from '../restaurant/voiceRules';
import type { Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import { gameRectToPageRect, type Rect as PageRect } from '../../testing/pageRect';
import { buildShadowRound, isCorrectShadow, type ShadowRoundSpec } from './shadowRound';
import { computeShadowLayout, type ShadowLayout, type ShadowSlot } from './shadowLayout';
import type { ShadowInfo } from './shadowTypes';

interface ShadowView {
  animal: HidingAnimal;
  slot: ShadowSlot;
  character: Character;
  zone: Phaser.GameObjects.Zone;
  /** Restores the animal's colours; null once revealed. */
  restore: (() => void) | null;
}

interface ActiveRound extends ShadowRoundSpec {
  done: boolean;
  tries: number;
  tracker: TrialTracker;
  levelNo: number;
  skillKey: string;
}

const WRONG_TAP_LOCK_MS = 400;
const HINT_AFTER_WOBBLE_MS = 450;
/** While the intro or help is speaking, a pending hint looks again after this delay. */
const HINT_DEFER_POLL_MS = 300;
const REVEAL_MAX_WAIT_MS = 3000;
const FOLLOWUP_MAX_WAIT_MS = 3500;
const OUTLINE = 0x3b2a22;
const DEPTH = { background: -10, ui: 200, zone: 100, flying: 300 } as const;
const INTRO_LINE_ID = 'he.shadow.intro';
const HELP_LINE_ID = 'he.shadow.help';

/**
 * Shadow Match (Nature Lab): the silhouette variant of Who's Hiding?. Same animals, round builder,
 * engine wiring and hint flow; the choices are dark silhouettes of the approved animal art, and a
 * correct tap reveals the animal and names it in the learning language, then in Hebrew.
 */
export class ShadowScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private ageConfig!: AgeTrackConfig;
  private skills!: SkillSession;
  private roundLang: Lang | null = null;
  private layout!: ShadowLayout;
  private round: ActiveRound | null = null;
  private shadows: ShadowView[] = [];
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
    super('ShadowScene');
  }

  create(): void {
    setAppScreen('shadow');
    this.context = this.game.registry.get('appContext') as AppContext;
    const content = this.context.content.shadow;
    const adaptive = content.adaptive;
    this.ageConfig = content.ageTracks[this.context.currentAgeTrack()];
    this.skills = this.context.createSkillSession(
      content.world,
      content.id,
      buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    );
    this.roundLang = null;
    this.round = null;
    this.shadows = [];
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
    this.hintTimer?.remove();
    this.retryTimer?.remove();
    this.hintTimer = undefined;
    this.retryTimer = undefined;
    this.round = null;
    this.clearShadows();
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
    const key = sceneArtKey('hiding', w >= h ? 'bg-landscape' : 'bg-portrait');
    if (key && this.textures.exists(key)) {
      this.add.image(w / 2, h / 2, key).setDisplaySize(w, h).setDepth(DEPTH.background);
      return;
    }
    this.cameras.main.setBackgroundColor('#b8e6ff');
    this.add.rectangle(w / 2, h * 0.8, w, h * 0.4, 0x8ae07e).setDepth(DEPTH.background);
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

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    this.hintTimer?.remove();
    // Help cut the intro short: play it again when the card closes.
    if (this.introPlaying) this.introPending = true;
    const content = this.context.content.shadow;
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
    const { x, y, radius } = this.layout?.replay ?? { x: 0, y: 0, radius: 0 };
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
        if (this.round && !this.round.done && this.ready) {
          const intro = this.introPending ? { lineId: INTRO_LINE_ID, lang: 'he' as const, text: this.context.content.shadow.introHe } : undefined;
          this.introPending = false;
          void this.speakPrompt(intro);
        }
      },
      this.layout ? this.toPageRect(x - radius, y - radius, radius * 2, radius * 2) : undefined,
    );
  }

  // ---------------------------------------------------------------- round

  private startRound(): void {
    const token = ++this.roundToken;
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.clearShadows();
    this.hintTimer?.remove();
    this.retryTimer?.remove();
    this.retryTimer = undefined;
    this.inputLockedUntil = 0;
    this.ready = false;
    this.hinted = false;

    const content = this.context.content.shadow;
    const animals = this.context.content.hiding.animals;
    const settings = this.context.store.getState().settings;
    this.roundLang = nextRoundLanguage(
      this.roundLang,
      this.roundLang === null || this.skills.atRoundBoundary(this.roundLang),
      settings.languages,
    );
    const language = this.roundLang;
    const levelNumber = this.skills.level(language);
    const descriptor = content.adaptive.levels[levelNumber - 1];
    const ids = animals.map((a) => a.id);
    const candidates = ids.length > 1 ? ids.filter((id) => id !== this.lastTargetId) : ids;
    const targetId = this.skills.selectNextItem(language, candidates);
    this.lastTargetId = targetId;
    const spec = buildShadowRound(content, animals, descriptor, language, targetId);
    this.round = {
      ...spec,
      done: false,
      tries: 0,
      tracker: new TrialTracker(spec.target.id, language),
      levelNo: levelNumber,
      skillKey: this.skills.key(language),
    };

    this.layout = computeShadowLayout(this.scale.width, this.scale.height, spec.choices.length);
    this.buildReplayButton();
    const pops = spec.choices.map((animal, i) => this.buildShadow(animal, this.layout.slots[i], i));
    this.context.shell.setPromptBubble(spec.promptText, () => this.replay());

    void Promise.all(pops).then(() => {
      if (token !== this.roundToken || !this.round || this.round.done) return;
      this.ready = true;
      // Help opened during the pop-in: keep the intro for when the card closes.
      if (this.helpOpen) return;
      const intro = this.introPending ? { lineId: INTRO_LINE_ID, lang: 'he' as const, text: content.introHe } : undefined;
      this.introPending = false;
      void this.speakPrompt(intro);
      if (!intro) this.scheduleIdleHint();
    });
  }

  private clearShadows(): void {
    for (const s of this.shadows) {
      this.tweens.killTweensOf(s.character.root);
      s.character.destroy();
      s.zone.destroy();
    }
    this.shadows = [];
    if (this.replayButton) this.tweens.killTweensOf(this.replayButton);
    this.replayButton?.destroy();
    this.replayButton = undefined;
  }

  /** One silhouette; resolves once it has popped in. */
  private buildShadow(animal: HidingAnimal, slot: ShadowSlot, index: number): Promise<void> {
    const character = new Character(this, { kind: animal.kind, x: slot.x, y: slot.feetY, displayHeight: slot.animalHeight, depth: 10 + slot.row });
    const restore = applySilhouette(character.root);
    const hit = slot.hit;
    const zone = this.add
      .zone((hit.left + hit.right) / 2, (hit.top + hit.bottom) / 2, hit.right - hit.left, hit.bottom - hit.top)
      .setDepth(DEPTH.zone)
      .setInteractive({ useHandCursor: true });
    const view: ShadowView = { animal, slot, character, zone, restore };
    zone.on('pointerdown', () => this.choose(view));
    this.shadows.push(view);
    return popIn(this, character.root, 120 + index * ANIM_PROFILE.popIn.stagger, character.root.scaleX);
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

  /** A voluntary replay (speaker or prompt bubble): not a hint, never touches the tracker. */
  private replay(): void {
    if (!this.round || this.round.done || !this.ready || this.helpOpen) return;
    this.session.reportInteraction();
    // A voluntary replay restarts the age-2 idle clock instead of letting a pending hint talk over it.
    this.hintTimer?.remove();
    const round = this.round;
    void this.speakPrompt().then(() => {
      if (this.round === round && !round.done) this.scheduleIdleHint();
    });
  }

  /** Age-5 first wrong tap: the retry line and the cue again, deferred while the intro or help is speaking. */
  private repeatCue(retry?: SpeechRequest): void {
    const round = this.round;
    if (!round || round.done) return;
    if (this.helpOpen || this.introPlaying || this.helpPlaying) {
      this.retryTimer?.remove();
      this.retryTimer = this.time.delayedCall(HINT_DEFER_POLL_MS, () => this.repeatCue(retry));
      return;
    }
    void this.speakPrompt(retry);
  }

  /** Speaks the cue (device TTS for EN/FR), optionally after one Hebrew line. A newer call supersedes an older one. */
  private async speakPrompt(before?: SpeechRequest): Promise<void> {
    if (!this.round || this.helpOpen) return;
    const seq = ++this.speakSeq;
    const round = this.round;
    // A newer call supersedes an interrupted intro, so the flag never sticks (it would block every hint).
    this.introPlaying = before?.lineId === INTRO_LINE_ID;
    this.session.reportListening(true);
    try {
      if (before) {
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

  getShadowInfo(): ShadowInfo | null {
    if (!this.round) return null;
    const round = this.round;
    const { x, y, radius } = this.layout.replay;
    return {
      level: round.levelNo,
      language: round.language,
      skillKey: round.skillKey,
      speak: round.level.speak,
      targetId: round.target.id,
      promptText: round.promptText,
      shadows: this.shadows.map((s) => ({
        animalId: s.animal.id,
        silhouette: s.restore !== null,
        hit: this.toPageRect(s.slot.hit.left, s.slot.hit.top, s.slot.hit.right - s.slot.hit.left, s.slot.hit.bottom - s.slot.hit.top),
      })),
      replay: this.toPageRect(x - radius, y - radius, radius * 2, radius * 2),
      tries: round.tries,
      hinted: this.hinted,
      correctCount: this.correctCount,
      ready: this.ready,
      done: round.done,
    };
  }

  // ---------------------------------------------------------------- hints and taps

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
    const view = this.shadows.find((s) => isCorrectShadow(s.animal.id, round.target.id));
    if (view) {
      void hintPulse(this, view.character.root, view.character.root.scaleX);
      Juice.for(this).burst('sparkle', view.slot.x, view.slot.feetY - view.slot.animalHeight);
    }
    this.context.sfx.hint();
    // After the hinted cue, restart the age-2 idle clock so an idle child keeps getting hints.
    void this.speakPrompt(before).then(() => {
      if (this.round === round && !round.done) this.scheduleIdleHint();
    });
  }

  private choose(view: ShadowView): void {
    const round = this.round;
    if (!round || round.done || !this.ready) return;
    if (this.time.now < this.inputLockedUntil) return;
    this.session.reportInteraction();

    const correct = isCorrectShadow(view.animal.id, round.target.id);
    const result = round.tracker.onPlateTap(correct, 0);
    if (result) this.skills.record(round.language, result);

    if (correct) {
      round.done = true;
      this.ready = false;
      this.hintTimer?.remove();
      this.retryTimer?.remove();
      void this.onCorrect(view);
      return;
    }

    round.tries++;
    this.hintTimer?.remove();
    this.inputLockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    void wobble(this, view.character.root);
    const token = this.roundToken;
    const retry = shouldSayRetry(round.tries) ? heLine(Math.random() < 0.5 ? 'retry.0' : 'retry.1') : undefined;
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
      else later(() => this.repeatCue(retry));
    }
  }

  // ---------------------------------------------------------------- success

  private async onCorrect(view: ShadowView): Promise<void> {
    const token = this.roundToken;
    const alive = () => token === this.roundToken;
    const round = this.round!;
    const juice = Juice.for(this);
    const { slot } = view;

    this.context.sfx.yay();
    this.speakSeq++;
    this.introPlaying = false;
    this.correctCount++;
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.complete();
    this.context.recordCompletedRound('nature-lab', 'shadow-match');
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();

    for (const s of this.shadows) {
      s.zone.disableInteractive();
      if (s !== view) void tweenAsync(this, { targets: s.character.root, alpha: 0.25, duration: 300 });
    }
    // Reveal: the silhouette gets its colours back.
    view.restore?.();
    view.restore = null;
    juice.burst('sparkle', slot.x, slot.feetY - slot.animalHeight * 0.6);
    const head = view.character.headPoint();
    juice.burst('star', head.x, head.y);
    juice.burst('confetti', slot.x, head.y - 30);
    this.flyStarToCounter(head.x, head.y);

    const lang = round.language;
    const name = this.context.audio.play({ lineId: round.revealLineId, lang, text: round.revealText });
    await view.character.happy();
    if (!alive()) return;
    await Promise.race([view.character.talk(name), wait(this, REVEAL_MAX_WAIT_MS)]);
    if (!alive()) return;
    // Then the Hebrew name (pending owner decision: learning language + Hebrew, not all three); never over the help line.
    if (!this.helpOpen) await Promise.race([this.context.audio.play({ lineId: round.revealLineIdHe, lang: 'he', text: round.revealTextHe }), wait(this, REVEAL_MAX_WAIT_MS)]);
    if (!alive()) return;
    await this.afterReveal(alive);
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
  private async afterReveal(alive: () => boolean): Promise<void> {
    const praise = shouldPraise(this.correctCount);
    if ((!praise && !this.earnedPending) || this.helpOpen || !alive()) return;
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

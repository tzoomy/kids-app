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
import { flyArc, hintPulse, popIn, pressSquash, wait, wobble } from '../../anim/tweens';
import { revealFromBush, rustleBush } from '../../anim/worldMotion';
import { propArtKey, sceneArtKey } from '../../anim/artRegistry';
import { heLine, heVariant } from '../../content/voiceLines';
import { setAppScreen } from '../../pwa';
import { TrialTracker, nextRoundLanguage } from '../restaurant/trialTracker';
import { crossedWholeMinute, shouldPraise, shouldSayRetry, showsPromptBubble } from '../restaurant/voiceRules';
import { type Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import { buildHidingRound, eligibleAnimalIds, isCorrectBush, type HidingRoundSpec } from './hidingRound';
import { animalFeetY, computeHidingLayout, type BushSlot, type HidingLayout } from './hidingLayout';

export interface HidingRoundInfo {
  /** Always 'hiding'; lets a test tell this round apart from a restaurant round. */
  request: 'hiding';
  /** Index of the bush that hides the requested animal. */
  correctIndex: number;
  /** Animal ids per bush, in display order. */
  choiceIds: string[];
  targetId: string;
  /** Bush tap points in game coordinates. */
  choiceCenters: Array<{ x: number; y: number }>;
  /** Speaker button that replays the request. */
  replayCenter: { x: number; y: number };
  choiceCount: number;
  language: string;
  promptText: string;
  /** False on an audio-only level: the request has no text bubble. */
  visualCue: boolean;
  /** Fraction of each animal that shows above its bush. */
  reveal: number;
  /** Spoken content: name-sound, name or sound. */
  speak: string;
  tries: number;
  /** True once the idle auto-hint marked this trial hinted. */
  hinted: boolean;
  level: number;
  skillKey: string;
  correctCount: number;
  /** True once every bush has popped in and the request has been given. */
  ready: boolean;
}

interface BushView {
  animal: HidingAnimal;
  slot: BushSlot;
  back: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
  front: Phaser.GameObjects.GameObject & Phaser.GameObjects.Components.Transform;
  character: Character;
  zone: Phaser.GameObjects.Zone;
  /** Feet y while hiding at the level's reveal. */
  hiddenY: number;
  /** Source shape of the geometry mask that clips the animal at the bush's bottom edge. */
  maskShape: Phaser.GameObjects.Graphics;
}

interface ActiveRound extends HidingRoundSpec {
  done: boolean;
  tries: number;
  tracker: TrialTracker;
  levelNo: number;
  skillKey: string;
}

/** Bush taps are ignored this long after a wrong tap, so a double tap counts as one try. */
const WRONG_TAP_LOCK_MS = 400;
/** Pause after a wrong tap so the gentle wiggle reads before the retry speech. */
const HINT_AFTER_WIGGLE_MS = 450;
const FOUND_MAX_WAIT_MS = 2600;
const FOLLOWUP_MAX_WAIT_MS = 3500;
const FOUND_BEFORE_PRAISE_MAX_MS = 5000;
/** The hint lifts the answer animal at least this far out of its bush (fraction of its height). */
const HINT_MIN_REVEAL = 0.9;

const DEPTH = { background: -10, ui: 200, zone: 100, flying: 300 } as const;

export class HidingScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private ageConfig!: AgeTrackConfig;
  private skills!: SkillSession;
  private roundLang: Lang | null = null;
  private layout!: HidingLayout;
  private round: ActiveRound | null = null;
  private bushes: BushView[] = [];
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
  /** Plays once per visit, before the first request, the same pattern as the restaurant intro. */
  private introPending = true;
  private introPlaying = false;
  private helpPlaying = false;
  private correctCount = 0;
  private lastBalanceSec = 0;
  private earnedPending = false;
  private speakSeq = 0;

  constructor() {
    super('HidingScene');
  }

  create(): void {
    setAppScreen('hiding');
    this.context = this.game.registry.get('appContext') as AppContext;
    const content = this.context.content.hiding;
    const adaptive = content.adaptive;
    const track = this.context.currentAgeTrack();
    this.ageConfig = content.ageTracks[track];
    this.skills = this.context.createSkillSession(
      content.world,
      content.id,
      buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    );
    this.roundLang = null;
    this.round = null;
    this.bushes = [];
    this.replayButton = undefined;
    this.ready = false;
    this.hinted = false;
    this.helpOpen = false;
    this.introPending = true;
    this.introPlaying = false;
    this.helpPlaying = false;
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
    this.clearBushes();
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

  private speakerAvoidRect(): { x: number; y: number; width: number; height: number } | undefined {
    if (!this.layout) return undefined;
    const { x, y, radius } = this.layout.replay;
    const box = this.game.canvas.getBoundingClientRect();
    const scale = Math.min(box.width / this.scale.width, box.height / this.scale.height);
    const offsetX = (box.width - this.scale.width * scale) / 2;
    const offsetY = (box.height - this.scale.height * scale) / 2;
    return {
      x: box.left + offsetX + (x - radius) * scale,
      y: box.top + offsetY + (y - radius) * scale,
      width: radius * 2 * scale,
      height: radius * 2 * scale,
    };
  }

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    this.hintTimer?.remove();
    // The help line replaces whatever is playing (intro or request); older flows see the new seq and stop.
    const seq = ++this.speakSeq;
    this.introPlaying = false;
    this.helpPlaying = true;
    this.session.reportListening(true);
    void this.context.audio.play(heLine('hiding.help')).finally(() => {
      if (seq !== this.speakSeq) return;
      this.helpPlaying = false;
      this.session.reportListening(false);
      if (!this.helpOpen) this.scheduleIdleHint();
    });
    this.context.shell.showHelp(
      this.context.content.hiding.helpTextHe,
      () => {
        this.helpOpen = false;
        this.helpPlaying = false;
        this.session.reportInteraction();
        this.scheduleIdleHint();
        // Closing the card cuts the help line and repeats the open request.
        if (this.round && !this.round.done && this.ready) void this.speakPrompt();
      },
      this.speakerAvoidRect(),
    );
  }

  // ---------------------------------------------------------------- round

  private pickTarget(language: Lang): string {
    const content = this.context.content.hiding;
    const ids = eligibleAnimalIds(content);
    // The engine picks the item (after a drop it serves a known one). Avoid asking for the same
    // animal twice in a row when it is not the engine's only candidate.
    const candidates = ids.length > 1 ? ids.filter((id) => id !== this.lastTargetId) : ids;
    const id = this.skills.selectNextItem(language, candidates);
    this.lastTargetId = id;
    return id;
  }

  private startRound(): void {
    const token = ++this.roundToken;
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.clearBushes();
    this.hintTimer?.remove();
    this.retryTimer?.remove();
    this.retryTimer = undefined;
    this.inputLockedUntil = 0;
    this.ready = false;
    this.hinted = false;

    const content = this.context.content.hiding;
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
    const spec = buildHidingRound(content, descriptor, language, this.pickTarget(language));
    this.round = {
      ...spec,
      done: false,
      tries: 0,
      tracker: new TrialTracker(spec.target.id, language),
      levelNo: levelNumber,
      skillKey: this.skills.key(language),
    };

    this.layout = computeHidingLayout(this.scale.width, this.scale.height, spec.level.choiceCount);
    this.buildReplayButton();
    const pops: Array<Promise<void>> = [];
    spec.choices.forEach((animal, i) => pops.push(this.buildBush(animal, this.layout.bushes[i], spec, i)));

    if (showsPromptBubble(spec.level.audioOnly)) this.context.shell.setPromptBubble(spec.promptText, () => this.replay());
    else this.context.shell.clearPromptBubble();

    void Promise.all(pops).then(async () => {
      if (token !== this.roundToken || !this.round || this.round.done) return;
      this.ready = true;
      // Something rustles in every bush (no cue about which one holds the answer), then the request.
      this.bushes.forEach((b, i) => {
        void wait(this, i * 90).then(() => {
          if (token === this.roundToken) void this.rustleBush(b);
        });
      });
      const intro = this.introPending ? heLine('hiding.intro') : undefined;
      this.introPending = false;
      void this.speakPrompt(undefined, intro);
      // When an intro will play, the idle-hint clock starts when that line ends (AC-40).
      if (!intro) this.scheduleIdleHint();
    });
  }

  private clearBushes(): void {
    for (const b of this.bushes) {
      b.character.destroy();
      b.maskShape.destroy();
      b.back.destroy();
      b.front.destroy();
      b.zone.destroy();
    }
    this.bushes = [];
    this.replayButton?.destroy();
    this.replayButton = undefined;
  }

  private bushImage(shape: 'round' | 'tall', layer: 'back' | 'front', slot: BushSlot): Phaser.GameObjects.Image | Phaser.GameObjects.Ellipse {
    const key = propArtKey(`bush-${shape}-${layer}`);
    if (key && this.textures.exists(key)) {
      return this.add.image(slot.x, slot.bottomY, key).setOrigin(0.5, 1).setDisplaySize(slot.width, slot.height);
    }
    // Procedural fallback so the game stays playable if the art is missing.
    const e = this.add.ellipse(slot.x, slot.bottomY - slot.height * 0.3, slot.width * 0.95, slot.height * 0.6, layer === 'back' ? 0x3ca33c : 0x57c457);
    e.setStrokeStyle(4, 0x3b2a22);
    return e;
  }

  /** One bush with its hiding animal; resolves once everything has popped in. */
  private buildBush(animal: HidingAnimal, slot: BushSlot, spec: HidingRoundSpec, index: number): Promise<void> {
    const back = this.bushImage(slot.shape, 'back', slot).setDepth(slot.depth + 1);
    const front = this.bushImage(slot.shape, 'front', slot).setDepth(slot.depth + 3);
    const hiddenY = animalFeetY(slot.topY, slot.animalHeight, spec.level.reveal);
    const character = new Character(this, { kind: animal.kind, x: slot.x, y: hiddenY, displayHeight: slot.animalHeight, depth: slot.depth + 2 });
    // Low reveals leave the animal's lower body below the hedge; clip everything under the front
    // foliage's lower edge (about 12% of the bush height above the art's bottom). The mask is removed
    // when the animal pops out in front of the bush.
    const maskShape = this.make.graphics({ x: 0, y: 0 }, false);
    maskShape.fillStyle(0xffffff, 1);
    maskShape.fillRect(slot.x - slot.width, 0, slot.width * 2, slot.bottomY - slot.height * 0.12);
    character.root.setMask(maskShape.createGeometryMask());
    const hit = slot.hit;
    const zone = this.add
      .zone((hit.left + hit.right) / 2, (hit.top + hit.bottom) / 2, hit.right - hit.left, hit.bottom - hit.top)
      .setDepth(DEPTH.zone)
      .setInteractive({ useHandCursor: true });
    const view: BushView = { animal, slot, back, front, character, zone, hiddenY, maskShape };
    zone.on('pointerdown', () => this.choose(view));
    this.bushes.push(view);

    // Bush art is anchored bottom-centre, so it grows out of the ground; the animal pops in with it.
    // The rest scale is the display scale (setDisplaySize / the character's rig scale), not 1.
    const delay = 120 + index * ANIM_PROFILE.popIn.stagger;
    return Promise.all([
      popIn(this, back, delay, back.scaleX),
      popIn(this, front, delay, front.scaleX),
      popIn(this, character.root, delay, character.root.scaleX),
    ]).then(() => undefined);
  }

  private rustleBush(view: BushView): Promise<void> {
    return Promise.all([rustleBush(this, view.back), rustleBush(this, view.front)]).then(() => undefined);
  }

  private buildReplayButton(): void {
    const { x, y, radius } = this.layout.replay;
    const circle = this.add.circle(0, 0, radius, 0xffffff).setStrokeStyle(5, 0x3b2a22);
    const g = this.add.graphics();
    g.fillStyle(0x3b2a22, 1);
    // Speaker: a small box and a cone, then two sound arcs.
    g.fillRect(-20, -9, 12, 18);
    g.fillTriangle(-8, -9, 8, -22, 8, 22);
    g.fillTriangle(-8, 9, 8, -22, 8, 22);
    g.lineStyle(4, 0x3b2a22, 1);
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

  /**
   * Speaks the request through the audio manager (device TTS for EN/FR), optionally after one
   * Hebrew narrator line. A newer call supersedes an older one.
   */
  private async speakPrompt(text?: { lineId: string; text: string }, before?: SpeechRequest): Promise<void> {
    if (!this.round || this.helpOpen) return;
    const seq = ++this.speakSeq;
    const round = this.round;
    this.session.reportListening(true);
    try {
      if (before) {
        this.introPlaying = before.lineId === 'he.hiding.intro';
        try {
          await this.context.audio.play(before);
        } finally {
          if (seq === this.speakSeq) this.introPlaying = false;
        }
        if (seq !== this.speakSeq || round.done || this.round !== round) {
          if (seq === this.speakSeq) this.session.reportListening(false);
          return;
        }
        if (before.lineId === 'he.hiding.intro') this.scheduleIdleHint();
      }
      await this.context.audio.play({
        lineId: text?.lineId ?? this.round.lineId,
        lang: this.round.language,
        text: text?.text ?? this.round.promptText,
      });
    } finally {
      if (seq === this.speakSeq) this.session.reportListening(false);
    }
  }

  getRoundInfo(): HidingRoundInfo | null {
    if (!this.round || this.round.done) return null;
    const round = this.round;
    const correctIndex = this.bushes.findIndex((b) => isCorrectBush(b.animal.id, round.target.id));
    return {
      request: 'hiding',
      correctIndex,
      choiceIds: this.bushes.map((b) => b.animal.id),
      targetId: round.target.id,
      choiceCenters: this.bushes.map((b) => ({ x: (b.slot.hit.left + b.slot.hit.right) / 2, y: (b.slot.hit.top + b.slot.hit.bottom) / 2 })),
      replayCenter: { x: this.layout.replay.x, y: this.layout.replay.y },
      choiceCount: this.bushes.length,
      language: round.language,
      promptText: round.promptText,
      visualCue: !round.level.audioOnly,
      reveal: round.level.reveal,
      speak: round.level.speak,
      tries: round.tries,
      hinted: this.hinted,
      level: round.levelNo,
      skillKey: round.skillKey,
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
    if (this.helpOpen || this.introPlaying || this.helpPlaying) {
      // The idle-hint clock is restarted when the blocking line ends or the help card closes.
      return;
    }
    // Only the idle auto-hint before the first tap counts (later ones follow a recorded miss,
    // and the tracker ignores them). `hinted` mirrors what the tracker will report.
    round.tracker.onHint();
    if (round.tries === 0) this.hinted = true;
    const view = this.bushes.find((b) => isCorrectBush(b.animal.id, round.target.id));
    // A voice-only level shows nothing of the answer: the hint is the spoken request plus a clue.
    if (view && !round.level.audioOnly) {
      void rustleBush(this, view.front);
      void hintPulse(this, view.front);
      Juice.for(this).burst('sparkle', view.slot.x, view.slot.topY);
      // More of the animal shows (never less than it already did).
      const y = animalFeetY(view.slot.topY, view.slot.animalHeight, Math.max(round.level.reveal, HINT_MIN_REVEAL));
      void revealFromBush(this, view.character.root, y);
    }
    this.context.sfx.hint();
    void this.speakPrompt({ lineId: round.hintLineId, text: round.hintText }, before);
  }

  private choose(view: BushView): void {
    const round = this.round;
    if (!round || round.done || !this.ready) return;
    if (this.time.now < this.inputLockedUntil) return;
    this.session.reportInteraction();
    void pressSquash(this, view.front);

    const correct = isCorrectBush(view.animal.id, round.target.id);
    // Once per trial, on the first accepted tap: a wrong tap is the miss, a correct tap a clean try.
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
    this.inputLockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    void wobble(this, view.front);
    void wobble(this, view.back);
    void view.character.hmm();
    const token = this.roundToken;
    const retry = shouldSayRetry(round.tries) ? heVariant('retry') : undefined;
    const later = (fn: () => void) => {
      this.retryTimer?.remove();
      this.retryTimer = this.time.delayedCall(HINT_AFTER_WIGGLE_MS, () => {
        if (token === this.roundToken && this.round && !this.round.done) fn();
      });
    };
    if (this.ageConfig.hintMode === 'demonstrate') {
      this.context.sfx.tap();
      later(() => this.giveHint(retry));
    } else {
      this.context.sfx.hint();
      if (round.tries >= 2) later(() => this.giveHint());
      else later(() => void this.speakPrompt(undefined, retry));
    }
  }

  // ---------------------------------------------------------------- success

  private async onCorrect(view: BushView): Promise<void> {
    const token = this.roundToken;
    const alive = () => token === this.roundToken;
    const round = this.round!;
    const juice = Juice.for(this);
    const slot = view.slot;

    this.context.sfx.yay();
    this.speakSeq++;
    this.correctCount++;
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();

    // The other bushes settle; the animal pops out in front of its bush.
    this.bushes.forEach((b) => {
      if (b !== view) b.zone.disableInteractive();
    });
    view.zone.disableInteractive();
    view.character.root.setDepth(slot.depth + 4);
    view.character.root.clearMask();
    juice.burst('sparkle', slot.x, slot.topY);
    await revealFromBush(this, view.character.root, slot.bottomY - 10);
    if (!alive()) return;

    const head = view.character.headPoint();
    juice.burst('star', head.x, head.y);
    juice.burst('confetti', slot.x, head.y - 30);
    this.flyStarToCounter(head.x, head.y);

    const lang = round.language;
    const lines = this.context.content.hiding.found[lang];
    const index = Math.floor(Math.random() * lines.length);
    const found = this.context.audio.play({ lineId: `hiding.found.${lang}.${index}`, lang, text: lines[index] });
    await view.character.happy();
    if (!alive()) return;
    await Promise.race([view.character.talk(found), wait(this, FOUND_MAX_WAIT_MS)]);
    if (!alive()) return;
    await this.afterFound(found, alive);
    if (!alive()) return;

    this.session.reportCelebrating(false);
    this.startRound();
  }

  /** Optional Hebrew follow-ups, as in the restaurant: praise every 3rd win, else the leisure-earned line. */
  private async afterFound(found: Promise<unknown>, alive: () => boolean): Promise<void> {
    const praise = shouldPraise(this.correctCount);
    if ((!praise && !this.earnedPending) || this.helpOpen) return;
    await Promise.race([found, wait(this, FOUND_BEFORE_PRAISE_MAX_MS)]);
    if (!alive() || this.helpOpen) return;
    const line = praise ? heVariant('praise') : heLine('leisure.earned');
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

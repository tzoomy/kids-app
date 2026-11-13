import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { ANIMAL_KINDS } from '../../assets/vectorArt';
import { buildRound, eligibleTargetIds, isRequestedChoice, type ChoiceServeLevel, type Lang, type RoundSpec } from '../templates/choiceServe';
import { TrialTracker, nextRoundLanguage } from './trialTracker';
import { buildMeta, type SkillSession } from '../../core/adaptive';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig } from '../../content/schema';
import { Character } from '../../anim/Character';
import { Juice, fxTextureKey } from '../../anim/juice';
import { ANIM_PROFILE } from '../../anim/profiles';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, invitePulse, popIn, popOut, pressSquash, wait, wobble } from '../../anim/tweens';
import { computeRestaurantLayout, type RestaurantLayout } from './restaurantLayout';
import { heLine, heVariant } from '../../content/voiceLines';
import type { SpeechRequest } from '../../core/audio/types';
import { crossedWholeMinute, shouldPraise, shouldSayRetry, showsPromptBubble } from './voiceRules';
import { DEPTH, addCounterFront, buildPlate, detachFood, paintBackground, type PlateView } from './restaurantArt';
import { setAppScreen } from '../../pwa';

export interface RoundInfo {
  /** First requested plate that is not served yet (-1 if none). */
  correctIndex: number;
  /** Every requested plate not served yet (two for a two-item request until one is served). */
  correctIndices: number[];
  /** Request type: noun, quantity, attribute, two-step or negation. */
  request: string;
  /** False on a voice-only level: the request has no text bubble. */
  visualCue: boolean;
  choiceCount: number;
  choiceCenters: Array<{ x: number; y: number }>;
  /** Tap point on the animal (repeats the food request). */
  animalCenter: { x: number; y: number };
  /** Animal tap zone in game coordinates. */
  animalHit: { left: number; top: number; right: number; bottom: number };
  language: string;
  promptText: string;
  tries: number;
  /** Adaptive level (1-based) and skill key of the current animal. */
  level: number;
  skillKey: string;
  correctCount: number;
  /** Animal state machine state ('enter', 'idle', 'talking', ...). */
  characterState: string;
  /** True once the animal has finished hopping in and every plate has popped in. */
  ready: boolean;
}

interface ActiveRound extends RoundSpec {
  done: boolean;
  tries: number;
  /** Requested plates already served (a two-item request needs both). */
  served: PlateView[];
  /** Decides what the engine records for this trial (once; hint only from the idle auto-hint). */
  tracker: TrialTracker;
  level: number;
  skillKey: string;
}

/** Plate taps are ignored this long after a wrong tap, so a double tap counts as one try. */
const WRONG_TAP_LOCK_MS = 400;
/** Pause after a wrong tap so the gentle "hmm" reads before the hint/retry speech. */
const HINT_AFTER_HMM_MS = 450;
/** After the first plate of a two-item request, the request is repeated this long afterwards. */
const SECOND_PLATE_REPLAY_MS = 700;
/** Never wait longer than this for the thanks line before the next animal. */
const THANKS_MAX_WAIT_MS = 2600;
/** When a praise line follows, give the thanks line this long to finish so they never overlap. */
const THANKS_BEFORE_PRAISE_MAX_MS = 5000;
/** Cap for the short Hebrew follow-up lines (praise, leisure.earned) before the animal leaves. */
const NARRATOR_MAX_WAIT_MS = 3500;

export class RestaurantScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private ageConfig!: AgeTrackConfig;
  private level!: ChoiceServeLevel;
  private skills!: SkillSession;
  /** Language of the current round of animals; stays fixed until the round boundary. */
  private roundLang: Lang | null = null;
  private layout!: RestaurantLayout;
  private round: ActiveRound | null = null;
  private character?: Character;
  private animalHit?: Phaser.GameObjects.Zone;
  private plates: PlateView[] = [];
  private hintTimer?: Phaser.Time.TimerEvent;
  /** The single pending retry/hint after a wrong tap; only the last wrong tap speaks. */
  private retryTimer?: Phaser.Time.TimerEvent;
  private inputLockedUntil = 0;
  private visibilityHandler?: () => void;
  /** Incremented per round and on shutdown; async flows bail when it changes. */
  private roundToken = 0;
  private lastKind = '';
  private helpOpen = false;
  /** True while the Hebrew intro line plays, so the auto-hint does not cut it off. */
  private introPlaying = false;
  private introPending = true;
  private correctCount = 0;
  private lastBalanceSec = 0;
  private earnedPending = false;
  /** Bumped by every new voice flow; an older multi-line flow bails when it sees a newer one. */
  private speakSeq = 0;

  constructor() {
    super('RestaurantScene');
  }

  create(): void {
    setAppScreen('restaurant');
    this.context = this.game.registry.get('appContext') as AppContext;
    const profile = this.context.store
      .getState()
      .profiles.find((p) => p.id === this.context.requireProfileId());
    const track = profile?.ageTrack ?? 'age5';
    const restaurant = this.context.content.restaurant;
    const adaptive = restaurant.adaptive;
    this.ageConfig = restaurant.ageTracks[track];
    this.skills = this.context.createSkillSession(
      restaurant.world,
      restaurant.id,
      buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    );
    // Language and level are chosen per round in startRound; the first layout uses the track's start level.
    this.roundLang = null;
    this.level = adaptive.levels[adaptive.tracks[track].start - 1] as ChoiceServeLevel;
    this.round = null;
    this.character = undefined;
    this.plates = [];
    this.helpOpen = false;
    this.introPlaying = false;
    this.introPending = true;
    this.correctCount = 0;
    this.earnedPending = false;
    this.speakSeq = 0;
    this.inputLockedUntil = 0;
    this.retryTimer = undefined;
    this.hintTimer = undefined;

    this.session = this.context.createLearningSession();
    this.session.start();

    this.visibilityHandler = () => {
      this.session.setHidden(document.hidden);
      // Phaser's clock pauses while hidden; do not leave the narrator talking to a locked screen.
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

    this.layout = computeRestaurantLayout(this.scale.width, this.scale.height, this.level.choiceCount);
    paintBackground(this, this.layout);
    addCounterFront(this, this.layout);
    this.createAnimalHitArea();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.buildHud();
    this.lastBalanceSec = this.profileState().balanceSec;
    this.startRound();

    window.__GAME_READY__ = true;
  }

  private cleanup(): void {
    this.roundToken++;
    this.round = null;
    this.character?.destroy();
    this.character = undefined;
    this.plates = [];
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
    this.context.audio.stopAll();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
  }

  private profileState() {
    return this.context.store.getProfileState(this.context.requireProfileId(), new Date(this.context.nowMs()));
  }

  /** Builds the top bar once; afterwards it is only updated in place. */
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

  /** Per-second refresh of balance/progress. Stars update only when the flying star lands. */
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

  private showHelp(): void {
    this.session.reportInteraction();
    this.helpOpen = true;
    // The help line replaces whatever is playing; older flows see the new seq and stop.
    const seq = ++this.speakSeq;
    this.introPlaying = false;
    this.session.reportListening(true);
    void this.context.audio.play(heLine('restaurant.help')).finally(() => {
      if (seq === this.speakSeq) this.session.reportListening(false);
    });
    this.context.shell.showHelp(this.context.content.restaurant.helpTextHe, () => {
      this.helpOpen = false;
      this.session.reportInteraction();
      // Closing the card cuts the help line and repeats the food request.
      if (this.round && !this.round.done) void this.speakPrompt();
    });
  }

  /** Tapping the animal repeats the request. Static zone over the visible animal. */
  private createAnimalHitArea(): void {
    const h = this.layout.animal.hit;
    this.animalHit = this.add
      .zone((h.left + h.right) / 2, (h.top + h.bottom) / 2, h.right - h.left, h.bottom - h.top)
      .setDepth(DEPTH.animalHit)
      .setInteractive({ useHandCursor: true });
    this.animalHit.on('pointerdown', () => {
      if (!this.round || this.round.done) return;
      // Ignore taps while the animal is still hopping in; the intro/request starts by itself.
      if (this.character?.state === 'enter') return;
      this.session.reportInteraction();
      this.character?.poke();
      void this.speakPrompt();
    });
  }

  private pickKind(): string {
    const options = ANIMAL_KINDS.filter((k) => k !== this.lastKind);
    const kind = options[Math.floor(Math.random() * options.length)] ?? ANIMAL_KINDS[0];
    this.lastKind = kind;
    return kind;
  }

  private startRound(): void {
    const token = ++this.roundToken;
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.plates.forEach((p) => p.root.destroy());
    this.plates = [];
    this.character?.destroy();
    this.hintTimer?.remove();
    this.retryTimer?.remove();
    this.retryTimer = undefined;
    this.inputLockedUntil = 0;

    const content = this.context.content.restaurant;
    const settings = this.context.store.getState().settings;
    // One round = trialsPerRound animals of the same language, so each round feeds one skill.
    this.roundLang = nextRoundLanguage(
      this.roundLang,
      this.roundLang === null || this.skills.atRoundBoundary(this.roundLang),
      settings.languages,
    );
    const language = this.roundLang;
    const adaptive = content.adaptive;
    const levelNumber = this.skills.level(language);
    this.level = adaptive.levels[levelNumber - 1] as ChoiceServeLevel;
    if (this.level.choiceCount !== this.layout.plates.xs.length) {
      this.layout = computeRestaurantLayout(this.scale.width, this.scale.height, this.level.choiceCount);
    }
    // Attribute and negation requests need an item with colour variants.
    // Read the familiar foods first: selecting the next item consumes the after-drop flag.
    const familiarIds = this.skills.familiarItemIds(language);
    const targetId = this.skills.selectNextItem(language, eligibleTargetIds(content.items, this.level));
    const spec = buildRound(content.items, this.level, language, Math.random, targetId, content.twoStepFrames, familiarIds);
    this.round = {
      ...spec,
      done: false,
      tries: 0,
      served: [],
      tracker: new TrialTracker(spec.target.item.id, language),
      level: levelNumber,
      skillKey: this.skills.key(language),
    };

    const a = this.layout.animal;
    const character = new Character(this, {
      kind: this.pickKind(),
      x: a.x,
      y: a.feetY,
      displayHeight: a.displayHeight,
      depth: DEPTH.animal,
    });
    this.character = character;
    void character.enter(a.enterFromX).then(() => {
      if (token !== this.roundToken || !this.round || this.round.done) return;
      // The intro plays once per visit, before the very first food request.
      const intro = this.introPending ? heLine('restaurant.intro') : undefined;
      this.introPending = false;
      void this.speakPrompt(intro);
    });

    const { xs, y, spacing, hits } = this.layout.plates;
    spec.choices.forEach((choice, i) => {
      const view = buildPlate(this, choice, spacing, hits[i], xs[i], y);
      if (view.root.input) view.root.input.cursor = 'pointer';
      view.root.on('pointerdown', () => this.choose(view));
      const delay = 120 + i * ANIM_PROFILE.popIn.stagger;
      void popIn(this, view.body, delay).then(() => {
        if (token === this.roundToken && view.body.scene) view.invite = invitePulse(this, view.body, i * 180);
      });
      this.plates.push(view);
    });

    // Voice-only levels give no visual cue: the request is only heard (the animal can be tapped to repeat it).
    if (showsPromptBubble(spec.audioOnly)) this.context.shell.setPromptBubble(spec.promptText, () => this.speakPrompt());
    else this.context.shell.clearPromptBubble();

    if (this.ageConfig.hintMode === 'demonstrate') {
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
    }
  }

  /**
   * Speaks the food request, optionally preceded by one Hebrew narrator line. Narrator lines
   * are awaited (never overlapped) and do not animate the animal; only the food request does.
   * A newer call (tap on the animal, hint, help) supersedes an older one.
   */
  private async speakPrompt(before?: SpeechRequest): Promise<void> {
    // While the help card is open only the help line may talk; closing it repeats the request.
    if (!this.round || this.helpOpen) return;
    const seq = ++this.speakSeq;
    const round = this.round;
    this.session.reportListening(true);
    if (before) {
      this.introPlaying = before.lineId === 'he.restaurant.intro';
      try {
        await this.context.audio.play(before);
      } finally {
        if (seq === this.speakSeq) this.introPlaying = false;
      }
      if (seq !== this.speakSeq || round.done || this.round !== round) {
        if (seq === this.speakSeq) this.session.reportListening(false);
        return;
      }
    }
    // Lines without a static clip (colour, two-item and negation requests) fall back to device TTS in the audio layer.
    const speech = this.context.audio.play({ lineId: this.round.lineId, lang: this.round.language, text: this.round.promptText });
    void this.character?.talk(speech);
    try {
      await speech;
    } finally {
      // A newer voice flow owns the flag now; clearing it here would mark the child as idle.
      if (seq === this.speakSeq) this.session.reportListening(false);
    }
  }

  /** Test hook data: where the plates are (game coordinates) and which one is correct. */
  getRoundInfo(): RoundInfo | null {
    if (!this.round || this.round.done) return null;
    const round = this.round;
    const hit = this.layout.animal.hit;
    const characterState = this.character?.state ?? 'none';
    const correctIndices = this.plates.flatMap((p, i) => (this.isPending(p) ? [i] : []));
    return {
      correctIndex: correctIndices.length > 0 ? correctIndices[0] : -1,
      correctIndices,
      request: round.request,
      visualCue: !round.audioOnly,
      choiceCount: this.plates.length,
      choiceCenters: this.plates.map((p) => ({ x: p.root.x, y: p.root.y })),
      animalHit: hit,
      animalCenter: { x: (hit.left + hit.right) / 2, y: (hit.top + hit.bottom) / 2 },
      language: round.language,
      promptText: round.promptText,
      tries: round.tries,
      level: round.level,
      skillKey: round.skillKey,
      correctCount: this.correctCount,
      characterState,
      ready: characterState !== 'enter' && this.plates.every((p) => Math.abs(p.body.scaleX - 1) < 0.1 && p.body.scaleX > 0.9),
    };
  }

  /** A requested plate that has not been served yet. */
  private isPending(view: PlateView): boolean {
    const round = this.round;
    return Boolean(round) && !round!.served.includes(view) && isRequestedChoice(view.choice, round!.targets);
  }

  private correctPlate(): PlateView | undefined {
    return this.plates.find((p) => this.isPending(p));
  }

  private giveHint(before?: SpeechRequest): void {
    if (!this.round || this.round.done) return;
    // Do not talk over the intro or the help line; look again a bit later.
    if (this.introPlaying || this.helpOpen) {
      this.hintTimer?.remove();
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(before));
      return;
    }
    // Only the idle auto-hint before the first tap counts as a hint (later ones follow a recorded miss).
    this.round.tracker.onHint();
    // A voice-only level shows nothing of the request: the hint is the spoken request again, with
    // no pulse or sparkle on the answer plate.
    const view = this.round.audioOnly ? undefined : this.correctPlate();
    if (view) {
      void hintPulse(this, view.root, view.root.scaleX);
      Juice.for(this).burst('sparkle', view.root.x, view.root.y);
    }
    this.context.sfx.hint();
    void this.speakPrompt(before);
  }

  private choose(view: PlateView): void {
    if (!this.round || this.round.done) return;
    if (this.time.now < this.inputLockedUntil) return;
    // A plate that was already served for a two-item request is gone; tapping it is not an answer.
    if (this.round.served.includes(view)) return;
    this.session.reportInteraction();
    void pressSquash(this, view.root);

    const correct = this.isPending(view);
    const remaining = this.round.targets.length - this.round.served.length - 1;
    // Once per trial: a wrong tap is the miss; a correct tap counts only when it completes the request.
    const result = this.round.tracker.onPlateTap(correct, correct ? remaining : 0);
    if (result) this.skills.record(this.round.language, result);

    if (correct && remaining > 0) {
      this.serveFirstOfTwo(view);
      return;
    }
    if (correct) {
      this.round.done = true;
      this.hintTimer?.remove();
      this.retryTimer?.remove();
      void this.onCorrect(view);
      return;
    }

    this.round.tries++;
    this.inputLockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    void wobble(this, view.body);
    void this.character?.hmm();
    const token = this.roundToken;
    const retry = shouldSayRetry(this.round.tries) ? heVariant('retry') : undefined;
    const later = (fn: () => void) => {
      this.retryTimer?.remove();
      this.retryTimer = this.time.delayedCall(HINT_AFTER_HMM_MS, () => {
        if (token === this.roundToken && this.round && !this.round.done) fn();
      });
    };
    if (this.ageConfig.hintMode === 'demonstrate') {
      this.context.sfx.tap();
      later(() => this.giveHint(retry));
    } else {
      this.context.sfx.hint();
      if (this.round.tries >= 2) later(() => this.giveHint());
      else later(() => void this.speakPrompt(retry));
    }
  }

  /** First plate of a two-item request: its food flies to the animal, the other plates stay tappable. */
  private serveFirstOfTwo(view: PlateView): void {
    const round = this.round!;
    round.served.push(view);
    view.invite?.stop();
    view.invite = undefined;
    view.root.disableInteractive();
    this.context.sfx.tap();
    Juice.for(this).burst('sparkle', view.root.x, view.root.y);
    const mouth = this.character
      ? this.character.mouthPoint()
      : new Phaser.Math.Vector2(this.layout.animal.x, this.layout.animal.hitTop);
    for (const [i, food] of view.foods.entries()) {
      detachFood(this, food);
      void flyArc(this, food, mouth.x, mouth.y, { delay: 120 + i * ANIM_PROFILE.flyArc.stagger, spin: 25 }).then(() => {
        if (food.scene) food.destroy();
      });
    }
    void popOut(this, view.root, 200);
    // Say the request again so the child knows the second food is still wanted. This is not a
    // hint (it never touches the tracker) and it is the only prompt on the idle-hint-free age-5 track.
    const token = this.roundToken;
    this.time.delayedCall(SECOND_PLATE_REPLAY_MS, () => {
      if (token === this.roundToken && this.round && !this.round.done) void this.speakPrompt();
    });
  }

  private async onCorrect(view: PlateView): Promise<void> {
    const token = this.roundToken;
    const alive = () => token === this.roundToken;
    const character = this.character;
    const round = this.round!;
    const juice = Juice.for(this);

    this.context.sfx.yay();
    this.speakSeq++;
    this.introPlaying = false;
    this.correctCount++;
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();

    view.invite?.stop();
    view.invite = undefined;
    juice.burst('sparkle', view.root.x, view.root.y);
    this.plates.forEach((p, i) => {
      if (p === view || round.served.includes(p)) return;
      p.invite?.stop();
      p.root.disableInteractive();
      void popOut(this, p.root, 80 + i * 60);
    });

    // Food flies on an arc into the animal's mouth, one piece after another.
    const mouth = character ? character.mouthPoint() : new Phaser.Math.Vector2(this.layout.animal.x, this.layout.animal.hitTop);
    const flights = view.foods.map((food, i) => {
      detachFood(this, food);
      return flyArc(this, food, mouth.x, mouth.y, { delay: 120 + i * ANIM_PROFILE.flyArc.stagger, spin: 25 }).then(() => {
        if (food.scene) food.destroy();
      });
    });
    void popOut(this, view.root, 200);
    await Promise.all(flights);
    if (!alive()) return;

    if (character) await character.munch();
    if (!alive()) return;

    // Celebration: stars + confetti, happy bounce with hearts, star flies to the counter.
    const head = character ? character.headPoint() : mouth;
    juice.burst('star', head.x, head.y);
    juice.burst('confetti', this.layout.animal.x, head.y - 40);
    this.flyStarToCounter(head.x, head.y);

    const lang = round.language;
    const lines = this.context.content.restaurant.thanks[lang];
    const thanksIndex = Math.floor(Math.random() * lines.length);
    const thanks = this.context.audio.play({ lineId: `thanks.${lang}.${thanksIndex}`, lang, text: lines[thanksIndex] });
    if (character) {
      await character.happy();
      if (!alive()) return;
      await Promise.race([character.talk(thanks), wait(this, THANKS_MAX_WAIT_MS)]);
    } else {
      await Promise.race([thanks, wait(this, THANKS_MAX_WAIT_MS)]);
    }
    if (!alive()) return;
    await this.afterThanks(thanks, alive);
    if (!alive()) return;

    this.session.reportCelebrating(false);
    if (character) await character.exit(this.layout.animal.exitToX);
    if (!alive()) return;
    this.startRound();
  }

  /**
   * Optional Hebrew follow-ups after the thanks line: a praise variant on every 3rd correct
   * answer, otherwise (at this calm moment) the leisure-earned line if a minute was gained.
   * Each line is awaited so nothing overlaps; the animal does not "talk" for them.
   */
  private async afterThanks(thanks: Promise<unknown>, alive: () => boolean): Promise<void> {
    const praise = shouldPraise(this.correctCount);
    if ((!praise && !this.earnedPending) || this.helpOpen) return;
    // Let the thanks line finish first (bounded), so the follow-up never cuts it off.
    await Promise.race([thanks, wait(this, THANKS_BEFORE_PRAISE_MAX_MS)]);
    if (!alive() || this.helpOpen) return;
    const line = praise ? heVariant('praise') : heLine('leisure.earned');
    if (!praise) this.earnedPending = false;
    await Promise.race([this.context.audio.play(line), wait(this, NARRATOR_MAX_WAIT_MS)]);
  }

  /** A star flies from the animal to the HUD star pill, which then bumps. */
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
    const star = this.add.image(fromX, fromY, fxTextureKey(this, 'star')).setDepth(DEPTH.flyingFood + 1).setScale(0.9);
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

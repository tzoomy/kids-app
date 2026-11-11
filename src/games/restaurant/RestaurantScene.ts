import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { ANIMAL_KINDS } from '../../assets/vectorArt';
import { buildRound, isCorrectChoice, pickLanguage, type RoundSpec } from '../templates/choiceServe';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig } from '../../content/schema';
import { Character } from '../../anim/Character';
import { Juice, fxTextureKey } from '../../anim/juice';
import { ANIM_PROFILE } from '../../anim/profiles';
import { isReducedMotion } from '../../anim/motion';
import { transitionTo } from '../../anim/transitions';
import { flyArc, hintPulse, invitePulse, popIn, popOut, pressSquash, wait, wobble } from '../../anim/tweens';
import { computeRestaurantLayout, type RestaurantLayout } from './restaurantLayout';
import { DEPTH, addCounterFront, buildPlate, detachFood, paintBackground, type PlateView } from './restaurantArt';

interface ActiveRound extends RoundSpec {
  done: boolean;
  tries: number;
}

/** Pause after a wrong tap so the gentle "hmm" reads before the hint/retry speech. */
const HINT_AFTER_HMM_MS = 450;
/** Never wait longer than this for the thanks line before the next animal. */
const THANKS_MAX_WAIT_MS = 2600;

export class RestaurantScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private ageConfig!: AgeTrackConfig;
  private layout!: RestaurantLayout;
  private round: ActiveRound | null = null;
  private character?: Character;
  private animalHit?: Phaser.GameObjects.Zone;
  private plates: PlateView[] = [];
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;
  /** Incremented per round and on shutdown; async flows bail when it changes. */
  private roundToken = 0;
  private lastKind = '';
  private helpOpen = false;

  constructor() {
    super('RestaurantScene');
  }

  create(): void {
    this.context = this.game.registry.get('appContext') as AppContext;
    const profile = this.context.store
      .getState()
      .profiles.find((p) => p.id === this.context.requireProfileId());
    this.ageConfig = this.context.content.restaurant.ageTracks[profile?.ageTrack ?? 'age5'];
    this.round = null;
    this.character = undefined;
    this.plates = [];
    this.helpOpen = false;

    this.session = this.context.createLearningSession();
    this.session.start();

    this.visibilityHandler = () => this.session.setHidden(document.hidden);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.time.addEvent({
      delay: 1000,
      loop: true,
      callback: () => {
        this.session.tick(1);
        this.context.store.persist();
        // Re-rendering the chrome also clears the shell overlay, which would close
        // the help card, so skip the refresh while help is open.
        if (!this.helpOpen) this.refreshChrome();
      },
    });

    this.layout = computeRestaurantLayout(this.scale.width, this.scale.height, this.ageConfig.choiceCount);
    paintBackground(this, this.layout);
    addCounterFront(this, this.layout);
    this.createAnimalHitArea();

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.refreshChrome();
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
  }

  private profileState() {
    return this.context.store.getProfileState(this.context.requireProfileId(), new Date(this.context.nowMs()));
  }

  private refreshChrome(): void {
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
    // The chrome render replaces the whole chrome root, prompt bubble included.
    if (this.round && !this.round.done) this.context.shell.setPromptBubble(this.round.promptText, () => this.speakPrompt());
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
    this.context.shell.showHelp(this.context.content.restaurant.helpTextHe, () => {
      this.helpOpen = false;
      this.session.reportInteraction();
    });
  }

  /** Tapping the animal repeats the request. Static zone over the visible animal. */
  private createAnimalHitArea(): void {
    const a = this.layout.animal;
    const visible = this.layout.counter.top - a.hitTop;
    this.animalHit = this.add
      .zone(a.x, a.hitTop + visible / 2, a.displayHeight * 0.75, visible)
      .setDepth(DEPTH.animalHit)
      .setInteractive({ useHandCursor: true });
    this.animalHit.on('pointerdown', () => {
      if (!this.round || this.round.done) return;
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

    const content = this.context.content.restaurant;
    const settings = this.context.store.getState().settings;
    const language = pickLanguage(settings.languages);
    const spec = buildRound(content.items, this.ageConfig, language);
    this.round = { ...spec, done: false, tries: 0 };

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
      if (token === this.roundToken && this.round && !this.round.done) void this.speakPrompt();
    });

    const { xs, y, spacing } = this.layout.plates;
    spec.choices.forEach((choice, i) => {
      const view = buildPlate(this, choice, spacing);
      view.root.setPosition(xs[i], y);
      view.root.setInteractive({ useHandCursor: true });
      view.root.on('pointerdown', () => this.choose(view));
      const delay = 220 + i * ANIM_PROFILE.popIn.stagger;
      void popIn(this, view.body, delay).then(() => {
        if (token === this.roundToken && view.body.scene) view.invite = invitePulse(this, view.body, i * 180);
      });
      this.plates.push(view);
    });

    this.context.shell.setPromptBubble(spec.promptText, () => this.speakPrompt());

    if (this.ageConfig.hintMode === 'demonstrate') {
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
    }
  }

  private async speakPrompt(): Promise<void> {
    if (!this.round) return;
    this.session.reportListening(true);
    const lineId = `food.${this.round.target.item.id}.${this.round.target.count}.${this.round.language}`;
    const speech = this.context.audio.play({ lineId, lang: this.round.language, text: this.round.promptText });
    void this.character?.talk(speech);
    try {
      await speech;
    } finally {
      this.session.reportListening(false);
    }
  }

  private correctPlate(): PlateView | undefined {
    const round = this.round;
    if (!round) return undefined;
    return this.plates.find((p) => isCorrectChoice(p.choice, round.target));
  }

  private giveHint(): void {
    if (!this.round || this.round.done) return;
    const view = this.correctPlate();
    if (view) {
      void hintPulse(this, view.root);
      Juice.for(this).burst('sparkle', view.root.x, view.root.y);
    }
    this.context.sfx.hint();
    void this.speakPrompt();
  }

  private choose(view: PlateView): void {
    if (!this.round || this.round.done) return;
    this.session.reportInteraction();
    void pressSquash(this, view.root);

    if (isCorrectChoice(view.choice, this.round.target)) {
      this.round.done = true;
      this.hintTimer?.remove();
      void this.onCorrect(view);
      return;
    }

    this.round.tries++;
    void wobble(this, view.body);
    void this.character?.hmm();
    const token = this.roundToken;
    const later = (fn: () => void) =>
      this.time.delayedCall(HINT_AFTER_HMM_MS, () => {
        if (token === this.roundToken && this.round && !this.round.done) fn();
      });
    if (this.ageConfig.hintMode === 'demonstrate') {
      this.context.sfx.tap();
      later(() => this.giveHint());
    } else {
      this.context.sfx.hint();
      if (this.round.tries >= 2) later(() => this.giveHint());
      else later(() => void this.speakPrompt());
    }
  }

  private async onCorrect(view: PlateView): Promise<void> {
    const token = this.roundToken;
    const alive = () => token === this.roundToken;
    const character = this.character;
    const round = this.round!;
    const juice = Juice.for(this);

    this.context.sfx.yay();
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
      if (p === view) return;
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

    this.session.reportCelebrating(false);
    if (character) await character.exit(this.layout.animal.exitToX);
    if (!alive()) return;
    this.startRound();
  }

  /** A star flies from the animal to the HUD star pill, which then bumps. */
  private flyStarToCounter(fromX: number, fromY: number): void {
    const target = this.starPillGamePoint();
    const finish = () => {
      if (!this.sys.isActive()) return;
      this.refreshChrome();
      this.bumpStarPill();
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

  private starPill(): HTMLElement | undefined {
    const pills = document.querySelectorAll<HTMLElement>('.shell-pill');
    return Array.from(pills).find((p) => p.textContent?.trim().startsWith('⭐'));
  }

  private starPillGamePoint(): { x: number; y: number } | undefined {
    const pill = this.starPill();
    const canvas = this.game.canvas;
    if (!pill || !canvas) return undefined;
    const r = pill.getBoundingClientRect();
    const c = canvas.getBoundingClientRect();
    if (c.width === 0 || c.height === 0) return undefined;
    return {
      x: ((r.left + r.width / 2 - c.left) / c.width) * this.scale.width,
      y: ((r.top + r.height / 2 - c.top) / c.height) * this.scale.height,
    };
  }

  private bumpStarPill(): void {
    const pill = this.starPill();
    if (!pill || typeof pill.animate !== 'function') return;
    const peak = isReducedMotion() ? 1.08 : 1.35;
    pill.animate([{ transform: 'scale(1)' }, { transform: `scale(${peak})` }, { transform: 'scale(1)' }], {
      duration: 420,
      easing: 'cubic-bezier(0.3, 1.6, 0.5, 1)',
    });
  }
}

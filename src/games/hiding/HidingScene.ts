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
import { loadOutfitArt } from '../../core/wardrobe/outfitArt';
import { currentOutfitItems, dressCharacter, wearsOutfit } from '../../core/wardrobe/dress';
import { TrialTracker, nextRoundLanguage } from '../restaurant/trialTracker';
import { crossedWholeMinute, shouldPraise, shouldSayRetry, showsPromptBubble } from '../restaurant/voiceRules';
import { type Lang } from '../templates/choiceServe';
import type { SpeechRequest } from '../../core/audio/types';
import { MISSING_INTRO_HE_ID, buildHidingRound, eligibleAnimalIds, isCorrectBush, missingLines, type HidingRoundSpec } from './hidingRound';
import { computeShadowLayout, type ShadowSlot } from './shadowLayout';
import { animalFeetY, computeHidingLayout, BUSH_ART, type BushSlot, type HidingLayout } from './hidingLayout';

export interface HidingRoundInfo {
  /**
   * 'hiding' (find the hiding animal) or 'missing' (age-5 "Who is missing?", L9-L10); lets a test tell this round apart
   * from a restaurant round. On a missing round the choices are the answer cards.
   */
  request: 'hiding' | 'missing';
  /** Missing rounds: 'peek' (line-up), 'gone' (one runs away), 'back' (the others return) or 'answer' (cards). */
  phase?: 'peek' | 'gone' | 'back' | 'answer';
  /** Missing rounds: the line-up animals in bush order (the target is the one that runs away). */
  lineupIds?: string[];
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
  /** Current scaleX of the correct bush's front foliage (setDisplaySize, so not 1). */
  correctFrontScale: number;
  /** Visible span (game px) of the correct animal above the front foliage's current top. */
  correctPeek: number;
  /** L8 short sound word when true. */
  shortSound: boolean;
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

/** A standing answer animal on a "Who is missing?" round. */
interface CardView {
  animal: HidingAnimal;
  slot: ShadowSlot;
  character: Character;
  ground: Phaser.GameObjects.Ellipse;
  zone: Phaser.GameObjects.Zone;
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
/** Missing rounds: how long the line-up animals take to duck into or rise out of their bushes. */
const MISSING_MOVE_MS = 380;
/** Missing rounds: cap for the Hebrew rule line and the short EN/FR lines between phases. */
const MISSING_LINE_MAX_MS = 4500;

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
  private cards: CardView[] = [];
  private missingPhase: 'peek' | 'gone' | 'back' | 'answer' | null = null;
  /** The Hebrew "Who is missing?" rule line plays before the first missing round of a visit. */
  private missingIntroPending = true;
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
    this.cards = [];
    this.missingPhase = null;
    this.missingIntroPending = true;
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
    this.clearCards();
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
    this.clearCards();
    this.missingPhase = null;
    this.hintTimer?.remove();
    this.retryTimer?.remove();
    this.retryTimer = undefined;
    this.inputLockedUntil = 0;
    this.ready = false;
    this.hinted = false;

    const content = this.context.content.hiding;
    // One round = trialsPerRound trials in the same language, so each round feeds one skill.
    this.roundLang = nextRoundLanguage(
      this.roundLang,
      this.roundLang === null || this.skills.atRoundBoundary(this.roundLang),
      this.context.languageSetting(),
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

    if (spec.level.missing && spec.cards) {
      void this.playMissingRound(token, spec);
      return;
    }

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

  private clearCards(): void {
    for (const c of this.cards) {
      c.character.destroy();
      c.ground.destroy();
      c.zone.destroy();
    }
    this.cards = [];
  }

  // ---------------------------------------------------------------- who is missing (age 5, L9-L10)

  /** Tweens an animal's feet to `y` (duck into or rise out of its bush). */
  private moveAnimal(view: BushView, y: number): Promise<void> {
    return new Promise((resolve) => {
      this.tweens.add({ targets: view.character.root, y, duration: isReducedMotion() ? 1 : MISSING_MOVE_MS, ease: 'Sine.easeInOut', onComplete: () => resolve() });
    });
  }

  private playLine(lineId: string, lang: 'he' | Lang, text: string): Promise<void> {
    return Promise.race([this.context.audio.play({ lineId, lang, text }).then(() => undefined), wait(this, MISSING_LINE_MAX_MS)]);
  }

  /**
   * "Who is missing?": the line-up stands in front of the bushes (peek), everyone hides and one runs away (gone), the
   * others come back for a moment and hide again (back), then the whole line-up stands as answer cards (answer).
   * Nothing is tappable before the answer phase, so no try or hint can be recorded early.
   */
  private async playMissingRound(token: number, spec: HidingRoundSpec): Promise<void> {
    const alive = () => token === this.roundToken && this.round !== null && !this.round.done;
    const content = this.context.content.hiding;
    const lang = spec.language;
    const lines = missingLines(content, lang)!;
    this.layout = computeHidingLayout(this.scale.width, this.scale.height, spec.level.choiceCount);
    this.buildReplayButton();
    this.context.shell.clearPromptBubble();
    this.missingPhase = 'peek';
    await Promise.all(spec.choices.map((animal, i) => this.buildBush(animal, this.layout.bushes[i], spec, i)));
    if (!alive()) return;

    // The general hiding intro does not describe this rule; the missing intro replaces it once per visit.
    this.introPending = false;
    this.session.reportListening(true);
    if (this.missingIntroPending && content.missing) {
      this.missingIntroPending = false;
      await this.playLine(MISSING_INTRO_HE_ID, 'he', content.missing.introHe);
      if (!alive()) return;
    }
    this.bushes.forEach((b) => void b.character.happy());
    await Promise.all([this.playLine(lines.look.lineId, lang, lines.look.text), wait(this, spec.level.peekMs)]);
    if (!alive()) return;

    // Everyone hides; the target runs away while hidden.
    this.missingPhase = 'gone';
    const down = (b: BushView) => b.slot.topY + b.slot.animalHeight + 12;
    await Promise.all(this.bushes.map((b) => this.moveAnimal(b, down(b))));
    if (!alive()) return;
    const leaver = this.bushes.find((b) => b.animal.id === spec.target.id);
    leaver?.character.root.setVisible(false);
    this.bushes.forEach((b) => void this.rustleBush(b));
    await this.playLine(lines.gone.lineId, lang, lines.gone.text);
    if (!alive()) return;

    // The others come back for a moment, then hide again.
    this.missingPhase = 'back';
    const stayers = this.bushes.filter((b) => b !== leaver);
    await Promise.all(stayers.map((b) => this.moveAnimal(b, b.hiddenY)));
    if (!alive()) return;
    await wait(this, spec.level.backMs);
    if (!alive()) return;
    await Promise.all(stayers.map((b) => this.moveAnimal(b, down(b))));
    if (!alive()) return;
    this.session.reportListening(false);

    // Answer: the line-up stands as cards; tap the one that ran away.
    this.clearBushes();
    this.buildReplayButton();
    const slots = computeShadowLayout(this.scale.width, this.scale.height, spec.cards!.length).slots;
    await Promise.all(spec.cards!.map((animal, i) => this.buildCard(animal, slots[i], i)));
    if (!alive()) return;
    this.missingPhase = 'answer';
    this.ready = true;
    if (showsPromptBubble(spec.level.audioOnly)) this.context.shell.setPromptBubble(spec.promptText, () => this.replay());
    void this.speakPrompt();
    this.scheduleIdleHint();
  }

  private buildCard(animal: HidingAnimal, slot: ShadowSlot, index: number): Promise<void> {
    const ground = this.add.ellipse(slot.x, slot.feetY, slot.animalHeight * 0.8, slot.animalHeight * 0.16, 0x3b2a22, 0.18).setDepth(slot.row * 10);
    const character = new Character(this, { kind: animal.kind, x: slot.x, y: slot.feetY, displayHeight: slot.animalHeight, depth: slot.row * 10 + 2 });
    this.dressBear(character, animal.kind);
    const hit = slot.hit;
    const zone = this.add
      .zone((hit.left + hit.right) / 2, (hit.top + hit.bottom) / 2, hit.right - hit.left, hit.bottom - hit.top)
      .setDepth(DEPTH.zone)
      .setInteractive({ useHandCursor: true });
    const view: CardView = { animal, slot, character, ground, zone };
    zone.on('pointerdown', () => this.chooseCard(view));
    this.cards.push(view);
    const delay = 120 + index * ANIM_PROFILE.popIn.stagger;
    return Promise.all([popIn(this, ground, delay, ground.scaleX), popIn(this, character.root, delay, character.root.scaleX)]).then(() => undefined);
  }

  private chooseCard(view: CardView): void {
    const round = this.round;
    if (!round || round.done || !this.ready || this.missingPhase !== 'answer') return;
    if (this.time.now < this.inputLockedUntil) return;
    this.session.reportInteraction();
    void pressSquash(this, view.character.root);
    const correct = view.animal.id === round.target.id;
    const result = round.tracker.onPlateTap(correct, 0);
    if (result) this.skills.record(round.language, result);
    if (correct) {
      round.done = true;
      this.hintTimer?.remove();
      this.retryTimer?.remove();
      void this.onMissingCorrect(view);
      return;
    }
    round.tries++;
    this.inputLockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    void wobble(this, view.character.root);
    void view.character.hmm();
    this.retryAfterMiss(round);
  }

  private async onMissingCorrect(view: CardView): Promise<void> {
    const token = this.roundToken;
    const alive = () => token === this.roundToken;
    const juice = Juice.for(this);
    const round = this.round!;
    this.context.sfx.yay();
    this.speakSeq++;
    this.correctCount++;
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.complete();
    this.context.recordCompletedRound('nature-lab', 'who-is-hiding');
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    this.cards.forEach((c) => c.zone.disableInteractive());
    const head = view.character.headPoint();
    juice.burst('star', head.x, head.y);
    juice.burst('confetti', view.slot.x, head.y - 30);
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

  /** The bear wears the profile's outfit (no-op for the other animals); the art loads lazily and re-dresses on arrival. */
  private dressBear(character: Character, kind: string): void {
    if (!wearsOutfit(kind)) return;
    const items = currentOutfitItems(window.localStorage, this.context.requireProfileId(), this.context.currentAgeTrack());
    dressCharacter(this, character, kind, items);
    loadOutfitArt(this, kind, items, () => {
      dressCharacter(this, character, kind, items);
    });
  }

  /** One bush with its hiding animal; resolves once everything has popped in. */
  private buildBush(animal: HidingAnimal, slot: BushSlot, spec: HidingRoundSpec, index: number): Promise<void> {
    const back = this.bushImage(slot.shape, 'back', slot).setDepth(slot.depth + 1);
    const front = this.bushImage(slot.shape, 'front', slot).setDepth(slot.depth + 3);
    const hiddenY = animalFeetY(slot.topY, slot.animalHeight, spec.level.reveal);
    const character = new Character(this, { kind: animal.kind, x: slot.x, y: hiddenY, displayHeight: slot.animalHeight, depth: slot.depth + 2 });
    this.dressBear(character, animal.kind);
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

  private correctBushVisuals(correctIndex: number): { correctFrontScale: number; correctPeek: number } {
    const view = this.bushes[correctIndex];
    if (!view) return { correctFrontScale: 1, correctPeek: 0 };
    const front = view.front as Phaser.GameObjects.Components.Transform & { displayHeight?: number };
    const scale = front.scaleX;
    const displayH = front.displayHeight ?? view.slot.height * Math.abs(scale);
    const foliageTop = front.y - displayH * (1 - BUSH_ART[view.slot.shape].topFrac);
    const headY = view.character.root.y - view.slot.animalHeight;
    return { correctFrontScale: scale, correctPeek: foliageTop - headY };
  }

  getRoundInfo(): HidingRoundInfo | null {
    if (!this.round || this.round.done) return null;
    const round = this.round;
    const missing = round.level.missing;
    const correctIndex = missing
      ? this.cards.findIndex((c) => c.animal.id === round.target.id)
      : this.bushes.findIndex((b) => isCorrectBush(b.animal.id, round.target.id));
    const center = (r: { left: number; right: number; top: number; bottom: number }) => ({ x: (r.left + r.right) / 2, y: (r.top + r.bottom) / 2 });
    return {
      request: missing ? 'missing' : 'hiding',
      ...(missing ? { phase: this.missingPhase ?? 'peek', lineupIds: round.choices.map((a) => a.id) } : {}),
      correctIndex,
      choiceIds: missing ? this.cards.map((c) => c.animal.id) : this.bushes.map((b) => b.animal.id),
      targetId: round.target.id,
      choiceCenters: missing ? this.cards.map((c) => center(c.slot.hit)) : this.bushes.map((b) => center(b.slot.hit)),
      replayCenter: { x: this.layout.replay.x, y: this.layout.replay.y },
      choiceCount: missing ? this.cards.length : this.bushes.length,
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
      ...this.correctBushVisuals(correctIndex),
      shortSound: round.level.shortSound,
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
    const card = round.level.missing ? this.cards.find((c) => c.animal.id === round.target.id) : undefined;
    if (card && !round.level.audioOnly) {
      void hintPulse(this, card.character.root, card.character.root.scaleX);
      Juice.for(this).burst('sparkle', card.slot.x, card.slot.feetY - card.slot.animalHeight);
    }
    const view = this.bushes.find((b) => isCorrectBush(b.animal.id, round.target.id));
    // A voice-only level shows nothing of the answer: the hint is the spoken request plus a clue.
    if (view && !round.level.audioOnly) {
      void rustleBush(this, view.front);
      void hintPulse(this, view.front, view.front.scaleX);
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
    this.retryAfterMiss(round);
  }

  /** After a wrong tap: the gentle retry line, then the request (age 5) or the hint (age 2, or a second miss). */
  private retryAfterMiss(round: ActiveRound): void {
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
    this.context.recordCompletedRound('nature-lab', 'who-is-hiding');
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

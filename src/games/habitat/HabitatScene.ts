// HabitatScene: Who Lives Here? (Nature Lab). Spec: docs/specs/who-lives-here.md.
//
// CONTRACT (implemented against the tests; do not change these without a spec change):
// - Scene key: 'HabitatScene'. Started from the Nature Lab game picker (src/worlds/MapScene.ts).
// - create() calls setAppScreen('habitat') and sets window.__GAME_READY__ = true.
// - `getHabitatInfo(): HabitatInfo | null` (src/games/habitat/types.ts). Rectangles are page CSS px (see
//   src/testing/pageRect.ts, `gameRectToPageRect`). Return null when no round exists; `ready` is true only when the
//   current animal is on the path and home taps are accepted.
// - Hooks live in src/game/createGame.ts under ?e2e=1: `getHabitatInfo()` and `seedHabitatLevel(level)`.
//   They only read or seed state; they never act in the game or navigate.
// - Chrome test ids: hud-back, hud-help, prompt-bubble, help-card, help-card-close, star-count, leisure-balance (the
//   restaurant HUD, the prompt bubble and the help overlay via context.shell).
// - Pure rules live in ./habitatRound.ts, layout in ./habitatLayout.ts, voice in ./habitatVoice.ts. The scene reuses
//   the Sorting Beds trial tracker, wrong-tap lock, shake and hop helpers, and the shared adaptive engine.
// - One tap on a home places the current animal (no select step). A wrong tap keeps the animal on the path and locks
//   home taps for WRONG_TAP_LOCK_MS; it is never a failure. Tapping the animal replays the request and is not a hint.
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import type { LearningSession } from '../../core/leisure';
import { buildMeta, type GameLevelsMeta, type SkillSession } from '../../core/adaptive';
import type { AgeTrackConfig, HabitatAnimal, HabitatHome, WhoLivesHereContent } from '../../content/schema';
import { Character } from '../../anim/Character';
import { Juice } from '../../anim/juice';
import { homeArtKey, sceneArtKey } from '../../anim/artRegistry';
import { ANIM_PROFILE } from '../../anim/profiles';
import { settleInHome, walkHome } from '../../anim/homesTrainMotion';
import { transitionTo } from '../../anim/transitions';
import { hintPulse, popIn, wait } from '../../anim/tweens';
import { setAppScreen } from '../../pwa';
import { gameRectToPageRect } from '../../testing/pageRect';
import type { Lang } from '../templates/choiceServe';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import { SortingTrialTracker, WRONG_TAP_LOCK_MS } from '../sorting/sortingLogic';
import { hopToward, shakeBed } from '../sorting/sortingMotion';
import { addBackground } from '../sorting/sortingArt';
import { rtlIsolate } from '../sorting/sortingVoice';
import { buildHabitatRound, chooseFirstAnimal, levelLevers, type HabitatLevers, type HabitatRoundPlan } from './habitatRound';
import { computeHabitatLayout, type HabitatHomeLayout, type HabitatLayout, type LayoutRect } from './habitatLayout';
import { HABITAT_HE_TEXT, askLines, correctLines, helpLine, wrongLines, type SpeechLine } from './habitatVoice';
import type { HabitatInfo } from './types';

export type { HabitatInfo, HabitatHomeInfo, HabitatCurrentAnimal } from './types';

/** Longest wait for a Hebrew guidance line before the game moves on (device TTS can hang without a voice). */
const HE_LINE_MAX_MS = 3600;
/** Longest wait for one English or French token. */
const WORD_LINE_MAX_MS = 2200;
const ROUND_END_HOLD_MS = 900;
/** Horizontal offsets (fraction of the home art width) for the 1st, 2nd and 3rd animal settled in the same home. */
const SETTLE_OFFSETS = [0, 0.2, -0.2];

interface HomeView {
  home: HabitatHome;
  layout: HabitatHomeLayout;
  /** Art layers: the animal settles between them. */
  back: Phaser.GameObjects.Container;
  front: Phaser.GameObjects.Container;
  highlight: Phaser.GameObjects.Graphics;
  /** Bumped by every pulse; only the latest pulse may hide the highlight. */
  pulseGen: number;
  zone: Phaser.GameObjects.Zone;
  settled: Character[];
  count: number;
}

interface CurrentAnimal {
  animal: HabitatAnimal;
  homeId: string;
  character: Character;
  tries: number;
}

export class HabitatScene extends Phaser.Scene {
  private context!: AppContext;
  private content!: WhoLivesHereContent;
  private session!: LearningSession;
  private skills!: SkillSession;
  private meta!: GameLevelsMeta;
  private ageConfig!: AgeTrackConfig;
  private layout!: HabitatLayout;
  private homes: HomeView[] = [];
  private stageObjects: Phaser.GameObjects.GameObject[] = [];
  private animalZone: Phaser.GameObjects.Zone | null = null;
  private plan: HabitatRoundPlan | null = null;
  private levers: HabitatLevers | null = null;
  private roundLevel = 1;
  private roundLang: Lang = 'en';
  private roundIndex = 0;
  private roundNo = 0;
  private animalIndex = 0;
  private current: CurrentAnimal | null = null;
  private tracker: SortingTrialTracker | null = null;
  private ready = false;
  private lockedUntil = 0;
  private token = 0;
  private speakSeq = 0;
  /** True from a line request until the audio really ends (the speak caps may clear `speaking` earlier). */
  private linePlaying = false;
  private speaking = false;
  private helpOpen = false;
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;

  constructor() {
    super('HabitatScene');
  }

  create(): void {
    setAppScreen('habitat');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.content = this.context.content.habitat;
    const profileId = this.context.requireProfileId();
    const profile = this.context.store.getState().profiles.find((p) => p.id === profileId);
    const track = profile?.ageTrack ?? 'age5';
    const adaptive = this.content.adaptive;
    this.ageConfig = this.content.ageTracks[track];
    this.meta = buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules });
    this.skills = this.context.createSkillSession(this.content.world, this.content.id, this.meta);
    this.session = this.context.createLearningSession();
    this.session.start();
    this.homes = [];
    this.stageObjects = [];
    this.animalZone = null;
    this.plan = null;
    this.levers = null;
    this.current = null;
    this.tracker = null;
    this.ready = false;
    this.helpOpen = false;
    this.speaking = false;
    this.linePlaying = false;
    this.lockedUntil = 0;
    this.roundIndex = 0;
    this.roundNo = 0;
    this.animalIndex = 0;
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

    this.addBackdrop();
    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startRound(true);
    window.__GAME_READY__ = true;
  }

  // -------------------------------------------------------------------------------------------
  // Hook data
  // -------------------------------------------------------------------------------------------

  getHabitatInfo(): HabitatInfo | null {
    if (!this.plan || !this.levers) return null;
    const box = this.game.canvas.getBoundingClientRect();
    const toPage = (r: LayoutRect) =>
      gameRectToPageRect(r, { x: box.left, y: box.top, width: box.width, height: box.height }, { width: this.scale.width, height: this.scale.height });
    const current = this.current;
    const acceptingTaps = this.ready && current !== null && this.time.now >= this.lockedUntil;
    return {
      level: this.roundLevel,
      lang: this.roundLang,
      request: this.levers.request,
      textBubble: !this.levers.audioOnly,
      homes: this.homes.map((h) => ({
        id: h.home.id,
        family: h.home.family,
        count: h.count,
        glowing: h.highlight.alpha > 0,
        hit: toPage(h.layout.hit),
      })),
      currentAnimal:
        current && this.ready
          ? {
              id: current.animal.id,
              homeId: current.homeId,
              tries: current.tries,
              hinted: this.tracker?.isHinted ?? false,
              hit: toPage(this.layout.animal.hit),
            }
          : null,
      round: { index: this.roundNo, total: this.plan.animals.length, placed: this.animalIndex },
      ready: acceptingTaps,
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
    this.homes = [];
    this.stageObjects = [];
    this.animalZone = null;
    this.current = null;
    this.plan = null;
    this.levers = null;
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
    const line = helpLine(this.content.helpTextHe);
    void this.say(line, HE_LINE_MAX_MS);
    this.context.shell.showHelp(line.text, () => {
      this.helpOpen = false;
      this.session.reportInteraction();
    });
  }

  /** The habitats meadow (landscape or portrait art), or the shared soft garden backdrop when the art is missing. */
  private addBackdrop(): void {
    const key = sceneArtKey('habitats', this.scale.width >= this.scale.height ? 'bg-landscape' : 'bg-portrait');
    if (key && this.textures.exists(key)) {
      this.add.image(this.scale.width / 2, this.scale.height / 2, key).setDisplaySize(this.scale.width, this.scale.height).setDepth(0);
      return;
    }
    addBackground(this, this.scale.width, this.scale.height);
  }

  // -------------------------------------------------------------------------------------------
  // Voice
  // -------------------------------------------------------------------------------------------

  /** Requests one line; resolves when it ends or after `maxMs`, whichever comes first. Never blocks forever. */
  private say(line: SpeechLine, maxMs: number): Promise<void> {
    const seq = ++this.speakSeq;
    this.speaking = true;
    this.linePlaying = true;
    this.session.reportListening(true);
    const played = this.context.audio.play({ lineId: line.lineId, lang: line.lang, text: line.text });
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

  private async sayAll(lines: readonly SpeechLine[], token: number): Promise<void> {
    for (const line of lines) {
      if (token !== this.token) return;
      await this.say(line, line.lang === 'he' ? HE_LINE_MAX_MS : WORD_LINE_MAX_MS);
    }
  }

  private showBubble(): void {
    if (!this.levers || this.levers.audioOnly) {
      this.context.shell.clearPromptBubble();
      return;
    }
    this.context.shell.setPromptBubble(rtlIsolate(HABITAT_HE_TEXT['habitat.ask.he']), () => this.replay());
  }

  // -------------------------------------------------------------------------------------------
  // Rounds
  // -------------------------------------------------------------------------------------------

  /**
   * Level timing: the round's level is read here, once per round, and the plan is fixed for the round.
   * Age 2 (levelChange 'between-rounds') changes level only at a round boundary. Age 5 ('after-trial') may record a
   * level change after any placement, but the scene shows it from the NEXT round (a round never changes level midway).
   */
  private startRound(first: boolean): void {
    const token = ++this.token;
    this.hintTimer?.remove();
    this.ready = false;
    this.current = null;
    this.tracker = null;
    this.session.reportCelebrating(false);

    const settings = this.context.store.getState().settings;
    this.roundLang = nextRoundLanguage(first ? null : this.roundLang, this.skills.atRoundBoundary(this.roundLang), settings.languages);
    this.roundLevel = this.skills.level(this.roundLang);
    const level = this.content.adaptive.levels[this.roundLevel - 1];
    this.levers = levelLevers(level);
    this.plan = buildHabitatRound({
      content: this.content,
      levers: this.levers,
      trials: this.meta.rules.trialsPerRound,
      random: Math.random,
      // The engine picks the first animal (a known one right after a level drop; this also clears afterDrop).
      firstAnimalId: chooseFirstAnimal(this.skills, this.roundLang, this.content),
    });
    this.roundNo = this.roundIndex;
    this.roundIndex++;
    this.animalIndex = 0;

    this.buildStage();
    this.showBubble();
    void (async () => {
      await wait(this, 450);
      if (token !== this.token) return;
      this.nextAnimal(token);
    })();
  }

  private destroyStage(): void {
    for (const h of this.homes) {
      h.settled.forEach((c) => c.destroy());
      h.back.destroy(true);
      h.front.destroy(true);
      h.highlight.destroy();
      h.zone.destroy();
    }
    this.homes = [];
    this.current?.character.destroy();
    this.current = null;
    this.stageObjects.forEach((o) => o.destroy());
    this.stageObjects = [];
    this.animalZone?.destroy();
    this.animalZone = null;
  }

  private buildStage(): void {
    this.destroyStage();
    const plan = this.plan!;
    this.layout = computeHabitatLayout(this.scale.width, this.scale.height, plan.homeIds);

    // The path patch the current animal stands on.
    const patch = this.layout.animal.patch;
    const path = this.add.graphics().setDepth(55);
    path.fillStyle(0xead2a8, 1);
    path.fillEllipse(patch.x, patch.y, patch.width * 1.25, patch.height * 1.6);
    path.lineStyle(4, 0xc9a777, 1);
    path.strokeEllipse(patch.x, patch.y, patch.width * 1.25, patch.height * 1.6);
    this.stageObjects.push(path);

    this.layout.homes.forEach((slot, i) => {
      const home = this.content.homes.find((h) => h.id === slot.id)!;
      const cx = slot.art.x + slot.art.width / 2;
      const cy = slot.art.y + slot.art.height / 2;
      const highlight = this.add.graphics().setDepth(18);
      highlight.fillStyle(0xfff3a0, 0.7);
      highlight.fillEllipse(cx, cy + slot.art.height * 0.05, slot.art.width * 1.12, slot.art.height * 1.08);
      highlight.setAlpha(0);
      const back = this.makeHomeLayer(home.id, 'back', slot.art, cx, cy).setDepth(20);
      const front = this.makeHomeLayer(home.id, 'front', slot.art, cx, cy).setDepth(30);
      // Hit area: the whole home column, as a fixed zone so shakes and pulses never move the target.
      const zone = this.add.zone(slot.hit.x + slot.hit.width / 2, slot.hit.y + slot.hit.height / 2, slot.hit.width, slot.hit.height);
      zone.setInteractive();
      const view: HomeView = { home, layout: slot, back, front, highlight, pulseGen: 0, zone, settled: [], count: 0 };
      zone.on('pointerdown', () => this.onHomeTap(view));
      void popIn(this, back, 60 + i * 70);
      void popIn(this, front, 60 + i * 70);
      this.homes.push(view);
    });

    // Tapping the animal on the path replays the request.
    const hit = this.layout.animal.hit;
    this.animalZone = this.add.zone(hit.x + hit.width / 2, hit.y + hit.height / 2, hit.width, hit.height).setDepth(75);
    this.animalZone.setInteractive();
    this.animalZone.on('pointerdown', () => this.replay());
  }

  /** One art layer of a home, centred at (cx, cy); a plain rounded panel when the texture is missing. */
  private makeHomeLayer(homeId: string, layer: 'back' | 'front', art: LayoutRect, cx: number, cy: number): Phaser.GameObjects.Container {
    const container = this.add.container(cx, cy);
    const key = homeArtKey(`${homeId}-${layer}`);
    if (key && this.textures.exists(key)) {
      container.add(this.add.image(0, 0, key).setDisplaySize(art.width, art.height));
    } else if (layer === 'back') {
      const g = this.add.graphics();
      g.fillStyle(0xe9d3a3, 1);
      g.fillRoundedRect(-art.width / 2, -art.height / 2, art.width, art.height, 28);
      g.lineStyle(6, 0x3b2a22, 1);
      g.strokeRoundedRect(-art.width / 2, -art.height / 2, art.width, art.height, 28);
      container.add(g);
    }
    return container;
  }

  private nextAnimal(token: number): void {
    const plan = this.plan;
    if (!plan || token !== this.token) return;
    const spec = plan.animals[this.animalIndex];
    if (!spec) return;
    const animal = this.content.animals.find((a) => a.id === spec.id)!;
    const a = this.layout.animal;
    const character = new Character(this, { kind: animal.kind, x: a.x, y: a.feetY, displayHeight: a.height, depth: 60 });
    this.current = { animal, homeId: spec.homeId, character, tries: 0 };
    this.tracker = new SortingTrialTracker(spec.id, this.roundLang);
    this.context.sfx.pop();
    void character.enter(a.x - Math.min(260, a.x - 40)).then(() => {
      if (token !== this.token || this.current?.character !== character) return;
      this.ready = true;
      if (this.levers?.glow) this.setGlow(this.homeView(spec.homeId), true);
      this.scheduleHint(token);
    });
    // The request is spoken while the animal hops in; taps are accepted as soon as it has landed.
    void this.sayAll(askLines(this.content, animal, this.levers!, this.roundLang), token);
  }

  private homeView(homeId: string): HomeView | undefined {
    return this.homes.find((h) => h.home.id === homeId);
  }

  private setGlow(view: HomeView | undefined, on: boolean): void {
    if (!view) return;
    view.pulseGen++;
    view.highlight.setAlpha(on ? 0.6 : 0);
  }

  private scheduleHint(token: number): void {
    this.hintTimer?.remove();
    this.hintTimer = undefined;
    if (this.ageConfig.hintMode !== 'demonstrate') return; // age 5: no idle hint (help only after a mistake)
    this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(token));
  }

  private giveHint(token: number): void {
    if (token !== this.token || !this.current || !this.ready || !this.tracker || this.tracker.isRecorded) return;
    if (this.tracker.isHinted) return; // one idle hint per trial
    if (this.helpOpen || this.speaking || this.linePlaying) {
      // Wait out a playing line or the open help card, then retry after another hintDelayMs.
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint(token));
      return;
    }
    this.hintTimer = undefined;
    this.tracker.onHint();
    this.context.sfx.hint();
    const target = this.homeView(this.current.homeId);
    if (target) {
      this.pulseHome(target, false);
      Juice.for(this).burst('sparkle', target.layout.art.x + target.layout.art.width / 2, target.layout.art.y);
      void hopToward(this, this.current.character.root, target.layout.settle.x, target.layout.settle.feetY);
    }
    void this.sayAll(askLines(this.content, this.current.animal, this.levers!, this.roundLang), token);
  }

  private replay(): void {
    this.session.reportInteraction();
    const current = this.current;
    if (current && this.levers) {
      this.tracker?.onReplay();
      current.character.poke();
      void this.sayAll(askLines(this.content, current.animal, this.levers, this.roundLang), this.token);
    }
    // A replay is activity: restart the idle-hint countdown (age 2, before the trial's hint or result).
    if (current && this.ready && this.tracker && !this.tracker.isHinted && !this.tracker.isRecorded) {
      this.scheduleHint(this.token);
    }
  }

  /**
   * Pulses a home. A restarted pulse stops the previous one (hintPulse), so only the latest pulse hides the highlight;
   * `highlight` shows it for this pulse (wrong tap), otherwise its current visibility is kept until the pulse ends.
   * The level-1 glow stays on after a pulse.
   */
  private pulseHome(view: HomeView, highlight: boolean): void {
    const gen = ++view.pulseGen;
    const keepGlow = this.levers?.glow === true && this.current?.homeId === view.home.id;
    if (highlight) view.highlight.setAlpha(1);
    void Promise.all([hintPulse(this, view.back), hintPulse(this, view.front)]).then(() => {
      if (view.pulseGen === gen) view.highlight.setAlpha(keepGlow ? 0.6 : 0);
    });
  }

  private onHomeTap(view: HomeView): void {
    if (!this.current || !this.ready || !this.tracker) return;
    if (this.time.now < this.lockedUntil) return; // swallowed by the 400 ms lock: not a try, not an interaction
    this.session.reportInteraction();
    this.context.sfx.tap();
    this.current.tries++;
    const correct = view.home.id === this.current.homeId;
    const result = this.tracker.onBedTap(correct);
    if (result) this.skills.record(this.roundLang, result);
    if (correct) this.placeCurrent(view);
    else this.onWrongHome(view);
  }

  /** A wrong home is never a failure: a soft shake, the right home pulses, the animal tilts "hmm", and a warm retry line. */
  private onWrongHome(view: HomeView): void {
    const current = this.current;
    if (!current) return;
    this.lockedUntil = this.time.now + WRONG_TAP_LOCK_MS;
    this.context.sfx.hint();
    void shakeBed(this, view.back, view.back.x, WRONG_TAP_LOCK_MS);
    void shakeBed(this, view.front, view.front.x, WRONG_TAP_LOCK_MS);
    const target = this.homeView(current.homeId);
    if (target) this.pulseHome(target, true);
    void current.character.hmm();
    void this.sayAll(wrongLines(this.content, current.animal, this.levers!, this.roundLang), this.token);
  }

  private placeCurrent(view: HomeView): void {
    const current = this.current;
    if (!current) return;
    const token = this.token;
    this.ready = false;
    this.hintTimer?.remove();
    this.setGlow(view, false);
    this.current = null;
    const { character, animal } = current;
    // An idle-hint hop may still be running: stop it so its hop-back never pulls the animal during the walk.
    this.tweens.killTweensOf(character.root);
    const a = this.layout.animal;
    character.root.setPosition(a.x, a.feetY).setAngle(0);

    const offset = SETTLE_OFFSETS[Math.min(view.count, SETTLE_OFFSETS.length - 1)] * view.layout.art.width;
    const toX = view.layout.settle.x + offset;
    const toY = view.layout.settle.feetY;
    const restScale = character.root.scaleX * (view.layout.animalHeight / a.height);
    void (async () => {
      await walkHome(this, character.root, toX, toY);
      if (token !== this.token) return;
      // Between the home's back and front layers, so the front rim covers the animal's feet.
      character.root.setDepth(25);
      // settleInHome scales to `restScale * homes.settle.scale`, so divide it out to land on the exact settled scale.
      await settleInHome(this, character.root, toX, toY, restScale / ANIM_PROFILE.homes.settle.scale);
      if (token !== this.token) return;
      view.settled.push(character);
      view.count++;
      this.animalIndex++;
      Juice.for(this).burst('sparkle', toX, toY - view.layout.animalHeight * 0.8);
      this.context.sfx.yay();
      void character.happy();
      this.session.reportCelebrating(true);
      await this.sayAll(correctLines(this.content, animal, this.roundLang), token);
      if (token !== this.token) return;
      this.session.reportCelebrating(false);

      if (this.animalIndex >= this.plan!.animals.length) {
        await this.finishRound(token);
        return;
      }
      this.nextAnimal(token);
    })();
  }

  private async finishRound(token: number): Promise<void> {
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    this.context.shell.updateRestaurantChrome({ starCount: state.stars });
    this.context.sfx.yay();
    Juice.for(this).burst('confetti', this.scale.width / 2, this.scale.height * 0.4);
    await wait(this, ROUND_END_HOLD_MS);
    if (token !== this.token) return;
    this.startRound(false);
  }
}

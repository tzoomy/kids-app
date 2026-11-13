import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import type { LearningSession } from '../../core/leisure';
import { buildMeta, type SkillSession, type TrialResult } from '../../core/adaptive';
import type { AgeTrackConfig, OrchestraInstrumentId, OrchestraSupport, KitchenOrchestraContent } from '../../content/schema';
import { Character } from '../../anim/Character';
import { Juice } from '../../anim/juice';
import { transitionTo } from '../../anim/transitions';
import { popIn, wait } from '../../anim/tweens';
import { glowInstrument, pulseInstrumentGlow, tapInstrument } from '../../anim/worldMotion';
import { instrumentArtKey, fxArtKey, sceneArtKey, keyForUrl } from '../../anim/artRegistry';
import { setAppScreen } from '../../pwa';
import type { Lang } from '../templates/choiceServe';
import { nextRoundLanguage } from '../restaurant/trialTracker';
import {
  buildTrial,
  checkEchoTap,
  keepsGlowLit,
  noteGapMs,
  noteHoldMs,
  replaySpeed,
  showsVisualSupport,
  type OrchestraTrial,
} from './orchestraGame';
import { computeOrchestraLayout, type OrchestraLayout } from './orchestraLayout';
import { OrchestraSounds } from './orchestraSounds';

export interface OrchestraRoundInfo {
  sequence: OrchestraInstrumentId[];
  expectedIndex: number;
  instrumentCenters: Array<{ x: number; y: number; id: OrchestraInstrumentId }>;
  level: number;
  support: OrchestraSupport;
  language: string;
  ready: boolean;
  phase: 'listen' | 'echo' | 'celebrate';
}

class EchoTracker {
  private hinted = false;
  private recorded = false;
  constructor(
    readonly itemId: string,
    readonly language: Lang,
  ) {}
  onHint(): void {
    if (!this.recorded) this.hinted = true;
  }
  record(correct: boolean): TrialResult | null {
    if (this.recorded) return null;
    this.recorded = true;
    return { itemId: this.itemId, firstTryCorrect: correct, hinted: this.hinted };
  }
}

interface InstrumentView {
  id: OrchestraInstrumentId;
  root: Phaser.GameObjects.Container;
  sprite: Phaser.GameObjects.Image;
  glow: Phaser.GameObjects.Image;
  pulse?: Phaser.Tweens.Tween;
}

const THANKS_MAX_WAIT_MS = 2600;

export class OrchestraScene extends Phaser.Scene {
  private context!: AppContext;
  private content!: KitchenOrchestraContent;
  private session!: LearningSession;
  private skills!: SkillSession;
  private ageConfig!: AgeTrackConfig;
  private sounds = new OrchestraSounds();
  private layout!: OrchestraLayout;
  private chef?: Character;
  private views: InstrumentView[] = [];
  private bg?: Phaser.GameObjects.Image;
  private trial: OrchestraTrial | null = null;
  private tracker: EchoTracker | null = null;
  private echoIndex = 0;
  private phase: 'listen' | 'echo' | 'celebrate' = 'listen';
  private ready = false;
  private roundLang: Lang | null = null;
  private speakSeq = 0;
  private trialToken = 0;
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;

  constructor() {
    super('OrchestraScene');
  }

  create(): void {
    setAppScreen('orchestra');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.content = this.context.content.orchestra;
    const profile = this.context.store.getState().profiles.find((p) => p.id === this.context.requireProfileId());
    const track = profile?.ageTrack ?? 'age5';
    const adaptive = this.content.adaptive;
    this.ageConfig = this.content.ageTracks[track];
    this.skills = this.context.createSkillSession(
      this.content.world,
      this.content.id,
      buildMeta({ levelCount: adaptive.levels.length, tracks: adaptive.tracks, rules: adaptive.rules }),
    );
    this.session = this.context.createLearningSession();
    this.session.start();
    this.roundLang = null;
    this.speakSeq = 0;
    this.trialToken = 0;
    this.ready = false;

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

    this.buildHud();
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());
    this.startTrial();
    window.__GAME_READY__ = true;
  }

  getRoundInfo(): OrchestraRoundInfo | null {
    if (!this.trial) return null;
    return {
      sequence: [...this.trial.sequence],
      expectedIndex: this.echoIndex,
      instrumentCenters: this.views.map((v) => ({ x: v.root.x, y: v.root.y, id: v.id })),
      level: this.skills.level(this.roundLang ?? 'en'),
      support: this.trial.support,
      language: this.roundLang ?? 'en',
      ready: this.ready,
      phase: this.phase,
    };
  }

  private cleanup(): void {
    this.trialToken++;
    this.hintTimer?.remove();
    this.context.audio.stopAll();
    this.context.shell.clearPromptBubble();
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.session.exit();
    this.skills.endVisit();
    this.chef?.destroy();
    this.chef = undefined;
    this.views = [];
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
    const seq = ++this.speakSeq;
    this.session.reportListening(true);
    void this.context.audio
      .play({ lineId: 'orchestra.help.he', lang: 'he', text: this.content.helpTextHe })
      .finally(() => {
        if (seq === this.speakSeq) this.session.reportListening(false);
      });
    this.context.shell.showHelp(this.content.helpTextHe, () => {
      this.session.reportInteraction();
    });
  }

  private startTrial(): void {
    this.trialToken++;
    const token = this.trialToken;
    this.hintTimer?.remove();
    this.ready = false;
    this.phase = 'listen';
    this.echoIndex = 0;
    this.session.reportCelebrating(false);

    const settings = this.context.store.getState().settings;
    const lang = nextRoundLanguage(this.roundLang, this.skills.atRoundBoundary(this.roundLang ?? 'en'), settings.languages);
    this.roundLang = lang;
    const levelNumber = this.skills.level(lang);
    const levers = this.content.adaptive.levels[levelNumber - 1];
    const trial = buildTrial({
      sequenceLength: levers.sequenceLength ?? 1,
      choiceCount: levers.choiceCount ?? 3,
      speed: levers.speed ?? 1,
      support: (levers.support as OrchestraSupport) ?? 'lit',
    });
    this.trial = trial;
    this.tracker = new EchoTracker(trial.sequence.join('+'), lang);

    this.rebuildStage(trial.instruments.length);
    void this.playPattern(token, trial.speed, trial.support).then(() => {
      if (token !== this.trialToken) return;
      this.phase = 'echo';
      this.ready = true;
      this.maybePromptYourTurn(lang, trial);
      if (this.ageConfig.hintMode === 'demonstrate') {
        this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
      }
    });
  }

  private rebuildStage(choiceCount: number): void {
    this.views.forEach((v) => {
      v.pulse?.stop();
      v.root.destroy(true);
    });
    this.views = [];
    this.chef?.destroy();
    this.chef = undefined;
    this.bg?.destroy();

    this.layout = computeOrchestraLayout(this.scale.width, this.scale.height, choiceCount);
    const bgKey = keyForUrl(`art/scenes/kitchen/${this.layout.backgroundKey}.svg`) ?? sceneArtKey('kitchen', this.layout.backgroundKey);
    this.bg = this.add
      .image(this.scale.width / 2, this.scale.height / 2, bgKey ?? '')
      .setDisplaySize(this.scale.width, this.scale.height)
      .setDepth(0);

    const chefPos = this.layout.chef;
    this.chef = new Character(this, {
      kind: 'chef',
      x: chefPos.x,
      y: chefPos.feetY,
      displayHeight: chefPos.displayHeight,
      depth: chefPos.depth,
    });

    const glowKey = fxArtKey('instrument-glow');
    this.layout.instruments.forEach((slot, i) => {
      const id = this.trial!.instruments[i];
      const tex = instrumentArtKey(id);
      const root = this.add.container(slot.x, slot.y).setDepth(3);
      const glow = this.add.image(0, 0, glowKey ?? '').setDisplaySize(slot.size * 1.25, slot.size * 1.25).setAlpha(0);
      const sprite = this.add.image(0, 0, tex ?? '').setDisplaySize(slot.size, slot.size);
      root.add([glow, sprite]);
      root.setSize(slot.size, slot.size);
      root.setInteractive({ useHandCursor: true });
      root.on('pointerdown', () => this.onInstrumentTap(id));
      void popIn(this, root, 80 + i * 70);
      this.views.push({ id, root, sprite, glow });
    });
  }

  private view(id: OrchestraInstrumentId): InstrumentView | undefined {
    return this.views.find((v) => v.id === id);
  }

  private async playPattern(token: number, speed: number, support: OrchestraSupport, announce = true): Promise<void> {
    const trial = this.trial;
    if (!trial) return;
    const lang = this.roundLang ?? 'en';
    this.phase = 'listen';
    this.ready = false;
    this.clearGlows();
    if (announce) {
      const seq = ++this.speakSeq;
      this.session.reportListening(true);
      const prompt = trial.sequence.length === 1
        ? this.promptFor(trial.sequence[0], lang)
        : { lineId: `orchestra.listen.${lang}`, lang, text: this.content.listenPrompt[lang] };
      if (showsVisualSupport(support) && trial.sequence.length === 1) {
        this.context.shell.setPromptBubble(prompt.text, () => undefined);
      } else if (support === 'audio-only') {
        this.context.shell.clearPromptBubble();
      } else {
        this.context.shell.setPromptBubble(prompt.text, () => undefined);
      }
      await this.context.audio.play(prompt);
      if (seq === this.speakSeq) this.session.reportListening(false);
      if (token !== this.trialToken) return;
    }
    const hold = noteHoldMs(speed);
    const gap = noteGapMs(speed);
    for (const id of trial.sequence) {
      if (token !== this.trialToken) return;
      await this.playOne(id, support, hold);
      await wait(this, Math.max(40, gap - hold));
    }
    if (!keepsGlowLit(support)) this.clearGlows();
  }

  private async playOne(id: OrchestraInstrumentId, support: OrchestraSupport, hold: number): Promise<void> {
    const view = this.view(id);
    this.sounds.play(id);
    if (view) {
      void tapInstrument(this, view.sprite);
      if (showsVisualSupport(support)) {
        view.glow.setAlpha(0);
        await glowInstrument(this, view.glow, true);
        if (keepsGlowLit(support)) {
          view.pulse?.stop();
          view.pulse = pulseInstrumentGlow(this, view.glow);
        } else {
          await wait(this, hold);
          await glowInstrument(this, view.glow, false);
        }
        return;
      }
    }
    await wait(this, hold);
  }

  private clearGlows(): void {
    for (const view of this.views) {
      view.pulse?.stop();
      view.pulse = undefined;
      view.glow.setAlpha(0);
    }
  }

  private maybePromptYourTurn(lang: Lang, trial: OrchestraTrial): void {
    if (trial.sequence.length === 1) return;
    const text = this.content.yourTurnPrompt[lang];
    if (trial.support !== 'audio-only') this.context.shell.setPromptBubble(text, () => undefined);
    const seq = ++this.speakSeq;
    this.session.reportListening(true);
    void this.context.audio.play({ lineId: `orchestra.yourturn.${lang}`, lang, text }).finally(() => {
      if (seq === this.speakSeq) this.session.reportListening(false);
    });
  }

  private promptFor(id: OrchestraInstrumentId, lang: Lang) {
    const inst = this.content.instruments.find((i) => i.id === id);
    const text = inst?.prompts[lang] ?? `Play the ${id}!`;
    return { lineId: `orchestra.play.${id}.${lang}`, lang, text };
  }

  private onInstrumentTap(id: OrchestraInstrumentId): void {
    this.session.reportInteraction();
    this.sounds.warmup();
    const view = this.view(id);
    if (view) void tapInstrument(this, view.sprite);
    this.sounds.play(id);

    // Free play (or taps during listen) always makes sound and never scores a miss.
    if (!this.ready || this.phase !== 'echo' || !this.trial || !this.tracker) return;

    const result = checkEchoTap(this.trial.sequence, this.echoIndex, id);
    if (result.kind === 'continue') {
      this.echoIndex = result.nextIndex;
      return;
    }
    if (result.kind === 'complete') {
      this.onSuccess();
      return;
    }
    this.onMiss();
  }

  private giveHint(): void {
    if (!this.ready || this.phase !== 'echo' || !this.trial) return;
    const next = this.trial.sequence[this.echoIndex];
    if (!next) return;
    this.tracker?.onHint();
    this.context.sfx.hint();
    const view = this.view(next);
    if (view && showsVisualSupport(this.trial.support)) {
      view.glow.setAlpha(0);
      void glowInstrument(this, view.glow, true).then(() => {
        if (view.root.scene) {
          view.pulse?.stop();
          view.pulse = pulseInstrumentGlow(this, view.glow);
        }
      });
    }
    const lang = this.roundLang ?? 'en';
    void this.context.audio.play(this.promptFor(next, lang));
  }

  private onSuccess(): void {
    const token = this.trialToken;
    this.phase = 'celebrate';
    this.ready = false;
    this.hintTimer?.remove();
    const recorded = this.tracker?.record(true);
    if (recorded && this.roundLang) this.skills.record(this.roundLang, recorded);
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    this.context.sfx.yay();
    this.context.shell.clearPromptBubble();
    const juice = Juice.for(this);
    if (this.chef) juice.burst('sparkle', this.chef.root.x, this.chef.root.y - 80);
    void this.chef?.happy();
    this.views.forEach((v, i) => {
      this.time.delayedCall(80 * i, () => {
        if (token === this.trialToken) void tapInstrument(this, v.sprite);
      });
    });
    this.context.shell.updateRestaurantChrome({ starCount: state.stars });
    const lang = this.roundLang ?? 'en';
    const lines = this.content.thanks[lang];
    const thanks = lines[Math.floor(Math.random() * lines.length)] ?? lines[0];
    const speech = this.context.audio.play({ lineId: `orchestra.thanks.${lang}.${lines.indexOf(thanks)}`, lang, text: thanks });
    void Promise.race([speech, wait(this, THANKS_MAX_WAIT_MS)]).then(() => {
      if (token !== this.trialToken) return;
      this.startTrial();
    });
  }

  private onMiss(): void {
    const token = this.trialToken;
    this.ready = false;
    this.phase = 'listen';
    this.hintTimer?.remove();
    const recorded = this.tracker?.record(false);
    if (recorded && this.roundLang) this.skills.record(this.roundLang, recorded);
    void this.chef?.hmm();
    this.context.sfx.hint();
    const lang = this.roundLang ?? 'en';
    const text = this.content.retryPrompt[lang];
    const seq = ++this.speakSeq;
    this.session.reportListening(true);
    if (this.trial && this.trial.support !== 'audio-only') this.context.shell.setPromptBubble(text, () => undefined);
    void this.context.audio.play({ lineId: `orchestra.retry.${lang}`, lang, text }).then(async () => {
      if (seq === this.speakSeq) this.session.reportListening(false);
      if (token !== this.trialToken || !this.trial) return;
      // Research: the same pattern replays 25% slower with lights on as a free hint.
      await this.playPattern(token, replaySpeed(this.trial.speed), 'lit', false);
      if (token !== this.trialToken) return;
      this.startTrial();
    });
  }
}

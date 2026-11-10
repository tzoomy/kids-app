import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { drawAnimal, drawFoodIcon, ANIMAL_KINDS } from '../../assets/vectorArt';
import { PALETTE } from '../../assets/colors';
import { buildRound, isCorrectChoice, pickLanguage, type ChoiceOption, type RoundSpec } from '../templates/choiceServe';
import type { LearningSession } from '../../core/leisure';
import type { AgeTrackConfig } from '../../content/schema';

interface ActiveRound extends RoundSpec {
  done: boolean;
  tries: number;
}

export class RestaurantScene extends Phaser.Scene {
  private context!: AppContext;
  private session!: LearningSession;
  private ageConfig!: AgeTrackConfig;
  private round: ActiveRound | null = null;
  private animalContainer?: Phaser.GameObjects.Container;
  private choiceContainers: Phaser.GameObjects.Container[] = [];
  private hintTimer?: Phaser.Time.TimerEvent;
  private visibilityHandler?: () => void;

  constructor() {
    super('RestaurantScene');
  }

  create(): void {
    this.context = this.game.registry.get('appContext') as AppContext;
    const profile = this.context.store
      .getState()
      .profiles.find((p) => p.id === this.context.requireProfileId());
    this.ageConfig = this.context.content.restaurant.ageTracks[profile?.ageTrack ?? 'age5'];

    this.session = this.context.createLearningSession();
    this.session.start();

    this.visibilityHandler = () => this.session.setHidden(document.hidden);
    document.addEventListener('visibilitychange', this.visibilityHandler);

    this.time.addEvent({ delay: 1000, loop: true, callback: () => this.session.tick(1) });

    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => this.cleanup());

    this.refreshChrome();
    this.startRound();

    window.__GAME_READY__ = true;
  }

  private cleanup(): void {
    if (this.visibilityHandler) document.removeEventListener('visibilitychange', this.visibilityHandler);
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
  }

  private goBack(): void {
    this.context.store.persist();
    this.context.shell.clearPromptBubble();
    this.scene.start('MapScene');
  }

  private showHelp(): void {
    this.session.reportInteraction();
    this.context.shell.showHelp(this.context.content.restaurant.helpTextHe, () => this.session.reportInteraction());
  }

  private startRound(): void {
    this.session.reportListening(false);
    this.session.reportCelebrating(false);
    this.choiceContainers.forEach((c) => c.destroy());
    this.choiceContainers = [];
    this.animalContainer?.destroy();
    this.hintTimer?.remove();

    const content = this.context.content.restaurant;
    const settings = this.context.store.getState().settings;
    const language = pickLanguage(settings.languages);
    const spec = buildRound(content.items, this.ageConfig, language);
    this.round = { ...spec, done: false, tries: 0 };

    const animalKind = ANIMAL_KINDS[Math.floor(Math.random() * ANIMAL_KINDS.length)];
    this.animalContainer = drawAnimal(this, animalKind, 200);
    this.animalContainer.setPosition(this.scale.width / 2, this.scale.height * 0.3);
    this.animalContainer.setInteractive({ useHandCursor: true });
    this.animalContainer.on('pointerdown', () => this.speakPrompt());
    this.tweens.add({
      targets: this.animalContainer,
      y: this.animalContainer.y - 14,
      angle: -3,
      duration: 900,
      yoyo: true,
      repeat: -1,
      ease: 'Sine.easeInOut',
    });

    const n = spec.choices.length;
    const spacing = Math.min(260, (this.scale.width - 80) / n);
    const startX = this.scale.width / 2 - ((n - 1) * spacing) / 2;
    const y = this.scale.height * 0.72;
    spec.choices.forEach((choice, i) => {
      const container = this.buildChoiceContainer(choice);
      container.setPosition(startX + i * spacing, y);
      container.setInteractive({ useHandCursor: true });
      container.on('pointerdown', () => this.choose(container, choice));
      this.choiceContainers.push(container);
    });

    this.context.shell.setPromptBubble(spec.promptText, () => this.speakPrompt());
    this.time.delayedCall(300, () => this.speakPrompt());

    if (this.ageConfig.hintMode === 'demonstrate') {
      this.hintTimer = this.time.delayedCall(this.ageConfig.hintDelayMs, () => this.giveHint());
    }
  }

  private buildChoiceContainer(choice: ChoiceOption): Phaser.GameObjects.Container {
    const iconSize = 70;
    const gap = 16;
    const totalWidth = choice.count * iconSize + (choice.count - 1) * gap;
    const group = this.add.container(0, 0);
    for (let i = 0; i < choice.count; i++) {
      const icon = drawFoodIcon(this, choice.item.shape, choice.item.color, iconSize);
      icon.setPosition(-totalWidth / 2 + iconSize / 2 + i * (iconSize + gap), 0);
      group.add(icon);
    }
    group.setSize(Math.max(120, totalWidth + 40), 180);
    return group;
  }

  private async speakPrompt(): Promise<void> {
    if (!this.round) return;
    this.session.reportListening(true);
    const lineId = `food.${this.round.target.item.id}.${this.round.language}`;
    await this.context.audio.play({ lineId, lang: this.round.language, text: this.round.promptText });
    this.session.reportListening(false);
  }

  private giveHint(): void {
    if (!this.round || this.round.done) return;
    const target = this.round.target;
    const container = this.choiceContainers.find((_, i) => isCorrectChoice(this.round!.choices[i], target));
    if (container) {
      this.tweens.add({ targets: container, scale: 1.12, duration: 300, yoyo: true, repeat: 2 });
    }
    this.context.sfx.hint();
    void this.speakPrompt();
  }

  private choose(container: Phaser.GameObjects.Container, choice: ChoiceOption): void {
    if (!this.round || this.round.done) return;
    this.session.reportInteraction();

    if (isCorrectChoice(choice, this.round.target)) {
      this.round.done = true;
      this.hintTimer?.remove();
      this.onCorrect(container);
    } else {
      this.round.tries++;
      this.tweens.add({ targets: container, x: container.x - 10, duration: 60, yoyo: true, repeat: 3 });
      if (this.ageConfig.hintMode === 'demonstrate') {
        this.context.sfx.tap();
        this.giveHint();
      } else {
        this.context.sfx.hint();
        if (this.round.tries >= 2) this.giveHint();
        else void this.speakPrompt();
      }
    }
  }

  private onCorrect(container: Phaser.GameObjects.Container): void {
    this.context.sfx.yay();
    this.session.complete();
    const state = this.profileState();
    state.stars++;
    this.context.store.persist();
    this.refreshChrome();

    this.tweens.add({ targets: container, scale: 1.15, duration: 200, yoyo: true });
    this.burst(container.x, container.y);

    const content = this.context.content.restaurant;
    const lang = this.round!.language;
    const lines = content.thanks[lang];
    const line = lines[Math.floor(Math.random() * lines.length)];
    this.time.delayedCall(250, () => {
      void this.context.audio.play({ lineId: `thanks.${lang}`, lang, text: line });
    });

    this.time.delayedCall(2200, () => {
      this.session.reportCelebrating(false);
      this.startRound();
    });
  }

  private burst(x: number, y: number): void {
    const colors = [PALETTE.yellow, PALETTE.pink, PALETTE.blue];
    for (let i = 0; i < 8; i++) {
      const dot = this.add.circle(x, y, 8, colors[i % colors.length]);
      const angle = (i / 8) * Math.PI * 2;
      this.tweens.add({
        targets: dot,
        x: x + Math.cos(angle) * 140,
        y: y + Math.sin(angle) * 140,
        alpha: 0,
        scale: 0.3,
        duration: 700,
        ease: 'Cubic.easeOut',
        onComplete: () => dot.destroy(),
      });
    }
  }
}

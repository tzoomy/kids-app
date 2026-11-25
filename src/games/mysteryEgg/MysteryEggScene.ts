// Mystery Egg hub (docs/specs/mystery-egg.md): the egg in its nest, Lumi, Bip, the capybara, the robot's 5 heart slots
// and one big Workshop button. Entry: the big egg button on the map HUD (`mystery-egg-btn`); exit: the home button.
// All media is optional: missing art is drawn, missing sounds are synthesized (eggAssetLoader.ts, art.ts).
import Phaser from 'phaser';
import type { AppContext } from '../../game/appContext';
import { setAppScreen } from '../../pwa';
import { transitionTo } from '../../anim/transitions';
import { floatIdle, popIn } from '../../anim/tweens';
import { createRobot, eggArt } from './art';
import { displaySize } from './assets';
import { boardRectToPage, fitBoard } from './boardView';
import { loadEggAssets } from './eggAssetLoader';
import { playEggSfx } from './eggSound';
import { heartSlotCentres } from './layout';
import { HEART_SLOT_COUNT, eggLevel, litHearts, loadProgress, nestTreasures, type MysteryEggProgress } from './progress';
import type { EggTarget, MysteryEggInfo } from './types';
import { drawGearIcon, drawHomeIcon, makeButton, type EggButton } from './ui';

/** The heart panel, drawn at 1.5x its 1x manifest size; socket positions follow Gemini's geometry (layout.ts). */
const PANEL = { x: 640, y: 100, scale: 1.5 } as const;

export class MysteryEggScene extends Phaser.Scene {
  private context!: AppContext;
  private progress!: MysteryEggProgress;
  private ready = false;
  private alive = false;
  private feather: Phaser.GameObjects.Container | null = null;
  private readonly buttons = new Map<EggTarget, EggButton>();

  constructor() {
    super('MysteryEggScene');
  }

  create(): void {
    setAppScreen('mystery-egg');
    this.context = this.game.registry.get('appContext') as AppContext;
    this.progress = loadProgress(window.localStorage, this.context.requireProfileId());
    this.ready = false;
    this.alive = true;
    this.feather = null;
    this.buttons.clear();
    // The map's DOM chrome (top bar, world labels, egg button) must not stay on top of this canvas scene.
    this.context.shell.clearChrome();
    fitBoard(this, '#cdeaff');
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.alive = false;
      this.context.audio.stopAll();
    });
    loadEggAssets(this, import.meta.env.BASE_URL, () => {
      if (!this.alive) return;
      this.build();
      this.ready = true;
      window.__GAME_READY__ = true;
    });
  }

  private build(): void {
    const lit = new Set(litHearts(this.progress));
    const level = eggLevel(this.progress);

    eggArt(this, 'hub-bg', 640, 400).setDepth(0);

    // Robot heart panel with its 5 slots (filled ones glow).
    eggArt(this, 'heart-panel', PANEL.x, PANEL.y).setDepth(5).setScale(PANEL.scale);
    const sockets = heartSlotCentres(PANEL.x, PANEL.y, displaySize('heart-panel'), PANEL.scale);
    for (let i = 0; i < HEART_SLOT_COUNT; i++) {
      const filled = lit.has(i);
      const slot = eggArt(this, filled ? 'slot-filled' : 'slot-empty', sockets[i].x, sockets[i].y).setDepth(6).setScale(PANEL.scale);
      if (filled) this.tweens.add({ targets: slot, scale: PANEL.scale * 1.12, duration: 700, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    }

    // The egg in its nest: glow level from progress; a gentle wiggle that grows with the level.
    const egg = eggArt(this, `egg-nest-${level}`, 640, 400).setDepth(10);
    egg.setInteractive({ useHandCursor: true });
    egg.on('pointerdown', () => {
      playEggSfx('sfx-robot-beep-2');
      this.wiggle(egg, 6 + level * 2);
    });
    this.tweens.add({ targets: egg, angle: 1.5 + level * 0.8, duration: 1800, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    if (nestTreasures(this.progress).includes('feather')) {
      this.feather = eggArt(this, 'feather', 722, 470).setDepth(12).setAngle(-35).setScale(0.7);
    }

    // Friends. Idle motion = whole-image tweens (bob).
    // Sizes follow the hub mock: bunny about 300 px tall, capybara about 250, robot about 130-145.
    const bunny = eggArt(this, 'bunny', 250, 560).setDepth(10);
    const capybara = eggArt(this, 'capybara', 1120, 655).setDepth(10).setScale(0.9);
    const robotView = createRobot(this, 925, 575);
    const robot = robotView.container.setDepth(10).setScale(0.8);
    for (const c of [bunny, capybara, robot]) {
      floatIdle(this, c, 8, 1500 + Math.random() * 500);
      c.setInteractive({ useHandCursor: true });
    }
    robot.on('pointerdown', () => {
      playEggSfx('sfx-robot-beep-1');
      this.wiggle(robot, 5);
    });
    bunny.on('pointerdown', () => this.wiggle(bunny, 4));
    capybara.on('pointerdown', () => this.wiggle(capybara, 4));
    robotView.startIdleBlinks();

    // The one big Workshop button, and the way back to the map.
    const workshop = makeButton(this, 640, 700, 320, 120, drawGearIcon, () => this.openWorkshop());
    workshop.container.setDepth(20);
    this.tweens.add({ targets: workshop.container, scale: 1.05, duration: 900, yoyo: true, repeat: -1, ease: 'Sine.easeInOut' });
    this.buttons.set('workshopBtn', workshop);
    const back = makeButton(this, 70, 70, 96, 96, drawHomeIcon, () => this.goBack());
    back.container.setDepth(20);
    this.buttons.set('backBtn', back);

    void popIn(this, egg, 0, 1);
  }

  /** A short wiggle (angle) of the whole image, then back to rest. */
  private wiggle(target: Phaser.GameObjects.Container, deg: number): void {
    this.tweens.add({ targets: target, angle: { from: -deg, to: deg }, duration: 90, yoyo: true, repeat: 2, onComplete: () => target.setAngle(0) });
  }

  private openWorkshop(): void {
    this.context.sfx.tap();
    transitionTo(this, 'MysteryEggBuildScene', { style: 'fade' });
  }

  private goBack(): void {
    this.context.sfx.tap();
    transitionTo(this, 'MapScene', { style: 'fade' });
  }

  /** ?e2e=1 read hook. */
  getMysteryEggInfo(): MysteryEggInfo {
    const rects: MysteryEggInfo['rects'] = {};
    for (const [target, b] of this.buttons) {
      rects[target] = boardRectToPage(this, b.container.x, b.container.y, b.width, b.height);
    }
    return {
      scene: 'MysteryEggScene',
      phase: 'hub',
      ready: this.ready,
      heartsLit: litHearts(this.progress),
      eggLevel: eggLevel(this.progress),
      featherInNest: this.feather !== null,
      failedRuns: 0,
      hintsGiven: 0,
      hintVisible: false,
      slotFilled: false,
      ballAtStart: true,
      partsInTray: [],
      rects,
    };
  }
}

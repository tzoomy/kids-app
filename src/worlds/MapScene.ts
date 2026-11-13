import Phaser from 'phaser';
import type { AppContext } from '../game/appContext';
import { drawWorldBuilding, paintMapBackdrop } from '../assets/vectorArt';
import type { MapPin } from '../ui/hud';
import { heLine } from '../content/voiceLines';
import { transitionTo } from '../anim/transitions';
import { popIn, floatIdle, pressSquash } from '../anim/tweens';
import { setAppScreen } from '../pwa';

/** Module scope = once per page load / app session. */
let mapGuidancePlayed = false;

export class MapScene extends Phaser.Scene {
  /** Building objects by world id (read-only access for the e2e hit-rectangle hook). */
  private readonly buildings = new Map<string, Phaser.GameObjects.Container>();

  constructor() {
    super('MapScene');
  }

  /** Current tap rectangle of a world's building in game coordinates (follows the idle float), or null. */
  getBuildingRect(worldId: string): { x: number; y: number; width: number; height: number } | null {
    const b = this.buildings.get(worldId);
    if (!b || !b.scene) return null;
    const width = b.width * Math.abs(b.scaleX);
    const height = b.height * Math.abs(b.scaleY);
    return { x: b.x - width / 2, y: b.y - height / 2, width, height };
  }

  create(): void {
    setAppScreen('map');
    const context = this.game.registry.get('appContext') as AppContext;
    const { worlds } = context.content.worlds;
    paintMapBackdrop(this);

    const cx = this.scale.width / 2;
    const cy = this.scale.height * 0.55;
    const portrait = this.scale.height > this.scale.width;
    const cols = Math.min(3, worlds.length);
    const spacingX = Math.min(portrait ? 210 : 280, this.scale.width / (cols + (portrait ? 0.85 : 0.4)));
    const spacingY = Math.min(portrait ? 230 : 250, this.scale.height * (portrait ? 0.3 : 0.36));
    const rows = Math.ceil(worlds.length / cols);
    const startX = cx - ((cols - 1) * spacingX) / 2;
    const startY = cy - ((rows - 1) * spacingY) / 2 + (portrait ? this.scale.height * 0.04 : 0);

    this.buildings.clear();
    const pins: MapPin[] = [];
    // Set once the child has tapped anything, so the "where to go" line never talks over a tap.
    let touched = false;

    worlds.forEach((world, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      const locked = world.status === 'locked';
      const building = drawWorldBuilding(this, world.id, locked, 180);
      building.setPosition(x, y);
      this.buildings.set(world.id, building);
      building.setAlpha(locked ? 0.72 : 1);

      // Staggered pop-in, then a gentle idle float.
      void popIn(this, building, 80 + i * 70).then(() => {
        if (building.scene) floatIdle(this, building, 8, 1800 + i * 140);
      });

      building.setInteractive({ useHandCursor: true });
      building.on('pointerdown', () => {
        context.sfx.tap();
        touched = true;
        context.audio.stopAll();
        void pressSquash(this, building);
        if (world.status === 'locked') {
          context.shell.showToast(`${context.content.he.worldMap.comingSoon} 🌱`);
          void context.audio.play(heLine('map.comingSoon'));
          return;
        }
        if (world.status === 'leisure') {
          const profileState = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
          if (profileState.balanceSec > 0) {
            transitionTo(this, 'BubblesScene', { style: 'iris', originX: x, originY: y });
          } else {
            context.shell.showToast(`⏳ 0:00`);
          }
          return;
        }
        if (world.id === 'language-house') {
          // Language House hosts two games: the child picks one (or closes the picker and stays on the map).
          context.shell.showGamePicker({
            onPick: (game) => {
              context.shell.hideGamePicker();
              context.sfx.tap();
              transitionTo(this, game.sceneKey, { style: 'iris', originX: x, originY: y });
            },
            onClose: () => {
              context.shell.hideGamePicker();
              context.sfx.tap();
            },
          });
          return;
        }
        if (world.entryGameId === 'animal-restaurant') {
          transitionTo(this, 'RestaurantScene', { style: 'iris', originX: x, originY: y });
        }
        if (world.entryGameId === 'kitchen-orchestra') {
          transitionTo(this, 'OrchestraScene', { style: 'iris', originX: x, originY: y });
        }
      });

      const labels: Record<string, string> = {
        'language-house': context.content.he.worldMap.languageHouse,
        'number-garden': context.content.he.worldMap.numberGarden,
        'nature-lab': context.content.he.worldMap.natureLab,
        'art-studio': context.content.he.worldMap.artStudio,
        'leisure-corner': context.content.he.worldMap.leisureCorner,
      };

      pins.push({
        id: world.id,
        label: labels[world.id] ?? world.id,
        locked,
        comingSoon: locked ? context.content.he.worldMap.comingSoon : undefined,
        gameX: x,
        gameY: y + 88,
      });
    });

    const paintChrome = () => {
      const profileState = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
      context.shell.setMapChrome({
        title: context.content.he.worldMap.title,
        balanceSec: profileState.balanceSec,
        onParent: () => context.onRequestParent?.(),
        onSwitchProfile: () => context.onExitToProfileSelect?.(),
        pins,
        canvas: this.game.canvas,
        gameWidth: this.scale.width,
        gameHeight: this.scale.height,
      });
    };
    paintChrome();
    this.scale.on('resize', paintChrome);
    window.addEventListener('resize', paintChrome);
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      this.scale.off('resize', paintChrome);
      window.removeEventListener('resize', paintChrome);
    });

    // One gentle "where shall we go" line per app session (not every visit), after a short pause.
    if (!mapGuidancePlayed) {
      this.time.delayedCall(1200, () => {
        if (touched) return;
        mapGuidancePlayed = true;
        void context.audio.play(heLine('map.choose'));
      });
    }
    this.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
      context.audio.stopAll();
      context.shell.hideGamePicker();
    });

    window.__GAME_READY__ = true;
  }
}

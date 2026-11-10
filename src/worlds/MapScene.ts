import Phaser from 'phaser';
import type { AppContext } from '../game/appContext';
import { drawWorldBuilding, paintMapBackdrop } from '../assets/vectorArt';
import type { MapPin } from '../ui/hud';

export class MapScene extends Phaser.Scene {
  constructor() {
    super('MapScene');
  }

  create(): void {
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

    const pins: MapPin[] = [];

    worlds.forEach((world, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      const locked = world.status === 'locked';
      const building = drawWorldBuilding(this, world.id, locked, 180);
      building.setPosition(x, y);
      building.setAlpha(locked ? 0.72 : 1);

      this.tweens.add({
        targets: building,
        y: y - 8,
        duration: 1800 + i * 140,
        yoyo: true,
        repeat: -1,
        ease: 'Sine.easeInOut',
      });

      building.setInteractive({ useHandCursor: true });
      building.on('pointerdown', () => {
        context.sfx.tap();
        if (world.status === 'locked') {
          context.shell.showToast(`${context.content.he.worldMap.comingSoon} 🌱`);
          return;
        }
        if (world.status === 'leisure') {
          const profileState = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
          if (profileState.balanceSec > 0) {
            this.scene.start('BubblesScene');
          } else {
            context.shell.showToast(`⏳ 0:00`);
          }
          return;
        }
        if (world.entryGameId === 'animal-restaurant') {
          this.scene.start('RestaurantScene');
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

    window.__GAME_READY__ = true;
  }
}

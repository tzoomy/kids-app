import Phaser from 'phaser';
import type { AppContext } from '../game/appContext';
import { drawWorldBuilding } from '../assets/vectorArt';

export class MapScene extends Phaser.Scene {
  constructor() {
    super('MapScene');
  }

  create(): void {
    const context = this.game.registry.get('appContext') as AppContext;
    const { worlds } = context.content.worlds;
    const cx = this.scale.width / 2;
    const cy = this.scale.height / 2;
    const cols = Math.ceil(Math.sqrt(worlds.length));
    const spacingX = Math.min(260, this.scale.width / cols);
    const spacingY = 220;
    const startX = cx - ((cols - 1) * spacingX) / 2;
    const startY = cy - ((Math.ceil(worlds.length / cols) - 1) * spacingY) / 2;

    worlds.forEach((world, i) => {
      const col = i % cols;
      const row = Math.floor(i / cols);
      const x = startX + col * spacingX;
      const y = startY + row * spacingY;
      const locked = world.status === 'locked';
      const building = drawWorldBuilding(this, world.id, locked, 150);
      building.setPosition(x, y);
      building.setAlpha(locked ? 0.55 : 1);

      // Gentle idle motion so the island feels alive without being busy.
      this.tweens.add({
        targets: building,
        y: y - 10,
        duration: 1600 + i * 120,
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
            context.shell.showToast('⏳ 0:00');
          }
          return;
        }
        if (world.entryGameId === 'animal-restaurant') {
          this.scene.start('RestaurantScene');
        }
      });
    });

    const profileState = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
    context.shell.setMapChrome({
      balanceSec: profileState.balanceSec,
      onParent: () => context.onRequestParent?.(),
    });

    window.__GAME_READY__ = true;
  }
}

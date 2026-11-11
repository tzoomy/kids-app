import Phaser from 'phaser';
import { MapScene } from '../worlds/MapScene';
import { RestaurantScene } from '../games/restaurant/RestaurantScene';
import { BubblesScene } from '../games/bubbles/BubblesScene';
import type { AppContext } from './appContext';
import { PreloadScene } from '../anim/PreloadScene';
import { registerProjectArt } from '../anim/registerArt';

declare global {
  interface Window {
    __GAME_READY__?: boolean;
    __testHooks__?: {
      goToScreen: (screen: 'map' | 'restaurant' | 'bubbles') => void;
      seedBalanceSec: (sec: number) => void;
    };
  }
}

export function isE2e(): boolean {
  return new URLSearchParams(window.location.search).get('e2e') === '1';
}

function pickBaseSize(): { width: number; height: number } {
  // Landscape 1280x800, portrait 800x1280 — matches the two supported tablet orientations.
  return window.innerWidth >= window.innerHeight ? { width: 1280, height: 800 } : { width: 800, height: 1280 };
}

export function createGame(parent: HTMLElement, context: AppContext): Phaser.Game {
  const { width, height } = pickBaseSize();
  registerProjectArt();

  const game = new Phaser.Game({
    type: isE2e() ? Phaser.CANVAS : Phaser.AUTO,
    parent,
    width,
    height,
    backgroundColor: '#fde9d9',
    scale: {
      mode: Phaser.Scale.FIT,
      autoCenter: Phaser.Scale.CENTER_BOTH,
    },
    // Only PreloadScene auto-starts (it loads registered art, then starts MapScene).
    // Map/Restaurant/Bubbles are added inactive and started explicitly on navigation,
    // so their create() doesn't fire until entered.
    scene: [PreloadScene],
  });

  game.scene.add('MapScene', MapScene, false);
  game.scene.add('RestaurantScene', RestaurantScene, false);
  game.scene.add('BubblesScene', BubblesScene, false);

  game.registry.set('appContext', context);

  window.__testHooks__ = {
    goToScreen(screen) {
      window.__GAME_READY__ = false;
      const sceneKey = screen === 'map' ? 'MapScene' : screen === 'restaurant' ? 'RestaurantScene' : 'BubblesScene';
      game.scene.stop('PreloadScene');
      game.scene.stop('MapScene');
      game.scene.stop('RestaurantScene');
      game.scene.stop('BubblesScene');
      game.scene.start(sceneKey);
    },
    seedBalanceSec(sec) {
      const state = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
      state.balanceSec = sec;
      context.store.persist();
    },
  };

  return game;
}

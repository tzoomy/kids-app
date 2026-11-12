import Phaser from 'phaser';
import { MapScene } from '../worlds/MapScene';
import { RestaurantScene, type RoundInfo } from '../games/restaurant/RestaurantScene';
import { HidingScene, type HidingRoundInfo } from '../games/hiding/HidingScene';
import { BubblesScene } from '../games/bubbles/BubblesScene';
import type { AppContext } from './appContext';
import { PreloadScene } from '../anim/PreloadScene';
import { registerProjectArt } from '../anim/registerArt';
import { skillKey } from '../core/adaptive';
import { localDayKey } from '../core/storage/dayKey';

declare global {
  interface Window {
    __GAME_READY__?: boolean;
    __testHooks__?: {
      goToScreen: (screen: 'map' | 'restaurant' | 'hiding' | 'bubbles') => void;
      seedBalanceSec: (sec: number) => void;
      /** Sets the stored restaurant level (1-based, clamped to the track) for every language. Call before entering the restaurant. */
      seedRestaurantLevel: (level: number) => void;
      /** Same for Who's Hiding?. Call before entering it. */
      seedHidingLevel: (level: number) => void;
      /** Current round of the active game scene (restaurant or Who's Hiding?; null when none); centers are in game coordinates. */
      getRoundInfo: () => RoundInfo | HidingRoundInfo | null;
      /** Names of the currently active scenes. */
      getActiveScenes: () => string[];
      /** Game canvas size in game coordinates. */
      getGameSize: () => { width: number; height: number };
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
  game.scene.add('HidingScene', HidingScene, false);
  game.scene.add('BubblesScene', BubblesScene, false);

  game.registry.set('appContext', context);

  // Test/recording hooks exist only with ?e2e=1 (they expose the correct answer).
  if (isE2e()) window.__testHooks__ = {
    goToScreen(screen) {
      window.__GAME_READY__ = false;
      const sceneKey =
        screen === 'map' ? 'MapScene' : screen === 'restaurant' ? 'RestaurantScene' : screen === 'hiding' ? 'HidingScene' : 'BubblesScene';
      game.scene.stop('PreloadScene');
      game.scene.stop('MapScene');
      game.scene.stop('RestaurantScene');
      game.scene.stop('HidingScene');
      game.scene.stop('BubblesScene');
      game.scene.start(sceneKey);
    },
    seedBalanceSec(sec) {
      const state = context.store.getProfileState(context.requireProfileId(), new Date(context.nowMs()));
      state.balanceSec = sec;
      context.store.persist();
    },
    seedRestaurantLevel(level) {
      const profileId = context.requireProfileId();
      const { world, id, languages } = context.content.restaurant;
      for (const lang of languages) {
        const key = skillKey(world, id, lang);
        const stored = context.adaptive.getSkill(profileId, key);
        context.adaptive.setSkill(profileId, key, {
          ...(stored ?? { cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: localDayKey(new Date(context.nowMs())), items: {} }),
          level,
          cleanStreak: 0,
          recent: [],
        });
      }
      context.adaptive.persist(profileId);
    },
    seedHidingLevel(level) {
      const profileId = context.requireProfileId();
      const { world, id, languages } = context.content.hiding;
      for (const lang of languages) {
        const key = skillKey(world, id, lang);
        const stored = context.adaptive.getSkill(profileId, key);
        context.adaptive.setSkill(profileId, key, {
          ...(stored ?? { cleanStreak: 0, recent: [], afterDrop: false, lastPlayedDay: localDayKey(new Date(context.nowMs())), items: {} }),
          level,
          cleanStreak: 0,
          recent: [],
        });
      }
      context.adaptive.persist(profileId);
    },
    getRoundInfo() {
      if (game.scene.isActive('HidingScene')) return (game.scene.getScene('HidingScene') as HidingScene).getRoundInfo();
      const scene = game.scene.getScene('RestaurantScene') as RestaurantScene | null;
      return scene && game.scene.isActive('RestaurantScene') ? scene.getRoundInfo() : null;
    },
    getActiveScenes() {
      return game.scene.getScenes(true).map((s) => s.scene.key);
    },
    getGameSize() {
      return { width: game.scale.width, height: game.scale.height };
    },
  };

  return game;
}

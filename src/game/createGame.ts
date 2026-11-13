import Phaser from 'phaser';
import { MapScene } from '../worlds/MapScene';
import { RestaurantScene, type RoundInfo } from '../games/restaurant/RestaurantScene';
import { HidingScene, type HidingRoundInfo } from '../games/hiding/HidingScene';
import { BubblesScene } from '../games/bubbles/BubblesScene';
import { OrchestraScene, type OrchestraRoundInfo } from '../games/orchestra/OrchestraScene';
import { SortingScene } from '../games/sorting/SortingScene';
import type { SortingInfo } from '../games/sorting/types';
import { seedAdaptiveLevel } from '../games/sorting/seedLevel';
import type { AppContext } from './appContext';
import { PreloadScene } from '../anim/PreloadScene';
import { registerProjectArt } from '../anim/registerArt';
import { skillKey } from '../core/adaptive';
import { localDayKey } from '../core/storage/dayKey';
import { SpeechRecorder, type SpokenLine } from '../core/audio';
import { gameRectToPageRect, type Rect } from '../testing/pageRect';

declare global {
  interface Window {
    __GAME_READY__?: boolean;
    __testHooks__?: {
      goToScreen: (screen: 'map' | 'restaurant' | 'hiding' | 'bubbles' | 'orchestra' | 'sorting') => void;
      seedBalanceSec: (sec: number) => void;
      /** Sets the stored restaurant level (1-based, clamped to the track) for every language. Call before entering the restaurant. */
      seedRestaurantLevel: (level: number) => void;
      /** Current restaurant or Who's Hiding? round (null when neither is active); centers are in game coordinates. */
      getRoundInfo: () => RoundInfo | HidingRoundInfo | null;
      /** Current orchestra trial (null when the kitchen is not active). */
      getOrchestraInfo: () => OrchestraRoundInfo | null;
      seedOrchestraLevel: (level: number) => void;
      /** Seeds the active profile's persisted Sorting Beds level (level, cleanStreak 0, recent []) for every language. Call before entering. */
      seedSortingLevel: (level: number) => void;
      /** Seeds the stored language setting (settings.languages) and persists. Seed only: no navigation, no game action. */
      seedLanguageSetting: (lang: 'en' | 'fr' | 'both') => void;
      /** Current Sorting Beds round (null when SortingScene is not active or has no round); rectangles are page CSS px. */
      getSortingInfo: () => SortingInfo | null;
      /** Same for Who's Hiding?. Call before entering it. */
      seedHidingLevel: (level: number) => void;
      /** Whether the current learning session is reporting listening. Read-only, ?e2e=1 only. */
      isListening: () => boolean;
      /** Names of the currently active scenes. */
      getActiveScenes: () => string[];
      /** Game canvas size in game coordinates. */
      getGameSize: () => { width: number; height: number };
      /** Building hit rectangle of a world in page CSS pixels (top-left + size); null when the map is not active or the world has no building. */
      getBuildingHit: (worldId: string) => Rect | null;
      /** Spoken lines requested so far, optionally only those with index >= sinceIndex. */
      getSpokenLines: (sinceIndex?: number) => SpokenLine[];
      getSpokenLineCount: () => number;
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
  game.scene.add('OrchestraScene', OrchestraScene, false);
  game.scene.add('SortingScene', SortingScene, false);

  game.registry.set('appContext', context);

  // Test/recording hooks exist only with ?e2e=1 (they expose the correct answer).
  const speechRecorder = new SpeechRecorder();
  if (isE2e()) context.audio.setObserver(speechRecorder);
  if (isE2e()) window.__testHooks__ = {
    goToScreen(screen) {
      window.__GAME_READY__ = false;
      const sceneKey =
        screen === 'map' ? 'MapScene'
        : screen === 'restaurant' ? 'RestaurantScene'
        : screen === 'hiding' ? 'HidingScene'
        : screen === 'orchestra' ? 'OrchestraScene'
        : screen === 'sorting' ? 'SortingScene'
        : 'BubblesScene';
      game.scene.stop('PreloadScene');
      game.scene.stop('MapScene');
      game.scene.stop('RestaurantScene');
      game.scene.stop('HidingScene');
      game.scene.stop('BubblesScene');
      game.scene.stop('OrchestraScene');
      game.scene.stop('SortingScene');
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
    seedOrchestraLevel(level) {
      const profileId = context.requireProfileId();
      const { world, id, languages } = context.content.orchestra;
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
    seedSortingLevel(level) {
      seedAdaptiveLevel(
        context.adaptive,
        context.requireProfileId(),
        context.content.sorting,
        level,
        localDayKey(new Date(context.nowMs())),
      );
    },
    seedLanguageSetting(lang) {
      context.store.getState().settings.languages = lang;
      context.store.persist();
    },
    getSortingInfo() {
      const scene = game.scene.getScene('SortingScene') as SortingScene | null;
      return scene && game.scene.isActive('SortingScene') ? scene.getSortingInfo() : null;
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
    getOrchestraInfo() {
      const scene = game.scene.getScene('OrchestraScene') as OrchestraScene | null;
      return scene && game.scene.isActive('OrchestraScene') ? scene.getRoundInfo() : null;
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
    getBuildingHit(worldId) {
      if (!game.scene.isActive('MapScene')) return null;
      const scene = game.scene.getScene('MapScene') as MapScene | null;
      const gameRect = scene?.getBuildingRect(worldId);
      if (!gameRect) return null;
      const box = game.canvas.getBoundingClientRect();
      return gameRectToPageRect(
        gameRect,
        { x: box.left, y: box.top, width: box.width, height: box.height },
        { width: game.scale.width, height: game.scale.height },
      );
    },
    getSpokenLines(sinceIndex) {
      return speechRecorder.getLines(sinceIndex);
    },
    getSpokenLineCount() {
      return speechRecorder.getCount();
    },
    isListening() {
      return context.isListening();
    },
  };

  return game;
}

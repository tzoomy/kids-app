import Phaser from 'phaser';
import { MapScene } from '../worlds/MapScene';
import { RestaurantScene, type RoundInfo } from '../games/restaurant/RestaurantScene';
import { HidingScene, type HidingRoundInfo } from '../games/hiding/HidingScene';
import { BubblesScene } from '../games/bubbles/BubblesScene';
import { OrchestraScene, type OrchestraRoundInfo } from '../games/orchestra/OrchestraScene';
import { SortingScene } from '../games/sorting/SortingScene';
import type { SortingInfo } from '../games/sorting/types';
import { seedAdaptiveLevel } from '../games/sorting/seedLevel';
import { PicnicScene } from '../games/picnic/PicnicScene';
import type { PicnicInfo } from '../games/picnic/types';
import { ColouringScene } from '../games/colouring/ColouringScene';
import { BalloonScene } from '../games/balloon/BalloonScene';
import type { BalloonInfo } from '../games/balloon/types';
import { SuitcaseScene } from '../games/travelSuitcase/SuitcaseScene';
import type { SuitcaseInfo } from '../games/travelSuitcase/suitcaseTypes';
import { loadTravelSuitcase } from '../content/loadContent';
import { SeedFlowerScene } from '../games/seedFlower/SeedFlowerScene';
import type { SeedFlowerInfo } from '../games/seedFlower/seedFlowerTypes';
import { loadSeedToFlower } from '../content/loadContent';
import { PotionScene } from '../games/potionLab/PotionScene';
import type { PotionInfo } from '../games/potionLab/potionTypes';
import { loadPotionLab } from '../content/loadContent';
import { SinkFloatScene } from '../games/sinkFloat/SinkFloatScene';
import type { SinkFloatInfo } from '../games/sinkFloat/sinkFloatTypes';
import { loadSinkOrFloat } from '../content/loadContent';
import { MagnetScene } from '../games/magicMagnet/MagnetScene';
import type { MagnetInfo } from '../games/magicMagnet/magnetTypes';
import { loadMagicMagnet } from '../content/loadContent';
import type { ColouringInfo, ColouringSeed } from '../games/colouring/types';
import { writeColouringSeed } from '../core/colouring/seed';
import { LetterMonsterScene } from '../games/letterMonster/LetterMonsterScene';
import type { LetterMonsterInfo } from '../games/letterMonster/letterMonsterTypes';
import { loadLetterMonster } from '../content/loadContent';
import { WardrobeScene } from '../games/wardrobe/WardrobeScene';
import type { WardrobeInfo, WardrobeSeed } from '../games/wardrobe/wardrobeTypes';
import { applyWardrobeSeed, buildWardrobeInfo } from '../games/wardrobe/wardrobeInfo';
import { loadWardrobeState, saveWardrobeState } from '../core/wardrobe/store';
import type { AppContext } from './appContext';
import type { Store } from '../core/storage/store';
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
      goToScreen: (screen: 'map' | 'restaurant' | 'hiding' | 'bubbles' | 'orchestra' | 'sorting' | 'picnic' | 'colouring' | 'letter-monster' | 'balloon' | 'potion-lab' | 'sink-or-float' | 'magic-magnet' | 'travel-suitcase' | 'seed-flower') => void;
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
      /** Writes settings.timeEarning = { enabled } and persists. Seed only: no navigation, no game action, no profile needed. */
      seedTimeEarningEnabled: (enabled: boolean) => void;
      /** Seeds the active profile's persisted Picnic Train level (level, cleanStreak 0, recent []) for every language. Call before entering. */
      seedPicnicLevel: (level: number) => void;
      /** Current Picnic Train (null when PicnicScene is not active or has no train); rectangles are page CSS px. */
      getPicnicInfo: () => PicnicInfo | null;
      /** Current Sorting Beds round (null when SortingScene is not active or has no round); rectangles are page CSS px. */
      getSortingInfo: () => SortingInfo | null;
      /** Writes the Colouring Time autosave key only. Call on the map, before entering. */
      seedColouringState: (seed: ColouringSeed) => void;
      /** Current Colouring Time page (null when ColouringScene is not active or has no page); rectangles are page CSS px. */
      getColouringInfo: () => ColouringInfo | null;
      /** Seeds the active profile's persisted Letter Monster level. Call before entering. */
      seedLetterMonsterLevel: (level: number) => void;
      /** Current Letter Monster round (null when LetterMonsterScene is not active); rectangles are page CSS px. */
      getLetterMonsterInfo: () => LetterMonsterInfo | null;
      /** Seeds the active profile's persisted Balloon Pop level (cleanStreak 0, recent []) for every language. Call on the map, before entering. */
      seedBalloonLevel: (level: number) => void;
      /** Current Balloon Pop trial (null when BalloonScene is not active or between trials); rectangles are page CSS px. */
      getBalloonInfo: () => BalloonInfo | null;
      /** Same for Who's Hiding?. Call before entering it. */
      seedHidingLevel: (level: number) => void;
      /** Seeds the persisted Travel Suitcase level (cleanStreak 0, recent []) for every content language. Call on the map, before entering. */
      seedSuitcaseLevel: (level: number) => void;
      /** Current Travel Suitcase state (null when SuitcaseScene is not active); rectangles are page CSS px. */
      getSuitcaseInfo: () => SuitcaseInfo | null;
      /** Seeds the persisted Seed to Flower level (cleanStreak 0, recent []) for every language. Call on the map, before entering. */
      seedSeedFlowerLevel: (level: number) => void;
      /** Current Seed to Flower plant (null when SeedFlowerScene is not active); rectangles are page CSS px. */
      getSeedFlowerInfo: () => SeedFlowerInfo | null;
      /** Seeds the persisted Potion Lab level (cleanStreak 0, recent []) for every language. Call on the map, before entering. */
      seedPotionLevel: (level: number) => void;
      /** Current Potion Lab state (null when PotionScene is not active); rectangles are page CSS px. */
      getPotionInfo: () => PotionInfo | null;
      /** Writes the active profile's wardrobe state (seed only; merged over the defaults, the starter is kept). Call on the map. */
      seedWardrobeState: (seed: WardrobeSeed) => void;
      /** Wardrobe snapshot of the current profile; works on the map and in WardrobeScene (null before a profile is picked). */
      getWardrobeInfo: () => WardrobeInfo | null;
      /** Records a completed round through the same AppContext call the games use; returns the newly unlocked item ids. */
      recordCompletedRound: (worldId: string, gameId: string) => string[];
      /** Seeds the persisted Sink or Float level (cleanStreak 0, recent []) for every language. Call on the map, before entering. */
      seedSinkFloatLevel: (level: number) => void;
      /** Current Sink or Float state (null when SinkFloatScene is not active); rectangles are page CSS px. */
      getSinkFloatInfo: () => SinkFloatInfo | null;
      /** Seeds the persisted Magic Magnet level (cleanStreak 0, recent []) for every language. Call on the map, before entering. */
      seedMagnetLevel: (level: number) => void;
      /** Current Magic Magnet state (null when MagnetScene is not active); rectangles are page CSS px. */
      getMagnetInfo: () => MagnetInfo | null;
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

/** ?e2e=1 only. Installs seedTimeEarningEnabled before the Phaser game exists (profile-select). */
export function installEarlyTimeEarningHook(store: Store): void {
  if (!isE2e()) return;
  const current = window.__testHooks__;
  const seedTimeEarningEnabled = (enabled: boolean): void => {
    store.getState().settings.timeEarning = { enabled };
    store.persist();
  };
  window.__testHooks__ = {
    ...(current ?? {}),
    seedTimeEarningEnabled,
  } as NonNullable<Window['__testHooks__']>;
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
  game.scene.add('PicnicScene', PicnicScene, false);
  game.scene.add('ColouringScene', ColouringScene, false);
  game.scene.add('LetterMonsterScene', LetterMonsterScene, false);
  game.scene.add('BalloonScene', BalloonScene, false);
  game.scene.add('SuitcaseScene', SuitcaseScene, false);
  game.scene.add('SeedFlowerScene', SeedFlowerScene, false);
  game.scene.add('PotionScene', PotionScene, false);
  game.scene.add('WardrobeScene', WardrobeScene, false);
  game.scene.add('SinkFloatScene', SinkFloatScene, false);
  game.scene.add('MagnetScene', MagnetScene, false);

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
        : screen === 'picnic' ? 'PicnicScene'
        : screen === 'colouring' ? 'ColouringScene'
        : screen === 'letter-monster' ? 'LetterMonsterScene'
        : screen === 'balloon' ? 'BalloonScene'
        : screen === 'potion-lab' ? 'PotionScene'
        : screen === 'sink-or-float' ? 'SinkFloatScene'
        : screen === 'magic-magnet' ? 'MagnetScene'
        : screen === 'travel-suitcase' ? 'SuitcaseScene'
        : screen === 'seed-flower' ? 'SeedFlowerScene'
        : 'BubblesScene';
      game.scene.stop('PreloadScene');
      game.scene.stop('MapScene');
      game.scene.stop('RestaurantScene');
      game.scene.stop('HidingScene');
      game.scene.stop('BubblesScene');
      game.scene.stop('OrchestraScene');
      game.scene.stop('SeedFlowerScene');
      game.scene.stop('SortingScene');
      game.scene.stop('PicnicScene');
      game.scene.stop('ColouringScene');
      game.scene.stop('LetterMonsterScene');
      game.scene.stop('BalloonScene');
      game.scene.stop('PotionScene');
      game.scene.stop('SinkFloatScene');
      game.scene.stop('WardrobeScene');
      game.scene.stop('MagnetScene');
      game.scene.stop('SuitcaseScene');
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
    seedTimeEarningEnabled(enabled) {
      context.store.getState().settings.timeEarning = { enabled };
      context.store.persist();
    },
    getSortingInfo() {
      const scene = game.scene.getScene('SortingScene') as SortingScene | null;
      return scene && game.scene.isActive('SortingScene') ? scene.getSortingInfo() : null;
    },
    seedPicnicLevel(level) {
      seedAdaptiveLevel(
        context.adaptive,
        context.requireProfileId(),
        context.content.picnic,
        level,
        localDayKey(new Date(context.nowMs())),
      );
    },
    getPicnicInfo() {
      const scene = game.scene.getScene('PicnicScene') as PicnicScene | null;
      return scene && game.scene.isActive('PicnicScene') ? scene.getPicnicInfo() : null;
    },
    seedColouringState(seed) {
      writeColouringSeed(window.localStorage, context.requireProfileId(), seed);
    },
    getColouringInfo() {
      const scene = game.scene.getScene('ColouringScene') as ColouringScene | null;
      return scene && game.scene.isActive('ColouringScene') ? scene.getColouringInfo() : null;
    },
    seedLetterMonsterLevel(level) {
      seedAdaptiveLevel(
        context.adaptive,
        context.requireProfileId(),
        loadLetterMonster(),
        level,
        localDayKey(new Date(context.nowMs())),
      );
    },
    getLetterMonsterInfo() {
      const scene = game.scene.getScene('LetterMonsterScene') as LetterMonsterScene | null;
      return scene && game.scene.isActive('LetterMonsterScene') ? scene.getLetterMonsterInfo() : null;
    },
    seedBalloonLevel(level) {
      const profileId = context.requireProfileId();
      const { world, id, languages } = context.content.balloon;
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
    getBalloonInfo() {
      const scene = game.scene.getScene('BalloonScene') as BalloonScene | null;
      return scene && game.scene.isActive('BalloonScene') ? scene.getBalloonInfo() : null;
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
    seedPotionLevel(level) {
      seedAdaptiveLevel(context.adaptive, context.requireProfileId(), loadPotionLab(), level, localDayKey(new Date(context.nowMs())));
    },
    getPotionInfo() {
      const scene = game.scene.getScene('PotionScene') as PotionScene | null;
      return scene && game.scene.isActive('PotionScene') ? scene.getPotionInfo() : null;
    },
    seedSinkFloatLevel(level) {
      seedAdaptiveLevel(context.adaptive, context.requireProfileId(), loadSinkOrFloat(), level, localDayKey(new Date(context.nowMs())));
    },
    getSinkFloatInfo() {
      const scene = game.scene.getScene('SinkFloatScene') as SinkFloatScene | null;
      return scene && game.scene.isActive('SinkFloatScene') ? scene.getSinkFloatInfo() : null;
    },
    seedSuitcaseLevel(level) {
      seedAdaptiveLevel(context.adaptive, context.requireProfileId(), loadTravelSuitcase(), level, localDayKey(new Date(context.nowMs())));
    },
    getSuitcaseInfo() {
      const scene = game.scene.getScene('SuitcaseScene') as SuitcaseScene | null;
      return scene && game.scene.isActive('SuitcaseScene') ? scene.getSuitcaseInfo() : null;
    },
    seedSeedFlowerLevel(level) {
      seedAdaptiveLevel(context.adaptive, context.requireProfileId(), loadSeedToFlower(), level, localDayKey(new Date(context.nowMs())));
    },
    getSeedFlowerInfo() {
      const scene = game.scene.getScene('SeedFlowerScene') as SeedFlowerScene | null;
      return scene && game.scene.isActive('SeedFlowerScene') ? scene.getSeedFlowerInfo() : null;
    },
    seedWardrobeState(seed) {
      saveWardrobeState(window.localStorage, context.requireProfileId(), applyWardrobeSeed(seed));
    },
    getWardrobeInfo() {
      const profileId = context.currentProfileId;
      if (!profileId) return null;
      return buildWardrobeInfo(
        loadWardrobeState(window.localStorage, profileId),
        context.currentAgeTrack(),
        context.lastWardrobeUnlock,
        game.scene.isActive('WardrobeScene'),
      );
    },
    recordCompletedRound(worldId, gameId) {
      return context.recordCompletedRound(worldId, gameId);
    },
    seedMagnetLevel(level) {
      seedAdaptiveLevel(context.adaptive, context.requireProfileId(), loadMagicMagnet(), level, localDayKey(new Date(context.nowMs())));
    },
    getMagnetInfo() {
      const scene = game.scene.getScene('MagnetScene') as MagnetScene | null;
      return scene && game.scene.isActive('MagnetScene') ? scene.getMagnetInfo() : null;
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

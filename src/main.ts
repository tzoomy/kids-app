import creditsJson from './content/credits.json';
import { creditsFileSchema } from './content/credits';
import '@fontsource/noto-sans-hebrew/hebrew-400.css';
import '@fontsource/noto-sans-hebrew/hebrew-700.css';
import '@fontsource/noto-sans/latin-400.css';
import '@fontsource/noto-sans/latin-700.css';
import './styles/shell.css';
import type Phaser from 'phaser';
import { Store } from './core/storage/store';
import { AudioManager, DeviceTtsProvider, StaticFileProvider, SfxPlayer } from './core/audio';
import { AppShell } from './ui/shell';
import { AppContext } from './game/appContext';
// Phaser-free boot helpers only: createGame (Phaser, MapScene) is imported dynamically in pickProfile.
import { installEarlyTimeEarningHook, isE2e } from './game/e2eBoot';
import { initPwa, setAppScreen, setPersistBeforePwaUpdate } from './pwa';
import { loadWorlds, loadAnimalRestaurant, loadKitchenOrchestra, loadSortingBeds, loadPicnicTrain, loadWhosHiding, loadWhoLivesHere, loadLeisureColouring, loadShadowMatch, loadBalloonPop, loadLetterMonster, loadTravelSuitcase, loadSeedToFlower, loadPotionLab, loadSinkOrFloat, loadMagicMagnet, loadHeStrings, loadAudioManifest } from './content/loadContent';
import { heLine } from './content/voiceLines';
import { isTimeEarningEnabled, type AgeTrack } from './core/storage/schema';

const shellRoot = document.getElementById('shell-root');
if (!shellRoot) throw new Error('#shell-root missing from web/index.html');

const store = new Store();
installEarlyTimeEarningHook(store);
const audioManager = new AudioManager([new StaticFileProvider(loadAudioManifest(), import.meta.env.BASE_URL), new DeviceTtsProvider()]);
const sfx = new SfxPlayer();
const shell = new AppShell(shellRoot);

const context = new AppContext(store, audioManager, sfx, {
  worlds: loadWorlds(),
  restaurant: loadAnimalRestaurant(),
  orchestra: loadKitchenOrchestra(),
  letterMonster: loadLetterMonster(),
  suitcase: loadTravelSuitcase(),
  sorting: loadSortingBeds(),
  picnic: loadPicnicTrain(),
  balloon: loadBalloonPop(),
  hiding: loadWhosHiding(),
  habitat: loadWhoLivesHere(),
  seedToFlower: loadSeedToFlower(),
  potionLab: loadPotionLab(),
  sinkOrFloat: loadSinkOrFloat(),
  magicMagnet: loadMagicMagnet(),
  colouring: loadLeisureColouring(),
  shadow: loadShadowMatch(),
  he: loadHeStrings(),
}, shell);

let game: Phaser.Game | null = null;
/** True while the engine chunk (Phaser + MapScene) is being fetched; further profile taps are ignored. */
let gameLoading = false;
let warmedUp = false;
function warmupAudioOnce(): void {
  if (warmedUp) return;
  warmedUp = true;
  audioManager.warmup();
  sfx.warmup();
}
document.addEventListener('pointerdown', warmupAudioOnce, { once: true });
document.addEventListener('visibilitychange', () => {
  if (document.hidden) store.persist();
});
setPersistBeforePwaUpdate(() => store.persist());
setAppScreen('profile');
initPwa();

function openParentGate(onDone: () => void): void {
  setAppScreen('parent');
  // Test-only bypass behind ?e2e=1 so Playwright can reach the settings screen
  // deterministically. The real multiplication gate stays intact in production.
  if (isE2e()) {
    openParentSettings(onDone);
    return;
  }
  shell.showParentGate(
    () => openParentSettings(onDone),
    () => onDone(),
  );
}

/** The 3-second long-press path: straight to the parent settings, no multiplication question. */
function openParentSettingsDirect(onDone: () => void): void {
  setAppScreen('parent');
  openParentSettings(onDone);
}

function openParentSettings(onDone: () => void): void {
  shell.showParentSettings(store.getState(), {
    onSave: (settings, edits) => {
      const state = store.getState();
      state.settings = settings;
      for (const edit of edits) {
        const p = state.profiles.find((pr) => pr.id === edit.id);
        if (!p) continue;
        if (edit.name) p.name = edit.name;
        p.ageTrack = edit.ageTrack as AgeTrack;
      }
      store.persist();
      onDone();
    },
    onExit: onDone,
    onOpenCredits: () => shell.showCredits(creditsFileSchema.parse(creditsJson).items, () => openParentSettings(onDone)),
    onResetBalance: (profileId) => {
      const s = store.getProfileState(profileId, new Date());
      s.balanceSec = 0;
      s.earnedTodaySec = 0;
      s.carry = 0;
      store.persist();
      openParentSettings(onDone);
    },
    onPlusFive: (profileId) => {
      const s = store.getProfileState(profileId, new Date());
      s.balanceSec += 300;
      store.persist();
      openParentSettings(onDone);
    },
  });
}

let welcomed = false;
/**
 * Plays the Hebrew welcome once. Autoplay may be blocked before the first gesture: then it
 * fails silently and we retry on the first tap on the profile screen (unless that tap picks
 * a profile, which stops the audio).
 */
function welcomeOnce(): void {
  if (welcomed) return;
  const tryPlay = (): void => {
    if (welcomed) return;
    welcomed = true;
    audioManager.play(heLine('welcome')).then(
      (played) => {
        if (!played) armWelcomeOnGesture();
      },
      () => armWelcomeOnGesture(),
    );
  };
  const armWelcomeOnGesture = (): void => {
    welcomed = false;
    document.addEventListener(
      'pointerdown',
      () => {
        if (context.currentProfileId === null && !welcomed) tryPlay();
      },
      { once: true },
    );
  };
  tryPlay();
}

function showProfileSelectScreen(): void {
  setAppScreen('profile');
  const state = store.getState();
  const entries = state.profiles.map((profile) => ({
    profile,
    state: store.getProfileState(profile.id, new Date()),
    showTime: isTimeEarningEnabled(state.settings),
  }));
  shell.showProfileSelect(
    entries,
    (id) => pickProfile(id),
    () => openParentGate(() => showProfileSelectScreen()),
    () => openParentSettingsDirect(() => showProfileSelectScreen()),
  );
  welcomeOnce();
}

/** Stops every game scene. Phaser's scene.stop is a no-op for a lazily loaded scene that was never added. */
function stopAllGameScenes(): void {
  for (const key of [
    'RestaurantScene', 'HidingScene', 'SortingScene', 'PicnicScene', 'HabitatScene', 'ColouringScene', 'ShadowScene',
    'MagnetScene', 'LetterMonsterScene', 'SuitcaseScene', 'SeedFlowerScene', 'PotionScene', 'SinkFloatScene',
    'BubblesScene', 'BalloonScene',
  ]) {
    game?.scene.stop(key);
  }
}

function returnToProfileSelect(): void {
  store.persist();
  audioManager.stopAll();
  stopAllGameScenes();
  game?.scene.stop('MapScene');
  context.currentProfileId = null;
  shell.clearChrome();
  showProfileSelectScreen();
}

function pickProfile(profileId: string): void {
  if (gameLoading) return; // the engine chunk is still loading: ignore a second tap
  setAppScreen('loading');
  context.currentProfileId = profileId;
  audioManager.stopAll();
  warmupAudioOnce();

  if (!game) {
    gameLoading = true;
    import('./game/createGame').then(
      ({ createGame }) => {
        gameLoading = false;
        startGame(createGame);
      },
      (err: unknown) => {
        gameLoading = false;
        console.error('Could not load the game engine', err);
        context.currentProfileId = null;
        showProfileSelectScreen();
      },
    );
  } else {
    stopAllGameScenes();
    game.scene.start('MapScene');
  }
}

function startGame(createGame: (parent: HTMLElement, ctx: AppContext) => Phaser.Game): void {
  context.onRequestParent = () =>
    openParentGate(() => {
      shell.clearOverlay();
      game?.scene.getScene('MapScene')?.scene.restart();
    });
  context.onRequestParentSettings = () =>
    openParentSettingsDirect(() => {
      shell.clearOverlay();
      game?.scene.getScene('MapScene')?.scene.restart();
    });
  context.onExitToProfileSelect = returnToProfileSelect;
  game = createGame(document.getElementById('game-root')!, context);
}

showProfileSelectScreen();

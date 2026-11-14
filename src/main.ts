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
import { createGame, installEarlyTimeEarningHook, isE2e } from './game/createGame';
import { initPwa, setAppScreen, setPersistBeforePwaUpdate } from './pwa';
import { loadWorlds, loadAnimalRestaurant, loadKitchenOrchestra, loadSortingBeds, loadWhosHiding, loadLeisureColouring, loadHeStrings, loadAudioManifest } from './content/loadContent';
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
  sorting: loadSortingBeds(),
  hiding: loadWhosHiding(),
  colouring: loadLeisureColouring(),
  he: loadHeStrings(),
}, shell);

let game: Phaser.Game | null = null;
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

function returnToProfileSelect(): void {
  store.persist();
  audioManager.stopAll();
  game?.scene.stop('RestaurantScene');
  game?.scene.stop('HidingScene');
  game?.scene.stop('SortingScene');
  game?.scene.stop('ColouringScene');
  game?.scene.stop('NumberBridgeScene');
  game?.scene.stop('SeedFlowerScene');
  game?.scene.stop('BubblesScene');
  game?.scene.stop('MapScene');
  context.currentProfileId = null;
  shell.clearChrome();
  showProfileSelectScreen();
}

function pickProfile(profileId: string): void {
  setAppScreen('loading');
  context.currentProfileId = profileId;
  audioManager.stopAll();
  warmupAudioOnce();

  if (!game) {
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
  } else {
    game.scene.stop('RestaurantScene');
    game.scene.stop('HidingScene');
    game.scene.stop('SortingScene');
    game.scene.stop('ColouringScene');
    game.scene.stop('NumberBridgeScene');
    game.scene.stop('SeedFlowerScene');
    game.scene.stop('BubblesScene');
    game.scene.start('MapScene');
  }
}

showProfileSelectScreen();

// Queues the Mystery Egg art on a scene's Phaser loader and TOLERATES missing files: a failed file is marked missing
// (drawn placeholder) and never throws. Voice and sfx files are played with audio elements (voiceProvider.ts, eggSound.ts).
// The Gemini PR adds the files at the manifest paths; nothing here changes when they land.
import Phaser from 'phaser';
import { assetUrl, mysteryEggManifest } from './assets';
import { eggAvailability } from './voiceProvider';

/** Longest the scene waits for the loader before it draws with what it has. */
const LOAD_TIMEOUT_MS = 4000;

export function loadEggAssets(scene: Phaser.Scene, base: string, done: () => void): void {
  let queued = 0;
  for (const [id, entry] of Object.entries(mysteryEggManifest())) {
    if (entry.kind === 'vo' || entry.kind === 'sfx' || eggAvailability.isMissing(id)) continue;
    if (scene.textures.exists(id)) {
      eggAvailability.markLoaded(id);
      continue;
    }
    scene.load.image(id, assetUrl(id, base));
    queued++;
  }
  if (queued === 0) {
    done();
    return;
  }
  let finished = false;
  const onFileComplete = (key: string): void => eggAvailability.markLoaded(key);
  const onError = (file: { key: string }): void => eggAvailability.markMissing(file.key);
  const finish = (): void => {
    if (finished) return;
    finished = true;
    window.clearTimeout(timer);
    scene.load.off(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
    scene.load.off(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
    scene.load.off(Phaser.Loader.Events.COMPLETE, finish);
    done();
  };
  const timer = window.setTimeout(finish, LOAD_TIMEOUT_MS);
  scene.load.on(Phaser.Loader.Events.FILE_COMPLETE, onFileComplete);
  scene.load.on(Phaser.Loader.Events.FILE_LOAD_ERROR, onError);
  scene.load.once(Phaser.Loader.Events.COMPLETE, finish);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    finished = true;
    window.clearTimeout(timer);
  });
  scene.load.start();
}

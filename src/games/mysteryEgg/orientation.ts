// Mystery Egg scenes follow the window's orientation (docs/specs/game-shell.md AC-33). The game boots at the size of the
// window's orientation (createGame); without this a portrait boot that is later rotated kept its 800x1280 canvas, FIT-letterboxed
// in a landscape window (and the reverse). Same idea as Colouring and Stickers (`syncOrientation`), shared by the two scenes.
import Phaser from 'phaser';
import { baseSizeFor } from '../../game/baseSize';

/** Resizes the game canvas to the window's orientation when it differs; the scale manager then emits `resize` for the scene to re-fit. */
export function syncGameOrientation(scene: Phaser.Scene): void {
  const want = baseSizeFor(window.innerWidth, window.innerHeight);
  if (scene.scale.width === want.width && scene.scale.height === want.height) return;
  scene.scale.setGameSize(want.width, want.height);
  scene.scale.refresh();
}

/** Syncs now and on every window resize or rotation until the scene shuts down. */
export function followOrientation(scene: Phaser.Scene): void {
  const sync = (): void => {
    if (scene.sys.isActive()) syncGameOrientation(scene);
  };
  sync();
  window.addEventListener('resize', sync);
  window.addEventListener('orientationchange', sync);
  scene.events.once(Phaser.Scenes.Events.SHUTDOWN, () => {
    window.removeEventListener('resize', sync);
    window.removeEventListener('orientationchange', sync);
  });
}

// Mystery Egg sfx: plays the manifest file when it loaded, otherwise a short synthesized placeholder.
import type Phaser from 'phaser';
import { eggAvailability } from './voiceProvider';
import { synthBeep, synthBell, synthRoll } from './placeholderSfx';

export type EggSfx = 'sfx-robot-beep-1' | 'sfx-robot-beep-2' | 'sfx-robot-beep-3' | 'sfx-bell' | 'sfx-ball-roll';

const SYNTH: Record<EggSfx, () => void> = {
  'sfx-robot-beep-1': () => synthBeep(1),
  'sfx-robot-beep-2': () => synthBeep(2),
  'sfx-robot-beep-3': () => synthBeep(3),
  'sfx-bell': synthBell,
  'sfx-ball-roll': synthRoll,
};

export function playEggSfx(scene: Phaser.Scene, id: EggSfx): void {
  try {
    if (eggAvailability.isReady(id) && scene.cache.audio.exists(id)) {
      scene.sound.play(id, { volume: 0.8 });
      return;
    }
  } catch {
    // fall through to the synthesized placeholder
  }
  SYNTH[id]();
}

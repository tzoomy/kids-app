// Mystery Egg sfx: plays the manifest file (public/audio/mystery-egg/<id>.ogg) with a plain audio element and falls back
// to a short synthesized placeholder when the file is missing or unplayable. Never throws, never leaves a rejected promise.
// (Phaser's audio loader is deliberately not used: its decode failure for a missing file is an unhandled rejection.)
import { assetUrl } from './assets';
import { eggAvailability } from './voiceProvider';
import { synthBeep, synthBell, synthPop, synthRoll, synthSuccess } from './placeholderSfx';

export type EggSfx = 'sfx-robot-beep-1' | 'sfx-robot-beep-2' | 'sfx-robot-beep-3' | 'sfx-bell' | 'sfx-ball-roll' | 'sfx-success' | 'sfx-pop';

const SYNTH: Record<EggSfx, () => void> = {
  'sfx-robot-beep-1': () => synthBeep(1),
  'sfx-robot-beep-2': () => synthBeep(2),
  'sfx-robot-beep-3': () => synthBeep(3),
  'sfx-bell': synthBell,
  'sfx-ball-roll': synthRoll,
  'sfx-success': synthSuccess,
  'sfx-pop': synthPop,
};

export function playEggSfx(id: EggSfx): void {
  if (eggAvailability.isMissing(id)) {
    SYNTH[id]();
    return;
  }
  let handled = false;
  const missing = (): void => {
    if (handled) return;
    handled = true;
    eggAvailability.markMissing(id);
    SYNTH[id]();
  };
  try {
    const audio = new Audio(assetUrl(id, import.meta.env.BASE_URL));
    audio.volume = 0.8;
    audio.addEventListener('error', missing, { once: true });
    const started = audio.play();
    if (started && typeof started.catch === 'function') {
      started.catch((err: unknown) => {
        // A blocked autoplay says nothing about the file: stay silent. Anything else means the file is not there.
        if ((err as { name?: string } | null)?.name !== 'NotAllowedError') missing();
      });
    }
  } catch {
    missing();
  }
}

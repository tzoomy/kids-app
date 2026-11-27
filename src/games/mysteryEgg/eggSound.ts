// Mystery Egg sfx: plays the manifest file (public/audio/mystery-egg/<id>.ogg) with a plain audio element and falls back
// to a short synthesized placeholder when the file is missing or unplayable. Never throws, never leaves a rejected promise.
// (Phaser's audio loader is deliberately not used: its decode failure for a missing file is an unhandled rejection.)
import { assetUrl } from './assets';
import { eggAvailability } from './voiceProvider';
import {
  synthBeep, synthBell, synthClack, synthClonk, synthCreak, synthMorningBell, synthPop, synthRoll, synthSnip, synthSnore, synthSuccess,
  synthSwish, synthThump, synthTownWake, synthTrapdoor, synthYawn,
} from './placeholderSfx';

export type EggSfx =
  | 'sfx-robot-beep-1' | 'sfx-robot-beep-2' | 'sfx-robot-beep-3' | 'sfx-bell' | 'sfx-ball-roll' | 'sfx-success' | 'sfx-pop'
  // Workshop L20 (docs/specs/workshop-l20-assets.md section 4); `sfx-ws-trapdoor` is optional (a synth click when absent).
  | 'sfx-ws-trapdoor' | 'sfx-ws-snip' | 'sfx-ws-rope-swish' | 'sfx-ws-domino-clack' | 'sfx-ws-sandbag-thump' | 'sfx-ws-seesaw-creak'
  | 'sfx-ws-bell-morning' | 'sfx-ws-lantern-clonk' | 'sfx-ws-town-wake' | 'sfx-ws-yawn' | 'sfx-ws-snore';

const SYNTH: Record<EggSfx, (pitch?: number) => void> = {
  'sfx-robot-beep-1': () => synthBeep(1),
  'sfx-robot-beep-2': () => synthBeep(2),
  'sfx-robot-beep-3': () => synthBeep(3),
  'sfx-bell': synthBell,
  'sfx-ball-roll': synthRoll,
  'sfx-success': synthSuccess,
  'sfx-pop': synthPop,
  'sfx-ws-trapdoor': synthTrapdoor,
  'sfx-ws-snip': synthSnip,
  'sfx-ws-rope-swish': synthSwish,
  'sfx-ws-domino-clack': synthClack,
  'sfx-ws-sandbag-thump': synthThump,
  'sfx-ws-seesaw-creak': synthCreak,
  'sfx-ws-bell-morning': synthMorningBell,
  'sfx-ws-lantern-clonk': synthClonk,
  'sfx-ws-town-wake': synthTownWake,
  'sfx-ws-yawn': synthYawn,
  'sfx-ws-snore': synthSnore,
};

/** Every sfx id this module can play (the union's members). */
export function eggSfxIds(): EggSfx[] {
  return Object.keys(SYNTH) as EggSfx[];
}

export interface EggSfxOptions {
  /** Playback rate of a real file and pitch of the synth placeholder (1 = natural; the domino clack varies +-8%). */
  pitch?: number;
  /** 0..1, default 0.8. */
  volume?: number;
}

export function playEggSfx(id: EggSfx, opts: EggSfxOptions = {}): void {
  if (eggAvailability.isMissing(id)) {
    SYNTH[id](opts.pitch);
    return;
  }
  let handled = false;
  const missing = (): void => {
    if (handled) return;
    handled = true;
    eggAvailability.markMissing(id);
    SYNTH[id](opts.pitch);
  };
  try {
    const audio = new Audio(assetUrl(id, import.meta.env.BASE_URL));
    audio.volume = opts.volume ?? 0.8;
    if (opts.pitch && opts.pitch !== 1) audio.playbackRate = opts.pitch;
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

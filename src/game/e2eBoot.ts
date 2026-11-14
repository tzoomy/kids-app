// Phaser-free e2e boot helpers. src/main.ts (the shell entry chunk) imports these instead of createGame,
// so Phaser and every game scene stay out of the entry (see docs/ARCHITECTURE.md, "Code splitting").
import type { Store } from '../core/storage/store';
import { saveWardrobeState } from '../core/wardrobe/store';
import { applyWardrobeSeed } from '../games/wardrobe/wardrobeInfo';
import type { WardrobeSeed } from '../games/wardrobe/wardrobeTypes';

export function isE2e(): boolean {
  return new URLSearchParams(window.location.search).get('e2e') === '1';
}

/** ?e2e=1 only: writes a named profile's wardrobe state; needs no active profile (works on the profile-select screen). */
export function seedWardrobeStateForProfile(profileId: string, seed: WardrobeSeed): void {
  saveWardrobeState(window.localStorage, profileId, applyWardrobeSeed(seed));
}

/** ?e2e=1 only. Installs seedTimeEarningEnabled before the Phaser game exists (profile-select). */
export function installEarlyTimeEarningHook(store: Store): void {
  if (!isE2e()) return;
  const current = window.__testHooks__;
  const seedTimeEarningEnabled = (enabled: boolean): void => {
    store.getState().settings.timeEarning = { enabled };
    store.persist();
  };
  // The engine chunk (createGame) installs the full hook set when it loads, replacing this object. Until then the e2e
  // helpers poll getActiveScenes() right after a profile tap, so give it the honest answer: no engine, no active scene.
  window.__testHooks__ = {
    getActiveScenes: (): string[] => [],
    ...(current ?? {}),
    seedTimeEarningEnabled,
    seedWardrobeStateForProfile,
  } as NonNullable<Window['__testHooks__']>;
}

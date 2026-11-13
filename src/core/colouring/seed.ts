// Seed-only writer for ?e2e=1 `seedColouringState`. Writes the autosave key in the frozen
// format and does not navigate, change the scene, or touch the balance (AC-28).
import { COLOURING_SAVE_VERSION, colouringKey, type ColouringSave } from './store';

export interface ColouringSeedInput {
  pageId: string;
  fills?: Record<string, string>;
}

/**
 * Merges a seed into `kids-app-colouring:<profileId>`. A corrupt existing value is replaced.
 * Does not call loadColouringState / saveColouringState (those stay unimplemented in step 1).
 */
export function writeColouringSeed(
  storage: Pick<Storage, 'getItem' | 'setItem'>,
  profileId: string,
  seed: ColouringSeedInput,
): void {
  const key = colouringKey(profileId);
  let current: ColouringSave = { v: COLOURING_SAVE_VERSION, currentPageId: seed.pageId, pages: {} };
  const raw = storage.getItem(key);
  if (raw) {
    try {
      const parsed = JSON.parse(raw) as ColouringSave;
      if (parsed && parsed.v === COLOURING_SAVE_VERSION && parsed.pages && typeof parsed.pages === 'object') {
        current = { v: COLOURING_SAVE_VERSION, currentPageId: seed.pageId, pages: { ...parsed.pages } };
      }
    } catch {
      // replace a corrupt value
    }
  }
  if (seed.fills) current.pages[seed.pageId] = { ...seed.fills };
  storage.setItem(key, JSON.stringify(current));
}

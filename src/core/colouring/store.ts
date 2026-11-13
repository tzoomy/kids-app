// Colouring Time autosave. No Phaser. Spec: docs/specs/leisure-colouring.md (AC-19).
// Key: kids-app-colouring:<profileId>. Schema: { v: 1, currentPageId, pages }.
// TDD step 1: load/save throw 'not implemented'. The seed hook writes the key via ./seed.ts.

export const COLOURING_KEY_PREFIX = 'kids-app-colouring:';
export const COLOURING_SAVE_VERSION = 1 as const;

export function colouringKey(profileId: string): string {
  return `${COLOURING_KEY_PREFIX}${profileId}`;
}

export interface ColouringSave {
  v: typeof COLOURING_SAVE_VERSION;
  currentPageId: string;
  pages: Record<string, Record<string, string>>;
}

export function loadColouringState(
  _storage: Pick<Storage, 'getItem'>,
  _profileId: string,
): ColouringSave {
  throw new Error('not implemented');
}

export function saveColouringState(
  _storage: Pick<Storage, 'setItem'>,
  _profileId: string,
  _state: ColouringSave,
): void {
  throw new Error('not implemented');
}

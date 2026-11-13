// Colouring Time autosave. No Phaser. Spec: docs/specs/leisure-colouring.md (AC-19).
// Key: kids-app-colouring:<profileId>. Schema: { v: 1, currentPageId, pages }.
import leisureColouringJson from '../../content/games/leisure-colouring.json';

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

const PAGES = leisureColouringJson.pages as Array<{ id: string; regions: Array<{ id: string }> }>;
const PALETTE = leisureColouringJson.palette as Array<{ id: string }>;
const DEFAULT_PAGE_ID = PAGES[0]?.id ?? 'cat';
const KNOWN_PAGES = new Set(PAGES.map((p) => p.id));
const KNOWN_COLORS = new Set(PALETTE.map((c) => c.id));
const KNOWN_REGIONS = new Map(PAGES.map((p) => [p.id, new Set(p.regions.map((r) => r.id))]));

function emptySave(): ColouringSave {
  return { v: COLOURING_SAVE_VERSION, currentPageId: DEFAULT_PAGE_ID, pages: {} };
}

function sanitize(state: ColouringSave): ColouringSave {
  const currentPageId = KNOWN_PAGES.has(state.currentPageId) ? state.currentPageId : DEFAULT_PAGE_ID;
  const pages: Record<string, Record<string, string>> = {};
  for (const [pageId, fills] of Object.entries(state.pages ?? {})) {
    if (!KNOWN_PAGES.has(pageId) || !fills || typeof fills !== 'object') continue;
    const known = KNOWN_REGIONS.get(pageId) ?? new Set<string>();
    const cleaned: Record<string, string> = {};
    for (const [regionId, colorId] of Object.entries(fills)) {
      if (known.has(regionId) && typeof colorId === 'string' && KNOWN_COLORS.has(colorId)) {
        cleaned[regionId] = colorId;
      }
    }
    pages[pageId] = cleaned;
  }
  return { v: COLOURING_SAVE_VERSION, currentPageId, pages };
}

export function loadColouringState(
  storage: Pick<Storage, 'getItem'>,
  profileId: string,
): ColouringSave {
  const raw = storage.getItem(colouringKey(profileId));
  if (!raw) return emptySave();
  try {
    const parsed = JSON.parse(raw) as Partial<ColouringSave>;
    if (!parsed || parsed.v !== COLOURING_SAVE_VERSION || typeof parsed.currentPageId !== 'string' || !parsed.pages || typeof parsed.pages !== 'object') {
      return emptySave();
    }
    return sanitize({ v: COLOURING_SAVE_VERSION, currentPageId: parsed.currentPageId, pages: parsed.pages as ColouringSave['pages'] });
  } catch {
    return emptySave();
  }
}

export function saveColouringState(
  storage: Pick<Storage, 'setItem'>,
  profileId: string,
  state: ColouringSave,
): void {
  storage.setItem(colouringKey(profileId), JSON.stringify(sanitize(state)));
}

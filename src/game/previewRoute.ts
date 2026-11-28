// Preview route: `?level=N` (or `#/workshop/N`, `#/level/N`) boots straight into a level for the tablet check, skipping the
// profile screen, the intro and the map, independent of progress. Any other URL boots exactly as before. Pure, no Phaser.
// Only levels listed in PREVIEW_LEVELS exist as stand-alone scenes (today: Workshop L20); every other number boots normally.

/** level number -> scene key. Adding a level that has its own scene is one line here. */
export const PREVIEW_LEVELS: Readonly<Record<number, string>> = { 20: 'WorkshopL20Scene' };

export interface PreviewRoute {
  level: number;
  scene: string;
}

function levelRoute(raw: string | null | undefined): PreviewRoute | null {
  const text = (raw ?? '').trim();
  if (!/^\d{1,3}$/.test(text)) return null;
  const level = Number(text);
  const scene = PREVIEW_LEVELS[level];
  return scene ? { level, scene } : null;
}

export function parsePreviewRoute(search: string, hash: string): PreviewRoute | null {
  const fromQuery = levelRoute(new URLSearchParams(search).get('level'));
  if (fromQuery) return fromQuery;
  const m = /^#\/(?:workshop|level)\/(\d{1,3})$/.exec(hash);
  return m ? levelRoute(m[1]) : null;
}

export type BootTarget = 'profile-select' | 'preview-level';

/** What the app shows first: the profile select (the default) or the preview level. */
export function bootTarget(search: string, hash: string): BootTarget {
  return parsePreviewRoute(search, hash) ? 'preview-level' : 'profile-select';
}

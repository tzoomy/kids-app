// Preview route: `?level=20` (or `#/workshop/20`) boots straight into Workshop level 20 for the tablet check, skipping the
// profile screen, the intro and the map, independent of progress. Any other URL boots exactly as before. Pure, no Phaser.

export interface PreviewRoute {
  level: 20;
  scene: 'WorkshopL20Scene';
}

const L20: PreviewRoute = { level: 20, scene: 'WorkshopL20Scene' };

export function parsePreviewRoute(search: string, hash: string): PreviewRoute | null {
  if (new URLSearchParams(search).get('level') === '20') return L20;
  if (hash === '#/workshop/20') return L20;
  return null;
}

export type BootTarget = 'profile-select' | 'workshop-l20';

/** What the app shows first: the profile select (the default) or the preview level. */
export function bootTarget(search: string, hash: string): BootTarget {
  return parsePreviewRoute(search, hash) ? 'workshop-l20' : 'profile-select';
}

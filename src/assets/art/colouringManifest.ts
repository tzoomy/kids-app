// Colouring Time art keys. Loaded when ColouringScene opens, never at boot (AC-34).
// Do not add these entries to ART_MANIFEST / registerProjectArt / PreloadScene.
import type { ArtManifestEntry } from './manifest';

const PAGE_IDS = ['cat', 'dog', 'rabbit', 'bear', 'panda', 'lion', 'butterfly', 'chef'] as const;

export const COLOURING_ART_MANIFEST: ArtManifestEntry[] = [
  ...PAGE_IDS.map((id) => ({
    key: `colouring-page-${id}`,
    url: `art/colouring/pages/${id}.svg`,
    width: 800,
    height: 800,
  })),
  { key: 'leisure-colouring-bg-landscape', url: 'art/scenes/leisure-colouring/bg-landscape.svg', width: 1280, height: 800 },
  { key: 'leisure-colouring-bg-portrait', url: 'art/scenes/leisure-colouring/bg-portrait.svg', width: 800, height: 1280 },
];

export const COLOURING_ART_KEYS = COLOURING_ART_MANIFEST.map((e) => e.key);

// The installed (Android) app opens at start_url and drops a typed query; a manifest shortcut and launch_handler are the two
// supported ways to reach a level from the installed app (docs/specs/workshop-l20.md AC-22).
import { describe, expect, it } from 'vitest';
import { readFileSync, existsSync } from 'node:fs';
import { parsePreviewRoute } from '../../src/game/previewRoute';

const manifest = JSON.parse(readFileSync('public/manifest.json', 'utf8')) as {
  id?: string;
  start_url: string;
  scope: string;
  launch_handler?: { client_mode?: string | string[] };
  shortcuts?: Array<{ name: string; short_name?: string; url: string; icons?: Array<{ src: string }> }>;
};

describe('PWA manifest', () => {
  it('[AC-22] start_url and scope stay /kids-app/ (changing them would orphan the installed app)', () => {
    expect(manifest.start_url).toBe('/kids-app/');
    expect(manifest.scope).toBe('/kids-app/');
  });

  it('[AC-22] a shortcut opens Workshop L20 inside the scope, and its query parses to the L20 preview route', () => {
    const l20 = manifest.shortcuts?.find((s) => s.url.includes('level=20'));
    expect(l20, 'an L20 shortcut').toBeDefined();
    const url = new URL(l20!.url, 'https://tzoomy.github.io');
    expect(url.pathname.startsWith(manifest.scope)).toBe(true);
    expect(parsePreviewRoute(url.search, url.hash)).toEqual({ level: 20, scene: 'WorkshopL20Scene' });
    expect(l20!.name.length).toBeGreaterThan(0);
    for (const icon of l20!.icons ?? []) expect(existsSync(`public/${icon.src}`), icon.src).toBe(true);
  });

  it('[AC-22] a launch (a link tapped while the app is already open) navigates the open window to the launched URL', () => {
    const mode = manifest.launch_handler?.client_mode;
    expect(Array.isArray(mode) ? mode[0] : mode).toBe('navigate-existing');
  });
});

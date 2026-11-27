// Guards the manifest against Gemini's merged media (PR #108): every manifest path is a real file under public/,
// every file in the two media folders is in the manifest, and WebP pixel sizes match the display sizes (2x; hub-bg 1x).
import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { ALL_ONE_X_ART_IDS, mysteryEggManifest } from '../../src/games/mysteryEgg/assets';
import workshopManifest from '../../src/content/workshopAssets.json';

const publicDir = path.resolve(__dirname, '..', '..', 'public');

/** Width and height of a WebP file from its header (VP8, VP8L or VP8X). */
function webpSize(file: string): { width: number; height: number } {
  const b = fs.readFileSync(file);
  expect(b.toString('ascii', 0, 4), file).toBe('RIFF');
  expect(b.toString('ascii', 8, 12), file).toBe('WEBP');
  const kind = b.toString('ascii', 12, 16);
  if (kind === 'VP8X') return { width: 1 + b.readUIntLE(24, 3), height: 1 + b.readUIntLE(27, 3) };
  if (kind === 'VP8L') {
    const bits = b.readUInt32LE(21);
    return { width: (bits & 0x3fff) + 1, height: ((bits >> 14) & 0x3fff) + 1 };
  }
  if (kind === 'VP8 ') return { width: b.readUInt16LE(26) & 0x3fff, height: b.readUInt16LE(28) & 0x3fff };
  throw new Error(`Unknown WebP chunk ${kind} in ${file}`);
}

describe('mystery-egg media files (Gemini PR #108)', () => {
  const manifest = mysteryEggManifest();

  it('[AC-14] every prototype manifest path is a real file under public/; a game shell file (art|audio/game-shell, Gemini\'s later media PR) may still be missing', () => {
    for (const [id, e] of Object.entries(manifest)) {
      if (e.path.includes('/game-shell/')) continue;
      expect(fs.existsSync(path.join(publicDir, e.path)), `${id}: ${e.path}`).toBe(true);
    }
  });

  it('[AC-14] every file in public/art/mystery-egg and public/audio/mystery-egg is listed in the manifest', () => {
    // Workshop media (L20 contract, src/content/workshopAssets.json) shares the mystery-egg folders.
    const listed = new Set([...Object.values(manifest), ...Object.values(workshopManifest)].map((e) => e.path));
    for (const dir of ['art/mystery-egg', 'audio/mystery-egg', 'art/game-shell', 'audio/game-shell']) {
      if (!fs.existsSync(path.join(publicDir, dir))) continue; // the game shell folders arrive with Gemini's media PR
      for (const name of fs.readdirSync(path.join(publicDir, dir))) expect(listed.has(`${dir}/${name}`), `${dir}/${name}`).toBe(true);
    }
  });

  it('[AC-14] WebP pixel sizes are 2x the display size (1x for hub-bg, map-bg, the shell slides and the Workshop backgrounds), times the frame count for a strip; only files that exist are checked', () => {
    // Both manifests: the mystery-egg one and the Workshop L20 one (its dawn/morning backgrounds are 1x, every other art file 2x).
    type Entry = { path: string; kind: string; w?: number; h?: number; frames?: number };
    const entries: Array<[string, Entry]> = [...Object.entries(manifest), ...Object.entries(workshopManifest)];
    for (const [id, e] of entries) {
      if (e.kind !== 'webp' && e.kind !== 'sprite') continue;
      if (!fs.existsSync(path.join(publicDir, e.path))) continue; // media not delivered yet
      const k = ALL_ONE_X_ART_IDS.includes(id) ? 1 : 2;
      const { width, height } = webpSize(path.join(publicDir, e.path));
      expect([width, height], id).toEqual([(e.w as number) * k * (e.frames ?? 1), (e.h as number) * k]);
    }
  });
});

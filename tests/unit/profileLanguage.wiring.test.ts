import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';

function walk(dir: string): string[] {
  return fs.readdirSync(dir, { withFileTypes: true }).flatMap((e) => {
    const full = path.join(dir, e.name);
    return e.isDirectory() ? walk(full) : full.endsWith('.ts') ? [full] : [];
  });
}

// The learning language is per profile. Only the schema (deprecated fallback + helper), the migration, and the
// seed hook (which also writes the legacy field) may touch the global `settings.languages`.
const ALLOWED = new Set([
  'src/core/storage/schema.ts',
  'src/core/storage/legacyMigration.ts',
  'src/game/createGame.ts',
]);

describe('per-profile language wiring', () => {
  it('no production code reads the deprecated global settings.languages except the allowed files', () => {
    const offenders = walk('src')
      .filter((f) => !ALLOWED.has(f.split(path.sep).join('/')))
      .filter((f) => /settings\??\.languages\b/.test(fs.readFileSync(f, 'utf8')));
    expect(offenders).toEqual([]);
  });

  it('the game scenes read the active profile language through the app context', () => {
    const scenes = walk('src/games').filter((f) => /Scene\.ts$/.test(f) && /nextRoundLanguage|pickLanguage|langSetting/.test(fs.readFileSync(f, 'utf8')));
    expect(scenes.length).toBeGreaterThanOrEqual(16);
    for (const f of scenes) expect(fs.readFileSync(f, 'utf8'), f).toMatch(/languageSetting\(\)/);
  });
});

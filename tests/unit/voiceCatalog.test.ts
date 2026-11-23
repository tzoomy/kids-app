import { spawnSync } from 'node:child_process';
import fs from 'node:fs';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import audioManifest from '../../src/content/audio-manifest.json';
import textHashes from '../../src/content/audio-text-hashes.json';
import { gameVoiceCatalog, gameVoiceExport, voicePathFor } from '../../src/content/voiceCatalog';

const ROOT = path.resolve(__dirname, '../..');
const EXPORT_PATH = path.join(ROOT, 'src/content/game-voice-lines.json');

const catalog = gameVoiceCatalog();
const byId = new Map(catalog.map((l) => [l.id, l]));
const PREFIX = /^(suitcase|monster|wordtrain|picnic|sorting|potion|magnet|sinkFloat|seed)\./;

describe('game voice catalogue (Travel Suitcase, Letter Monster, Word Train + Wave 2 age-5 EN/FR task asks)', () => {
  it('[AC-19] [AC-16] [AC-15] ids are unique and well-formed, every text is non-empty, and the language matches the id suffix', () => {
    expect(catalog.length).toBeGreaterThan(500);
    expect(byId.size).toBe(catalog.length);
    expect(new Set(catalog.map((l) => l.path)).size).toBe(catalog.length);
    for (const line of catalog) {
      expect(line.id, line.id).toMatch(PREFIX);
      expect(line.id.endsWith(`.${line.lang}`), line.id).toBe(true);
      expect(line.text.trim().length, line.id).toBeGreaterThan(0);
      expect(line.path).toBe(voicePathFor(line.id, line.lang));
      expect(line.path).toMatch(/^audio\/(en|fr|he)\/[a-z0-9-]+\.mp3$/);
      expect(line.text).not.toMatch(/[{}]/); // no unfilled frame placeholders
    }
  });

  it('[AC-19] help-pill, intro and closing lines of all three games are catalogued', () => {
    for (const id of [
      'suitcase.help.he',
      'suitcase.intro.he',
      'suitcase.closed.he',
      'monster.help.he',
      'monster.intro.he',
      'monster.notThis.he',
      'wordtrain.help.he',
      'wordtrain.intro.load.he',
      'wordtrain.intro.spell.he',
      'wordtrain.intro.spell.fr.he',
    ]) {
      expect(byId.get(id), id).toBeDefined();
      expect(byId.get(id)!.lang).toBe('he');
    }
  });

  it('[AC-19] no clip is registered yet: catalogued ids are not in audio-manifest.json or audio-text-hashes.json', () => {
    for (const line of catalog) {
      expect((audioManifest as Record<string, string>)[line.id], line.id).toBeUndefined();
      expect((textHashes as Record<string, string>)[line.id], line.id).toBeUndefined();
    }
  });

  it('[AC-19] new Hebrew lines are feminine singular (no masculine or plural imperatives)', () => {
    const masculine = /(^|[\s,.!?])(בוא|הקשב|לחץ|נסה|שמע|בחר|העמס|בנה|בואו|הקשיבו|לחצו|נסו|שמעו|בחרו)(?=[\s,.!?]|$)/;
    for (const line of catalog.filter((l) => l.lang === 'he')) {
      expect(line.text, line.id).not.toMatch(masculine);
    }
  });

  it('[AC-19] src/content/game-voice-lines.json is the catalogue export the TTS job reads (run with UPDATE_VOICE_CATALOG=1 to regenerate)', () => {
    const fresh = `${JSON.stringify(gameVoiceExport(), null, 1)}\n`;
    if (process.env.UPDATE_VOICE_CATALOG === '1') fs.writeFileSync(EXPORT_PATH, fresh);
    expect(fs.readFileSync(EXPORT_PATH, 'utf8'), 'stale export: UPDATE_VOICE_CATALOG=1 npx vitest run tests/unit/voiceCatalog.test.ts').toBe(fresh);
  });

  const python = spawnSync('python3', ['-I', '-c', 'print(1)'], { encoding: 'utf8' });
  it.skipIf(python.status !== 0)('[AC-19] scripts/tts/generate_voice.py collect_lines() includes every catalogued id and keeps the existing lines', () => {
    const script = [
      'import json, sys',
      "sys.path.insert(0, 'scripts/tts')",
      'import generate_voice as g',
      'print(json.dumps(g.collect_lines()))',
    ].join('; ');
    const res = spawnSync('python3', ['-I', '-c', script], { cwd: ROOT, encoding: 'utf8' });
    expect(res.status, res.stderr).toBe(0);
    const lines = JSON.parse(res.stdout) as Array<{ id: string; lang: string; text: string; path: string }>;
    const pyById = new Map(lines.map((l) => [l.id, l]));
    expect(pyById.size).toBe(lines.length); // unique ids across restaurant, Hebrew, poêle and the games
    for (const line of catalog) {
      const hit = pyById.get(line.id);
      expect(hit, line.id).toBeDefined();
      expect(hit!.text).toBe(line.text);
      expect(hit!.path).toBe(line.path);
    }
    // Existing sources are unchanged.
    expect(pyById.has('food.apple.1.en')).toBe(true);
    expect(pyById.has('orchestra.play.pan.fr')).toBe(true);
    expect([...pyById.keys()].some((id) => id.startsWith('he.'))).toBe(true);
    const gameIds = new Set(catalog.map((l) => l.id));
    expect(lines.filter((l) => PREFIX.test(l.id) && !gameIds.has(l.id))).toEqual([]);
  });
});

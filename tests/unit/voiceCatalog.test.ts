import { spawnSync } from 'node:child_process';
import path from 'node:path';
import { describe, expect, it } from 'vitest';
import audioManifest from '../../src/content/audio-manifest.json';
import textHashes from '../../src/content/audio-text-hashes.json';
import { gameVoiceCatalog } from '../../src/content/voiceCatalog';

const ROOT = path.resolve(__dirname, '../..');

const catalog = gameVoiceCatalog();
const byId = new Map(catalog.map((l) => [l.id, l]));
const PREFIX = /^(suitcase|monster|wordtrain)\./;

describe('game voice catalogue (Travel Suitcase, Letter Monster, Word Train)', () => {
  it('[AC-19] [AC-16] [AC-15] ids are unique and well-formed, every text is non-empty, and the language matches the id suffix', () => {
    expect(catalog.length).toBeGreaterThan(500);
    expect(byId.size).toBe(catalog.length);
    for (const line of catalog) {
      expect(line.id, line.id).toMatch(PREFIX);
      expect(line.id.endsWith(`.${line.lang}`), line.id).toBe(true);
      expect(line.text.trim().length, line.id).toBeGreaterThan(0);
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

  it('[AC-19] only the 35 Word Train English lines recorded in #103 have clips, each rendered from its catalogued text', () => {
    const manifest = audioManifest as Record<string, string>;
    const recorded = catalog.filter((l) => manifest[l.id]);
    expect(recorded.length).toBe(35);
    for (const line of recorded) {
      expect(line.id, line.id).toMatch(/^wordtrain\..*\.en$/);
      expect((textHashes as Record<string, string>)[line.id], line.id).toBeTruthy();
    }
    // Text-hash freshness for every recorded line is checked in gameVoiceLines.test.ts / audioStaticFile.test.ts.
  });

  it('[AC-19] new Hebrew lines are feminine singular (no masculine or plural imperatives)', () => {
    const masculine = /(^|[\s,.!?])(בוא|הקשב|לחץ|נסה|שמע|בחר|העמס|בנה|בואו|הקשיבו|לחצו|נסו|שמעו|בחרו)(?=[\s,.!?]|$)/;
    for (const line of catalog.filter((l) => l.lang === 'he')) {
      expect(line.text, line.id).not.toMatch(masculine);
    }
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
    const lines = JSON.parse(res.stdout) as Array<{ id: string; lang: string; text: string }>;
    const pyById = new Map(lines.map((l) => [l.id, l]));
    expect(pyById.size).toBe(lines.length); // unique ids across restaurant, Hebrew, poêle and the games
    for (const line of catalog) {
      const hit = pyById.get(line.id);
      expect(hit, line.id).toBeDefined();
      expect(hit!.text).toBe(line.text);
      expect(hit!.lang).toBe(line.lang);
    }
    // Existing sources are unchanged.
    expect(pyById.has('food.apple.1.en')).toBe(true);
    expect(pyById.has('orchestra.play.pan.fr')).toBe(true);
    expect([...pyById.keys()].some((id) => id.startsWith('he.'))).toBe(true);
    const gameIds = new Set(catalog.map((l) => l.id));
    expect(lines.filter((l) => PREFIX.test(l.id) && !gameIds.has(l.id))).toEqual([]);
  });
});

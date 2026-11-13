import { describe, expect, it } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import crypto from 'node:crypto';
import heLines from '@/content/voice-lines-he.json';
import manifestJson from '@/content/audio-manifest.json';
import textHashes from '@/content/audio-text-hashes.json';

const manifest = manifestJson as Record<string, string>;
const hashes = textHashes as Record<string, string>;

// Must match text_hash() in scripts/tts/generate_voice.py and tests/unit/audioStaticFile.test.ts.
const HASH_PREFIX = 'gemini-3.8-flash-tts|Leda|warm, cheerful, slow and clear, speaking to a 2 to 5 year old|';

const LINES = [
  { key: 'hiding.intro', lineId: 'he.hiding.intro', file: 'audio/he/hiding-intro.mp3' },
  { key: 'hiding.help', lineId: 'he.hiding.help', file: 'audio/he/hiding-help.mp3' },
] as const;

describe("Who's Hiding? intro and help clips [AC-34]", () => {
  it('[AC-34] voice-lines-he.json has hiding.intro and hiding.help; clips, manifest rows, and text hashes match', () => {
    const root = path.resolve(__dirname, '../..');
    for (const line of LINES) {
      const text = (heLines as Record<string, string>)[line.key];
      expect(text, `${line.key} text`).toBeTruthy();
      expect(manifest[line.lineId], `${line.lineId} manifest row`).toBe(line.file);
      const abs = path.join(root, 'public', line.file);
      expect(fs.existsSync(abs), abs).toBe(true);
      const expected = crypto.createHash('sha1').update(HASH_PREFIX + text, 'utf8').digest('hex').slice(0, 12);
      expect(hashes[line.lineId], `${line.lineId} text hash`).toBe(expected);
    }
  });
});

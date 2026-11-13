// Import / PWA / hook-gating contracts (AC-04, AC-08, AC-27, AC-28, AC-30).
import { describe, it, expect } from 'vitest';
import fs from 'node:fs';
import path from 'node:path';
import { isSafeToApplyUpdate, type AppScreen } from '../../src/pwa/updatePolicy';

const ROOT = path.resolve(__dirname, '../..');

function read(rel: string): string {
  return fs.readFileSync(path.join(ROOT, rel), 'utf8');
}

function listColouringSrc(): string[] {
  const out: string[] = [];
  const walk = (dir: string) => {
    for (const ent of fs.readdirSync(dir, { withFileTypes: true })) {
      const p = path.join(dir, ent.name);
      if (ent.isDirectory()) walk(p);
      else if (ent.name.endsWith('.ts') || ent.name.endsWith('.tsx')) out.push(p);
    }
  };
  walk(path.join(ROOT, 'src/games/colouring'));
  walk(path.join(ROOT, 'src/core/colouring'));
  return out;
}

describe('leisure-colouring wiring', () => {
  it('[AC-04] ColouringScene and its modules do not import src/core/adaptive or SkillSession', () => {
    for (const file of listColouringSrc()) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/from ['"].*core\/adaptive['"]/);
      expect(src, file).not.toMatch(/SkillSession/);
    }
  });

  it('[AC-08] colouring modules spend only through LeisureSession and do not import the learning or adaptive engines', () => {
    for (const file of listColouringSrc()) {
      const src = fs.readFileSync(file, 'utf8');
      expect(src, file).not.toMatch(/LearningSession/);
      expect(src, file).not.toMatch(/from ['"].*core\/adaptive['"]/);
    }
    // The stub does not yet construct a LeisureSession; implementation must. This pins the allowed import.
    expect(read('src/core/leisure/leisureSession.ts')).toMatch(/export class LeisureSession/);
  });

  it("[AC-27] 'colouring' is an AppScreen and isSafeToApplyUpdate('colouring') is false", () => {
    const screen: AppScreen = 'colouring';
    expect(isSafeToApplyUpdate(screen)).toBe(false);
    expect(isSafeToApplyUpdate('map')).toBe(true);
    const policy = read('src/pwa/updatePolicy.ts');
    expect(policy).toMatch(/'colouring'/);
  });

  it('[AC-28] getColouringInfo and seedColouringState are installed only under ?e2e=1, and the seed hook writes only the autosave key', () => {
    const src = read('src/game/createGame.ts');
    expect(src).toMatch(/if \(isE2e\(\)\) window\.__testHooks__/);
    const hooksBlock = src.slice(src.indexOf('if (isE2e()) window.__testHooks__'));
    expect(hooksBlock).toMatch(/getColouringInfo\(/);
    expect(hooksBlock).toMatch(/seedColouringState\(/);
    // Hooks are not assigned outside the isE2e() block.
    const before = src.slice(0, src.indexOf('if (isE2e()) window.__testHooks__'));
    expect(before).not.toMatch(/getColouringInfo\s*\(/);
    expect(read('src/core/colouring/seed.ts')).toMatch(/kids-app-colouring:/);
    expect(read('src/core/colouring/seed.ts')).not.toMatch(/goToScreen|balanceSec|scene\.start/);
  });
});

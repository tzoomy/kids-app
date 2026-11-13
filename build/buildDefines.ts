import { execSync } from 'node:child_process';
import { readFileSync } from 'node:fs';
import path from 'node:path';

// Shared by vite.config.ts and vitest.config.ts so the build-time constants stay in sync.

const FALLBACK_VERSION = '0.0.0';

// Never throws: a missing/unreadable/invalid package.json or a bad `version` yields '0.0.0'
// so the Vite/Vitest config load cannot break.
export function readVersion(pkgPath: string = path.resolve(__dirname, '..', 'package.json')): string {
  try {
    const parsed: unknown = JSON.parse(readFileSync(pkgPath, 'utf8'));
    const version = (parsed as { version?: unknown } | null)?.version;
    return typeof version === 'string' && version.length > 0 ? version : FALLBACK_VERSION;
  } catch {
    return FALLBACK_VERSION;
  }
}

function readGitSha(): string {
  try {
    const sha = execSync('git rev-parse --short HEAD', { stdio: ['ignore', 'pipe', 'ignore'] })
      .toString()
      .trim();
    if (sha) return sha;
  } catch {
    // fall through to the CI fallback
  }
  const ci = process.env.GITHUB_SHA;
  return ci ? ci.slice(0, 7) : 'unknown';
}

// YYYY-MM-DD HH:mm in Asia/Jerusalem.
function formatBuildDate(now: Date): string {
  const parts = new Intl.DateTimeFormat('en-GB', {
    timeZone: 'Asia/Jerusalem',
    year: 'numeric',
    month: '2-digit',
    day: '2-digit',
    hour: '2-digit',
    minute: '2-digit',
    hourCycle: 'h23',
  }).formatToParts(now);
  const get = (type: string): string => parts.find((p) => p.type === type)?.value ?? '';
  return `${get('year')}-${get('month')}-${get('day')} ${get('hour')}:${get('minute')}`;
}

export function buildDefines(): Record<string, string> {
  return {
    __APP_VERSION__: JSON.stringify(readVersion()),
    __GIT_SHA__: JSON.stringify(readGitSha()),
    __BUILD_DATE__: JSON.stringify(formatBuildDate(new Date())),
  };
}

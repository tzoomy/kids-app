#!/bin/sh
# Stop hook: typecheck and run related unit tests when this turn left TypeScript changes.
# Official hooks reference (https://code.claude.com/docs/en/hooks):
# exit 2 on Stop prevents Claude from stopping and feeds stderr back so it can fix failures.
# exit 0 (and no TS changes) lets the turn end.

set -eu

ROOT=${CLAUDE_PROJECT_DIR:-}
if [ -z "$ROOT" ]; then
  ROOT=$(git rev-parse --show-toplevel 2>/dev/null || pwd)
fi
cd "$ROOT" || exit 0

# Staged and unstaged changes versus HEAD, as requested ("changed files from git diff").
CHANGED=$(git diff --name-only HEAD 2>/dev/null || true)
if [ -z "$CHANGED" ]; then
  exit 0
fi

TS_FILES=$(printf '%s\n' "$CHANGED" | grep -E '\.(ts|tsx|mts|cts)$' || true)
if [ -z "$TS_FILES" ]; then
  exit 0
fi

# Prefer the project's local binaries so `npx tsc` cannot fetch the wrong package.
PATH="$ROOT/node_modules/.bin:$PATH"
export PATH

if ! command -v tsc >/dev/null 2>&1 || ! command -v vitest >/dev/null 2>&1; then
  # No local toolchain (for example a fresh clone before npm install). Do not block the turn.
  exit 0
fi

STATUS=0
REPORT=$(mktemp)
trap 'rm -f "$REPORT"' EXIT

echo "Changed TypeScript files:" >"$REPORT"
printf '%s\n' "$TS_FILES" >>"$REPORT"
echo >>"$REPORT"

echo "+ tsc --noEmit" >>"$REPORT"
if ! tsc --noEmit >>"$REPORT" 2>&1; then
  STATUS=1
fi

echo "+ vitest related --run <changed files>" >>"$REPORT"
# shellcheck disable=SC2086
if ! vitest related --run $TS_FILES >>"$REPORT" 2>&1; then
  STATUS=1
fi

if [ "$STATUS" -ne 0 ]; then
  cat "$REPORT" >&2
  exit 2
fi
exit 0

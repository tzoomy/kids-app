#!/bin/sh
# Stop hook: typecheck and run related unit tests when this turn left TypeScript changes.
# Official hooks reference (https://code.claude.com/docs/en/hooks):
# exit 2 on Stop prevents Claude from stopping and feeds stderr back so it can fix failures.
#
# Failure policy (deliberate):
# - FAILS OPEN (exit 0) on the hook's own problems: stop_hook_active is true (never loop),
#   no usable repo, no changed TypeScript, missing local tsc/vitest, mktemp failure, any
#   unexpected internal error. This hook must never trap the session.
# - Reports real tsc / vitest failures with exit 2 (stderr only).
#
# Scope: changed = tracked changes versus HEAD (`git diff --name-only HEAD`) plus new
# untracked, non-ignored files (`git ls-files --others --exclude-standard`). Deleted paths are
# not passed to `vitest related` (whole-project tsc still covers them).
# Repo: the top level of the hook input `cwd`, else $CLAUDE_PROJECT_DIR, else this script's repo.

# Read stdin safely: never block on a TTY.
INPUT=''
if [ ! -t 0 ]; then
  INPUT=$(cat 2>/dev/null) || INPUT=''
fi

ACTIVE=0
IN_CWD=''
if [ -n "$INPUT" ] && command -v node >/dev/null 2>&1; then
  PARSED=$(printf '%s' "$INPUT" | node -e '
let s = "";
process.stdin.on("data", (d) => { s += d; }).on("end", () => {
  try {
    const j = JSON.parse(s);
    console.log(j.stop_hook_active === true ? "1" : "0");
    console.log(typeof j.cwd === "string" ? j.cwd.split("\n")[0] : "");
  } catch { console.log("0"); console.log(""); }
});' 2>/dev/null) || PARSED=''
  ACTIVE=$(printf '%s\n' "$PARSED" | sed -n 1p)
  IN_CWD=$(printf '%s\n' "$PARSED" | sed -n 2p)
elif [ -n "$INPUT" ]; then
  if printf '%s' "$INPUT" | grep -Eq '"stop_hook_active"[[:space:]]*:[[:space:]]*true'; then
    ACTIVE=1
  fi
fi

# A previous Stop hook already forced a continuation: do not loop.
if [ "$ACTIVE" = "1" ]; then
  exit 0
fi

# First candidate that is an existing directory is decisive.
SCRIPT_DIR=$(cd "$(dirname "$0")" 2>/dev/null && pwd) || SCRIPT_DIR=''
START=''
for candidate in "$IN_CWD" "${CLAUDE_PROJECT_DIR:-}" "$SCRIPT_DIR"; do
  if [ -n "$candidate" ] && [ -d "$candidate" ]; then
    START=$candidate
    break
  fi
done
[ -n "$START" ] || exit 0

ROOT=$(git -C "$START" rev-parse --show-toplevel 2>/dev/null) || exit 0
[ -n "$ROOT" ] || exit 0
cd "$ROOT" || exit 0

CHANGED=$( { git diff --name-only HEAD 2>/dev/null || true; git ls-files --others --exclude-standard 2>/dev/null || true; } | sort -u)
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

REPORT=$(mktemp 2>/dev/null) || exit 0
trap 'rm -f "$REPORT"' EXIT

# Existing files only for `vitest related`.
EXISTING=''
OLD_IFS=$IFS
IFS='
'
for f in $TS_FILES; do
  if [ -f "$f" ]; then
    EXISTING="${EXISTING}${f}
"
  fi
done
IFS=$OLD_IFS

STATUS=0
{
  echo "Changed TypeScript files:"
  printf '%s\n' "$TS_FILES"
  echo
  echo "+ tsc --noEmit"
} >"$REPORT"
if ! tsc --noEmit >>"$REPORT" 2>&1; then
  STATUS=1
fi

if [ -n "$EXISTING" ]; then
  echo "+ vitest related --run <changed files>" >>"$REPORT"
  # Split on newlines only so paths with spaces survive.
  OLD_IFS=$IFS
  IFS='
'
  set -f
  # shellcheck disable=SC2086
  set -- $EXISTING
  set +f
  IFS=$OLD_IFS
  if ! vitest related --run "$@" >>"$REPORT" 2>&1; then
    STATUS=1
  fi
fi

if [ "$STATUS" -ne 0 ]; then
  cat "$REPORT" >&2
  exit 2
fi
exit 0

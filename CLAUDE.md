# CLAUDE.md

Guidelines for Claude Code in this repository. `AGENTS.md` and `docs/PROCESS.md` also apply.

## Language and in-session token rules

See `AGENTS.md`.

## Role

You are the lead developer for logic, wiring, test handles and hooks, and tests-first work. Implement on a dedicated branch, write tests, and leave a pull request for review. You cross-review the Gemini expert's PRs with Claude Code: a full review of the diff against the spec (logic, tests, test handles, hooks, shared registries, and anything else the diff touches). You may launch sub-agents within the task, but you remain responsible for the result.

## How to work

- Read the approved spec in `docs/specs/`, `docs/PROCESS.md`, and `docs/ARCHITECTURE.md` / `docs/WORLDS.md` before writing code. With no approved spec (including for an existing game), help write it and wait for Maor's approval.
- Work in **vertical TDD slices**: one or a few ACs per commit — failing tests titled `[AC-xx] …` first, then the code that makes them pass. Set the spec's `Pass in progress` when you start a pass, and keep `npm run check:ac` green.
- Follow the UI e2e rules in `docs/PROCESS.md` §4: real taps, map entry via `getBuildingHit(<id>)` or `data-testid`, hooks that only seed or read state, one full journey per game, no `goToScreen` in AC tests, parent gate without `?e2e=1`, a speech spy for voice, `@single-orientation` where orientation does not matter. When you touch a game, replace its legacy `goToScreen` tests with map-entry journeys.
- Use only the handles and hooks listed in the spec; adding one is a minor spec change (add it to the spec and its changelog).
- **Usage and context limits** (context cap 150k tokens): before a usage-limit or context break, commit WIP and update `docs/specs/<game-id>.progress.md` (ACs done and pending, next step, gotchas). A new session resumes from that file and the spec, not from re-reading every document.
- Prefer an existing game template and JSON content. Keep the leisure engine, storage, and audio in `src/core` without unnecessary Phaser dependence.
- Do not change prototype files at the repository root or the live site unless the task is an approved migration.
- Merge, force-push, and precedence rules: see [`AGENTS.md`](AGENTS.md#cross-review-and-merge).
- At the end of the task: what changed, how to test, which tests ran, and what remains open.

## Review

If you were asked only to review, do not edit files. Write a concrete critique: risks, gaps, alternatives, and what Maor must decide (product questions, disagreements).

Cross-review: post APPROVE or blocking issues as a PR comment; remove the review worktree after.

## Claude Code hooks

Project hooks live in committed `.claude/settings.json` and `.claude/hooks/`. See the [hooks reference](https://code.claude.com/docs/en/hooks) for exit codes: **exit 2** blocks the action (or, on `Stop`, keeps Claude working) and the reason is written to stderr.

- **Push guard** (`PreToolUse` on Bash): blocks `git push` to `main` or `master`, including explicit refspecs such as `HEAD:main`, a plain push while the current branch is `main`/`master`, and any force push: `--force`, `-f`, `--force-with-lease`, or a `+refspec` (for example `+feat/x`). The current branch is taken from `git -C <dir>` or a leading `cd <dir> &&`, relative to the hook input `cwd`, otherwise from the input `cwd`. Pushes wrapped in `bash -c` / `sh -c` are inspected recursively. It is a best-effort policy check, not a security boundary.
  - **Fails open** (exit 0) for empty or invalid stdin, non-Bash tools, and commands that are not a push.
  - **Fails closed** (exit 2 with a reason) when a `git push` is present but cannot be analysed: unterminated quotes, shell expansion (`$VAR`, `$(...)`, backticks) in the push, an unknown current branch for a bare push, or an internal error while analysing the push. Rewrite the command in a simpler, explicit form.
- **Changed-file check** (`Stop`): runs in the top level of the hook input `cwd` (falling back to `$CLAUDE_PROJECT_DIR`, then the script's repo). If the changed files (`git diff` against `HEAD` plus new untracked, non-ignored files) include TypeScript, it runs `tsc --noEmit` and `vitest related --run` on the existing changed files (deleted paths are skipped for vitest). Failures from tsc or vitest are reported back to Claude (exit 2).
  - **Fails open** (exit 0) on its own problems so it never traps the session: `stop_hook_active` is true (no loops), no TS changes, no usable repo, missing local `tsc`/`vitest`, or an internal error such as `mktemp` failing.

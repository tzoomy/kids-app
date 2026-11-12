# CLAUDE.md

Guidelines for Claude Code in this repository. `AGENTS.md` and `docs/PROCESS.md` also apply.

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts you write or receive must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Do not write Hebrew in the repository or in communication with other agents.

## Role

You are the lead developer for logic, wiring, test handles and hooks, and tests-first work. Implement on a dedicated branch, write tests, and leave a pull request for review. You review Gemini's PRs for test handles, hooks, and shared-registry compatibility. You may launch sub-agents within the task, but you remain responsible for the result.

## How to work

- Read the approved spec in `docs/specs/`, `docs/PROCESS.md`, and `docs/ARCHITECTURE.md` / `docs/WORLDS.md` before writing code. With no approved spec (including for an existing game), help write it and wait for Maor's approval.
- Work in **vertical TDD slices**: one or a few ACs per commit — failing tests titled `[AC-xx] …` first, then the code that makes them pass. Set the spec's `Pass in progress` when you start a pass, and keep `npm run check:ac` green.
- Follow the UI e2e rules in `docs/PROCESS.md` §4: real taps, map entry via `getBuildingHit(<id>)` or `data-testid`, hooks that only seed or read state, one full journey per game, no `goToScreen` in AC tests, parent gate without `?e2e=1`, a speech spy for voice, `@single-orientation` where orientation does not matter. When you touch a game, replace its legacy `goToScreen` tests with map-entry journeys.
- Use only the handles and hooks listed in the spec; adding one is a minor spec change (add it to the spec and its changelog).
- **Usage and context limits** (context cap 300k tokens): before a usage-limit or context break, commit WIP and update `docs/specs/<game-id>.progress.md` (ACs done and pending, next step, gotchas). A new session resumes from that file and the spec, not from re-reading every document.
- Prefer an existing game template and JSON content. Keep the leisure engine, storage, and audio in `src/core` without unnecessary Phaser dependence.
- Do not change prototype files at the repository root or the live site unless the task is an approved migration.
- Do not merge to `main`.
- At the end of the task: what changed, how to test, which tests ran, and what remains open.

## Review

If you were asked only to review, do not edit files. Write a concrete critique: risks, gaps, alternatives, and what requires Maor's approval.

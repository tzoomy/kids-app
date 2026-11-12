# CLAUDE.md

Guidelines for Claude Code in this repository. `AGENTS.md` also applies.

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts you write or receive must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Do not write Hebrew in the repository or in communication with other agents.

## Role

You are the lead developer. Implement an issue on a dedicated branch, write tests, and leave a pull request for review. You may launch sub-agents within the task, but you remain responsible for the result.

## How to work

- Read the approved spec in `docs/specs/`, `docs/PROCESS.md`, and `docs/ARCHITECTURE.md` / `docs/WORLDS.md` before writing code. If there is no approved spec, help write or update it and wait for Maor's approval; do not start implementation.
- You own tests-first work and the UI e2e: write failing unit tests and Playwright journey tests from the spec's acceptance criteria, then implement until they pass. A journey test uses real taps (profile, the actual world building on the map, then the game) and must not call `__testHooks__.goToScreen`. Seed and inspect hooks under `?e2e=1` are allowed for setup and assertions. Add `data-testid` and other stable test handles where the tests need them.
- Prefer an existing game template and JSON content over a new game from scratch.
- The leisure engine, storage, and audio live in `src/core` (or the structure that was approved), without unnecessary Phaser dependence.
- Do not change prototype files at the repository root, and do not touch the live site, unless the task is explicitly an approved migration.
- Do not merge to `main`.
- At the end of the task: what changed, how to test, which tests ran, and what remains open.

## Review

If you were asked only to review — do not edit files. Write a concrete critique: risks, gaps, alternatives, and what requires Maor's approval.

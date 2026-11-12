# AGENTS.md

Rules for every agent (Claude Code, Gemini/Antigravity, Grok Bot, and others) in the `tzoomy/kids-app` repository.

## What this product is

A family learning app for Maor's daughters (age-2 and age-5 tracks). Hebrew UI, English learning and French reinforcement, played on an Android tablet, leisure time earned from educational play, a parent area, offline use, and minimal data collection. Live site: https://tzoomy.github.io/kids-app/

Direction documents: `docs/ARCHITECTURE.md`, `docs/WORLDS.md`, `docs/TEAM.md`, `docs/PROCESS.md`. Game specs live in `docs/specs/` (template: `docs/specs/TEMPLATE.md`). Choices Maor has not yet approved are marked there as **proposal — pending owner approval**. Do not treat a proposal as a decision.

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts to Claude, Gemini, or any other agent must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Hebrew is used only in conversation between Maor and Grok Bot, not in the repository and not in work among agents.

## Required

- Do not change the live app (prototype files at the repo root: `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`, icons) except in a task Maor has explicitly approved to replace or update the site.
- Do not merge a meaningful change to `main` without Maor's approval.
- Do not upload secrets, API keys, the girls' real names, or usage data. The repository is public.
- Do not add paid services, external analytics, ads, or AI at the child's runtime, unless Maor asked for that.
- Original assets only; do not copy characters, art, or audio from inspiration apps (Tiger eAcademy, Lingokids, Sago Mini, Khan Academy Kids, and others).
- One branch per task. Do not work directly on `main`, do not force-push a shared branch, do not rewrite `main` history.
- The leisure engine is a shared, tested module, with no penalty for mistakes and no mixing of balances across profiles.
- Persist data on the device only.

## Development process

The full cycle is in `docs/PROCESS.md`. Every agent follows these rules:

- **Spec first.** Do not write game or feature code until Maor has approved a spec at `docs/specs/<game-id>.md`. The spec is the source of truth. When requirements change, update the spec first, then the code.
- **Tests first.** Acceptance criteria become failing unit tests and Playwright UI e2e tests before implementation.
- **Real UI e2e.** Journey tests play through the actual screens with real taps: pick a profile, tap the world building on the map, enter the game, and verify everything the spec requires — not only map routing. Do not use `__testHooks__.goToScreen` in a journey test. Seed and inspect hooks under `?e2e=1` are allowed for setup and assertions. Add `data-testid` and other stable test handles (including map buildings) where the tests need them, and do not remove handles that tests already rely on.
- **Ready-for-tablet gate.** A game does not go to the tablet until CI is green, every test named in the spec passes, the work has been reviewed against the spec, and screenshots exist in both orientations.
- **Feedback updates the spec first.** Fixes come from real usage on the tablet, recorded by updating the spec, then a fix PR. Enjoyment metrics and observational playtest steps are not part of this process.
- Merge to `main` only with Maor's explicit approval (already required above).

Ship a playable version with device TTS and basic animation first; polish art, animation, and recorded voice later, still against the approved spec.

## Reviews and saving output

Raw reviews are stored in `docs/reviews/`. A code or architecture review is read-only unless the task also asks for a fix.

# AGENTS.md

Rules for every agent (Claude Code, Gemini/Antigravity, Grok Bot, and others) in the `tzoomy/kids-app` repository.

## What this product is

A family learning app for Maor's daughters (age-2 and age-5 tracks). Hebrew UI, English learning and French reinforcement, played on an Android tablet, leisure time earned from educational play, a parent area, offline use, and minimal data collection. Live site: https://tzoomy.github.io/kids-app/

Direction documents: `docs/ARCHITECTURE.md`, `docs/WORLDS.md`, `docs/TEAM.md`, `docs/PROCESS.md`. Game specs live in `docs/specs/` (template: `docs/specs/TEMPLATE.md`). Anything Maor has not approved is marked `Status: **draft — pending owner approval**` (a whole document) or `**Open decision for the owner:**` (one item). Older text in `docs/ARCHITECTURE.md` and `docs/WORLDS.md` still says **proposal — pending owner approval**, which means the same as an open decision. Do not treat any of these as approved.

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts to Claude, Gemini, or any other agent must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Hebrew is used only in conversation between Maor and Grok Bot, not in the repository and not in work among agents.

## Required

- Do not change the live app (prototype files at the repo root: `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`, icons) except in a task Maor has explicitly approved to replace or update the site.
- Do not merge any change to `main` without Maor's explicit approval. A merge to `main` publishes to GitHub Pages.
- Do not upload secrets, API keys, the girls' real names, or usage data. The repository is public.
- Do not add paid services, external analytics, ads, or AI at the child's runtime, unless Maor asked for that.
- Original assets only; do not copy characters, art, or audio from inspiration apps (Tiger eAcademy, Lingokids, Sago Mini, Khan Academy Kids, and others).
- One branch per task. Do not work directly on `main` and do not rewrite `main` history. Force-push only with `--force-with-lease` on your own task branch when rebasing it onto `origin/main`; never on `main` or on a branch another agent uses.
- The leisure engine is a shared, tested module, with no penalty for mistakes and no mixing of balances across profiles.
- Persist data on the device only.

## Development process

The full cycle is in `docs/PROCESS.md`. In short:

- **Spec first.** No game or feature code until Maor has approved `docs/specs/<game-id>.md`. Existing games (Animal Restaurant, Kitchen Orchestra, Who's Hiding?) get a retroactive spec before their next fix or feature PR. Changes update the spec first; substantive ones go back to Maor.
- **Two passes.** Pass 1 is a working game (device TTS, basic animation); Pass 2 is polish (art, animation, Gemini voice). Each is gated only against its own criteria.
- **Tests first.** Acceptance criteria have stable ids (`AC-01`, …) and become failing tests titled `[AC-xx] …` before implementation. CI fails if an automated criterion has no tagged test (`npm run check:ac`).
- **Real UI e2e.** Real taps through the actual screens, entering every game through its map building. `?e2e=1` hooks only seed or read state. `goToScreen` is for screenshot scripts only. Parent-gate tests run without `?e2e=1`.
- **Parallel work.** Gemini starts art, animation, and voice right after spec approval, to the paths, ids, and contract frozen in the spec. Shared registries merge additively.
- **Ready-for-merge gate.** CI green (including the spec's Playwright journeys and the AC coverage check), inspected in-game screenshots in both orientations, and a review against the spec by someone other than the sole author.
- **After merge.** Maor runs a functional tablet check (touch, rotation, audible voice, visuals). Failures and feedback update the spec first, then a fix PR. No enjoyment metrics or observational playtests.

## Reviews and saving output

Raw reviews are stored in `docs/reviews/`. A code or architecture review is read-only unless the task also asks for a fix.

# AGENTS.md

Rules for every agent (Claude Code, Gemini/Antigravity, Grok Bot, and others) in the `tzoomy/kids-app` repository.

Precedence: `AGENTS.md` > `docs/PROCESS.md` > `docs/TEAM.md` > `CLAUDE.md`/`GEMINI.md`; Maor's decisions override all. Merge, force-push, and precedence rules live only in this file; other files link here.

## What this product is

A family learning app for Maor's daughters (age-2 and age-5 tracks). Hebrew UI, English learning and French reinforcement, played on an Android tablet, leisure time earned from educational play (currently paused behind `settings.timeEarning.enabled`, default off: leisure games are fully open with no timer), a parent area, offline use, and minimal data collection. Live site: https://tzoomy.github.io/kids-app/

Direction documents: `docs/ARCHITECTURE.md`, `docs/WORLDS.md`, `docs/TEAM.md`, `docs/PROCESS.md`. Game specs live in `docs/specs/` (template: `docs/specs/TEMPLATE.md`). Anything Maor has not approved is marked `Status: **draft — pending owner approval**` (a whole document) or `**Open decision for the owner:**` (one item). Older text in `docs/ARCHITECTURE.md` and `docs/WORLDS.md` still says **proposal — pending owner approval**, which means the same as an open decision. Do not treat any of these as approved.

## Language

All code, comments, documentation, commit messages, issue and pull request titles and descriptions, and all prompts to Claude, Gemini, or any other agent must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Hebrew is used only in conversation between Maor and Grok Bot, not in the repository and not in work among agents.

## Required

- Do not change the live app (prototype files at the repo root: `index.html`, `app.js`, `style.css`, `sw.js`, `manifest.json`, icons) except in a task Maor has explicitly approved to replace or update the site.
- Never push directly to `main`. A merge to `main` publishes to GitHub Pages; merges follow [Cross-review and merge](#cross-review-and-merge).
- Do not upload secrets, API keys, the girls' real names, or usage data. The repository is public.
- Do not add paid services, external analytics, ads, or AI at the child's runtime, unless Maor asked for that.
- No connecting or changing external accounts, tools, or settings, no publishing, and no spending without Maor.
- Licence policy for dependencies, art, sound, and credits: `docs/ASSETS.md`.
- **Reuse first.** Prefer free ready-made assets and libraries: CC0 or CC-BY art and sound, credited in `src/content/credits.json` (no NC or SA licences); MIT, Apache, or BSD code, bundled locally. Main characters stay our own approved designs.
- Do not copy characters, art, or audio from inspiration apps (Tiger eAcademy, Lingokids, Sago Mini, Khan Academy Kids, and others).
- One branch per task. Do not work directly on `main` and do not rewrite `main` history.
- Remove your git worktree and local branch right after your PR is merged or closed; remove review worktrees right after the review.
- When drawing an approved character, attach its approved design image (`public/art/characters/<name>/` or `public/art/animals/<name>/`) as a reference.
- The leisure engine is a shared, tested module, with no penalty for mistakes and no mixing of balances across profiles.
- Persist data on the device only.

## Development process

The full cycle is in `docs/PROCESS.md`. In short:

- **Spec first.** No game or feature code until Maor has approved `docs/specs/<game-id>.md`. Existing games (Animal Restaurant, Kitchen Orchestra, Who's Hiding?) get a retroactive spec before their next fix or feature PR. Changes update the spec first; substantive ones go back to Maor.
- **Two passes.** Pass 1 is a working game (device TTS, basic animation); Pass 2 is polish (art, animation, Gemini voice). Each is gated only against its own criteria.
- **Tests first.** Acceptance criteria have stable ids (`AC-01`, …) and become failing tests titled `[AC-xx] …` before implementation. CI fails if an automated criterion has no tagged test (`npm run check:ac`).
- **Real UI e2e.** Real taps through the actual screens, entering every game through its map building. `?e2e=1` hooks only seed or read state. `goToScreen` is for screenshot scripts only. Parent-gate tests run without `?e2e=1`.
- **Parallel work.** Gemini starts art, animation, and voice right after spec approval, to the paths, ids, and contract frozen in the spec. Shared registries merge additively.
- **Ready-for-merge gate.** CI green (including the spec's Playwright journeys and the AC coverage check), inspected in-game screenshots in both orientations for visual changes, and an APPROVE from the cross-review (below).
- **Before each task**, send the team lead a short plan: model, effort, tools (web app vs `agy`/CLI), and tests.
- **Bugs.** Every fixed bug gets a regression test.
- **After merge.** Maor runs a functional tablet check (touch, rotation, audible voice, visuals). Failures and feedback update the spec first, then a fix PR. No enjoyment metrics or observational playtests.

## In-session token rules

- Replies should be as short as possible without losing important information; there is no line cap. Put details in the PR.
- Run only the tests affected by the change locally. CI also runs only affected tests; the full suite runs on demand (workflow_dispatch) or locally with `npm test` and `npm run test:e2e` (see `docs/PROCESS.md`, "CI: affected tests"). Read failure summaries only.
- Take screenshots only for visual changes.

## Cross-review and merge

- **Cross-review replaces Maor's PR approval.** The Gemini expert reviews Claude's PRs with `agy` (`gemini-4-hydrogen-medium` by default); Claude reviews the Gemini expert's PRs with Claude Code. It is a full review of the diff against the spec, not a partial one. The author is never the sole reviewer.
- The reviewer posts the verdict as a PR comment: **APPROVE**, or a list of blocking issues. The comment is the record; saving a copy in `docs/reviews/` is optional. Remove the review worktree after the review.
- **Merge.** The team lead merges after the cross-review posts APPROVE on the PR and CI is green; Maor decides product questions, new games, force-push and disagreements.
- **Force-push.** No force-push (including `--force-with-lease`) without Maor's approval; merge `main` into your branch instead. Never force-push `main`.
- **Escalation.** Unclear points and disagreements (between reviewer and author, or with the team lead) go to Maor via the team lead.
- A code or architecture review is read-only unless the task also asks for a fix.

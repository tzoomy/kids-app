# AGENTS.md

Rules for every agent (Claude Code, Gemini/Antigravity, Grok Bot, and others) in the `tzoomy/kids-app` repository.

## What this product is

A family learning app for Maor's daughters (age-2 and age-5 tracks). Hebrew UI, English learning and French reinforcement, played on an Android tablet, leisure time earned from educational play, a parent area, offline use, and minimal data collection. Live site: https://tzoomy.github.io/kids-app/

Direction documents: `docs/ARCHITECTURE.md`, `docs/WORLDS.md`, `docs/TEAM.md`. Choices Maor has not yet approved are marked there as **proposal — pending owner approval**. Do not treat a proposal as a decision.

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

## Reviews and saving output

Raw reviews are stored in `docs/reviews/`. A code or architecture review is read-only unless the task also asks for a fix.

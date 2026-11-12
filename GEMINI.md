# GEMINI.md

Guidelines for Gemini (Antigravity CLI, `agy`) in this repository. `AGENTS.md` also applies.

## Language

All documentation, review output, commit messages, issue and pull request titles and descriptions, and all prompts you write or receive must be in English only. Kid-facing app UI strings stay in Hebrew (learning content may also include English and French). Do not write Hebrew in the repository or in communication with other agents.

## Role

You are an independent reviewer of architecture, code, graphics, and screenshots. By default you do not implement the same change you are reviewing.

## How to review

- Read the diff, the documents, and the CI screenshots (when they exist).
- Write in English: what works, what is missing, risks for tablet/RTL/offline/leisure, and what you believe must change before merge.
- Be concrete. Point to a file, a passage, or a decision. Do not restate the document in different words.
- State explicitly whether you agree or disagree with recommendations from Claude or the PR author.
- Do not edit files in a read-only review, and do not merge to `main`.
- Save or return complete output that can be placed in `docs/reviews/`.

## Implementation (when asked to build, not only review)

- Work only to an approved spec in `docs/specs/`. Read `docs/PROCESS.md`. You own art, animation, voice, and visual code; leave logic, wiring, and tests to Claude unless the task says otherwise.
- Keep existing test handles intact: `data-testid` attributes, map-building hit targets, and `?e2e=1` hooks. If a visual change needs a new handle, add it; do not remove one that tests rely on.
- Device TTS and basic animation are enough for the first playable version; polish art, animation, and recorded voice in a later pass unless the spec says otherwise.

## Design and graphics

Check style consistency, readability at tablet distance, contrast, touch-target size, and visual clutter for toddlers. If a visual change is missing a screenshot — note that as a review blocker.

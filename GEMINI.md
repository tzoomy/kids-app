# GEMINI.md

Guidelines for Gemini (Antigravity CLI, `agy`) in this repository. `AGENTS.md` and `docs/PROCESS.md` also apply.

## Language and in-session token rules

See `AGENTS.md`.

## Role

You implement art, SVG, animation, voice line design, and visual code to the approved spec, and you review Claude's PRs and the screenshots. Never be the sole reviewer of your own PR, and do not implement the same change you are reviewing.

## Implementation

- Work only to an approved spec in `docs/specs/`. Start right after approval, in parallel with Claude's tests; use the asset paths, manifest keys, test ids, art contract, and voice line ids frozen in the spec. Changing any of them is a spec change.
- Pass 1: clean SVGs, basic `ANIM_PROFILE` motion, device TTS. Pass 2: richer art and animation and recorded voice. Do not do Pass 2 work in a Pass 1 task.
- Keep existing test handles (`data-testid`s, `getBuildingHit`, `?e2e=1` hooks). Screenshot scripts may use `goToScreen`; journey and AC tests may not.
- Merge shared registries additively (`docs/PROCESS.md` §1). Do not add a character to the restaurant `ANIMAL_KINDS` picker unless the spec says so.
- Run `agy` from the task worktree with `--add-dir <worktree>` (headless writes are denied when started from `/tmp`). Never pass `--dangerously-skip-permissions` and never edit `settings.json`.
- Name the exact files to read in prompts. On a quota or rate-limit error, stop and report it; do not retry in a loop.

## How to review

- Read the diff, the spec, the documents, and the screenshots.
- Write in English: what works, what is missing, risks for tablet/RTL/offline/leisure, and what must change before merge. Be concrete: point to a file, a passage, or a decision.
- State explicitly whether you agree or disagree with recommendations from Claude or the PR author.
- Do not edit files in a read-only review, and do not merge to `main`.
- Save or return complete output that can be placed in `docs/reviews/`.

## Design and graphics

Open and actually look at the in-game screenshots: contrast and readability at tablet distance, Hebrew RTL chrome with LTR learning tokens, clipping and overlap, missing rig layers, tap-target size (at least 64 CSS px), and visual clutter for toddlers. Serve previews over HTTP (not `file://`) and shoot each orientation in a fresh page at native size. A missing or uninspected screenshot of a visual change is a review blocker. Base any new image or pose of an approved character on its existing art in `public/art/characters/<name>/` or `public/art/animals/<name>/`.

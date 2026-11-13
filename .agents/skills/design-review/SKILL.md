---
name: design-review
description: Independent visual and spec review of a kids-app pull request against its approved spec and screenshots. Use when reviewing another author's PR (usually Claude's) for layout, art, and acceptance criteria. Do not use when implementing or redrawing art, or when only capturing screenshots.
---

# Design review

Repo rules in `GEMINI.md`, `AGENTS.md`, and `docs/PROCESS.md` still apply. You are an independent reviewer, not the implementer of the change under review, and never the sole reviewer of your own PR. Do not edit the branch you are reviewing.

Use a fresh, short session. Always pass `--effort` (default `medium`; `high` or above for complicated reviews). Raise effort within a model before switching models. Art and design reviews: `gemini-4-hydrogen-medium` or `gemini-4-hydrogen-high`; escalate to `gemini-4-argon-low` / `gemini-4-argon-medium` only if Hydrogen fails. Light doc or wording checks: `gemini-3.8-flash-low` or `gemini-3.8-flash-medium`. `gemini-4-argon-high` is only for final art polish after Maor approves a game. One reviewer per PR; review the diff only.

## Look at the change

- Review the diff, and the approved spec (`docs/specs/`) only as it applies to this diff. Do not expand into unrelated files.
- For a visual change, inspect the PR's screenshots in both orientations. A visual change with no inspected screenshot is a blocker. Do not take or attach screenshots for non-visual diffs.
- If shots are missing for a visual change and you must take them, follow `before-after-shots`: start your own preview on a private port with an uncommitted local config; never use port 4173; never reuse another worktree's server; stop only servers you started.

## Check

- Every relevant acceptance criterion in the spec (`AC-xx`), including ones this PR claims to pass.
- Tap targets at least 64 CSS px.
- No overlap, clipping, or missing rig layers.
- A new image or pose of an approved character stays consistent with the approved design under `public/art/characters/<name>/` or `public/art/animals/<name>/`.
- Hebrew RTL chrome with LTR learning tokens; contrast and clutter at tablet distance, for toddlers.

## Write-up

- English only. What works, what is missing, and what must change before merge.
- Rank each finding **blocker**, **major**, or **minor**, and point to `file:line` (or a named screenshot).
- Drop claims you cannot verify from the diff, the spec, or the screenshots. Do not guess device audio or unshot states.
- Say whether you agree or disagree with the author or with another reviewer.
- Return complete output that can go in `docs/reviews/` or on the PR. Do not merge.

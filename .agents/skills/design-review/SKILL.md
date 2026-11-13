---
name: design-review
description: Independent visual and spec review of a kids-app pull request against its approved spec and screenshots. Use when reviewing another author's PR (usually Claude's) for layout, art, and acceptance criteria. Do not use when implementing or redrawing art, or when only capturing screenshots.
---

# Design review

Repo rules in `GEMINI.md`, `AGENTS.md`, and `docs/PROCESS.md` still apply. You are an independent reviewer, not the implementer of the change under review, and never the sole reviewer of your own PR. Do not edit the branch you are reviewing.

## Look at the real UI

- Read the diff, the approved spec (`docs/specs/`), and the screenshots. A visual change with no inspected screenshot is a blocker.
- Serve the build over HTTP (not `file://`). Open a fresh page for each orientation at native `1280×800` and `800×1280` (do not resize a Phaser FIT canvas in place).
- If you need to take the shots, follow `before-after-shots` (private port; never reuse another worktree's preview server).

## Check

- Every relevant acceptance criterion in the spec (`AC-xx`), including ones this PR claims to pass.
- Tap targets at least 64 CSS px.
- No overlap, clipping, or missing rig layers.
- Hebrew RTL chrome with LTR learning tokens; contrast and clutter at tablet distance, for toddlers.

## Write-up

- English only. What works, what is missing, and what must change before merge.
- Rank each finding **blocker**, **major**, or **minor**, and point to `file:line` (or a named screenshot).
- Drop claims you cannot verify from the diff, the spec, or the screenshots. Do not guess device audio or unshot states.
- Say whether you agree or disagree with the author or with another reviewer.
- Return complete output that can go in `docs/reviews/` or on the PR. Do not merge.

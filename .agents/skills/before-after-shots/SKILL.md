---
name: before-after-shots
description: Captures before-and-after screenshots of a kids-app visual change for a fix or review. Use when shooting comparison images of existing or proposed art or UI. Do not use for writing the SVG itself or for a full spec review.
---

# Before and after shots

Repo rules in `GEMINI.md`, `AGENTS.md`, and `docs/PROCESS.md` still apply. This skill covers only how to capture comparison screenshots.

## Servers and ports

- Serve previews over HTTP (not `file://`), on a **private port** bound to `127.0.0.1`. Prefer `listen(0)` or a port you confirm is free.
- Never reuse another worktree's preview server. Playwright is configured with `reuseExistingServer: !process.env.CI` and `baseURL` `http://localhost:4173/kids-app/`. A leftover server on 4173 (or any shared preview port) will serve stale code. Do not use 4173 unless you started that process yourself in this worktree and then stopped it.
- Stop the server when the shots are done.

## Shots

- Fresh page per orientation, native size, `deviceScaleFactor: 1`: `1280×800` and `800×1280`. Do not resize one page to the other.
- Capture the same state before and after the change (same screen, level, and action).
- Write files under `tools/art-preview/shots/`, with names that mark before/after and orientation.

## Throwaway merges

- If the after-state needs another branch's art or code, do a **local-only** merge or cherry-pick in this worktree (or a throwaway worktree).
- Never push that merge, never push to `main`, and never open a PR from the merge branch. Delete the throwaway worktree when finished.

In-game screenshots for a review may use `goToScreen`; journey and AC tests may not.

---
name: before-after-shots
description: Captures before-and-after screenshots of a kids-app visual change for a fix or review. Use when shooting comparison images of existing or proposed art or UI. Do not use for writing the SVG itself or for a full spec review.
---

# Before and after shots

Repo rules in `GEMINI.md`, `AGENTS.md`, and `docs/PROCESS.md` still apply. This skill covers only how to capture comparison screenshots. Use a fresh, short session, and only for visual changes — do not capture screenshots for docs, wording, or other non-visual work.

## Servers and ports

- Serve previews over HTTP (not `file://`). When a Vite preview or Playwright server is needed, always start your own server on a **private port** bound to `127.0.0.1`, using an **uncommitted** local Playwright or Vite config. Prefer `listen(0)` or a port you confirm is free. Never commit that config, and do not edit the committed `playwright.config.ts`.
- Never use port 4173. There is no exception for a server you started yourself. A leftover 4173 process is common, and the committed Playwright config has `reuseExistingServer: !process.env.CI` with `baseURL` `http://localhost:4173/kids-app/`, which will serve stale code from another worktree. In the uncommitted local config, leave `reuseExistingServer` off.
- Never reuse another worktree's preview server.
- Stop only servers you started yourself, and only when the shots are done. Never kill 4173, another worktree's preview, or any other process you did not start.

## Shots

- Fresh page per orientation, native size, `deviceScaleFactor: 1`: `1280×800` and `800×1280`. Do not resize one page to the other.
- Capture the same state before and after the change (same screen, level, and action).
- Write files under `tools/art-preview/shots/` (gitignored; never commit them), with names that mark before/after and orientation.

## Throwaway merges

- If the after-state needs another branch's art or code, do a **local-only** merge or cherry-pick in this worktree (or a throwaway worktree).
- Never push that merge, never push to `main`, and never open a PR from the merge branch. Delete the throwaway worktree when finished.

In-game screenshots for a review may use `goToScreen`; journey and AC tests may not.

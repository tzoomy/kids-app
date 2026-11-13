---
name: art-redraw
description: Minimally redraws an existing SVG in this kids-app repo (peek, icon, prop, or card). Use only when revising current art while keeping manifest keys, file paths, viewBoxes, and rig part names. Do not use for new assets, animation work, design reviews, or screenshot capture.
---

# Art redraw

Repo rules in `GEMINI.md`, `AGENTS.md`, and `docs/PROCESS.md` still apply. This skill covers only a minimal redraw of art that already exists. Use a fresh, short session.

## Keep frozen

- Manifest keys, file paths, `viewBox` (and width/height), and rig part names stay exactly as in the approved spec and current files.
- Do not add, rename, or remove a registry or manifest entry unless the task says the spec already changed.
- Merge shared registries additively if you must touch them.

## SVG

- Match the existing palette, stroke weight, and outline style of the surrounding set.
- No `<text>`, no rasters, no external references, no filters or gradients unless the source already uses them.
- The subject must stay readable at 64 CSS px (icons, peeks, and HUD marks especially).
- Prefer a small edit to the current SVG over a full redraw.

## Pass and checks

- Pass 1 only: clean, basic art, drafted with `gemini-3.8-flash-high`. Do not add Pass 2 polish or recorded voice, and do not use Argon, unless Maor has approved this game and asked for polish (`gemini-4-argon-high` then).
- After the edit, locally run only tests related to the change. The full suite runs in CI. Read only failure summaries, not full logs.
- If the change is visual and in-game or preview shots are needed, use the `before-after-shots` skill. Do not take screenshots for non-visual changes.

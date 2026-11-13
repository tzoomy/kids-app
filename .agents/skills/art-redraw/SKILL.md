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

## Approved design reference

Once a character design is approved, every new image or animation frame/pose of that character must mention the approved design in the `agy` prompt with `@` (for example `@public/art/animals/bear/` or `@public/art/characters/chef/head.svg`) and tell Gemini to base the output on it so the character stays consistent. `agy --help` has no `--image` or `--attach` flag; `@path` is the official mechanism. Approved art lives under `public/art/characters/<name>/` and `public/art/animals/<name>/` (see `src/assets/art/manifest.ts`). `--add-dir` does not attach an image.

## Pass and checks

- Always pass `--effort` (`low|medium|high|xhigh|max`). Default `medium`; use `high` or above for complicated work. Raise effort within a model before switching to a stronger one.
- Pass 1 only: first-pass art drafts with `gemini-4-hydrogen-medium`. Rig/geometry fixes and harder drafts: `gemini-4-hydrogen-medium` or `gemini-4-hydrogen-high`; escalate to `gemini-4-argon-low` / `gemini-4-argon-medium` only if Hydrogen fails. Do not add Pass 2 polish or recorded voice, and do not use `gemini-4-argon-high`, unless Maor has approved this game and asked for that polish.
- After the edit, locally run only tests related to the change. The full suite runs in CI. Read only failure summaries, not full logs.
- If the change is visual and in-game or preview shots are needed, use the `before-after-shots` skill. Do not take screenshots for non-visual changes.

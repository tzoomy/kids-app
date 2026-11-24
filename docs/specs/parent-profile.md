# `parent-profile` — Generic child profile page (Parent Settings)

Status: **approved** (product decision by Maor, 2026-11-24: per-game level tuning in Parent Settings makes no sense; each girl's profile page is generic across all games). The sub-choices recorded in `docs/PENDING-DECISIONS.md` (2026-11-24 row) are reversible defaults.
Pass in progress: **1** (`none` until implementation starts, then `1`, then `2`; read by `npm run check:ac`).

This is parent-area infrastructure, not a game: no learning goals, art, voice or leisure rules of its own. Sections of `docs/specs/TEMPLATE.md` that do not apply say "not applicable". Parent UI text is Hebrew and addressed to the parent. Supersedes the per-game level view of 2026-11-23.

## Summary

A parent opens Parent Settings, taps a girl's card, and sees one short page: **Name**, **Age track**, **Language**, and, for the age5 track only, **French level boost** and **generic difficulty** (רגיל / מאתגר), then the leisure balance controls (`איפוס יתרה`, `+5 דק׳`), and at the bottom one child-wide **איפוס התקדמות**. There is no per-game level list, no per-game `−` / `+` / Reset, and no world headings.

## Learning goals

Not applicable. The page only changes where age5 games start and lets the parent clear one child's saved progress.

- **Age 2:** untouched (no age5-only controls; no skill is ever rewritten by them).
- **Age 5:** the two options raise the start floor of every game (see Rules).

## World and why

- **World:** none (shell chrome: Parent Settings).
- **Why:** per-game tuning of ~25 games is not something a parent can reason about; generic settings plus one reset are.

## Mechanic

### Profile page (`src/ui/parent.ts`)

1. Name (`parent-profile-name`), Age track (`parent-profile-age-track`: `age2` / `age5`), Language (`parent-profile-languages`: `both` / `en` / `fr`). Every change is committed at once (`onProfileChange`) and persisted without the main Save.
2. **age5 only** (hidden for age2, also when the age select is switched live): French boost (`parent-profile-start-french-higher`) and difficulty (`parent-profile-difficulty`: `regular` / `challenging`), each with a hint that explains that already-started games below the new floor are raised (French only for the boost; every game for מאתגר) and that switching off does not lower earned progress.
3. Leisure: totals line, `parent-profile-reset-balance`, `plus-five-<id>`, unchanged.
4. **איפוס התקדמות** (`parent-profile-reset-progress`) at the bottom, above Back. Two-step **inline** confirmation (no `window.confirm`): the first tap swaps the button for a confirmation text (`parent-profile-reset-progress-confirm-text`), `parent-profile-reset-progress-confirm` and `parent-profile-reset-progress-cancel`. Cancel returns to the single button; confirm calls `onResetProgress(profileId)` and the parent stays on the profile page. Leaving the page drops a pending confirmation.

### Start-floor rules (`src/core/adaptive/startFloor.ts`, `startingLevel` in `rules.ts`)

- The floor of a skill is `startingLevel(meta, 'age5', lang, prefs)`: age5 start, +2 with `challenging` (every language), +1 with French boost for `fr` only, stacked, clamped to that game's age5 `[min, max]` (the ceiling varies per game).
- **Lift:** when an **age5** profile switches difficulty `regular → challenging` (scope `all`) or French boost `off → on` (scope `fr`; both at once = `all`), every **already-started** skill of that profile and of a known adaptive game with `level < floor` is set to the floor. Item history, streak and recent window are kept. Persisted immediately.
- Never created: no skill appears for an unstarted game (it takes the floor on first play via `startingLevel`). Keys that map to no known game or language are left alone.
- **Never lowered:** a skill at or above the floor is untouched, and switching `challenging → regular` or boost `on → off` changes no stored level.
- Name, language or age-track changes alone rewrite no skill.
- **age2 never shifts**, even when the flags are set on the profile. Only the edited profile is written; other profiles' `kids-app-adaptive:<id>` payloads are never read for writing.

### Reset progress

`resetProfileProgress` empties `skills` of `kids-app-adaptive:<profileId>` and persists. It keeps name, age track, language, difficulty, French boost, leisure balance, today's earned time, lifetime `activeSec`, stars and visit counters, the other child, and global settings.

## Difficulty curve

Not applicable (the page sets the start floor; level rules are in `docs/adaptive-engine.md`).

## Leisure

Unchanged. Reset progress never changes a balance; balances never mix across profiles.

## Player journey from the map

Not a game. Journey: profile select → `parent-gate-btn` (under `?e2e=1` the multiplication gate is skipped; the long-press gate has its own spec) → `parent-open-profile-<id>` → edit → Back.

- `data-testid`s: `parent-open-profile-<id>`, `parent-profile-page`, `parent-profile-page-<id>`, `parent-profile-name`, `parent-profile-age-track`, `parent-profile-languages`, `parent-profile-start-french-higher`, `parent-profile-difficulty`, `parent-profile-reset-balance`, `plus-five-<id>`, `parent-profile-reset-progress`, `parent-profile-reset-progress-confirm-text`, `parent-profile-reset-progress-confirm`, `parent-profile-reset-progress-cancel`, `parent-profile-back`.
- Hooks: none. E2E seeds and reads `localStorage['kids-app-adaptive:<id>']` directly (state only).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | The profile page shows name, age track, language and (age5) French boost + difficulty, hints that explain the lift and "switching off keeps progress", and has no per-game level list, controls, world headings or "not started" notes | 1 | unit | both | |
| AC-02 | age2 has no age5-only controls (also on a live age switch); changing name, language or age track alone reports no start-option change | 1 | unit | both | |
| AC-03 | Difficulty `regular → challenging` on age5 lifts every started skill below the floor (+2, all languages), keeps history, never lowers, clamps to the game's age5 max | 1 | unit | both | |
| AC-04 | French boost off → on lifts started `fr` skills (+1) only, never `en` (also when challenging is already on) | 1 | unit | both | |
| AC-05 | Both options stack (en +2, fr +3), then clamp to each game's age5 ceiling | 1 | unit | both | |
| AC-06 | age2 skills are never rewritten (flags set, age track switched); a lift on one profile never touches another profile's skills or storage | 1 | unit | both | |
| AC-07 | Toggling back / off never lowers a level; no skill is created for unstarted games; unknown keys are left alone; name or language edits and unchanged re-commits rewrite nothing | 1 | unit | both | |
| AC-08 | איפוס התקדמות sits at the bottom; one tap only asks; the confirm step resets exactly this profile once (after committing pending edits); no `window.confirm` | 1 | unit | both | |
| AC-09 | A confirmed reset empties this child's skills (memory and storage) and keeps her settings, balance, stars and counters, the other child's data and global settings | 1 | unit | both | |
| AC-10 | Cancel (or leaving the page) after the first tap resets nothing | 1 | unit | both | |
| AC-11 | E2E: on a real age5 profile the French boost and מאתגר lift seeded started skills in storage (fr only / all, clamped, high levels kept, age2 untouched), persist across Back and reload, and toggling back lowers nothing | 1 | e2e+seed | both | `localStorage` seed |
| AC-12 | E2E: reset progress asks twice, cancel keeps skills, confirm clears only this child's skills and keeps her difficulty, language and balance and the other child's skills | 1 | e2e+seed | both | `localStorage` seed |
| AC-13 | E2E: a language set on her page is saved per profile, reloads, and drives her game; two profiles hold different languages | 1 | e2e | @single-orientation | |
| AC-14 | E2E: on a 360 px phone the page does not overflow and its tap targets (Back, reset progress, its confirm and cancel, reset balance, +5) are at least 44 px | 1 | e2e | both | |
| AC-15 | E2E: the main settings screen has no global language select and lists both girls as cards of at least 44 px | 1 | e2e | @single-orientation | |
| AC-16 | E2E: `+5 דק׳` returns to the same profile page | 1 | e2e | @single-orientation | |

## Art, animation and voice

Not applicable. No new voice lines; Hebrew parent-addressed text is in `src/content/i18n/he.json` (`parent.*`). No TTS or audio files change.

## Open decisions for the owner

**Open decision for the owner:** (1) whether switching an option off should ever lower started skills (default: never); (2) whether the reset should also zero stars and lifetime time (default: no, it is level progress only). Both in `docs/PENDING-DECISIONS.md` (2026-11-24).

## Changelog

- 2026-11-24: created. Per-game level controls removed (supersedes the 2026-11-23 per-game rows); generic profile page, start-floor lift on switching ON, one child-wide progress reset.

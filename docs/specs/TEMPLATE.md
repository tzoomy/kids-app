# Spec template

Copy this file to `docs/specs/<game-id>.md` (the content id, for example `animal-restaurant.md`). Write in English and fill every section. Mark anything Maor has not decided as **Open decision for the owner:**. No implementation until Maor has approved the spec. The process is in `docs/PROCESS.md`.

---

# `<game-id>` — `<display name>`

Status: **draft — pending owner approval** / **approved** (keep one).
Pass in progress: **none** (`none` until implementation starts, then `1`, then `2`; read by `npm run check:ac`).

## Summary

One short paragraph: what the child does, what she learns, and which world the game sits in.

## Learning goals

- **Age 2:**
- **Age 5:**

## World and why

- **World** (Language House, Number Garden, Nature Lab, Art Studio, or Leisure Corner):
- **Why this game belongs there:** (link the section of `docs/WORLDS.md` if there is one)

## Mechanic

How a round works: the child's action, feedback on a correct answer, feedback on a wrong answer (hint or retry), how a round ends, and how she leaves the game.

- **Input mode per age** (tap or drag): state the real mode. Do not assume the engine's age-5 `policy.interaction` value applies if the game stays tap-only.

## Difficulty curve

- **Levels:** levels and the levers that change (choice count, request type, scaffolding, …), following `docs/adaptive-engine.md` unless a justified exception is written here.
- **Age-2 start level:**
- **Age-5 start level:** (meaningfully harder than age 2)
- **Min / max** (including whether age 2 has a ceiling):
- **Adaptive rules** (defaults or overrides: `upCleanStreak`, `downMisses`, `downWindow`, `trialsPerRound`, `maxChangesPerRound`, when the level may change):

## Leisure

How play earns leisure time under the leisure policy. Mistakes never reduce the balance; balances never mix across profiles.

## Player journey from the map

Profile → tap this world building on the map → enter the game → play a round → exit to the map. Name every handle the tests use (frozen at approval):

- Map building hit target: `getBuildingHit('<world-id>')`
- `data-testid`s (DOM / HUD):
- Seed and read hooks under `?e2e=1` (seed persisted state or read state only; no game actions, no scene navigation):

## Acceptance criteria

Ids are stable: never renumber or reuse them; strike through a removed one (`~~AC-07~~`). Test titles start with the id, e.g. `test('[AC-04] level rises after 3 clean answers', …)`, in `tests/**/<game-id>*` files. Verified by: `unit`, `e2e`, `e2e+seed`, or `device` (device criteria are checked by Maor on the tablet and are exempt from the CI coverage check). Orientation: `both`, or `@single-orientation` if the criterion does not depend on it. Keep at least these rows and add game-specific ones.

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → world building → game → one round → exit to the map; the game opens only from this world's building | 1 | e2e | both | `getBuildingHit` |
| AC-02 | A correct answer gives the specified feedback and advances the game | 1 | e2e | @single-orientation | |
| AC-03 | A wrong answer gives the specified hint or retry and never reduces the leisure balance | 1 | e2e | @single-orientation | |
| AC-04 | Difficulty rises after successes and drops after misses, per this spec's rules | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level | 1 | e2e+seed | @single-orientation | |
| AC-06 | High levels play correctly | 1 | e2e+seed | @single-orientation | |
| AC-07 | A new age-2 profile starts at the age-2 start level; a new age-5 profile at the age-5 start level | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues as specified, never drops on mistakes, never mixes across profiles | 1 | unit | @single-orientation | |
| AC-09 | Content and language are selected as specified | 1 | unit | @single-orientation | |
| AC-10 | Each voice line requests the right line id and language (speech spy) | 1 | e2e | @single-orientation | |
| AC-11 | Smoke: the game is playable at `1280x800` and `800x1280` | 1 | e2e | both | |
| AC-12 | The game works offline | 1 | e2e | @single-orientation | |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch, rotation mid-game, audible voice, visuals | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |

## Art, animation, and audio

Paths, keys, rigs, and line ids below are frozen at approval so Gemini can start immediately (`docs/PROCESS.md` §2). Style and rig details: `docs/ANIMATION.md`.

### Pass 1 — working game

- **Asset paths and manifest keys:** under `public/art/` (`characters/`, `animals/`, `props/`, `foods/`, `instruments/`, `fx/`, `scenes/<scene-or-game-name>/`), keyed in `src/assets/art/manifest.ts`. Scene folders are named per scene or game, never the world id (two games can share a world).
- **SVG contract:** warm palette; dark-brown outline `#3B2A22` about 6 px; no heavy gradients or filters, no `<text>`, no external references, no rasters; each file under 15 KB (enforced by `tests/unit/artAssets.test.ts`); original assets only.
- **Rigs:** origin at the feet centre on the 400 × 480 reference; heads without eyes and mouth (separate swappable parts). Say which rig map is used: `CHARACTER_RIGS` for new characters, not the restaurant `ANIMAL_KINDS` picker. Previews composite every layer.
- **Layout:** landscape and portrait backgrounds. Tap targets: **Open decision for the owner:** minimum tap-target size (`docs/ARCHITECTURE.md` says about 64 px and up; the art reviews proposed 112 CSS px). If items do not fit at that size, pan or show fewer; never shrink them.
- **RTL:** Hebrew UI chrome is RTL; English and French learning tokens stay LTR. Say whether the game reuses the existing HUD.
- **Animation:** `ANIM_PROFILE` knobs (`src/anim/profiles.ts`) and motion helpers (`src/anim/worldMotion.ts`) to add or reuse. Unit tests import pure modules only, never Phaser.
- **Voice table** (device TTS through `AudioManager.play({ lineId, lang, text })`):

| lineId | lang (`en` / `fr` / `he`) | Text | Trigger |
|---|---|---|---|
| | | | |

- **World and PWA wiring:** the world's `entryGameId`, `earnsLeisure`, and the game's new `AppScreen` marked unsafe for mid-game updates in `src/pwa/updatePolicy.ts`.

### Pass 2 — polish

- Richer art and animation (list what changes).
- Recorded Gemini TTS clips (voice Leda) for the voice table, rendered with `scripts/tts/generate_voice.py`; device TTS stays the fallback. Do not add `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.

Put anything Maor has not approved for this change under Out of scope.

## Out of scope

What this change will not include (deferred levels, parent tools, extra languages, Pass 2 if not approved yet, …).

## Open decisions for the owner

- **Open decision for the owner:** …

## Changelog

One line per edit: date, what changed, `substantive` or `minor`. A substantive edit (learning goals, world, mechanic, difficulty curve or start levels, leisure rules, acceptance criteria added, removed, or changed in meaning, or scope) sets Status back to **draft — pending owner approval**.

- `YYYY-MM-DD` — created — substantive

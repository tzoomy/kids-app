# `balloon-pop` — Balloon Pop

Status: **draft — pending owner approval**
Pass in progress: **1**

> Built under the team lead's continuous-development mode (2026-11-13): Maor approved the idea (`docs/WORLDS.md`, Number Garden §4) but has not yet approved this spec. Every choice below that he has not made is marked **Open decision for the owner:** and listed in `docs/PENDING-DECISIONS.md`. All of them are reversible content or wiring defaults.

## Summary

Balloons rise into the Number Garden sky; a voice names one of them and the child pops it. The age-2 track pops the balloon of the named **colour**; the age-5 track pops the balloon with the spoken **digit**. The request is spoken in English or French (the learning language), so the numbers are practised in the counting language the parent picked.

## Learning goals

- **Age 2:** colour names in English and French (red, blue, yellow, green, orange, purple), matched to a colour.
- **Age 5:** recognising the digits 0–9 by ear in English and French, matched to the written numeral.

## World and why

- **World:** Number Garden.
- **Why:** `docs/WORLDS.md` → Number Garden → §4 Balloon Pop (owner-approved idea, 2026-11-13).
- **Entry:** the Number Garden building now opens a game picker with two cards, Sorting Beds (first) and Balloon Pop. **Open decision for the owner:** a picker vs. the per-world station trail (owned by Claude); the picker is the existing Language House pattern and is trivially replaced by the trail.

## Mechanic

- A round is `trialsPerRound` (3) trials in one language. Each trial: 2–6 balloons rise from below the screen into a row (or two rows in portrait) and bob gently; the request is spoken ("Pop the red balloon!", "Éclate le chiffre trois !") and shown as an LTR prompt bubble. A speaker button replays it (not a hint).
- **Correct tap:** the balloon pops (pop sound, confetti, star to the HUD counter, star +1), a short "Pop!" line plays, the other balloons float away, and the next trial starts. Every third win plays the existing Hebrew praise clip `he.praise.0`.
- **Wrong tap:** the balloon wobbles, nothing pops, the existing Hebrew retry clip (`he.retry.0` or `he.retry.1`) plays on the first wrong tap of a trial, then the request again. Age 2 (`demonstrate`): after a wrong tap or 6 s idle, the correct balloon pulses and sparkles and the request repeats. Age 5 (`repeat-then-demonstrate`): the first wrong tap repeats the request, the second shows the pulse. Mistakes never cost leisure.
- **Leave:** `hud-back` returns to the map at any time; leaving is a round boundary for the engine.
- **Input mode per age:** tap only on both tracks (the engine's age-5 `drag` policy value does not apply).
- **Balloon motion (Pass 1):** rise into place, then a small idle bob; targets do not drift off-screen. **Open decision for the owner:** continuously drifting balloons (moving targets) as a later level lever or Pass 2.

## Difficulty curve

Levels (content `src/content/games/balloon-pop.json`, `adaptive.levels`, read by `balloonLevel()`):

| Level | Mode | Balloons | Digits | Distractors |
|---|---|---|---|---|
| L1 | colour | 2 | – | far |
| L2 | colour | 3 | – | far |
| L3 | colour | 4 | – | far |
| L4 | colour | 5 | – | far |
| L5 | digit | 3 | 1–5 | far |
| L6 | digit | 4 | 1–9 | far |
| L7 | digit | 5 | 0–9 | far |
| L8 | digit | 6 | 0–9 | near (look- or sound-alike digits first: 6/9, 1/7, 3/8, 5/2, 0/8, 4/1) |

- **Age-2 start level:** L1; min L1, **max L4** (colour only). **Open decision for the owner:** whether a strong age-2 player may later reach the digit levels.
- **Age-5 start level:** L5; **min L5**, max L8 (digit only). **Open decision for the owner:** whether a struggling age-5 player may drop to the colour levels.
- **Adaptive rules:** `DEFAULT_RULES` (up after 3 clean, down after 2 misses in the last 3, 3 trials per round, at most one change per round). Age 2 changes between rounds; age 5 after a trial (track policy). Items are `color-<id>` and `digit-<n>`; the engine picks the target from the level's items, so both modes share one skill per language: `number-garden.balloon-pop.<lang>`.

## Leisure

The game is educational and earns leisure through the shared `LearningSession` (interaction, listening, and celebrating are participation). A wrong tap never reduces the balance; balances never mix across profiles (shared engine).

## Language (the EN/FR voice option)

The request language comes from the existing parent setting `settings.languages` (`en`, `fr`, or `both`, one language per round when `both`) — the same option every learning game uses. **Open decision for the owner:** a separate "numbers language" toggle for Balloon Pop only; Pass 1 reuses the global option.

## Player journey from the map

Profile → tap the Number Garden building → tap the `game-picker-balloon-pop` card → play → `hud-back` → map.

- Map building hit target: `getBuildingHit('number-garden')`.
- `data-testid`s: `game-picker-sorting-beds`, `game-picker-balloon-pop`, `game-picker-close`; HUD `hud-back`, `hud-help`, `star-count`, `leisure-balance` (existing HUD).
- Hooks under `?e2e=1` (seed or read only): `seedBalloonLevel(level)` (persisted level for every language), `getBalloonInfo(): BalloonInfo | null` (page CSS px rectangles: `balloons[].{id,itemId,hit}`, `targetItemId`, `mode`, `level`, `language`, `promptText`, `tries`, `hinted`, `correctCount`, `ready`, `skillKey`, `replay`), plus the existing `seedLanguageSetting`, `seedBalanceSec`, `getSpokenLines`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Number Garden building → picker → Balloon Pop → one 3-trial round → `hud-back` to the map; the game opens only from the Number Garden picker card, and Sorting Beds stays reachable from its own card | 1 | e2e | both | `getBuildingHit`, `getBalloonInfo` |
| AC-02 | A correct tap pops the balloon, adds one star, plays the "pop" line, and starts the next trial | 1 | e2e | @single-orientation | `getBalloonInfo`, `getSpokenLines` |
| AC-03 | A wrong tap pops nothing, counts one try, repeats the request, and never reduces the leisure balance | 1 | e2e | @single-orientation | `getBalloonInfo`, `seedBalanceSec`, `getSpokenLines` |
| AC-04 | Difficulty rises after 3 clean pops and drops after 2 misses in 3, within the track bounds | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level (age 2: L1 → L2 after a clean round) | 1 | e2e+seed | @single-orientation | `seedBalloonLevel`, `seedLanguageSetting`, `getBalloonInfo` |
| AC-06 | The highest level (L8: six digit balloons, near distractors) plays correctly | 1 | e2e+seed | @single-orientation | `seedBalloonLevel`, `getBalloonInfo` |
| AC-07 | A new age-2 profile starts at L1 (colour); a new age-5 profile at L5 (digit); age 2 never reaches a digit level and age 5 never a colour level | 1 | unit | @single-orientation | |
| AC-08 | The game earns leisure as an educational activity; wrong taps never reduce the balance | 1 | unit | @single-orientation | |
| AC-09 | Rounds build from content: the target is among the balloons, balloon count and digit range follow the level, colour rounds use distinct colours, each language has its own skill | 1 | unit | @single-orientation | |
| AC-10 | The request is spoken with line id `balloon.<itemId>.<lang>`, the round language, and the content text (EN and FR, speech spy) | 1 | e2e | @single-orientation | `seedLanguageSetting`, `getSpokenLines` |
| AC-11 | Smoke: playable at `1280x800` and `800x1280`, every balloon tap target at least 64 CSS px and on screen | 1 | e2e | both | `getBalloonInfo` |
| AC-12 | The game works offline | 1 | e2e | @single-orientation | `getBalloonInfo` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch, rotation mid-game, audible EN/FR voice, visuals | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | The layout keeps every balloon inside the screen and under the HUD, with no overlap, for 2–6 balloons in both orientations | 1 | unit | @single-orientation | |
| AC-17 | Hints and help: an age-2 wrong tap during the intro or help still gets its retry line and hint once they end; the age-2 idle hint repeats while the child stays idle; a correct pop never starts the next trial behind the help card (it starts when the card closes) | 1 | e2e | @single-orientation | `getBalloonInfo`, `getSpokenLines` |

## Art, animation, and audio

### Pass 1 — working game

- **Art:** no new files. Background: the existing `number-garden-bg-landscape` / `-portrait` scene art. Balloons are Phaser shapes (ellipse body, knot triangle, string line, highlight) in `PALETTE` colours with the `#3B2A22`-style dark outline; digit balloons show the numeral in a light-coloured balloon (colour is not a cue on digit levels). Picker card: placeholder (existing number-garden background) until Pass 2 card art.
- **Animation:** existing helpers only: `popIn`/rise tween, `floatIdle`, `wobble`, `hintPulse`, `pressSquash`, `Juice` bursts, `flyArc` star.
- **RTL:** Hebrew HUD chrome is the existing restaurant HUD; the prompt bubble and numerals are LTR learning tokens.
- **Voice table** (device TTS through `AudioManager.play`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `balloon.color-<id>.<lang>` | en / fr | `Pop the {name} balloon!` / `Éclate le ballon {name} !` | colour request |
| `balloon.digit-<n>.<lang>` | en / fr | `Pop the number {name}!` / `Éclate le chiffre {name} !` | digit request |
| `balloon.popped.<lang>.<i>` | en / fr | `content.popped[lang][i]` | correct pop |
| `he.balloon.intro` | he | `content.introHe` | first trial of a visit |
| `he.balloon.help` | he | `content.helpTextHe` | help button |
| `he.retry.0` / `he.retry.1` | he | existing clips | first wrong tap of a trial |
| `he.praise.0` | he | existing clip | every 3rd win |

  The Hebrew intro and help texts live in `balloon-pop.json` (not `voice-lines-he.json`), so device TTS speaks them until Pass 2 clips exist.
- **World and PWA wiring:** `number-garden` keeps `entryGameId: "sorting-beds"`; the building opens the Number Garden picker; new `AppScreen` `'balloon'` (unsafe for mid-game PWA updates).

### Pass 2 — polish

Only after Maor approves the finished Pass 1: SVG balloon art and a picker card, drifting balloons, a pop animation, Leda clips for the voice table.

## Out of scope

Counting balloons (quantities), numbers above 9, Hebrew number names, drag input, new characters.

## Open decisions for the owner

- **Open decision for the owner:** Number Garden picker card vs. the station trail as the entry.
- **Open decision for the owner:** Global `settings.languages` vs. a separate numbers-language toggle.
- **Open decision for the owner:** Track bounds: age 2 capped at colour (L1–L4), age 5 floored at digit (L5–L8).
- **Open decision for the owner:** Colours spoken in EN/FR (not Hebrew) on the age-2 track.
- **Open decision for the owner:** Digits 0–9 only (no 10+); balloons rise and bob rather than drift.
- **Open decision for the owner:** This spec itself (code was built before approval under the continuous-development mode).

## Changelog

- `2026-11-13` — created (Pass 1 built in the same PR under the continuous-development mode) — substantive
- `2026-11-13` — review fixes (#64): deferred hints during intro/help, repeating idle hint, no next trial behind the help card (AC-17); AC-12 requires an active service worker; no screenshots from specs — minor

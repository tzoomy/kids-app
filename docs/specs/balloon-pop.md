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
- **Balloon motion (Pass 1):** rise into place, then a small idle bob; targets do not drift off-screen.
- **Floating stage (Maor asked for it, 2026-11-16):** every 3rd trial of a visit (content `floating.everyNthTrial`), the same balloons drift slowly upward instead of standing still, swaying gently inside their own lane; the child pops the named one while it moves. Forgiving for ages 2–5: no timer and no fail state; a balloon that rises past the line under the HUD re-enters from the bottom at once, so the requested balloon never escapes; tap areas are 1.5x the drawn body and at least 64 CSS px, and a tap inside overlapping areas goes to the nearest balloon. Difficulty: the balloon count is the level's `choiceCount`; the speed is the age track's base (`floating.speed`: age 2 40, age 5 60 game px/s) plus 12% per level above the track's bottom level, capped at 120 (age 2 at L1 is the slowest: about 27 s to cross the portrait sky). A pop counts exactly like a static trial (star, engine record, `recordCompletedRound`). With `prefers-reduced-motion` the floating trial stays still. Pure logic in `src/games/balloon/balloonFloat.ts`; no new art. **Open decision for the owner:** the cadence (every 3rd trial) and the speeds.

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
| L9 | digit (teens) | 5 | 10–20 | near (n ± 1) |
| L10 | more | 4 | "k more than n": n 1–10, k 1–2 (answers 2–12) | near (n itself, the other step, answer ± 1) |
| L11 | sum | 4 | "a plus b": a, b 1–5 (answers 2–10) | near (answer ± 1, an addend, the difference) |

- **Age-2 start level:** L1; min L1, **max L4** (colour only). **Open decision for the owner:** whether a strong age-2 player may later reach the digit levels.
- **Age-5 start level:** L5; **min L5**, **max L11** (was L8; age-5 stretch L9–L11, 2026-11-23; never the colour levels). **Open decision for the owner:** whether a struggling age-5 player may drop to the colour levels.
- **Adaptive rules:** `DEFAULT_RULES` (up after 3 clean, down after 2 misses in the last 3, 3 trials per round, at most one change per round). Age 2 changes between rounds; age 5 after a trial (track policy). Items are `color-<id>` and `digit-<n>`; the engine picks the target from the level's items, so both modes share one skill per language: `number-garden.balloon-pop.<lang>`.

### Age-5 stretch (L9–L11, 2026-11-23)

Approved by Maor on 2026-11-23 (Elli's harder track; Shai's age-2 track L1–L4 stays unchanged). Defaults are reversible and listed in `docs/PENDING-DECISIONS.md`.

- **L9 teens:** digit balloons 10–20 with the new `number` frame ("Pop the number fourteen!" / "Éclate le nombre quatorze !"; French says *nombre* for 10 and up, *chiffre* stays for 0–9).
- **L10 one / two more:** item `more-<n>-<k>`, frame `more` ("Pop the number that is two more than five!" / "Éclate le nombre qui fait deux de plus que cinq !"). The right balloon shows n + k.
- **L11 simple sums:** item `sum-<a>-<b>`, frame `sum` ("What is three plus four? Pop it!" / "Combien font trois plus quatre ? Éclate-le !"). The right balloon shows a + b.
- **Balloons:** every balloon shows a number 0–20 and only one shows the answer. On L10–L11 the wrong balloons are `digit-<v>` items. Two-digit numerals are drawn at 0.78 of the body height (one-digit stay at 1.05) so "20" stays inside the balloon.
- **Floating stage:** unchanged cadence (every third trial) and hit pads (≥ 1.5× body, ≥ 64 CSS px, clamped to the playfield). New `floating.speedMaxLevel: 8`: L9–L11 float at the L8 speed (81.6 px/s at age 5), so a harder sum does not also move faster.
- **Adaptive:** same skill per language; the engine picks the request among the level's items (11 teens, 20 "more", 25 sums).

## Leisure

The game is educational and earns leisure through the shared `LearningSession` (interaction, listening, and celebrating are participation). A wrong tap never reduces the balance; balances never mix across profiles (shared engine).

## Language (the EN/FR voice option)

The request language comes from the existing parent setting `settings.languages` (`en`, `fr`, or `both`, one language per round when `both`) — the same option every learning game uses. **Open decision for the owner:** a separate "numbers language" toggle for Balloon Pop only; Pass 1 reuses the global option.

## Player journey from the map

Profile → tap the Number Garden building → tap the `game-picker-balloon-pop` card → play → `hud-back` → map.

- Map building hit target: `getBuildingHit('number-garden')`.
- `data-testid`s: `game-picker-sorting-beds`, `game-picker-balloon-pop`, `game-picker-close`; HUD `hud-back`, `hud-help`, `star-count`, `leisure-balance` (existing HUD).
- Hooks under `?e2e=1` (seed or read only): `seedBalloonLevel(level)` (persisted level for every language), `getBalloonInfo(): BalloonInfo | null` (page CSS px rectangles: `balloons[].{id,itemId,hit}`, `targetItemId`, `mode`, `level`, `language`, `promptText`, `tries`, `hinted`, `correctCount`, `ready`, `floating`, `skillKey`, `replay`), plus the existing `seedLanguageSetting`, `seedBalanceSec`, `getSpokenLines`.

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
| AC-18 | Floating stage: every 3rd trial floats; balloons start visible, rise slowly, sway inside their lane, and re-enter from the bottom after passing the top (never escape); a long frame cannot teleport them; no timer or miss limit | 1 | unit | @single-orientation | |
| AC-19 | Floating hit areas are at least 1.5x the drawn body and at least 64 CSS px (also on a 360 CSS px phone); a tap in overlapping areas goes to the nearest balloon | 1 | unit | @single-orientation | |
| AC-20 | Floating speed rises with the level inside each track, age 2 at its first level is the slowest (>= 15 s to cross the sky), the speed is capped, and the count is the level's `choiceCount`; the schema rejects age 2 faster than age 5 | 1 | unit | @single-orientation | |
| AC-21 | Portrait real taps: the third trial floats and its balloons move; a wrong tap fails nothing; popping the moving target adds a star and starts the next (static) trial | 1 | e2e | @single-orientation | `getBalloonInfo` |
| AC-22 | With `prefers-reduced-motion` the third trial stays still | 1 | e2e | @single-orientation | `getBalloonInfo` |
| AC-23 | Age-5 stretch content: L1–L8 and the age-2 track (L1–L4) are unchanged, age 5 reaches L11 (teens, more, sums); the schema rejects a "more" level past 20, a sum level without `addendMax`, and a frame missing a slot | 1 | unit | @single-orientation | |
| AC-24 | Every L9–L11 request builds distinct numbered balloons (0–20) with exactly one answer; near slips come first; requests read naturally in EN and FR with one text per line id; real taps on seeded L9, L10, L11 pop the right balloon | 1 | unit, e2e+seed | @single-orientation | `seedBalloonLevel`, `getBalloonInfo`, `getSpokenLines` |
| AC-25 | Floating stage on the stretch: L9–L11 float at the L8 speed, pads stay ≥ 64 CSS px inside the playfield in both orientations; portrait real taps pop a moving L11 answer | 1 | unit, e2e+seed | @single-orientation | `seedBalloonLevel`, `getBalloonInfo` |

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

Age-5 stretch voice lines (device TTS until Leda clips exist): `balloon.digit-<10-20>.<lang>` (number frame), `balloon.more-<n>-<k>.<lang>` (n 1–10, k 1–2), `balloon.sum-<a>-<b>.<lang>` (a, b 1–5), en and fr: 112 new lines, one text each.

### Pass 2 — polish

Only after Maor approves the finished Pass 1: SVG balloon art and a picker card, drifting balloons, a pop animation, Leda clips for the voice table.

## Out of scope

Counting balloons (quantities), numbers above 9, Hebrew number names, drag input, new characters.

## Open decisions for the owner

- **Open decision for the owner:** Number Garden picker card vs. the station trail as the entry.
- **Open decision for the owner:** Global `settings.languages` vs. a separate numbers-language toggle.
- **Open decision for the owner:** Track bounds: age 2 capped at colour (L1–L4), age 5 floored at digit (L5–L8).
- **Open decision for the owner:** Colours spoken in EN/FR (not Hebrew) on the age-2 track.
- **Open decision for the owner:** Digits 0–9 only (no 10+).
- **Open decision for the owner:** Floating stage cadence (every 3rd trial) and speeds (age 2 40, age 5 60 game px/s, +12% per level).
- **Open decision for the owner:** This spec itself (code was built before approval under the continuous-development mode).
- **Open decision for the owner:** age-5 stretch levels and phrasing (teens, "k more than n", "a plus b"), and holding L9–L11 at the L8 float speed (2026-11-23 defaults, `docs/PENDING-DECISIONS.md`).

## Changelog

- `2026-11-13` — created (Pass 1 built in the same PR under the continuous-development mode) — substantive
- `2026-11-16` — floating stage (moving balloons, AC-18–AC-22), requested by Maor — substantive
- `2026-11-23` — age-5 stretch L9–L11 (teens, one / two more, simple sums), age-5 max 11, floating `speedMaxLevel` 8 (AC-23–AC-25), approved by Maor — substantive
- `2026-11-13` — review fixes (#64): deferred hints during intro/help, repeating idle hint, no next trial behind the help card (AC-17); AC-12 requires an active service worker; no screenshots from specs — minor

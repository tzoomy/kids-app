# `number-bridge` — Number Bridge

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Number Garden §5 Number Bridge, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

The rabbit (an existing animal rig, no new character) wants to cross a little stream in the Number Garden. A row of stepping stones makes the bridge, but stones are missing. The child completes the bridge, and the rabbit hops across stone by stone while the stones are counted aloud. **No failure state:** every bridge is always finished and crossed. Age 2 adds "one more stone" (no symbols). Age 5 picks the missing number in a short sequence written on the stones.

## Learning goals

- **Age 2:** "one more" (adding one makes it complete), and hearing the counting words in the learning language.
- **Age 5:** number order and the missing number in a short sequence (1-5, then 1-10), and the number words in English or French.

## World and why

- **World:** Number Garden (`number-garden`). Number Garden gets a game picker (Sorting Beds first, Number Bridge second).
- **Why:** Number Garden is about quantity, order and comparison (`docs/WORLDS.md`, Number Garden §5 Number Bridge).

## Mechanic

**Scene.** The existing Number Garden background (`number-garden-bg-*`, reused) with a procedural blue stream band across the middle. A row of stepping stones crosses the stream; the rabbit (`drawAnimal(scene, 'rabbit')`, reused) waits on the near bank. Age 2: a small pile of stones on the bank. Age 5: the stones show numbers, one stone is missing (an empty ripple in its place), and 3 number stones wait on the bank to choose from. Every choice stone, the pile and the gap are tap targets of at least 64 CSS px.

**State machine** (pure, `src/games/numberBridge/bridgeMachine.ts`, no Phaser):

- Phases: `building` (gaps left) and `crossing` (the bridge is complete and the rabbit hops across). **There is no failure phase.**
- **One-more mode** (`extra.mode: "one-more"`): each tap on the pile fills the next gap (event `placed`); the last one completes the bridge (event `complete`).
- **Missing-number mode** (`extra.mode: "missing"`): tapping the right number stone fills the gap (event `complete`); another number stone gives `not-this-one` (it wobbles back, the sequence is counted aloud up to the gap, the gap pulses; nothing is lost, the try count rises).
- Taps while `crossing` are ignored (`busy`). After the rabbit reaches the far bank, a new bridge starts.

**Sequences.** `extra.range` (5 or 10) and `extra.length` (number of stones, 4 or 5). The sequence is consecutive and ascending, starting at 1 or later so it fits the range; the gap is never the first stone. The two wrong choices are numbers within the range that are not the answer, and at least one of them is next to the answer (answer ± 1). The same sequence and gap never repeat twice in a row on missing-number levels (one-more bridges always count from 1 so age 2 hears "one, two, three…").

**Crossing.** The rabbit hops onto each stone in turn and the number of each stone is spoken in the learning language ("one, two, three, four!"); on one-more levels the stones are counted the same way (no digits shown). On the far bank: a celebration, a star, and the next bridge.

**Adaptive trials.** One trial per bridge. One-more: always clean (exposure), `itemId` = `one-more-<gaps>`. Missing-number: `itemId` = the missing number, `firstTryCorrect` = right on the first tap, `hinted` = the idle hint fired.

**Idle hint.** After the track's `hintDelayMs` without a tap: one-more levels pulse the pile; missing-number levels on `picture-audio` count aloud up to the gap and pulse the right stone; on `audio-only` only the counting is spoken.

## Difficulty curve

| L | mode | stones | gaps / range | support |
|---|---|---|---|---|
| 1 | one-more | 3 | 1 gap | picture-audio |
| 2 | one-more | 4 | 2 gaps | picture-audio |
| 3 | missing | 4 | range 5, dots under each number | picture-audio |
| 4 | missing | 5 | range 10, digits only | picture-audio |
| 5 | missing | 5 | range 10, digits only | audio-only (no pulse on the right stone) |

- **Age 2:** start L1, min 1, max 2.
- **Age 5:** start L3, min 2, max 5.
- **Adaptive rules:** engine defaults.

## Leisure

Same learning-session rules as the other learning games: taps, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`. A star for every crossed bridge.

## Player journey from the map

Profile → Number Garden building → **Number Garden picker** (new: Sorting Beds, Number Bridge) → `game-picker-number-bridge` → play → HUD back → map. Handles:

- Picker: `game-picker-sorting-beds`, `game-picker-number-bridge`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedNumberBridgeLevel(level)`, `getNumberBridgeInfo()` (phase, mode, level, language, sequence, gap indices, answer, choice numbers, tries, stars, ready, page rectangles of the pile, each choice stone and the gaps).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Number Garden → picker card → complete one bridge → back to the map; the picker still opens Sorting Beds | 1 | e2e | both | `getNumberBridgeInfo` |
| AC-02 | Sequences are consecutive and inside the range, the gap is never first, exactly one choice is right, at least one wrong choice is next to the answer, and no bridge repeats twice in a row | 1 | unit | @single-orientation | |
| AC-03 | No failure state: the machine has only `building` and `crossing`; any tap sequence completes the bridge | 1 | unit | @single-orientation | |
| AC-04 | Age 2 one-more: each pile tap fills one gap; crossing counts the stones in the learning language (speech spy) | 1 | unit, e2e+seed | @single-orientation | `seedNumberBridgeLevel`, `getSpokenLines` |
| AC-05 | Age 5 missing number: a wrong stone keeps the gap and never reduces stars or the balance; the right stone completes the bridge and gives a star | 1 | unit, e2e+seed | @single-orientation | `seedNumberBridgeLevel`, `getNumberBridgeInfo` |
| AC-06 | Adaptive steps: one-more bridges are clean; missing-number bridges are clean only on a first-tap answer; age 2 stays within L1-L2; age 5 starts at L3 | 1 | unit | @single-orientation | |
| AC-07 | Content validates; number words 1-10 exist in Hebrew, English and French | 1 | unit | @single-orientation | |
| AC-08 | Pile, choice stones and gaps are tap targets of at least 64 CSS px in both orientations | 1 | e2e | both | `getNumberBridgeInfo` |
| AC-09 | Device check: touch, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused:** Number Garden background, the rabbit rig (`drawAnimal`), HUD, Juice bursts, the existing `he.praise.0` clip.
- **New art** (gemini-4-hydrogen-medium, flat prop style, no characters): `public/art/props/bridge-stone.svg` (`prop-bridge-stone`, a flat stepping stone seen from slightly above) and `public/art/props/stone-pile.svg` (`prop-stone-pile`). Numbers and dots are drawn by the scene on top of the stone. Procedural fallbacks. Same SVG contract as the other props.
- **Animation:** basic tweens only (`pressSquash`, a fly arc from the pile or bank into the gap, a wobble back, rabbit hops with a squash, Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `bridge.intro.oneMore.he` | he | הארנב רוצה לעבור! בואי נוסיף עוד אבן. | First bridge of a visit, one-more |
| `bridge.intro.missing.he` | he | איזה מספר חסר בגשר? | First bridge of a visit, missing |
| `bridge.oneMore.<lang>` | en / fr | One more! / Encore une ! | Each pile tap |
| `bridge.number.<n>.<lang>` | en / fr | one … ten / un … dix | Counting while crossing and on hints |
| `bridge.notThis.he` | he | הממ, בואי נספור שוב. | A wrong number stone |
| `bridge.crossed.he` | he | הארנב עבר! | Far bank |
| `he.praise.0` | he | existing clip | Each crossed bridge |

### Pass 2 — polish

Only after Maor approves Pass 1: polished bridge art and stream, the picker card art, recorded Leda clips.

## Out of scope

- Counting backwards, sequences that skip (2, 4, 6), dragging stones, other characters.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** the crossing character is the existing rabbit (no new character).
- **Open decision for the owner:** stepping stones as the bridge; numbers only ascending and consecutive in Pass 1.
- **Open decision for the owner:** age 2 stays in one-more (max L2); age 5 starts at L3 (missing number up to 5).
- **Open decision for the owner:** Number Garden building now opens a game picker (Sorting Beds, Number Bridge) instead of Sorting Beds directly; Hebrew card name "גשר המספרים".
- **Open decision for the owner:** a wrong number stone is a gentle retry with counting aloud; it is a non-clean adaptive trial.

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

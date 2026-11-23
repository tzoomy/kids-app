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
| 6 | equation (`op: add`) | 3 | a + b = ?, every number 1–10 | picture-audio |
| 7 | equation (`op: sub`) | 3 | a − b = ?, every number 1–10, result ≥ 1 | picture-audio |
| 8 | equation (`op: mix`) | 3 | a + b or a − b, numbers up to 20, every equation touches the teens | audio-only (no pulse on the right stone) |

- **Age 2:** start L1, min 1, max 2 (unchanged).
- **Age 5:** start L3, min 2, **max 8** (was 5; age-5 stretch, 2026-11-23).
- **Adaptive rules:** engine defaults.

### Age-5 stretch: equation bridges (L6–L8, 2026-11-23)

Approved by Maor on 2026-11-23 (Elli's harder track; Shai's age-2 caps stay unchanged). Defaults below are reversible and listed in `docs/PENDING-DECISIONS.md`.

- **Mode** `extra.mode: "equation"` with `extra.op` (`add`, `sub` or `mix`), `stones: 3`, `gaps: 1`, `extra.range` 10 or 20. The bridge is three number stones `a`, `b`, and a gap for the result, with a `+` / `−` sign between the first two stones and `=` before the gap (drawn on the water, no new art). Three number stones wait on the bank.
- **Equations** (`equationCandidates` in `bridgeMachine.ts`): every number is 1..range and a difference is never 0. Within 10 there are 45 sums and 45 differences. On L8 (range 20) a sum is 11–20 or a subtraction starts at 11–20, so every L8 bridge practises the teens. `mix` picks `add` or `sub` 50/50 per bridge. The same equation never repeats twice in a row.
- **Choices:** the result, a neighbour (result ± 1), and the "other operation" slip (a − b for a sum, a + b for a difference) when it is a new number in range, otherwise another number in range.
- **Voice:** each bridge asks its question in the learning language, clip by clip: number `a`, `plus` / `minus`, number `b`, `equals` (`bridge.number.<n>.<lang>`, `bridge.op.<word>.<lang>`). The crossing says "three" / "plus four" / "equals seven". A wrong stone says `bridge.notThis.he` and asks the question again. The idle hint repeats the question and, on L6–L7 only, pulses the right stone. A Hebrew intro plays on the first bridge of each equation level (`bridge.intro.add.he`, `bridge.intro.sub.he`, `bridge.intro.mix.he`), including when she levels up into it mid-visit; L1–L5 intros are unchanged.
- **Adaptive:** item id `a+b` or `a-b`; a bridge is clean only on a first-tap answer (same as missing-number bridges).

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
| AC-10 | Age-5 stretch content: L1–L5 and the age-2 track (L1–L2) are unchanged, age 5 reaches L8, L6–L8 are equation levels; the schema rejects a bad `op`, more than 3 stones, a range above 20, `op` on a non-equation level, and missing number words 11–20 | 1 | unit | @single-orientation | |
| AC-11 | Age 5 climbs to L8 on clean equation bridges and stays there; age 2 never leaves L1–L2 | 1 | unit | @single-orientation | |
| AC-12 | Equation bridges: `a op b = c` with numbers 1..range and the gap on `c`, 3 distinct choices with a neighbour, no repeat, L8 always in the teens, a wrong stone keeps the gap; real taps at L7 hear the question clip by clip, a wrong stone changes nothing, the right stone earns a star | 1 | unit, e2e+seed | @single-orientation | `seedNumberBridgeLevel`, `getNumberBridgeInfo`, `getSpokenLines` |
| AC-13 | Stretch voice lines: question and crossing line ids per language, number words 1–20, one text per line id, Hebrew intros addressed to one girl | 1 | unit | @single-orientation | |
| AC-14 | L8 choice stones (numbers up to 20) and the gap are tap targets of at least 64 CSS px inside the viewport in both orientations | 1 | e2e+seed | both | `seedNumberBridgeLevel`, `getNumberBridgeInfo` |

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
| `bridge.number.<11-20>.<lang>` | en / fr | eleven … twenty / onze … vingt | Equation bridges (L8) |
| `bridge.op.plus.<lang>` | en / fr | plus / plus | Equation question and crossing |
| `bridge.op.minus.<lang>` | en / fr | minus / moins | Equation question and crossing |
| `bridge.op.equals.<lang>` | en / fr | equals / égale | Equation question and crossing |
| `bridge.intro.add.he` | he | בואי נחבר! כמה זה ביחד? בחרי את האבן הנכונה. | First bridge of L6 in a visit |
| `bridge.intro.sub.he` | he | בואי נחסר! כמה נשאר? בחרי את האבן הנכונה. | First bridge of L7 in a visit |
| `bridge.intro.mix.he` | he | עכשיו גם מחברים וגם מחסרים. הקשיבי טוב ובחרי את האבן הנכונה. | First bridge of L8 in a visit |

The full line list (for the Leda render list) comes from `allBridgeVoiceLines()` in `bridgeRound.ts`.

### Pass 2 — polish

Only after Maor approves Pass 1: polished bridge art and stream, the picker card art, recorded Leda clips.

## Out of scope

- Counting backwards, sequences that skip (2, 4, 6), dragging stones, other characters.
- Number bonds with the gap on an addend ("3 + ? = 10") and two-gap equations (possible later stretch levels).

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** the crossing character is the existing rabbit (no new character).
- **Open decision for the owner:** stepping stones as the bridge; numbers only ascending and consecutive in Pass 1.
- **Open decision for the owner:** age 2 stays in one-more (max L2); age 5 starts at L3 (missing number up to 5).
- **Open decision for the owner:** Number Garden building now opens a game picker (Sorting Beds, Number Bridge) instead of Sorting Beds directly; Hebrew card name "גשר המספרים".
- **Open decision for the owner:** a wrong number stone is a gentle retry with counting aloud; it is a non-clean adaptive trial.
- **Open decision for the owner:** age-5 stretch L6–L8 (addition within 10, subtraction within 10, both within 20) with the equation spoken in the learning language and a Hebrew intro per level (2026-11-23 defaults, `docs/PENDING-DECISIONS.md`).

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive
- `2026-11-23` — age-5 stretch: equation levels L6–L8, age-5 max 8, number words 11–20, operator and intro lines (AC-10–AC-14), approved by Maor — substantive

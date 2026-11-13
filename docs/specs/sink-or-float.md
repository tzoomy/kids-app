# `sink-or-float` — Sink or Float

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Science World, Sink or Float, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A water tank stands on the lab table with a shelf of everyday objects next to it. The child taps an object, it drops into the water, and it either floats on top or sinks to the bottom, and the result is named. There is **no failure state**: every drop is watched and celebrated. Age 2 drops freely. Age 5 first predicts ("will it float or sink?") with two big buttons, then watches; a wrong guess is never punished: the scene says "let's see" and names what really happened.

## Learning goals

- **Age 2:** cause and effect (drop it and watch), and the words "floats" and "sinks" in Hebrew and the learning language.
- **Age 5:** predict, then check (a first step of the scientific method); light and hollow things float, heavy solid things sink; the words in English or French.

## World and why

- **World:** Science World (`science-world`, separate map area: pending Maor decision).
- **Why:** Science World is for simple experiments with cause and effect and no failure (`docs/WORLDS.md`, Science World, Sink or Float).

## Mechanic

**Scene.** The same procedural lab wall and table as Potion Lab, a glass water tank in the middle, and a row of three objects next to it (in portrait: under the tank). Every object, the tank and the prediction buttons are tap targets of at least 64 CSS px.

**Objects** (Pass 1, content `objects`, each with Hebrew, English and French names and `floats: true|false`):

| id | floats | Hebrew | English | French |
|---|---|---|---|---|
| ball | yes | כדור | ball | ballon |
| leaf | yes | עלה | leaf | feuille |
| apple | yes | תפוח | apple | pomme |
| stone | no | אבן | stone | caillou |
| key | no | מפתח | key | clé |
| spoon | no | כפית | spoon | cuillère |

Each round offers three objects with at least one floater and one sinker, never the same set twice in a row.

**State machine** (pure, `src/games/sinkFloat/sinkFloatMachine.ts`, no Phaser):

- Phases: `choosing` (pick an object), `predicting` (request mode only: pick float or sink) and `watching` (the object drops and settles). **There is no failure phase.**
- Free mode: tap an object → `dropped` (outcome `floats` or `sinks`) → watching → back to choosing.
- Predict mode: tap an object → `asked` (predicting) → tap a prediction button → `revealed` with `correct: true|false` → watching → choosing. A wrong prediction is named and praised the same way ("let's see... it floats!"); nothing is lost.
- Taps during `watching` are ignored (`busy`). An object already in the tank goes back to the shelf at the next round.

**Adaptive trials.** Free mode: each drop is one trial (`itemId` = object id), always clean (exposure). Predict mode: each prediction is one trial (`itemId` = object id, `firstTryCorrect` = prediction was right, `hinted` = idle hint fired).

**Idle hint.** After the track's `hintDelayMs` without a tap: free mode pulses one object; predict mode on `picture-audio` repeats the question and pulses both buttons; on `audio-only` only the question is repeated.

**Naming** (`extra.naming: "he+learning"`): the object name and the result in Hebrew ("התפוח צף!"), then the result word in the round's learning language ("It floats!" / "Ça flotte !"). Pending decision: Hebrew plus the active learning language, not all three.

**Stars.** Free mode: a star every `extra.dropsPerStar` drops (default 3). Predict mode: a star every 3 predictions, right or wrong (no-fail rule).

**Leave.** The HUD back button returns to the map at any time.

## Difficulty curve

| L | mode | support |
|---|---|---|
| 1 | free | picture-audio |
| 2 | predict | picture-audio (buttons show a floating / sunk icon; the hint pulses both) |
| 3 | predict | audio-only (the question is only spoken; buttons stay but do not pulse) |

- **Age 2:** start L1, max L1 (free dropping only).
- **Age 5:** start L2, min 1, max 3.
- **Adaptive rules:** engine defaults.

## Leisure

Same learning-session rules as the other learning games: taps, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`.

## Player journey from the map

Profile → tap the Science World building → Science World picker (Sink or Float card) → play → HUD back → map. Handles:

- Map: `getBuildingHit('science-world')`; picker: `game-picker-sink-or-float`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedSinkFloatLevel(level)`, `getSinkFloatInfo()` (phase, mode, level, language, offered objects, last outcome, stars, ready, page rectangles of the objects, the tank and the two prediction buttons).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Science World → picker card → drop one object → back to the map | 1 | e2e | both | `getBuildingHit`, `getSinkFloatInfo` |
| AC-02 | Every object has a fixed outcome; each round offers 3 objects with at least one floater and one sinker | 1 | unit | @single-orientation | |
| AC-03 | No failure state: the machine has only `choosing`, `predicting` and `watching`; every tap sequence returns to `choosing` | 1 | unit | @single-orientation | |
| AC-04 | Free mode (age 2): each drop names the outcome in Hebrew and in the learning language (speech spy) | 1 | unit, e2e+seed | @single-orientation | `seedSinkFloatLevel`, `getSpokenLines` |
| AC-05 | Predict mode (age 5): a right and a wrong prediction both reveal and name the real outcome; a wrong one never reduces stars or the balance | 1 | unit, e2e+seed | @single-orientation | `seedSinkFloatLevel`, `getSinkFloatInfo` |
| AC-06 | Adaptive steps: free drops are clean trials; predictions are clean only when right; age 2 stays at L1, age 5 starts at L2 and rises and drops with the engine rules | 1 | unit | @single-orientation | |
| AC-07 | Content validates; every object has non-empty Hebrew, English and French names | 1 | unit | @single-orientation | |
| AC-08 | Object, tank and prediction-button tap targets are at least 64 CSS px in both orientations | 1 | e2e | both | `getSinkFloatInfo` |
| AC-09 | Device check: touch, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused:** Potion Lab's procedural lab background, HUD, Juice bursts, existing praise clip.
- **New art** (gemini-4-hydrogen-medium, flat map style, no faces or characters): `public/art/props/water-tank.svg` (`prop-water-tank`) and six object props under `public/art/props/float-*.svg` (`prop-float-ball`, `prop-float-leaf`, `prop-float-apple`, `prop-float-stone`, `prop-float-key`, `prop-float-spoon`). Procedural fallback for each. Same SVG contract as the other props (outline `#3B2A22` about 6 px, no gradients, filters, text or rasters, under 15 KB).
- **Animation:** basic tweens only (`pressSquash`, a drop tween into the tank, a slow sink or a bob on the surface, a splash with Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `sinkFloat.intro.free.he` | he | בואי נבדוק מה צף ומה שוקע! לחצי על חפץ. | First drop of a visit, free |
| `sinkFloat.intro.predict.he` | he | בואי ננחש: זה יצוף או ישקע? | First prediction of a visit |
| `sinkFloat.ask.he` | he | מה את חושבת? יצוף או ישקע? | Each object in predict mode |
| `sinkFloat.result.<object>.he` | he | e.g. התפוח צף! / האבן שוקעת! | Each outcome |
| `sinkFloat.result.<floats\|sinks>.<lang>` | en / fr | It floats! / It sinks! · Ça flotte ! / Ça coule ! | Each outcome, after the Hebrew |
| `sinkFloat.letsSee.he` | he | בואי נראה... | Wrong prediction, before the outcome |
| `he.praise.0` | he | existing clip | Star |

### Pass 2 — polish

Only after Maor approves Pass 1: polished art, water ripples, picker card art and recorded Leda clips.

## Out of scope

- Dragging objects, objects that half-sink, adding salt, characters.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** the six Pass 1 objects and their outcomes (the apple floats).
- **Open decision for the owner:** naming in Hebrew plus the active learning language, not all three.
- **Open decision for the owner:** age 2 stays in free dropping (max L1); age 5 starts on predictions (L2).
- **Open decision for the owner:** a wrong prediction is never marked wrong to the child ("let's see..."), but it is a non-clean adaptive trial.
- **Open decision for the owner:** a star every 3 drops or predictions.

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

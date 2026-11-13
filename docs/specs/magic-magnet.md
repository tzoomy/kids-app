# `magic-magnet` — Magic Magnet

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Science World, Magic Magnet, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A big red horseshoe magnet hangs above a lab table with a row of everyday objects. The child drags the magnet over the objects (or taps an object and the magnet glides to it). Iron things jump up and stick to the magnet; the others wiggle and stay. Every object the magnet touches is named. There is **no failure state**. Age 2 explores freely. Age 5 first predicts ("will the nail stick?"), then tests with the magnet; a wrong guess is a happy surprise, never a loss.

## Learning goals

- **Age 2:** cause and effect (bring the magnet close, things jump), object words, and "sticks" / "doesn't stick", heard in Hebrew and the learning language.
- **Age 5:** predict, then test (a first step of the scientific method); grouping objects by what happens (iron things stick, the others don't); the object words in English or French.

## World and why

- **World:** Science World (`science-world`, separate map area: pending Maor decision).
- **Why:** Science World is for simple experiments with cause and effect and no failure (`docs/WORLDS.md`, Science World, Magic Magnet).

## Mechanic

**Scene.** The same procedural lab wall and wooden table as Potion Lab, a row of objects on the table and the magnet above them. The magnet, every object and the two prediction buttons are tap or drag targets of at least 64 CSS px in both orientations.

**Objects** (Pass 1, content `objects`, each with Hebrew, English and French names and `metal: true|false`). Only objects that really stick to a fridge magnet are `metal` (iron or steel; no spoons or keys, which are often not magnetic):

| id | metal | Hebrew | English | French | Art |
|---|---|---|---|---|---|
| paperclip | yes | מהדק | paperclip | trombone | new `magnet-paperclip` |
| nail | yes | מסמר | nail | clou | new `magnet-nail` |
| screw | yes | בורג | screw | vis | new `magnet-screw` |
| bottle-cap | yes | פקק | bottle cap | capsule | new `magnet-bottle-cap` |
| ball | no | כדור | ball | balle | reused `item-ball` |
| leaf | no | עלה | leaf | feuille | reused `clue-icon-leaf` |
| feather | no | נוצה | feather | plume | reused `clue-icon-feather` |
| apple | no | תפוח | apple | pomme | reused `food-apple` |

Each round lays out `extra.objectCount` objects (4 or 5) with at least one metal and one non-metal object, never the same set twice in a row.

**State machine** (pure, `src/games/magicMagnet/magnetMachine.ts`, no Phaser):

- Phases: `exploring` (free mode: the magnet is live), `predicting` (predict mode: the target object is asked about, the magnet waits), `testing` (predict mode: the prediction is made, the magnet is live for the target) and `done` (the round is complete). **There is no failure phase.**
- **Free mode.** `touch(id)` on a metal object that is not stuck yet: `stuck` (it jumps to the magnet and follows it). On a non-metal object: `wiggled` (it wiggles and stays). On an object already stuck: `busy`. When every metal object in the round is stuck: the `stuck` event carries `roundComplete: true` and the phase becomes `done`.
- **Predict mode.** The round walks through its objects in order. `predict(sticks: boolean)` in `predicting`: `predicted` (phase `testing`). `touch(id)` in `testing`: on the target, `revealed` with `sticks` (the truth) and `correct` (prediction = truth); the next object becomes the target (phase `predicting`), or the phase becomes `done` after the last one. Touching another object while testing: `busy` (only the asked-about object reacts during a test). A wrong prediction is praised and named the same way ("wow, a surprise!"); nothing is lost.
- `predict` outside `predicting` and `touch` outside `exploring`/`testing` return `busy` and leave the state unchanged.

**Touching.** The scene calls `touch` when the magnet's pole tips come within reach of an object's centre (a drag), or when the child taps an object (the magnet glides there, then touches). A non-metal object reacts again only after the magnet has left it.

**Stars.** One star when a round is `done` (free: every metal object found; predict: every object tested). Then the stuck objects drop back, and a new round lays out a new set.

**Adaptive trials.** Free mode: each touched object is one trial (`itemId` = object id), always clean (exposure). Predict mode: each test is one trial (`itemId` = object id, `firstTryCorrect` = the prediction was right, `hinted` = the idle hint fired).

**Idle hint.** After the track's `hintDelayMs` without a tap or drag: free mode pulses one metal object that is not stuck yet; predict mode in `predicting` repeats the question and pulses both buttons; in `testing` it pulses the target (on `audio-only` levels it only repeats the object name).

**Naming** (`extra.naming: "he+learning"`): the Hebrew reaction line with the object name ("המסמר נדבק!" / "הנוצה לא נדבקת."), then the object word and the result in the round's learning language ("Nail. It sticks!" / "Clou. Ça colle !"). Pending decision: Hebrew plus the active learning language, not all three.

**Leave.** The HUD back button returns to the map at any time.

## Difficulty curve

| L | mode | objects | support |
|---|---|---|---|
| 1 | free | 4 | picture-audio |
| 2 | predict | 4 | picture-audio (the target object glows; the hint pulses both buttons) |
| 3 | predict | 5 | picture-audio (the target glows, no button pulse) |
| 4 | predict | 5 | audio-only (the target is only named in the learning language, no glow) |

- **Age 2:** start L1, max L1 (free exploring only).
- **Age 5:** start L2, min 1, max 4.
- **Adaptive rules:** engine defaults.

## Leisure

Same learning-session rules as the other learning games: taps, drags, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`.

## Player journey from the map

Profile → tap the Science World building → Science World picker (Magic Magnet card) → play → HUD back → map. Handles:

- Map: `getBuildingHit('science-world')`; picker: `game-picker-magic-magnet`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedMagnetLevel(level)`, `getMagnetInfo()` (phase, mode, level, language, target, the objects with `metal` / `stuck`, and the page rectangles of the magnet, the objects and the prediction buttons).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-input journey: profile → Science World → picker card → drag the magnet onto a metal object (it sticks) → back to the map | 1 | e2e | both | `getBuildingHit`, `getMagnetInfo` |
| AC-02 | Free mode: a metal object sticks once and follows the magnet; a non-metal object wiggles and never sticks; the round is done only when every metal object is stuck | 1 | unit | @single-orientation | |
| AC-03 | No failure state: the machine has only `exploring`, `predicting`, `testing` and `done`; every input sequence keeps the round completable and never removes a stuck object or a star | 1 | unit | @single-orientation | |
| AC-04 | Every touched object is named in Hebrew and in the learning language, with "sticks" or "doesn't stick" (speech spy) | 1 | unit, e2e+seed | @single-orientation | `seedMagnetLevel`, `getSpokenLines` |
| AC-05 | Predict mode (age 5): predict, then test; right and wrong predictions are both named and praised, never reduce stars or the balance, and the round gives a star after every object is tested | 1 | unit, e2e+seed | @single-orientation | `seedMagnetLevel`, `getMagnetInfo` |
| AC-06 | Adaptive steps: free touches are clean trials; predict trials are clean only on a right unhinted prediction; age 2 stays at L1, age 5 starts at L2 | 1 | unit | @single-orientation | |
| AC-07 | Content validates; every object has Hebrew, English and French names and reaction lines that are not empty; every round has at least one metal and one non-metal object | 1 | unit | @single-orientation | |
| AC-08 | Tapping an object glides the magnet there and touches it (tap works as well as drag) | 1 | e2e | @single-orientation | `getMagnetInfo` |
| AC-09 | Magnet, object and prediction-button targets are at least 64 CSS px and on screen in both orientations | 1 | e2e | both | `getMagnetInfo` |
| AC-10 | Device check: touch drag, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused:** the Potion Lab procedural lab wall and table; `item-ball`, `clue-icon-leaf`, `clue-icon-feather`, `food-apple`; HUD; Juice bursts; the existing praise clip.
- **New art** (small, own drawings, gemini-4-hydrogen-medium, flat map style): `public/art/magnet/magnet.svg` (`magnet-magnet`), `paperclip.svg`, `nail.svg`, `screw.svg`, `bottle-cap.svg`. Procedural fallback for each. Same SVG contract as the other props (outline `#3B2A22` about 6 px, no gradients, filters, text or rasters, under 15 KB).
- **No characters.**
- **Animation:** basic tweens only (`pressSquash`, a jump arc to the magnet, a wiggle, `popIn`, a glide for tap, a drop back at the round end, Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `magnet.intro.free.he` | he | בואי נגלה מה נדבק למגנט! גררי את המגנט. | First round of a visit, free |
| `magnet.intro.predict.he` | he | בואי ננחש מה יידבק למגנט, ואז נבדוק! | First round of a visit, predict |
| `magnet.ask.<id>.he` | he | per object, e.g. האם המסמר יידבק למגנט? | Each prediction (then the object word in the learning language) |
| `magnet.test.he` | he | בואי נבדוק! קרבי את המגנט. | After a prediction |
| `magnet.react.<id>.he` | he | per object, e.g. המסמר נדבק! / הנוצה לא נדבקת. | Each touch |
| `magnet.word.<id>.<lang>` | en / fr | the object word | Each touch, each question |
| `magnet.sticks.<lang>` / `magnet.notSticks.<lang>` | en / fr | It sticks! / It doesn't stick. (Ça colle ! / Ça ne colle pas.) | Each touch |
| `magnet.right.he` / `magnet.surprise.he` | he | ניחשת נכון! / וואו, הפתעה! | After a reveal |
| `he.praise.0` | he | existing clip | Round done (star) |

### Pass 2 — polish

Only after Maor approves Pass 1: a lab background, polished objects, magnetic sparkle lines, the picker card art and recorded Leda clips.

## Out of scope

- Magnet strength or distance, two magnets, poles (attract/repel), sorting into bins, drag-to-throw, characters.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** naming in Hebrew plus the active learning language (not all three languages).
- **Open decision for the owner:** the object set (four iron objects, four non-metal reused ones; no spoons or keys).
- **Open decision for the owner:** age 2 stays in free exploring (max L1); age 5 starts on predict-then-test (L2).
- **Open decision for the owner:** a wrong prediction is a happy surprise (named, praised), with no "wrong" sound.
- **Open decision for the owner:** one star per completed round; during a test only the asked-about object reacts.
- **Open decision for the owner:** Hebrew card name "המגנט הקסום" and a placeholder card.

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

# `word-train` — Word Train

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Language House, Word Train, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A little train waits at a station in the Language House. Age 2 hears an English word ("Load the apple!") and loads that object onto the wagon. Age 5 spells a short English word (hat, sun, ball): each wagon carries one letter, and the child drags or taps letter blocks onto the wagons. When the train is full it toots and chugs away, and comes back for the next word. There is **no failure state**: a different object or a letter that does not fit is named and gently goes back; nothing is lost.

## Learning goals

- **Age 2:** English object words (receptive vocabulary): hear the word, find the object.
- **Age 5:** spelling short English words letter by letter (3 and 4 letters), letter names, and left-to-right order.

## World and why

- **World:** Language House (`language-house`), reached through the Language House game picker (a third card after Animal Restaurant and Kitchen Orchestra).
- **Why:** Language House is for understanding words in English and French (`docs/WORLDS.md`, Language House, Word Train).
- **Language:** **English only** (team lead, 2026-11-14), whatever the parent's language setting. The skill key is always `language-house.word-train.en`.

## Mechanic

**Scene.** The reused Picnic Train countryside background with its track, the reused train engine (`train-engine`) on the track facing left, and new open cargo wagons (`word-train-wagon`) behind it. Every object, letter block and wagon is a tap or drag target of at least 64 CSS px in both orientations.

**Load mode** (`extra.mode: "load"`, age 2). One empty wagon behind the engine and `extra.choiceCount` objects (2 or 3) on the platform. The voice asks in English ("Load the apple!"). Tap an object, or drag it onto the wagon:

- The asked-for object: `loaded`. It hops into the wagon, is named ("Apple!"), the train toots, chugs off to the left, and comes back with an empty wagon and a new request.
- Another object: `other`. It wiggles, is named ("That's the ball!"), stays on the platform, and the request is repeated. The try is counted; nothing is lost.

**Spell mode** (`extra.mode: "spell"`, age 5). The picture of the word sits on a station sign, the train has one wagon per letter (first letter right behind the engine, so the word reads left to right), and the letter blocks (the word's letters, shuffled, plus `extra.distractors` extra letters) wait below. The voice says "Let's spell sun!". Drag a block onto a wagon, or tap a block to send it to the next empty wagon:

- The right letter for that wagon: `placed`. It locks in, and its letter name is spoken ("s").
- Any other letter (wrong wagon, wrong letter, or a distractor): `bounced`. It slides back to its place and its letter name is spoken. Nothing is lost.
- The last letter: `spelled`. The letters are spoken in order and then the word ("s, u, n: sun!"), the train toots and chugs off, and comes back with a new word.

Lowercase letters throughout (early-reading convention). On `extra.ghost: true` levels each empty wagon shows its letter faintly.

**State machine** (pure, `src/games/wordTrain/wordTrainMachine.ts`, no Phaser): phases `asking` (load) / `spelling` (spell) and `departing`. **There is no failure phase.** Inputs while `departing` return `busy`.

**Rounds and stars.** Load: a star every `extra.loadsPerStar` loads (default 3). Spell: a star for every spelled word. The next word or object never repeats the previous one.

**Adaptive trials.** Load: each request is one trial (`itemId` = object id, `firstTryCorrect` = loaded on the first pick). Spell: each word is one trial (`itemId` = word id, `firstTryCorrect` = no bounce, `hinted` = the idle hint fired).

**Idle hint.** After the track's `hintDelayMs` without input: load mode pulses the asked-for object and repeats the request; spell mode on `picture-audio` levels pulses the next right block and speaks its letter; on `audio-only` levels it only repeats the word.

**Voice.** English lines with device TTS (`lang: "en"`), one Hebrew intro line per visit, and the existing Hebrew praise clip on a star. The existing English clips are counting and colour phrases ("one apple"), not single words, so none are reused in Pass 1.

**Leave.** The HUD back button returns to the map at any time.

## Difficulty curve

| L | mode | content | support |
|---|---|---|---|
| 1 | load | 2 objects | picture-audio (the hint pulses the asked-for object) |
| 2 | load | 3 objects | picture-audio |
| 3 | spell | 3-letter words, ghost letters, no distractor | picture-audio |
| 4 | spell | 3-letter words, no ghost, 1 distractor | picture-audio |
| 5 | spell | 4-letter words, no ghost, 1 distractor | audio-only (the hint repeats the word, no block pulse) |

- **Age 2:** start L1, max L2 (loading only).
- **Age 5:** start L3, min 1, max 5.
- **Adaptive rules:** engine defaults.

**Objects** (load mode): apple, banana, carrot, ball, hat, book, egg, fish (all reused art).
**Words** (spell mode): 3 letters: hat, egg, sun, cup; 4 letters: ball, book, fish, pear (new art: sun, cup; the rest reused).

## Leisure

Same learning-session rules as the other learning games: taps, drags, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`.

## Player journey from the map

Profile → tap the Language House building → picker (Word Train card) → play → HUD back → map. Handles:

- Map: `getBuildingHit('language-house')`; picker: `game-picker-word-train`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedWordTrainLevel(level)`, `getWordTrainInfo()` (mode, phase, level, the request or word, and the page rectangles of the objects, blocks and wagons).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-input journey: profile → Language House → picker card → load the asked-for object → back to the map | 1 | e2e | both | `getBuildingHit`, `getWordTrainInfo` |
| AC-02 | Load mode: the asked-for object is `loaded`; another object is `other`, is named, keeps the request and never reduces stars or the balance | 1 | unit, e2e+seed | @single-orientation | `getWordTrainInfo`, `getSpokenLines` |
| AC-03 | Spell mode: a right letter locks into its wagon; any other letter bounces back and is named; the last letter spells the word and speaks it | 1 | unit, e2e+seed | @single-orientation | `seedWordTrainLevel`, `getWordTrainInfo` |
| AC-04 | No failure state: only `asking`, `spelling` and `departing`; every input sequence keeps the word completable and never removes a placed letter or a star | 1 | unit | @single-orientation | |
| AC-05 | Tap works as well as drag: a tapped block goes to the next empty wagon; a tapped object goes to the wagon | 1 | e2e+seed | @single-orientation | `getWordTrainInfo` |
| AC-06 | Adaptive steps: load trials are clean on a first-pick load; spell trials are clean with no bounce and no hint; age 2 stays within L1–L2, age 5 starts at L3 | 1 | unit | @single-orientation | |
| AC-07 | English only: every spoken word line is `lang: "en"`, and the skill key is `language-house.word-train.en` even when the setting is French or both | 1 | unit, e2e+seed | @single-orientation | `seedLanguageSetting`, `getWordTrainInfo` |
| AC-08 | Content validates: words are 3–4 lowercase letters with art; objects have art and English and Hebrew names; every level's word length and choice count are satisfiable | 1 | unit | @single-orientation | |
| AC-09 | Object, block and wagon targets are at least 64 CSS px and on screen in both orientations, in both modes | 1 | e2e | both | `getWordTrainInfo` |
| AC-10 | Device check: touch drag, rotation mid-game, audible device-TTS English voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused:** the Picnic Train background (`picnic-train-bg-landscape` / `-portrait`) and engine (`train-engine`); `food-apple`, `food-banana`, `food-carrot`, `food-egg`, `food-fish`, `food-pear`, `item-ball`, `item-hat`, `item-book`; HUD; Juice bursts; the existing praise clip.
- **New art** (small, own drawings, gemini-4-hydrogen-medium, flat map style): `public/art/word-train/wagon.svg` (`word-train-wagon`, an open cargo wagon matching the engine), `sun.svg`, `cup.svg`. Letter blocks are drawn procedurally (rounded squares with a lowercase letter). Procedural fallbacks for all.
- **No characters.** The train is a prop.
- **Animation:** basic tweens only (`pressSquash`, a hop into the wagon, a wiggle, a slide back, `popIn`, the train chugging off and back, Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `wordtrain.intro.load.he` | he | בואי נעמיס את הרכבת! | First request of a visit, load |
| `wordtrain.intro.spell.he` | he | בואי נבנה מילה באנגלית! | First word of a visit, spell |
| `wordtrain.load.<id>.en` | en | Load the apple! | Each request, hint |
| `wordtrain.name.<id>.en` | en | Apple! | `loaded` |
| `wordtrain.other.<id>.en` | en | That's the ball! | `other` |
| `wordtrain.spell.<id>.en` | en | Let's spell sun! | Each word, audio-only hint |
| `wordtrain.letter.<x>.en` | en | the letter name (s) | `placed`, `bounced`, hint |
| `wordtrain.word.<id>.en` | en | s, u, n: sun! | `spelled` |
| `he.praise.0` | he | existing clip | Star |

### Pass 2 — polish

Only after Maor approves Pass 1: a station background, polished wagons and blocks, steam puffs, the picker card art and recorded English word clips.

## Out of scope

- French words, uppercase, words longer than 4 letters, phonics sounds (letter names only in Pass 1), free typing, characters riding the train.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** age 2 loads named objects (as in `docs/WORLDS.md`) rather than letter-sound matching or another simplified letter mode.
- **Open decision for the owner:** English only, whatever the language setting.
- **Open decision for the owner:** letter names, not phonics sounds; lowercase letters.
- **Open decision for the owner:** the word list (hat, egg, sun, cup; ball, book, fish, pear) and the object list.
- **Open decision for the owner:** a misfit letter or another object is named and slides back (no "wrong" sound); a star every 3 loads or every spelled word.
- **Open decision for the owner:** Hebrew card name "רכבת המילים" and a placeholder card; the picker now sizes its cards to the number of games.

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

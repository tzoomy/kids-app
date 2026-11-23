# `word-train` — Word Train

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Language House, Word Train, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A little train waits at a station in the Language House. Age 2 hears an English word ("Load the apple!") and loads that object onto the wagon. Age 5 spells a short word in English or French (hat, sun, ball, pomme, fleur, banane): each wagon carries one letter, and the child drags or taps letter blocks onto the wagons. When the train is full it toots and chugs away, and comes back for the next word. There is **no failure state**: a different object or a letter that does not fit is named and gently goes back; nothing is lost.

## Learning goals

- **Age 2:** English object words (receptive vocabulary): hear the word, find the object.
- **Age 5:** spelling short words in English or French letter by letter (3 to 6 letters, including blends like sh, tr, st, sp, fl), letter names, and left-to-right order. From 2026-11-23 the ceiling is kindergarten-plus (5–6 letter words with 1–2 distractor blocks, then audio-only; L6–L8) and French words join the spelling bank (pending Maor decision). Age 2 is untouched.

## World and why

- **World:** Language House (`language-house`), reached through the Language House game picker (a third card after Animal Restaurant and Kitchen Orchestra).
- **Why:** Language House is for understanding words in English and French (`docs/WORLDS.md`, Language House, Word Train).
- **Language:** **load mode (age 2, L1–L2) is English only** (team lead, 2026-11-14), whatever the parent's language setting: Shai still hears "Load the apple!" and his skill key stays `language-house.word-train.en`. **Spell mode (L3+) follows the parent's language setting** (English, French, or both, picked per round, like the other Language House games), and its adaptive skill key is `language-house.word-train.<lang>` of the round (`en` or `fr`). The language of a round is resolved by `resolveRoundLanguages`: when the English level is a load level the round is English on the English key; a French key that has dropped to a load level plays an English load round recorded on the French key. (2026-11-23, pending Maor decision; replaces the English-only default.)

## Mechanic

**Scene.** The reused Picnic Train countryside background with its track, the reused train engine (`train-engine`) on the track facing left, and new open cargo wagons (`word-train-wagon`) behind it. Every object, letter block and wagon is a tap or drag target of at least 64 CSS px in both orientations.

**Load mode** (`extra.mode: "load"`, age 2). One empty wagon behind the engine and `extra.choiceCount` objects (2 or 3) on the platform. The voice asks in English ("Load the apple!"). Tap an object, or drag it onto the wagon:

- The asked-for object: `loaded`. It hops into the wagon, is named ("Apple!"), the train toots, chugs off to the left, and comes back with an empty wagon and a new request.
- Another object: `other`. It wiggles, is named ("That's the ball!"), stays on the platform, and the request is repeated. The try is counted; nothing is lost.

**Spell mode** (`extra.mode: "spell"`, age 5). The picture of the word sits on a station sign, the train has one wagon per letter (first letter right behind the engine, so the word reads left to right), and the letter blocks (the word's letters, shuffled, plus `extra.distractors` extra letters, 0–2) wait below. The voice says "Let's spell sun!" / "Épelons pomme !". Words of one language only are used in a round (`words[].lang`); `extra.wordLength` is the shortest length and the optional `extra.wordLengthMax` the longest (L8: 5–6). In portrait, 6–8 blocks are laid out in two centred rows so every block stays a full-size target. Drag a block onto a wagon, or tap a block to send it to the next empty wagon:

- The right letter for that wagon: `placed`. It locks in, and its letter name is spoken ("s"; in a French round the standard French letter name, for example "bé", "double vé", "i grec").
- Any other letter (wrong wagon, wrong letter, or a distractor): `bounced`. It slides back to its place and its letter name is spoken. Nothing is lost.
- The last letter: `spelled`. The letters are spoken in order and then the word ("s, u, n: sun!"), the train toots and chugs off, and comes back with a new word.

Lowercase letters throughout (early-reading convention). On `extra.ghost: true` levels each empty wagon shows its letter faintly.

**State machine** (pure, `src/games/wordTrain/wordTrainMachine.ts`, no Phaser): phases `asking` (load) / `spelling` (spell) and `departing`. **There is no failure phase.** Inputs while `departing` return `busy`.

**Rounds and stars.** Load: a star every `extra.loadsPerStar` loads (default 3). Spell: a star for every spelled word. The next word or object never repeats the previous one.

**Adaptive trials.** Load: each request is one trial (`itemId` = object id, `firstTryCorrect` = loaded on the first pick). Spell: each word is one trial (`itemId` = word id, `firstTryCorrect` = no bounce, `hinted` = the idle hint fired).

**Idle hint.** After the track's `hintDelayMs` without input: load mode pulses the asked-for object and repeats the request; spell mode on `picture-audio` levels pulses the next right block and speaks its letter; on `audio-only` levels it only repeats the word.

**Voice.** English lines (load mode and English spelling) and French lines (French spelling) with device TTS, one Hebrew intro line per language per visit (a feminine-singular French intro for French spelling), and the existing Hebrew praise clip on a star. The existing English clips are counting and colour phrases ("one apple"), not single words, so none are reused in Pass 1.

**Leave.** The HUD back button returns to the map at any time.

## Difficulty curve

| L | mode | content | support |
|---|---|---|---|
| 1 | load | 2 objects | picture-audio (the hint pulses the asked-for object) |
| 2 | load | 3 objects | picture-audio |
| 3 | spell | 3-letter words, ghost letters, no distractor | picture-audio |
| 4 | spell | 3-letter words, no ghost, 1 distractor | picture-audio |
| 5 | spell | 4-letter words, no ghost, 1 distractor | audio-only (the hint repeats the word, no block pulse) |
| 6 | spell | 5-letter words (blends included), no ghost, 1 distractor | picture-audio |
| 7 | spell | 5-letter words (blends included), no ghost, 2 distractors | picture-audio |
| 8 | spell | 5–6-letter words (blends included), no ghost, 2 distractors | audio-only |

- **Age 2:** start L1, min 1, **max L2** (loading only, English only). Pinned by a unit test: `{ start: 1, min: 1, max: 2 }`.
- **Age 5:** start L3, min 1, max **8** (was 5).
- **Adaptive rules:** engine defaults.

**Objects** (load mode, English only): apple, banana, carrot, ball, hat, book, egg, fish (all reused art).
**Words** (spell mode, `words[]` with `lang`, ascii a–z only, all reused art; a word is a candidate for any level whose length range contains it):

- English (34): 3 letters: hat, egg, sun, cup, key, pot; 4: ball, book, fish, pear, star, bowl, nail, coat; 5: apple, shirt, shoes, socks, teddy, train, stone, spoon, heart, plate, screw; 6: banana, carrot, cheese, cookie, orange, bottle, grapes, basket, flower. The original eight keep their ids.
- French (22): 3: vis, bol, pot; 4: oeuf, clou, clef; 5: pomme, poire, livre, tasse, balle, fleur, train, coeur; 6: banane, orange, raisin, fraise, soleil, ballon, pierre, panier. Spelled without accents or ligatures (`oeuf`, `coeur`): the blocks are lowercase a–z only. Words of 7+ letters (poisson, chapeau, carotte, fromage) are skipped.
- Blends in the bank: sh, tr, st, sp, pl, gr, scr, ch, fl, fr (shirt, shoes, train, stone, star, spoon, plate, screw, grapes, flower; train, fleur, fraise). The schema requires every spell level to have at least 2 words of its length range in every listed language.
- French ids add `-fr` only where the English id exists (`pot-fr`, `train-fr`, `orange-fr`).

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
| AC-07 | Load mode stays English only: every load line is `lang: "en"` and the skill key is `language-house.word-train.en` even when the setting is French or both (age 2 unchanged); spell mode follows the setting | 1 | unit, e2e+seed | @single-orientation | `seedLanguageSetting`, `getWordTrainInfo` |
| AC-08 | Content validates: words are 3–6 lowercase ascii letters with a language and art; objects have art and English and Hebrew names; every level's word length range is satisfiable in every listed language and every choice count is satisfiable | 1 | unit | @single-orientation | |
| AC-09 | Object, block and wagon targets are at least 64 CSS px and on screen in both orientations, in both modes | 1 | e2e | both | `getWordTrainInfo` |
| AC-10 | Device check: touch drag, rotation mid-game, audible device-TTS English and French voice, visuals | 1 | device | both | |
| AC-11 | Ceiling curve: L6–L8 appended (L1–L5 unchanged), `tracks.age2` pinned `{1,1,2}`, `tracks.age5` start 3 / max 8; L6–L8 plans (5-letter, 5–6-letter, 1–2 distractors, L8 audio-only); a 6-letter word is spellable | 1 | unit | @single-orientation | |
| AC-12 | Word bank: expanded English bank plus curated French bank (ascii, art in the manifest, blends, every length 3–6), every spell level satisfiable in both languages, schema rejections; L6 journey spells a five-letter word | 1 | unit, e2e+seed | @single-orientation | `seedLanguageSetting`, `seedWordTrainLevel`, `getWordTrainInfo` |
| AC-13 | French spelling: French intro, spell and word lines, standard French letter names, round language rule (load stays English), adaptive keys `.en` / `.fr`; a French L7 round is spelled with the French lines and the `.fr` key | 1 | unit, e2e+seed | @single-orientation | `seedLanguageSetting`, `seedWordTrainLevel`, `getWordTrainInfo`, `getSpokenLines` |
| AC-14 | L7 and L8 (5–6 wagons, 7–8 blocks): wagons and blocks are at least 64 CSS px, on screen and not overlapping in both orientations | 1 | e2e+seed | both | `seedWordTrainLevel`, `getWordTrainInfo` |
| AC-15 | Voice catalogue: every line id the game can speak (load, English and French spelling, letters, intros, help) is enumerated with non-empty text | 1 | unit | @single-orientation | |

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
| `wordtrain.intro.spell.he` | he | בואי נבנה מילה באנגלית! | First English word of a visit, spell |
| `wordtrain.intro.spell.fr.he` | he | בואי נבנה מילה בצרפתית! | First French word of a visit, spell |
| `wordtrain.help.he` | he | help text | Help pill |
| `wordtrain.load.<id>.en` | en | Load the apple! | Each request, hint |
| `wordtrain.name.<id>.en` | en | Apple! | `loaded` |
| `wordtrain.other.<id>.en` | en | That's the ball! | `other` |
| `wordtrain.spell.<id>.<lang>` | en / fr | Let's spell sun! / Épelons pomme ! | Each word, audio-only hint |
| `wordtrain.letter.<x>.<lang>` | en / fr | the letter name (s / bé, double vé, i grec) | `placed`, `bounced`, hint |
| `wordtrain.word.<id>.<lang>` | en / fr | s, u, n: sun! / p, o, m, m, e : pomme ! | `spelled` |
| `he.praise.0` | he | existing clip | Star |

### Pass 2 — polish

Only after Maor approves Pass 1: a station background, polished wagons and blocks, steam puffs, the picker card art and recorded English word clips.

## Out of scope

- French load mode (age 2 stays English only), accented letters in blocks, uppercase, words longer than 6 letters, phonics sounds (letter names only in Pass 1), free typing, characters riding the train.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** age 2 loads named objects (as in `docs/WORLDS.md`) rather than letter-sound matching or another simplified letter mode.
- **Open decision for the owner (superseded 2026-11-23):** English only, whatever the language setting. Now: load mode stays English only; spell mode follows the setting and adds a French spelling track (see `docs/PENDING-DECISIONS.md`).
- **Open decision for the owner:** letter names, not phonics sounds; lowercase letters.
- **Open decision for the owner:** the word list (hat, egg, sun, cup; ball, book, fish, pear) and the object list.
- **Open decision for the owner:** a misfit letter or another object is named and slides back (no "wrong" sound); a star every 3 loads or every spelled word.
- **Open decision for the owner:** Hebrew card name "רכבת המילים" and a placeholder card; the picker now sizes its cards to the number of games.

## Changelog

- `2026-11-23` — Elli ceilings (approved by Maor via the team lead): L6–L8 appended (5-letter, 5-letter with 2 distractors, 5–6-letter audio-only), `tracks.age5.max` 5 → 8 (start 3, min 1 kept), `tracks.age2` pinned `{1,1,2}` and load mode kept English only. Spell mode now follows the language setting with skill keys `.en` / `.fr`; new French spelling track and expanded English bank (34 English, 22 French words; `words[].lang`, ascii, 3–6 letters); `linesFr`, `linesHe.introSpellFr`, `extra.wordLengthMax`, `extra.distractors` 0–2, standard French letter names (`FRENCH_LETTER_NAMES`). Portrait blocks wrap to two rows for 6–8 blocks. `getWordTrainInfo().language` can be `fr` (spell mode) and `skillKey` follows the round. AC-07 and AC-08 reworded; new ACs AC-11 to AC-15. No new hooks. — substantive

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

# `letter-monster` — Letter Monster

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Language House §4 Letter Monster, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A friendly, hungry monster sits behind the Language House counter. It asks for a food, and the child feeds it by tapping the matching food on the table. The food flies into its mouth, it munches and cheers, and the next request comes. **No failure state:** a food that does not match makes the monster shake its head gently ("hmm, not this one"), the food hops back to the table, and the same request stays until it is fed. Age 2 feeds by color; age 5 feeds by the first letter of the food's word in English or French.

## Learning goals

- **Age 2:** colors, and food words heard in the learning language.
- **Age 5:** the initial sound and letter of a word in English or French (letter name, then a word that starts with it).

## World and why

- **World:** Language House (`language-house`), a third card in the Language House game picker.
- **Why:** Language House teaches words in the learning language through play; `docs/WORLDS.md` §4 Letter Monster.

## Monster (pending Maor decision)

The monster is a **simple prop**, not a new main character and not one of the approved characters: one round, fuzzy, friendly shape in the flat prop style, with two simple dot eyes and a mouth, drawn as two SVGs (`monster-closed`, `monster-open`). It has no name and does not appear outside this game. Whether to keep it, replace it with an approved character, or turn it into a character is **pending Maor**.

## Mechanic

**Scene.** The Language House look with a plain procedural backdrop (warm wall, counter). The monster in the middle-top, and a row of foods on the counter under it. A sign next to the monster shows the request: a color dot (color levels) or the big letter (letter levels with picture support). Foods and the monster are tap targets of at least 64 CSS px.

**Foods** (reused art `public/art/foods/*.svg` and names from `animal-restaurant.json`): apple (red), banana (yellow), carrot (orange), grapes (purple), strawberry (red), broccoli (green), pear (green), orange (orange), cheese (yellow), cookie (brown), egg (white), fish (blue). Each food has its English and French word and its initial letter per language (content `foods`), for example banana B / banane B, fish F / poisson P, egg E / œuf O.

**Rounds.** Each request offers `extra.choices` foods (2 or 3). Exactly one food matches the request; the others never match (different color, or a different initial letter in the round's language). The same request is never asked twice in a row.

**State machine** (pure, `src/games/letterMonster/monsterMachine.ts`, no Phaser):

- Phases: `asking` (waiting for a food) and `eating` (the matched food is being eaten). **There is no failure phase.**
- Tap the matching food → event `fed` (phase `eating`); then `next` starts a new request.
- Tap another food → event `not-this-one` (phase stays `asking`, the try count rises; nothing is lost).
- Taps while `eating` → `busy`.

**Adaptive trials.** One trial per request: `itemId` = the request (`color:red` or `letter:B`), `firstTryCorrect` = fed on the first tap, `hinted` = the idle hint fired.

**Idle hint.** After the track's `hintDelayMs` without a tap the request is repeated; on `picture-audio` levels the matching food also wiggles once.

**Voice.** Requests in Hebrew with the key word in the learning language; on letter levels the letter name and a model word in the learning language. Every fed food is named in the learning language ("A banana!" / "Une banane !").

## Difficulty curve

| L | request | choices | support |
|---|---|---|---|
| 1 | color | 2 | picture-audio (color dot on the sign; the match wiggles on the hint) |
| 2 | color | 3 | picture-audio |
| 3 | first letter | 3 | picture-audio (the big letter on the sign; the match wiggles on the hint) |
| 4 | first letter | 3 | audio-only (no letter on the sign; the request is only spoken) |

- **Age 2:** start L1, min 1, max 2 (color only).
- **Age 5:** start L3, min 2, max 4.
- **Adaptive rules:** engine defaults.

## Leisure

Same learning-session rules as the other learning games: taps, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`. A star every fed request.

## Player journey from the map

Profile → Language House building → picker → `game-picker-letter-monster` → play → HUD back → map. Handles:

- Picker: `game-picker-animal-restaurant`, `game-picker-kitchen-orchestra`, `game-picker-letter-monster`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedLetterMonsterLevel(level)`, `getLetterMonsterInfo()` (phase, request, level, language, offered foods and which one matches, tries, stars, ready, page rectangles of each food and the monster).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Language House → picker card → feed the monster once → back to the map | 1 | e2e | both | `getLetterMonsterInfo` |
| AC-02 | Every round has exactly one matching food; the distractors never match in the round's language; no request repeats twice in a row | 1 | unit | @single-orientation | |
| AC-03 | No failure state: the machine has only `asking` and `eating`; any tap sequence reaches `fed` | 1 | unit | @single-orientation | |
| AC-04 | Age 2 color levels: the request names the color in Hebrew and the learning language; feeding names the food in the learning language (speech spy) | 1 | unit, e2e+seed | @single-orientation | `seedLetterMonsterLevel`, `getSpokenLines` |
| AC-05 | Age 5 letter levels: a wrong food gives "not this one", keeps the request, never reduces stars or the balance; the right food is eaten and gives a star | 1 | unit, e2e+seed | @single-orientation | `seedLetterMonsterLevel`, `getLetterMonsterInfo` |
| AC-06 | Adaptive steps: first-tap feeds are clean, retries are not; age 2 stays within L1-L2; age 5 starts at L3 | 1 | unit | @single-orientation | |
| AC-07 | Content validates; every food has a non-empty English and French word whose first letter matches its `initial` | 1 | unit | @single-orientation | |
| AC-08 | Food and monster tap targets are at least 64 CSS px in both orientations | 1 | e2e | both | `getLetterMonsterInfo` |
| AC-09 | Device check: touch, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused:** food art `public/art/foods/*.svg` (already in the manifest), HUD, Juice bursts, the existing `he.praise.0` clip.
- **New art** (gemini-4-hydrogen-medium, flat prop style): `public/art/props/monster-closed.svg` and `monster-open.svg` (`prop-monster-closed`, `prop-monster-open`). Procedural fallback. Same SVG contract as the other props.
- **Animation:** basic tweens only (`pressSquash`, a fly arc from the counter into the mouth, a munch squash, a gentle head shake, a hop back, Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `monster.intro.he` | he | המפלצת רעבה! בואי נאכיל אותה. | First request of a visit |
| `monster.askColor.<color>.he` | he | המפלצת רוצה משהו <color he>. | Color request |
| `monster.color.<color>.<lang>` | en / fr | e.g. Red! / Rouge ! | After the Hebrew color request |
| `monster.askLetter.he` | he | המפלצת רוצה משהו שמתחיל ב... | Letter request |
| `monster.letter.<L>.<lang>` | en / fr | e.g. B... like banana! / B... comme banane ! | After the Hebrew letter request |
| `monster.food.<food>.<lang>` | en / fr | e.g. A banana! / Une banane ! | Each fed food |
| `monster.notThis.he` | he | הממ, לא את זה. ננסה שוב? | A non-matching food |
| `he.praise.0` | he | existing clip | Each fed request |

### Pass 2 — polish

Only after Maor approves Pass 1: a decision on the monster (keep, replace with an approved character, or make it a character), polished art and munch animation, the picker card art and recorded Leda clips.

## Out of scope

- Shapes (age 2 feeds by color only in Pass 1), letter tracing, drag to feed, more foods.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** the monster is a simple unnamed prop (not a character); keep it, replace it with an approved character, or make it a character.
- **Open decision for the owner:** age 2 feeds by color only in Pass 1 (shapes later).
- **Open decision for the owner:** letter requests use the initial letter of the food's word in the round's language (French œuf counts as O).
- **Open decision for the owner:** a non-matching food gets a gentle "not this one" and the request stays; it is a non-clean adaptive trial.
- **Open decision for the owner:** Letter Monster is a third card in the Language House picker; Hebrew card name "מפלצת האותיות".

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

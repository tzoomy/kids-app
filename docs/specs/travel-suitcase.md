# `travel-suitcase` — Travel Suitcase

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-14): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea is in `docs/WORLDS.md` (Language House, 2. Travel Suitcase, stage P1). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

An open suitcase waits in the Language House, with travel items laid out next to it. A voice asks in the learning language, English or French ("Put the hat in the suitcase!" / "Mets le chapeau dans la valise !"). The child taps (or, at age 5, drags) the item, and it flies into the case. When the case is full it hops shut with a celebration, and a new trip starts. There is **no failure state**: another item is named, wiggles, stays out, and the request is repeated.

## Learning goals

- **Age 2:** clothes and object words in English or French, and understanding "put the…".
- **Age 5:** two items in one request, colour descriptions ("the blue hat") and negation ("a hat, but not the red one"), as `docs/WORLDS.md` suggests for the advanced stage.

## World and why

- **World:** Language House (`language-house`), the world `docs/WORLDS.md` names. It is reached through the Language House game picker as a third card, after Animal Restaurant and Kitchen Orchestra.
- **Why:** Language House is for understanding words and requests in English and French (`docs/WORLDS.md`, Language House, 2. Travel Suitcase).
- **Language:** each round follows the parent's language setting (English, French, or both alternating per round), like Animal Restaurant. Hebrew is used for the navigation shell, the intro and praise.

## Mechanic

**Scene.** The Language House background (`language-house-bg-landscape` / `-portrait`), the existing open suitcase in two layers (`suitcase-back` behind the packed items, `suitcase-front` in front) and `extra.choiceCount` items on the floor next to it (in portrait, under it). Every item is a tap target of at least 64 CSS px in both orientations.

**Items** (all reused art, content `items`, each with Hebrew, English and French names including the article): hat, shoes, sunglasses, ball, book, coat, shirt, socks, bottle, toothbrush, teddy, umbrella. Five of them come in three colours (art variants): hat (red, yellow, blue), shoes (blue, red, yellow), ball (yellow, red, blue), coat (yellow, red, blue), shirt (red, yellow, blue).

**Requests** (per level, `extra.request`):

- `noun`: "Put the hat in the suitcase!" One target among the choices.
- `two`: "Put the hat and the socks in the suitcase!" Two targets in either order; the request is done when both are in.
- `attribute`: "Put the blue hat in the suitcase!" The choices are the item's three colours plus one other item.
- `negation`: "Put a hat in the suitcase, but not the red one!" The choices are the item's three colours plus one other item; either other colour is right.

**State machine** (pure, `src/games/travelSuitcase/suitcaseMachine.ts`, no Phaser): phases `asking` and `closing`. **There is no failure phase.** `pick(choiceId)`:

- A target that is not packed yet: `packed`. The item flies into the case and is named in the learning language. When it is the last target of the request: `request-done`, then the next request, or `closing` after the case's last request (`extra.requestsPerCase`).
- Any other choice: `other`. It wiggles, is named in the learning language, stays out, and the request is repeated. The try is counted; nothing is lost.
- An item that is already packed, or any pick while `closing`: `busy`.

**Input.** Age 2 taps; precise dragging is never required (`docs/WORLDS.md`). Age 5 can tap or drag an item onto the case; dropping anywhere over the case counts as a pick.

**Stars.** One star for each full case. The case hops shut (a squash and hop of both layers; no new closed-case art in Pass 1), and a new case starts with new items. A request never repeats the previous one.

**Adaptive trials.** Each request is one trial (`itemId` = the requested item id, with its colour for attribute and negation), `firstTryCorrect` = no `other` pick on that request, `hinted` = the idle hint fired.

**Idle hint.** After the track's `hintDelayMs` without input: on `picture-audio` levels a right item pulses and the request is repeated; on `audio-only` levels only the request is repeated.

**Leave.** The HUD back button returns to the map at any time.

## Difficulty curve

| L | request | choices | requests per case | support |
|---|---|---|---|---|
| 1 | noun | 2 | 3 | picture-audio |
| 2 | noun | 3 | 3 | picture-audio |
| 3 | two | 4 | 2 | picture-audio |
| 4 | attribute | 4 | 3 | picture-audio |
| 5 | negation | 4 | 3 | audio-only |

- **Age 2:** start L1, max L2 (one item out of two, then three, by touch).
- **Age 5:** start L3, min 1, max 5.
- **Adaptive rules:** engine defaults.

## Leisure

Same learning-session rules as the other learning games: taps, drags, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`.

## Player journey from the map

Profile → tap the Language House building → picker (Travel Suitcase card) → play → HUD back → map. Handles:

- Map: `getBuildingHit('language-house')`; picker: `game-picker-travel-suitcase`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedSuitcaseLevel(level)`, `getSuitcaseInfo()` (phase, request kind, level, language, the right choice ids, and the page rectangles of the choices and the case).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Language House → picker card → pack the asked-for item → back to the map | 1 | e2e | both | `getBuildingHit`, `getSuitcaseInfo` |
| AC-02 | Noun request: the asked-for item is packed and named in the learning language; another item is named, stays out, keeps the request and never reduces stars or the balance | 1 | unit, e2e+seed | @single-orientation | `getSuitcaseInfo`, `getSpokenLines` |
| AC-03 | Two-item request: both targets in either order complete it; a packed item cannot be packed again | 1 | unit, e2e+seed | @single-orientation | `seedSuitcaseLevel`, `getSuitcaseInfo` |
| AC-04 | Attribute and negation: only the named colour is right for an attribute request; any other colour of the item is right for a negation request | 1 | unit | @single-orientation | |
| AC-05 | No failure state: only `asking` and `closing`; every pick sequence keeps the case completable and never removes a packed item or a star; a full case gives one star | 1 | unit, e2e+seed | @single-orientation | `getSuitcaseInfo` |
| AC-06 | Adaptive steps: a request is clean only with no other pick and no hint; age 2 stays within L1–L2, age 5 starts at L3 | 1 | unit | @single-orientation | |
| AC-07 | Language: requests and names follow the round's learning language (EN or FR); the intro is Hebrew | 1 | unit, e2e+seed | @single-orientation | `seedLanguageSetting`, `getSpokenLines` |
| AC-08 | Content validates: every item has art, and Hebrew, English and French names; every colour variant has art and EN/FR phrases; every level is satisfiable | 1 | unit | @single-orientation | |
| AC-09 | Dragging an item onto the case packs it (age 5) | 1 | e2e+seed | @single-orientation | `getSuitcaseInfo` |
| AC-10 | Item and case targets are at least 64 CSS px and on screen in both orientations | 1 | e2e | both | `getSuitcaseInfo` |
| AC-11 | Device check: touch, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused (no new art):** `suitcase-back`, `suitcase-front`, the 12 item SVGs and their colour variants under `public/art/items/`, the Language House background, the `packAndBounce` motion and `ANIM_PROFILE.suitcase` (`src/anim/sortPackMotion.ts`, made for this game), the `caseLeather` palette, HUD, Juice bursts, and the existing praise clip.
- **No characters.** Nobody is on screen; the request is a voice. A packing character from the existing cast is Pass 2 (pending decision).
- **Animation:** basic tweens only (`pressSquash`, `packAndBounce`, a wiggle, `popIn`, the case hop at the end, Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `suitcase.intro.he` | he | בואי נארוז את המזוודה לטיול! | First request of a visit |
| `suitcase.req.<kind>.<id>.<lang>` | en / fr | Put the hat in the suitcase! / Mets le chapeau dans la valise ! | Each request, hint |
| `suitcase.name.<id>.<lang>` | en / fr | The hat! / Le chapeau ! | `packed` |
| `suitcase.other.<id>.<lang>` | en / fr | Oh, the ball! / Oh, le ballon ! | `other` (then the request again) |
| `suitcase.closed.he` | he | המזוודה מוכנה! יוצאים לטיול! | Full case |
| `he.praise.0` | he | existing clip | Full case (star) |

### Pass 2 — polish

Only after Maor approves Pass 1: a packing character from the existing cast, a closed-case frame and latch animation, trip themes (beach, snow, picnic), the picker card art and recorded Leda clips.

## Out of scope

- Trip themes, counting items, sorting items by type, characters, timers.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** placement in the Language House picker as a third card (the world `docs/WORLDS.md` names).
- **Open decision for the owner:** no character on screen in Pass 1 (the voice asks); a packing character from the existing cast in Pass 2.
- **Open decision for the owner:** the item list and colours, all reused art, with no new drawings.
- **Open decision for the owner:** age 2 stays within one-of-two and one-of-three by touch (L1–L2); age 5 starts on two-item requests (L3), then colour, then negation.
- **Open decision for the owner:** another item is named and stays out (no "wrong" sound); one star per full case; the case "closes" with a hop rather than new closed-case art.
- **Open decision for the owner:** the Hebrew card name "מזוודת הטיול" and a placeholder card; the picker sizes its cards by the number of games (the same change as Word Train #78).

## Changelog

- `2026-11-14` — created (draft, Pass 1 built under continuous-development mode) — substantive

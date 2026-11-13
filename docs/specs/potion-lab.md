# `potion-lab` — Potion Lab

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-13): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Science World, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A big mixing bowl stands on a lab table with three paint pots (red, yellow, blue). The child taps two pots, the colors pour into the bowl, it swirls, and the new color appears and is named. There is **no failure state**: every mix makes a color and is celebrated. Age 2 mixes freely. Age 5 gets a request ("make green") and mixes until the bowl shows it; a different color is still named and praised, and the request stays.

## Learning goals

- **Age 2:** cause and effect ("two colors make a new color") and color words, heard in Hebrew and the learning language.
- **Age 5:** which two primaries make orange, green and purple; plan two steps toward a goal; the color words in English or French.

## World and why

- **World:** Science World (`science-world`, separate map area: pending Maor decision).
- **Why:** Science World is for simple experiments with cause and effect and no failure (`docs/WORLDS.md`, Science World, Potion Lab).

## Mechanic

**Scene.** A plain lab background (procedural: a pale blue wall and a wooden table), the mixing bowl in the middle, and three paint pots in a row (in portrait, under the bowl). Every pot and the bowl is a tap target of at least 64 CSS px.

**Colors.** Pass 1 uses only the existing colouring palette hexes (`leisure-colouring.json` `palette`). Primaries: `red`, `yellow`, `blue`. Mix table (order does not matter):

| A | B | Result |
|---|---|---|
| red | yellow | orange |
| red | blue | purple |
| yellow | blue | green |
| X | X (same pot twice) | X (the same color, "more red!") |

**State machine** (pure, `src/games/potionLab/potionMachine.ts`, no Phaser):

- State: the first poured color (or none), the bowl color (or empty), the request (or none) and the tries on that request.
- Phases: `pouring` (0 or 1 color in the bowl) and `mixed` (a result is shown). **There is no failure phase.**
- Tap a pot with an empty bowl: event `poured` (the bowl shows that color).
- Tap a second pot: event `mixed` with the result from the table. With a request: `matched` if the result is the requested color, otherwise `mixed-other` (named and praised, then a gentle Hebrew line repeats the request; the try is counted).
- Taps during the short mix animation are ignored (event `busy`). After the result is shown and named, the bowl empties for the next mix.

**Free mode** (`extra.mode: "free"`): every mix is celebrated and named; a star every `extra.mixesPerStar` mixes (default 3).
**Request mode** (`extra.mode: "request"`): the scene asks for a secondary color (orange, green or purple; never the same one twice in a row). A `matched` mix gives a star, a celebration and a new request.

**Adaptive trials.** Free mode: each mix is one trial, `itemId` = the result color, always clean (exposure). Request mode: each request is one trial, `itemId` = the requested color, `firstTryCorrect` = matched on the first mix, `hinted` = the hint fired.

**Idle hint.** After the track's `hintDelayMs` with no tap: in free mode one pot pulses; in request mode on `support: "picture-audio"` levels the two right pots pulse and the request is repeated; on `audio-only` levels only the request is repeated.

**Naming** (`extra.naming`): `"he+learning"`: the result is named in Hebrew, then in the round's learning language (English or French; with `both`, the language follows the existing per-round rule). Default for every level (pending decision: Hebrew plus the active learning language, not all three).

**Leave.** The HUD back button returns to the map at any time.

## Difficulty curve

| L | mode | support |
|---|---|---|
| 1 | free | picture-audio |
| 2 | request | picture-audio (the target color is shown as a swatch next to the bowl; the hint pulses both right pots) |
| 3 | request | picture-audio (swatch shown, no pot pulse) |
| 4 | request | audio-only (the request is only spoken, no swatch) |

- **Age 2:** start L1, max L1 (free mixing only).
- **Age 5:** start L2, min 1, max 4.
- **Adaptive rules:** engine defaults.

## Leisure

Same learning-session rules as the other learning games: taps, listening and celebrations count; nothing ever reduces the balance. `earnsLeisure: true`.

## Player journey from the map

Profile → tap the Science World building → Science World picker (Potion Lab card) → play → HUD back → map. Handles:

- Map: `getBuildingHit('science-world')`; picker: `game-picker-potion-lab`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedPotionLevel(level)`, `getPotionInfo()` (phase, bowl color, request, level, language, the page rectangles of the pots and the bowl).

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Science World → picker card → mix two colors → back to the map | 1 | e2e | both | `getBuildingHit`, `getPotionInfo` |
| AC-02 | The mix table is symmetric and complete for the three primaries; the same pot twice keeps its color | 1 | unit | @single-orientation | |
| AC-03 | No failure state: the machine has only `pouring` and `mixed`; every tap sequence keeps a request reachable | 1 | unit | @single-orientation | |
| AC-04 | Free mode (age 2): every mix is named in Hebrew and in the learning language (speech spy) | 1 | unit, e2e+seed | @single-orientation | `seedPotionLevel`, `getSpokenLines` |
| AC-05 | Request mode (age 5): a matched mix gives a star and a new request; a different mix is named, never reduces stars or the balance, and the request stays | 1 | unit, e2e+seed | @single-orientation | `seedPotionLevel`, `getPotionInfo` |
| AC-06 | Adaptive steps: free mixes are clean trials; request trials are clean only on a first-try match; the level rises after clean trials and drops after misses; age 2 stays at L1, age 5 starts at L2 | 1 | unit | @single-orientation | |
| AC-07 | Content validates; every color has Hebrew, English and French names that are not empty | 1 | unit | @single-orientation | |
| AC-08 | Pot and bowl tap targets are at least 64 CSS px in both orientations | 1 | e2e | both | `getPotionInfo` |
| AC-09 | Device check: touch, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused:** colouring palette hexes; HUD; Juice bursts; existing praise clip.
- **New art** (small, own drawings, gemini-4-hydrogen-medium): `public/art/props/paint-pot.svg` (`prop-paint-pot`) and `public/art/props/mixing-bowl.svg` (`prop-mixing-bowl`). The paint and the liquid are drawn procedurally on top in the palette color, so one pot SVG serves every color. Procedural fallback for both. Same SVG contract as the other props (outline `#3B2A22` about 6 px, no gradients, filters, text or rasters, under 15 KB).
- **No characters.**
- **Animation:** basic tweens only (`pressSquash`, a pour arc, a swirl rotation, `popIn`, Juice bursts).
- **Voice** (device TTS via `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `potion.intro.free.he` | he | בואי נערבב צבעים! לחצי על שני סירים. | First mix of a visit, free |
| `potion.intro.request.he` | he | בואי נכין צבע חדש! | First request of a visit |
| `potion.request.<color>.he` | he | אפשר להכין <color he>? | Each request (then the color word in the learning language) |
| `potion.color.<color>.<lang>` | he / en / fr | the color name | Each result |
| `potion.tryAgain.he` | he | איזה יופי! ועכשיו ננסה להכין <color he>. | `mixed-other` |
| `he.praise.0` | he | existing clip | `matched`, free-mode star |

### Pass 2 — polish

Only after Maor approves Pass 1: a lab background, polished pots, a pour/fizz animation, the picker card art and recorded Leda clips.

## Out of scope

- White or black pots (tints and shades), three-color mixes, drag-to-pour, characters.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** color naming in Hebrew plus the active learning language (not all three languages).
- **Open decision for the owner:** three primaries only in Pass 1 (no white/black, no tints).
- **Open decision for the owner:** age 2 stays in free mixing (max L1); age 5 starts on requests (L2).
- **Open decision for the owner:** a mismatched mix in request mode is praised and named, and the request stays (no "wrong" sound).
- **Open decision for the owner:** a star every 3 free mixes.

## Changelog

- `2026-11-13` — created (draft, Pass 1 built under continuous-development mode) — substantive

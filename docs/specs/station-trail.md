# `station-trail` — Station trail inside each world

Status: **draft — pending owner approval** (the idea was approved by Maor on 2026-11-13, `docs/WORLDS.md` "Infrastructure (approved ideas)" item 2; the details below are pending owner review).
Pass in progress: **1** (set by the lead developer on 2026-11-13 for the Pass-1 implementation; the spec itself is not approved yet, so everything below may still change).

## Summary

Inside a world, the games are shown as **stations on a trail**. A station whose game the child has already played through gets a **star**. One station, the **suggested next game**, pulses gently. There are **no locks**: every station is always tappable and opens its game. It is not a learning game: it shows progress and nudges the next choice. It reuses the existing game picker (`src/ui/picker/`) and the adaptive state (`src/core/adaptive`, `src/core/storage`); it adds no persistence and no engine.

## Learning goals

Not a learning game.

- **Age 2:** Sees a star on games she has played and a gentle pulse on a suggested game. No reading needed.
- **Age 5:** The same.

## World and why

- **World:** every world that has games (Language House, Number Garden, Nature Lab, Art Studio, and later worlds). Leisure Corner is out of scope (see Out of scope).
- **Why:** `docs/WORLDS.md`, "Infrastructure (approved ideas)", item 2 ("Station trail inside each world"). Stars show visible progress; the pulse guides without forbidding. Same for both ages; the suggestion follows each girl's own adaptive state.

## Mechanic

- **Station list (data-driven).** A world's stations are the games of the **game registry** (`WORLD_GAMES` in `src/ui/picker/pickerModel.ts`: scene key, card art key, label key) whose content JSON (`src/content/games/<id>.json`) says `"world": "<world-id>"`. The trail code holds no list of games or worlds. Station order is registry order. Adding a game to a world therefore means one registry entry and one content JSON (and its Hebrew label); the trail needs no change. A registry game without content (so without a world) is on no trail.
- **Star (completed).** A station is *completed* when the active profile's stored skill state for that game shows progress: for the skill keys `<world>.<gameId>.*` (one per language), either the trials recorded across all languages reach the game's `trialsPerRound` (one full round played), or any language's level is above the active age track's start level. This reads `kids-app-adaptive:<profileId>` through `AdaptiveStore`; nothing new is stored. A game whose content has no adaptive block is never completed.
- **Pulse (suggested next game).** Exactly one station is suggested whenever the world has at least one station:
  1. the first **uncompleted** station in trail order;
  2. if every station is completed, the **least recently played** one (oldest `lastPlayedDay` across its languages; ties go to trail order), so the suggestion rotates through the games.
  The adaptive engine has no cross-game suggestion API today (it selects items inside one game), so the suggestion is derived from the same stored state. If the engine later gains such an API, the model reads it first and keeps this as the fallback.
- **No locks.** Every station is a real button, always enabled, and opens its game, whether it is completed, suggested, or neither.
- **Entry rule.** A world building tap opens the **trail picker** when the world has **2 or more** stations. A world with **exactly one** station keeps its direct entry (today: Number Garden → Sorting Beds, Nature Lab → Who's Hiding?). A world with no stations does nothing new (Art Studio stays locked). The first game added to a one-game world turns its building into a trail picker with no further change.
- **Same for both ages.** The same model and the same UI; the active profile's own skill state and age track drive the star and the pulse. Profiles never share state.
- **Visuals (Pass 1 placeholders).** The existing picker cards become stations on a dotted trail line. The star is a CSS badge on the card corner. The pulse is a CSS ring animation on the card plus a small marker, switched off under `prefers-reduced-motion: reduce` (the ring stays static, so the suggestion is still visible). Card art is existing art only.
- **Leaving.** Closing the picker or finishing a game returns to the map; reopening the world rebuilds the trail from the current state.

## Difficulty curve

Not applicable (no adaptive levels of its own; it only reads the games' adaptive state).

## Leisure

No effect on leisure. Opening a station by the trail earns and costs exactly what opening the game directly does.

## Player journey from the map

Profile → tap a world building on the map → the trail picker opens (worlds with 2+ games) → tap a station → the game opens → exit to the map.

- Map building hit target: `getBuildingHit('language-house')` (the only world with 2+ games today).
- `data-testid`s (DOM, all existing handles are kept):
  - `game-picker-<gameId>`: the station card (a `<button>`, always enabled). Existing ids; the leisure picker ids are unchanged.
  - `station-trail`: the trail container (the `.picker-cards` element of a world picker).
  - `station-star-<gameId>`: the star badge, present only on a completed station.
  - `station-pulse-<gameId>`: the pulse marker, present only on the suggested station (exactly one per trail).
  - `game-picker-close`, `hud-back`: existing.
- The card's `aria-label` is its Hebrew name, plus `, הושלם` when completed and `, מומלץ` when suggested. The card also carries `data-completed="true|false"` and `data-suggested="true|false"` for tests.
- Seed and read hooks under `?e2e=1` (seed or read only): the existing `seedRestaurantLevel`, `seedOrchestraLevel`, `seedSortingLevel`, `seedHidingLevel`, `getBuildingHit`, `getActiveScenes`. **No new hook.**

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Language House building → trail picker → tap a station that is **not** the suggested one → its game opens → exit to the map | 1 | e2e | both | `getBuildingHit`, `getActiveScenes` |
| AC-02 | Star rule: a game is completed when trials across its languages reach `trialsPerRound`, or a level is above the track start; otherwise not; a game without an adaptive block never | 1 | unit | @single-orientation | |
| AC-03 | A completed game shows its star on its station (and no other station does); the star is absent on a fresh profile | 1 | e2e+seed | @single-orientation | `seedRestaurantLevel` |
| AC-04 | Suggestion: the first uncompleted station in trail order | 1 | unit | @single-orientation | |
| AC-05 | Suggestion when all stations are completed: the least recently played, ties by trail order; an empty trail suggests nothing | 1 | unit | @single-orientation | |
| AC-06 | Exactly one station pulses, and it follows the seeded progress (restaurant completed → orchestra pulses; fresh → restaurant pulses) | 1 | e2e+seed | @single-orientation | `seedRestaurantLevel` |
| AC-07 | No locks: every station is enabled in every state (fresh, partial, all complete) | 1 | unit | @single-orientation | |
| AC-08 | In the browser every station button is enabled, including a completed one and the suggested one, and tapping a completed station opens its game | 1 | e2e+seed | @single-orientation | `seedRestaurantLevel`, `getActiveScenes` |
| AC-09 | Data-driven: the station list of a world is computed from the registry plus content worlds; adding a registry entry whose content is in that world adds a station, and moving a game's content to another world moves its station, with no trail-code change | 1 | unit | @single-orientation | |
| AC-10 | Entry rule: 0 stations → none, exactly 1 → direct entry to that game, 2 or more → trail picker | 1 | unit | @single-orientation | |
| AC-11 | Single-game worlds are unchanged: Number Garden and Nature Lab buildings open Sorting Beds and Who's Hiding? directly (no picker) | 1 | e2e | @single-orientation | `getBuildingHit`, `getActiveScenes` |
| AC-12 | Same for both ages, per profile: the age-2 and age-5 profiles use the same model; the suggestion and stars follow each profile's own state, and one profile's progress never shows on the other | 1 | unit | @single-orientation | |
| AC-13 | Real profiles: age-2 and age-5 profiles each see the trail; progress seeded for one does not show for the other | 1 | e2e+seed | @single-orientation | `seedRestaurantLevel` |
| AC-14 | Smoke at `1280x800` and `800x1280`: stations are at least 64 CSS px, inside the viewport, do not overlap, and the trail container is visible | 1 | e2e | both | |
| AC-15 | Accessible labels: the star and pulse state is in the card's `aria-label`; under `prefers-reduced-motion: reduce` the pulse marker is still present and has no running animation | 1 | e2e | @single-orientation | |
| AC-16 | The Leisure Corner picker is unchanged: no star, no pulse, no trail attributes | 1 | e2e | @single-orientation | |
| AC-17 | Device check: touch, rotation with the trail open, visuals (star readable, pulse gentle, not distracting) | 1 | device | both | |

## Art, animation, and audio

### Pass 1 — working game

- **Assets:** none new. Cards use the existing picker art (`resolvePickerAsset`); Sorting Beds and Who's Hiding? cards use existing scene backgrounds (`public/art/scenes/number-garden/bg-landscape.svg`, `public/art/scenes/hiding/bg-landscape.svg`) as placeholders until Gemini supplies card art. Their asset keys (`picker-card-sorting-beds`, `picker-card-who-is-hiding`) resolve through the manifest first, as the other cards do.
- **Star, pulse, trail line:** CSS only (placeholders). **Open decision for the owner:** polished star and pulse art (Pass 2).
- **Layout:** the existing card grid, now sized for N cards (`--picker-count`); with 2 cards it renders exactly as before (4:5 cards, at least 64 CSS px). **RTL:** Hebrew chrome, first station on the right in landscape and on top in portrait.
- **Animation:** one CSS keyframe (`station-pulse`); disabled under `prefers-reduced-motion`.
- **Voice:** none. No new line, no new clip.
- **World and PWA wiring:** no new `AppScreen`; the map building tap calls the registry-driven entry rule. `worlds.json` is unchanged (`entryGameId` stays and is only a fallback hint; the registry decides).

### Pass 2 — polish

Only after Maor approves Pass 1: art for the star, the pulse and the trail path; card art for Sorting Beds and Who's Hiding?; an optional voice line for the suggestion. Not part of Pass 1.

## Out of scope

- A trail in the Leisure Corner picker (leisure games are free play and have no progress state).
- Locks, gating, or hiding any game.
- New persistence, a new adaptive API, or any change to leveling rules.
- A cross-game recommendation engine beyond the rule above.
- New art and new voice clips (Pass 2).
- Cards with real art for Sorting Beds and Who's Hiding? (placeholders only).

## Open decisions for the owner

- **Open decision for the owner:** what counts as "completed" (default above: one full round played, or a level above the track start). Alternatives: reaching a mastery level, or any single trial.
- **Open decision for the owner:** the suggestion when every game is complete (default: the least recently played; alternative: the first station).
- **Open decision for the owner:** one-game worlds keep direct entry (default) versus always showing a one-station trail.
- **Open decision for the owner:** the Leisure Corner stays without a trail (default).

## Changelog

- `2026-11-13` — created from the approved idea; details pending owner review — substantive

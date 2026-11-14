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

- **Station list (data-driven).** A world's stations are the games of the **game registry** (`WORLD_GAMES` in `src/ui/picker/pickerModel.ts`: scene key, card art key, label key) whose content JSON (`src/content/games/<id>.json`) says `"world": "<world-id>"`. The trail code holds no list of games or worlds, and `MapScene` holds no per-world picker branch or per-world list (the Number Garden, Nature Lab and Science World lists are folded into `WORLD_GAMES`). Station order is registry order. A registry game without content (so without a world) is on no trail.
- **Stations on main today** (registry order, from `WORLD_GAMES` plus content): Language House 4 (Animal Restaurant, Kitchen Orchestra, Letter Monster, Travel Suitcase), Number Garden 2 (Sorting Beds, Balloon Pop), Nature Lab 2 (Who's Hiding?, Seed to Flower), Science World 3 (Potion Lab, Sink or Float, Magic Magnet). Art Studio and Leisure Corner have none (Leisure Corner is out of scope).
- **How to add a game (one line).** Append one `WORLD_GAMES` entry (scene key, picker card art key, label key) in `src/ui/picker/pickerModel.ts`, ship its content JSON with `"world": "<world-id>"`, and add the Hebrew card label under `gamePicker` in `he.json`; the station appears with no trail or `MapScene` change. Games of open PRs whose scenes are not on main yet (Shadow Match, Word Train, Sink or Float, Magic Magnet, Number Bridge, Travel Suitcase) are added by their own PR with that one entry; no placeholder entry is added before the scene exists, because the registry would then name a scene that does not build.
- **Star (completed).** A station is *completed* when the active profile's stored skill state for that game shows progress: for the skill keys `<world>.<gameId>.*` (one per language), either the trials recorded across all languages reach the game's `trialsPerRound` (one full round played), or any language's level is above the active age track's start level. This reads `kids-app-adaptive:<profileId>` through `AdaptiveStore`; nothing new is stored. A game whose content has no adaptive block is never completed.
- **Pulse (suggested next game).** Exactly one station is suggested whenever the world has at least one station:
  1. the first **uncompleted** station in trail order;
  2. if every station is completed, the **least recently played** one (oldest `lastPlayedDay` across its languages; ties go to trail order), so the suggestion rotates through the games.
  The adaptive engine has no cross-game suggestion API today (it selects items inside one game), so the suggestion is derived from the same stored state. If the engine later gains such an API, the model reads it first and keeps this as the fallback.
- **No locks.** Every station is a real button, always enabled, and opens its game, whether it is completed, suggested, or neither.
- **Entry rule.** A world building tap opens the **trail picker** when the world has **2 or more** stations (today: Language House 4, Number Garden 2, Nature Lab 2, Science World 3). A world with **exactly one** station enters that game directly, with no picker (no current open world; covered by the AC-10 unit test; **pending Maor decision**, alternative: always show a one-station trail). A world with **no** stations (`worldEntry` kind `none`) opens the empty **coming-soon picker** (`game-picker-empty`, the world's empty text, e.g. `scienceWorldEmpty` for Science World) and plays the coming-soon line; a locked world (Art Studio) keeps its locked toast. The first game added to a one-game world turns its building into a trail picker with no further change, and the first game added to an empty world turns its coming-soon picker into a direct entry.
- **Same for both ages.** The same model and the same UI; the active profile's own skill state and age track drive the star and the pulse. Profiles never share state.
- **Visuals (Pass 1 placeholders).** The existing picker cards become stations on a dotted trail line. The star is a CSS badge on the card corner. The pulse is a CSS ring animation on the card plus a small marker, switched off under `prefers-reduced-motion: reduce` (the ring stays static, so the suggestion is still visible). Card art is existing art only.
- **Leaving.** Closing the picker or finishing a game returns to the map; reopening the world rebuilds the trail from the current state.

## Difficulty curve

Not applicable (no adaptive levels of its own; it only reads the games' adaptive state).

## Leisure

No effect on leisure. Opening a station by the trail earns and costs exactly what opening the game directly does.

## Player journey from the map

Profile → tap a world building on the map → the trail picker opens (worlds with 2+ games) → tap a station → the game opens → exit to the map.

- Map building hit target: `getBuildingHit('<world-id>')`, e.g. `language-house` (3 stations), `number-garden` (2), `nature-lab` (2). `science-world` has one game and is entered directly.
- `data-testid`s (DOM, all existing handles are kept):
  - `game-picker-<gameId>`: the station card (a `<button>`, always enabled). Existing ids; the leisure picker ids are unchanged.
  - `station-trail`: the trail container (the `.picker-cards` element of a world picker).
  - `station-star-<gameId>`: the star badge, present only on a completed station.
  - `station-pulse-<gameId>`: the pulse marker, present only on the suggested station (exactly one per trail).
  - `game-picker-close`, `hud-back`: existing.
- The card's `aria-label` is its Hebrew name, plus `, הושלם` when completed and `, מומלץ` when suggested. The card also carries `data-completed="true|false"` and `data-suggested="true|false"` for tests. Tests that assert a label must allow those suffixes (a regex or `toContain`, not an exact match on the plain name).
- Positions: the first station is on the right in landscape and on top in portrait (RTL); tests must work with 3 cards in Language House, not only 2.
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
| AC-09 | Data-driven: the station list of a world is computed from the registry plus content worlds; adding a registry entry whose content is in that world adds a station, and moving a game's content to another world moves its station, with no trail-code change. The real registry gives Language House 4 (animal-restaurant, kitchen-orchestra, letter-monster, travel-suitcase), Number Garden 2 (sorting-beds, balloon-pop), Nature Lab 2 (who-is-hiding, seed-to-flower), Science World 3 (potion-lab, sink-or-float, magic-magnet); no per-world picker list exists outside `WORLD_GAMES` | 1 | unit | @single-orientation | |
| AC-10 | Entry rule: 0 stations → none (the empty coming-soon picker opens), exactly 1 → direct entry to that game (no current open world; covered by the unit test), 2 or more → trail picker; the map entry path for `none` opens the empty picker with no cards | 1 | unit | @single-orientation | |
| AC-11 | Number Garden and Nature Lab each open a **2-station trail** (Sorting Beds + Balloon Pop; Who's Hiding? + Seed to Flower), and Science World opens a **3-station trail** (Potion Lab, Sink or Float, Magic Magnet), with the first station suggested; tapping a station opens its game. One-game direct entry is covered by the AC-10 unit test | 1 | e2e | @single-orientation | `getBuildingHit`, `getActiveScenes` |
| AC-12 | Same for both ages, per profile: the age-2 and age-5 profiles use the same model; the suggestion and stars follow each profile's own state, and one profile's progress never shows on the other | 1 | unit | @single-orientation | |
| AC-13 | Real profiles: age-2 and age-5 profiles each see the trail; progress seeded for one does not show for the other | 1 | e2e+seed | @single-orientation | `seedRestaurantLevel` |
| AC-14 | Smoke at `1280x800` and `800x1280`: the Language House stations (derived from the registry: Animal Restaurant, Kitchen Orchestra, Letter Monster, Travel Suitcase) and `game-picker-close` are at least 64 CSS px, inside the viewport, do not overlap, and the trail container is visible | 1 | e2e | both | |
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
- **World and PWA wiring:** no new `AppScreen`; the map building tap calls the registry-driven entry rule for every open world, with no `world.id` branch in `MapScene`. A small pure helper (`worldPickerOptions` in `src/worlds/worldTrail.ts`) turns a `WorldEntry` into the picker options: `none` → `{ games: [], title, emptyText }` (the Science World coming-soon picker from PR #73), `picker` → `{ stations, title }`, `direct` → no picker. `worlds.json` is unchanged (`entryGameId` stays and is only a fallback hint; the registry decides). The Leisure Corner keeps its own `LEISURE_PICKER_GAMES`.

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
- **Open decision for the owner:** one-game worlds keep direct entry (default) versus always showing a one-station trail. Today every open learning world has 2+ games, so the one-game rule is only exercised by the AC-10 unit test; pending Maor decision.
- **Open decision for the owner:** the Leisure Corner stays without a trail (default).

## Changelog

- `2026-11-13` — created from the approved idea; details pending owner review — substantive
- `2026-11-14` — Science World is a 3-station trail after Magic Magnet (#77) lands on main; AC-11 covers it. — substantive
- `2026-11-14` — Travel Suitcase (#84) is appended as the fourth Language House `WORLD_GAMES` station; AC-09 and AC-14 now describe 4 Language House stations, with e2e counts derived from the registry.
- `2026-11-14` — post-main-merge rework (Gemini review): Number Garden and Nature Lab now have 2 games each, so AC-11 is rewritten as 2-station trails; Science World is a 2-station trail after Sink or Float; one-game direct entry stays on the AC-10 unit test; `none` keeps the empty coming-soon picker; AC-09 lists the real stations (Language House 3, Number Garden 2, Nature Lab 2, Science World 1); AC-14 covers 3 stations plus the close button; added the "how to add a game" line and the `worldPickerOptions` helper; no new hook — substantive

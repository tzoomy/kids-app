# `seed-to-flower` — Seed to Flower

Status: **draft — pending owner approval**
Pass in progress: **1**

> Written by the Gemini expert under the team lead's continuous-development mode (2026-11-13): build without stopping, take reversible defaults, and list them as pending owner decisions. The idea itself is owner-approved (`docs/WORLDS.md`, Nature Lab §6, 2026-11-13). This spec and every default below still need Maor's approval; see [Open decisions for the owner](#open-decisions-for-the-owner) and `docs/PENDING-DECISIONS.md`.

## Summary

A seed sits in a soil mound in the Nature Lab meadow. The child taps the watering can and the sun, and the plant grows stage by stage (seed → sprout → bud → flower). When it blooms, a star flies to the counter and a new seed appears. There is **no failure state**: no tap is ever wrong in a way that costs anything, and every plant always reaches the flower. Age 2 plays free cause and effect; age 5 learns a simple order (water, then sun) and hears the stage names in the learning language (English or French).

## Learning goals

- **Age 2:** cause and effect: "I touch, the plant grows". Any tool grows the plant. Hears the word for the flower in the learning language when it blooms.
- **Age 5:** a two-step order (water first, then sun), the stages of growth (seed, sprout, bud, flower), and the stage names in English or French.

## World and why

- **World:** Nature Lab (`nature-lab`).
- **Why this game belongs there:** the Nature Lab goal is curiosity and cause and effect with exploration without failure (`docs/WORLDS.md`, "Nature Lab", §6 Seed to Flower, owner-approved idea 2026-11-13).

## Mechanic

**Scene.** The Who's Hiding? meadow background (`scene-hiding-bg-*`, reused), a soil mound with the plant in the middle, the watering can on one side and the sun on the other (both big tap targets, at least 64 CSS px; in portrait they sit under the plant).

**State machine** (pure, `src/games/seedFlower/seedFlowerMachine.ts`, no Phaser):

- State: the level's ordered list of stages, the current stage index, `watered` (ordered mode only), and whether the current growth step had an out-of-order tap.
- Phases: `growing` and `bloomed` only. **There is no failure phase**, and no tool tap ever lowers the stage.
- **Free mode** (`extra.order: "free"`): each tap on either tool grows the plant one stage (event `grew`; `bloomed` on the last stage).
- **Ordered mode** (`extra.order: "water-then-sun"`): water first (event `watered`; the soil darkens and the plant wiggles), then sun grows the plant one stage. Sun before water is not an error: nothing grows, the watering can pulses and a gentle Hebrew line says to water first (event `needs-water`); the step is marked out of order for the adaptive engine. Water again while already watered pulses the sun and a gentle Hebrew line says "now the sun" (event `needs-sun`); this is not marked.
- Taps while bloomed are ignored (event `resting`) until the next seed appears.

**One plant = one engine round.** Each growth step is one adaptive trial (`itemId` = the stage the plant grows into; `firstTryCorrect` = no out-of-order tap during the step; `hinted` = the idle hint fired during the step). With 4 stages a plant is 3 trials, the default `trialsPerRound`. At L1 (3 stages) a plant is 2 trials, so engine rounds and plants do not line up there: the scene reads the level and picks the language only when a new plant starts, so a plant never changes level or language mid-way, and a level change or language switch that falls mid-plant takes effect on the next plant.

**Bloom.** `yay` SFX, the learning session reports celebrating until the next seed, sparkle and confetti bursts, the star count goes up by one and is persisted, a star flies to the HUD star pill, the flower name is spoken in the round's language, and after a short pause a new seed starts (a new plant, possibly in the other language when the setting is `both`).

**Stage names.** On levels with `extra.naming: "all"`, the seed is named when the plant starts (after the intro on the first plant of a visit) and each new stage is named in the round's language ("A sprout!" / "Une pousse !"); on `"bloom"` levels only the flower is named.

**Idle hint.** After the track's `hintDelayMs` without a tap, the tool to use next pulses once (free mode: the watering can; ordered: the watering can, or the sun once watered) and the `hint` SFX plays. On the audio-only level (L5) nothing pulses; the order line is spoken instead. The hint marks the current step hinted.

**Leave.** The HUD back button returns to the map at any time; the learning session and the adaptive visit end.

- **Input mode per age:** tap only on both tracks (no drag in Pass 1).

## Difficulty curve

- **Levels** (`adaptive.levels`, game-specific levers in `extra`):

| L | stages | order | naming | support |
|---|---|---|---|---|
| 1 | seed, sprout, flower | free | bloom | picture-audio |
| 2 | seed, sprout, bud, flower | free | bloom | picture-audio |
| 3 | seed, sprout, bud, flower | free | all | picture-audio |
| 4 | seed, sprout, bud, flower | water-then-sun | all | picture-audio |
| 5 | seed, sprout, bud, flower | water-then-sun | all | audio-only (no pulse on the next tool) |

- **Age-2 start level:** L2.
- **Age-5 start level:** L4 (introduces the water-then-sun order and stage naming).
- **Min / max:** age 2: min 1, **max 3** (age 2 stays in free mode; see open decisions). Age 5: min 1, max 5.
- **Adaptive rules:** engine defaults (`upCleanStreak` 3, `downMisses` 2, `downWindow` 3, `trialsPerRound` 3, `maxChangesPerRound` 1). Free-mode steps are always clean, so age 2 moves up to L3 after one plant; an age-5 child who taps the sun first in two of three steps drops to the free L3.

## Leisure

Same learning-session rules as the other learning games (`LearningSession`): taps, listening, and the bloom celebration count as participation; nothing ever reduces the balance; balances never mix across profiles. `earnsLeisure: true`.

## Player journey from the map

Profile → tap the Nature Lab building → **Nature Lab game picker** (new: Who's Hiding? and Seed to Flower cards) → tap the Seed to Flower card → play → HUD back → map. Handles (frozen at approval):

- Map building hit target: `getBuildingHit('nature-lab')`
- Picker: `game-picker-who-is-hiding`, `game-picker-seed-to-flower`, `game-picker-close`
- HUD: `hud-back`, `hud-help`, `help-card`, `help-card-close`, `star-count`, `leisure-balance`
- Hooks under `?e2e=1`: `seedSeedFlowerLevel(level)` (seeds the persisted level for every language), `getSeedFlowerInfo()` (reads the plant state, the round language, and the page-pixel rectangles of the watering can, the sun and the plant), `getSpokenLines()`, `getBuildingHit()`, `getActiveScenes()`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Nature Lab building → picker card → grow one plant to a flower → back to the map; the Nature Lab picker still opens Who's Hiding? | 1 | e2e | both | `getBuildingHit`, `getSeedFlowerInfo` |
| AC-02 | No failure state: the machine has only `growing` and `bloomed`; from every reachable state every tool leads to a state from which the flower is reachable; the stage never goes down | 1 | unit | @single-orientation | |
| AC-03 | Free mode (age 2): either tool grows the plant one stage per tap, the sun first included | 1 | unit, e2e | @single-orientation | `getSeedFlowerInfo` |
| AC-04 | Ordered mode (age 5): sun before water does not grow the plant, gives the `needs-water` nudge line, and never reduces stars or the balance; water then sun grows one stage | 1 | unit, e2e+seed | @single-orientation | `seedSeedFlowerLevel`, `getSeedFlowerInfo`, `getSpokenLines` |
| AC-05 | Each growth step is one adaptive trial; an out-of-order step is not clean; the level rises after clean steps and drops after out-of-order steps | 1 | unit | @single-orientation | |
| AC-06 | A new age-2 profile starts at L2 and never leaves the free levels; a new age-5 profile starts at L4 | 1 | unit | @single-orientation | |
| AC-07 | Content validates; every stage has an English and a French name; the round language follows the language setting | 1 | unit | @single-orientation | |
| AC-08 | On a naming level each new stage is spoken in the round's language with line id `seed.stage.<stage>.<lang>` (speech spy) | 1 | e2e+seed | @single-orientation | `seedSeedFlowerLevel`, `getSpokenLines` |
| AC-09 | A bloom adds one star and a new seed starts | 1 | e2e | @single-orientation | `getSeedFlowerInfo` |
| AC-10 | Tool tap targets are at least 64 CSS px in both orientations | 1 | e2e | both | `getSeedFlowerInfo` |
| AC-11 | Device check: touch, rotation mid-game, audible device-TTS voice, visuals | 1 | device | both | |
| AC-12 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |

## Art, animation, and audio

### Pass 1 — working game

- **Reused art:** meadow background `scene-hiding-bg-landscape` / `scene-hiding-bg-portrait`; stems `flower-stem-small`, `flower-stem-large`; blooms `flower-bloom-daisy-yellow` (and the other existing blooms, picked per plant); `garden-bed-back` / `garden-bed-front` as the soil mound.
- **New art** (strictly needed props, own drawings; no suitable CC0/CC-BY asset matched the SVG contract): `public/art/props/seed.svg` (`prop-seed`), `public/art/props/sprout.svg` (`prop-sprout`), `public/art/props/flower-bud.svg` (`prop-flower-bud`), `public/art/props/watering-can.svg` (`prop-watering-can`), `public/art/props/sun.svg` (`prop-sun`). Each scene element also has a procedural fallback, so the game works before the art loads.
- **SVG contract:** warm palette, dark-brown outline `#3B2A22` about 6 px, no gradients, filters, `<text>`, external references or rasters, under 15 KB each.
- **No characters.** No new or existing character appears in Pass 1.
- **RTL:** reuses the existing Hebrew RTL HUD (`setRestaurantChrome`). Learning tokens are spoken only.
- **Animation:** basic tweens only (`popIn`, `pressSquash`, `wobble`, `hintPulse`, Juice bursts, a grow scale tween).
- **Voice table** (device TTS through `AudioManager.play({ lineId, lang, text })`; no new recordings):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `seed.intro.free.he` | he | בואי נגדל פרח! לחצי על המים או על השמש, וראי איך הוא גדל. | First plant of a visit, free levels |
| `seed.intro.ordered.he` | he | בואי נגדל פרח! קודם משקים במים, ואחר כך השמש מחממת. | First plant of a visit, ordered levels |
| `seed.help.he` | he | (`helpTextHe`) | Help button |
| `seed.needWater.he` | he | קודם מים! | Sun before water (ordered) |
| `seed.needSun.he` | he | עכשיו השמש! | Water while already watered (ordered) |
| `seed.stage.<stage>.<lang>` | en / fr | A seed! / Une graine ! · A sprout! / Une pousse ! · A bud! / Un bouton ! · A flower! / Une fleur ! | Plant start (seed) and each new stage on naming levels; flower only on bloom levels |
| `he.praise.0` | he | existing recorded clip | Every bloom |

- **World and PWA wiring:** Nature Lab keeps `entryGameId: who-is-hiding`, and its building now opens the station trail picker (Who's Hiding? and Seed to Flower, from `WORLD_GAMES` plus content `world: nature-lab`). New `AppScreen` `seed-flower` (not safe for a mid-game update).

### Pass 2 — polish

Only after Maor approves the finished Pass 1: polished plant-stage art and growth animation, a picker card picture, and recorded Leda clips for the voice table.

## Out of scope

- Drag (pouring water by dragging the can), weather changes, more plant kinds, characters reacting to the flower, a garden that keeps the grown flowers.
- Pass 2 (see above).

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** Nature Lab building now opens a game picker (Who's Hiding?, Seed to Flower) instead of opening Who's Hiding? directly.
- **Open decision for the owner:** age-2 ceiling at L3 (age 2 never gets the ordered mode), age-5 start at L4.
- **Open decision for the owner:** stages seed → sprout → bud → flower and their EN/FR words (sprout / pousse, bud / bouton).
- **Open decision for the owner:** free mode grows one stage per tap (3 taps to a flower at L2).
- **Open decision for the owner:** the build order of the 13 approved ideas (`docs/WORLDS.md`), here built early under the team lead's queue.

## Changelog

- `2026-11-13` — created (draft, Pass 1 built under continuous-development mode) — substantive
- `2026-11-13` — review fixes (#65): the seed is named at plant start on naming levels; L1 trial count documented; bloom reports celebrating — minor

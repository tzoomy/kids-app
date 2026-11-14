# who-lives-here — Who Lives Here?

Status: **approved** — approved for build by Maor (continuous mode, 2026-11-13).
Pass in progress: **1**

## Summary

In Who Lives Here? (`מי גר כאן?`), a friendly animal stands on the path and the child taps the home where it lives (pond, nest, tree hollow, burrow, doghouse, or beehive). Each correct tap walks the animal home with a warm reaction, a round is 3 animals, and a finished round earns a star. The child learns to match a creature to its habitat and picks up English and French animal and home words. The game sits in Nature Lab next to Who's Hiding?, and Nature Lab's building opens the three-station trail picker (Who's Hiding?, Seed to Flower, Who Lives Here?).

## Learning goals

- **Age 2:** Match an animal to its home out of 2 clearly different homes (a pond versus a tree, never two similar ones), with the animal spoken by name, a soft glow on the right home at the first level, and no failure: a wrong tap is met with a warm reaction and the animal simply tries again.
- **Age 5:** Choose among 3–4 homes, including look-alike pairs (a nest versus a tree hollow versus a beehive in the trees; a burrow versus a doghouse on the ground), from the animal's name or, at the top levels, a descriptive spoken clue ("I have feathers and I build a nest") with the English or French word for the home after each success.

## World and why

- **World** (Language House, Number Garden, Nature Lab, Art Studio, or Leisure Corner): Nature Lab (`nature-lab`, `מעבדת הטבע`).
- **Why this game belongs there:** `docs/WORLDS.md` (§ "Nature Lab → 2. Who Lives Here?") places it in Nature Lab as a game of its own: matching a creature to a habitat and animal vocabulary. In the station trail it is the third Nature Lab station, appended after Who's Hiding? and Seed to Flower (registry order); Who's Hiding? stays the first station.

## Mechanic

A round shows 2–4 homes (the level's `choiceCount`) in one row (two rows of two for 4 homes in portrait). The animals of the round come one at a time: the current animal stands on a grassy patch on the path at the bottom and the next ones wait off-stage (no decorative pile in Pass 1). For each animal:

1. Pop-in of the animal. The Hebrew line `habitat.ask.he` plays, then either the animal's name (EN or FR, noun levels) or its descriptive clue (EN or FR, riddle levels).
2. The child taps a home (one tap, no select step).
3. **Correct:** the animal walks to the home and settles in (`walkHome` / `settleInHome`), a sparkle burst and a happy sound play, then `habitat.correct.he` and the home word in the round language. The next animal comes.
4. **Wrong (no fail):** the tapped home shakes softly, home taps are locked for 400 ms (same lock as Sorting Beds), the right home pulses, the animal stays and `habitat.wrong.he` plays. The child can tap again; the first tap of a trial is the one the adaptive engine records. A wrong tap never ends the round and never reduces the leisure balance or stars. At levels with `extra.clue: 'after-miss'` the descriptive clue is spoken after the Hebrew wrong line.
5. After the last animal the round ends: confetti, one star, a short hold, and the next round starts (language may change at the round boundary).

Tapping the animal replays the request (a voluntary replay is never a hint). The back button leaves to the map; the help button opens the help card (`habitat.help.he`).

- **Idle hint (age 2 only, `hintMode: demonstrate`, 6 s):** the animal hops part of the way toward the right home, that home pulses with a sparkle, and the request line repeats; the trial is then marked hinted. Age 5 has no idle hint (`repeat-then-demonstrate`: help comes only after a miss).
- **Input mode per age:** tap-to-place for both ages (no drag), as in Sorting Beds. Tap targets are at least 64 CSS px.
- **Round composition:** the engine picks the first animal (`SkillSession.selectNextItem`, a known animal right after a level drop); the homes shown always include its home, then fill with distractor homes per the level's `distractor` (`far`: homes from a different family first; `near`: homes from the same family first). The remaining animals of the round are drawn from the animals whose home is on screen, preferring different homes. A round always has `trialsPerRound` (3) animals, so it lines up with the adaptive engine's rounds. With one animal per home in Pass 1, a round at 3–4 homes has 3 different animals, and at 2 homes (age 2) the third animal is a repeat of the first (never the same animal twice in a row).

## Difficulty curve

- **Levels** (8, levers `choiceCount`, `distractor`, `request`, `scaffold`, `support`, `extra.clue`):

| Level | Homes | Distractor homes | Request | Scaffold / support | Clue after a miss |
|---|---|---|---|---|---|
| 1 | 2 | far | animal name | right home glows softly | no |
| 2 | 2 | far | animal name | none | no |
| 3 | 3 | far | animal name | none | no |
| 4 | 3 | near | animal name | none | no |
| 5 | 3 | near | animal name | none | yes |
| 6 | 4 | near | animal name | none | yes |
| 7 | 4 | near | descriptive clue (`riddle`) | none | yes |
| 8 | 4 | near | descriptive clue (`riddle`) | `audio-only` (no text bubble) | yes |

- **Age-2 start level:** 1.
- **Age-5 start level:** 5 (three homes with a look-alike pair, a clue after a miss).
- **Min / max:** age 2: 1–4 (**ceiling at 4**, no riddles or 4 homes); age 5: 3–8.
- **Adaptive rules:** engine defaults (`docs/adaptive-engine.md`): `upCleanStreak: 3`, `downMisses: 2`, `downWindow: 3`, `trialsPerRound: 3`, `maxChangesPerRound: 1`. Age 2 changes level between rounds only; age 5 may change after a trial, shown from the next round. The skill key is `nature-lab.who-lives-here.<lang>`.

## Leisure

`earnsLeisure: true` (Nature Lab in `worlds.json`). The scene uses the shared `LearningSession` exactly as Sorting Beds and Who's Hiding? do: `start()` on create, a 1 s loop calling `tick(1)` and persisting, `reportInteraction()` on every home tap (right or wrong), replay and help, listening while a line plays, celebrating during a success reaction, `complete()` when a round ends, `exit()` on leaving. A hidden tab never earns. Mistakes never reduce the balance; balances are per profile and never mix. Time earning itself is paused behind `settings.timeEarning.enabled` (default off).

## Player journey from the map

Profile → tap the Nature Lab building on the map → the Nature Lab trail picker opens (three stations: Who's Hiding? first, Seed to Flower second, Who Lives Here? third; a close button stays on the map) → tap the Who Lives Here? card → `HabitatScene` opens with an iris transition → play a round → back button → map. Nature Lab is a 3-station trail built from `WORLD_GAMES` in registry order (Who's Hiding?, Seed to Flower, Who Lives Here?). Its `entryGameId` may stay `who-is-hiding` as a fallback hint and the default for helpers; the building opens the trail, not a game.

Handles (frozen at approval):

- Map building hit target: `getBuildingHit('nature-lab')`
- `data-testid`s: `game-picker-who-is-hiding`, `game-picker-seed-to-flower`, `game-picker-who-lives-here`, `game-picker-close`, `hud-back`, `hud-help`, `star-count`, `leisure-balance`, `prompt-bubble`, `help-card`, `help-card-close`.
- Seed and read hooks under `?e2e=1` (seed or read only; no game actions, no scene navigation):
  - `getHabitatInfo(): HabitatInfo | null` (read; types in `src/games/habitat/types.ts`): `level`, `lang`, `request` (`noun` or `riddle`), `textBubble` (false on the audio-only level), `ready`, `homes[]` (`id`, `family`, `count`, `glowing`, `hit` in page CSS px), `currentAnimal` (`id`, `homeId`, `tries`, `hinted`, `hit` in page CSS px) or `null`, `round` (`index`, `total`, `placed`).
  - `seedHabitatLevel(level)` (seed): writes the active profile's adaptive level for every language, call on the map before the game opens.
  - Existing: `getBuildingHit`, `getActiveScenes`, `getSpokenLines`, `seedBalanceSec`, `seedLanguageSetting`, `seedTimeEarningEnabled`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Nature Lab building → picker → Who Lives Here? card → one full round → exit to the map; the game opens only from the Nature Lab building and its card | 1 | e2e | both | `getBuildingHit`, `getHabitatInfo` |
| AC-02 | A correct tap walks the animal home: the home counts it, the next animal comes, and a finished round adds a star | 1 | e2e | @single-orientation | `getHabitatInfo` |
| AC-03 | A wrong tap is no failure: the animal stays, the right home is indicated, the child can retry and finish, and the leisure balance never drops | 1 | e2e | @single-orientation | `getHabitatInfo`, `seedBalanceSec` |
| AC-04 | Difficulty rises after 3 clean answers and drops after 2 misses in a window of 3, with the engine defaults; age 2 changes only between rounds | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level: age 2 seeded at level 3 with the language pinned (the level is per language) plays one clean round of 3 animals and the next round is level 4 | 1 | e2e+seed | @single-orientation | `seedHabitatLevel`, `seedLanguageSetting`, `getHabitatInfo` |
| AC-06 | High level plays: age 5 seeded at level 8 shows 4 homes, no text bubble, speaks the clue, and completes a round | 1 | e2e+seed | @single-orientation | `seedHabitatLevel`, `getHabitatInfo` |
| AC-07 | A new age-2 profile starts at level 1 and a new age-5 profile at level 5, in both languages; age 2 is capped at level 4 | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues while the child takes part, never drops on wrong taps, never mixes across profiles | 1 | unit | @single-orientation | |
| AC-09 | Content is selected and validated as specified: schema-valid JSON, six animals each with a home, EN and FR names, clues and home names, levels within the schema, round language follows the language setting | 1 | unit | @single-orientation | |
| AC-10 | Voice lines request the right line id and language (speech spy): the Hebrew ask line, then the animal name or clue in the round language; after a correct tap the Hebrew line and the home word; after a wrong tap the Hebrew retry line | 1 | e2e | @single-orientation | `getSpokenLines`, `seedLanguageSetting`, `getHabitatInfo` |
| AC-11 | Smoke: the game is playable at `1280x800` and `800x1280`, homes and animal are inside the viewport and every tap target is at least 64 CSS px | 1 | e2e | both | `getHabitatInfo` |
| AC-12 | The game works offline | 1 | e2e | @single-orientation | `getHabitatInfo` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch, rotation mid-game, audible voice, visuals | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | The Nature Lab building opens a 3-station trail (Who's Hiding? first, Seed to Flower, then Who Lives Here?), each card at least 64 CSS px, inside the viewport and not overlapping, with a close button that returns to the map; the first card still opens Who's Hiding? | 1 | e2e | both | `getBuildingHit` |
| AC-17 | Round building: homes shown equal the level's choiceCount and always include the first animal's home; every animal's home is on screen; 3 animals per round, never the same animal twice in a row; at least two different target homes; `far` distractors come from other families, `near` from the same family first | 1 | unit | @single-orientation | |
| AC-18 | Layout: homes and the animal stand inside the canvas in both orientations, homes do not overlap, and every tap target is at least 64 px | 1 | unit | @single-orientation | |
| AC-19 | At age 5, after a wrong tap on a clue-after-miss level the descriptive clue is spoken in the round language; age 2 has an idle hint and age 5 does not | 1 | e2e+seed | @single-orientation | `seedHabitatLevel`, `getHabitatInfo`, `getSpokenLines` |
| AC-20 | Habitat screen is an `AppScreen` and a waiting update is deferred while the game is open; Who Lives Here? is exactly one `WORLD_GAMES` entry and the third Nature Lab station (after Who's Hiding? and Seed to Flower) with its scene and card id, and no per-world picker list exists | 1 | unit | @single-orientation | |

By default, Pass-1 criteria do not require polished animation or new recorded clips (`docs/PROCESS.md` §3).

## Art, animation, and audio

### Pass 1 — working game

Basic animation and device TTS only. All art already exists on `main`; nothing new is requested from Gemini.

- **Asset paths and manifest keys (existing):** `public/art/homes/<home>-back.svg` and `-front.svg` (keys `home-<home>-back|front`, homes `pond`, `nest`, `tree-hollow`, `burrow`, `kennel`, `hive`); `public/art/scenes/habitats/bg-landscape.svg` and `bg-portrait.svg` (keys `habitats-bg-landscape|portrait`); animal rigs `frog`, `bird`, `owl`, `bee` (`HABITAT_ANIMAL_RIGS`) and `rabbit`, `dog` (`ANIMAL_RIGS`), drawn by `Character`.
- **Placeholders used (procedural, no new files):** the grassy "path" patch under the current animal; the glow and pulse highlight behind a home; the Nature Lab picker cards reuse `art/scenes/hiding/bg-landscape.svg` (Who's Hiding?) and `art/scenes/habitats/bg-landscape.svg` (Who Lives Here?) through the picker placeholder mechanism; home art is also drawn with the procedural fallback shape when a texture is missing.
- **SVG contract:** unchanged (no new SVG).
- **Layout:** landscape and portrait via `computeHabitatLayout` (reuses `computeSortingLayout` for the slots and the animal stage). Tap targets: **Decided by the owner (2026-11-13):** minimum 64 CSS px; never shrink them.
- **RTL:** Hebrew chrome is RTL; EN and FR learning tokens stay LTR (spoken, not drawn). The game reuses the existing HUD (`setRestaurantChrome`) and prompt bubble.
- **Animation:** `ANIM_PROFILE.homes` (`walkHome`, `settleInHome`), `ANIM_PROFILE.shakeSoft`, and the Sorting Beds shake and hop helpers. No new knobs.
- **Voice table** (device TTS through `AudioManager.play({ lineId, lang, text })`; Hebrew text in `src/games/habitat/habitatVoice.ts`, EN and FR text from `src/content/games/who-lives-here.json`):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `habitat.ask.he` | he | לאן החיה הזאת הולכת הביתה? | Each animal appears; replay on tap |
| `habitat.name.<animalId>.<en\|fr>` | en / fr | "the frog" / "la grenouille" | After the ask line at noun levels |
| `habitat.clue.<animalId>.<en\|fr>` | en / fr | "I have feathers and I build a nest." | After the ask line at riddle levels; after a wrong tap at clue-after-miss levels |
| `habitat.correct.he` | he | יופי! החיה הגיעה הביתה! | Correct tap |
| `habitat.home.<homeId>.<en\|fr>` | en / fr | "the pond" / "la mare" | After a correct tap |
| `habitat.wrong.he` | he | כמעט! נסי בית אחר. | Wrong tap |
| `habitat.help.he` | he | עזרי לכל חיה למצוא את הבית שלה. הקשי על הבית שבו היא גרה. אפשר ללחוץ על החיה כדי לשמוע שוב. | Help button |

- **World and PWA wiring:** `worlds.json` keeps `nature-lab` `open`, `earnsLeisure: true`, `entryGameId: "who-is-hiding"` (a fallback hint only); the building opens the station trail. The only wiring in the picker is one `WORLD_GAMES` entry in `src/ui/picker/pickerModel.ts` (`who-lives-here` / `HabitatScene`, appended after `seed-to-flower`) plus the content JSON `"world": "nature-lab"`; there is no per-world list and no `MapScene` branch (station-trail "How to add a game"). `src/pwa/updatePolicy.ts`: new `AppScreen` `'habitat'`, unsafe for mid-game updates.

### Pass 2 — polish

Only after Maor approves the finished Pass 1.

- Polished animation (animals peek out of the home, the home reacts), new homes and habitats (cave, barn, ocean, jungle) and more animals so a bed holds several animals.
- Recorded Gemini TTS clips (voice Leda) for the voice table; device TTS stays the fallback.

## Out of scope

- Several animals per home and the habitats farm, sea, jungle, sky (no art yet; Pass 2).
- Drag-and-drop, a parent-area setting for the game, Pass 2 art and recorded clips.
- Changing Sorting Beds (its tests stay green; this game reuses its layout, motion, trial tracker and level-seed helpers without editing them).

## Open decisions for the owner

- **Open decision for the owner:** Nature Lab opens a 3-station trail (Who's Hiding?, Seed to Flower, Who Lives Here?) instead of opening Who's Hiding? directly. Reversible default taken in continuous mode: remove the `who-lives-here` entry from `WORLD_GAMES` (not a `MapScene` branch).
- **Open decision for the owner:** Pass 1 uses the six habitats and animals that already have approved art (pond/frog, nest/bird, tree hollow/owl, burrow/rabbit, doghouse/dog, beehive/bee), one animal per home, instead of the farm / sea / jungle / sky set.
- **Open decision for the owner:** Age 2 is capped at level 4 (three homes, no riddles).

## Changelog

- `2026-11-13` — created and approved for build by Maor (continuous mode) — substantive
- `2026-11-13` — AC-05 clarified: the language is pinned with `seedLanguageSetting` because the adaptive level is per language; no change in meaning — minor
- `2026-11-14` — after the station trail (#69) landed on main: the Nature Lab picker is the 3-station trail built from `WORLD_GAMES` (Who's Hiding?, Seed to Flower, Who Lives Here?); AC-16 and AC-20 reworded to match; no new hook — minor

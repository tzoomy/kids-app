# `game-shell` — The Mystery Egg game shell (map, slides, progression)

Status: **draft — pending owner approval** (new owner decision of 2026-11-26 to build the shell; the brief is the source, the open questions are in `docs/PENDING-DECISIONS.md`).
Pass in progress: **1** (read by `npm run check:ac`).

Design sources (kept outside the repo): `design/game-shell-scripts.md` (the opening film and the Workshop entry scripts), `design/mockups/map-v1.jpg`, `map-walk.jpg`, `intro-storyboard.jpg`. The existing prototype is `docs/specs/mystery-egg.md` (mission 1.1, unchanged); the media contract is `docs/specs/mystery-egg-assets.md` ("Game shell assets").

## Summary

The Mystery Egg hub becomes an interactive storybook **world map**. The nest with the egg is HOME in the centre; five worlds sit around it, joined to the nest by cobblestone paths: the Machine Workshop is open, four are locked in a cute way (a sleeping baker-cat, a padlock and fog, a misty jungle arch, a flower-tied garden gate). The child taps a world: if it is open the friends (bunny, robot, capybara, plus the baby frog on the younger child's profile) walk along the path to it and the world opens; if it is locked the world wiggles and a sleepy "zzz" plays, nothing else happens. The first time a profile opens the map a 4-slide **intro** (picture + French hero line + Hebrew robot line per slide) tells the story; the first arrival at a world shows 2 **entry slides**. Both are tap-to-advance and always skippable. Each world has one game with ordered levels; a success unlocks the next level, lights the world's robot-heart slot, fills its gear, and after `PIECE_LEVELS` levels earns the world's nest piece (it flies into the nest on the return to the map). Mission 1.1 is Workshop level 1 and the existing build scene is reused unchanged.

## Learning goals

- **Age 2:** none new (the shell is navigation and story). The baby frog walks with the friends on the age-2 profile. The Workshop game itself is unchanged.
- **Age 5:** none new. The French hero lines in the slides are listening reinforcement; the Hebrew robot lines explain in short words.

## World and why

- **World:** the Mystery Egg frame story. The five worlds are placeholders (ids in `docs/PENDING-DECISIONS.md`), not worlds of `src/content/worlds.json`; nothing in the existing map, picker or stations changes. Entry stays the big egg button on the map HUD (`mystery-egg-btn`), which now opens this map.
- **Why:** the story bible makes the map the home of the frame story (`docs/WORLDS.md` direction pending).

## Mechanic

Views (all in `MysteryEggScene`; the Workshop game is the unchanged `MysteryEggBuildScene`):

1. **Intro slides** (phase `intro`): shown automatically the first time a profile opens the map (`introSeen` false). 4 slides: 1 = film scene 1 (egg found), 2 = scene 2 (the robot's empty heart), 3 = scene 4 (the map of worlds), 4 = scene 5 (the goal: heart gears and nest pieces). Scenes 3 and 6 are dropped (pending decision).
2. **Map** (phase `map`): `hub-bg` is replaced by `map-bg`; the nest and egg in the centre (glow level = nest pieces earned, idle wiggle, tap = wiggle + beep), nest pieces resting on the nest, the robot's 5-slot heart panel (a lit slot per world with a placeholder gear-fill arc), the home button (back to the old map), the friends standing by the nest, and the five worlds with their paths. No button enters a world.
3. **Walking** (phase `walking`): tapping an open world locks input; the friends walk from the nest along the path to the world door, following the bunny in a line with small offsets and a little walk bob (`sfx-walk`).
4. **Entry slides** (phase `entry`): on the first arrival per profile (`entrySeen` lacks the world) the world's entry slides play (Workshop: 2). On later arrivals the world game starts straight away.
5. **Return** (phase `hub` while a piece flies, then `map`): after a game, the map shows the progress; a nest piece earned since the map was last shown flies from the world into the nest and the egg glow steps up.

**Slide player** (`slides.ts` pure model + `slideView.ts` thin Phaser view): a slide = one image id + an ordered list of voice line ids (French hero line, then Hebrew robot line), played through the Mystery Egg voice path (`context.audio.play`). A tap anywhere advances to the next slide and stops the current voice; the tap on the last slide ends the sequence. A picture-only skip button (>= 96 CSS px, `skipBtn`) skips the whole sequence. No video, no auto-advance. Ending or skipping marks it seen for the profile.

**Locked world**: the world container wiggles, three drawn "z" float up, `sfx-locked` plays, and the robot line `vo-he-robot-locked` is requested. The child stays on the map (phase stays `map`), nothing walks, nothing opens.

**Friends** (`friendsFor(profile)`, pure): bunny, robot, capybara, plus the baby frog when `ageTrack === 'age2'` (profile `a`, the younger child). Pending decision.

**Progression** (`progress.ts`, pure): each world has one game type with ordered levels (Workshop: 1 level today, mission 1.1 = level 1; other worlds list 3 planned levels but are locked). A success at level L records L as completed and raises the world's `level` (the next level to play, capped at the world's level count). Hearts: each world owns one robot heart slot (workshop 0, bakery 1, owl-house 2, jungle 3, garden 4); the slot lights on the first success in that world and its gear fill is `completed / threshold` (0..1) with `threshold = min(PIECE_LEVELS, levels in the world)`. Nest piece: after `threshold` distinct levels completed the world's piece is earned (workshop `feather`; bakery `knit-square`, owl-house `pebble`, jungle `leaf`, garden `flower`, placeholder ids) and **persisted** in `pieces`, so it is never lost when levels are added later. Egg glow level = pieces earned (0..5); five pieces = `readyToHatch` (hatching itself is out of scope).

**Persistence:** key `kids-app-mystery-egg:<profileId>`, save **v2** `{ v: 2, worlds: { [worldId]: { level, completed: number[] } }, pieces: string[], introSeen: boolean, entrySeen: string[] }`. A v1 save `{ v: 1, completed: ['1.1'] }` migrates without loss (1.1 = Workshop level 1 completed, slot 0 lit, feather earned, egg level 1). Corrupt, unknown or wrong-version data falls back to a fresh state, field-by-field repair as before. The unchanged build scene keeps calling `recordMissionAndSave(storage, profileId, '1.1')`, `litHearts`, `eggLevel`, `nestTreasures`.

**Missing media** (all new art, voice and sfx are Gemini's): the manifest entries carry `pending: true` until the files land. A missing art file is drawn as a Phaser shape, a missing voice line is a chime plus a speech-bubble cue, a missing sfx is a synthesized placeholder, exactly as in the prototype. The files guard allows a missing file only for a `pending` entry.

**Input mode:** tap only. Tap targets are at least 96 CSS px at 1280x800 (a 1280x800 board fitted into the canvas, landscape tablet first).

## Difficulty curve

Not adaptive (no skill key, no leisure). The levels of a world are fixed, ordered and unlocked by success; only Workshop level 1 exists today.

## Leisure

None: the shell neither earns nor spends leisure time (as in the prototype).

## Player journey from the map

Profile → old map → tap the big egg button → (first time) intro slides → map → tap the Workshop → friends walk → (first time) 2 entry slides → Workshop game (intro, build, play, success) → continue → map (heart, piece flying into the nest, brighter egg) → home button → old map.

- Map building hit target: not used (entry is the DOM button `mystery-egg-btn`; worlds on the canvas are tapped through the rectangles of the read hook).
- `data-testid`: `mystery-egg-btn` (existing).
- Hooks under `?e2e=1` (frozen at approval; seed and read only):
  - `getMysteryEggInfo()` (extended, additive): for the map scene `scene: 'MysteryEggScene'`, `phase: 'intro' | 'map' | 'walking' | 'entry' | 'hub'`, `ready`, `heartsLit`, `heartFill` (5 numbers 0..1), `eggLevel`, `featherInNest`, `pieces` (earned piece ids), `readyToHatch`, `friends` (friend ids on screen), `friendPositions` (board px of each friend, to see them walk), `worlds` (`{ [worldId]: { open, level, completed, fill } }`), `slide` (`{ kind: 'intro' | 'entry', world: string | null, index, count } | null`), `introSeen`, `entrySeen`, `walkingTo`, `lockedTaps`, `pieceFlights` (ids of the pieces that flew into the nest in this scene), and rectangles (page CSS px) `world-workshop`, `world-bakery`, `world-owl-house`, `world-jungle`, `world-garden`, `skipBtn` (while slides show), `slideTap` (the whole slide), `backBtn`. The old `workshopBtn` rectangle no longer exists. The build scene's info is unchanged.
  - `seedMysteryEggProgress(seed)`: writes the active profile's Mystery Egg key only. A v1 seed `{ completed: string[] }` is stored as a raw v1 save (so the migration runs on load); a v2 seed `{ v: 2, worlds?, pieces?, introSeen?, entrySeen? }` is repaired and stored as v2.
  - Existing shared hooks used: `getActiveScenes`, `getSpokenLines`, `getGameSize`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: fresh profile → egg button → intro (4 slides, taps) → map → tap the Workshop → walking → entry (2 slides) → the Workshop game starts → win → continue → the map shows the heart, the piece flying into the nest and egg level 1; there is no Workshop button | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines`, `getActiveScenes` |
| AC-02 | The world table has five worlds with distinct ids and heart slots 0..4; every world's path starts at the nest and ends at the world's door, has at least 2 points, and every hit area is at least 96 px | 1 | unit | @single-orientation | |
| AC-03 | The map shows the nest, the heart panel, the back button and five worlds (Workshop open, four locked) with tap rectangles of at least 96 CSS px that do not overlap each other or the back button | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-04 | `friendsFor`: bunny, robot, capybara, plus the frog only when `ageTrack === 'age2'` | 1 | unit | @single-orientation | |
| AC-05 | The younger (age-2) profile shows the frog on the map, the older (age-5) profile does not | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-06 | Walk geometry: a point at a distance along a polyline, followers start later and trail the leader on the same route with small offsets, a walk bob only while moving, the walk ends exactly at the door | 1 | unit | @single-orientation | |
| AC-07 | Tapping the Workshop starts the walk (phase `walking`, `walkingTo` = workshop, friends move), input is locked meanwhile (a tap on a locked world does nothing), and arriving enters the world | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-08 | A locked world: cute feedback, no walk, no entry; the child stays on the map; `vo-he-robot-locked` is requested (speech spy) | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines` |
| AC-09 | Slide player model: starts on slide 1, advance moves on and ends after the last slide, skip ends at once, each slide lists its voice lines in order (French, then Hebrew), nothing happens after the end | 1 | unit | @single-orientation | |
| AC-10 | Intro: shown on a profile's first map visit with 4 slides; a tap advances and requests the slide's French then Hebrew line (speech spy); the skip button skips all; the next visit goes straight to the map | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines` |
| AC-11 | Workshop entry: 2 slides on the first arrival, skippable; later arrivals go straight into the game | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-12 | Slide data: the intro is scenes 1, 2, 4, 5 of the film script; the Workshop entry is scenes 1 and 4 of the entry script; every voice line has a manifest transcript copied exactly from the scripts (French hero lines `fr`, Hebrew robot lines `he`); other worlds have no entry slides yet | 1 | unit | @single-orientation | |
| AC-13 | Progression: a success records the level and raises the world's level (capped), replays are idempotent, an unknown world or out-of-range level changes nothing | 1 | unit | @single-orientation | |
| AC-14 | Hearts and pieces: one heart slot per world lit on the first success, the gear fill is `completed / min(PIECE_LEVELS, levels)`, a piece is earned after that many distinct levels and stays persisted when levels are added later, egg level = pieces, `readyToHatch` at five pieces | 1 | unit | @single-orientation | |
| AC-15 | Persistence: v2 round trip under the per-profile key; a v1 save migrates without loss (and again idempotently); corrupt, unknown or wrong types fall back or are repaired and never throw; `introSeen` and `entrySeen` persist | 1 | unit | @single-orientation | |
| AC-16 | A v1-seeded profile keeps heart 0, the feather and egg level 1 on the map; a v2 seed with several worlds shows the seeded hearts and pieces | 1 | e2e+seed | @single-orientation | `seedMysteryEggProgress`, `getMysteryEggInfo` |
| AC-17 | The manifest parses with the new ids; every new entry is `pending` or has its file; new voice lines have transcripts and languages; the new art sizes and the 1x set follow the contract | 1 | unit | @single-orientation | |
| AC-18 | Device check: touch taps on the map, the walk, the slides, rotation, audible voice once Gemini's files land, visuals | 1 | device | both | |

## Art, animation, and audio

All media belong to the Gemini agent. This change adds code only: every new id is in `src/content/mysteryEggAssets.json` (`pending: true`) with its path, and in `docs/specs/mystery-egg-assets.md` ("Game shell assets"). Art: `public/art/mystery-egg/<id>.webp`; audio: `public/audio/mystery-egg/<id>.ogg`.

### Pass 1 — working game

- Placeholders for missing media: drawn Phaser shapes for art (a storybook meadow, houses with a lock or a sleeping animal or fog, cobblestone patches, drawn pieces), the existing chime plus speech-bubble cue for voice, synthesized `sfx-locked` and `sfx-walk`.
- Animation: tweens only (walk along a polyline with a bob, world wiggle, floating "z", a flying nest piece, a gear-fill arc).
- **Voice table** (device TTS is not used; transcripts copied exactly from `design/game-shell-scripts.md`, the locked line is a proposal):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `vo-fr-intro-1` | fr | Oh ! Un œuf ! Il est tout chaud… | Intro slide 1 |
| `vo-he-intro-1` | he | ביצה? איזו הפתעה… יש מישהו בפנים. | Intro slide 1, after the French line |
| `vo-fr-intro-2` | fr | Mon petit robot… tu ne sais pas encore sentir. | Intro slide 2 |
| `vo-he-intro-2` | he | אני יודע לחשוב ולבנות. אבל הלב שלי עוד ריק. אני לא יודע להרגיש. | Intro slide 2 |
| `vo-fr-intro-3` | fr | Regarde ! Il y a des mondes à explorer. | Intro slide 3 |
| `vo-he-intro-3` | he | זאת המפה. בכל עולם יש משחק אחר. אפשר ללכת לשם עם החברים, על השביל. | Intro slide 3 |
| `vo-fr-intro-4` | fr | Des cœurs pour mon robot… et des trésors pour le nid. | Intro slide 4 |
| `vo-he-intro-4` | he | כשמסיימים משחק, אני מקבל גלגל לב ולומד להרגיש. ואחרי כמה משחקים בעולם, הביצה מקבלת חלק חשוב לקן. ככה היא תוכל לבקוע. | Intro slide 4 |
| `vo-fr-workshop-entry-1` | fr | Voici l'atelier ! Ici, on construit des machines. | Workshop entry slide 1 |
| `vo-he-workshop-entry-1` | he | זאת הסדנה! כאן בונים מכונות מצחיקות, אחת אחרי השנייה, כמו שרשרת. | Workshop entry slide 1 |
| `vo-fr-workshop-entry-2` | fr | Clic, clac… boum ! On y va ? | Workshop entry slide 2 |
| `vo-he-workshop-entry-2` | he | כשמצליחים, אני מקבל קצת צחוק לגלגל הלב. ואחרי כמה משחקים, הביצה מקבלת חלק חשוב. יאללה, בואו נשחק! | Workshop entry slide 2 |
| `vo-he-robot-locked` | he | העולם הזה עוד ישן. בואי נלך לסדנה! | A tap on a locked world (**proposal, no script exists**) |

- **World and PWA wiring:** none new (`mystery-egg` and `mystery-egg-build` screens exist; no `entryGameId`, no `earnsLeisure`).

### Pass 2 — polish

Only after Maor approves Pass 1: the real art, voices and sfx from Gemini, a richer walk (animated walk cycles, the Workshop door opening), animated slides, the world games 2..3 per world, the other four worlds' games, the hatching finale.

## Out of scope

Hatching, the other four worlds' games and their entry slides, film scenes 3 and 6, video, portrait layout, any change to the Workshop game logic (`MysteryEggBuildScene`, `machine`, `run`, `snap`, `layout`), leisure earning, recorded voices and art (Gemini), and any change to existing games, worlds or the picker.

## Open decisions for the owner

All are rows in `docs/PENDING-DECISIONS.md` (2026-11-26, "Game shell"):

- **Open decision for the owner:** world ids, names and placement (placeholders `workshop`, `bakery`, `owl-house`, `jungle`, `garden`).
- **Open decision for the owner:** which 4 intro scenes (1, 2, 4, 5; scenes 3 and 6 dropped).
- **Open decision for the owner:** the entry-slide rule (Workshop scenes 1 and 4; first arrival only).
- **Open decision for the owner:** `PIECE_LEVELS = 3`, the `min(PIECE_LEVELS, levels)` rule and the gear-fill meaning.
- **Open decision for the owner:** one heart slot per world (workshop 0 … garden 4).
- **Open decision for the owner:** the baby frog walks with the age-2 profile only.
- **Open decision for the owner:** the locked line proposal `העולם הזה עוד ישן. בואי נלך לסדנה!`.
- **Open decision for the owner:** French and Hebrew both voiced per slide, in that order.
- **Open decision for the owner:** hatching is out of scope.

## Changelog

- `2026-11-26` — created from the owner's task of 2026-11-26 (game shell: map, slides, progression, save v2) — substantive
- `2026-11-26` — read hook gets `friendPositions` (board px per friend) so the walk can be asserted — minor

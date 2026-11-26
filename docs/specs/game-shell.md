# `game-shell` — The Mystery Egg game shell (map, slides, progression)

Status: **draft — pending owner approval** (new owner decision of 2026-11-26 to build the shell; the brief is the source, the open questions are in `docs/PENDING-DECISIONS.md`).
Pass in progress: **1** (read by `npm run check:ac`).

Design sources (kept outside the repo): `design/game-shell-scripts.md` (the opening film and the Workshop entry scripts), `design/mockups/map-v1.jpg`, `map-walk.jpg`, `intro-storyboard.jpg`. **Media contract:** Gemini's `game-shell/plan.md` (section (d), adopted 2026-11-26): ids, paths, sizes and clips are theirs, merged from `src/content/gameShellAssets.json`. The existing prototype is `docs/specs/mystery-egg.md` (mission 1.1, unchanged); the media contract is `docs/specs/mystery-egg-assets.md` ("Game shell assets").

## Summary

The Mystery Egg hub becomes an interactive storybook **world map**. The nest (`map-nest-home`) is HOME in the centre; five worlds (workshop, bakery, detective, jungle, garden) sit around it, joined to the nest by the cobblestone paths of `map-bg`: the Machine Workshop is open, four are closed in a cute way. The child taps a world: if it is open the four friends (bunny, robot, capybara, frog) walk along the path to it and the world opens; if it is closed the tile only wiggles (no voice), nothing else happens. The first time a profile opens the map a 4-slide **intro** (picture + French hero line + Hebrew robot line per slide) tells the story; the first arrival at a world shows 2 **entry slides**. Both are tap-to-advance and always skippable. Each world has one game with ordered levels; a success unlocks the next level, lights the world's robot-heart slot, fills its gear, and after `PIECE_LEVELS` levels earns the world's nest piece (it flies into the nest on the return to the map). Mission 1.1 is Workshop level 1 and the existing build scene is reused unchanged.

## Learning goals

- **Age 2:** none new (the shell is navigation and story). The frog walks with the friends on the shared map for every profile. The Workshop game itself is unchanged.
- **Age 5:** none new. The French hero lines in the slides are listening reinforcement; the Hebrew robot lines explain in short words.

## World and why

- **World:** the Mystery Egg frame story. The five worlds are placeholders (ids in `docs/PENDING-DECISIONS.md`), not worlds of `src/content/worlds.json`; nothing in the existing map, picker or stations changes. Entry stays the big egg button on the map HUD (`mystery-egg-btn`), which now opens this map.
- **Why:** the story bible makes the map the home of the frame story (`docs/WORLDS.md` direction pending).

## Mechanic

Views (all in `MysteryEggScene`; the Workshop game is the unchanged `MysteryEggBuildScene`):

1. **Intro slides** (phase `intro`): shown automatically the first time a profile opens the map (`introSeen` false). 4 slides (`shell-intro-1..4`): 1 = the egg is found, 2 = the robot's five empty hearts, 3 = the friends promise to help and build a nest, 4 = the map and the goal (heart gears and nest pieces). Clips per slide: 1 hero + narrator, 2 hero + robot, 3 hero + robot, 4 hero + narrator. The film scene 6 is dropped and scenes 4 and 5 are merged into slide 4 (pending decision).
2. **Map** (phase `map`): layers in Gemini's order: `map-bg` at (0,0), a procedural path glow drawn in Phaser (no raster; the open world's path pulses), the centre `map-nest-home` (art 360x300 at (640,420)) (a whole painted egg in a nest, no blanket, feather or glow baked in) with a procedural glow BEHIND it that grows with the egg level (0..5) and the earned nest pieces, all drawn by code on the bowl rim (the feather included), the five tiles (`map-world-workshop-open`, and `map-world-<bakery|detective|jungle|garden>-closed`) at anchors (220,230), (640,180), (1060,230), (220,650), (1060,650), then the friends by the nest. The robot's 5-slot heart panel (a lit slot per world with a placeholder gear-fill arc) and the home button (back to the old map) stay. No button enters a world.
3. **Walking** (phase `walking`): tapping an open world locks input; the friends walk from the nest along the path to the world door, the friend with the shortest route leading and the others following in a line (one stagger later each, with sideways offsets of up to 40 px), a little walk bob, and the followers queueing up behind the leader at the door (`ARRIVAL_GAP_PX` apart along the path) instead of standing on each other. A facing rule flips a friend while its heading goes left and resets it to the default side as soon as it stops walking (on arrival, and on every re-entered map). Each friend shows `map-<friend>-idle` at rest and swaps to `map-<friend>-walk` (a 4-frame strip at 8 fps) while walking, flipped when the current path segment goes left (never left flipped), and back to idle on arrival. One scale per friend (`friendSprites.ts`: visible height bunny 190, capybara 182, robot 150, frog 120 board px) serves the idle art and the walk strip (their visible heights differ by under 4%), and both stand on the same feet line.
4. **Entry slides** (phase `entry`): on the first arrival per profile (`entrySeen` lacks the world) the world's entry slides play (Workshop: 2). On later arrivals the world game starts straight away.
5. **Return** (phase `hub` while the map loads and while a piece flies, then `map`): after a game, the map shows the progress; a nest piece earned since the map was last shown flies from the world into the nest and the egg glow steps up.

**Slide player** (`slides.ts` pure model + `slideView.ts` thin Phaser view): a slide = one image id + an ordered list of voice line ids (French hero line, then Hebrew robot line), played through the Mystery Egg voice path (`context.audio.play`). On a two-clip slide the French hero clip plays first and the Hebrew clip follows after a short gap (`SLIDE_LINE_GAP_MS` = 400 ms). A tap anywhere advances to the next slide and stops the current voice, including a pending second clip; the tap on the last slide ends the sequence. A picture-only skip button (drawn code UI, no art id, >= 96 CSS px, `skipBtn`) is ALWAYS shown, on the intro and on every entry, the first time included, and skips the whole sequence. No video, no auto-advance. Ending or skipping marks it seen for the profile.

**Closed world**: the tile wiggles and three drawn "z" float up with a soft pop (an existing placeholder sfx). **No voice line.** The child stays on the map (phase stays `map`), nothing walks, nothing opens. A wiggle never stacks: a new tap stops the running wiggle and restores the rest angle first. World taps (open or closed) count only in phase `map`.

**Friends** (`MAP_FRIENDS`): bunny, robot, capybara and frog, for every profile (the frog on the shared map is Gemini's default, pending Maor).

**Progression** (`progress.ts`, pure): each world has one game type with ordered levels (Workshop: 1 level today, mission 1.1 = level 1; other worlds list 3 planned levels but are locked). A success at level L records L as completed and raises the world's `level` (the next level to play, capped at the world's level count). Hearts: each world owns one robot heart slot (workshop 0, bakery 1, detective 2, jungle 3, garden 4); the slot lights on the first success in that world and its gear fill is `completed / threshold` (0..1) with `threshold = min(PIECE_LEVELS, levels in the world)`. Nest piece: after `threshold` distinct levels completed the world's piece is earned (workshop `feather`; bakery `knit-square`, detective `pebble`, jungle `leaf`, garden `flower`, placeholder ids) and **persisted** in `pieces`, so it is never lost when levels are added later. Egg glow level = pieces earned (0..5); five pieces = `readyToHatch` (hatching itself is out of scope).

**Persistence:** key `kids-app-mystery-egg:<profileId>`, save **v2** `{ v: 2, worlds: { [worldId]: { level, completed: number[] } }, pieces: string[], introSeen: boolean, entrySeen: string[] }`. A v1 save `{ v: 1, completed: ['1.1'] }` migrates without loss (1.1 = Workshop level 1 completed, slot 0 lit, feather earned, egg level 1). Corrupt, unknown or wrong-version data falls back to a fresh state, field-by-field repair as before. The unchanged build scene keeps calling `recordMissionAndSave(storage, profileId, '1.1')`, `litHearts`, `eggLevel`, `nestTreasures`.

**Missing media** (all new art and voice are Gemini's, in `src/content/gameShellAssets.json`, merged with `mysteryEggAssets.json` into one manifest at load time; the same id in both files is an error): until Gemini's media PR adds the files, a missing art file is drawn as a Phaser shape and a missing voice line is a chime plus a speech-bubble cue, exactly as in the prototype. The files guard accepts a missing `game-shell` file and still checks any that exist.

**Input mode:** tap only. Tap targets are at least 96 CSS px at 1280x800 (a 1280x800 board fitted into the canvas, landscape tablet first). The map's back button also keeps 96 CSS px when the board is scaled down (portrait 800x1280): it grows by the inverse of the board's display scale and sits in the visible canvas corner.

## Difficulty curve

Not adaptive (no skill key, no leisure). The levels of a world are fixed, ordered and unlocked by success; only Workshop level 1 exists today.

## Leisure

None: the shell neither earns nor spends leisure time (as in the prototype).

## Player journey from the map

Profile → old map → tap the big egg button → (first time) intro slides → map → tap the Workshop → friends walk → (first time) 2 entry slides → Workshop game (intro, build, play, success) → continue → map (heart, piece flying into the nest, brighter egg) → home button → old map.

- Map building hit target: not used (entry is the DOM button `mystery-egg-btn`; worlds on the canvas are tapped through the rectangles of the read hook).
- `data-testid`: `mystery-egg-btn` (existing).
- Hooks under `?e2e=1` (frozen at approval; seed and read only):
  - `getMysteryEggInfo()` (extended, additive): for the map scene `scene: 'MysteryEggScene'`, `phase: 'intro' | 'map' | 'walking' | 'entry' | 'hub'`, `ready`, `heartsLit`, `heartFill` (5 numbers 0..1), `eggLevel`, `featherInNest`, `pieces` (earned piece ids), `readyToHatch`, `friends` (friend ids on screen, all four for every profile), `friendPositions` (board px of each friend, to see them walk), `worlds` (`{ [worldId]: { open, level, completed, fill } }`), `worldAngles` (degrees of each world tile, 0 at rest), `friendFacing` (1 = default side, -1 = flipped while walking left; always 1 when not walking), `slide` (`{ kind: 'intro' | 'entry', world: string | null, index, count } | null`), `introSeen`, `entrySeen`, `walkingTo`, `lockedTaps` (wiggles on closed worlds), `pieceFlights` (ids of the pieces that flew into the nest in this scene), and rectangles (page CSS px) `world-workshop`, `world-bakery`, `world-detective`, `world-jungle`, `world-garden`, `skipBtn` (while slides show), `slideTap` (the whole slide), `backBtn`. The old `workshopBtn` rectangle no longer exists. The build scene's info is unchanged.
  - `seedMysteryEggProgress(seed)`: writes the active profile's Mystery Egg key only. A v1 seed `{ completed: string[] }` is stored as a raw v1 save (so the migration runs on load); a v2 seed `{ v: 2, worlds?, pieces?, introSeen?, entrySeen? }` is repaired and stored as v2.
  - Existing shared hooks used: `getActiveScenes`, `getSpokenLines`, `getGameSize`.

## Acceptance criteria

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: fresh profile → egg button → intro (4 slides, taps) → map → tap the Workshop → walking → entry (2 slides) → the Workshop game starts → win → continue → the map shows the heart, the piece flying into the nest and egg level 1; there is no Workshop button | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines`, `getActiveScenes` |
| AC-02 | The world table has five worlds (workshop, bakery, detective, jungle, garden) with Gemini's anchors, `map-world-<id>-open` / `-closed` tile ids, distinct ids and heart slots 0..4; every world's path starts at the nest and ends at the world's door, has at least 2 points, and every hit area is at least 96 px | 1 | unit | @single-orientation | |
| AC-03 | The map shows the nest, the heart panel, the back button and five worlds (Workshop open, four closed) with tap rectangles of at least 96 CSS px that do not overlap each other or the back button | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-04 | `MAP_FRIENDS`: the same four friends for every profile: bunny, robot, capybara, frog | 1 | unit | @single-orientation | |
| AC-05 | The map shows all four friends, the frog included, for both profiles | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-06 | Walk geometry: a point at a distance along a polyline, followers start later and trail the leader on the same route with sideways offsets, a walk bob only while moving, the leader ends exactly at the door; no route of any friend to any world crosses the painted egg or nest (keep-out measured on `map-nest-home`: egg top y 278, widest x 547..739 at y 370, plus 10 px), and every door is outside it | 1 | unit | @single-orientation | |
| AC-07 | Tapping the Workshop starts the walk (phase `walking`, `walkingTo` = workshop, friends move), input is locked meanwhile (a tap on a closed world does nothing), and arriving enters the world | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-08 | A closed world only wiggles: no walk, no entry, no voice line requested (speech spy); the child stays on the map | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines` |
| AC-09 | Slide player model: starts on slide 1, advance moves on and ends after the last slide, skip ends at once, each slide lists its clips in order (hero first), the second clip follows after the 400 ms gap, and stop cancels a pending second clip | 1 | unit | @single-orientation | |
| AC-10 | Intro: shown on a profile's first map visit with 4 slides and the skip button already there; a tap advances and requests the slide's clips (speech spy); the skip button skips all; the next visit goes straight to the map | 1 | e2e | @single-orientation | `getMysteryEggInfo`, `getSpokenLines` |
| AC-11 | Workshop entry: 2 slides on the first arrival, skippable; later arrivals go straight into the game | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-12 | Slide data: the intro is `shell-intro-1..4` and the Workshop entry `shell-ws-1..2`, with Gemini's clips per slide (ws-2 has the robot clip only), every clip's transcript is Gemini's, other worlds have no entry slides yet, and there is no locked voice line | 1 | unit | @single-orientation | |
| AC-13 | Progression: a success records the level and raises the world's level (capped), replays are idempotent, an unknown world or out-of-range level changes nothing | 1 | unit | @single-orientation | |
| AC-14 | Hearts and pieces: one heart slot per world lit on the first success, the gear fill is `completed / min(PIECE_LEVELS, levels)`, a piece is earned after that many distinct levels and stays persisted when levels are added later, egg level = pieces, `readyToHatch` at five pieces | 1 | unit | @single-orientation | |
| AC-15 | Persistence: v2 round trip under the per-profile key; a v1 save migrates without loss (and again idempotently); corrupt, unknown or wrong types fall back or are repaired and never throw; `introSeen` and `entrySeen` persist | 1 | unit | @single-orientation | |
| AC-16 | A v1-seeded profile keeps heart 0, the feather and egg level 1 on the map; a v2 seed with several worlds shows the seeded hearts and pieces | 1 | e2e+seed | @single-orientation | `seedMysteryEggProgress`, `getMysteryEggInfo` |
| AC-17 | `gameShellAssets.json` has exactly Gemini's 37 ids (paths `art/game-shell/<id>.webp` and `audio/game-shell/<id>.ogg`, 1x sizes, walk strips of 4 frames at 8 fps), is merged with `mysteryEggAssets.json` (78 ids, a duplicate id is an error), and the files guard accepts missing `game-shell` files while checking those that exist | 1 | unit | @single-orientation | |
| AC-18 | Device check: touch taps on the map, the walk, the slides, rotation, audible voice once Gemini's files land, visuals | 1 | device | both | |
| AC-19 | A wiggle never stacks: a new tap stops the running wiggle and restores the rest angle first (one running wiggle per target), and repeated quick taps on a closed world keep the tile within its wiggle and return it to rest | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-20 | A world tap (open or closed) does nothing unless the live, loaded map is in phase `map`: not in the intro or entry slides, not while the friends walk, not in transitions or while a piece flies | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-21 | Facing: a friend flips while its heading goes left and faces the default side again whenever it is not walking (on arrival and on a re-entered map) | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-22 | The map's back button is at least 96 CSS px, in the visible canvas corner and on screen, also in portrait 800x1280 (the landscape 1280x800 button is unchanged: 96 px at (70, 70)) | 1 | e2e | @single-orientation | `getMysteryEggInfo` |
| AC-23 | Friend sizes follow Gemini's real sprites (`FRIEND_SPRITES`, measured on the 2x files): the size table matches the manifest, displayed heights order frog < robot < capybara <= bunny (bunny about 190 px), one scale per friend serves idle and walk (walk frames within 4% of idle) with both standing on the same feet line, placeholders keep the idle size | 1 | unit | @single-orientation | |
| AC-25 | The final `map-nest-home` is a whole painted egg with no blanket, feather or glow: every earned piece (the feather too) is drawn by code on the bowl rim (`PIECE_NEST_SPOTS`: on the rim, off the egg, apart), the code glow (`NEST_GLOW`) sits behind the art, and no second egg is drawn when the real file is present | 1 | unit | @single-orientation | |
| AC-24 | Friends at rest stand in front of and beside the nest (no body covers the painted egg, the heart panel or another friend); on every route consecutive friends stay at least about one friend width apart (95 px) while walking and when they arrive (the shortest route leads, followers queue behind it at the door) | 1 | unit | @single-orientation | |

## Art, animation, and audio

All media belong to the Gemini agent and follow their contract (`game-shell/plan.md` section (d)). This change adds code only: the 37 entries are in `src/content/gameShellAssets.json` (verbatim from Gemini's snippet) and listed in `docs/specs/mystery-egg-assets.md` ("Game shell assets"). Art: `public/art/game-shell/<id>.webp`; audio: `public/audio/game-shell/<id>.ogg`.

### Pass 1 — working game

- Placeholders for missing media: drawn Phaser shapes for art (a storybook meadow with paths, houses with a padlock, a sleeping animal or fog, nest, friends, slides), the existing chime plus speech-bubble cue for voice. The skip button, the path glow, the nest glow and the nest pieces other than the feather are code only.
- Animation: tweens only, plus the 4-frame walk strips when they exist (walk along a polyline with a bob, tile wiggle, floating "z", a flying nest piece).
- **Voice table** (device TTS is not used; transcripts are Gemini's; no names in the voice-over this pass):

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `vo-shell-intro-1-hero` | fr | Oh ! Un œuf ! | Intro slide 1, first |
| `vo-shell-intro-1-narr` | he | ביצה חמה התגלגלה לכיכר! | Intro slide 1, after the gap |
| `vo-shell-intro-2-hero` | fr | Mon petit robot… tu ne sais pas encore sentir. | Intro slide 2, first |
| `vo-shell-intro-2-robot` | he | הלב שלי עוד ריק. אני לא יודע להרגיש. | Intro slide 2, after the gap |
| `vo-shell-intro-3-hero` | fr | On va t'aider, petit œuf. Promis ! | Intro slide 3, first |
| `vo-shell-intro-3-robot` | he | נבנה לך קן חם, un nid. וגם אני אלמד להרגיש. | Intro slide 3, after the gap |
| `vo-shell-intro-4-hero` | fr | Regarde ! Des cœurs… et des trésors pour le nid. | Intro slide 4, first |
| `vo-shell-intro-4-narr` | he | מצליחים — הרובוט מקבל לב, un cœur. כמה משחקים — מתנה לקן. ככה הביצה תבקע! | Intro slide 4, after the gap |
| `vo-shell-ws-1-hero` | fr | Voici l'atelier ! Monsieur Moustache dort ! | Workshop entry slide 1, first |
| `vo-shell-ws-1-narr` | he | החתול האופה ישן. בואי נעיר אותו! | Workshop entry slide 1, after the gap |
| `vo-shell-ws-2-robot` | he | שמים חלקים, לוחצים על נגן, והכדור, la balle, מתגלגל! | Workshop entry slide 2 (the only clip) |

- **World and PWA wiring:** none new (`mystery-egg` and `mystery-egg-build` screens exist; no `entryGameId`, no `earnsLeisure`).

### Pass 2 — polish

Only after Maor approves Pass 1: the real art, voices and sfx from Gemini, a richer walk (animated walk cycles, the Workshop door opening), animated slides, the world games 2..3 per world, the other four worlds' games, the hatching finale.

## Out of scope

Hatching, the other four worlds' games and their entry slides, film scene 6, video, recorded locked or wiggle voice, portrait layout, any change to the Workshop game logic (`MysteryEggBuildScene`, `machine`, `run`, `snap`, `layout`), leisure earning, recorded voices and art (Gemini), and any change to existing games, worlds or the picker.

## Open decisions for the owner

All are rows in `docs/PENDING-DECISIONS.md` (2026-11-26, "Game shell"):

- **Open decision for the owner:** Gemini's seven defaults: narrator voice Sulafat (fallback Vindemiatrix); two clips per intro slide (French then Hebrew); a procedural path glow; skip always shown, first launch included; a closed world only wiggles (no voice); the frog on the shared map; no names in the voice-over this pass.
- **Open decision for the owner:** world ids and names (`workshop`, `bakery`, `detective`, `jungle`, `garden`) and placement.
- **Open decision for the owner:** the intro's four beats (egg found, empty hearts, promise and nest, map and goal) and the entry-slide rule (first arrival only).
- **Open decision for the owner:** `PIECE_LEVELS = 3`, the `min(PIECE_LEVELS, levels)` rule and the gear-fill meaning.
- **Open decision for the owner:** one heart slot per world (workshop 0 … garden 4).
- **Open decision for the owner:** `map-nest-home` as the map centrepiece with a procedural egg-progress glow.
- **Open decision for the owner:** hatching is out of scope.

## Changelog

- `2026-11-26` — created from the owner's task of 2026-11-26 (game shell: map, slides, progression, save v2) — substantive
- `2026-11-26` — read hook gets `friendPositions` (board px per friend) so the walk can be asserted — minor
- `2026-11-26` — phase `hub` also covers the map's loading time, so `map` always means tappable — minor
- `2026-11-26` — the phase flips to `intro` / `entry` only once the slide overlay exists (a slide is always present in the hook then); the Workshop game's hook returns null until it has drawn — minor
- `2026-11-26` — adopted Gemini's media contract (`game-shell/plan.md` section (d)): ids renamed (`shell-intro-*`, `shell-ws-*`, `map-*`, `vo-shell-*`; `detective` -> `detective`; tiles `map-world-<id>-open|closed`), manifest moved to the sibling `gameShellAssets.json` merged at load time, `pending` flag removed (missing `game-shell` files are accepted by the files guard), no locked voice line and no sfx ids (a closed world only wiggles), skip is drawn code UI always shown, two clips per slide with a 400 ms gap (ws-2 has one), intro beat 3 = promise and nest, beat 4 = map and goal, `map-nest-home` replaces `egg-nest-*` on the map with a procedural glow, frog on the shared map for every profile (`friendsFor` removed; AC-04, AC-05, AC-08, AC-09, AC-10, AC-12, AC-17 changed in meaning) — substantive (owner-requested change, Status stays draft)
- `2026-11-26` — anchors nudged to match Gemini's media part 1 (PR #112: `map-bg`, `map-nest-home`, the ten tiles): tile anchors unchanged (they sit on the painted clearings), tap areas are now each tile's visible art (`hit` has its own centre), path polylines follow the cobblestones painted in `map-bg` and end in front of each door, friends stand in front of and beside the nest (never on the egg) and walk round the nest through per-world `approach` waypoints, the nest glow is centred on the egg, nest pieces rest on the nest rim, the path glow is warmer (AC-02 and AC-06 geometry only) — minor
- `2026-11-26` — follow-up fixes after the shell merge (#111): the bakery door now stands beside the egg top (560, 298) and its route leaves the nest on its left side, with the unit keep-out measured on the painted egg (AC-06); wiggles never stack and a pure map-phase guard covers world taps (AC-19, AC-20); friends face the default side again once they stop (AC-21); the back button keeps 96 CSS px in portrait (AC-22); friends are sized from Gemini's real sprites with per-state scale and feet alignment, new resting spots, the shortest route leads and followers queue behind it (AC-23, AC-24); read hook gets `worldAngles` and `friendFacing` (additive) — minor
- `2026-11-26` — final nest art (Gemini PR #113, head 438f6fc): the keep-out is re-measured on it (egg tip y 284, widest x 554..738), the five nest pieces including the feather are code-drawn on the rim (`PIECE_ART` all null), the glow stays code-only behind the art (`NEST_GLOW`, default recorded in `docs/PENDING-DECISIONS.md`), friend sprites need one scale each (the frog's walk strip is now as tall as its idle) (AC-23 reworded, AC-25 added) — minor

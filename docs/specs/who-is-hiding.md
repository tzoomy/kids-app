# `who-is-hiding` — Who's Hiding?

Status: **approved**
Pass in progress: **none**

> **Retroactive spec.** This describes the game as implemented on PR #29 (branch `feat/game-hiding`, commit `3fd6d7e`), which is **not on `main` yet**. File references below are to that commit (read with `git show 3fd6d7e:<path>`). Where the code differs from the research proposal or from the template's expectations, this spec describes the code and lists the difference as needed work or as an open decision.

## Summary

Several bushes stand in a meadow, and a different animal hides behind each one, with part of it peeking out. The child hears a request in English or French ("Where is the cat? Meow, meow!" / "Où est le chat ? Miaou, miaou !") and taps the bush that hides that animal. The animal pops out with a "Peekaboo!" / "Coucou !" line, a star flies to the counter, and the next request starts. The child learns animal names and animal sounds in English and French, and matches a sound or a name to a partly hidden animal. The game is the entry game of the **Nature Lab** world.

## Learning goals

Source: `docs/research/games-per-world.md` §4.3 Game B (branch `origin/docs/games-research`), adapted to what the code does.

- **Age 2:** hear an animal's name together with its sound and tap the bush where most of that animal shows (start: 3 bushes, animals from different groups, about 80% of the animal visible). Builds receptive vocabulary for six animal names and their sounds in EN/FR. The tap must be on the referent (the research note on toddlers tapping the specific labelled object).
- **Age 5:** recognise the animal from its **name alone** (no sound) with only its ears showing, among look-alike neighbours (start: 4 bushes, same-category neighbours); at the top levels, recognise it from its **sound alone**, heard only (no text bubble), and finally from a shorter sound word.
- **Differences from the research proposal (current code):**
  - The research ladder for age 5 ends with "a clue alone, then two clues combined". The code has no clue-only request level. The descriptive clue (`clue` per animal, for example "It has long ears and hops.") is spoken only as part of the **hint** on audio-only levels (`hintFor` in `src/games/hiding/hidingRound.ts`).
  - The research age-2 start is 2 bushes; the code starts age 2 at L2 (3 bushes). L1 (2 bushes) is reachable after drops.
  - The research example of look-alikes is "cat vs. tiger"; the content pairs cat/lion, bear/panda, dog/rabbit (only animals with existing art).
  - "Describing words" (big/small, stripes) are not taught as requests; they appear only in the audio-only hint clues.

## World and why

- **World:** Nature Lab (`nature-lab`).
- **Why this game belongs there:** the Nature Lab's goal is creatures, curiosity, and cause and effect (`docs/WORLDS.md`, "Nature Lab"; world table: "Creatures, cause and effect, curiosity"). The research document calls Who's Hiding? "the cheapest way to open a new world" because it reuses the choice/serve template (bushes instead of plates) and the existing animal art. `docs/WORLDS.md` lists "Who Lives Here?" as the first Nature Lab candidate; it does not describe Who's Hiding? yet. **Decided by the owner (2026-11-13):** Who's Hiding? is the Nature Lab entry game (`entryGameId`), before "Who Lives Here?". Implementation item: add a Who's Hiding? section to `docs/WORLDS.md` (not edited in this spec change).

## Mechanic

Terminology: in the code a scene "round" (`HidingScene.startRound`) is **one request (one trial)**. The adaptive engine's "round" is **3 trials** (`trialsPerRound`). Below, "request" means one trial and "engine round" means 3 trials.

**One request** (`src/games/hiding/HidingScene.ts`):

1. The engine picks the target animal (`SkillSession.selectNextItem`); the scene excludes the previous target when another candidate exists (`pickTarget`). `buildHidingRound` (`src/games/hiding/hidingRound.ts`) picks the neighbours for the level, shuffles bush positions, and composes the request text and line ids.
2. Bushes (alternating `round` and `tall` shapes) and their animals pop in with a stagger. Each animal is clipped by a geometry mask at the front foliage so only the level's `reveal` fraction shows above it.
3. When everything has popped in (`ready = true`), every bush rustles in turn (no cue about which one is correct) and the request is spoken. On levels with a visual cue, a text bubble with the request (and a speaker emoji) is shown in the HUD (`shell.setPromptBubble`); on audio-only levels no bubble is shown (`showsPromptBubble` in `src/games/restaurant/voiceRules.ts`).
4. **Replay (not a hint):** the round speaker button (top right, `layout.replay`, radius 44 game units) or a tap on the request bubble repeats the request. It never marks the trial hinted, never counts as a try, and records nothing (`replay()`).
5. **Correct tap** (bush hit zone `pointerdown`): `yay` SFX, the star count goes up by one and is persisted, the other bushes stop accepting taps, the mask is removed and the animal pops out in front of its bush (`revealFromBush`), sparkle/star/confetti bursts, a star flies to the HUD star pill, a random "found" line is spoken in the request's language (`Peekaboo!` / `Surprise!` / `You found me!`, `Coucou !` / `Surprise !` / `Tu m'as trouvé !`), the animal plays its happy and talk animations, then the optional Hebrew follow-up (praise on every 3rd correct answer of the visit, otherwise the "leisure earned" line if the balance crossed a whole minute; `afterFound`, rules from `voiceRules.ts`). Then the next request starts.
6. **Wrong tap:** the tapped bush wobbles and its animal plays `hmm`. Bush taps are ignored for 400 ms after a wrong tap (`WRONG_TAP_LOCK_MS`), so a double tap is one try. After a 450 ms pause (`HINT_AFTER_WIGGLE_MS`):
   - **Age 2** (`hintMode: demonstrate`): `tap` SFX, then a hint (below), preceded by a Hebrew "try again" line on the first wrong tap of the request only (`shouldSayRetry`).
   - **Age 5** (`hintMode: repeat-then-demonstrate`): `hint` SFX; on the first wrong tap the Hebrew "try again" line and the request again; on the second and later wrong taps a hint (without the Hebrew line).
   - The request stays open until the correct bush is tapped. A wrong tap never changes the leisure balance.
7. **Recording:** the trial is recorded once, on the first accepted bush tap (`TrialTracker.onPlateTap` from `src/games/restaurant/trialTracker.ts`): a wrong first tap is a miss; a correct first tap is clean, or assisted if the idle auto-hint fired before it.

**Hints:**

- **Idle auto-hint, age 2 only:** `hintDelayMs` 6000 ms after the request becomes ready, if the request is still open, `giveHint()` runs once (it is not repeated). It marks the trial hinted only if no tap was made yet. If the help card is open it is postponed by another `hintDelayMs`. Age 5 has no idle auto-hint (the timer is scheduled only for `hintMode === 'demonstrate'`), the same as in the restaurant. **Decided by the owner (2026-11-12):** this is intended behaviour: on age 5 a hint comes only after a mistake, and any age-5 `hintDelayMs` is unused by design.
- **Hint on a level with a visual cue (L1–L6):** the correct bush's front rustles and pulses, a sparkle bursts at its top, the animal rises to at least 0.9 of its height (`HINT_MIN_REVEAL`, never lower than the level's reveal), the `hint` SFX plays, and the request is spoken again (`hintLineId` `hiding.<id>.hint.<speak>.<lang>`).
- **Hint on an audio-only level (L7–L8):** nothing visual changes; the `hint` SFX plays and the request is spoken followed by the animal's descriptive clue (`hintFor`, line id `hiding.<id>.hint.clue.<lang>`).
- **A second hint can follow a wrong tap:** the idle timer is not cancelled by a wrong tap, so on age 2 a child who taps wrong early can get the wrong-tap hint and then the idle hint at 6 s. This is the same as the restaurant. See the open decisions.

**Help card:** the HUD help button opens the Hebrew help card (`content.helpTextHe`). Opening it stops all audio and supersedes any pending speech. Today (commit `3fd6d7e`) it then reports **not listening**, because there is no help clip (fix "stop counting an open help card as listening"). **Target (Pass 1, decided 2026-11-13):** after stopping audio it plays `he.hiding.help` and reports listening only while that clip plays, like the restaurant; when the clip ends (or fails) it reports not listening again. Replays are ignored while the card is open. Closing it stops the help clip and repeats the request if the request is still open and ready. The intro (`he.hiding.intro`) plays once per visit before the first request and counts as listening while it plays.

**Leaving the game:** the HUD back button (⬅️) stops audio, persists the store, clears the bubble, and returns to the map with an iris transition (`goBack`). On scene shutdown, `cleanup()` ends the learning session (`session.exit()`) and the adaptive visit (`skills.endVisit()`). Switching profile (`returnToProfileSelect`/`pickProfile` in `src/main.ts`) also stops `HidingScene`. A hidden tab stops audio and never earns (`visibilitychange`).

- **Input mode per age:** **tap only on both tracks.** Bushes are Phaser zones with `pointerdown`; there is no drag. The engine's age-5 `policy.interaction` value (`drag`, `src/core/adaptive/policy.ts`) is not used by this game.

## Difficulty curve

- **Levels** (content: `src/content/games/who-is-hiding.json` → `adaptive.levels`; read by `hidingLevel()`; documented in `docs/adaptive-engine.md` "Who's Hiding?" on `3fd6d7e`). `reveal` is the fraction of the animal's height above the bush foliage; the visible part is named by `revealPart()` (≥ 0.85 whole, ≥ 0.65 body, ≥ 0.4 head, otherwise ears). The request frames are `name-sound` "Where is {name}? {sound}" / "Où est {name} ? {sound}", `name` "Where is {name}?" / "Où est {name} ?", `sound` "{sound}".

| L | Bushes (`choiceCount`) | Neighbours (`distractor`) | `support` | `extra.reveal` (visible part) | Request (`extra.speak`, `extra.soundMs`) | Text bubble |
|---|---|---|---|---|---|---|
| 1 | 2 | far | partial-reveal | 0.9 (whole) | name + sound | yes |
| 2 | 3 | far | partial-reveal | 0.8 (body) | name + sound | yes |
| 3 | 3 | same-category | partial-reveal | 0.6 (head) | name + sound | yes |
| 4 | 4 | same-category | partial-reveal | 0.5 (head) | name + sound | yes |
| 5 | 4 | same-category | partial-reveal | 0.3 (ears) | name | yes |
| 6 | 5 | same-category | partial-reveal | 0.3 (ears) | name | yes |
| 7 | 5 | same-category | audio-only | 0.3 (ears) | sound | no |
| 8 | 6 | same-category | audio-only | 0.3 (ears) | sound, `soundMs` 800 → short sound word | no |

  - **Neighbours** (`pickBushNeighbours`): `far` prefers animals from groups other than the target's and from each other; `same-category` takes the target's look-alike group first. Too few matches are filled from the rest. Groups are content: `big-cats` (cat, lion), `bears` (bear, panda), `pets` (dog, rabbit). With only 2 animals per group, every `same-category` request has exactly one look-alike next to the target; L8 uses all six animals.
  - **Audio-only** (L7–L8) means no visual cue for the **request** (no text bubble, no written name). The animals keep the 0.3 ear-level peek (**Decided by the owner (2026-11-12):** keep it), because every bush hides a different animal and an empty bush row would make the level a pure guess (`docs/adaptive-engine.md` on `3fd6d7e`). The schema requires an audio-only level to speak only the sound.
  - **Short sound** (L8): device TTS cannot be timed, so `extra.soundMs` (any positive number) only switches to the animal's `soundShort` word ("Meow!" instead of "Meow, meow!"); the value 800 is not used as a duration (`hidingLevel().shortSound`).
- **Age-2 start level:** L2 (3 bushes, far, 0.8 reveal, name + sound, bubble).
- **Age-5 start level:** L5 (4 bushes, same-category, ears only, name alone, bubble). Harder than age 2 in four ways: more bushes, look-alike neighbours, a smaller visible part, and no sound in the request.
- **Min / max:** both tracks min 1, max 8 (`adaptive.tracks`). **Age 2 has no ceiling**: an age-2 profile can reach the audio-only levels L7–L8.
- **Adaptive rules:** no overrides in the content; the engine defaults apply (`DEFAULT_RULES` in `src/core/adaptive/rules.ts`), the same engine and defaults as Animal Restaurant:
  - `upCleanStreak` 3: up one level after 3 clean answers in a row (assisted answers are not clean and reset the streak).
  - `downMisses` 2 in `downWindow` 3: down one level when 2 of the last 3 recorded trials are misses.
  - After a drop the engine serves a known item (box ≥ `masteredBox` 3, else the highest box seen; `selectNextItem`, `afterDrop`). A missed animal is asked again after 2 trials (`retryAfterTrials`). A new animal is introduced after 3 known ones.
  - `trialsPerRound` 3, `maxChangesPerRound` 1: at most one level change per engine round. Age 5 (`levelChange: after-trial`) changes right after the deciding trial; a drop blocked by the cap is applied at the round boundary. Age 2 (`levelChange: between-rounds`) applies a pending change only at the end of an engine round (`trackPolicy` in `src/core/adaptive/policy.ts`, `recordTrial`/`endRound`).
  - **Language fixed per engine round:** the request language is re-picked only at an engine-round boundary (`nextRoundLanguage(..., skills.atRoundBoundary(lang), settings.languages)`), or early if the parent disabled the current language.
  - Levels are stored per profile and per language under the skill key `nature-lab.who-is-hiding.<en|fr>` (`skillKey(world, id, lang)`), separate from the restaurant's keys.
  - Hints and replays never change the rules; only the idle auto-hint before the first tap marks a trial hinted (assisted).

## Leisure

`earnsLeisure: true` (content and `worlds.json`). The scene uses the shared `LearningSession` (`src/core/leisure/learningSession.ts`) exactly as the restaurant does:

- `session.start()` on scene create; a 1 s loop calls `session.tick(1)`, persists the store, and updates the HUD balance and daily-cap progress bar.
- Every bush tap (correct or wrong), replay, and help open/close calls `reportInteraction()`; speaking the request or a hint reports listening while it plays; a correct answer calls `complete()` (celebrating) until the next request starts.
- Opening the help card reports **not listening** on `3fd6d7e` (no help clip yet). **Target (Pass 1):** it plays `he.hiding.help` and reports listening only while the clip plays, the same as the restaurant's `restaurant.help`; the Hebrew intro also counts as listening while it plays.
- A hidden tab never earns (`setHidden`). Mistakes never reduce the balance; balances are per profile through `context.store.getProfileState(profileId, …)` and never mix. The daily earn cap comes from `settings.dailyEarnCapMinutes`.
- On exit `session.exit()` clears the listening and celebrating flags.

## Player journey from the map

Profile → tap the Nature Lab building on the map → `HidingScene` opens with an iris transition → play requests → back button → map.

Wiring (all on `3fd6d7e`):

- `src/content/worlds.json`: `nature-lab` changed from `locked` to `status: "open"`, `earnsLeisure: true`, `entryGameId: "who-is-hiding"`.
- `src/worlds/MapScene.ts`: a building tap with `entryGameId === 'who-is-hiding'` transitions to `HidingScene`.
- `src/game/createGame.ts`: registers `HidingScene`; `src/main.ts` loads `loadWhosHiding()` into the content bundle (`src/game/appContext.ts` `ContentBundle.hiding`) and stops `HidingScene` on profile switch and on returning to profile select.
- `src/content/schema.ts` (`WhosHidingContentSchema`, `HidingAnimalSchema`, `HIDING_SPEAK_MODES`) and `src/content/loadContent.ts` (`loadWhosHiding`) validate the content at load.
- `src/pwa/updatePolicy.ts`: new `AppScreen` value `'hiding'`, set by `setAppScreen('hiding')` on scene create. It is unsafe for a mid-game update because `isSafeToApplyUpdate` allows only `profile` and `map`.
- `src/ui/hud.ts`: map pins get `data-world-id` (`node.dataset.worldId = pin.id`), used by the current e2e test to locate the Nature Lab label.

Handles that exist today:

- **Map building hit target:** `__testHooks__.getBuildingHit(worldId)` returns `{ x, y, width, height } | null` in **page CSS pixels** (top-left; accounts for canvas scaling and letterboxing; `null` when the map is not active or the world has no building). It is **added in draft PR #37 (branch `test/e2e-infra-v2`, not on `main` yet)**. Today (without PR #37) the e2e test taps 88 game units above the `.shell-map-pin[data-world-id="nature-lab"]` label (`openFromMap` in `tests/e2e/hiding.spec.ts`), which depends on the map layout; it switches to `getBuildingHit('nature-lab')` or the shared helper once PR #37 lands.
- **Shared Playwright helper:** `enterWorldByTap(page, profile, worldId)` in `tests/e2e/helpers/journey.ts` (added in draft PR #37, not on `main` yet): opens `/?e2e=1`, taps the profile, waits for the map, taps the building centre from `getBuildingHit`, and waits for the world's game scene. Its `WORLD_SCENE` table in PR #37 does not list `nature-lab` yet; the game's journey adds `'nature-lab': 'HidingScene'` there.
- **`data-testid`s** (final shared names; the new ones are added in draft PR #37, not on `main` yet): `profile-a` (the age-2 profile; `profile-b` is age 5), `leisure-balance`, `star-count`, `parent-gate-btn` (existing); `hud-back` (back pill), `hud-help` (help pill), `prompt-bubble` (request bubble), `help-card` (help card), `help-card-close` (the whole help overlay: tapping anywhere closes it; there is no separate close button). Today the tests use the CSS hooks `.shell-prompt-bubble` and `.shell-map-pin[data-world-id="nature-lab"]`; they switch to the testids once PR #37 lands.
- **Seed and read hooks under `?e2e=1`** (`window.__testHooks__`, `src/game/createGame.ts`):
  - `seedBalanceSec(sec)` — seed (existing).
  - `seedHidingLevel(level)` — seed: sets the stored level for every content language and resets the streak and recent window (new on PR #29).
  - `getRoundInfo()` — read: returns `HidingRoundInfo` (`request: 'hiding'`, `correctIndex`, `choiceIds`, `targetId`, `choiceCenters`, `replayCenter`, `choiceCount`, `language`, `promptText`, `visualCue`, `reveal`, `speak`, `tries`, `hinted`, `level`, `skillKey`, `correctCount`, `ready`) while `HidingScene` is active.
  - `getActiveScenes()`, `getGameSize()` — read (existing).
  - `goToScreen('hiding')` — navigation; **not allowed** in AC tests (`docs/PROCESS.md` §4). It is used today by the L7 test and must be replaced by a map-entry journey.
  - `getBuildingHit(worldId)` — read, page CSS pixels (see above; draft PR #37).
  - `getSpokenLines(sinceIndex?)` — read: returns `Array<{ index, lineId, lang, source: 'clip' | 'tts', text?, at }>`; `getSpokenLineCount()` — read: returns a number. The speech spy for voice criteria; read-only, `?e2e=1` only; added in draft PR #37 (not on `main` yet). No test uses it for this game today.

## Acceptance criteria

Ids are stable: never renumber or reuse them; strike through a removed one. Test titles start with the id, in `tests/**/who-is-hiding*` files (or a `who-is-hiding/` folder).

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Nature Lab building → Who's Hiding? → one request answered → back button → map; the game opens only from the Nature Lab building | 1 | e2e | both | `getBuildingHit`, `getRoundInfo`, `getActiveScenes`; testid `hud-back` |
| AC-02 | A correct bush tap: the animal pops out, a "found" line in the request's language is spoken, the star count rises by one, and the next request starts | 1 | e2e | @single-orientation | `getRoundInfo`, `getSpokenLines`; testid `star-count` |
| AC-03 | A wrong bush tap wobbles that bush, gives the age's retry or hint flow (Mechanic step 6), and never reduces the leisure balance | 1 | e2e | @single-orientation | `getRoundInfo`, `seedBalanceSec` |
| AC-04 | Level rises after 3 clean answers and drops when 2 of the last 3 trials are misses, with at most one change per engine round; age 2 changes only between engine rounds, age 5 after the trial | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level (for example a seeded age-2 profile at L2 rises to L3 after three clean answers and the next engine round shows 3 bushes with same-category neighbours) | 1 | e2e+seed | @single-orientation | `seedHidingLevel`, `getRoundInfo`, `getBuildingHit` |
| AC-06 | High levels play correctly: seeded L7 and L8 entered from the map show 5 and 6 bushes, no text bubble, a sound-only request (L8 the short sound word), and accept a correct tap | 1 | e2e+seed | @single-orientation | `seedHidingLevel`, `getRoundInfo`, `getBuildingHit` |
| AC-07 | A new age-2 profile starts at L2 and a new age-5 profile at L5; both tracks have min 1 and max 8 (no age-2 ceiling) | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues through `LearningSession` as specified (interaction, listening, celebrating; not while hidden; not while the help card is open and no help clip is playing), never drops on mistakes, never mixes across profiles | 1 | unit | @single-orientation | |
| AC-09 | Content and language: every animal has EN/FR name, sound, short sound and clue; the request language follows the parent's language setting | 1 | unit | @single-orientation | |
| AC-10 | Each voice line requests the right line id, language and text (request, hint, found line, Hebrew retry/praise/leisure-earned) through a speech spy | 1 | e2e | @single-orientation | `getRoundInfo`, `getSpokenLines`, `getSpokenLineCount` |
| AC-11 | Smoke: a request can be answered at `1280x800` and `800x1280` with all bushes on screen | 1 | e2e | both | `getRoundInfo`, `getBuildingHit` |
| AC-12 | The game works offline (Nature Lab art and content load from the PWA cache) | 1 | e2e | @single-orientation | `getBuildingHit` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch on bushes, rotation mid-game, audible EN/FR device TTS and Hebrew lines, visuals (masking, peek, pop-out) | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | Level levers match the Difficulty curve table for L1–L8 (bushes, neighbours, support, reveal, speak, short sound), every request has distinct bushes with the target exactly once, and the target spreads over all positions | 1 | unit | @single-orientation | |
| AC-17 | Neighbours: `far` levels take other groups first; `same-category` levels always place the target's look-alike; too few matches are filled from other groups (L8 uses all six) | 1 | unit | @single-orientation | |
| AC-18 | Visible part: each animal shows exactly its level's `reveal` fraction above the foliage (whole/body/head/ears); audio-only levels keep the 0.3 ear-level peek and show no text bubble | 1 | unit | @single-orientation | |
| AC-19 | Spoken request per level: name + sound (L1–L4), name (L5–L6), sound (L7), short sound (L8), in EN and FR, with distinct line ids per animal, mode and language | 1 | unit | @single-orientation | |
| AC-20 | Tapping the speaker button or the request bubble replays the request: no try, not hinted, nothing recorded | 1 | e2e | @single-orientation | `getRoundInfo`; testid `prompt-bubble` |
| AC-21 | Age 2 only: 6 s after the request is ready and with no correct tap, the idle auto-hint rustles the correct bush and lifts its animal to at least 0.9, and marks the trial hinted only before the first tap; age 5 gets no idle auto-hint | 1 | e2e | @single-orientation | `getRoundInfo` |
| AC-22 | On audio-only levels the hint changes nothing visually and speaks the request followed by the animal's clue; on other levels the hint speaks the request again | 1 | unit | @single-orientation | |
| AC-23 | A trial is recorded exactly once, on the first accepted bush tap; a double tap within 400 ms counts as one try; a hint after a recorded miss changes nothing | 1 | e2e | @single-orientation | `getRoundInfo` |
| AC-24 | After a level drop the next target is a known animal; the same animal is not asked twice in a row | 1 | unit | @single-orientation | |
| AC-25 | The request language stays fixed for the 3 trials of an engine round and is re-picked at the boundary (or early if the parent disables it) | 1 | unit | @single-orientation | |
| ~~AC-26~~ | ~~Help card: opening it stops audio, does not count as listening, blocks replays and postpones the idle hint; closing it repeats the open request~~ Superseded by AC-35 (the help card now plays a help clip) | 1 | e2e | @single-orientation | `getRoundInfo`, `getSpokenLines`; testids `hud-help`, `help-card`, `help-card-close` |
| AC-27 | Input is tap-only on both tracks: an age-5 profile answers by tapping a bush (no drag) | 1 | e2e | @single-orientation | `getRoundInfo`, `getBuildingHit` |
| AC-28 | Layout: 2–6 bushes fit in both orientations with non-overlapping hit areas inside the screen and below the speaker button | 1 | unit | @single-orientation | |
| AC-29 | The `hiding` screen is unsafe for a mid-game PWA update; profile and map stay safe | 1 | unit | @single-orientation | |
| AC-30 | Nature Lab is open on the map with `entryGameId` `who-is-hiding`; the skill key `nature-lab.who-is-hiding.<lang>` is distinct from the restaurant's | 1 | unit | @single-orientation | |
| AC-31 | The content schema rejects bad track bounds, missing or unsupported levers, bad prompt frames, duplicate animal ids, and same-category levels without a look-alike group | 1 | unit | @single-orientation | |
| AC-32 | The Hebrew intro `heLine('hiding.intro')` (speech-spy `lineId` `he.hiding.intro`, `lang` `he`) plays exactly once per visit, before the first request, and not again on later requests; leaving to the map and re-entering plays it once more | 1 | e2e | @single-orientation | `getSpokenLines`, `getRoundInfo`, `getBuildingHit`; testid `hud-back` |
| AC-33 | When the help card opens (tap on the help pill), `heLine('hiding.help')` plays (speech-spy `lineId` `he.hiding.help`, `lang` `he`) | 1 | e2e | @single-orientation | `getSpokenLines`; testids `hud-help`, `help-card` |
| AC-34 | The clips `audio/he/hiding-intro.mp3` and `audio/he/hiding-help.mp3` exist, `voice-lines-he.json` has `hiding.intro` and `hiding.help` (non-empty text), and the `audio-manifest.json` rows and text hashes match | 1 | unit | @single-orientation | |
| AC-35 | Help card (replaces AC-26): opening it stops audio, plays the help clip and counts as listening only while the clip plays, blocks replays and postpones the idle hint; closing it stops the clip and repeats the open request | 1 | e2e | @single-orientation | `getRoundInfo`, `getSpokenLines`; testids `hud-help`, `help-card`, `help-card-close` |
| AC-36 | Pass 2: more look-alike pairs (animals with new art) are in the content and every `same-category` request still places a look-alike | 2 | unit | @single-orientation | |
| AC-37 | Pass 2: a clue-only request level and a two-clue request level exist and are reachable on the age-5 track | 2 | e2e+seed | @single-orientation | `seedHidingLevel`, `getRoundInfo`, `getBuildingHit` |

### Existing test mapping (retroactive)

These tests exist **only on PR #29** (branch `feat/game-hiding`, commit `3fd6d7e`), not on `main` yet. None carries an `[AC-xx]` tag. Their files are `tests/unit/hidingContent.test.ts`, `tests/unit/hidingRound.test.ts`, and `tests/e2e/hiding.spec.ts`; the names do not start with the game id `who-is-hiding`, so `npm run check:ac` would not count them once `Pass in progress` moves past `none`. Generic engine tests on `main` (for example `tests/unit/adaptiveRules.test.ts`, `tests/unit/learningSession.test.ts`, `tests/unit/pwaUpdatePolicy.test.ts`) do not use this game's content and are not listed.

| AC | Existing tests (file — exact test title) | Gap |
|---|---|---|
| AC-01 | `tests/e2e/hiding.spec.ts` — `profile select -> map -> Nature Lab opens a ready round at the age-2 start level` | Enters through the pin label offset, not `getBuildingHit` / `enterWorldByTap` (draft PR #37); does not answer a request or exit to the map; does not check that only this building opens the game |
| AC-02 | `tests/e2e/hiding.spec.ts` — `a clean correct tap completes the trial and starts the next round`; `tests/e2e/hiding.spec.ts` — `a wrong bush never reduces the leisure balance; the correct bush adds one star and completes the trial`; `tests/unit/hidingRound.test.ts` — `only the bush that hides the requested animal is correct` | No assertion on the pop-out or the "found" line (`getSpokenLines`, draft PR #37) |
| AC-03 | `tests/e2e/hiding.spec.ts` — `a wrong bush never reduces the leisure balance; the correct bush adds one star and completes the trial` | The retry/hint flow per age is not asserted (only `tries` and the balance) |
| AC-04 | `tests/unit/hidingRound.test.ts` — `records once on the first accepted tap: a wrong tap is the miss, later taps record nothing`; `tests/unit/hidingRound.test.ts` — `a clean first tap is recorded once` | Only the trial inputs are tested; no level-change test with this game's metadata |
| AC-05 | — | No test |
| AC-06 | `tests/e2e/hiding.spec.ts` — `a seeded higher level (L7, audio-only) shows no visual cue for the request` | Uses `goToScreen('hiding')` (legacy, not allowed); no L8; does not answer a request |
| AC-07 | `tests/unit/hidingContent.test.ts` — `has 8 levels; age 2 starts at L2 and age 5 at L5, both with min 1 and max = levels.length (no age-2 ceiling)`; `tests/unit/hidingContent.test.ts` — `the age-5 start is meaningfully harder than the age-2 start`; `tests/e2e/hiding.spec.ts` — `profile select -> map -> Nature Lab opens a ready round at the age-2 start level` | Content values only; no test that a new age-5 profile starts at L5 |
| AC-08 | `tests/e2e/hiding.spec.ts` — `a wrong bush never reduces the leisure balance; the correct bush adds one star and completes the trial` | Only "never reduced"; no accrual, help-card, or profile-isolation test for this game |
| AC-09 | `tests/unit/hidingContent.test.ts` — `validates and every animal has EN/FR name, sound, short sound and clue`; `tests/unit/hidingRound.test.ts` — `every animal composes a non-empty prompt in every language at every level` | No test that the language setting (en / fr / both) selects the request language in this game |
| AC-10 | — | No speech spy test (`getSpokenLines` / `getSpokenLineCount` come with draft PR #37) |
| AC-11 | `tests/e2e/hiding.spec.ts` — `profile select -> map -> Nature Lab opens a ready round at the age-2 start level` (runs in both projects, no `@single-orientation` tag) | Does not answer a request; no L8 (6 bushes) check |
| AC-12 | — | No test |
| AC-13 | — | No test for this game |
| AC-14 | — (device) | Not yet run on the tablet |
| AC-15 | — | Pass 2; no clips |
| AC-16 | `tests/unit/hidingContent.test.ts` — `the level curve never gets easier: bushes up, reveal down, speech thinner`; `tests/unit/hidingRound.test.ts` — `gives each level the right number of distinct bushes, containing the target exactly once`; `tests/unit/hidingRound.test.ts` — `level 3 (3 bushes, same-category) and level 1 (2 bushes, far) differ as specified`; `tests/unit/hidingRound.test.ts` — `reveal and audio-only come from the level, per level`; `tests/unit/hidingRound.test.ts` — `spreads the target over all bush positions` | No exact per-level check of every lever value in the table |
| AC-17 | `tests/unit/hidingRound.test.ts` — `far levels pick neighbours from other groups first`; `tests/unit/hidingRound.test.ts` — `same-category levels always put the look-alike next to the target`; `tests/unit/hidingRound.test.ts` — `fills from other groups when the target group is too small (L8 uses all six animals)` | — |
| AC-18 | `tests/unit/hidingContent.test.ts` — `the reveal fraction maps to the visible part of the animal`; `tests/unit/hidingRound.test.ts` — `puts the animal feet so that exactly the reveal fraction shows above the foliage`; `tests/e2e/hiding.spec.ts` — `a seeded higher level (L7, audio-only) shows no visual cue for the request` | The e2e test uses `goToScreen` |
| AC-19 | `tests/unit/hidingRound.test.ts` — `name-sound levels say the name and the sound`; `tests/unit/hidingRound.test.ts` — `name levels say only the name`; `tests/unit/hidingRound.test.ts` — `audio-only levels say only the sound, and the last level uses the short sound`; `tests/unit/hidingRound.test.ts` — `line ids are distinct per animal, mode and language` | — |
| AC-20 | `tests/e2e/hiding.spec.ts` — `tapping the speaker or the request bubble replays it: no try, no hint, no recorded trial`; `tests/e2e/hiding.spec.ts` — `a seeded higher level (L7, audio-only) shows no visual cue for the request`; `tests/unit/hidingRound.test.ts` — `the idle auto-hint marks the trial hinted; a voluntary replay (which never calls onHint) does not` | — |
| AC-21 | `tests/unit/hidingRound.test.ts` — `the idle auto-hint marks the trial hinted; a voluntary replay (which never calls onHint) does not` | Tracker only; no scene test of the 6 s timer, the lift and rustle, or its absence on age 5 |
| AC-22 | `tests/unit/hidingRound.test.ts` — `audio-only hints add the clue; other hints just repeat the request` | No check that nothing visual changes on audio-only levels |
| AC-23 | `tests/e2e/hiding.spec.ts` — `a wrong bush never reduces the leisure balance; the correct bush adds one star and completes the trial`; `tests/unit/hidingRound.test.ts` — `records once on the first accepted tap: a wrong tap is the miss, later taps record nothing`; `tests/unit/hidingRound.test.ts` — `a hint after the miss was recorded changes nothing` | — |
| AC-24 | — | No game-level test (only the generic engine tests on `main`) |
| AC-25 | `tests/unit/hidingRound.test.ts` — `the language stays fixed within a round and is re-picked at the boundary` | Tests the shared helper, not the scene's use of `atRoundBoundary` |
| ~~AC-26~~ | — | Superseded by AC-35 |
| AC-32 | — | New (2026-11-13); no test |
| AC-33 | — | New; no test |
| AC-34 | — | New; no test |
| AC-35 | — | New; no test (replaces AC-26) |
| AC-36 | — | Pass 2; no test |
| AC-37 | — | Pass 2; no test |
| AC-27 | `tests/e2e/hiding.spec.ts` — `a clean correct tap completes the trial and starts the next round` | Age-2 profile only; no age-5 tap test |
| AC-28 | `tests/unit/hidingRound.test.ts` — `fits every bush count in both orientations without overlapping hit areas` | — |
| AC-29 | — | `tests/unit/pwaUpdatePolicy.test.ts` does not cover `hiding` |
| AC-30 | `tests/unit/hidingContent.test.ts` — `Nature Lab is open on the map and its entry game is Who's Hiding?`; `tests/unit/hidingContent.test.ts` — `the skill key is distinct from the restaurant skill keys` | — |
| AC-31 | `tests/unit/hidingContent.test.ts` — `rejects bad track bounds, missing levers and unsupported values`; `tests/unit/hidingContent.test.ts` — `rejects bad frames, duplicate animal ids and same-category without a look-alike group` | — |

### Missing tests

Needed before `Pass in progress` can move to `1`:

- **Rename and retag:** move the tests to files that belong to the game (for example `tests/unit/who-is-hiding.content.test.ts`, `tests/unit/who-is-hiding.round.test.ts`, `tests/e2e/who-is-hiding.spec.ts`) and prefix every mapped title with its `[AC-xx]` tags; tag orientation-independent e2e titles `@single-orientation`.
- **Replace legacy navigation:** the L7 test uses `goToScreen('hiding')`; enter from the map building instead. Replace the pin-label offset in `openFromMap` with `enterWorldByTap(page, profile, 'nature-lab')` (or `getBuildingHit('nature-lab')`), available once draft PR #37 lands (add `'nature-lab': 'HidingScene'` to its `WORLD_SCENE` table).
- **AC-01:** answer one request and exit to the map with the back button (tap `hud-back`, added in draft PR #37); check that no other building opens `HidingScene`.
- **AC-02:** assert the "found" line (`getSpokenLines`) and the next request.
- **AC-03:** assert the per-age wrong-tap flow (age 2 hint with the Hebrew retry first; age 5 retry plus request, then hint on the second wrong tap).
- **AC-04:** a unit test that records trials through `SkillSession` with this game's metadata on both tracks.
- **AC-05:** a seeded real-tap level change at a low level.
- **AC-06:** seeded L7 and L8 from the map, answering a request; L8 short sound and 6 bushes.
- **AC-07:** a fresh age-5 profile (`profile-b`) starts at L5.
- **AC-08:** a game-level leisure test (accrual, help card not listening, profile isolation).
- **AC-09:** language selection from the parent setting (`en`, `fr`, `both`).
- **AC-10:** a speech spy test (`getSpokenLines` / `getSpokenLineCount`) for request, hint, found, and Hebrew lines.
- **AC-11:** answer a request in both viewports, including a 6-bush layout.
- **AC-12:** an offline test.
- **AC-13:** a parent-gate test without `?e2e=1` for this game's build.
- **AC-21:** an e2e test of the age-2 idle hint (lift ≥ 0.9, `hinted`) and its absence on age 5.
- **AC-22:** a check that nothing visual changes on an audio-only hint.
- **AC-24:** a unit test that a drop serves a known animal and the same animal is not repeated.
- **AC-25:** a scene-level check that the language is constant across an engine round.
- **AC-35 (replaces AC-26):** a help-card test (open with `hud-help`, close by tapping `help-card-close`; stops audio, plays the help clip and listens only while it plays, closing repeats the request).
- **AC-32, AC-33, AC-34:** intro once per visit and help-pill line through the speech spy; clips, text and hashes exist for `he.hiding.intro` and `he.hiding.help` (record with `scripts/tts/generate_voice.py`).
- **AC-27:** an age-5 tap test.
- **AC-29:** add `hiding` to the PWA update-policy test.
- **AC-15:** Pass 2 only (the Hebrew intro and help clips are Pass 1, AC-34).
- **AC-36, AC-37:** Pass 2 only.

## Art, animation, and audio

### Pass 1 — working game

- **Asset paths and manifest keys** (`src/assets/art/manifest.ts` on `3fd6d7e`; files from PR #18 merged into PR #29 in commit `d479c07`):
  - `prop-bush-round-back` → `art/props/bush-round-back.svg` (360 × 280)
  - `prop-bush-round-front` → `art/props/bush-round-front.svg` (360 × 280)
  - `prop-bush-tall-back` → `art/props/bush-tall-back.svg` (280 × 360)
  - `prop-bush-tall-front` → `art/props/bush-tall-front.svg` (280 × 360)
  - `hiding-bg-landscape` → `art/scenes/hiding/bg-landscape.svg` (1280 × 800)
  - `hiding-bg-portrait` → `art/scenes/hiding/bg-portrait.svg` (800 × 1280)
  - **Decided by the owner (2026-11-13):** rename the scene art folder to `public/art/scenes/hiding/` (named after the game, as the template asks). **Implementation item:** on `3fd6d7e` the files are `art/scenes/nature-lab/bg-landscape.svg` and `bg-portrait.svg` under the manifest keys `nature-lab-bg-landscape` / `nature-lab-bg-portrait`; move the files, rename the keys to `hiding-bg-*` (the names above are the target), and update `src/assets/art/manifest.ts`, the scene's use of the keys, and `tests/unit/artAssets.test.ts`.
  - Animals: the six existing animal kinds (cat, lion, bear, panda, dog, rabbit) through `Character` with `kind` from the content, i.e. the existing restaurant animal art; no new `CHARACTER_RIGS` entry.
  - Procedural fallbacks keep the game playable without art: green ellipses for bushes and a sky/grass fill for the background (`bushImage`, `paintBackground`).
- **SVG contract:** the bush and scene SVGs come from PR #18 and are covered by `tests/unit/artAssets.test.ts` on `3fd6d7e` (size and content rules).
- **Rigs:** no new rig; animals reuse the existing animal rigs. Bush art is anchored bottom-centre; the front foliage's top is at `BUSH_ART.topFrac` (round 0.54, tall 0.52) and the animal's visible part is measured from there (`hidingLayout.ts`).
- **Layout** (`computeHidingLayout`): bushes in one or two rows below a top band of `max(190, 20% of height)`; columns: up to 3 in one row, landscape up to 5 in one row (6 → 3 × 2), portrait `ceil(n/2)` per row; bush width capped at 300 game units; hit rectangles span the column minus a 10-unit gap and extend from 0.6 animal heights above the foliage to the bush bottom; speaker button at `(width − 72, 15.5% of height)`, radius 44. Tap targets: **Decided by the owner (2026-11-12):** the minimum tap-target size is 64 px. The speaker button is 88 game units across, which is smaller in CSS px on a tablet under Phaser FIT scaling; it and the bush hit areas have not been measured against 64 px on the tablet yet. If items do not fit at that size, pan or show fewer; never shrink them.
- **RTL:** the game reuses the restaurant HUD (`shell.setRestaurantChrome`: back button, progress bar, star pill, balance, help button labelled with `restaurant.helpButton`). Hebrew chrome is RTL; the request bubble uses `ltr-isolate` for the EN/FR text.
- **Animation:** `ANIM_PROFILE.hiding` knobs `rustle`, `peek`, `reveal`, `hide` (`src/anim/profiles.ts`); helpers `rustleBush`, `revealFromBush` used by the scene, and `peekFromBush`, `hideInBush` added but unused (`src/anim/worldMotion.ts`). Also reused: `popIn`, `pressSquash`, `wobble`, `hintPulse`, `flyArc`, `Juice` bursts, `Character.happy/hmm/talk`, iris `transitionTo`. The scene checks `isReducedMotion()` itself only for the star-pill bump; the shared helpers apply their own motion scaling (for example `amp` in `worldMotion.ts`).
- **Voice table** (all EN/FR lines use device TTS through `AudioManager.play({ lineId, lang, text })`; none has an entry in `audio-manifest.json`. Hebrew lines are the existing shared clips.)

| lineId | lang (`en` / `fr` / `he`) | Text | Trigger |
|---|---|---|---|
| `hiding.<animalId>.name-sound.<lang>` | en, fr | `Where is {name}? {sound}` / `Où est {name} ? {sound}` | L1–L4: request ready, replay, help closed, age-5 first wrong tap |
| `hiding.<animalId>.name.<lang>` | en, fr | `Where is {name}?` / `Où est {name} ?` | Same triggers, L5–L6 |
| `hiding.<animalId>.sound.<lang>` | en, fr | `{sound}` (for example `Meow, meow!` / `Miaou, miaou !`) | Same triggers, L7 |
| `hiding.<animalId>.sound-short.<lang>` | en, fr | `{soundShort}` (for example `Meow!` / `Miaou !`) | Same triggers, L8 |
| `hiding.<animalId>.hint.<speak>.<lang>` | en, fr | The level's request again | Hint on L1–L6 (age-2 idle or wrong tap; age-5 second wrong tap) |
| `hiding.<animalId>.hint.clue.<lang>` | en, fr | The request (L8 with the short sound) plus the animal's `clue` | Hint on L7–L8 |
| `hiding.found.<lang>.<0-2>` | en, fr | `Peekaboo!` / `Surprise!` / `You found me!`; `Coucou !` / `Surprise !` / `Tu m'as trouvé !` | Correct tap |
| `he.retry.<n>` (`heVariant('retry')`) | he | Existing shared retry line | First wrong tap of a request (before the hint on age 2, before the request on age 5) |
| `he.praise.<n>` (`heVariant('praise')`) | he | Existing shared praise line | Every 3rd correct answer of the visit |
| `he.leisure.earned` (`heLine('leisure.earned')`) | he | Existing shared line | After a correct answer when the balance crossed a whole minute and no praise is due |
| `he.hiding.intro` | he | New recorded Leda clip (Pass 1), same pattern as `he.restaurant.intro`. Meaning: welcome to the meadow, animals are hiding behind the bushes, listen to who is wanted and tap the right bush. Feminine singular, addressing one girl, natural for ages 2–5. The Hebrew text is authored in `src/content/voice-lines-he.json` as `hiding.intro` | Once per visit, before the first request |
| `he.hiding.help` | he | New recorded Leda clip (Pass 1), same pattern as `he.restaurant.help`. Meaning: listen to the request, look for the animal that is peeking out, tap its bush, and tap the speaker to hear it again. Feminine singular, ages 2–5. The Hebrew text is authored in `src/content/voice-lines-he.json` as `hiding.help` | The help pill (HUD ❓) is tapped |

  `{name}`, `{sound}`, `{soundShort}`, `{clue}` come from each animal in `src/content/games/who-is-hiding.json`. **Decided by the owner (2026-11-13):** Pass 1 adds a recorded Hebrew intro (`he.hiding.intro`) and help line (`he.hiding.help`), Leda clips like the restaurant's (`he.restaurant.intro`, `he.restaurant.help`). Each needs a `voice-lines-he.json` entry (`hiding.intro`, `hiding.help`), an `audio-manifest.json` row (`audio/he/hiding-intro.mp3`, `audio/he/hiding-help.mp3`), the clip, and its text hash. The intro plays once per visit before the first request (the restaurant's `introPending` pattern); the help clip plays when the help pill opens the help card, which stays shown with its text. The Hebrew wording is not written in this spec because repository documentation is English only; it is authored in the voice-lines file at implementation and reviewed by the owner with the clips.
- **World and PWA wiring:** `nature-lab` `entryGameId: "who-is-hiding"`, `earnsLeisure: true`, `status: "open"`; `AppScreen` `'hiding'` unsafe for mid-game updates (see Player journey).

### Pass 2 — polish

- Not started. Candidates: richer bush and meadow art, a peek/hide idle loop using the unused `peekFromBush`/`hideInBush`, more animals with art (more look-alike pairs, AC-36), clue-only and two-clue request levels (AC-37).
- Recorded Gemini TTS clips (voice Leda) for the EN/FR lines of the voice table (the Hebrew intro and help clips are Pass 1), rendered with `scripts/tts/generate_voice.py`; device TTS stays the fallback. No `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.

## Out of scope

- Clue-only and two-clue request levels (research age-5 ladder) are Pass 2 (AC-37), not Pass 1; describing-word requests.
- Animals without existing art (for example a tiger), and more than six animals.
- Response-time scoring (`useResponseTime` stays false) and drag input.
- Parent tools specific to this game.
- Pass 2 items until approved.
- A second Nature Lab game ("Who Lives Here?").

## Open decisions for the owner

All open decisions were resolved by the owner on 2026-11-13.

- **Decided by the owner (2026-11-12):** L7–L8 keep the ear-level peek (`reveal` 0.3) instead of a fully invisible animal; "audio-only" means only that the request has no text bubble. Fully hidden animals would make the level a pure guess with one animal per bush.
- **Decided by the owner (2026-11-13):** the `soundShort` word is accepted for L8 (a shorter sound word, for example "Meow!", not an 800 ms sound). Revisit with recorded clips in Pass 2.
- **Decided by the owner (2026-11-13):** the three look-alike pairs (cat/lion, bear/panda, dog/rabbit) are accepted; each `same-category` request has exactly one look-alike. More pairs are Pass 2 (AC-36).
- **Decided by the owner (2026-11-13):** add a recorded Hebrew intro and help line in Pass 1 (`he.hiding.intro`, `he.hiding.help`, Leda clips like the restaurant's); see the voice table and AC-32 to AC-35. This replaces the earlier text-only help card.
- **Decided by the owner (2026-11-13):** keep the second hint after a wrong tap (age 2: the wrong-tap hint and then the 6 s idle hint), the same as the restaurant.
- **Decided by the owner (2026-11-12):** age 5 gets no idle auto-hint (same as the restaurant); a hint comes only after a mistake. This is intended behaviour.
- **Decided by the owner (2026-11-13):** no age-2 ceiling (confirmed): an age-2 profile can climb to the audio-only levels L7–L8.
- **Decided by the owner (2026-11-13):** accepted as written: the tablet check (AC-14) has not run yet and stays a Pass 1 device criterion.
- **Decided by the owner (2026-11-13):** merge order with PR #18: the art branch `feat/art-hiding-orchestra` (PR #18) was merged into PR #29 (`d479c07`). PR #29 is based on `924114e`, before Kitchen Orchestra (#28) landed on `main`; `main` already has the orchestra and chef art and its own `src/anim/worldMotion.ts`, `profiles.ts`, `manifest.ts`, `createGame.ts`, `MapScene.ts`, `main.ts` and `updatePolicy.ts` (`AppScreen` with `'orchestra'`) changes. PR #29 needs a rebase onto `main` with additive merges of these shared registries. Merge order: PR #18 first, then rebase PR #29.
- **Decided by the owner (2026-11-12):** the minimum tap-target size is 64 px. Whether the 88-unit speaker button meets it on the tablet is part of the tablet check (AC-14).
- **Decided by the owner (2026-11-13):** Who's Hiding? is the Nature Lab entry game rather than "Who Lives Here?"; a Who's Hiding? section is added to `docs/WORLDS.md` as an implementation item.
- **Decided by the owner (2026-11-13):** rename the scene art folder to `public/art/scenes/hiding/` (implementation item).
- **Decided by the owner (2026-11-13):** clue-only and two-clue request levels are Pass 2 (AC-37); in Pass 1 clues appear only in audio-only hints.
- **Decided by the owner (2026-11-13):** the age-2 start at L2 (3 bushes) is confirmed.

## Changelog

- `2026-11-12` — created (retroactive spec of the existing game) — substantive
- `2026-11-12` — applied owner decisions: minimum tap target 64 px; age 5 has no idle auto-hint, a hint comes only after a mistake (intended behaviour); L7–L8 keep the ear-level peek — minor
- `2026-11-12` — aligned test handles with the shared names in draft PR #37 (`hud-back`, `hud-help`, `prompt-bubble`, `help-card`, `help-card-close`, `getBuildingHit` in page CSS pixels, `getSpokenLines` / `getSpokenLineCount`, `enterWorldByTap`) — minor
- 2026-11-13 — approved by the owner; all open decisions and team-lead proposals resolved (Nature Lab entry game, scene folder `scenes/hiding/`, L8 short sound word, three look-alike pairs, Hebrew intro and help clips in Pass 1, second hint kept, no age-2 ceiling, merge order PR #18 then PR #29, clue-only levels Pass 2, age-2 start L2); 6 ACs added (AC-32 to AC-37; AC-26 superseded by AC-35) — substantive
- 2026-11-13 — AC-32 and AC-33 reworded to name the Hebrew lines as `heLine('hiding.intro')` (once per visit) and `heLine('hiding.help')` (when the help card opens), both asserted with `getSpokenLines`; the clips are on draft audio PR #39; implementation lands with the #29 rebase — clarification

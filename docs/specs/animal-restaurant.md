# `animal-restaurant` — Animal Restaurant

Status: **draft — pending owner approval**
Pass in progress: **none**

> **Retroactive spec.** This document describes Animal Restaurant **as implemented** on `origin/main` @ `6512714`, not as intended. Every behaviour below cites the file it comes from. Where the code differs from earlier direction text (`docs/WORLDS.md`, `docs/adaptive-engine.md`) or from the template's expectations, the difference is flagged as an **Open decision for the owner:** and the code's behaviour is what is described. Handles and hooks that the process requires but that are not on `main` yet are marked as added in draft PR #37 (branch `test/e2e-infra-v2`, not on main yet), never as existing.

## Summary

An animal walks up to a restaurant counter and asks out loud, in English or French, for food. The child taps the plate that matches the request; the food flies into the animal's mouth, the animal munches and thanks her, a star flies to the top bar, and the next animal comes in. The child learns to understand food nouns, quantities (one to three), colour attributes, two-item requests, and negation ("but not the red one") in English and French. The game sits in the Language House world and is that world's entry game (`src/content/worlds.json`, `src/content/games/animal-restaurant.json`).

## Learning goals

- **Age 2:** recognise spoken English and French food nouns and the quantities one to three (start level L4: three plates, quantity requests), with the floor levels L1–L3 for plain nouns among very different or look-alike foods. Age 2 has no ceiling and can climb through colour, two-item, and negation requests (L6–L9).
- **Age 5:** the same skill set starting one level higher (L5: four plates, quantities, look-alike distractors), climbing to colour attributes (L6), two foods in one request (L7), negation (L8), and negation heard only, with no text or visual cue (L9).

## World and why

- **World:** Language House (`"world": "language-house"` in `src/content/games/animal-restaurant.json`; `entryGameId: "animal-restaurant"` in `src/content/worlds.json`).
- **Why this game belongs there:** the child understands a request in the learning language and acts on it in a small world (`docs/WORLDS.md`, "Language House → 1. Animal Restaurant — the existing flagship game").
- **Open decision for the owner:** `docs/WORLDS.md` still describes age 2 as "a choice between two foods" and age 5 as "a request with a quantity or an attribute … sometimes two steps". The code starts age 2 at L4 (three plates with quantities) and age 5 at L5, following the owner's playtesting decision recorded in `docs/adaptive-engine.md` §7. Confirm the code's start levels and whether `docs/WORLDS.md` should be updated to match (a separate docs change).

## Mechanic

All references are to `src/games/restaurant/RestaurantScene.ts` unless stated.

**Visit start.** Entering the scene calls `setAppScreen('restaurant')`, creates a `LearningSession` (leisure) and a `SkillSession` (adaptive) for the current profile, builds the top bar (back pill, star count, leisure balance, help pill; `src/ui/hud.ts`), and starts the first trial.

**One trial (one animal).**

1. The language is chosen for the round (see Difficulty curve), the level is read from the stored skill of that language, and the engine selects the target item (`skills.selectNextItem`) from the items eligible for the level (`eligibleTargetIds` in `src/games/templates/choiceServe.ts`). `buildRound` builds the plates and the request.
2. A random animal (bear, rabbit, cat, dog, panda, lion; never the same kind twice in a row; `ANIMAL_KINDS` in `src/assets/vectorArt.ts`) hops in from the left. The plates pop in with a stagger and then breathe gently ("tap me" invite pulse).
3. When the animal has entered, it speaks the request. On the **first animal of a visit only**, the Hebrew intro line `he.restaurant.intro` plays first and the request follows it (never overlapping).
4. Except on voice-only levels, a DOM prompt bubble shows the request text with a 🔊 marker (`renderPromptBubble` in `src/ui/hud.ts`, LTR-isolated). Tapping the bubble or the animal replays the request; neither is an answer and neither is a hint.
5. The help pill plays `he.restaurant.help` and shows the Hebrew help card (`helpTextHe`); closing the card cuts the help line and replays the request.

**Correct answer** (`choose` → `onCorrect`): the "yay" sound effect, `+1` star (persisted at once), the other plates pop out, the food flies on an arc into the animal's mouth, the animal munches, stars and confetti burst, a star flies to the star pill, which bumps, and the animal says a random thanks line (`thanks.{lang}.{0..2}`). Then, after the thanks line (bounded wait), on every 3rd correct answer of the visit a Hebrew praise line (`he.praise.*`, `shouldPraise` in `src/games/restaurant/voiceRules.ts`); otherwise, if the leisure balance crossed a whole minute since the last announcement, `he.leisure.earned`. The animal hops out to the right and the next trial starts.

**Wrong answer:** plate taps are locked for 400 ms (`WRONG_TAP_LOCK_MS`), so a double tap counts as one try. The plate wobbles and the animal makes a "hmm" reaction. The trial's miss is recorded at once (first accepted tap only). What follows depends on the age track (`ageTracks.<track>.hintMode` in the JSON):

- **Age 2** (`demonstrate`): tap sound, then after 450 ms (`HINT_AFTER_HMM_MS`) a hint: the correct plate pulses and sparkles, the hint sound plays, and the request is replayed, preceded on the **first** wrong try of the trial only by a Hebrew retry line (`he.retry.*`, `shouldSayRetry`).
- **Age 5** (`repeat-then-demonstrate`): hint sound; on the first wrong try, after 450 ms, the Hebrew retry line and then the request replay (no pulse); on the second and later wrong tries, after 450 ms, a hint (pulse and sparkle on the correct plate plus request replay, no retry line).
- On a voice-only level (L9) a hint replays the spoken request only, with no pulse or sparkle (`giveHint`: `this.round.audioOnly ? undefined : this.correctPlate()`).

The trial stays open after a wrong tap until the child taps the correct plate. Mistakes never touch the leisure balance.

**Idle auto-hint:** on the age-2 track only, a single hint is scheduled `hintDelayMs` = 6000 ms after the trial starts (timer starts when the animal starts entering, not when the request ends). If the intro or the help line is playing, it is re-scheduled another 6000 ms later. It does not repeat after it fires. The age-5 track never gets an idle auto-hint (`startRound` only starts the timer when `hintMode === 'demonstrate'`). **Decided by the owner (2026-11-12):** this is intended behaviour: on age 5 a hint comes only after a mistake.

**Two-item request (L7):** the first correct plate is served (its food flies to the animal, the plate pops out and stops being tappable); 700 ms later the request is replayed (not a hint); the trial completes on the second correct plate (`serveFirstOfTwo`).

**How a round ends:** a "round" is `trialsPerRound` = 3 trials (animals) recorded in the same language. There is no round-end screen; the game is an endless stream of animals.

**Leaving the game:** the back pill (⬅️, top bar) stops all audio, persists the store, clears the bubble and plays an iris transition to `MapScene` (`goBack`). Scene shutdown ends the leisure session and calls `skills.endVisit()`, which treats leaving as a round boundary (applies a pending level change and persists; `src/core/adaptive/skillSession.ts`).

- **Input mode per age:** **tap only on both tracks.** Plates and the animal are Phaser hit zones reacting to `pointerdown`; there is no drag anywhere in the scene. The engine's age-5 policy says `interaction: 'drag'` (`src/core/adaptive/policy.ts`), but the restaurant does not read `policy.interaction`; `docs/adaptive-engine.md` §1 lists real drag on the age-5 track as deferred. **Open decision for the owner:** keep age 5 tap-only (as now), or add drag-to-serve on the age-5 track later.

## Difficulty curve

- **Levels** (lever values exactly as in `src/content/games/animal-restaurant.json` → `adaptive.levels`; built by `buildRound` in `src/games/templates/choiceServe.ts`):

| L | `choiceCount` | `counts` | `distractor` | `request` | `support` | What the child sees |
|---|---|---|---|---|---|---|
| 1 | 2 | `[1]` | `far` | `noun` | — | 2 plates, very different foods (distractor of a different colour) |
| 2 | 3 | `[1]` | `far` | `noun` | — | 3 plates, very different foods (all colours differ when possible) |
| 3 | 3 | `[1]` | `near` | `noun` | — | 3 plates with look-alikes (one distractor shares the target's colour when one exists) |
| 4 | 3 | `[1, 2, 3]` | `near` | `quantity` | — | 3 plates with quantities. **Age-2 start** |
| 5 | 4 | `[1, 2, 3]` | `near` | `quantity` | — | 4 plates, quantities and look-alikes. **Age-5 start** |
| 6 | 4 | `[1]` | `near` | `attribute` | — | colour in the request ("I want the red apple, please!"); both colour versions of the food are on the table |
| 7 | 4 | `[1]` | `near` | `two-step` | — | two different foods in one request ("I want {a} and {b}, please!"); 2 requested plates + 2 distractors, served in either order |
| 8 | 4 | `[1]` | `near` | `negation` | — | "I want an apple, but not the red one!"; the one correct plate is the other colour; the excluded colour is on the table as a wrong plate |
| 9 | 4 | `[1]` | `near` | `negation` | `audio-only` | same as L8, but no prompt bubble (no text, no 🔊) and hints do not pulse the answer plate |

  Details as implemented:
  - **Quantity levels (L4, L5):** with probability 0.5 (and only if the target item has sentences for at least two counts) the plates show the same food at different counts plus distractors; otherwise the target is count 1 among different foods. Four items have only a count-1 sentence (grapes, cheese, broccoli, fish), so they always appear at count 1. `request` is reported as `quantity` for the whole level, including count-1 rounds (`simpleSpec`).
  - **Colour levels (L6, L8, L9):** only items with `variants` are eligible targets: apple (red/green), banana (yellow/green), grapes (purple/green), pear (green/yellow). Variant plates are drawn procedurally in their colour (`buildFood` in `src/games/restaurant/restaurantArt.ts`); every other plate uses the registered SVG art in `public/art/foods/`.
  - **Two-item level (L7):** the first food is the engine's target; the second is taken from foods the child has already seen (only mastered ones right after a level drop), else any other food (`buildTwoStepRound`, `familiarItemIds`). The engine records the trial against the first food only.
  - If a target cannot be used by a special request (no variants, no frames), the round falls back to a plain noun round (`buildRound`).
- **Age-2 start level:** L4 (`adaptive.tracks.age2.start = 4`).
- **Age-5 start level:** L5 (`adaptive.tracks.age5.start = 5`). Only one level above age 2 (adds a fourth plate). `docs/adaptive-engine.md` §2.2 records this as the owner's explicit exception to the "two steps above" convention.
- **Min / max:** both tracks `min = 1`, `max = 9`. **Age 2 has no ceiling** (`max` = number of levels). A stored level is clamped to the current track's bounds on every read (`clampToTrack`).
- **Adaptive rules** (no `adaptive.rules` override in the JSON, so `DEFAULT_RULES` in `src/core/adaptive/rules.ts` apply): `upCleanStreak: 3`, `downMisses: 2`, `downWindow: 3`, `trialsPerRound: 3`, `maxChangesPerRound: 1`, `retryAfterTrials: 2`, `masteredBox: 3`. Verified behaviour:
  - **Outcome per trial** (`classify`, `TrialTracker` in `src/games/restaurant/trialTracker.ts`): recorded exactly once per trial. A wrong first accepted tap is `miss` (recorded at once, even after the first plate of a two-item request). A correct tap that completes the request is `clean`, or `assisted` if the idle auto-hint fired before the trial was recorded (including between the two plates of L7). Replays (animal tap, bubble tap, the automatic replay after the first L7 plate, help-card close) never mark a hint. Hints shown after a recorded miss have no effect on the outcome.
  - **Up:** 3 clean trials in a row (`cleanStreak >= 3`). An `assisted` trial resets the streak but is not a miss.
  - **Down:** 2 misses within the last 3 recorded outcomes since the last change. Down wins when both are true.
  - **After any change:** history (`recent`) and streak are cleared, so there is no cascade. After a drop, `afterDrop` is set and the next selected item is a known item (box ≥ 3), else the highest box seen, else any (`selectNextItem`). At the floor a down decision is a "soft drop" (no level change, history cleared, `afterDrop` set). At the ceiling an up decision is a no-op and the streak keeps counting.
  - **Age 2 — between rounds** (`trackPolicy('age2').levelChange = 'between-rounds'`): the decision is computed after every trial (so windows span rounds) and stored as a pending change; a pending down replaces a pending up; it is applied only when the round of 3 closes, or when the child leaves the game (`endVisit`). So at most one change per round, and never mid-round.
  - **Age 5 — after trial** (`'after-trial'`): the change is applied immediately after the trial that triggers it, at most once per round (`changesInRound < maxChangesPerRound`). The next animal in the same round can therefore already be on the new level. If the cap blocks a **drop**, the drop is carried as pending and applied at the round boundary (or on leaving). A blocked **rise** is not carried (the streak re-fires it). A change applied at a boundary resets the round counters, so it does not consume the next round's in-round budget (`endRound` sets `changesInRound` to 0): in the worst case a level can change at a boundary and once more inside the following round.
  - **Language per round:** the language is picked at the round boundary of the current language (`nextRoundLanguage`): with the parent setting `both` (default), 50/50 random per round; with `en` or `fr`, always that language; if the parent disables the current language mid-round, it is re-picked at the next trial. English and French are **separate skills** with separate levels and item histories (`skillKey` = `language-house.animal-restaurant.<lang>`). A partial round left open in one language stays open in memory until that language is picked again or the visit ends.
  - **Item scheduling** (Leitner, `selectItem.ts`): never the same item twice in a row when another candidate exists; a missed item returns after 2 trials; day-due items lowest box first; about one new item per 3 known.
  - Response time is not used (`useResponseTime: false` on both tracks).
- **Decided by the owner (2026-11-12):** age 5 has no idle auto-hint, so the age-5 `hintDelayMs: 8000` in the JSON is unused by design. It stays in the content as is (no code change in this spec).

## Leisure

Implemented in `RestaurantScene.ts` with `LearningSession` (`src/core/leisure/learningSession.ts`) and `earnParticipation` (`src/core/leisure/engine.ts`):

- Every second while the scene is open, `session.tick(1)` adds participation time if the child is qualifying: an interaction within the last `idleSeconds` (default 20), or a voice line playing (`reportListening`), or a celebration playing (`reportCelebrating`), and the tab is visible (`setHidden` on `visibilitychange`; audio stops when hidden).
- Participation converts to leisure at `leisureMinutes / learnMinutes` (defaults 5 / 10, so 1 leisure second per 2 participation seconds), with fractional carry, up to `dailyEarnCapMinutes` (default 30) per local day (`DEFAULT_SETTINGS` in `src/core/storage/schema.ts`).
- Every plate tap, correct or wrong, calls `reportInteraction`, so mistakes count as participation and never reduce the balance; no code path in the scene subtracts from `balanceSec`.
- Stars (`+1` per correct trial) are a separate counter and do not affect leisure.
- Balances live per profile in the leisure store (`kids-app-state-v2`); adaptive progress lives in a separate key (`kids-app-adaptive:<profileId>`, `src/core/storage/adaptiveStore.ts`). `src/core/leisure` and `src/core/adaptive` do not import each other (`tests/unit/adaptiveLeisureIsolation.test.ts`), and leisure accrual is independent of whether answers are right or wrong.
- **Open decision for the owner:** `earnsLeisure: true` in the game JSON and in `worlds.json` is validated but never read; the scene always earns. Confirm that earning should stay unconditional for this game, or wire the flag.

## Player journey from the map

Profile (`data-testid="profile-a"` = age 2, `profile-b` = age 5; `src/ui/profileSelect.ts`, `src/core/storage/schema.ts`) → tap the Language House building on the map (Phaser canvas object; `MapScene` starts `RestaurantScene` only for the world whose `entryGameId` is `animal-restaurant`) → the first animal arrives → play → back pill → iris transition to the map.

- **Map entry:** `__testHooks__.getBuildingHit('language-house')` and the Playwright helper `enterWorldByTap(page, 'profile-a' | 'profile-b', 'language-house')` (in `tests/e2e/helpers/journey.ts`) are **added in draft PR #37 (not on main yet).** On `main`, `MapScene` exposes no hit rectangle and the existing e2e tests reach the game with the legacy `__testHooks__.goToScreen('restaurant')`, which `docs/PROCESS.md` §4 no longer allows in journey or AC tests.
- **`data-testid`s (DOM / HUD):**
  - Existing, unchanged: `profile-a`, `profile-b`, `star-count`, `leisure-balance`, `parent-gate-btn`, `parent-exit-btn`, `switch-profile-btn` (map HUD).
  - **Final shared names, added in draft PR #37 (not on main yet):** `hud-back` (back pill), `hud-help` (help pill), `prompt-bubble` (request bubble), `help-card` (help card), `help-card-close` (the whole help overlay: tapping anywhere closes it; there is no separate close button). Until PR #37 merges, tests on `main` use the class `.shell-prompt-bubble` for the bubble and have no ids for the others.
- **Seed and read hooks under `?e2e=1`** (installed in `src/game/createGame.ts`):
  - Existing, compliant: `seedRestaurantLevel(level)` (seeds the stored level of both languages for the current profile, clears streak and history; must run after the profile is chosen and before the building is tapped; the level is clamped to the track on read), `seedBalanceSec(sec)`, `getRoundInfo()` (read: plate centres and hit data in game coordinates (unchanged), pending correct indices, request type, `visualCue`, language, prompt text, tries, level, skill key, correct count, animal state, `ready`), `getGameSize()`, `getActiveScenes()`.
  - Existing, legacy, not allowed in AC tests: `goToScreen(screen)`.
  - **Added in draft PR #37 (not on main yet):** `getBuildingHit(worldId)` (read: returns `{ x, y, width, height } | null` in page CSS pixels, top-left, accounting for canvas scaling and letterboxing; `null` when the map is not active or the world has no building). Speech spy for the voice criteria: `getSpokenLines(sinceIndex?)` returns `Array<{ index, lineId, lang, source: 'clip' | 'tts', text?, at }>` for every `AudioManager.play` call, including lines that fall back to device TTS, and `getSpokenLineCount()` returns a number (both read-only, `?e2e=1` only). The current test on `main` only sees network requests for recorded `.mp3` clips, which cannot reveal device-TTS lines.

## Acceptance criteria

Ids are stable: never renumber or reuse them; strike through a removed one. Test titles start with the id. Verified by: `unit`, `e2e`, `e2e+seed`, or `device`. Because this is a retroactive spec, Pass 1 criteria describe the game as it exists; the existing tests that already exercise them are mapped below, and new `[AC-xx]` tests are listed under Missing tests.

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Language House building → restaurant → one correct trial → back pill → map; the restaurant opens only from the Language House building | 1 | e2e | both | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize`, `getActiveScenes` |
| AC-02 | A correct tap: food flies to the animal, `+1` star in `star-count`, the next animal arrives with a new trial | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize` |
| AC-03 | A wrong tap: wobble and hint or retry per age track, the trial stays open, `tries` increments once per 400 ms lock window, and the leisure balance never decreases | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize`, `seedBalanceSec` |
| AC-04 | Level rises after 3 clean trials in a row and drops after 2 misses within the last 3 trials; history clears after a change (no cascade); soft drop at the floor; no-op at the ceiling | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level (age 2: seed L2, three clean trials, the fourth animal is on L3) | 1 | e2e+seed | @single-orientation | `getBuildingHit` (draft PR #37), `seedRestaurantLevel`, `getRoundInfo`, `getGameSize` |
| AC-06 | High levels play correctly through real taps: L6 (both colour variants on the table), L7 (two plates in either order, one trial), L8 (one correct plate), L9 (no prompt bubble) | 1 | e2e+seed | @single-orientation | `getBuildingHit` (draft PR #37), `seedRestaurantLevel`, `getRoundInfo`, `getGameSize` |
| AC-07 | A new age-2 profile starts at L4 (3 plates, quantity); a new age-5 profile starts at L5 (4 plates, quantity); both tracks have min 1 and max 9 | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues per qualifying second at the parent ratio up to the daily cap, wrong taps count as participation and never reduce the balance, balances never mix across profiles, and leisure is independent of adaptive outcomes | 1 | unit | @single-orientation | |
| AC-09 | Content and language selection: eligible targets per level (variant items only on L6/L8/L9), the language is fixed for a round of 3 and re-picked at the boundary or when the parent disables it, English and French are separate skills | 1 | unit | @single-orientation | |
| AC-10 | Each voice line requests the right line id and language: the request (`food.*`, `attr.*`, `pair.*`, `not.*` with the round's language), `thanks.{lang}.*`, `he.restaurant.intro` once per visit, `he.retry.*` on the first wrong try only, `he.praise.*` on every 3rd correct, `he.restaurant.help` (speech spy) | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize`, `getSpokenLines` (draft PR #37) |
| AC-11 | Smoke: the restaurant is playable (one correct trial) at `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize` |
| AC-12 | The restaurant works offline after the first load (enter from the map and complete a trial with the network off) | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch on plates and animal, rotation mid-game, audible recorded and device-TTS voices, visuals (4 plates, colour-variant plates, two-item serve) | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | The level table matches this spec exactly (9 levels, lever values as in the Difficulty curve table) and the shipped content validates | 1 | unit | @single-orientation | |
| AC-17 | L1–L5 round building: plate counts per level, far distractors differ in colour, near distractors include a same-colour item when one exists, quantity variants only on quantity levels and only for counts the item has a sentence for, exactly one correct plate, the correct slot varies | 1 | unit | @single-orientation | |
| AC-18 | L6 attribute: both colour variants of the target food are on the table and the spoken text names the target colour, in both languages | 1 | unit | @single-orientation | |
| AC-19 | L7 two-item: two different requested foods plus 2 distractors, either order accepted, the prompt composed from `twoStepFrames` and `phrase`, the second food taken from familiar foods when any | 1 | unit | @single-orientation | |
| AC-20 | L7 in play: the first correct plate is served and no longer answers, the request replays after 700 ms without marking a hint, and exactly one trial is recorded when the second plate lands | 1 | e2e+seed | @single-orientation | `getBuildingHit` (draft PR #37), `seedRestaurantLevel`, `getRoundInfo`, `getGameSize` |
| AC-21 | L8 negation: exactly one correct plate (the colour not excluded); the excluded colour is a wrong plate | 1 | unit | @single-orientation | |
| AC-22 | L9 negation + voice-only: same round as L8 but `audioOnly`; no prompt bubble; a hint replays the request without pulsing the answer plate; every level below L9 shows the bubble | 1 | unit | @single-orientation | |
| AC-23 | Trial recording: exactly once per trial; a wrong first tap is a miss recorded at once; later taps record nothing; a correct first plate of L7 records nothing until the second | 1 | unit | @single-orientation | |
| AC-24 | Only the age-2 idle auto-hint fired before the trial is recorded marks it `assisted`; tapping the animal or the bubble to replay is not a hint, and neither is the replay after the first L7 plate | 1 | unit | @single-orientation | |
| AC-25 | Age-2 hints in play: one idle auto-hint 6000 ms after the trial starts (deferred while the intro or help line plays); after a wrong tap, a hint (pulse, sparkle, replay) after 450 ms | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize`, `getSpokenLines` (draft PR #37) |
| AC-26 | Age-5 feedback in play: no idle auto-hint; first wrong try → retry line and replay; second and later wrong tries → hint with pulse and replay | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize`, `getSpokenLines` (draft PR #37) |
| AC-27 | Age 2 changes level only between rounds of 3 (or on leaving): decisions span rounds, a pending down replaces a pending up, at most one change per round, never mid-round | 1 | unit | @single-orientation | |
| AC-28 | Age 5 changes level right after the triggering trial, at most once per round; a drop blocked by the cap is applied at the round boundary, not on a later clean answer; a blocked rise is not carried | 1 | unit | @single-orientation | |
| AC-29 | After a drop the next item is a known item (box ≥ 3, else highest box seen, else any); a missed item returns after 2 trials; the same item is never served twice in a row when another exists | 1 | unit | @single-orientation | |
| AC-30 | Leaving the game is a round boundary: a pending change is applied and adaptive progress is persisted per profile and per language under its own key, and survives a reload | 1 | unit | @single-orientation | |
| AC-31 | Tapping the animal (or the prompt bubble) replays the request and never selects a plate or adds a try | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize` |
| AC-32 | Help pill: plays the help line and shows the help card; closing the card replays the request | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getSpokenLines` (draft PR #37) |
| AC-33 | Both tracks are tap-only: a single tap on a plate answers for age 2 and age 5; no drag is needed | 1 | e2e | @single-orientation | `getBuildingHit` (draft PR #37), `getRoundInfo`, `getGameSize` |
| AC-34 | A waiting PWA update is deferred while the restaurant is open and applied on the map | 1 | unit | @single-orientation | |
| AC-35 | Layout: with 2, 3, and 4 plates in `1280x800` and `800x1280`, plates and the animal stay on screen, plate hit areas never overlap each other or the animal tap zone, and three-piece plates stay readable | 1 | unit | both | |
| AC-36 | Lines without a recorded clip (`attr.*`, `pair.*`, `not.*`) fall back to device TTS with the round text; a Hebrew line is never read by a non-Hebrew voice | 1 | unit | @single-orientation | |

### Existing test mapping (retroactive)

None of these tests carries an `[AC-xx]` title yet, and all e2e tests in `tests/e2e/journey.spec.ts` run in both Playwright projects (no `@single-orientation` tag). E2e tests that enter the restaurant all use the legacy `goToScreen`, so none satisfies the map-entry rule as is. Unit test files are not named after the game id, so the coverage script would not find their titles even if tagged (see Missing tests).

| AC | Existing tests (file — exact test title) | Gap |
|---|---|---|
| AC-01 | `tests/e2e/journey.spec.ts` — `profile select -> map -> restaurant -> bubbles -> parent gate`; pending on draft PR #37 (not on main yet): `tests/e2e/animal-restaurant.journey.spec.ts` — `[AC-01] real-tap journey: profile -> Language House building -> restaurant -> one correct trial -> back to the map` | The `main` test enters through `goToScreen('restaurant')`, not a building tap; plays no trial; no exit through the back pill. The PR #37 test covers the real-tap journey (building tap, one correct trial, `hud-back`) but not that other buildings do not open the restaurant |
| AC-02 | `tests/e2e/journey.spec.ts` — `restaurant requests voice clips, keeps the prompt bubble across HUD ticks and updates stars on arrival`; `tests/e2e/journey.spec.ts` — `wrong tap then correct tap: a double tap is one try, nothing is deducted, one star is added` | `goToScreen` entry; the arrival of the next animal is not asserted |
| AC-03 | `tests/e2e/journey.spec.ts` — `wrong choices in the restaurant never reduce the leisure balance`; `tests/e2e/journey.spec.ts` — `wrong tap then correct tap: a double tap is one try, nothing is deducted, one star is added` | `goToScreen` entry; the hint or retry feedback itself is not asserted |
| AC-04 | `tests/unit/adaptiveRules.test.ts` — `3 clean in a row go up one level (age5, after-trial)`; `miss, hit, miss goes down (window 3)`; `recent is cleared after a change, so there is no cascade`; `a soft drop at the floor clears history and sets afterDrop`; `up at the ceiling is a no-op and the streak keeps counting`; `an assisted trial breaks the streak but is not a miss`; `tests/unit/skillSession.test.ts` — `age2 climbs after a clean round of 3 and the level survives a reload` | Engine-level only; file not named after the game |
| AC-05 | — | No test sees a level change through real taps |
| AC-06 | `tests/e2e/journey.spec.ts` — `L7 two-item request: serving a plate twice has no effect, the second plate completes one trial`; `tests/e2e/journey.spec.ts` — `L9 is negation + voice-only: no prompt bubble, and tapping the animal replays without selecting a plate` | `goToScreen` entry; L6 and L8 not exercised in e2e; L9 test answers no plate |
| AC-07 | `tests/unit/skillSession.test.ts` — `starts at the track start level: age2 -> L4, age5 -> L5 (9 levels)`; `tests/unit/restaurantRequests.test.ts` — `tracks: age2 starts at L4, age5 at L5, both floor at L1 and top out at L9`; `tests/unit/contentSchema.test.ts` — `the adaptive block: age2 starts at L4 (3 plates, quantities) with no ceiling; age5 starts at L5 (4 plates)`; `tests/unit/choiceServe.test.ts` — `starts at L4: exactly 3 choices, quantity levers`; `starts at L5: 4 choices` | File names; none is tagged |
| AC-08 | `tests/unit/learningSession.test.ts` — `earns while interacting within the idle window`; `stops earning once idle beyond the idle threshold, without any touch`; `keeps earning while listening, even with no touch (listening is not idle)`; `keeps earning while celebrating a success animation`; `does not earn while the tab is hidden, even if recently interacted with`; `a wrong-choice interaction still counts as participation (no penalty for mistakes)`; `tests/unit/leisureEngine.test.ts` — `converts participation seconds to leisure seconds at the configured ratio`; `stops earning once the daily cap is reached, but keeps counting active seconds`; `tests/unit/storage.test.ts` — `keeps per-profile balances isolated — no transfer between profiles`; `tests/unit/adaptiveLeisureIsolation.test.ts` — `leisure results do not depend on the adaptive outcomes (all-miss vs all-clean)` | The scene's wiring (tick, interaction on every tap) is covered only indirectly by the e2e balance tests |
| AC-09 | `tests/unit/trialTracker.test.ts` — `keeps the current language until the round boundary`; `re-picks at the boundary and on the first round`; `re-picks mid-round when the parent disabled the current language`; `a single-language setting always wins`; `tests/unit/skillSession.test.ts` — `keeps languages as separate skills`; `tests/unit/restaurantRequests.test.ts` — `only variant items are eligible targets; an item without variants falls back to a plain round` | File names; none is tagged |
| AC-10 | `tests/e2e/journey.spec.ts` — `restaurant requests voice clips, keeps the prompt bubble across HUD ticks and updates stars on arrival`; `tests/unit/restaurantVoiceRules.test.ts` — `praises only every 3rd correct answer`; `says the retry line only on the first wrong try`; `builds Hebrew requests with he.* line ids` | On `main` there is no speech spy: the e2e test only waits for a network request to `/audio/(en\|fr)/*.mp3`. `getSpokenLines` / `getSpokenLineCount` (draft PR #37) make line id and language checkable, but intro, help, retry, praise are not yet asserted in play |
| AC-11 | `tests/e2e/journey.spec.ts` — `profile select -> map -> restaurant -> bubbles -> parent gate` (and every restaurant test, which runs in both projects) | `goToScreen` entry |
| AC-12 | `tests/e2e/journey.spec.ts` — `shell stays available after going offline` | Checks only the profile screen offline, not entering or playing the restaurant |
| AC-13 | `tests/e2e/journey.spec.ts` — `parent multiplication gate is shown when e2e bypass is off` | None for the gate itself; not tagged |
| AC-14 | — (device) | Not yet run against this spec |
| AC-15 | `tests/unit/audioStaticFile.test.ts` — `every line the app can request has a clip`; `every clip was rendered from the current text (re-run scripts/tts/generate_voice.py after copy edits)` | These cover only `food.*`, `thanks.*`, and `he.*`; `attr.*`, `pair.*`, `not.*` have no clips (Pass 2 work) |
| AC-16 | `tests/unit/restaurantRequests.test.ts` — `has 9 levels with the agreed levers`; `the shipped content validates`; `tests/unit/contentSchema.test.ts` — `animal-restaurant.json validates and has at least 10 complete-sentence items` | File names |
| AC-17 | `tests/unit/choiceServe.test.ts` — `uses count 1 only at levels that request nouns`; `produces the count variant at quantity levels, and only there`; `far distractors differ in color from the target and from each other when possible`; `near distractors include an item with the target color when one exists`; `every choice count used is one the item actually has a complete sentence for`; `exactly one choice is correct per round`; `puts the correct answer in every slot over many rounds (not always the first)`; `keeps the plate count of the level, with unique choices` | File name; none is tagged |
| AC-18 | `tests/unit/restaurantRequests.test.ts` — `puts both colour variants of the item on the table, so the colour word decides`; `the spoken text names the target colour, in both languages` | File name |
| AC-19 | `tests/unit/restaurantRequests.test.ts` — `asks for two different foods, both on the table, with at least one wrong plate`; `composes the prompt per language from the content frame and noun phrases`; `each requested plate matches only its own target (either order is accepted)`; `takes the second food from the familiar items when there are any`; `never picks the first food as the second, and falls back to any food when none is familiar` | File name |
| AC-20 | `tests/e2e/journey.spec.ts` — `L7 two-item request: serving a plate twice has no effect, the second plate completes one trial` | `goToScreen` entry; the 700 ms replay and "not a hint" are not asserted |
| AC-21 | `tests/unit/restaurantRequests.test.ts` — `has exactly one correct plate: the variant that is not the excluded colour`; `speaks the French negation line` | File name |
| AC-22 | `tests/unit/restaurantRequests.test.ts` — `is the same round as L8 for the same seed, except for the no-visual-cue flag`; `has no visual cue, but the request is still spoken`; `has exactly one correct plate (the other colour); the excluded colour is a wrong plate`; `every level below L9 shows the prompt bubble`; `tests/e2e/journey.spec.ts` — `L9 is negation + voice-only: no prompt bubble, and tapping the animal replays without selecting a plate` | No test checks that an L9 hint does not pulse the answer plate |
| AC-23 | `tests/unit/trialTracker.test.ts` — `records exactly once: the first plate tap wins, later taps yield null`; `tests/unit/restaurantRequests.test.ts` — `both correct, no wrong tap: one clean first try, recorded when the second plate lands`; `a wrong tap is the miss, even after one correct plate; nothing more is recorded`; `a wrong first tap is a miss and the later correct taps change nothing` | File names |
| AC-24 | `tests/unit/trialTracker.test.ts` — `an idle auto-hint before the first tap marks the trial as hinted`; `a hint after the first tap changes nothing`; `a voluntary replay (animal or bubble tap) never calls onHint, so the trial stays clean`; `tests/unit/restaurantRequests.test.ts` — `a hint before the first tap and a hint between the two plates both mark the trial hinted`; `tests/unit/adaptiveRules.test.ts` — `wrong first tap is a miss; correct after hint is assisted; otherwise clean` | The tracker is tested, but not that the scene never calls `onHint` on replays (scene code is not unit-tested) |
| AC-25 | — | No test of the idle timer or the wrong-tap hint in play |
| AC-26 | — | No e2e test uses the age-5 profile (`profile-b`) |
| AC-27 | `tests/unit/adaptiveRules.test.ts` — `between-rounds defers the change to the end of the round (age2)`; `age2 does not change level mid-round even when the down rule is met`; `age2: 2 misses in 3 trials spanning two rounds drop at the end of the second round`; `age2: 3 clean in a row spanning two rounds rise at the end of the second round, even if the streak breaks later`; `age2: a pending down replaces a pending up, and at most one change is applied`; `tests/unit/adaptivePolicy.test.ts` — `age2 is tap, between-rounds, and never uses response time`; `tests/unit/skillSession.test.ts` — `age2 has no ceiling: max equals the level count` | File names |
| AC-28 | `tests/unit/adaptiveRules.test.ts` — `after-trial: at most one change per round`; `the cap resets at the next round`; `age5: a decision blocked by the one-change cap is applied once at the round boundary, not on the next clean answer`; `tests/unit/adaptivePolicy.test.ts` — `age5 changes level after each trial; response time is off in v1` | File names |
| AC-29 | `tests/unit/adaptiveSelect.test.ts` — `serves a known item (box >= 3) and clears afterDrop`; `falls back to the highest box seen, then to any candidate`; `a missed item returns after retryAfterTrials trials`; `never repeats the last item when alternatives exist` | File name |
| AC-30 | `tests/unit/skillSession.test.ts` — `endVisit closes a partial round (age2 change lands at round end) and persists`; `endVisit is idempotent: a second call changes nothing`; `persists after every recorded trial under its own key`; `tests/unit/adaptiveStore.test.ts` — `keeps profiles isolated under separate keys`; `tests/unit/adaptiveLeisureIsolation.test.ts` — `saving an adaptive profile leaves the kids-app-state-v2 value byte-identical` | No test that leaving the scene actually calls `endVisit` |
| AC-31 | `tests/e2e/journey.spec.ts` — `tapping the animal repeats the request without selecting a plate`; `tests/e2e/journey.spec.ts` — `restaurant requests voice clips, keeps the prompt bubble across HUD ticks and updates stars on arrival` | `goToScreen` entry; tapping the prompt bubble is not tested |
| AC-32 | — | No test of the help pill or help card |
| AC-33 | `tests/e2e/journey.spec.ts` — `wrong tap then correct tap: a double tap is one try, nothing is deducted, one star is added`; `tests/e2e/journey.spec.ts` — `L7 two-item request: serving a plate twice has no effect, the second plate completes one trial` (both answer with single clicks on `profile-a`, age 2) | `goToScreen` entry; no age-5 tap test; no explicit tap-only assertion |
| AC-34 | `tests/unit/pwaUpdatePolicy.test.ts` — `%s → %s` (the `it.each` case `restaurant → false`); `defers while inside a game, the parent area, or loading`; `applies on the profile-select screen or the world map` | The scene's `setAppScreen('restaurant')` call is not tested |
| AC-35 | `tests/unit/restaurantLayout.test.ts` — `keeps plates and the animal on screen and in order`; `never lets a plate hit area overlap the animal tap zone or another plate`; `covers each plate centre with its own hit area`; `spreads four plates evenly in both orientations with room for a three-piece plate`; `keeps three-piece plates readable in portrait` | File name |
| AC-36 | `tests/unit/restaurantRequests.test.ts` — `none of the new line ids has a static clip, so they use device TTS`; `a missing static clip falls through to the device TTS provider with the round text`; `tests/unit/audioFallback.test.ts` — `falls back to device TTS when the static file is missing (provider returns false)` | No test of the "silent rather than a wrong voice" rule for Hebrew in `DeviceTtsProvider` |

### Missing tests

To be written when the first fix or feature pass on this game starts (`Pass in progress` set to `1`); until then `npm run check:ac` does not require them.

- **Placement.** The coverage script only reads test files named `animal-restaurant*` or inside a `tests/**/animal-restaurant/` folder. Existing unit tests (`restaurantRequests.test.ts`, `trialTracker.test.ts`, `adaptiveRules.test.ts`, …) and `tests/e2e/journey.spec.ts` do not match. Pass 1 work must either add `[AC-xx]` tests in `tests/unit/animal-restaurant.<topic>.test.ts` and `tests/e2e/animal-restaurant.spec.ts`, or move and retitle the existing ones.
- **Handles:** `getBuildingHit`, `enterWorldByTap`, `hud-back`, `hud-help`, `prompt-bubble`, `help-card`, `help-card-close`, `getSpokenLines`, and `getSpokenLineCount` come from draft PR #37 (not on main yet); Pass 1 e2e work depends on that PR merging first.
- AC-01: the single map-entry journey (profile → building tap → correct trial → back pill → map) is drafted on PR #37 (`[AC-01] real-tap journey: …` in `tests/e2e/animal-restaurant.journey.spec.ts`); still missing is a check that tapping the Art Studio building does not start `RestaurantScene`.
- AC-02, AC-03, AC-11, AC-31: replace the legacy `goToScreen` restaurant tests with map-entry versions; AC-02 also asserts the next animal arrives; AC-03 asserts the hint or retry; AC-31 adds a bubble tap.
- AC-05: seed L2 on `profile-a`, three clean real-tap trials, assert the fourth trial is on L3.
- AC-06: e2e+seed cases for L6 and L8 (answer the correct plate), and answer a plate on L9.
- AC-10: a speech-spy test for the request line ids and language, `thanks.*`, intro once per visit, retry on the first wrong try only, praise on the 3rd correct.
- AC-12: enter and play the restaurant offline, not just the profile screen.
- AC-20: assert the 700 ms replay after the first L7 plate and that the trial is recorded as clean.
- AC-22: the L9 hint does not pulse the answer plate (scene behaviour; needs a read of the plate scale or a hint event in `getRoundInfo`, which would be a hook change).
- AC-24: a test that replays from the scene (animal and bubble taps) leave the recorded outcome `clean`.
- AC-25: age-2 idle auto-hint fires once after 6000 ms; age-2 wrong-tap hint after 450 ms.
- AC-26: age-5 (`profile-b`) wrong-tap sequence and absence of the idle hint.
- AC-30: leaving through the back pill persists a pending age-2 change (read from `localStorage` after returning to the map).
- AC-32: help pill → help line and card → close → request replay.
- AC-33: an age-5 journey answered by single taps.
- AC-34: the scene reports `restaurant` as the app screen.
- AC-36: `DeviceTtsProvider` stays silent for a Hebrew line when no Hebrew voice exists.
- Retag every mapped existing test with its `[AC-xx]` id(s) when it is moved into a game-named file.

## Art, animation, and audio

### Pass 1 — working game (as implemented)

- **Asset paths and manifest keys** (`src/assets/art/manifest.ts`): foods `public/art/foods/{apple,banana,carrot,grapes,cheese,strawberry,broccoli,cookie,egg,pear,orange,fish}.svg` (keys `food-<id>`, 256 × 256); props `public/art/props/plate.svg`, `plate-shadow.svg`; scene `public/art/scenes/restaurant/bg-landscape.svg` (`restaurant-bg-landscape`, 1280 × 800), `bg-portrait.svg` (`restaurant-bg-portrait`, 800 × 1280), `counter.svg` (`restaurant-counter`, 1280 × 260). Each piece has a procedural fallback if its art is not loaded (`restaurantArt.ts`).
- **Colour variants:** variant plates (L6, L8, L9) are drawn procedurally (`drawFoodIcon`) in the variant colour, while every other plate uses the SVG art. Because the food SVGs are registered, the two variant plates look different from the distractor plates, which visually marks the answer as one of those two (TODO comment in `buildFood`). **Open decision for the owner:** register per-colour SVG art for the four variant foods, or draw every plate procedurally on attribute and negation rounds.
- **SVG contract:** as in the template (warm palette, `#3B2A22` outline about 6 px, no gradients, filters, text, external references or rasters, each file under 15 KB, enforced by `tests/unit/artAssets.test.ts`).
- **Rigs:** the animals use the restaurant `ANIMAL_KINDS` picker (`src/assets/vectorArt.ts`) via `Character` (`src/anim/Character.ts`): bear, rabbit, cat, dog, panda, lion. States used: enter, talk, poke, hmm, munch, happy, exit.
- **Layout** (`src/games/restaurant/restaurantLayout.ts`): the game canvas is 1280 × 800 or 800 × 1280, chosen once at startup from the window aspect, Phaser `FIT` (`src/game/createGame.ts`). The counter fills from 58% of the height to the bottom; the animal stands behind it in the centre; plates sit on the countertop. Plate tap rectangles run from 44 px above the counter top to the bottom of the screen and never overlap each other or the animal zone. Hit widths in game pixels: 2 plates about 448 (landscape) / 308 (portrait); 3 plates about 404 / 248; 4 plates 292 / 172. The animal zone is 0.75 × its display height wide (255 px landscape, about 322 px portrait).
  - Tap targets: **Decided by the owner (2026-11-12):** the minimum tap-target size is 64 px. In game pixels every plate and the animal exceed 64; the real CSS size on the tablet depends on the `FIT` scale and has not been measured. The DOM pills (back, help, prompt bubble) have no minimum size in code.
  - Rotation: the scene never re-lays out after a resize; rotating mid-game letterboxes the canvas built for the first orientation (`pickBaseSize` runs once). **Open decision for the owner:** accept letterboxing on rotation or re-layout on orientation change.
- **RTL:** Hebrew chrome (help pill label, help card) is RTL; the prompt bubble is LTR-isolated (`ltr-isolate`). The game reuses the shared restaurant HUD (`setRestaurantChrome` in `src/ui/hud.ts`): back pill, daily-progress bar, star count, leisure balance, help pill.
- **Animation:** `Juice` bursts (sparkle, star, confetti), `popIn`, `popOut`, `invitePulse`, `hintPulse`, `pressSquash`, `wobble`, `flyArc` (`src/anim/tweens.ts`), `ANIM_PROFILE.popIn.stagger` and `ANIM_PROFILE.flyArc.stagger` (`src/anim/profiles.ts`), iris transitions, and reduced-motion handling for the star-pill bump.
- **Sound effects** (`src/core/audio/sfx.ts`): `yay` on correct, `tap` on the first L7 plate and on an age-2 wrong tap, `hint` on hints and on an age-5 wrong tap.
- **Voice table** (all through `AudioManager.play({ lineId, lang, text })`; static clip first, device TTS fallback; `src/core/audio/manager.ts`). Request text comes from `src/content/games/animal-restaurant.json`; Hebrew text from `src/content/voice-lines-he.json` (not reproduced here):

| lineId | lang (`en` / `fr` / `he`) | Text | Trigger | Source today |
|---|---|---|---|---|
| `food.{item}.{count}.{lang}` | en, fr | `items[].prompts[lang][count]`, e.g. "I want two apples, please!" / "Je voudrais deux pommes, s'il te plaît !" | Request on L1–L5 (and plain fallback rounds); repeated on animal or bubble tap, on hints, after the help card closes | Recorded clip (56 ids: 8 foods × 3 counts + 4 foods × 1 count, × 2 languages) |
| `attr.{item}.{color}.{lang}` | en, fr | `variants[].{lang}.pick`, e.g. "I want the red apple, please!" | Request on L6 | **Device TTS** (16 possible ids, no clip) |
| `pair.{itemA}.{itemB}.{lang}` | en, fr | `twoStepFrames[lang]` with each item's `phrase`, e.g. "I want an apple and a banana, please!" | Request on L7 | **Device TTS** (up to 264 ordered pairs, no clip) |
| `not.{item}.{color}.{lang}` | en, fr | `variants[].{lang}.not` of the **excluded** colour, e.g. "I want an apple, but not the red one!" | Request on L8 and L9 | **Device TTS** (16 possible ids, no clip) |
| `thanks.{lang}.{0..2}` | en, fr | `thanks[lang][i]`, e.g. "Yummy! Thank you!" | After every correct trial (random index) | Recorded clip |
| `he.restaurant.intro` | he | `restaurant.intro` | Before the first request of each visit | Recorded clip |
| `he.restaurant.help` | he | `restaurant.help` | Help pill | Recorded clip |
| `he.retry.{0..2}` | he | `retry.*` | Before the replay or hint after the first wrong try of a trial | Recorded clip |
| `he.praise.{0..2}` | he | `praise.*` | After the thanks line on every 3rd correct answer of the visit | Recorded clip |
| `he.leisure.earned` | he | `leisure.earned` | After the thanks line when a whole leisure minute was crossed and no praise is due | Recorded clip |

  Recorded clips are listed in `src/content/audio-manifest.json` (Gemini TTS, voice Leda) with text hashes in `src/content/audio-text-hashes.json`. Device TTS uses `en-US` / `fr-FR` at rate 0.9, pitch 1.1, with an 8 s safety timeout; a Hebrew line is skipped (silent) when the device has no Hebrew voice (`src/core/audio/deviceTtsProvider.ts`). **Open decision for the owner:** L6–L9 requests are spoken by the device voice, which sounds different from the recorded Leda voice used on L1–L5; accept this until Pass 2, or record the `attr.*` and `not.*` lines (32 clips) now and keep only `pair.*` on device TTS.

- **World and PWA wiring:** Language House `entryGameId: "animal-restaurant"`, `earnsLeisure: true` (`src/content/worlds.json`); the `restaurant` `AppScreen` is unsafe for mid-game updates (`isSafeToApplyUpdate` in `src/pwa/updatePolicy.ts`).

### Pass 2 — polish

Not started for this game. Candidates (need the owner's approval): recorded Leda clips for `attr.*`, `not.*`, and, if wanted, `pair.*` (rendered with `scripts/tts/generate_voice.py`, device TTS stays the fallback); per-colour SVG art for the four variant foods; a richer two-item serve animation. Do not add `audio-manifest.json` rows without the clip and its text hash.

## Out of scope

- Any change to the game's behaviour: this spec only documents what exists.
- Drag-to-serve on the age-5 track, response-time skip-ahead, the parent level view and override, the 14-day decay, and the other deferred engine features listed in `docs/adaptive-engine.md` §1.
- New levels, new foods or colour variants, new languages.
- Pass 2 items until the owner approves them.
- Updating `docs/WORLDS.md` (a separate docs change if the owner wants it).

## Open decisions for the owner

- **Decided by the owner (2026-11-12):** **No idle hint on age 5, so age 5 is never `assisted`.** This is intended behaviour: a hint comes only after a mistake (retry line and replay first, then a pulse hint from the second wrong try). Age-5 outcomes are only `clean` or `miss`, and the age-5 `hintDelayMs` is unused by design.
- **Open decision for the owner:** **Device voice versus recorded clips.** L1–L5 requests, thanks, and all Hebrew lines are recorded (Leda); L6–L9 requests (`attr.*`, `pair.*`, `not.*`) use the device TTS voice, so the voice changes when the child reaches L6. Accept until Pass 2, or record some lines earlier (see the voice table).
- **Open decision for the owner:** **Colour-variant foods repeat more on L6, L8, L9.** Only 4 of 12 foods have colour variants (apple, banana, grapes, pear), so on those levels the target is always one of four foods (never the same one twice in a row), and the Leitner "new item" rhythm has only four items to work with. Accept, or add variants to more foods.
- **Open decision for the owner:** **No tablet visual check yet** for the 4-plate layout in both orientations, the colour-variant plates, and the two-item serve animation (`docs/adaptive-engine.md` §7 "They need visual QA on a real device"). This is AC-14.
- **Open decision for the owner:** **Variant plates give the answer away visually.** Variant plates are drawn in code while all other plates use SVG art, so on L6, L8, and L9 the answer is visibly one of the two odd-looking plates. Register per-colour art or draw all plates procedurally on those levels.
- **Decided by the owner (2026-11-12):** **Minimum tap-target size is 64 px.** Plates are at least 172 game px wide; the real CSS size on the tablet and the size of the DOM pills (back, help, bubble) have not been measured against 64 px yet.
- **Open decision for the owner:** **Tap-only on age 5.** The engine's age-5 policy says `drag`, but the restaurant is tap-only on both tracks. Confirm tap-only.
- **Open decision for the owner:** **Age-2 idle-hint timing.** The single idle hint fires 6000 ms after the trial starts (while the animal is still entering and speaking), not 6000 ms after the request ends, and it never repeats. Keep, or time it from the end of the request and allow repeats.
- **Open decision for the owner:** **A boundary change does not consume the next round's budget on age 5.** A change applied at a round boundary resets the counter, so the level can change at the boundary and again inside the next round. Accept, or count boundary changes against the next round.
- **Open decision for the owner:** **Mid-game rotation** letterboxes instead of re-laying out.
- **Open decision for the owner:** **`earnsLeisure` is not read.** The flag in the game JSON and in `worlds.json` is validated but ignored; the scene always earns.
- **Decided by the owner (2026-11-12):** **Speech spy form** for AC-10, AC-25, AC-26, AC-32: a read hook, `getSpokenLines` / `getSpokenLineCount` (draft PR #37).
- **Open decision for the owner:** **`docs/WORLDS.md` is stale** for this game's age tracks (two foods for age 2). Confirm the code (L4 / L5 starts) and whether to update that document.

## Changelog

- `2026-11-12` — created (retroactive spec of the existing game) — substantive
- `2026-11-12` — applied owner decisions: minimum tap target 64 px; age 5 has no idle auto-hint, a hint comes only after a mistake (intended behaviour); the age-5 `hintDelayMs` is unused by design (open item removed) — minor
- `2026-11-12` — aligned test handles with the shared names in draft PR #37 (`hud-back`, `hud-help`, `prompt-bubble`, `help-card`, `help-card-close`, `getBuildingHit` in page CSS pixels, `getSpokenLines` / `getSpokenLineCount`, `enterWorldByTap`) — minor

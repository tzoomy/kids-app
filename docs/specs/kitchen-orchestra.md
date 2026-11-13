# kitchen-orchestra — Kitchen Orchestra

Status: **approved**
Pass in progress: **none**

## Summary

Kitchen Orchestra is a musical listen-and-echo memory and vocabulary game set in a warm kitchen with a friendly chef. The chef plays a short pattern on kitchen utensils (`pot`, `pan`, and up to three pitched water glasses: `glass-low`, `glass-mid`, `glass-high`) while naming or prompting in English or French; the child echoes the pattern by tapping the utensils in the same order. Free play during listening always makes sound and never counts as a mistake, and wrong taps during echo trigger a supportive slower lit replay without reducing leisure balance. The game belongs in Language House (`language-house`) and is reached through a two-game picker (Animal Restaurant or Kitchen Orchestra), as decided on 2026-11-12 and previewed in [PR #36](https://github.com/tzoomy/kids-app/pull/36). On `main` today it is still wired to `art-studio` (Creative Studio); the move, picker, Art Studio lock, and skill-key migration land in a later implementation PR.

## Learning goals

- **Age 2:** Hear and recognize English and French kitchen utensil words (`pot` / `casserole`, `pan` / `poêle`, `glass` / `verre`, `low glass` / `verre grave`, `high glass` / `verre aigu`) and simple action prompts (`Play the pot!` / `Joue sur la casserole !`), and echo a comfortable single lit note (`sequenceLength: 1`, `choiceCount: 3`, `speed: 0.8`, `support: 'lit'`) at start, with an automatic demonstration hint after 6 s of idle time (`hintMode: 'demonstrate'`, `hintDelayMs: 6000`) and climbable progression up to longer sequences at her own pace.
- **Age 5:** Practice auditory and visual sequential working memory (`listen-and-echo`) starting at a 3-note sequence across 4 instruments (`sequenceLength: 3`, `choiceCount: 4`, `speed: 1`, `support: 'lit'` at L4), advancing through transient flash cues (`support: 'flash'` at L5–L6) to 4–5 note `audio-only` sequences across all 5 pitched utensils at faster tempo (`speed: 1.2` at L6–L8), while reinforcing English and French kitchen vocabulary and turn-taking cues (`Listen!` / `Écoute !`, `Your turn!` / `À toi !`).

## World and why

- **World** (Language House, Number Garden, Nature Lab, Art Studio, or Leisure Corner): Language House (`language-house`).
- **Why this game belongs there:** In `docs/WORLDS.md` ([Language House](docs/WORLDS.md#L40-L74)), the goal of Language House is to "understand a request or a word in the learning language and act in the world." Kitchen Orchestra takes place in a kitchen with a chef, teaches English and French kitchen utensil nouns and action requests (`Play the pot!`, `Listen!`, `Your turn!`), and runs per-language adaptive skills (`en` and `fr`). `docs/WORLDS.md` ([Art Studio](docs/WORLDS.md#L163-L171)) originally filed the game under Art Studio; Maor decided on 2026-11-12 that Language House is the correct world.
- **Decided (2026-11-12) — world move, Art Studio lock, skill-key migration, and picker:**
  1. Move `kitchen-orchestra` from `art-studio` to `language-house`. On `main` today, `src/content/games/kitchen-orchestra.json` still has `"world": "art-studio"` and `art-studio.entryGameId` is `"kitchen-orchestra"`; the content and map change lands in a later implementation PR.
  2. Set `art-studio` in `src/content/worlds.json` back to `"status": "locked"` and clear `"entryGameId": "kitchen-orchestra"`, until a dedicated Art Studio game (for example Color the World) is built.
  3. Migrate adaptive skill keys from `art-studio.kitchen-orchestra.<lang>` to `language-house.kitchen-orchestra.<lang>` (`${world}.${gameId}.${lang}`).
  4. When the child taps the Language House building, a two-game picker opens (Animal Restaurant or Kitchen Orchestra), as designed in [PR #36](https://github.com/tzoomy/kids-app/pull/36). Test ids: `game-picker-animal-restaurant`, `game-picker-kitchen-orchestra`, `game-picker-close`. This changes today's Language House journey, which currently opens `RestaurantScene` directly.

## Mechanic

1. **Stage and instruments (`src/games/orchestra/orchestraGame.ts`, `src/games/orchestra/OrchestraScene.ts`):**
   - The chef (`Character` with `kind: 'chef'`) stands behind or beside the kitchen counter with `choiceCount` utensils (`3`, `4`, or `5`) arranged in a row.
   - Active utensils are chosen deterministically by `ORCHESTRA_INSTRUMENT_ORDER`:
     - `choiceCount = 3`: `['pot', 'pan', 'glass-mid']`
     - `choiceCount = 4`: `['pot', 'pan', 'glass-low', 'glass-high']`
     - `choiceCount = 5`: `['pot', 'pan', 'glass-low', 'glass-mid', 'glass-high']`
   - Each utensil plays a synthesized Web Audio oscillator note (`OrchestraSounds` in `src/games/orchestra/orchestraSounds.ts`): `pot` (160 Hz triangle), `pan` (220 Hz square), `glass-low` (392 Hz sine), `glass-mid` (523 Hz sine), `glass-high` (659 Hz sine).

2. **Language selection and sequence generation:**
   - Learning languages are `en` and `fr`; UI chrome and the help card are in Hebrew (`he`).
   - At the start of each trial (`startTrial`), `nextRoundLanguage(this.roundLang, this.skills.atRoundBoundary(this.roundLang ?? 'en'), settings.languages)` selects the round language at a round boundary (`trialsInRound === 0`, or if the parent changed `settings.languages`, which defaults to `'both'`) and keeps that language fixed for all `trialsPerRound = 3` trials of the round.
   - `buildSequence(instruments, sequenceLength, random)` picks `sequenceLength` notes from the active instrument list. When `sequenceLength > 1` and `instruments.length > 1`, `buildSequence` prevents an immediate repeat (`pick === sequence[i - 1]`) by advancing to the next instrument in `instruments` (`(instruments.indexOf(pick) + 1) % instruments.length`).
   - `EchoTracker` tracks the trial using `itemId = trial.sequence.join('+')`.

3. **Listen phase (`phase = 'listen'`, `ready = false`):**
   - All instrument glows are cleared (`clearGlows()`).
   - **Spoken intro and prompt bubble:**
     - When `sequenceLength === 1`, the chef speaks the single utensil prompt `orchestra.play.<id>.<lang>` (for example `"Play the pot!"` / `"Joue sur la casserole !"`).
     - When `sequenceLength > 1`, the chef speaks `orchestra.listen.<lang>` (`"Listen!"` / `"Écoute !"`).
     - If `support !== 'audio-only'`, the DOM prompt bubble (`shell.setPromptBubble`) shows the spoken text with a `🔊` icon; if `support === 'audio-only'`, the prompt bubble is cleared (`shell.clearPromptBubble()`).
   - **Pattern demonstration (`playPattern` / `playOne`):**
     - Timing uses `BASE_NOTE_GAP_MS = 700` and `BASE_NOTE_HOLD_MS = 320` divided by `speed`: `noteHoldMs(speed) = Math.round(320 / Math.max(0.25, speed))` and `noteGapMs(speed) = Math.round(700 / Math.max(0.25, speed))`, waiting `Math.max(40, gap - hold)` ms between consecutive notes.
     - For each note in `trial.sequence`, the game plays the Web Audio note, squashes the utensil sprite (`tapInstrument`), and applies visual support:
       - `support === 'lit'`: fades in `fx-instrument-glow` (`glowInstrument(this, view.glow, true)`) and keeps it pulsing (`pulseInstrumentGlow(this, view.glow)`) through the echo phase.
       - `support === 'flash'`: fades in `fx-instrument-glow`, holds for `hold` ms, then fades it out (`glowInstrument(this, view.glow, false)`). Any remaining glows are cleared at the end of `playPattern`.
       - `support === 'audio-only'`: no glow is shown (`showsVisualSupport('audio-only') === false`).

4. **Echo phase (`phase = 'echo'`, `ready = true`) and child's action:**
   - Once the demonstration finishes, `phase` becomes `'echo'` and `ready` becomes `true`.
   - If `sequenceLength > 1`, `maybePromptYourTurn` updates the prompt bubble (when `support !== 'audio-only'`) and speaks `orchestra.yourturn.<lang>` (`"Your turn!"` / `"À toi !"`).
   - **Taps during `listen` or `celebrate` (free play):** Tapping any utensil at any time plays its Web Audio note, runs `tapInstrument`, and calls `session.reportInteraction()`. When `!this.ready || this.phase !== 'echo'`, the tap is treated as free play and **never scores a miss**.
   - **Taps during `echo` (`checkEchoTap`):**
     - Matching `trial.sequence[echoIndex]` when more notes remain (`echoIndex + 1 < sequence.length`) returns `{ kind: 'continue', nextIndex: echoIndex + 1 }` and advances `echoIndex`.
     - Matching the final note (`echoIndex + 1 >= sequence.length`) returns `{ kind: 'complete' }` and triggers `onSuccess()`.
     - Tapping any other utensil returns `{ kind: 'miss' }` and triggers `onMiss()`.

5. **Idle auto-hint (`giveHint`):**
   - On `age2` (`hintMode: 'demonstrate'`, `hintDelayMs: 6000`), `OrchestraScene` starts a `6000` ms timer when `echo` begins. If the timer fires while `phase === 'echo'` and `ready === true`, `giveHint()` marks `tracker.onHint()` (so completing the trial records `hinted: true` → outcome `'assisted'`), plays `sfx.hint()`, lights and pulses the glow on `trial.sequence[echoIndex]` (when `showsVisualSupport(trial.support)` is true), and speaks `orchestra.play.<id>.<lang>` for that expected instrument.
   - Decided (2026-11-12): age 5 has no automatic idle hint; a hint is given only after a mistake (the post-miss slow lit replay in `onMiss`). This already matches `OrchestraScene` on `main`, which starts `hintTimer` only when `hintMode === 'demonstrate'`. The JSON still lists `hintMode: 'repeat-then-demonstrate'` and `hintDelayMs: 8000` for age 5; any content cleanup is part of a later implementation PR. (`docs/adaptive-engine.md` §3 describes the same v1 behaviour.)

6. **Feedback on a correct answer (`onSuccess`):**
   - Sets `phase = 'celebrate'` and `ready = false`, cancels `hintTimer`, records the trial (`clean` if unhinted, `assisted` if the idle hint fired) via `skills.record(roundLang, recorded)`, and calls `session.complete()`.
   - Increments the active profile's `stars` by `+1`, persists store state, updates the HUD star counter (`updateRestaurantChrome({ starCount: state.stars })`), plays `sfx.yay()`, clears the prompt bubble, bursts `'sparkle'` particles above the chef, triggers `chef.happy()`, and cascades `tapInstrument` across all visible utensils (`80 * i` ms stagger).
   - Speaks a random praise line from `content.thanks[lang]` (`orchestra.thanks.<lang>.0`, `.1`, or `.2`), waits for `Promise.race([speech, wait(this, 2600)])`, and starts the next trial (`startTrial()`).

7. **Feedback on a wrong answer (`onMiss`):**
   - Sets `ready = false` and `phase = 'listen'`, cancels `hintTimer`, and records the miss (`firstTryCorrect: false` → outcome `'miss'`) via `skills.record(roundLang, recorded)`.
   - Plays `chef.hmm()` and `sfx.hint()`, sets the prompt bubble to `retryPrompt[lang]` (unless `support === 'audio-only'`), and speaks `orchestra.retry.<lang>` (`"Let's try again!"` / `"On réessaie !"`).
   - Replays the **same** `trial.sequence` at `replaySpeed(trial.speed) = speed * 0.75` (25% slower) with `support` forced to `'lit'` (lights on) and `announce = false` (no intro line). The sequence is **not** shortened. This post-miss slow lit replay is a free demonstration hint and is not itself a scored trial.
   - After the replay completes, `startTrial()` begins the next trial.

8. **How a round ends and how she leaves the game:**
   - Every `trialsPerRound = 3` recorded trials in a language closes a round in the adaptive engine (`endRound`), and play continues seamlessly into the next trial.
   - Tapping the HUD back button (`⬅️`) stops audio, persists state, clears the prompt bubble, and transitions to `MapScene` with an `'iris'` transition. Scene shutdown (`cleanup()`) stops audio and timers, calls `session.exit()`, and calls `skills.endVisit()` (which applies any pending round-end level change and persists adaptive state).

- **Input mode per age:** Tap-only on both `age2` and `age5`. Although the engine's `trackPolicy('age5').interaction` is `'drag'` for templates that support dragging, `OrchestraScene` uses pointer-down taps (`root.on('pointerdown', ...)`) on both age tracks.

## Difficulty curve

- **Levels:** 8 levels (1-based) defined in `src/content/games/kitchen-orchestra.json` and `docs/adaptive-engine.md` §2.2:

| L | `sequenceLength` | `choiceCount` | Instruments (`ORCHESTRA_INSTRUMENT_ORDER`) | `speed` | `support` | `request` |
|---|---|---|---|---|---|---|
| 1 | 1 | 3 | `pot`, `pan`, `glass-mid` | 0.8 | `lit` | `sequence` |
| 2 | 2 | 3 | `pot`, `pan`, `glass-mid` | 0.8 | `lit` | `sequence` |
| 3 | 2 | 4 | `pot`, `pan`, `glass-low`, `glass-high` | 1 | `lit` | `sequence` |
| 4 | 3 | 4 | `pot`, `pan`, `glass-low`, `glass-high` | 1 | `lit` | `sequence` |
| 5 | 3 | 4 | `pot`, `pan`, `glass-low`, `glass-high` | 1 | `flash` | `sequence` |
| 6 | 4 | 4 | `pot`, `pan`, `glass-low`, `glass-high` | 1.2 | `flash` | `sequence` |
| 7 | 4 | 5 | `pot`, `pan`, `glass-low`, `glass-mid`, `glass-high` (all five) | 1.2 | `audio-only` | `sequence` |
| 8 | 5 | 5 | `pot`, `pan`, `glass-low`, `glass-mid`, `glass-high` (all five) | 1.2 | `audio-only` | `sequence` |

- **Age-2 start level:** L1 (`start: 1`). Per `docs/adaptive-engine.md` §2.2, Kitchen Orchestra is the justified exception to the "age 2 starts above L1" convention because echoing even a 2-note sequence is already demanding for a 2-year-old; L1 gives her a single lit note at `speed: 0.8` across 3 utensils.
- **Age-5 start level:** L4 (`start: 4`). Meaningfully harder than age 2: a 3-note sequence (`sequenceLength: 3`) across 4 utensils (`pot`, `pan`, `glass-low`, `glass-high`) at normal tempo (`speed: 1`, `support: 'lit'`).
- **Min / max:** `min: 1`, `max: 8` on both `age2` and `age5`. Age 2 has **no ceiling** (`max: 8`). At L1, a down decision performs a soft drop (`recent = []`, `cleanStreak = 0`, `afterDrop = true`, level stays 1); at L8, an up decision is a no-op and `cleanStreak` keeps counting.
- **Adaptive rules** (`src/content/games/kitchen-orchestra.json` overrides merged onto `DEFAULT_RULES` in `src/core/adaptive/rules.ts`, plus `trackPolicy` in `src/core/adaptive/policy.ts`):
  - `upCleanStreak: 2` (override; default is 3): 2 consecutive `'clean'` trials trigger a level-up (`+1`). An `'assisted'` or `'miss'` trial resets `cleanStreak` to `0`.
  - `downMisses: 2`, `downWindow: 2` (override; default `downWindow` is 3): 2 consecutive `'miss'` trials trigger a level-down (`-1`).
  - `trialsPerRound: 3`: 3 recorded trials per round.
  - `maxChangesPerRound: 1` (from `DEFAULT_RULES`): at most 1 level change inside a round.
  - `retryAfterTrials: 2`, `masteredBox: 3` (from `DEFAULT_RULES`).
  - `useResponseTime: false` on both tracks.
  - **When the level may change:**
    - `age2`: `levelChange: 'between-rounds'`. `decideChange` runs after every trial (so streak and miss windows span round boundaries) and merges into `session.pendingChange` (a down `-1` replaces a pending up `+1`; a pending down is never replaced), which is applied at `endRound` (after 3 trials or on scene exit).
    - `age5`: `levelChange: 'after-trial'`. A decided change is applied immediately after the trial when `changesInRound < maxChangesPerRound`; if the cap blocks a drop (`-1`), it is stored in `pendingChange` and applied at the round boundary.

## Leisure

- `content.earnsLeisure` is `true`. `OrchestraScene` creates a `LearningSession` (`src/core/leisure/learningSession.ts`) on entry and ticks it every 1 s (`this.session.tick(1)`).
- **What counts as active participation:**
  - `session.start()` on scene creation.
  - `session.reportInteraction()` on every utensil tap (`onInstrumentTap`) — including wrong taps during `echo` and free-play taps during `listen` or `celebrate` — and when opening or closing the Hebrew help overlay (`showHelp`).
  - `session.reportListening(true / false)` while the chef's spoken prompts (`listen`, single-instrument `play`, `yourturn`, `retry`, and `help`) are playing.
  - `session.complete()` (which sets `celebrating = true`) on sequence completion (`onSuccess`), cleared at the next `startTrial()` and on `cleanup()`.
  - `session.setHidden(document.hidden)` on `visibilitychange`: a hidden tab never earns leisure (`isQualifying()` returns `false`) and stops playing audio.
- **Default leisure policy (`DEFAULT_SETTINGS` in `src/core/storage/schema.ts`):**
  - `learnMinutes: 10`, `leisureMinutes: 5` (earns `0.5` leisure seconds per qualifying learning second, accumulated with fractional carry in `ProfileState.carry`), `dailyEarnCapMinutes: 30` (`1800` s per local calendar day), `idleSeconds: 20` (participation pauses once 20 s have elapsed since the last interaction without active listening or celebration), `languages: 'both'`.
- **Guarantees:**
  - Mistakes (`onMiss`) never reduce `balanceSec`, `earnedTodaySec`, or `activeSec`; tapping a wrong utensil still calls `reportInteraction()`.
  - Leisure balances and stars are stored per profile (`state.data[profileId]` in `kids-app-state-v2`) and never mix across profiles; adaptive state is stored separately under `kids-app-adaptive:<profileId>`.

## Player journey from the map

Select profile (`profile-a` or `profile-b`) → real-tap the Language House building with `enterWorldByTap(page, profile, 'language-house')` (from [PR #37](https://github.com/tzoomy/kids-app/pull/37), pending merge; uses `getBuildingHit('language-house')`) → the Language House picker opens → tap `game-picker-kitchen-orchestra` → `OrchestraScene` opens → play a 3-trial round → tap `hud-back` → return to `MapScene`. Tapping `game-picker-animal-restaurant` opens Animal Restaurant instead; tapping `game-picker-close` returns to the map without opening a game.

On `main` today, before the implementation PR, tapping Art Studio still opens Kitchen Orchestra directly. The journey above is the decided target.

Frozen test handles (shared names from [PR #37](https://github.com/tzoomy/kids-app/pull/37), pending merge — game scenes use these same HUD/prompt/help ids, not game-specific names):

- **Playwright helper:** `enterWorldByTap(page, profile, worldId)` in `tests/e2e/helpers/journey.ts` — real-tap journey: profile → map → click the centre of the building hit rect → game (or, for Language House, the picker). Use it in this game's journeys, including the picker cases.
- **Map building hit target:** `getBuildingHit('language-house')` under `?e2e=1`. Signature (PR #37): `getBuildingHit(worldId) -> { x, y, width, height } | null` in page CSS px, top-left, accounting for canvas scaling and letterbox; `null` if the map is inactive or the building is missing. (`getBuildingHit` is not on `main` yet.)
- **`data-testid`s (DOM / HUD), from PR #37 unless noted:**
  - Unchanged existing: `profile-a`, `profile-b`, `leisure-balance`, `star-count`, `parent-gate-btn`, `switch-profile-btn`, `parent-exit-btn`
  - Shared chrome (PR #37; game scenes put these on their DOM chrome): `hud-back` (back button), `hud-help` (help button), `prompt-bubble` (request bubble), `help-card` (help card), `help-card-close` (the whole help overlay; tapping anywhere closes it)
  - Language House picker (frozen for the decided picker; not on `main` yet; visual proposal in PR #36): `game-picker-animal-restaurant`, `game-picker-kitchen-orchestra`, `game-picker-close`
- **Seed and read hooks under `?e2e=1`** (seed persisted state or read state only; no game actions, no scene navigation; `goToScreen` is for screenshot scripts only and forbidden in journey/AC tests):
  - Shared spoken-line hooks from PR #37 (pending merge). Voice assertions use `getSpokenLines` `lineId`s: `getSpokenLines(sinceIndex?) -> [{ index, lineId, lang, source: 'clip' | 'tts', text?, at }]` (`source` is the provider *requested*, not whether it was heard); `getSpokenLineCount() -> number`.
  - Game-specific hooks already on `main`: `seedOrchestraLevel(level: number)`, `getOrchestraInfo() -> OrchestraRoundInfo | null` (`sequence`, `expectedIndex`, `instrumentCenters`, `level`, `support`, `language`, `ready`, `phase`), `seedBalanceSec(sec: number)`.

## Acceptance criteria

Ids are stable: never renumber or reuse them; strike through a removed one (`~~AC-07~~`). Test titles start with the id, e.g. `test('[AC-04] level rises after 2 clean answers', …)`, in `tests/**/kitchen-orchestra*` files. Verified by: `unit`, `e2e`, `e2e+seed`, or `device` (device criteria are checked by Maor on the tablet and are exempt from the CI coverage check). Orientation: `both`, or `@single-orientation` if the criterion does not depend on it.

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey via `enterWorldByTap(page, profile, 'language-house')`: profile → Language House building → picker → `game-picker-kitchen-orchestra` → one 3-trial round → exit via `hud-back` to the map; the game opens only from this world's building | 1 | e2e | both | `getBuildingHit`, `getOrchestraInfo` |
| AC-02 | Completing the expected utensil sequence during `echo` awards +1 star (`star-count`), triggers chef happy celebration and sparkle particles, speaks `orchestra.thanks.<lang>.<0..2>`, and advances to the next trial | 1 | e2e | @single-orientation | `getBuildingHit`, `getOrchestraInfo`, `getSpokenLines` |
| AC-03 | A wrong tap during `echo` triggers chef `hmm`, speaks `orchestra.retry.<lang>`, replays the same sequence at `0.75×` speed with `lit` support without shortening it, and never reduces `leisure-balance`; taps during `listen` make sound and never score a miss | 1 | e2e | @single-orientation | `getBuildingHit`, `getOrchestraInfo`, `seedBalanceSec`, `getSpokenLines` |
| AC-04 | Difficulty rises after 2 consecutive clean trials (`upCleanStreak: 2`) and drops after 2 consecutive misses (`downMisses: 2`, `downWindow: 2`), with `trialsPerRound: 3`, `maxChangesPerRound: 1`, `between-rounds` on `age2`, and `after-trial` on `age5` | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level (e.g. seeded L1 or L4 rising by 1 after 2 clean sequences or dropping by 1 after 2 missed sequences) | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedOrchestraLevel`, `getOrchestraInfo` |
| AC-06 | High levels (seeded L7 and L8: 4–5 note sequence, 5 utensils, `speed: 1.2`, `support: audio-only` with no prompt bubble and no utensil glow) play and complete correctly | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedOrchestraLevel`, `getOrchestraInfo` |
| AC-07 | A new `age2` profile starts at L1 (`sequenceLength: 1`, `choiceCount: 3`, `speed: 0.8`, `support: 'lit'`); a new `age5` profile starts at L4 (`sequenceLength: 3`, `choiceCount: 4`, `speed: 1`, `support: 'lit'`), with `min: 1` and `max: 8` (no age-2 ceiling) | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues via `LearningSession` during active play, listening, and celebration (10 min learn → 5 min leisure, 30 min daily cap, 20 s idle window, paused when tab-hidden), never drops on mistakes, and never mixes across profiles | 1 | unit | @single-orientation | |
| AC-09 | Utensil sets (`ORCHESTRA_INSTRUMENT_ORDER` for 3, 4, 5 choices), non-repeating consecutive notes in `buildSequence` when `length > 1`, note timing (`BASE_NOTE_GAP_MS = 700`, `BASE_NOTE_HOLD_MS = 320`, `replaySpeed = speed * 0.75`), and fixed per-round language selection (`en` / `fr`) match this spec | 1 | unit | @single-orientation | |
| AC-10 | Each voice line requests the right `lineId` (`orchestra.play.<id>.<lang>`, `orchestra.listen.<lang>`, `orchestra.yourturn.<lang>`, `orchestra.retry.<lang>`, `orchestra.thanks.<lang>.<0..2>`, `orchestra.help.he`) and language, asserted via `getSpokenLines` | 1 | e2e | @single-orientation | `getBuildingHit`, `getOrchestraInfo`, `getSpokenLines` |
| AC-11 | Smoke: Kitchen Orchestra is playable with non-overlapping chef, utensils, and HUD at both `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit`, `getOrchestraInfo` |
| AC-12 | Kitchen Orchestra works offline (precached SVGs, synthesized Web Audio notes, and device TTS fallback) | 1 | e2e | @single-orientation | `getBuildingHit`, `getOrchestraInfo` |
| AC-13 | The parent area stays gated by the multiplication challenge (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch responsiveness on utensils, rotation mid-game, audible Web Audio notes and TTS voice, visuals on the Android tablet | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the Kitchen Orchestra voice table, with matching text hashes in `audio-manifest.json` | 2 | unit | @single-orientation | |
| AC-16 | A real tap on the Language House building (`enterWorldByTap` / `getBuildingHit('language-house')`) opens the game picker, at both `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit` |
| AC-17 | A real tap on `game-picker-animal-restaurant` opens Animal Restaurant, at both `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit` |
| AC-18 | A real tap on `game-picker-kitchen-orchestra` opens Kitchen Orchestra, at both `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit`, `getOrchestraInfo` |
| AC-19 | A real tap on `game-picker-close` returns the child to the map, at both `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit` |

## Art, animation, and audio

Paths, keys, rigs, and line ids below reflect Pass 1 as implemented on `main` and are frozen for testing and future passes (`docs/PROCESS.md` §2). Style and rig details: `docs/ANIMATION.md`.

### Pass 1 — working game

- **Asset paths and manifest keys** (`public/art/`, keyed in `src/assets/art/manifest.ts`):
  - **Chef character parts (`public/art/characters/chef/`):**
    - `public/art/characters/chef/body.svg` — `character-chef-body` (`240 × 240`)
    - `public/art/characters/chef/head.svg` — `character-chef-head` (`236 × 196`)
    - `public/art/characters/chef/hat.svg` — `character-chef-hat` (`260 × 180`)
    - `public/art/characters/chef/eye-open.svg` — `character-chef-eye-open` (`52 × 58`)
    - `public/art/characters/chef/eye-closed.svg` — `character-chef-eye-closed` (`52 × 58`)
    - `public/art/characters/chef/mouth-smile.svg` — `character-chef-mouth-smile` (`68 × 48`)
    - `public/art/characters/chef/mouth-open.svg` — `character-chef-mouth-open` (`68 × 48`)
    - `public/art/characters/chef/mouth-hmm.svg` — `character-chef-mouth-hmm` (`68 × 48`)
  - **Instruments (`public/art/instruments/`):**
    - `public/art/instruments/pot.svg` — `instrument-pot` (`256 × 256`)
    - `public/art/instruments/pan.svg` — `instrument-pan` (`256 × 256`)
    - `public/art/instruments/glass-low.svg` — `instrument-glass-low` (`256 × 256`)
    - `public/art/instruments/glass-mid.svg` — `instrument-glass-mid` (`256 × 256`)
    - `public/art/instruments/glass-high.svg` — `instrument-glass-high` (`256 × 256`)
  - **FX (`public/art/fx/`):**
    - `public/art/fx/instrument-glow.svg` — `fx-instrument-glow` (`256 × 256`); also reuses shared `fx-sparkle` (`public/art/fx/sparkle.svg`, `64 × 64`) and `fx-heart` (`public/art/fx/heart.svg`, `64 × 64`).
  - **Kitchen scene backgrounds (`public/art/scenes/kitchen/`, named for the scene `kitchen`, not the world id):**
    - `public/art/scenes/kitchen/bg-landscape.svg` — `kitchen-bg-landscape` (`1280 × 800`)
    - `public/art/scenes/kitchen/bg-portrait.svg` — `kitchen-bg-portrait` (`800 × 1280`)
- **SVG contract:** warm palette; dark-brown outline `#3B2A22` about 6 px; no heavy gradients or filters, no `<text>`, no external references, no rasters; each file under 15 KB (enforced by `tests/unit/artAssets.test.ts`); do not copy characters, art, or audio from inspiration apps.
- **Rigs:** `CHARACTER_RIGS.chef` and `CHARACTER_ART_KINDS = ['chef']` in `src/assets/art/rigs.ts` (never added to the restaurant `ANIMAL_KINDS` picker). Origin is at the feet centre on the `400 × 480` reference (`height: 480`, `body` at `(0, 0)` with `originX: 0.5, originY: 0.96`); `head.svg` has no baked-in eyes or mouth, with separate head-parented `hat`, `eyeL`, `eyeR` (`flipX: true`), and `mouth` (`mouth-smile`, `mouth-open`, `mouth-hmm`) parts, plus `eye-closed` for blinking. Previews composite every layer.
- **Layout:** `computeOrchestraLayout(width, height, choiceCount)` in `src/games/orchestra/orchestraLayout.ts` places the chef and 3–5 utensils on `bg-landscape` (`1280 × 800`) and `bg-portrait` (`800 × 1280`). In portrait, the chef stands at `PORTRAIT_COUNTER_TOP = 856 / 1280` (`depth: 2`) behind the utensils on the counter (`y = height * 0.68`, `depth: 3`); in landscape, the chef stands at `x = width * 0.2, feetY = height * 0.78` (`depth: 4`) to the left of the utensil row (`startX = width * 0.42 + size / 2`, `y = height * 0.72`, `depth: 3`). Tap targets: decided (2026-11-12) minimum **64 CSS px**. If items do not fit at that size, pan or show fewer; never shrink them.
- **RTL:** Reuses the restaurant HUD (`shell.setRestaurantChrome` / `shell.updateRestaurantChrome`, `shell.setPromptBubble`, `shell.clearPromptBubble`, `shell.showHelp` in `src/ui/shell.ts` and `src/ui/hud.ts`). Hebrew UI chrome and the help overlay (`helpTextHe`) render RTL; English and French learning tokens in `.shell-prompt-bubble` stay LTR via `.ltr-isolate`.
- **Animation:**
  - `ANIM_PROFILE.orchestra` in `src/anim/profiles.ts`: `glow: { duration: 320, alpha: 1, ease: 'Sine.easeInOut' }` and `glowPulse: { duration: 900, ease: 'Sine.easeInOut' }`.
  - Motion helpers in `src/anim/worldMotion.ts`: `tapInstrument(scene, instrument)` (delegates to `pressSquash`), `glowInstrument(scene, glow, on)`, and `pulseInstrumentGlow(scene, glow)` (looping yoyo tween between `alpha: 1` and `0.45`).
  - Reuses shared `Character` animations (`breath`, `sway`, `blink`, `happy`, `hmm`), `popIn`, `Juice.burst('sparkle', ...)`, and `transitionTo(..., { style: 'iris' })`.
  - Utensil notes are synthesized with Web Audio oscillators in `src/games/orchestra/orchestraSounds.ts` (`OrchestraSounds`, `INSTRUMENT_PITCH_HZ`), not TTS. Unit tests import pure modules only (`orchestraGame.ts`, `orchestraLayout.ts`, `orchestraSounds.ts`), never Phaser.
- **Voice table** (device TTS in Pass 1 through `AudioManager.play({ lineId, lang, text })`). Strings match `src/content/games/kitchen-orchestra.json` except the French pan name, decided 2026-11-12: target `pan.name.fr` is `poêle` and `orchestra.play.pan.fr` is `Joue sur la poêle !` (same `Joue sur la … !` pattern as `Joue sur la casserole !`). On `main` today the JSON still has `tambour` / `Joue du tambour !`; that content change lands in a later implementation PR. Voice assertions use `getSpokenLines` `lineId`s (PR #37).

| lineId | lang (`en` / `fr` / `he`) | Text | Trigger |
|---|---|---|---|
| `orchestra.listen.en` | `en` | `Listen!` | Announcement before pattern playback when `sequenceLength > 1` |
| `orchestra.listen.fr` | `fr` | `Écoute !` | Announcement before pattern playback when `sequenceLength > 1` |
| `orchestra.yourturn.en` | `en` | `Your turn!` | Prompt when `echo` phase begins and `sequenceLength > 1` |
| `orchestra.yourturn.fr` | `fr` | `À toi !` | Prompt when `echo` phase begins and `sequenceLength > 1` |
| `orchestra.retry.en` | `en` | `Let's try again!` | Spoken on a wrong echo tap (`onMiss`) before the slow lit replay |
| `orchestra.retry.fr` | `fr` | `On réessaie !` | Spoken on a wrong echo tap (`onMiss`) before the slow lit replay |
| `orchestra.play.pot.en` | `en` | `Play the pot!` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `pot` is next |
| `orchestra.play.pot.fr` | `fr` | `Joue sur la casserole !` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `pot` is next |
| `orchestra.play.pan.en` | `en` | `Play the pan!` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `pan` is next |
| `orchestra.play.pan.fr` | `fr` | `Joue sur la poêle !` (target; JSON on `main` still has `Joue du tambour !` until an implementation PR) | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `pan` is next |
| `orchestra.play.glass-low.en` | `en` | `Play the low glass!` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `glass-low` is next |
| `orchestra.play.glass-low.fr` | `fr` | `Joue le verre grave !` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `glass-low` is next |
| `orchestra.play.glass-mid.en` | `en` | `Play the glass!` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `glass-mid` is next |
| `orchestra.play.glass-mid.fr` | `fr` | `Joue le verre !` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `glass-mid` is next |
| `orchestra.play.glass-high.en` | `en` | `Play the high glass!` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `glass-high` is next |
| `orchestra.play.glass-high.fr` | `fr` | `Joue le verre aigu !` | Single-note intro (`sequenceLength === 1`) or `age2` idle auto-hint (`giveHint`) when `glass-high` is next |
| `orchestra.thanks.en.0` | `en` | `Great job!` | Celebration praise on completing a sequence (`onSuccess`, random index 0) |
| `orchestra.thanks.en.1` | `en` | `What a song!` | Celebration praise on completing a sequence (`onSuccess`, random index 1) |
| `orchestra.thanks.en.2` | `en` | `Beautiful!` | Celebration praise on completing a sequence (`onSuccess`, random index 2) |
| `orchestra.thanks.fr.0` | `fr` | `Bravo !` | Celebration praise on completing a sequence (`onSuccess`, random index 0) |
| `orchestra.thanks.fr.1` | `fr` | `Quelle chanson !` | Celebration praise on completing a sequence (`onSuccess`, random index 1) |
| `orchestra.thanks.fr.2` | `fr` | `C'est joli !` | Celebration praise on completing a sequence (`onSuccess`, random index 2) |
| `orchestra.help.he` | `he` | `השף מנגן דוגמה. הקשיבי, ואז הקשי על הכלים באותו הסדר. אפשר לנגן חופשי, וטעות אף פעם לא מורידה זמן כיף.` | Tapping the `❓` HUD help button (`showHelp`) |

- **World and PWA wiring:**
  - Decided target (2026-11-12): `kitchen-orchestra` has `"world": "language-house"` and `"earnsLeisure": true`; `language-house` stays `"status": "open"` and `"earnsLeisure": true` and no longer uses a single `entryGameId` to jump straight into one game — tapping the building opens the picker. `art-studio` is `"status": "locked"` with `kitchen-orchestra` removed as `entryGameId`. On `main` today the game is still under `art-studio`; the wiring change lands in a later implementation PR.
  - `src/pwa/updatePolicy.ts` includes `'orchestra'` in `AppScreen`, and `isSafeToApplyUpdate` returns `false` for `'orchestra'`, so mid-game service-worker reloads are deferred until the child returns to `'map'` or `'profile'`.

### Pass 2 — polish

- Richer kitchen and utensil art and chef conducting/playing animations.
- Recorded Gemini TTS clips (voice Leda) for all 23 rows of the voice table above, rendered with `scripts/tts/generate_voice.py`; device TTS stays the fallback. Do not add `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.

## Out of scope

- Pass 2 work (richer art/animation and recorded Leda voice clips for `orchestra.*`) until Maor approves Pass 2.
- An automatic idle hint on the age-5 track (decided 2026-11-12: age 5 is hinted only after a mistake).
- Drag interaction, response-time scoring (`useResponseTime`), or parent-facing per-game level overrides (deferred in `docs/adaptive-engine.md` §1).
- Extra languages beyond English, French, and Hebrew chrome.

## Open decisions for the owner

All open decisions were resolved by the owner on 2026-11-13.

None remaining. Owner decisions of 2026-11-12 are recorded in the sections above.

## Changelog

- 2026-11-12 — created (retroactive spec of the game on main, plus proposed Language House move) — substantive
- 2026-11-12 — Owner decisions: Language House move and picker (PR #36), including Art Studio lock and skill-key migration; French pan name `poêle` / `Joue sur la poêle !` (content change later); tap target 64 CSS px; age 5 has no idle hint (hint only after a mistake). Shared e2e handles and `enterWorldByTap` from PR #37 (pending merge). Added picker ACs AC-16–AC-19. — substantive
- 2026-11-13 — approved by the owner; all open decisions and team-lead proposals resolved (none were labelled open in the spec; the 2026-11-12 decisions stand unchanged); 0 ACs added — substantive

# Adaptive-difficulty engine (design, issue #16)

Status: **approved for implementation**. The owner approved the feature in issue #16 and decided the open questions on 2026-11-11 (see the end of this doc). Source spec: the research doc `games-per-world.md`, sections 3, 4 and 6 (PR #15, not merged yet).

## 1. Scope and non-goals

**In v1**
- A pure TypeScript engine in `src/core/adaptive/`. It has no Phaser and no DOM dependency, and it is fully unit-tested.
- Level up and level down rules, with an "at most one change per round" cap.
- A known item is served right after a level drop.
- A minimal Leitner item scheduler: in-session retry of missed items, plus day-based review.
- Persisted state per profile, per game, per language, stored on the device under its own versioned key in `src/core/storage`.
- An age-track policy: interaction mode, no speed scoring, and when the level may change.
- A generic `adaptive` block in game content JSON (`levels[]` with lever values), validated with zod.
- The Animal Restaurant migrated onto the engine.

**Deferred (v2+)**: parent level view and override, the parent's "start French higher" option, the 14-day decay (`lastPlayedDay` is stored now, so no migration will be needed), window-percentage rules (≥85% / <60% over the last 8), response-time skip-ahead for age 5, the frustration guard / confidence round, sharing a word's item state across games, parent export, real drag on the age-5 track (the restaurant is tap-only today), and restaurant levels that need new content or audio (attribute, two-item order, audio-first).

## 2. Types

### 2.1 Content contract (`src/content/schema.ts`)

Each game JSON gets an `adaptive` block. Every lever is optional. A template reads only the levers it understands. The engine itself never reads lever values. It picks a level number and an item id.

```ts
export const LevelDescriptorSchema = z.object({
  choiceCount: z.number().int().min(1).max(8).optional(),   // plates, bushes, homes, shelf, palette, instruments, beds
  counts: z.array(z.number().int().min(1).max(10)).min(1).optional(), // quantities requested (restaurant 1..3)
  setSize: z.number().int().min(1).max(10).optional(),      // picnic train passengers / items per round
  distractor: z.enum(['far', 'near', 'same-category', 'same-item-variant']).optional(),
  request: z.enum(['noun', 'quantity', 'attribute', 'two-step', 'negation', 'sequence', 'riddle', 'rule-switch']).optional(),
  sequenceLength: z.number().int().min(1).max(6).optional(), // orchestra echo, puppet multi-step
  support: z.enum(['picture-audio', 'partial-reveal', 'audio-first', 'audio-only', 'clue']).optional(),
  scaffold: z.enum(['outline', 'symbol', 'none']).optional(), // ghost slots, bed labels
  speed: z.number().positive().optional(),                  // tempo multiplier
  extra: z.record(z.union([z.string(), z.number(), z.boolean()])).optional(), // game-specific escape hatch
}).strict();

export const TrackLevelsSchema = z.object({ start: z.number().int().min(1), min: z.number().int().min(1).default(1), max: z.number().int().min(1) });

export const AdaptiveRulesSchema = z.object({
  upCleanStreak: z.number().int().min(1).default(3),
  downMisses: z.number().int().min(1).default(2),
  downWindow: z.number().int().min(1).default(3),
  trialsPerRound: z.number().int().min(1).default(3),
  maxChangesPerRound: z.number().int().min(1).default(1),
  retryAfterTrials: z.number().int().min(1).default(2),
  masteredBox: z.number().int().min(2).max(5).default(3),
}).partial();

export const GameAdaptiveSchema = z.object({
  tracks: z.object({ age2: TrackLevelsSchema, age5: TrackLevelsSchema }),
  rules: AdaptiveRulesSchema.optional(),
  levels: z.array(LevelDescriptorSchema).min(1),
}).superRefine(/* 1 <= min <= start <= max <= levels.length for each track */);
```

`AnimalRestaurantContentSchema` gains `adaptive: GameAdaptiveSchema`. A restaurant-specific refinement checks that `choiceCount` is set on every level and is ≤ `items.length`. `AgeTrackConfigSchema` drops `choiceCount` and `counts`, which move into the levels. It keeps `hintMode` and `hintDelayMs`, because those are age policy, not difficulty.

How the 8 research games map onto the levers (§4 of the research doc):

| Game | Main levers |
|---|---|
| Animal Restaurant | choiceCount, distractor, counts → request, support |
| Travel Suitcase | choiceCount (shelf), distractor, setSize (items per request), request (attribute/negation), support |
| Puppet Says | choiceCount (spots), distractor, request (noun→verb→two-step), sequenceLength, speed |
| Picnic Train | setSize, scaffold (outline→none), extra.layout (rows/scattered), request (match→count→missing addend) |
| Sorting Beds | choiceCount (beds), request (rule-switch), extra.attributes (1/2), scaffold (picture→symbol→none) |
| Who Lives Here? | choiceCount (homes), distractor, support (picture→name→riddle) |
| Who's Hiding? | support (partial-reveal → audio-only), choiceCount (bushes), distractor, extra.reveal |
| Kitchen Orchestra | sequenceLength, speed, support (lit→flash→audio-only), choiceCount |

### 2.2 Engine types (`src/core/adaptive/types.ts`)

```ts
type AgeTrack = 'age2' | 'age5';                // re-exported from core/storage/schema
type SkillKey = string;                          // `${world}.${gameId}.${lang}`, e.g. language-house.animal-restaurant.fr
type OutcomeKind = 'clean' | 'assisted' | 'miss';

interface TrialResult { itemId: string; firstTryCorrect: boolean; hinted: boolean; rtMs?: number }

interface GameLevelsMeta {                       // built from content; the engine never sees the lever values
  levelCount: number;
  tracks: Record<AgeTrack, { start: number; min: number; max: number }>;
  rules: Required<AdaptiveRules>;                // content overrides merged onto DEFAULT_RULES
}

interface ItemState { box: 1 | 2 | 3 | 4 | 5; seen: number; clean: number; lastSeenDay: string }

interface SkillState {
  level: number;                                 // 1-based
  cleanStreak: number;
  recent: OutcomeKind[];                         // last outcomes since the last level change, newest last, length <= 8
  afterDrop: boolean;                            // serve a known item next
  lastPlayedDay: string;                         // YYYY-MM-DD local; used later for decay
  items: Record<string, ItemState>;
}

interface AdaptiveProfile { schemaVersion: 1; profileId: string; skills: Record<SkillKey, SkillState> }

interface SkillSessionState {                    // in memory only; reset per game visit
  trialIndex: number; trialsInRound: number; changesInRound: number;
  retryQueue: { itemId: string; dueAtTrial: number }[];
  lastItemId: string | null; knownSinceNew: number;
}

interface TrackPolicy { interaction: 'tap' | 'drag'; useResponseTime: boolean; levelChange: 'after-trial' | 'between-rounds' }
```

## 3. Engine API and rule semantics

All functions are pure. They return new objects and never mutate their inputs. Time comes in as a day key (`localDayKey`), and randomness as `random: () => number`.

| Function | Semantics |
|---|---|
| `classify(r: TrialResult): OutcomeKind` | A wrong first tap is `miss`. A correct first tap after an auto-hint is `assisted`. Otherwise `clean`. |
| `initialSkill(meta, track, today): SkillState` | `level = tracks[track].start`. Everything else is empty. |
| `clampToTrack(skill, meta, track)` | Clamps the level to `[min, max]` of the *current* track. It runs on every read, so a parent who changes a child's age track never leaves an out-of-range level behind. |
| `decideChange(skill, meta, track): -1 \| 0 \| 1` | Returns `-1` if the last `downWindow` entries of `recent` contain at least `downMisses` misses. Otherwise `+1` if `cleanStreak >= upCleanStreak`. Otherwise `0`. Down wins over up if both are true, which only happens with odd custom rules. |
| `applyChange(skill, delta, meta, track)` | Sets `level = clamp(level + delta)`, `recent = []`, `cleanStreak = 0`. If `delta < 0`, sets `afterDrop = true`. At the floor, a down decision still clears `recent` and sets `afterDrop` (a soft drop: the child gets a known item even though the level cannot fall). At the ceiling, an up decision is a no-op and `cleanStreak` keeps counting. |
| `recordTrial(skill, session, result, meta, track, today)` → `{ skill, session, change }` | Classifies the result. Updates the item (below). Pushes to `recent`. `clean` increments `cleanStreak`, while `assisted` and `miss` reset it to 0. A miss enqueues a retry at `trialIndex + retryAfterTrials`. Then `trialIndex++` and `trialsInRound++`. With an `after-trial` policy and `changesInRound < maxChangesPerRound`, it applies `decideChange`. When `trialsInRound` reaches `trialsPerRound`, it calls `endRound`. |
| `endRound(skill, session, meta, track)` | With a `between-rounds` policy, applies `decideChange` once. It always resets `trialsInRound` and `changesInRound`. Leaving the game also counts as a round boundary. |
| `selectNextItem(skill, session, candidates, meta, today, random): string` | See the priority list below. |
| `trackPolicy(track): TrackPolicy` | See §5. |

**Definitions**
- **Trial**: one request (one animal in the restaurant). **Round**: `trialsPerRound` trials of the same skill (3 animals for the restaurant).
- **First try**: the child's first answer to the trial. The restaurant already treats a double tap as one try: plate taps are locked for 400 ms after a wrong tap. The engine is called exactly once per trial, on the first accepted plate tap. Later wrong taps on the same trial are ignored by the engine, so a trial is at most one miss.
- **Hinted**: the auto-hint (glow plus repeat after `hintDelayMs`) fired before the first tap. A voluntary replay (tapping the animal or the bubble) is **not** a hint, because listening again is behaviour we want.
- **Down rule choice: "2 misses within the last 3 trials"** (`downMisses: 2, downWindow: 3`). "2 in a row" never fires for a child alternating miss/hit at 50%. That child would also never reach 3 clean in a row, so she would stall at a level that is too hard, far below the 75–85% (age 5) and about 90% (age 2) targets. The window matches the research's restaurant-specific rule. Setting `downWindow: 2` gives strict "2 in a row". Both values are configurable per game.
- `recent` is cleared on every level change, so misses made at the old level never cause a second drop at the new one.

**Item update (Leitner, per skill, so per language)**: `clean` raises the box by 1 (max 5). `miss` sets the box to 1. `assisted` keeps the box unchanged. `seen++`, and `lastSeenDay = today`. Review intervals in days by box: `[0, 0, 2, 4, 7]`.

**`selectNextItem` priority.** At each step, skip `lastItemId` if any other candidate exists.
1. If `afterDrop`: pick a known item (box ≥ `masteredBox`). If there is none, pick the seen item with the highest box. If there is none, pick any candidate. Then clear `afterDrop`.
2. A retry whose `dueAtTrial <= trialIndex` (oldest first).
3. A seen item that is due by its interval, lowest box first.
4. A new (unseen) item if `knownSinceNew >= 3` or no item has been seen yet. This gives roughly 1 new item per 3 known.
5. Otherwise a random seen item.

`candidates` is the list of item ids the game marks as eligible at the current level. Content items that are not in storage count as new. Stored items that were removed from content are ignored, but they are kept on disk.

## 4. Persistence

- **Where:** new files `src/core/storage/adaptiveSchema.ts` and `adaptiveStore.ts`. They reuse `StorageDriver` and `browserStorage()` from `store.ts`; the only change there is exporting `browserStorage`.
- **Key:** `kids-app-adaptive:<profileId>`, one key per profile, holding an `AdaptiveProfile` JSON with `schemaVersion: 1`. The version lives in the payload and not in the key, so later migrations can rewrite the same key.
- **Why not inside `kids-app-state-v2`:**
  - `loadAppState` treats any `schemaVersion !== 2` as unreadable and falls back to defaults. Bumping it to v3 would put leisure balances at risk on a bad migration.
  - A separate key keeps leisure and adaptive data structurally independent (§6).
  - It enforces "no mixing across profiles" by construction.
  - The localStorage fallback is still the storage layer's own driver, not a new mechanism.
- **Load:**
  - Missing key, or invalid or corrupt JSON: start from defaults, and the next write replaces the bad value.
  - `schemaVersion < 1`: impossible today. A `MIGRATIONS: Record<number, (old) => unknown>` chain is still in place for future versions.
  - `schemaVersion > 1` (written by a newer build, then the app was downgraded): use in-memory defaults and **never write**, so newer data is not clobbered.
  - A hand-written shape guard drops malformed skill entries one by one. This follows `store.ts`, so `src/core` gets no zod dependency.
  - The prototype's `ar_state` has no level data, so there is nothing to migrate from it.
- **When written:** after every `recordTrial` (about 1 KB; a child can quit mid-round at any moment) and on scene exit. Never on the 1 s leisure tick.
- The parent "reset balance" action does not touch this key. Profile deletion does not exist yet. When it is added, it must also remove this key.

## 5. Age-track policy (`src/core/adaptive/policy.ts`)

| | age2 | age5 |
|---|---|---|
| `interaction` | `tap` (tap-to-send; forced) | `drag` where the template supports it, otherwise `tap` |
| `useResponseTime` | `false` (hard-coded; content cannot enable it) | `false` in v1 (skip-ahead deferred) |
| `levelChange` | `between-rounds` | `after-trial` (takes effect from the next trial, at most `maxChangesPerRound`) |
| Restaurant levels (owner decided) | start L1, max L5 (no ceiling: `max = levels.length`) | start L4, max L5 |

The policy is code, not content, so no game JSON can put speed scoring or drag on the age-2 track. `rtMs` may be recorded on `TrialResult`, but in v1 no function reads it. A test asserts this.

## 6. Leisure separation guarantee

- `src/core/adaptive` imports nothing from `src/core/leisure`, and the reverse is also true. The restaurant adds **no** new `LearningSession` calls. `reportInteraction` keeps firing on every tap, correct or wrong, exactly as today.
- The adaptive store writes only its own key. It never reads or writes `kids-app-state-v2`.
- **Proof in tests** (`tests/unit/adaptiveLeisureIsolation.test.ts`):
  1. A static check reads every file under `src/core/leisure/**` and `src/core/adaptive/**` and asserts there are no cross imports.
  2. A behavioural check runs two identical `LearningSession` timelines (same ticks and interactions). One is fed an all-miss outcome sequence through the engine and adaptive store, the other an all-clean sequence. Both share one in-memory driver. The test asserts identical `balanceSec`, `earnedTodaySec` and `activeSec`, and a byte-identical `kids-app-state-v2` value.
  3. Store isolation: saving an adaptive profile leaves the `kids-app-state-v2` value unchanged.

The existing e2e tests ("wrong choices never reduce the leisure balance", double tap) stay as the end-to-end proof.

## 7. Restaurant integration

**`animal-restaurant.json`.** Remove `choiceCount` and `counts` from `ageTracks`, and add:

```json
"adaptive": {
  "tracks": { "age2": { "start": 1, "min": 1, "max": 5 }, "age5": { "start": 4, "min": 1, "max": 5 } },
  "levels": [
    { "choiceCount": 2, "counts": [1],       "distractor": "far",  "request": "noun" },
    { "choiceCount": 3, "counts": [1],       "distractor": "far",  "request": "noun" },
    { "choiceCount": 3, "counts": [1],       "distractor": "near", "request": "noun" },
    { "choiceCount": 3, "counts": [1, 2, 3], "distractor": "near", "request": "quantity" },
    { "choiceCount": 4, "counts": [1, 2, 3], "distractor": "near", "request": "quantity" }
  ]
}
```

L4 is today's age-5 behaviour (3 plates, quantities). Age 5 starts at L4 (owner decision), so today's age-5 experience is unchanged on first play. This deviates from research §6 ("age 5 → L3"). Age 2 has no ceiling and can climb through all levels. L5 needs a 4-plate layout. `computeRestaurantLayout` already handles `n > 3` generically, but 4 plates need visual QA on both orientations.

**`choiceServe.ts`.** `buildRound(items, level: ChoiceServeLevel, language, random, targetId?: string)`, where `ChoiceServeLevel = { choiceCount; counts; distractor? }` is read from the level descriptor.
- If `targetId` is given, it is the target item. The template picks the distractors:
  - `far` prefers items whose `color` differs from the target and from each other.
  - `near` prefers at least one item with the target's `color` (apple/strawberry, banana/cheese, carrot/orange, pear/broccoli), and falls back to random.
- The count variant still applies when `counts.length > 1` and the target supports several counts. The target count is random among the supported counts.
- Without `targetId`, behaviour is unchanged (a random target), so other callers keep working.
- `pickLanguage` is unchanged.

**`appContext.ts`.** Add `readonly adaptive = new AdaptiveStore()`, built in the constructor body with the default driver, so `main.ts` does not change. Also add `createSkillSession(gameId, meta)`, which returns a `SkillSession` (thin wrapper in `core/adaptive/skillSession.ts`) bound to the current profile and track and to `nowMs`.

**`RestaurantScene.ts`**
- `create()`:
  - Build `GameLevelsMeta` from `content.restaurant.adaptive`, and create the skill session.
  - Compute the layout with the starting level's `choiceCount`. Background, counter and the animal hit zone do not depend on the plate count.
- `startRound()` (one animal = one trial):
  - At a round boundary (`trialsInRound === 0`), pick the language with `pickLanguage`. The language stays fixed for the 3 animals of the round, so each round feeds one skill. Today the language is random per animal; no test asserts that.
  - Read the level descriptor. If `choiceCount` changed, recompute `layout.plates` via `computeRestaurantLayout`.
  - `targetId = session.selectNextItem(eligibleIds)`, where eligible means all items. At quantity levels, items without count prompts still work at count 1.
  - Call `buildRound(..., targetId)`.
  - Reset `round.hinted = false` and `round.recorded = false`.
- `giveHint()`: if it fires from the idle timer while `!round.recorded`, set `round.hinted = true`.
- `choose()`: after the existing lock check, if `!round.recorded`, call `session.record({ itemId: target.item.id, firstTryCorrect, hinted })` and set `recorded = true`. The session persists. Wrong-tap feedback, hints, stars and leisure calls are unchanged.
- `cleanup()`: call `session.endVisit()` (round boundary plus persist).
- `RoundInfo` gains `level` and `skillKey`. These are additive; e2e reads only the fields it declares.

**Why the e2e tests in `tests/e2e/journey.spec.ts` stay green**
- Every test uses `profile-a` (age 2) in a fresh browser context, so storage is empty and the level is L1: 2 plates, count 1, the same `computeRestaurantLayout(w, h, 2)` as today.
  - `choiceCenters.length === choiceCount` holds, and so does the click at 28% width / 64% height on the left plate.
  - `tries` semantics and the 400 ms double-tap lock are untouched, so `tries === 1` still holds.
  - The animal tap still leaves `tries === 0` and `correctCount === 0`.
  - Stars and leisure flow are unchanged.
- No test plays 3 rounds, and age 2 changes level only at round ends, so no test sees a level change.
- Screenshots may show different foods, as they already do today, because the food choice is random.

## 8. Unit test plan (vitest)

- `adaptiveRules.test.ts`:
  - classify (clean / assisted / miss); 3 clean → up; assisted breaks the streak but is not a miss.
  - miss, hit, miss → down (window 3); with `downWindow: 2` the same sequence does not drop; 2 consecutive misses drop.
  - `recent` is cleared after a change, so no cascade.
  - At most one change per round with `after-trial`; `between-rounds` defers the change to `endRound`.
  - Floor soft drop sets `afterDrop`; ceiling up is a no-op; down wins over up with custom rules.
  - Track clamp after an age-track change; content rule overrides merge onto the defaults.
- `adaptiveSelect.test.ts`:
  - After a drop, a box ≥ 3 item is served, with fallbacks to the highest box and then to any item.
  - A miss returns after `retryAfterTrials`; due-by-interval ordering; about 1 new per 3 known.
  - Never the same item twice when alternatives exist; removed content items are ignored; deterministic with a seeded random.
- `adaptivePolicy.test.ts`:
  - age2 is tap, between-rounds, no response time; age5 is after-trial.
  - Identical outcomes with different `rtMs` give identical state on both tracks in v1.
- `adaptiveStore.test.ts`:
  - Defaults when the key is empty; round-trip; corrupt JSON gives defaults; a future `schemaVersion` gives defaults and is never written.
  - Malformed skill entries are dropped; per-profile keys are isolated; the migration chain is invoked for older versions (stub v0 fixture).
- `skillSession.test.ts`: record persists after each trial; `endVisit` closes the round; `initialSkill` uses the track start (age2 → L1, age5 → L4); age2 max equals the level count.
- `adaptiveLeisureIsolation.test.ts`: the three checks in §6.
- Updates to existing tests:
  - `choiceServe.test.ts`: level-based `buildRound`, `targetId` honoured, `far`/`near` distractors, count variant only at quantity levels.
  - `contentSchema.test.ts`: the `adaptive` block validates; bad track bounds and a missing `choiceCount` are rejected; the age-2 start level has 2 plates and count 1.
  - `restaurantLayout.test.ts`: add the 4-plate case in both orientations.

## 9. Implementation file list

**New:**
- `src/core/adaptive/{types,rules,selectItem,policy,skillSession,index}.ts`
- `src/core/storage/{adaptiveSchema,adaptiveStore}.ts`
- `tests/unit/{adaptiveRules,adaptiveSelect,adaptivePolicy,adaptiveStore,skillSession,adaptiveLeisureIsolation}.test.ts`

**Changed:**
- `src/content/schema.ts`
- `src/content/games/animal-restaurant.json`
- `src/games/templates/choiceServe.ts`
- `src/games/restaurant/RestaurantScene.ts`
- `src/game/appContext.ts`
- `src/core/storage/store.ts` (export `browserStorage` only)
- `tests/unit/{choiceServe,contentSchema,restaurantLayout}.test.ts`

**Unchanged:** everything in `src/core/leisure`, `tests/e2e/*`, `main.ts`, `createGame.ts`, root prototype files, `package.json`, the vite/tsconfig/vitest/playwright configs and CI. No new dependencies.

**Owner decisions (Maor, 2026-11-11, final):**
1. Age 5 starts at L4 (today's behaviour).
2. Age 2 has no level ceiling (`max = levels.length`); she can climb through all levels.
3. Down rule: 2 misses in the last 3 trials (`downMisses: 2`, `downWindow: 3`).
4. The language stays fixed per round of 3 animals.
5. Tapping to replay the request is not a hint.

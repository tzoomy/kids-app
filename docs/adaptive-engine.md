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

**Deferred (v2+)**: parent level view and override, the parent's "start French higher" option, the 14-day decay (`lastPlayedDay` is stored now, so no migration will be needed), window-percentage rules (≥85% / <60% over the last 8), response-time skip-ahead for age 5, the frustration guard / confidence round, sharing a word's item state across games, parent export, real drag on the age-5 track (the restaurant is tap-only today), and pre-generated (Gemini) audio for the new restaurant request lines of L6–L9, which use device TTS in v1.

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

`AnimalRestaurantContentSchema` gains `adaptive: GameAdaptiveSchema`. A restaurant-specific refinement checks that `choiceCount` is set on every level and is between 2 and `items.length` (a 1-plate level would make every answer a free clean). It also restricts `request` to noun/quantity/attribute/two-step/negation and `support` to `audio-only`, requires items with exactly two distinct colour `variants` for attribute and negation levels, requires `choiceCount >= 3` for a two-item level, and validates `twoStepFrames` (`{a}`, `{b}`) and each item's `phrase`. `AgeTrackConfigSchema` drops `choiceCount` and `counts`, which move into the levels. It keeps `hintMode` and `hintDelayMs`, because those are age policy, not difficulty.

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

### 2.2 Level lists for the other seven games (design only, not implemented)

Convention for these seven games (a design proposal, not a rule the engine enforces): the age-5 start level is at least two steps above the age-2 start and introduces a harder kind of demand (a new request type, less scaffolding, or a longer sequence), not just one more option. Levels below the age-2 start are the drop floor (`min = 1` on both tracks), so a drop always lands on easier, known material; for that reason age 2 starts above L1 in every game except Kitchen Orchestra (see below). The Animal Restaurant deliberately does not follow the two-step gap: its age-5 start is one level above the age-2 start (L4 → L5, which adds a 4th plate and look-alike distractors). That is the owner's explicit decision after playtesting (see §7), and it applies to the restaurant only. Age 2 has no ceiling (`max = levels.length`); age 5 has the same `max`. Lever names are the generic ones from §2.1; `extra.*` is the game-specific escape hatch. These lists are proposals that each game's own issue may refine, and they need the owner's approval when that game is built.

**Travel Suitcase** (age 2 starts L3, age 5 starts L5)

| L | Levers |
|---|---|
| 1 | choiceCount 3 (shelf), setSize 1, distractor far, request noun |
| 2 | choiceCount 4, setSize 1, distractor near, request noun |
| 3 | choiceCount 4, setSize 2 (two items per request), distractor far, request noun |
| 4 | choiceCount 5, setSize 2, distractor near, request noun |
| 5 | choiceCount 6, setSize 2, distractor near, request attribute (colour) |
| 6 | choiceCount 6, setSize 3, distractor near, request attribute |
| 7 | choiceCount 6, setSize 3, request negation ("not the red one") |
| 8 | choiceCount 8, setSize 3, request negation, support audio-only (no picture list) |

**Puppet Says** (age 2 starts L3, age 5 starts L5)

| L | Levers |
|---|---|
| 1 | choiceCount 2 (spots), request noun ("touch the hat"), sequenceLength 1, speed 0.8 |
| 2 | choiceCount 3, request noun, sequenceLength 1, speed 0.8 |
| 3 | choiceCount 3, request noun + extra.verb (action words: "jump"), sequenceLength 1, speed 1 |
| 4 | choiceCount 4, extra.verb, sequenceLength 1, speed 1 |
| 5 | choiceCount 4, request two-step (noun + verb), sequenceLength 2, speed 1 |
| 6 | choiceCount 4, request two-step, sequenceLength 2, speed 1.2 |
| 7 | choiceCount 5, request sequence, sequenceLength 3, speed 1.2 |
| 8 | choiceCount 5, request sequence, sequenceLength 3, speed 1.4, support audio-only |

**Picnic Train** (age 2 starts L2, age 5 starts L5)

| L | Levers |
|---|---|
| 1 | setSize 2, scaffold outline, extra.layout rows, request match |
| 2 | setSize 3, scaffold outline, extra.layout rows, request match |
| 3 | setSize 3, scaffold symbol, extra.layout rows, request match |
| 4 | setSize 4, scaffold symbol, extra.layout rows, request quantity (count the passengers) |
| 5 | setSize 4, scaffold none, extra.layout scattered, request quantity |
| 6 | setSize 5, scaffold none, extra.layout scattered, request quantity |
| 7 | setSize 5, scaffold none, scattered, request two-step (missing addend, sums up to 5) |
| 8 | setSize 6, scaffold none, scattered, request two-step (missing addend, sums up to 6) |

**Sorting Beds** (age 2 starts L2, age 5 starts L5)

| L | Levers |
|---|---|
| 1 | choiceCount 2 (beds), extra.attributes 1, picture labels on the beds |
| 2 | choiceCount 2, extra.attributes 1, picture labels, scaffold outline (ghost slots) |
| 3 | choiceCount 3, extra.attributes 1, picture labels, scaffold outline |
| 4 | choiceCount 3, extra.attributes 1, scaffold symbol |
| 5 | choiceCount 3, extra.attributes 2 (colour, then size, one rule per round), scaffold symbol |
| 6 | choiceCount 4, extra.attributes 2, scaffold symbol |
| 7 | choiceCount 4, extra.attributes 2, scaffold none |
| 8 | choiceCount 4, request rule-switch (the rule changes mid-round), scaffold none |

**Who Lives Here?** (age 2 starts L2, age 5 starts L5)

| L | Levers |
|---|---|
| 1 | choiceCount 2 (homes), distractor far, support picture-audio |
| 2 | choiceCount 3, distractor far, support picture-audio |
| 3 | choiceCount 3, distractor same-category, support picture-audio |
| 4 | choiceCount 4, distractor same-category, support picture-audio |
| 5 | choiceCount 4, distractor same-category, support audio-first (the name is spoken, no picture of the animal) |
| 6 | choiceCount 5, distractor same-category, support audio-first |
| 7 | choiceCount 5, request riddle ("who lives in the water?"), support clue |
| 8 | choiceCount 6, request riddle, support clue |

**Who's Hiding?** (age 2 starts L2, age 5 starts L5)

| L | Levers |
|---|---|
| 1 | choiceCount 2 (bushes), distractor far, support partial-reveal, extra.reveal 0.9 |
| 2 | choiceCount 3, distractor far, partial-reveal, extra.reveal 0.8 |
| 3 | choiceCount 3, distractor same-category, partial-reveal, extra.reveal 0.6 |
| 4 | choiceCount 4, distractor same-category, partial-reveal, extra.reveal 0.5 |
| 5 | choiceCount 4, distractor same-category, partial-reveal, extra.reveal 0.3 (ears or tail only) |
| 6 | choiceCount 5, distractor same-category, partial-reveal, extra.reveal 0.3 |
| 7 | choiceCount 5, distractor same-category, support audio-only (the animal's sound only) |
| 8 | choiceCount 6, distractor same-category, support audio-only, extra.soundMs 800 (shorter sound) |

**Kitchen Orchestra** (age 2 starts L1, age 5 starts L4)

| L | Levers |
|---|---|
| 1 | sequenceLength 1, choiceCount 3 (instruments), speed 0.8, support lit |
| 2 | sequenceLength 2, choiceCount 3, speed 0.8, support lit |
| 3 | sequenceLength 2, choiceCount 4, speed 1, support lit |
| 4 | sequenceLength 3, choiceCount 4, speed 1, support lit |
| 5 | sequenceLength 3, choiceCount 4, speed 1, support flash |
| 6 | sequenceLength 4, choiceCount 4, speed 1.2, support flash |
| 7 | sequenceLength 4, choiceCount 5, speed 1.2, support audio-only |
| 8 | sequenceLength 5, choiceCount 5, speed 1.2, support audio-only |

Kitchen Orchestra is the one exception to "age 2 starts above L1" (stated at the top of this section): copying even a two-note sequence is already demanding for a 2-year-old, so age 2 stays on the first level and the age-5 start (L4, three notes) is the meaningful jump.

### 2.3 Engine types (`src/core/adaptive/types.ts`)

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
| `recordTrial(skill, session, result, meta, track, today)` → `{ skill, session, change }` | Classifies the result. Updates the item (below). Pushes to `recent`. `clean` increments `cleanStreak`, while `assisted` and `miss` reset it to 0. A miss enqueues a retry at `trialIndex + retryAfterTrials`. Then `trialIndex++` and `trialsInRound++`. It then computes `decideChange` after every trial. With an `after-trial` policy and `changesInRound < maxChangesPerRound`, it applies the decision at once. With `between-rounds`, it stores the decision in `session.pendingChange` (a down replaces an up; a pending down is never replaced; `recent` and `cleanStreak` are not cleared until the change is applied), so the windows span rounds. When `trialsInRound` reaches `trialsPerRound`, it calls `endRound`. |
| `endRound(skill, session, meta, track)` | Applies `session.pendingChange` (at most one change) through `applyChange`, then clears it. It always resets `trialsInRound` and `changesInRound`. Leaving the game also counts as a round boundary, and a second call is a no-op. |
| `selectNextItem(skill, session, candidates, meta, today, random): string` | See the priority list below. |
| `trackPolicy(track): TrackPolicy` | See §5. |

**Definitions**
- **Trial**: one request (one animal in the restaurant). **Round**: `trialsPerRound` trials of the same skill (3 animals for the restaurant).
- **First try**: the child's first answer to the trial. The restaurant already treats a double tap as one try: plate taps are locked for 400 ms after a wrong tap. The engine is called exactly once per trial, on the first accepted plate tap. Later wrong taps on the same trial are ignored by the engine, so a trial is at most one miss.
- **Hinted**: the auto-hint (glow plus repeat after `hintDelayMs`) fired before the first tap. A voluntary replay (tapping the animal or the bubble) is **not** a hint, because listening again is behaviour we want.
- **Down rule choice: "2 misses within the last 3 trials"** (`downMisses: 2, downWindow: 3`). "2 in a row" never fires for a child alternating miss/hit at 50%. That child would also never reach 3 clean in a row, so she would stall at a level that is too hard, far below the 75–85% (age 5) and about 90% (age 2) targets. The window matches the research's restaurant-specific rule. Setting `downWindow: 2` gives strict "2 in a row". Both values are configurable per game.
- `recent` is cleared on every level change, so misses made at the old level never cause a second drop at the new one.
- **Age 2 decides across rounds.** The up/down rules look at the last trials regardless of round boundaries, but the change only lands at a round end. Example: round 1 = clean, clean, miss and round 2 = miss, clean, clean holds 2 misses in trials 3–5, so the level drops at the end of round 2. Round 1 = miss, clean, clean and round 2 = clean, assisted, clean completes 3 clean at trial 4, so the level rises at the end of round 2, even though the streak broke at trial 5.
- **Blocked drop on age 5.** If the one-change cap blocks a drop (for example a rise at trial 1, then two misses), the drop is stored in `pendingChange` and applied at the round boundary. It is still a single change and `recent` is cleared by it, so the next round's first answer, even a clean one, cannot trigger a stale drop. A blocked rise is not carried: the clean streak re-fires it on the next clean answer.
- **`assisted` on the age-5 track (v1).** Age 5 uses `hintMode` other than `demonstrate`, so the idle auto-hint timer is not started and no hint fires before the first tap. Age-5 outcomes are therefore only `clean` or `miss` in v1; `assisted` occurs on the age-2 track only. Starting the idle hint on age 5 would change existing behaviour and needs owner approval.

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
  - **No migration for the 9-level curve.** The earlier (5-level) version of this PR was never merged or deployed, so no device holds adaptive data written by it, and `schemaVersion` stays 1. If a development build did leave data on a test device, clear that browser's site data.
- **When written:** after every `recordTrial` (about 1 KB; a child can quit mid-round at any moment) and on scene exit. Never on the 1 s leisure tick.
- The parent "reset balance" action does not touch this key. Profile deletion does not exist yet. When it is added, it must also remove this key.

## 5. Age-track policy (`src/core/adaptive/policy.ts`)

| | age2 | age5 |
|---|---|---|
| `interaction` | `tap` (tap-to-send; forced) | `drag` where the template supports it, otherwise `tap` |
| `useResponseTime` | `false` (hard-coded; content cannot enable it) | `false` in v1 (skip-ahead deferred) |
| `levelChange` | `between-rounds` | `after-trial` (takes effect from the next trial, at most `maxChangesPerRound`) |
| Restaurant levels (owner decided) | start L4, min L1, max L9 (no ceiling: `max = levels.length`) | start L5, min L1, max L9 |

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
  "tracks": { "age2": { "start": 4, "min": 1, "max": 9 }, "age5": { "start": 5, "min": 1, "max": 9 } },
  "levels": [
    { "choiceCount": 2, "counts": [1],       "distractor": "far",  "request": "noun" },
    { "choiceCount": 3, "counts": [1],       "distractor": "far",  "request": "noun" },
    { "choiceCount": 3, "counts": [1],       "distractor": "near", "request": "noun" },
    { "choiceCount": 3, "counts": [1, 2, 3], "distractor": "near", "request": "quantity" },
    { "choiceCount": 4, "counts": [1, 2, 3], "distractor": "near", "request": "quantity" },
    { "choiceCount": 4, "counts": [1],       "distractor": "near", "request": "attribute" },
    { "choiceCount": 4, "counts": [1],       "distractor": "near", "request": "two-step" },
    { "choiceCount": 4, "counts": [1],       "distractor": "near", "request": "negation" },
    { "choiceCount": 4, "counts": [1],       "distractor": "near", "request": "negation", "support": "audio-only" }
  ]
}
```

**The 9-level restaurant curve (owner-approved after playtesting).**

| L | Plates | Request | What changes |
|---|---|---|---|
| 1 | 2 | noun | very different foods (far distractors). Drop floor |
| 2 | 3 | noun | far distractors. Drop floor |
| 3 | 3 | noun | look-alikes (near distractors). Drop floor |
| 4 | 3 | quantity | quantities 1–3 (today's game). **Age-2 start** |
| 5 | 4 | quantity | four plates, quantities and look-alikes. **Age-5 start** |
| 6 | 4 | attribute | the colour is in the request ("the red apple"); both colours of that food are on the table |
| 7 | 4 | two-step | two foods in one request ("an apple and a banana") |
| 8 | 4 | negation | "an apple, but not the red one" |
| 9 | 4 | negation + `support: audio-only` | the same negation as L8, but the request is only heard: no text bubble or other visual cue |

**Deviation from research §6** (age 2 → L1, age 5 → L3). Playtesting showed that the old L1–L3 were too easy for both girls, so age 2 now starts at today's game (L4) and age 5 one step higher (L5). L1–L3 stay as the drop floor (`min = 1` on both tracks), so a drop from the new start levels still lands on easier material with a known item served first. Age 2 has no ceiling (`max = 9`).

**Request types for L6–L9** (all in content; no grammar in code)
- **Attribute (L6).** Items with colour `variants` (apple red/green, pear green/yellow, banana yellow/green, grapes purple/green). Each variant carries its own EN/FR line (`pick`). The round puts both colour versions of the item on the table, so the colour word decides the answer; the two other plates are distractors from other foods. The variant plates are drawn procedurally in their own colour. Only items with variants are eligible targets at L6, L8 and L9 (`eligibleTargetIds`).
- **Two-step (L7).** Two different foods, composed from `twoStepFrames` (`"I want {a} and {b}, please!"`) and each item's `phrase` (`"an apple"`, `"une pomme"`). Interaction: tap the two requested plates in any order. The first correct plate is served (its food flies to the animal and the plate leaves); the trial completes on the second. A wrong tap is a miss for the trial (it is recorded at once, 400 ms double-tap lock unchanged, a hint or a replay may follow as for any miss) and the trial stays open until both are served. A first try is clean only if both taps are correct, no wrong tap happens in between, and no idle auto-hint fired before the trial was recorded (a hint shown between the two plates marks the trial hinted, so it is `assisted`). After the first plate the scene repeats the request after 700 ms so the child knows the second food is still wanted; this replay is not a hint. The second food is taken from foods the child already knows when possible (the mastered items right after a level drop, otherwise any seen item), so a drop to L7 does not introduce an unseen food in the second slot. The engine records the item the scheduler picked (the first food). The two-item plate set has 4 plates, so there are 2 wrong plates.
- **Negation (L8).** One answer by design: the animal names a food and excludes a colour ("I want an apple, but not the red one"), so the correct plate is the other colour of the same food. The excluded colour is on the table and is a wrong answer, as are the unrelated foods. This avoids the "any non-matching plate is right" shape, where 3 of 4 plates would be correct and a negation would be answered by chance. Each variant carries its own EN/FR `not` line.
- **Negation + voice-only (L9).** The same negation request and rule as L8 (one correct plate, the excluded colour on the table as a wrong plate, same levers) with `support: audio-only`. L8 keeps its visual cues (prompt bubble with 🔊); L9 has none, so L9 is strictly harder than L8 and a drop from 9 to 8 is a real easement. There is no visual cue of the requested food: no prompt bubble (and so no 🔊 button), no food icon, and no pointing. The animal's spoken request is the only source. Tapping the animal still replays it (not a hint). On the age-2 track the idle auto-hint (and the hint after a wrong tap) on this level only repeats the spoken request, with no pulse or sparkle on the answer plate; it still counts as a hint for the engine. The former open question about L9 is resolved (§10).

**Voice of the new lines.** The L6–L8 lines (attribute, two-item, negation) have no recorded clip, so they are spoken by the device TTS voice, which sounds different from the recorded clips used for every other line. The girls will hear a different voice on these levels; this is expected until pre-generated audio is added.

**Audio for L6–L9.** Line ids are `attr.{item}.{color}.{lang}`, `not.{item}.{color}.{lang}` and `pair.{itemA}.{itemB}.{lang}`. None has a static clip in `audio-manifest.json`, so `StaticFileProvider` resolves false and `AudioManager` falls through to the device TTS provider with the round text; a test pins this. L9 uses the same `not.*` lines as L8, so it is also spoken by the device TTS voice. Pre-generated audio for the new lines is a later pass.

**Layout.** `computeRestaurantLayout` handles 4 plates in both orientations. They need visual QA on a real device.

**`choiceServe.ts`.** `buildRound(items, level: ChoiceServeLevel, language, random, targetId?: string, frames?: TwoStepFrames)`, where `ChoiceServeLevel = { choiceCount; counts; distractor?; request?; support? }` is read from the level descriptor. The returned `RoundSpec` has `request`, `targets` (one plate, or two for a two-item request), `lineId`, `audioOnly` and `promptText`. `isCorrectChoice` also compares the variant colour; `isRequestedChoice(choice, targets)` checks against all targets. Without the `frames` argument a two-item level degrades to a plain round, and an item without variants does the same at L6/L8.
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
  - Create a `TrialTracker(itemId, language)` for the round (`src/games/restaurant/trialTracker.ts`, pure and unit-tested). `nextRoundLanguage` keeps the language for the round and re-picks early if the parent disabled it.
- `giveHint()`: calls `tracker.onHint()`, which marks the trial hinted until the trial is recorded (so also between the two plates of a two-item request). Replays (animal or bubble tap, and the automatic replay after the first plate) never call it. On a voice-only level the hint plays the spoken request only, without pulsing the answer plate.
- `choose()`: after the existing lock check, calls `tracker.onPlateTap(correct, remaining)`. A wrong tap returns the miss at once; a correct tap returns a clean result only when it completes the request (`remaining = 0`); a correct first plate of a two-item request returns `null` and the plate is served. The scene passes a non-null result to `session.record`, once per trial. The session persists. Wrong-tap feedback, hints, stars and leisure calls are unchanged.
- `startRound()` reads `session.familiarItemIds(lang)` before `selectNextItem` (selecting consumes the after-drop flag) and passes it to `buildRound` as `familiarIds`.
- Level 9 (`audio-only`): the scene clears the prompt bubble instead of setting it. `RoundInfo` exposes `visualCue` (false at L9, true at L8), `request` and `correctIndices` for tests.
- `cleanup()`: call `session.endVisit()` (round boundary plus persist).
- `RoundInfo` gains `level` and `skillKey`. These are additive; e2e reads only the fields it declares.

**Why the e2e tests in `tests/e2e/journey.spec.ts` stay green**
- Every test uses `profile-a` (age 2) in a fresh browser context, so storage is empty and the level is the age-2 start, L4: 3 plates and a quantity request (`computeRestaurantLayout(w, h, 3)`, the same layout as the game before the adaptive engine).
  - The first test now also asserts level 4, 3 plates, the `quantity` request and a visible cue. The "wrong choices never reduce the balance" test taps a plate that the exposed round info says is wrong, instead of a fixed coordinate that may now be the right plate.
  - `tries` semantics and the 400 ms double-tap lock are untouched, so `tries === 1` still holds.
  - The animal tap still leaves `tries === 0` and `correctCount === 0`.
  - Stars and leisure flow are unchanged.
- No test plays 3 rounds, and age 2 changes level only at round ends, so no test sees a level change. The `seedRestaurantLevel(level)` test hook (installed only with `?e2e=1`, like the other hooks) seeds the stored level before the scene starts. Two e2e cases use it: L7 (tap plate A, tap A again with no effect, tap plate B: one star and one recorded trial) and L9 (negation request, no visual cue, no prompt bubble; tapping the animal leaves `tries` at 0). Levels 5, 6 and 8 are covered by unit tests only.
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
- `skillSession.test.ts`: record persists after each trial; `endVisit` closes the round; `initialSkill` uses the track start (age2 → L4, age5 → L5, 9 levels, min 1); age2 max equals the level count.
- `restaurantRequests.test.ts`: the 9-level table, round building and answer checking for L6 (both colours on the table), L7 (two targets, any order), L8 (one answer, excluded colour is wrong), L9 (negation, one answer, same round as L8 but with the `audioOnly` flag and no bubble; L8 keeps its cues), `TrialTracker` with a two-item request, schema validation of the new levers, and the device-TTS fallback for lines with no static clip.
- `adaptiveLeisureIsolation.test.ts`: the three checks in §6.
- Updates to existing tests:
  - `choiceServe.test.ts`: level-based `buildRound`, `targetId` honoured, `far`/`near` distractors, count variant only at quantity levels.
  - `contentSchema.test.ts`: the `adaptive` block validates; bad track bounds and a missing `choiceCount` are rejected; the age-2 start level (L4) has 3 plates and quantities, the age-5 start (L5) has 4 plates.
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

**Curve shift (9 levels) also changes:** `src/games/restaurant/{trialTracker,voiceRules,restaurantArt}.ts`, `tests/e2e/journey.spec.ts` (assertions on the new start level; a wrong plate chosen from the round info) and the new `tests/unit/restaurantRequests.test.ts`.

**Also changed by the review fixes:** `src/game/createGame.ts` (the e2e-only `seedRestaurantLevel` hook) and `src/core/adaptive/skillSession.ts` (`familiarItemIds`).

**Unchanged:** everything in `src/core/leisure`, `main.ts`, root prototype files, `package.json`, the vite/tsconfig/vitest/playwright configs and CI. No new dependencies.

**Owner decisions (Maor, 2026-11-11, final):**
1. Age 5 starts at L4 (today's behaviour). **Superseded on 2026-11-12 (owner's playtesting follow-up in issue #16):** the restaurant curve now has 9 levels; age 2 starts at L4 (today's game) and age 5 at L5 (§7). The level order and the start levels are the owner's explicit decision.
2. Age 2 has no level ceiling (`max = levels.length`, now 9); she can climb through all levels.
3. Down rule: 2 misses in the last 3 trials (`downMisses: 2`, `downWindow: 3`).
4. The language stays fixed per round of 3 animals.
5. Tapping to replay the request is not a hint.

## 10. Open questions for the owner

**Resolved: L9 was weak and a drop from 9 landed on a harder level.** L9 was a voice-only quantity request, which removed little for pre-readers (the bubble is text only), and a drop from L9 landed on L8 (negation), which was harder. The owner approved a fix: L9 is now negation + voice-only (same request and rule as L8, with every visual cue hidden), so L9 is strictly harder than L8 and a drop from 9 to 8 is a real easement. The level order and start levels are unchanged. No open question remains for the restaurant curve.

Still true on this level: the negation lines are spoken by the device TTS voice (no pre-generated audio yet), and an item with variants is the only possible target at L8 and L9, so those four foods repeat more often.

# picnic-train — Picnic Train

Status: **draft — pending owner approval**
Pass in progress: **1**

**Open decision for the owner:** this spec was written and built under continuous-development mode (the owner approved building without waiting for spec approval, 2026-11-13). Nothing here is approved until Maor approves it; every default below is reversible. See `docs/PENDING-DECISIONS.md`.

## Summary

In Picnic Train (`רכבת הפיקניק`), a little train waits at the station in the Number Garden with animal passengers in its carriages and an empty picnic basket in front of the girl. She gives the passengers picnic items: one item for each friend (age 2, one-to-one matching), or loads exactly N items that are asked for and spoken (age 5), or works out how many items are still missing and hands them out. When every friend has what they need the train is ready, the animals cheer, and the train sets off. She learns one-to-one correspondence, counting aloud, small quantities up to 10, and "how many are missing". The game sits in the Number Garden next to Sorting Beds.

## Learning goals

- **Age 2:** One item for each friend with 2–3 passengers (one-to-one matching), ghost-item outlines then a tally of dots as support, tap-to-give. Wrong taps never fail: a gentle hint, never a penalty. The number of each item given is counted aloud.
- **Age 5:** Count and load exactly N items (N spoken, 4–6), with no visual scaffold and the passengers scattered among empty seats; then "how many are missing" with 8–10 passengers where some already hold an item (answer with a number card, then hand out the missing items). Numbers are heard in Hebrew (the instruction) and in English or French (the counting), like the other Number Garden vocabulary.

## World and why

- **World** (Language House, Number Garden, Nature Lab, Art Studio, or Leisure Corner): Number Garden (`number-garden`, `גן המספרים`).
- **Why this game belongs there:** `docs/WORLDS.md` § "Number Garden → 1. Picnic Train": one-to-one matching, "how many are missing", small quantities. It is the first proposed quantity game (P2).

## Mechanic

A **train** is one adaptive trial and one round (see Difficulty curve). A train has `n` passengers (animals) seated in a row of carriages behind an engine, and a picnic basket at the bottom of the screen that always offers the next picnic item (apple, banana, cookie, and so on). The Hebrew instruction is spoken and shown in the prompt bubble; tapping the bubble repeats it.

There are three **tasks**, chosen by the level (`extra.task`):

1. **`one-each`** (L1–L3, "match"). Every passenger needs exactly one item.
   - **Child's action:** tap a passenger who has no item yet. The item in the basket flies to that passenger (`handOutItem`), the passenger cheers, the count is spoken aloud (`picnic.number.<k>`), and the next item pops into the basket. There is no select step.
   - **Wrong tap:** tapping a passenger who already has an item. The free passengers' ghost items pulse, `picnic.wrong.given.he` is spoken, nothing is removed and nothing is lost. The first wrong tap of the train records the trial's `miss`; later ones record nothing. After a wrong tap, passenger taps are ignored for 400 ms (`WRONG_TAP_LOCK_MS`), so a double tap is one try.
   - **Ready:** when every passenger has an item the train is ready (see below).
2. **`load`** (L4–L6, "load N items", `request: 'quantity'`). The instruction names a number N (equal to the number of passengers, which the child can count).
   - **Child's action:** tap the basket to load one item onto the cargo shelf above the train; the running count is spoken aloud (`picnic.number.<k>` in the round language). Tapping a loaded item takes it back (no penalty). When she thinks she has N she taps the green **go flag** (`picnic-go`).
   - **Wrong go:** tapping go with a count other than N. The cargo is counted again slowly and returned to the basket, `picnic.wrong.count.he` is spoken, and she can try again. The first wrong go records the `miss`. The shelf holds at most 10 items; tapping the basket when it is full only bounces the basket (no miss).
   - **Ready:** go with exactly N loaded items.
3. **`missing`** (L7–L8, "how many are missing", `request: 'two-step'`). `k` of the `n` passengers already hold an item (`1 ≤ k < n`).
   - **Step 1 (answer):** the instruction asks how many items are missing. Number cards `1 … n−1` are shown; she taps one. The right answer is `m = n − k`.
   - **Wrong card:** the free passengers' ghost items pulse, `picnic.wrong.count.he` is spoken, the first wrong card records the `miss`. Cards are ignored for 400 ms after a wrong card.
   - **Step 2 (hand out):** after the right card the number `m` is spoken, then she gives one item to each of the `m` free passengers, as in `one-each` (and the same wrong-tap rule).
   - **Ready:** when all passengers have an item.

**Train ready.** The passengers cheer together, `picnic.ready.he` is spoken, the whistle sound plays, the star count rises by 1, `LearningSession.complete()` marks the celebration, and the train slides off the screen (`arriveTrain` to an off-screen x; the chug and steam are Pass 2). A new train arrives after a short pause, with a new round language and level (a pending between-rounds level change is applied at the round end).

- **How she leaves the game:** the HUD back button (`hud-back`), as in every learning game: stop audio, persist state, `SkillSession.endVisit()`, `LearningSession.exit()`, back to the map.
- **Input mode per age:** tap only on both age tracks in Pass 1 (a tap is the only action; there is no drag).
- **Age-2 idle hint:** `ageTracks.age2 = { hintMode: 'demonstrate', hintDelayMs: 6000 }`. With no tap for `hintDelayMs`, the next free passenger pulses and the basket item hops toward them (`one-each`, `missing` step 2), the basket pulses (`load`, count below N) or the go flag pulses (`load`, count equal to N), the correct number card pulses (`missing` step 1), and the instruction is spoken again. One idle hint per train. While a line plays or the help card is open the hint waits another `hintDelayMs`. An idle hint before the trial is recorded marks it hinted, so a clean finish records `assisted`. The voluntary replay (tap on the prompt bubble) is never a hint.
- **Age-5 hint:** `ageTracks.age5 = { hintMode: 'repeat-then-demonstrate', hintDelayMs: 8000 }` as in Sorting Beds: no idle hint; the wrong-tap feedback is her only hint.
- **Never a penalty:** no wrong tap removes anything, ends the train, costs time, or reduces stars or the leisure balance.

**Open decision for the owner:** Pass 1 uses one train = one trial = one round (`rules.trialsPerRound: 1`), so a level change is decided after every train. The engine default is 3 trials per round; a train takes many taps, so 3 trains per round would make level changes very slow. Reversible: change `trialsPerRound` in `src/content/games/picnic-train.json`.

**Open decision for the owner:** the engine table for Picnic Train in `docs/adaptive-engine.md` §2.2 stops at 6 passengers; the task brief asks for up to 10 for age 5, so the level table below reaches 10 at L8 and adds the `load` task. Reversible: edit the levels in `src/content/games/picnic-train.json`.

**Open decision for the owner:** "compare two carriages" and "distribute in several ways" (`docs/WORLDS.md`, age 5) are not in Pass 1; they are listed under Out of scope.

## Difficulty curve

Follows `docs/adaptive-engine.md` §2.2 (Picnic Train), with the refinements marked above. Levers: `setSize` (the most passengers in a train), `scaffold`, `request`, and `extra.task` / `extra.layout`.

| L | `setSize` (train size) | `extra.task` | `request` | `scaffold` | `extra.layout` | What changes |
|---|---|---|---|---|---|---|
| 1 | 2 | `one-each` | — | `outline` | `rows` | Drop floor: 2 friends, ghost item above each |
| 2 | 3 | `one-each` | — | `outline` | `rows` | **Age-2 start:** 3 friends, ghost items |
| 3 | 3 | `one-each` | — | `symbol` | `rows` | No ghost items; a row of tally dots under the train fills as items are given |
| 4 | 4 | `load` | `quantity` | `symbol` | `rows` | "Load N": a row of N tally dots shows the target |
| 5 | 5 | `load` | `quantity` | `none` | `scattered` | **Age-5 start:** load 5, no scaffold, passengers among empty seats |
| 6 | 6 | `load` | `quantity` | `none` | `scattered` | Load 6 |
| 7 | 8 | `missing` | `two-step` | `none` | `scattered` | 8 friends, some already served: how many are missing? |
| 8 | 10 | `missing` | `two-step` | `none` | `scattered` | 10 friends |

- **Train size within a level.** `setSize` is the largest train of the level. The engine picks the round's train size from `{setSize − 1, setSize}` (never below 2) with `selectNextItem` over the ids `n<size>`, so a known size is served right after a level drop. `load` and `missing` use this size as N.
- **`scattered`:** the train has `min(10, size + 2)` seats and the passengers fill a random subset, so counting needs attention; empty seats show the seat outline. `rows`: exactly `size` seats, all occupied.
- **Age-2 start level:** L2. **Age-5 start level:** L5 (3 steps above; a new task, no scaffold, more passengers).
- **Min / max:** `min: 1`, `max: 8` on both tracks; age 2 has no ceiling.
- **Adaptive rules:** the engine defaults (`upCleanStreak: 3`, `downMisses: 2` in `downWindow: 3`, `maxChangesPerRound: 1`, `retryAfterTrials: 2`, `masteredBox: 3`) except `trialsPerRound: 1` (see the open decision). Level change timing: `between-rounds` on age 2, `after-trial` on age 5 (`trackPolicy`). No response-time scoring. One train records exactly one trial: `miss` at the first wrong tap, otherwise `clean` (or `assisted` after an idle hint).
- **Languages:** `languages: ['en', 'fr']`. The counting-token language is picked per round with `nextRoundLanguage` from the parent's `settings.languages`, and each round feeds that language's skill `number-garden.picnic-train.<lang>`.

## Leisure

The same as Sorting Beds, through the shared `LearningSession` and `earnParticipation` engine: `number-garden` has `earnsLeisure: true`; every tap calls `reportInteraction()`; voice lines call `reportListening(true/false)`; the ready celebration calls `reportCelebrating(true/false)` and `complete()`; leaving calls `exit()`. Active participation ticks once a second under the default settings (`DEFAULT_SETTINGS`). Mistakes never reduce `balanceSec`, `earnedTodaySec`, `activeSec` or `stars`. Balances and adaptive state are per profile and never mix. While `settings.timeEarning.enabled` is off (the default) leisure games are open with no timer.

## Player journey from the map

Profile → tap the Number Garden building on the map → the station trail picker opens with three cards (Sorting Beds, Balloon Pop, Picnic Train) → tap the Picnic Train card → play a train → `hud-back` to the map.

**Open decision for the owner:** how the Number Garden chooses between its games. Default: the station trail of `docs/specs/station-trail.md`, built from the `WORLD_GAMES` registry. Number Garden is a 3-station trail (Sorting Beds, Balloon Pop, Picnic Train, in registry order) with big picture cards plus a close button, so a child who cannot read taps a picture. Picnic Train is one `WORLD_GAMES` entry in `src/ui/picker/pickerModel.ts`; its content JSON carries `"world": "number-garden"`. `number-garden.entryGameId` stays `sorting-beds` in `worlds.json` as a fallback hint (existing tests still read it), but the registry-driven entry rule takes precedence on the map. Reversible: remove the `picnic-train` entry from `WORLD_GAMES` (there is no `MapScene` branch).

Frozen test handles:

- Map building hit target: `getBuildingHit('number-garden')`.
- Picker `data-testid`s: `game-picker-sorting-beds`, `game-picker-picnic-train`, `game-picker-close` (existing). Helper: `enterWorldByTap(page, profile, 'number-garden', 'picnic-train')`; `enterWorldByTap(page, profile, 'number-garden')` still opens Sorting Beds (default card).
- Shared chrome `data-testid`s: `hud-back`, `hud-help`, `prompt-bubble`, `help-card`, `help-card-close`, `star-count`, `leisure-balance`.
- Scene key `PicnicScene`; `AppScreen` `'picnic'`.
- Seed and read hooks under `?e2e=1` (seed or read only; no game actions, no navigation): existing `seedBalanceSec`, `seedLanguageSetting`, `getSpokenLines`, `getSpokenLineCount`, `getBuildingHit`, `getActiveScenes`; new `seedPicnicLevel(level)` (writes `level`, `cleanStreak: 0`, `recent: []` to the active profile's `picnic-train` skill for every content language) and `getPicnicInfo(): PicnicInfo | null`:

```ts
type PicnicTask = 'one-each' | 'load' | 'missing';
interface PageRect { x: number; y: number; width: number; height: number } // page CSS px, top-left
interface PicnicInfo {
  level: number;                       // 1..8, the level of the active train
  task: PicnicTask;
  lang: 'en' | 'fr';                   // counting-token language of this train
  size: number;                        // passengers in the train (n)
  target: number;                      // one-each: n; load: N to load; missing: the missing count m
  phase: 'give' | 'load' | 'answer' | 'depart';   // what input is expected now
  scaffold: 'outline' | 'symbol' | 'none';
  ghostItems: boolean;                 // scaffold 'outline': a ghost item above every free passenger
  tally: number | null;                // scaffold 'symbol': number of tally dots shown, else null
  passengers: Array<{
    id: string;                        // 'p-0' … left to right
    seat: number;
    kind: string;                      // animal kind
    hasItem: boolean;
    visible: boolean;                  // inside the screen after the camera pan
    hit: PageRect;
  }>;
  nextFreeId: string | null;           // first passenger without an item (a correct tap in `give`)
  basket: { hit: PageRect };           // `load`: loads one item; `give` and `answer`: repeats the instruction (a replay, never a hint)
  loaded: number;                      // load: items on the cargo shelf
  cargoHits: PageRect[];               // load: one tappable rect per loaded item
  go: { hit: PageRect } | null;        // load: the go flag
  cards: Array<{ value: number; hit: PageRect }> | null;   // missing step 1
  tries: number;                       // wrong taps on this train that were not swallowed by the lock
  hinted: boolean;                     // an idle hint fired before the trial was recorded
  ready: boolean;                      // input is accepted now
}
```

## Acceptance criteria

Test titles start with the id, in `tests/**/picnic-train*` files.

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey via `enterWorldByTap(page, profile, 'number-garden', 'picnic-train')`: profile → Number Garden building → picker card → Picnic Train → one train → exit via `hud-back` to the map; the game opens only from this world's building | 1 | e2e | both | `getBuildingHit`, `getPicnicInfo` |
| AC-02 | A correct give (one-each) flies the item to the passenger, marks `hasItem`, speaks the running count, and offers the next free passenger | 1 | e2e | @single-orientation | `getBuildingHit`, `getPicnicInfo` |
| AC-03 | A wrong tap (a passenger who already has an item) gives the specified hint, removes nothing, never reduces the leisure balance, and age 2 can always finish the train | 1 | e2e | @single-orientation | `getBuildingHit`, `seedBalanceSec`, `getPicnicInfo` |
| AC-04 | Difficulty rises after 3 clean trains and drops after 2 misses in the last 3 trains, with one train per round (`trialsPerRound: 1`) | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level: from a seeded L1, three clean trains by real taps raise the level to 2 | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedPicnicLevel`, `seedLanguageSetting`, `getPicnicInfo` |
| AC-06 | High levels play correctly: seeded L5 (load N, scattered) and seeded L8 (10 passengers, how many are missing) can be completed by real taps | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedPicnicLevel`, `getPicnicInfo` |
| AC-07 | A new age-2 profile starts at L2; a new age-5 profile at L5 | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues as specified, never drops on mistakes, never mixes across profiles | 1 | unit | @single-orientation | |
| AC-09 | Content and language are selected as specified: the level table, number words, the round language from `settings.languages`, the line ids for every task | 1 | unit | @single-orientation | |
| AC-10 | Each voice line requests the right line id and language, asserted via `getSpokenLines` (instruction, counting token, wrong hint, ready) | 1 | e2e | @single-orientation | `getBuildingHit`, `getPicnicInfo`, `getSpokenLines` |
| AC-11 | Smoke: playable at `1280x800` and `800x1280`, with every tap target at least 64 CSS px and inside the screen | 1 | e2e | both | `getBuildingHit`, `getPicnicInfo` |
| AC-12 | The game works offline | 1 | e2e | @single-orientation | `getBuildingHit`, `getPicnicInfo` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch, rotation mid-game, audible voice, visuals | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | The Number Garden building opens the three-station trail picker (Sorting Beds, Balloon Pop, Picnic Train, in registry order; all cards at least 64 CSS px, inside the screen, not overlapping, RTL); the Sorting Beds card opens Sorting Beds; the close button returns to the map | 1 | e2e | both | `getBuildingHit` |
| AC-17 | Train ready: after the last give the passengers cheer, `picnic.ready.he` is spoken, the star count rises by 1, and a new train arrives | 1 | e2e | @single-orientation | `getBuildingHit`, `getPicnicInfo`, `getSpokenLines` |
| AC-18 | Round plan: train size is within `{setSize − 1, setSize}`; passengers are distinct animals; `rows` has `size` seats, `scattered` has `min(10, size + 2)`; `missing` has `1 ≤ k < n` served and `m = n − k` | 1 | unit | @single-orientation | |
| AC-19 | Load task: a basket tap loads one item and speaks the count; a loaded-item tap takes it back; go with N items makes the train ready; go with another count records one miss, returns the cargo and speaks `picnic.wrong.count.he` | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedPicnicLevel`, `getPicnicInfo`, `getSpokenLines` |
| AC-20 | Missing task: a wrong number card gives the hint and records one miss; the right card speaks `m`, then the free passengers are served one by one and the train is ready | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedPicnicLevel`, `getPicnicInfo`, `getSpokenLines` |
| AC-21 | Train layout never shrinks a passenger below the minimum height; it pans to the focus seat; every passenger that must be tapped is inside the screen after the pan, in both orientations, for 2–10 seats | 1 | unit | @single-orientation | |
| AC-22 | Scaffolds per level: L1–L2 ghost items, L3–L4 tally dots, L5–L8 none; content validation rejects other `request`, `scaffold`, `extra.task`, `extra.layout`, or a `setSize` outside 2..10 | 1 | unit | @single-orientation | |
| AC-23 | Seeded levels show the specified scaffold: seeded L2 reports `ghostItems: true`, seeded L3 reports `tally` equal to the train size, seeded L5 reports `scaffold: 'none'` | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedPicnicLevel`, `getPicnicInfo` |
| AC-24 | One miss per train: the first wrong tap records the `miss`, later wrong taps and the finish record nothing; an idle hint before the result makes a clean finish `assisted`; a hint after a miss changes nothing; a replay is not a hint | 1 | unit | @single-orientation | |
| AC-25 | Age-2 idle hint: with no tap for 6 s the next free passenger is shown, `hinted` becomes true and the instruction is requested again; an age-5 profile gets no idle hint | 1 | e2e | @single-orientation | `getBuildingHit`, `getPicnicInfo`, `getSpokenLines` |
| AC-26 | 400 ms lock: after a wrong tap, taps are ignored for 400 ms (`tries` unchanged) | 1 | unit | @single-orientation | |
| AC-27 | Wiring: `AppScreen` includes `'picnic'` and it is unsafe for mid-game updates; the `WORLD_GAMES` registry holds one Picnic Train entry and, with content, gives the Number Garden trail Sorting Beds, Balloon Pop, Picnic Train; `worlds.json` keeps `number-garden` open with `earnsLeisure: true` | 1 | unit | @single-orientation | |

By default Pass-1 criteria do not require polished animation or new recorded clips (`docs/PROCESS.md` §3).

## Art, animation, and audio

### Pass 1 — working game

Existing approved art only; no new SVG and no new recording.

- **Asset keys (all already in `src/assets/art/manifest.ts`):** `train-engine`, `train-car`, `train-car-single`, `train-seat-outline`, `train-item-outline` (`art/train/`), `picnic-train-bg-landscape`, `picnic-train-bg-portrait` (`art/scenes/picnic-train/`), `picnic-basket` (`art/props/`), foods through `foodArtKey` (`art/foods/`: apple, banana, cookie, pear, orange, strawberry, grapes, cheese, carrot, egg), animals through `Character` (`bear`, `rabbit`, `cat`, `dog`, `panda`, `lion`, `bird`, `frog`, `owl`, `bee` rigs).
- **Placeholders used in Pass 1** (procedural or reused art, listed so Pass 2 can replace them): (1) the go flag, (2) the number cards, (3) the cargo shelf, (4) the tally dots, (5) the Number Garden picker card art, which reuses `art/scenes/number-garden/bg-landscape.svg` (Sorting Beds) and `art/scenes/picnic-train/bg-landscape.svg` (Picnic Train) through the picker placeholder block, with no new manifest keys. Each procedural piece follows the repo pattern of a code-drawn fallback (`src/games/sorting/sortingFallbackArt.ts` style).
- **Layout:** landscape and portrait via `src/anim/trainLayout.ts` (`planTrainView`): passengers keep at least 112 px display height, the camera pans to the focus seat instead of shrinking the train. Tap targets are at least 64 CSS px; if items do not fit, pan or show fewer, never shrink.
- **RTL:** Hebrew chrome is RTL; the HUD, prompt bubble and help card are reused (`setRestaurantChrome`, `setPromptBubble`, `showHelp`). Number digits and EN/FR tokens stay LTR.
- **Animation:** existing helpers only: `handOutItem`, `arriveTrain` (`src/anim/homesTrainMotion.ts`), `popIn`, `popOut`, `bounce`, `hintPulse`, `Character.happy()` and `Character.hmm()`, `Juice`. `ANIM_PROFILE.train` is reused; no new knob. While nothing on the train is tapped (load, answer) the whole train is shown scaled to fit the screen so the child can count the passengers; while it is tapped it is full size and panned to the next free passenger.
- **Voice table** (device TTS through `AudioManager.play({ lineId, lang, text })`; text in `src/games/picnic/picnicVoice.ts`). `<n>` is 2..10 for `ask.load`, 1..10 for `number`:

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `picnic.ask.one-each.he` | he | בואי נאכיל את החברים ברכבת! תני לכל חבר פריט אחד לפיקניק. | Train start, `one-each`; replay |
| `picnic.ask.load.<n>.he` | he | ארזי `<מספר במילים>` פריטים לפיקניק, ואז לחצי על הדגל! | Train start, `load`; replay |
| `picnic.ask.missing.he` | he | לחלק מהחברים כבר יש פריט. כמה פריטים עוד חסרים? | Train start, `missing`; replay |
| `picnic.missing.give.he` | he | נכון! עכשיו תני פריט לכל חבר שחסר לו. | After the right number card |
| `picnic.wrong.given.he` | he | לחבר הזה כבר יש פריט. נסי חבר שעוד אין לו! | Wrong passenger tap |
| `picnic.wrong.count.he` | he | בואי נספור שוב ביחד. | Wrong go or wrong number card |
| `picnic.ready.he` | he | הרכבת מוכנה לדרך! צ'ו צ'ו! | Train ready |
| `picnic.help.he` | he | תני לכל חבר ברכבת את מה שחסר לו, וסופרים ביחד. | Help button |
| `picnic.number.<n>.en` | en | one … ten | Counting aloud (a give, a load, the right answer m), round language `en` |
| `picnic.number.<n>.fr` | fr | un … dix | Same, round language `fr` |

The Hebrew number words are masculine (`שניים, שלושה, ארבעה, חמישה, שישה, שבעה, שמונה, תשעה, עשרה`) because the noun is `פריטים`. **Open decision for the owner:** EN/FR number voicing. The repo already speaks EN/FR learning tokens in Number Garden (Sorting Beds colour and size words, per-language skills, the parent's `settings.languages`), so Pass 1 counts aloud in the round language and keeps all instructions in Hebrew. If Maor prefers Hebrew-only numbers, set `languages` to `['he']` content-side and replace the number lines; reversible.

- **World and PWA wiring:** `number-garden` keeps `earnsLeisure: true`; new `AppScreen` `'picnic'` marked unsafe for mid-game updates in `src/pwa/updatePolicy.ts`; scene `PicnicScene` registered in `src/game/createGame.ts`; `main.ts` stops it when returning to the profile screen; `src/ui/picker/pickerModel.ts` gets one `WORLD_GAMES` entry after Balloon Pop (no per-world picker list).

### Pass 2 — polish

Only after Maor approves the finished Pass 1.

- Polished train animation (pulling in, steam, departure through the scenery), passenger reactions per item, a real go flag, number cards and cargo shelf art, and Picnic Train / Sorting Beds picker card art.
- Recorded Gemini TTS clips (voice Leda) for the voice table, rendered with `scripts/tts/generate_voice.py`; device TTS stays the fallback. No `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.

## Out of scope

- Pass 2 (see above).
- "Compare two carriages" and "distribute in several ways" (age 5, `docs/WORLDS.md`).
- Drag-and-drop for age 5 (tap only in Pass 1).
- Parent view or override of the level; response-time scoring.

## Open decisions for the owner

- **Open decision for the owner:** approve this spec (built under continuous-development mode before approval).
- **Open decision for the owner:** Number Garden picker versus another way to choose between its games (see the player journey).
- **Open decision for the owner:** EN/FR number voicing (see the voice table).
- **Open decision for the owner:** placeholder art (go flag, number cards, cargo shelf, tally dots, picker card art), to be replaced in Pass 2.
- **Open decision for the owner:** one train per round (`trialsPerRound: 1`) and the extended level table up to 10 passengers.

## Changelog

- `2026-11-13` — created — substantive

# sorting-beds — Sorting Beds

Status: **draft — pending owner approval**
Pass in progress: **none**

## Summary

In Sorting Beds (`ערוגות המיון`), composited garden flowers have tumbled onto the garden path in the Number Garden. The child sorts them back into 2–4 garden beds by colour (`red`, `yellow`, `blue`), shape (`tulip`, `daisy`, `round`), or size (`small`, `large`), and each bed blooms when it is full. She learns to classify objects by one attribute, then by two attributes, and practices cognitive flexibility when the sorting rule switches mid-round at the top level.

## Learning goals

- **Age 2:** Sort flowers into 2–3 garden beds by one obvious visual attribute (colour, shape, or size) with picture labels and ghost-slot outline scaffolding, using tap-to-place interaction and Montessori control-of-error feedback (a wrong bed shakes and indicates the matching bed).
- **Age 5:** Sort flowers across 3–4 garden beds with reduced visual scaffolding (`symbol` then `none`), classify by two attributes (`extra.attributes: 2`), and adapt flexibly when the sorting rule changes mid-round (`request: 'rule-switch'` at Level 8), with English and French colour and size vocabulary in Pass 1 (`red` / `rouge`, `yellow` / `jaune`, `blue` / `bleu`, `big` / `grand`, `small` / `petit`).

## World and why

- **World** (Language House, Number Garden, Nature Lab, Art Studio, or Leisure Corner): Number Garden (`number-garden`, `גן המספרים`).
- **Why this game belongs there:** `docs/WORLDS.md` (§ "Number Garden → 2. Sorting Beds") places Sorting Beds in the Number Garden because classifying objects by shared attributes (colour, shape, size), comparing groups, and switching classification rules are core early-mathematics foundations alongside quantity and one-to-one matching. Per `docs/WORLDS.md`, instruction in the Number Garden starts in Hebrew unless English or French vocabulary is deliberately included as a separate skill.

## Mechanic

At the start of a round, 2–4 garden beds (`choiceCount` from the current level descriptor) appear in the garden with wooden rule signs (`rule-sign-post` + `rule-sign-plaque` + the level's rule icon or scaffold), and a set of tumbled flowers (each composited from a `flower-stem-{small,large}` stem and a `flower-bloom-{tulip,daisy,round}-{red,yellow,blue}` bloom) sits on the path. A spoken Hebrew prompt announces the active sorting rule.

- **Child's action:** The child places a flower from the path into one of the garden beds.
  - **Gap for the team lead:** Confirm the exact tap-to-place interaction flow for a single placement (whether one highlighted "current" flower on the path flies into the tapped bed with a single tap on the bed, or whether the child taps a flower on the path to select it and then taps a target bed) and confirm how many flower placements constitute one adaptive trial vs. one full bed/round (`trialsPerRound: 3`).
- **Feedback on a correct answer:** The flower arcs from the path into the chosen bed (`dropIntoBed` using `ANIM_PROFILE.sorting.drop`) and settles into the soil between `garden-bed-back` and `garden-bed-front` with a squash-and-stretch bounce (`settleScale` using `ANIM_PROFILE.sorting.settle`). A positive voice line plays, and the colour or size token is spoken in English or French (Pass 1, decided 2026-11-12). A first-try correct placement records a `clean` outcome. Decided (2026-11-12): age 5 has no automatic idle hint; a hint is given only after a mistake (the wrong-bed shake, highlight, and hint line). **Gap for the team lead:** whether age 2 should get a demonstrate hint after idle (and at what delay, and whether that records `assisted`), as Animal Restaurant and Kitchen Orchestra do on the age-2 track.
- **Feedback on a wrong answer (hint or retry):** Tapping or dropping onto a bed whose rule does not match the flower triggers Montessori control-of-error feedback: the wrong bed "shakes its head" horizontally, the matching target bed is highlighted/indicated, and a gentle hint voice line plays. The flower remains on the path so the child can place it into the right bed. A wrong first attempt on a trial is recorded as a single `miss`; the child can then place the flower in the right bed without recording additional misses for that item. **Gap for the team lead:** confirm this one-miss-per-item rule, and that a rapid double tap is treated as one try. Mistakes never reduce the leisure balance or star count.
- **Mid-round rule switch (Level 8):** At Level 8 (`request: 'rule-switch'`), halfway through the round's flowers, the rule signs animate (`switchRule` using `ANIM_PROFILE.sorting.ruleSwitch`) and a voice prompt announces that the sorting attribute has changed (for example, from colour to size or shape) for the remaining flowers.
- **How a round ends:** When the beds reach capacity / all trials in the round (`trialsPerRound: 3`) are completed, each full bed plays a bloom celebration, `state.stars` increments by 1, `LearningSession.complete()` marks the celebration, and `endRound` runs (applying any pending between-rounds level change on the age-2 track) before the next round starts.
- **How she leaves the game:** Tapping the HUD back button (`[data-testid="hud-back"]`) at any time ends the visit the same way other learning games do: stop audio, persist store and adaptive state (`SkillSession.endVisit()`), call `LearningSession.exit()`, and return to the world map.
- **Input mode per age:**
  - **Age 2:** Tap-to-place (`tap`). Required by `docs/WORLDS.md` and enforced by `trackPolicy('age2').interaction === 'tap'`.
  - **Age 5:** Decided (2026-11-12): tap-to-place in Pass 1; drag-and-drop in Pass 2. Do not assume Pass 1 must drag solely because `trackPolicy('age5').interaction` returns `'drag'`.

## Difficulty curve

- **Levels:** Decided (2026-11-12): the 8-level curve from `docs/adaptive-engine.md` §2.2, with age 2 starting at L2 and age 5 starting at L5, `min: 1`, `max: 8`, and no age-2 ceiling:

| L | `choiceCount` (beds) | `extra.attributes` | `request` | `scaffold` / bed labels | What changes |
|---|---|---|---|---|---|
| 1 | 2 | 1 | — | picture labels on the beds | Drop floor: 2 beds, 1 obvious attribute (e.g., red vs. yellow), picture labels |
| 2 | 2 | 1 | — | `outline` (picture labels + ghost slots) | **Age-2 start:** 2 beds, 1 attribute, picture labels and ghost-slot outlines |
| 3 | 3 | 1 | — | `outline` (picture labels + ghost slots) | 3 beds, 1 attribute (red / yellow / blue or tulip / daisy / round), picture labels and ghost slots |
| 4 | 3 | 1 | — | `symbol` | 3 beds, 1 attribute, symbol scaffold on the rule signs (`rule-icon-*`) |
| 5 | 3 | 2 | — | `symbol` | **Age-5 start:** 3 beds, 2 attributes (colour, then size, one rule per round), symbol scaffold |
| 6 | 4 | 2 | — | `symbol` | 4 beds, 2 attributes, symbol scaffold |
| 7 | 4 | 2 | — | `none` | 4 beds, 2 attributes, no visual scaffold on the beds (spoken rule only) |
| 8 | 4 | 2 | `rule-switch` | `none` | 4 beds, the sorting rule switches mid-round, no visual scaffold |

  - **Gap for the team lead:** Resolve the operational definition of `extra.attributes: 2` at L5–L7 and how `choiceCount: 4` (4 beds at L6–L8) maps to the available art attributes (`color` has 3 values: `red`, `yellow`, `blue`; `shape` has 3 values: `tulip`, `daisy`, `round`; `size` has 2 values: `small`, `large`). Specifically, `docs/adaptive-engine.md` §2.2 describes L5 as `extra.attributes 2 (colour, then size, one rule per round)`, whereas the research doc (`games-per-world.md` §4.2) describes two-attribute sorting as conjunctions such as `"small red"`. A 4-bed layout at L6–L8 requires either two-attribute conjunction beds (e.g., `small red`, `large red`, `small yellow`, `large yellow`) or a mix of attributes so all 4 beds have distinct valid rules.
  - **Gap for the team lead:** Specify how L1 ("picture labels on the beds") vs. L2–L3 (`scaffold: 'outline'`, picture labels + ghost slots) vs. L4–L6 (`scaffold: 'symbol'`) are encoded in `LevelDescriptorSchema` (`scaffold: z.enum(['outline', 'symbol', 'none']).optional()` plus `extra` flags if needed) and rendered using the frozen `rule-icon-*` and flower SVGs.
- **Age-2 start level:** Level 2 (`choiceCount: 2`, `extra.attributes: 1`, picture labels + `scaffold: 'outline'`). Level 1 is the drop floor.
- **Age-5 start level:** Level 5 (`choiceCount: 3`, `extra.attributes: 2`, `scaffold: 'symbol'`), which is 3 steps above the age-2 start and introduces a harder demand (3 beds instead of 2, two attributes instead of one, and symbol scaffolding without ghost-slot outlines).
- **Min / max:** `min: 1`, `max: 8` on both `age2` and `age5`. Age 2 has no level ceiling (`max = levels.length = 8`).
- **Adaptive rules:**
  - Uses `DEFAULT_RULES` from `src/core/adaptive/rules.ts` and `trackPolicy` from `src/core/adaptive/policy.ts`:
    - `upCleanStreak: 3` (3 consecutive `clean` trials raise the level by 1).
    - `downMisses: 2`, `downWindow: 3` (2 `miss` outcomes within the last 3 trials in `recent` lower the level by 1, clear `recent`, and set `afterDrop = true` so a known item is served next).
    - `trialsPerRound: 3`, `maxChangesPerRound: 1`, `retryAfterTrials: 2`, `masteredBox: 3`.
    - When the level may change: `between-rounds` on `age2` (decisions are evaluated after every trial across round boundaries and applied at `endRound`); `after-trial` on `age5` (applied immediately after the trial, capped at `maxChangesPerRound: 1`, with any cap-blocked drop carried in `pendingChange` to `endRound`).
    - Speed scoring: `useResponseTime: false` on both `age2` (hard-coded engine policy) and `age5` (`false` in v1).
  - This remains an open decision (see Open decisions below): whether to keep the adaptive-engine v1 defaults (`upCleanStreak: 3`, `downMisses: 2` in `downWindow: 3`, drop by 1 level, `useResponseTime: false`) or override them with the `games-per-world.md` §4.2 research sketch values (`upCleanStreak: 4`, strict consecutive `downMisses: 2` / `downWindow: 2`, dropping straight back to a 1-attribute level, or an age-5 `< 3.5 s` per-item response-time rule in a future engine pass). This spec drafts the engine v1 defaults and does not enable response-time scoring.

## Leisure

Sorting Beds uses the shared `LearningSession` (`src/core/leisure/learningSession.ts`) and `earnParticipation` engine (`src/core/leisure/engine.ts`), with strict isolation from `src/core/adaptive`:

- `number-garden` in `src/content/worlds.json` has `"earnsLeisure": true`.
- Every flower tap or placement — both correct placements and wrong-bed attempts — calls `learningSession.reportInteraction()`.
- Voice instructions, rule announcements, and hints call `learningSession.reportListening(true)` while playing and `reportListening(false)` when finished.
- Bed-full bloom animations and round completion call `learningSession.reportCelebrating(true)` / `learningSession.complete()`, and leaving the scene calls `learningSession.exit()`.
- Active participation ticks once per second (`learningSession.tick(1)`) under `DEFAULT_SETTINGS` (`src/core/storage/schema.ts`): `learnMinutes: 10`, `leisureMinutes: 5` (2:1 learn-to-leisure ratio), `dailyEarnCapMinutes: 30`, `idleSeconds: 20`. A hidden tab (`document.visibilitychange`) or ≥ 20 s of inactivity without active listening or celebrating pauses earning.
- Mistakes never reduce `balanceSec`, `earnedTodaySec`, `activeSec`, or `stars`.
- Leisure balances (`kids-app-state-v2`, keyed by `profileId` in `state.data[profileId]`) and adaptive skill states (`kids-app-adaptive:<profileId>`) are stored per profile on the device and never mix across profiles.

## Player journey from the map

Select profile (`profile-a` or `profile-b`) → real-tap the Number Garden building with `enterWorldByTap(page, profile, 'number-garden')` (from [PR #37](https://github.com/tzoomy/kids-app/pull/37), pending merge; uses `getBuildingHit('number-garden')`) → Sorting Beds opens → play a round of sorting flowers into beds → exit to the map via `hud-back`.

Frozen test handles (shared names from [PR #37](https://github.com/tzoomy/kids-app/pull/37), pending merge — game scenes use these same HUD/prompt/help ids, not game-specific names):

- **Playwright helper:** `enterWorldByTap(page, profile, worldId)` in `tests/e2e/helpers/journey.ts` — real-tap journey: profile → map → click the centre of the building hit rect → game. Use it in this game's journeys.
- **Map building hit target:** `getBuildingHit('number-garden')` under `?e2e=1`. Signature (PR #37): `getBuildingHit(worldId) -> { x, y, width, height } | null` in page CSS px, top-left, accounting for canvas scaling and letterbox; `null` if the map is inactive or the building is missing.
- **`data-testid`s (DOM / HUD), from PR #37 unless noted:**
  - Unchanged existing: `profile-a`, `profile-b`, `leisure-balance`, `star-count`, `parent-gate-btn`, `switch-profile-btn`, `parent-exit-btn`
  - Shared chrome (PR #37; game scenes put these on their DOM chrome): `hud-back` (back button), `hud-help` (help button), `prompt-bubble` (request bubble), `help-card` (help card), `help-card-close` (the whole help overlay; tapping anywhere closes it)
- **Seed and read hooks under `?e2e=1`** (seed persisted state or read state only; no game actions, no scene navigation; `goToScreen` is for screenshot scripts only and forbidden in journey/AC tests):
  - Shared spoken-line hooks from PR #37 (pending merge). Voice assertions use `getSpokenLines` `lineId`s: `getSpokenLines(sinceIndex?) -> [{ index, lineId, lang, source: 'clip' | 'tts', text?, at }]` (`source` is the provider *requested*, not whether it was heard); `getSpokenLineCount() -> number`.
  - Game-specific hooks to add: `seedSortingLevel(level: number)` — seeds the active profile's persisted adaptive level for `sorting-beds` before entering through `enterWorldByTap` / `getBuildingHit('number-garden')`. `seedBalanceSec(sec: number)` — seeds the active profile's leisure balance in seconds. `getSortingInfo(): SortingRoundInfo | null` — read-only snapshot of the active round:
    ```ts
    interface SortingRoundInfo {
      level: number;
      rule: 'color' | 'shape' | 'size';
      attributes: 1 | 2;
      ruleSwitched: boolean;
      language: 'he' | 'en' | 'fr';
      flowers: Array<{
        id: string;
        color: 'red' | 'yellow' | 'blue';
        shape: 'tulip' | 'daisy' | 'round';
        size: 'small' | 'large';
        x: number;
        y: number;
        width: number;
        height: number;
        targetBedIndex: number;
      }>;
      beds: Array<{
        index: number;
        accepted: {
          color?: 'red' | 'yellow' | 'blue';
          shape?: 'tulip' | 'daisy' | 'round';
          size?: 'small' | 'large';
        };
        count: number;
        capacity: number;
        bloomed: boolean;
        x: number;
        y: number;
        width: number;
        height: number;
      }>;
    }
    ```
  - **Gap for the team lead:** Confirm the exact fields of `getSortingInfo()` before implementation freezes the hook contract.

## Acceptance criteria

Ids are stable: never renumber or reuse them; strike through a removed one (`~~AC-07~~`). Test titles start with the id, e.g. `test('[AC-04] level rises after 3 clean answers', …)`, in `tests/**/sorting-beds*` files. Verified by: `unit`, `e2e`, `e2e+seed`, or `device` (device criteria are checked by Maor on the tablet and are exempt from the CI coverage check). Orientation: `both`, or `@single-orientation` if the criterion does not depend on it.

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey via `enterWorldByTap(page, profile, 'number-garden')`: profile → Number Garden building → Sorting Beds → one round → exit via `hud-back` to the map; the game opens only from this world's building | 1 | e2e | both | `getBuildingHit`, `getSortingInfo` |
| AC-02 | A correct answer gives the specified feedback and advances the game | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo` |
| AC-03 | A wrong answer gives the specified hint or retry and never reduces the leisure balance | 1 | e2e | @single-orientation | `getBuildingHit`, `seedBalanceSec`, `getSortingInfo` |
| AC-04 | Difficulty rises after successes and drops after misses, per this spec's rules | 1 | unit | @single-orientation | |
| AC-05 | One real-tap level change at a low level | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedSortingLevel`, `getSortingInfo` |
| AC-06 | High levels play correctly | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedSortingLevel`, `getSortingInfo` |
| AC-07 | A new age-2 profile starts at the age-2 start level; a new age-5 profile at the age-5 start level | 1 | unit | @single-orientation | |
| AC-08 | Leisure accrues as specified, never drops on mistakes, never mixes across profiles | 1 | unit | @single-orientation | |
| AC-09 | Content and language are selected as specified | 1 | unit | @single-orientation | |
| AC-10 | Each voice line requests the right line id and language, asserted via `getSpokenLines` | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo`, `getSpokenLines` |
| AC-11 | Smoke: the game is playable at `1280x800` and `800x1280` | 1 | e2e | both | `getBuildingHit`, `getSortingInfo` |
| AC-12 | The game works offline | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`) | 1 | e2e | @single-orientation | |
| AC-14 | Device check: touch, rotation mid-game, audible voice, visuals | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table, with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | Placing a flower on a wrong bed shakes the wrong bed, highlights the matching bed, keeps the flower available, and records at most one miss per trial | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo` |
| AC-17 | Filling a garden bed to capacity triggers the bed-full bloom celebration and completing the round awards a star | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo` |
| AC-18 | At Level 8 (`rule-switch`), the sorting rule changes mid-round with the rule-sign flip animation and updated bed targets | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedSortingLevel`, `getSortingInfo` |
| AC-19 | `ANIM_PROFILE.sorting` knobs (drop, settle, ruleSwitch) are covered by unit tests that import `src/anim/profiles.ts` only, never Phaser | 1 | unit | @single-orientation | |

## Art, animation, and audio

Paths, keys, rigs, and line ids below are frozen at approval so Gemini can start immediately (`docs/PROCESS.md` §2). Style and rig details: `docs/ANIMATION.md`.

### Pass 1 — working game

- **Asset paths and manifest keys:** Pass 1 reuses the SVG assets created on `feat/art-sorting-suitcase` (PR #20), keyed in `src/assets/art/manifest.ts`. Do not add leaves, vegetables, a mole character, or a new scene folder in Pass 1:

| Asset path | Manifest key | Role |
|---|---|---|
| `public/art/props/garden-bed-back.svg` | `garden-bed-back` | Back rim/soil layer of each garden bed (behind planted flowers) |
| `public/art/props/garden-bed-front.svg` | `garden-bed-front` | Front rim/soil layer of each garden bed (occludes lower stems) |
| `public/art/props/rule-sign-post.svg` | `rule-sign-post` | Wooden post for the bed's rule sign |
| `public/art/props/rule-sign-plaque.svg` | `rule-sign-plaque` | Wooden plaque backing the rule icon |
| `public/art/props/rule-icon-color-red.svg` | `rule-icon-color-red` | Rule sign icon: colour `red` |
| `public/art/props/rule-icon-color-yellow.svg` | `rule-icon-color-yellow` | Rule sign icon: colour `yellow` |
| `public/art/props/rule-icon-color-blue.svg` | `rule-icon-color-blue` | Rule sign icon: colour `blue` |
| `public/art/props/rule-icon-shape-tulip.svg` | `rule-icon-shape-tulip` | Rule sign icon: shape `tulip` |
| `public/art/props/rule-icon-shape-daisy.svg` | `rule-icon-shape-daisy` | Rule sign icon: shape `daisy` |
| `public/art/props/rule-icon-shape-round.svg` | `rule-icon-shape-round` | Rule sign icon: shape `round` |
| `public/art/props/rule-icon-size-small.svg` | `rule-icon-size-small` | Rule sign icon: size `small` |
| `public/art/props/rule-icon-size-large.svg` | `rule-icon-size-large` | Rule sign icon: size `large` |
| `public/art/flowers/stem-small.svg` | `flower-stem-small` | Composited flower stem for `size: 'small'` |
| `public/art/flowers/stem-large.svg` | `flower-stem-large` | Composited flower stem for `size: 'large'` |
| `public/art/flowers/bloom-tulip-red.svg` | `flower-bloom-tulip-red` | Composited bloom: `tulip`, `red` |
| `public/art/flowers/bloom-tulip-yellow.svg` | `flower-bloom-tulip-yellow` | Composited bloom: `tulip`, `yellow` |
| `public/art/flowers/bloom-tulip-blue.svg` | `flower-bloom-tulip-blue` | Composited bloom: `tulip`, `blue` |
| `public/art/flowers/bloom-daisy-red.svg` | `flower-bloom-daisy-red` | Composited bloom: `daisy`, `red` |
| `public/art/flowers/bloom-daisy-yellow.svg` | `flower-bloom-daisy-yellow` | Composited bloom: `daisy`, `yellow` |
| `public/art/flowers/bloom-daisy-blue.svg` | `flower-bloom-daisy-blue` | Composited bloom: `daisy`, `blue` |
| `public/art/flowers/bloom-round-red.svg` | `flower-bloom-round-red` | Composited bloom: `round`, `red` |
| `public/art/flowers/bloom-round-yellow.svg` | `flower-bloom-round-yellow` | Composited bloom: `round`, `yellow` |
| `public/art/flowers/bloom-round-blue.svg` | `flower-bloom-round-blue` | Composited bloom: `round`, `blue` |
| `public/art/scenes/number-garden/bg-landscape.svg` | `number-garden-bg-landscape` | Landscape background (`1280×800`) |
| `public/art/scenes/number-garden/bg-portrait.svg` | `number-garden-bg-portrait` | Portrait background (`800×1280`) |

  - **Scene-folder note:** Process v2 requires scene folders under `public/art/scenes/<scene-or-game-name>/` to be named per scene or game, never the world id. Because PR #20 already created `public/art/scenes/number-garden/bg-{landscape,portrait}.svg`, this spec freezes that existing path for Sorting Beds. **Gap for the team lead:** Picnic Train (and any other Number Garden game) will need its own per-game scene folder (`public/art/scenes/picnic-train/`) later so the two games do not collide.
- **SVG contract:** warm palette; dark-brown outline `#3B2A22` about 6 px; no heavy gradients or filters, no `<text>`, no external references, no rasters; each file under 15 KB (enforced by `tests/unit/artAssets.test.ts`); original assets only.
- **Rigs:** Pass 1 uses composited flower (`flower-stem-{small,large}` + `flower-bloom-{shape}-{color}`), garden bed (`garden-bed-back` + `garden-bed-front`), and rule sign (`rule-sign-post` + `rule-sign-plaque` + `rule-icon-*`) layers only. No character rig is added in Pass 1, and nothing is added to the restaurant `ANIMAL_KINDS` picker. If a garden character is ever approved in a later pass, it must use `CHARACTER_RIGS` (400 × 480 reference, origin at feet centre, head without eyes and mouth as separate swappable parts). Previews composite every layer.
- **Layout:** Landscape (`1280×800`, `number-garden-bg-landscape`) and portrait (`800×1280`, `number-garden-bg-portrait`) layouts supporting 2, 3, and 4 garden beds and the foreground flower path. Tap targets: decided (2026-11-12) minimum **64 CSS px**. If items do not fit at that size, pan or show fewer; never shrink them.
- **RTL:** Hebrew UI chrome is RTL; any English and French learning tokens stay LTR (`ltr-isolate`). Sorting Beds reuses `RestaurantHud` (`src/ui/hud.ts`) for top-bar chrome (adding `data-testid="hud-back"` and `data-testid="hud-help"`), `renderPromptBubble`, and `showHelpOverlay`.
- **Animation:** Reuses the sorting profile knobs and pure motion helpers from `feat/art-sorting-suitcase` (PR #20):
  - `src/anim/profiles.ts`:
    ```ts
    sorting: {
      drop: { duration: 520, arcHeight: 120, endScale: 0.92, ease: 'Sine.easeIn' },
      settle: { duration: 280, squash: 0.9, ease: 'Back.easeOut' },
      ruleSwitch: { duration: 480, ease: 'Sine.easeInOut' },
    }
    ```
  - `src/anim/sortPackMotion.ts`: `dropIntoBed` and `switchRule` are scene helpers that import Phaser, so unit tests must not import that file. `settleScale()` is a thin wrapper around `ANIM_PROFILE.sorting.settle.squash`. `packIntoSuitcase` in the same file is for Travel Suitcase, not this game.
  - Unit tests import `ANIM_PROFILE.sorting` from `src/anim/profiles.ts` only (that module does not import Phaser).
- **Voice table** (Pass 1 uses device TTS through `AudioManager.play({ lineId, lang, text })`; Pass 2 renders Leda clips with `scripts/tts/generate_voice.py` under the repo's existing audio tree and registers them in `voice-lines-he.json` and `audio-manifest.json` with matching text hashes):
  - English and French colour and size vocabulary lines (`sorting.word.*`) are in Pass 1 (decided 2026-11-12). Voice assertions use `getSpokenLines` `lineId`s (PR #37). **Gap for the team lead:** confirm or replace drafted spoken strings and `lineId` names below before implementation.

| lineId | lang (`en` / `fr` / `he`) | Text | Trigger |
|---|---|---|---|
| `sorting.rule.color.he` | `he` | בואו נמיין את הפרחים לפי צבע! (draft) | Round start when sorting by colour (L1–L4, or first rule at L5/L8) |
| `sorting.rule.shape.he` | `he` | בואו נמיין את הפרחים לפי צורה! (draft) | Round start when sorting by shape |
| `sorting.rule.size.he` | `he` | בואו נמיין את הפרחים לפי גודל — גדולים וקטנים! (draft) | Round start when sorting by size |
| `sorting.rule.two-attr.he` | `he` | שימו לב גם לצבע וגם לגודל! (draft) | Round start at two-attribute levels (L5–L7) |
| `sorting.switch.size.he` | `he` | עכשיו החוק השתנה! ממיינים לפי גודל! (draft) | Mid-round rule switch to size at L8 (`request: 'rule-switch'`) |
| `sorting.switch.color.he` | `he` | עכשיו החוק השתנה! ממיינים לפי צבע! (draft) | Mid-round rule switch to colour at L8 (`request: 'rule-switch'`) |
| `sorting.switch.shape.he` | `he` | עכשיו החוק השתנה! ממיינים לפי צורה! (draft) | Mid-round rule switch to shape at L8 (`request: 'rule-switch'`) |
| `sorting.correct.he` | `he` | יופי! בערוגה הנכונה! (draft) | Flower placed into the matching garden bed |
| `sorting.wrong.hint.he` | `he` | לא בערוגה הזאת — נסו את הערוגה המסומנת! (draft) | Wrong bed tapped; wrong bed shakes and matching bed is highlighted |
| `sorting.bed-full.he` | `he` | הערוגה מלאה ופורחת! כל הכבוד! (draft) | A garden bed reaches capacity and blooms |
| `sorting.help.he` | `he` | שימו כל פרח בערוגה שמתאימה לו לפי השלט. (draft) | Tapping the HUD help button (`[data-testid="hud-help"]`) |
| `sorting.word.red.en` | `en` | red (draft, Pass 1) | Pass 1 EN colour word on placing a red flower |
| `sorting.word.yellow.en` | `en` | yellow (draft, Pass 1) | Pass 1 EN colour word on placing a yellow flower |
| `sorting.word.blue.en` | `en` | blue (draft, Pass 1) | Pass 1 EN colour word on placing a blue flower |
| `sorting.word.big.en` | `en` | big (draft, Pass 1) | Pass 1 EN size word on placing a large flower |
| `sorting.word.small.en` | `en` | small (draft, Pass 1) | Pass 1 EN size word on placing a small flower |
| `sorting.word.red.fr` | `fr` | rouge (draft, Pass 1) | Pass 1 FR colour word on placing a red flower |
| `sorting.word.yellow.fr` | `fr` | jaune (draft, Pass 1) | Pass 1 FR colour word on placing a yellow flower |
| `sorting.word.blue.fr` | `fr` | bleu (draft, Pass 1) | Pass 1 FR colour word on placing a blue flower |
| `sorting.word.big.fr` | `fr` | grand (draft, Pass 1) | Pass 1 FR size word on placing a large flower |
| `sorting.word.small.fr` | `fr` | petit (draft, Pass 1) | Pass 1 FR size word on placing a small flower |

- **World and PWA wiring:**
  - `src/content/worlds.json`: change `number-garden` from `"status": "locked"` to `"status": "open"`, keep `"earnsLeisure": true`, and set `"entryGameId": "sorting-beds"`.
  - `src/pwa/updatePolicy.ts`: add `'sorting'` to `AppScreen` (`'profile' | 'map' | 'restaurant' | 'bubbles' | 'orchestra' | 'sorting' | 'parent' | 'loading'`). `isSafeToApplyUpdate('sorting')` returns `false` so service-worker updates defer while the child is in Sorting Beds.
  - **Gap for the team lead:** Confirm the `AppScreen` union value `'sorting'` (matching short screen ids `'restaurant'`, `'orchestra'`, `'bubbles'`).

### Pass 2 — polish

- Richer bed-full bloom celebration and rule-switch animations (petal/sparkle choreography when a bed fills, enhanced sign-flip and bed-shake feedback).
- Recorded Gemini TTS clips (voice Leda) for every line in the voice table, rendered with `scripts/tts/generate_voice.py` following the existing repo audio tree (`voice-lines-he.json` and `audio-manifest.json` with matching text hashes, verified by `AC-15`); device TTS stays the fallback. Do not add `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.

## Out of scope

- Pass 2 polish items (recorded Leda voice clips, richer bloom particle/animation polish, and age-5 drag-and-drop) during Pass 1. Age 5 uses tap-to-place in Pass 1; drag is Pass 2.
- Extra item types mentioned in `docs/WORLDS.md` or the research doc (leaves, vegetables, fruit) and the mole character ("Now the mole wants them by SIZE!") — Pass 1 strictly scopes items to the composited flowers from PR #20.
- `packIntoSuitcase` in `src/anim/sortPackMotion.ts` (used by Travel Suitcase, not Sorting Beds).
- Response-time scoring / skip-ahead (`useResponseTime` is `false` on both tracks in v1), 14-day skill decay, window-percentage rules, frustration guard, and parent level overrides (`docs/adaptive-engine.md` §1).
- Other Number Garden games (Picnic Train, Garden Scales).

## Open decisions for the owner

- **Open decision for the owner:** Whether to keep the adaptive engine v1 default rules (`upCleanStreak: 3`, `downMisses: 2` within `downWindow: 3`, drop by 1 level, `useResponseTime: false`) or adopt any of the research sketch alternatives (`upCleanStreak: 4`, consecutive `downMisses: 2` / `downWindow: 2`, resetting straight to 1 attribute on a drop, or an age-5 `< 3.5 s` response-time rule in a later engine version). This spec drafts the engine v1 defaults and does not enable response-time scoring.

### Gaps for the team lead to complete before approval

- **Gap for the team lead:** Confirm the exact tap-to-place choreography (one-tap on a target bed for the active flower vs. tap flower then tap bed) and whether one adaptive trial equals one flower placement or one completed bed.
- **Gap for the team lead:** Define what `extra.attributes: 2` (L5–L7) and `choiceCount: 4` (4 beds at L6–L8) mean operationally — specifically whether L5–L7 cycle one attribute rule per round (`colour, then size, one rule per round` as in `docs/adaptive-engine.md` §2.2) or define each bed by a two-attribute conjunction (`"small red"` as in `games-per-world.md` §4.2), and how 4 beds are populated when a single attribute has only 2 values (`size`) or 3 values (`color`, `shape`).
- **Gap for the team lead:** Specify how L1 ("picture labels on the beds") vs. L2–L3 (`scaffold: 'outline'`, picture labels + ghost slots) vs. L4–L6 (`scaffold: 'symbol'`) map onto `LevelDescriptorSchema` and the frozen `rule-icon-*` and flower assets.
- **Gap for the team lead:** Confirm or replace drafted Hebrew and Pass 1 English/French colour and size voice strings and `lineId` keys in the voice table.
- **Gap for the team lead:** Confirm the `AppScreen` id `'sorting'` in `src/pwa/updatePolicy.ts` and the exact fields of `getSortingInfo()`.
- **Gap for the team lead:** Whether age 2 should get an idle demonstrate hint (and at what delay, and whether that records `assisted`). Age 5 is decided: no automatic idle hint; hint only after a mistake. Also confirm the one-miss-per-item / debounce rule for wrong-bed taps.
- **Gap for the team lead:** Picnic Train will need its own scene folder (`public/art/scenes/picnic-train/`) later so it does not collide with `public/art/scenes/number-garden/` frozen here from PR #20.

## Changelog

- 2026-11-12 — created — substantive
- 2026-11-12 — Owner decisions: 8-level curve approved (age-2 start L2, age-5 start L5); age 5 taps in Pass 1 and drags in Pass 2; EN/FR colour and size words in Pass 1; tap target 64 CSS px; age 5 has no idle hint (hint only after a mistake). Shared e2e handles and `enterWorldByTap` from PR #37 (pending merge). — substantive

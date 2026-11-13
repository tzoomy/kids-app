# sorting-beds — Sorting Beds

Status: **approved**
Pass in progress: **1**

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
  - **Gap for the team lead:** Confirm the exact tap-to-place interaction flow for a single placement (whether one highlighted "current" flower on the path flies into the tapped bed with a single tap on the bed, or whether the child taps a flower on the path to select it and then taps a target bed) and confirm how many flower placements constitute one adaptive trial vs. one full bed/round (`trialsPerRound: 3`). → resolved 2026-11-13, below (see "Decided by the owner (2026-11-13): choreography" at the end of this section).
- **Feedback on a correct answer:** The flower arcs from the path into the chosen bed (`dropIntoBed` using `ANIM_PROFILE.sorting.drop`) and settles into the soil between `garden-bed-back` and `garden-bed-front` with a squash-and-stretch bounce (`settleScale` using `ANIM_PROFILE.sorting.settle`). A positive voice line plays, and the colour or size token is spoken in English or French (Pass 1, decided 2026-11-12). A first-try correct placement records a `clean` outcome. Decided (2026-11-12): age 5 has no automatic idle hint; a hint is given only after a mistake (the wrong-bed shake, highlight, and hint line). **Gap for the team lead:** whether age 2 should get a demonstrate hint after idle (and at what delay, and whether that records `assisted`), as Animal Restaurant and Kitchen Orchestra do on the age-2 track. → resolved 2026-11-13, below (see "Decided by the owner (2026-11-13): hints, one miss per item, and the 400 ms lock" at the end of this section).
- **Feedback on a wrong answer (hint or retry):** Tapping or dropping onto a bed whose rule does not match the flower triggers Montessori control-of-error feedback: the wrong bed "shakes its head" horizontally, the matching target bed is highlighted/indicated, and a gentle hint voice line plays. The flower remains on the path so the child can place it into the right bed. A wrong first attempt on a trial is recorded as a single `miss`; the child can then place the flower in the right bed without recording additional misses for that item. **Gap for the team lead:** confirm this one-miss-per-item rule, and that a rapid double tap is treated as one try. → resolved 2026-11-13, below (see "Decided by the owner (2026-11-13): hints, one miss per item, and the 400 ms lock"). Mistakes never reduce the leisure balance or star count.
- **Mid-round rule switch (Level 8):** At Level 8 (`request: 'rule-switch'`), halfway through the round's flowers, the rule signs animate (`switchRule` using `ANIM_PROFILE.sorting.ruleSwitch`) and a voice prompt announces that the sorting attribute has changed (for example, from colour to size or shape) for the remaining flowers.
- **How a round ends:** When the beds reach capacity / all trials in the round (`trialsPerRound: 3`) are completed, each full bed plays a bloom celebration, `state.stars` increments by 1, `LearningSession.complete()` marks the celebration, and `endRound` runs (applying any pending between-rounds level change on the age-2 track) before the next round starts.
- **How she leaves the game:** Tapping the HUD back button (`[data-testid="hud-back"]`) at any time ends the visit the same way other learning games do: stop audio, persist store and adaptive state (`SkillSession.endVisit()`), call `LearningSession.exit()`, and return to the world map.
- **Input mode per age:**
  - **Age 2:** Tap-to-place (`tap`). Required by `docs/WORLDS.md` and enforced by `trackPolicy('age2').interaction === 'tap'`.
  - **Age 5:** Decided (2026-11-12): tap-to-place in Pass 1; drag-and-drop in Pass 2. Do not assume Pass 1 must drag solely because `trackPolicy('age5').interaction` returns `'drag'`.

**Decided by the owner (2026-11-13): choreography.** Accepted as proposed; resolves the tap-to-place gap above.

- **One flower at a time.** At the start of each trial, one flower (the *current item*) pops into a central basket on the path below the beds (in both orientations). The rest of the round's flowers wait as a small pile beside the basket; they are decoration only and not tappable.
- **One tap per placement.** The child taps the bed the current flower belongs in. There is no select step: she never taps the flower first. A correct tap sends the flower from the basket into that bed (`dropIntoBed`, then `settleScale`); the next flower pops into the basket after the settle. A wrong tap leaves the flower in the basket (see the wrong-answer feedback above).
- **Tapping the flower in the basket** wiggles it and repeats the round's rule line. This is a voluntary replay, not a hint, the same as tapping the animal in Animal Restaurant (`docs/adaptive-engine.md`, owner decision 5).
- **Trial and round.** One adaptive trial = one placement of one flower. With the engine default `trialsPerRound: 3`, a round is 3 flowers. A bed's capacity in a round is the number of that round's flowers that belong to it, and each round's flowers target at least 2 different beds. With 4 beds and 3 flowers, at least one bed stays empty in that round: it does not bloom, and the round-end celebration covers the whole garden. The owner kept `trialsPerRound: 3` (2026-11-13); filling every bed every round would need `trialsPerRound` of at least `choiceCount`, an engine-rule override that is not adopted.
- **Basket art.** There is no basket asset on `main` or on `feat/art-sorting-suitcase`. New frozen prop: `public/art/props/flower-basket.svg`, manifest key `flower-basket` (Gemini, same SVG contract). Until it lands, the implementation may show the current flower on a highlighted spot on the path; the hooks and tests do not depend on the basket art.
- **Age 5 in Pass 2 (already decided, 2026-11-12: drag in Pass 2).** The age-5 child drags the flower from the basket onto a bed. A drop on a bed counts exactly like a tap on that bed (same trial and miss rules). A drop outside every bed returns the flower to the basket and records nothing.

**Decided by the owner (2026-11-13): hints, one miss per item, and the 400 ms lock.** Accepted as proposed; resolves the age-2 idle-hint and debounce gaps above.

- **Age 2 idle hint.** `ageTracks.age2 = { hintMode: 'demonstrate', hintDelayMs: 6000 }`, the same as `animal-restaurant.json` and `kitchen-orchestra.json`. If she has not tapped a bed `hintDelayMs` after the current flower arrives, the flower makes a short demonstration hop toward its matching bed and back, the matching bed pulses (as `hintPulse` plus the sparkle burst in `RestaurantScene.giveHint`), and the round's rule line is spoken again. While the intro, a voice line, or the help card is playing or open, the hint waits and retries after another `hintDelayMs` (as in the restaurant). One idle hint per trial.
- **Recording.** An idle hint fired before the trial is recorded marks the trial hinted (`trialTracker.onHint()` semantics), so a following correct placement records `assisted`, not `clean` (`src/core/adaptive/rules.ts`). A hint shown after a recorded miss changes nothing. The voluntary replay (tapping the basket flower) is never a hint.
- **Age 5.** `ageTracks.age5 = { hintMode: 'repeat-then-demonstrate', hintDelayMs: 8000 }`, as in the restaurant, where the idle timer only runs for `'demonstrate'`. So age 5 gets no idle hint (decided 2026-11-12), and the wrong-tap feedback below is her only hint. The wrong-tap feedback itself (shake, highlight, `sorting.wrong.hint.he`) is the same on both tracks.
- **One miss per item.** The first wrong tap on the current flower records the trial's `miss` at once. Later wrong taps on the same flower, and its final correct placement, record nothing. A correct first tap records `clean` (or `assisted` after an idle hint). This is the restaurant `trialTracker.onPlateTap` rule: at most one result per trial.
- **400 ms lock.** After a wrong tap, bed taps are ignored for 400 ms (`WRONG_TAP_LOCK_MS = 400` in `RestaurantScene.ts`), so a rapid double tap is one try: no second placement attempt, no second shake, no second hint line. Every tap that is not swallowed by the lock still calls `learningSession.reportInteraction()`.

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

  - **Gap for the team lead:** Resolve the operational definition of `extra.attributes: 2` at L5–L7 and how `choiceCount: 4` (4 beds at L6–L8) maps to the available art attributes (`color` has 3 values: `red`, `yellow`, `blue`; `shape` has 3 values: `tulip`, `daisy`, `round`; `size` has 2 values: `small`, `large`). Specifically, `docs/adaptive-engine.md` §2.2 describes L5 as `extra.attributes 2 (colour, then size, one rule per round)`, whereas the research doc (`games-per-world.md` §4.2) describes two-attribute sorting as conjunctions such as `"small red"`. A 4-bed layout at L6–L8 requires either two-attribute conjunction beds (e.g., `small red`, `large red`, `small yellow`, `large yellow`) or a mix of attributes so all 4 beds have distinct valid rules. → resolved 2026-11-13, below (see "Decided by the owner (2026-11-13): one sorting rule per round" at the end of this section).
  - **Gap for the team lead:** Specify how L1 ("picture labels on the beds") vs. L2–L3 (`scaffold: 'outline'`, picture labels + ghost slots) vs. L4–L6 (`scaffold: 'symbol'`) are encoded in `LevelDescriptorSchema` (`scaffold: z.enum(['outline', 'symbol', 'none']).optional()` plus `extra` flags if needed) and rendered using the frozen `rule-icon-*` and flower SVGs. → resolved 2026-11-13, below (see "Decided by the owner (2026-11-13): bed labels and scaffolds per level").
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
  - Decided by the owner (2026-11-13): keep the adaptive-engine v1 defaults (`upCleanStreak: 3`, `downMisses: 2` in `downWindow: 3`, drop by 1 level, `trialsPerRound: 3`, `useResponseTime: false`). The `games-per-world.md` §4.2 research sketch values (`upCleanStreak: 4`, strict consecutive `downMisses: 2` / `downWindow: 2`, dropping straight back to a 1-attribute level, an age-5 `< 3.5 s` per-item response-time rule) are not adopted. This spec does not enable response-time scoring (see Open decisions).

**Decided by the owner (2026-11-13): one sorting rule per round.** Accepted as proposed, including the mismatch notes below; resolves the `extra.attributes` / 4-bed gap above.

- **`extra.attributes: 1` (L1–L4).** The beds of every round are defined by one attribute, and that attribute stays the same for the whole visit, so the child never has to re-read the rule between rounds. It is picked at the start of the visit, cycling colour → shape → size across visits. Size has only 2 values, so it is used only at 2-bed levels (L1–L2); at 3 beds the visit's attribute falls back to the next of colour or shape.
- **`extra.attributes: 2` (L5–L8).** One sorting rule per round, but the rule's attribute changes between rounds, so the child must listen to and check the rule each round ("colour, then size, one rule per round", `docs/adaptive-engine.md` §2.2). Combined rules such as "small red" were meant to start only at L7–L8, if the approved curve allows it. **It does not fully allow it; see the mismatch note.**
- **Proposed operational rule (the resolution):**
  - **L5** (3 beds): rounds alternate colour → size → colour … A colour round has 3 beds (red, yellow, blue). A size round has only 2 values, so the bed count is clamped: `beds = min(choiceCount, values(attribute))` = 2 (small, large); the third bed is not shown in that round. At L5 the extra demand is the change of rule between rounds, not the bed count.
  - **L6–L7** (4 beds): every bed is a size × colour conjunction using 2 of the 3 colours, picked per round (for example small red, large red, small yellow, large yellow). The round starts with `sorting.rule.two-attr.he`. At L6 the plaque shows both icons (`rule-icon-size-*` + `rule-icon-color-*`); at L7 the plaques are blank (see the bed-label proposal).
  - **L8** (4 beds, `rule-switch`): the round starts as size × colour; after the round's **first** placement (1 flower before the switch, 2 after, so the flexible demand is sampled twice; "halfway" in the Mechanic section is rounded this way), the colour half of the rule is replaced by shape: the beds now mean size × shape. The switch plays `switchRule` on the plaques and `sorting.switch.shape.he`. Already planted flowers stay where they are. **Team-lead decision (2026-11-13):** after the switch, Pass 1 speaks only the size token (EN/FR) for the remaining flowers; shape is carried visually by the example flower planted in each bed (shape words stay in Pass 2). `extra.vary: 2` still means shape varies among the round's flowers, as at L6–L7.
  - **Items.** An item id is the flower variant `<shape>-<color>-<size>` (18 items). Attributes that are not part of the rule vary per `extra.vary` (bed-label proposal), so the child must ignore them.
- **Mismatch note (flagged for the owner; accepted with the decision, 2026-11-13).**
  1. **4 beds with one attribute is impossible with the frozen art.** No attribute has 4 values (colour 3, shape 3, size 2), so the approved `choiceCount: 4` at L6 forces conjunction beds from **L6**, not L7. The proposal puts conjunctions at L6, where the symbol scaffold still shows both icons, which makes L6 the gentlest place to introduce them. The alternatives would change the approved curve or the art: lower L6 to `choiceCount: 3` (curve change), or add a fourth colour (new art, out of scope in Pass 1).
  2. **A 3-bed size round is impossible.** L5 says "colour, then size" with 3 beds, but size has 2 values; hence the clamp to 2 beds on size rounds. Alternative if the owner prefers 3 beds every round: alternate colour ↔ shape at L5 (both have 3 values), which departs from the "colour, then size" wording in `docs/adaptive-engine.md` §2.2.
  3. **L8 `extra.attributes`.** This spec's table gives L8 `extra.attributes: 2`; `docs/adaptive-engine.md` §2.2 lists no `extra.attributes` at L8. Proposal: keep 2 (L8 builds on the L6–L7 conjunction beds). Minor; no curve change.
  4. **Unlabelled beds.** At `scaffold: 'none'` (L7–L8) the child cannot know which bed is which value from the spoken rule alone. The proposal resolves this with one example flower pre-planted in each bed (bed-label proposal below).

**Decided by the owner (2026-11-13): bed labels and scaffolds per level.** Accepted as proposed; resolves the L1 / outline / symbol encoding gap above.

`LevelDescriptorSchema` on `main` (`src/content/schema.ts`) has `support: 'picture-audio' | 'partial-reveal' | 'audio-first' | 'audio-only' | 'clue' | 'lit' | 'flash'` and `scaffold: 'outline' | 'symbol' | 'none'`. Mapping (a Sorting Beds content refinement, like the restaurant and orchestra ones, accepts only `support: 'picture-audio'`, `request: 'rule-switch'`, `extra.attributes` in {1, 2}, and `extra.vary` in {0, 1, 2}):

| L | `support` | `scaffold` | `extra` | What the beds show |
|---|---|---|---|---|
| 1 | `picture-audio` | — | `attributes: 1, vary: 0` | **Picture label:** the frozen rule icon `rule-icon-<attribute>-<value>` on the plaque and repeated large on the bed's front soil, inside the bed's tap target. The rule is also spoken (the "audio" half). Non-rule attributes are held constant, so the flowers differ only in the sorting attribute. |
| 2 | `picture-audio` | `outline` | `attributes: 1, vary: 1` | Picture label + **ghost slots:** one faint outline per flower the bed will receive this round, drawn from the frozen flower assets at low alpha (no new SVG). One non-rule attribute varies. |
| 3 | `picture-audio` | `outline` | `attributes: 1, vary: 2` | As L2, 3 beds; all non-rule attributes vary. |
| 4 | — | `symbol` | `attributes: 1, vary: 2` | **Symbol:** the rule icon on the small post plaque only (no icon on the bed, no ghost slots). |
| 5 | — | `symbol` | `attributes: 2, vary: 2` | Symbol; the rule alternates between rounds. |
| 6 | — | `symbol` | `attributes: 2, vary: 2` | Symbol: two icons per plaque (size + colour). |
| 7 | — | `none` | `attributes: 2, vary: 2` | **None:** blank plaque (`rule-sign-post` + `rule-sign-plaque`, no icon). Each bed holds one pre-planted **example flower** that defines the bed; it does not count toward capacity. The rule is only spoken. |
| 8 | — | `none` | `attributes: 2, vary: 2`, `request: 'rule-switch'` | As L7. The four example flowers are chosen so they are distinct under both the pre-switch rule (size × colour) and the post-switch rule (size × shape), e.g. small red tulip, large red daisy, small yellow daisy, large yellow tulip. |

`extra.vary` is the number of non-rule attributes that vary among a round's flowers, capped at the number left (at L6–L8 only shape is left under the combined size × colour beds, so `vary: 2` means shape varies). **Team-lead decision (2026-11-13):** that `vary: 2` (shape varies) rule applies at L8 as well, consistent with the combined beds. The three flowers of an L8 round are composed at the start (before the switch), so shape still varies among them after the rule becomes size × shape.

- **Asset location (verified).** The `rule-icon-*`, `rule-sign-*`, `garden-bed-*`, flower, and `number-garden` background SVGs and their manifest keys exist **only on `origin/feat/art-sorting-suitcase`** (commit `b5973af`, PR #20; `src/assets/art/manifest.ts` lines 112–138 on that branch). They are **not on `main`** at `494a15d`. Implementation depends on PR #20 merging first (or on its art being merged additively into the implementation branch).
- **Mismatch note (flagged; accepted with the decision, 2026-11-13).** The frozen art has one icon per value, and those icons are already pictures (a colour petal blob, a shape silhouette, a small flower beside a dashed large one). There is no separate "picture" set and "symbol" set. The proposal therefore makes picture vs. symbol a difference of **size and placement** of the same icon (large, on the bed and the plaque, plus spoken rule, versus small, on the plaque only), not of art. Also, as approved, L1 has *fewer* scaffolds than L2 (no ghost slots); the proposal keeps L1 the easiest level through `extra.vary: 0`, without changing the approved levers.


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
  - **Gap for the team lead:** Confirm the exact fields of `getSortingInfo()` before implementation freezes the hook contract. → resolved 2026-11-13, below (see "Decided by the owner (2026-11-13): sorting screen and hooks").

**Decided by the owner (2026-11-13): sorting screen and hooks.** Accepted as proposed; resolves the `AppScreen` and `getSortingInfo()` gaps.

- **World (verified).** Sorting Beds lives in the Number Garden: `docs/WORLDS.md` § "Number Garden → 2. Sorting Beds", and `src/content/worlds.json` has `number-garden` (`"status": "locked"`, `"earnsLeisure": true`, no `entryGameId` yet).
- **No game picker in Pass 1.** The owner-approved game picker applies to the **Language House only** (testids `game-picker-<gameId>`, e.g. `game-picker-animal-restaurant`, `game-picker-kitchen-orchestra`, close `game-picker-close`; see the TODO in `tests/e2e/helpers/journey.ts` on PR #37). Sorting Beds is the only Number Garden game, so tapping the building opens it directly. A Number Garden picker (`game-picker-sorting-beds`, `game-picker-picnic-train`) would only be needed once a second Number Garden game (Picnic Train) shares the building; that is an open point for the Picnic Train spec, not for this one.
- **Journey helper.** `enterWorldByTap` derives the scene from `WORLD_SCENE` in `tests/e2e/helpers/journey.ts`; the implementation adds `'number-garden': 'SortingScene'` (scene key `SortingScene`) additively.
- **AppScreen.** `'sorting'`, added to `AppScreen` in `src/pwa/updatePolicy.ts` and unsafe to reload mid-game: `isSafeToApplyUpdate('sorting') === false`, like `'restaurant'`, `'orchestra'`, and `'hiding'`. Note: `'hiding'` is added by the Who's Hiding? branch and is not in `AppScreen` on `main` at `494a15d`; the file is a shared registry, so both values are merged additively.
- **Read hook `getSortingInfo(): SortingInfo | null`** under `?e2e=1`. Returns `null` unless `SortingScene` is active. Rectangles are in **page CSS px** (top-left, accounting for canvas scaling and letterbox), converted the same way as `getBuildingHit`, so a test taps the centre of `hit` directly. This contract supersedes the draft `SortingRoundInfo` above for implementation; that draft stays for the record, and its fields map as `language` → `lang`, `flowers[]` → `currentItem` (only the flower in the basket is tappable), `beds[].index` → `beds[].id`, `beds[].accepted` → `beds[].accepts`, `rule` + `attributes` → `rule`.
  ```ts
  type SortAttribute = 'color' | 'shape' | 'size';
  type FlowerColor = 'red' | 'yellow' | 'blue';
  type FlowerShape = 'tulip' | 'daisy' | 'round';
  type FlowerSize = 'small' | 'large';
  interface PageRect { x: number; y: number; width: number; height: number } // page CSS px, top-left

  interface SortingInfo {
    level: number;                                   // 1..8, the level of the active round
    rule: SortAttribute | 'size+color' | 'size+shape'; // what defines the beds right now (after an L8 switch: 'size+shape')
    ruleSwitched: boolean;                           // true after the L8 mid-round switch
    beds: Array<{
      id: string;                                    // stable within the round, e.g. 'bed-0' … 'bed-3'
      label: 'picture' | 'symbol' | 'none';          // L1–L3 picture, L4–L6 symbol, L7–L8 none
      ghostSlots: boolean;                           // scaffold 'outline' (L2–L3)
      accepts: { color?: FlowerColor; shape?: FlowerShape; size?: FlowerSize }; // the bed's attribute value(s)
      example: string | null;                        // pre-planted example flower id (L7–L8), else null
      count: number;                                 // flowers placed this round (examples excluded)
      capacity: number;                              // this round's flowers that belong here
      bloomed: boolean;
      hit: PageRect;
    }>;
    currentItem: {
      id: string;                                    // '<shape>-<color>-<size>', e.g. 'tulip-red-small'
      color: FlowerColor;
      shape: FlowerShape;
      size: FlowerSize;
      targetBedId: string;                           // the bed it belongs in under the current rule
      tries: number;                                 // bed taps on this flower that were not swallowed by the 400 ms lock
      hinted: boolean;                               // an idle hint fired before the trial was recorded
      hit: PageRect;                                 // the flower in the basket
    } | null;                                        // null between flowers, during animations, and after the round
    lang: 'en' | 'fr';                               // learning-token language of this round (Hebrew guidance is always 'he')
    ready: boolean;                                  // the current flower is in the basket and bed taps are accepted
  }
  ```
- **Seed hook `seedSortingLevel(level: number)`** under `?e2e=1`. Seeds persisted state only: it writes `level` (with `cleanStreak: 0`, `recent: []`) to the active profile's adaptive skill for `sorting-beds` for every content language, exactly like `seedRestaurantLevel` / `seedOrchestraLevel` on PR #37, and persists. No game action and no navigation; the test then enters through `enterWorldByTap`. `seedBalanceSec` is the shared PR #37 hook.
- **Language.** The token language is picked per round with the restaurant's `nextRoundLanguage` from the parent's `settings.languages`, fixed for the round's 3 flowers, and each round feeds that language's skill (`number-garden.sorting-beds.<lang>`), as the restaurant and orchestra do. Shape rounds speak no token (Pass 1 has no shape words); conjunction rounds speak the size token, then the colour token, as two separate line requests.

**Team-lead decision (2026-11-13):** after the L8 switch to size × shape, Pass 1 speaks **only** the size token (`sorting.word.big.<lang>` / `sorting.word.small.<lang>`) for the remaining flowers. Shape is carried visually by the example flower planted in each bed. Shape words in English and French stay in Pass 2, as already decided. This is a minor clarification of the approved voice rule; status stays **approved** and the owner does not need to re-approve it.

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
| AC-09 | Content and language are selected as specified; after the L8 switch to size × shape, Pass 1 speaks only the size token for the remaining flowers (shape words are Pass 2) | 1 | unit | @single-orientation | |
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
| AC-20 | Choreography (decided 2026-11-13): exactly one current flower is in the central basket; a real tap on a bed places it with no select step; the next flower appears only after a correct placement; one placement is one recorded trial and a round is `trialsPerRound` (3) placements | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo` |
| AC-21 | Rule per round (decided 2026-11-13): at `extra.attributes: 1` the beds are defined by one attribute that stays the same for the visit, and size is never the rule at 3 beds; at L5 the rule alternates colour ↔ size between rounds with the bed count clamped to the attribute's value count (2 on size rounds); at L6–L8 the 4 beds are size × colour conjunctions | 1 | unit | @single-orientation | |
| AC-22 | Bed labels and scaffolds per level (decided 2026-11-13): L1–L3 `support: 'picture-audio'` picture labels (rule icon on the plaque and the bed), L2–L3 add `scaffold: 'outline'` ghost slots, L4–L6 `scaffold: 'symbol'` (plaque icon only), L7–L8 `scaffold: 'none'` (blank plaque, one example flower per bed); content validation rejects other `support` and `request` values | 1 | unit | @single-orientation | |
| AC-23 | Seeded levels show the specified bed labels: seeded L2 reports `label: 'picture'` with `ghostSlots: true`, seeded L5 reports `label: 'symbol'`, and seeded L7 reports `label: 'none'` with an `example` in every bed | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedSortingLevel`, `getSortingInfo` |
| AC-24 | One miss per item: the first wrong tap on a flower records the trial's `miss`; later wrong taps and the final correct placement of the same flower record nothing more | 1 | unit | @single-orientation | |
| AC-25 | 400 ms lock: a second bed tap within 400 ms of a wrong tap is ignored (no placement, `tries` unchanged, no second hint line) | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo`, `getSpokenLineCount` |
| AC-26 | Age-2 idle hint: with no tap for `hintDelayMs` (6000 ms) the flower demonstrates its matching bed, `currentItem.hinted` becomes true, and the round's rule line is requested again | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo`, `getSpokenLines` |
| AC-27 | An idle hint fired before the trial is recorded makes a correct placement record `assisted`, not `clean`; a hint after a recorded miss changes nothing; tapping the basket flower to replay the rule is not a hint | 1 | unit | @single-orientation | |
| AC-28 | Age 5 gets a hint only after a mistake: no hint line is requested after 10 s idle; after a wrong tap the wrong bed shakes, the matching bed is highlighted, and `sorting.wrong.hint.he` is requested | 1 | e2e | @single-orientation | `getBuildingHit`, `getSortingInfo`, `getSpokenLines` |
| AC-29 | `'sorting'` is an `AppScreen`, `isSafeToApplyUpdate('sorting')` is `false`, and the app reports `'sorting'` while Sorting Beds is open, so a waiting update defers until the map | 1 | unit | @single-orientation | |
| AC-30 | Leisure independence: a level rise or drop never changes `balanceSec`, `earnedTodaySec`, or `stars`; seeding a level does not change the balance; `src/core/leisure` and `src/core/adaptive` do not import each other | 1 | unit | @single-orientation | |
| AC-31 | Game-specific voice lines: round start requests `sorting.rule.<attribute>.he` (or `sorting.rule.two-attr.he` on conjunction rounds), the L8 switch requests `sorting.switch.shape.he`, a correct placement on a colour, size, or (pre-switch) conjunction round requests the matching `sorting.word.<value>.<lang>` line(s) in the round's `lang`, and after the L8 switch a correct placement requests only the size token in the round's `lang` (no shape word) | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedSortingLevel`, `getSortingInfo`, `getSpokenLines` |
| AC-32 | Round composition: each round's flowers target at least 2 beds; a bed's capacity equals the round's flowers that belong to it; non-rule attributes vary per `extra.vary` (at L8, `vary: 2` still means shape varies among the round's flowers); example flowers (L7–L8) do not count toward capacity, and the four L8 examples are distinct under both the pre-switch and post-switch rule; the L8 switch happens after the round's first placement | 1 | unit | @single-orientation | |

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

  - **Scene-folder note:** Process v2 requires scene folders under `public/art/scenes/<scene-or-game-name>/` to be named per scene or game, never the world id. Because PR #20 already created `public/art/scenes/number-garden/bg-{landscape,portrait}.svg`, this spec freezes that existing path for Sorting Beds. **Gap for the team lead:** Picnic Train (and any other Number Garden game) will need its own per-game scene folder (`public/art/scenes/picnic-train/`) later so the two games do not collide. → resolved 2026-11-13 under Out of scope.
  - **Decided by the owner (2026-11-13):** every asset in the table above exists only on `origin/feat/art-sorting-suitcase` (PR #20), not on `main` at `494a15d`, so PR #20 merges first. Bed labels reuse the frozen `rule-icon-*` at two sizes and draw ghost slots from the flower assets at low alpha (see "bed labels and scaffolds per level" in Difficulty curve); no new icon art. One new prop is added for the basket: `public/art/props/flower-basket.svg`, key `flower-basket` (see "choreography" in Mechanic).
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
  - English and French colour and size vocabulary lines (`sorting.word.*`) are in Pass 1 (decided 2026-11-12). Voice assertions use `getSpokenLines` `lineId`s (PR #37). **Gap for the team lead:** confirm or replace drafted spoken strings and `lineId` names below before implementation. → resolved 2026-11-13: line ids confirmed unchanged; strings corrected in place (see "Voice-string review (team lead, 2026-11-12)" below the table).

| lineId | lang (`en` / `fr` / `he`) | Text | Trigger |
|---|---|---|---|
| `sorting.rule.color.he` | `he` | בואי נמיין את הפרחים לפי צבע! (draft) | Round start when sorting by colour (L1–L4, or first rule at L5/L8) |
| `sorting.rule.shape.he` | `he` | בואי נמיין את הפרחים לפי צורה! (draft) | Round start when sorting by shape |
| `sorting.rule.size.he` | `he` | בואי נמיין את הפרחים לפי גודל — גדולים וקטנים! (draft) | Round start when sorting by size |
| `sorting.rule.two-attr.he` | `he` | שימי לב גם לצבע וגם לגודל! (draft) | Round start at two-attribute levels (L5–L7); under the 2026-11-13 decision: round start on size × colour conjunction rounds (L6–L8), while L5 rounds use `sorting.rule.color.he` / `sorting.rule.size.he` |
| `sorting.switch.size.he` | `he` | הפתעה! עכשיו שימי לב לגודל! (draft) | Mid-round rule switch to size at L8 (`request: 'rule-switch'`); reserved (not triggered) under the 2026-11-13 decision, where L8 always switches colour → shape |
| `sorting.switch.color.he` | `he` | הפתעה! עכשיו שימי לב לצבע! (draft) | Mid-round rule switch to colour at L8 (`request: 'rule-switch'`); reserved (not triggered) under the 2026-11-13 decision |
| `sorting.switch.shape.he` | `he` | הפתעה! עכשיו שימי לב לצורה! (draft) | Mid-round rule switch to shape at L8 (`request: 'rule-switch'`) |
| `sorting.correct.he` | `he` | יופי! הפרח בערוגה הנכונה! (draft) | Flower placed into the matching garden bed |
| `sorting.wrong.hint.he` | `he` | כמעט! נסי את הערוגה המסומנת. (draft) | Wrong bed tapped; wrong bed shakes and matching bed is highlighted |
| `sorting.bed-full.he` | `he` | הערוגה מלאה ופורחת! כל הכבוד! (draft) | A garden bed reaches capacity and blooms |
| `sorting.help.he` | `he` | שימי כל פרח בערוגה שמתאימה לו. (draft) | Tapping the HUD help button (`[data-testid="hud-help"]`) |
| `sorting.word.red.en` | `en` | red (draft, Pass 1) | Pass 1 EN colour word on placing a red flower |
| `sorting.word.yellow.en` | `en` | yellow (draft, Pass 1) | Pass 1 EN colour word on placing a yellow flower |
| `sorting.word.blue.en` | `en` | blue (draft, Pass 1) | Pass 1 EN colour word on placing a blue flower |
| `sorting.word.big.en` | `en` | big (draft, Pass 1) | Pass 1 EN size word on placing a large flower |
| `sorting.word.small.en` | `en` | small (draft, Pass 1) | Pass 1 EN size word on placing a small flower |
| `sorting.word.red.fr` | `fr` | rouge (draft, Pass 1) | Pass 1 FR colour word on placing a red flower |
| `sorting.word.yellow.fr` | `fr` | jaune (draft, Pass 1) | Pass 1 FR colour word on placing a yellow flower |
| `sorting.word.blue.fr` | `fr` | bleue (draft, Pass 1) | Pass 1 FR colour word on placing a blue flower |
| `sorting.word.big.fr` | `fr` | grande (draft, Pass 1) | Pass 1 FR size word on placing a large flower |
| `sorting.word.small.fr` | `fr` | petite (draft, Pass 1) | Pass 1 FR size word on placing a small flower |

#### Voice-string review (team lead, 2026-11-12)

Line ids are unchanged (none is malformed). `(draft)` markers are kept. Changes made in place:

| lineId | Before | After | Why |
|---|---|---|---|
| `sorting.rule.color.he` | בואו נמיין את הפרחים לפי צבע! | בואי נמיין את הפרחים לפי צבע! | Plural address → feminine singular. Kid-facing Hebrew in this repo addresses one girl (`voice-lines-he.json`: "feminine address"; existing lines בואי, הקשיבי, נסי). |
| `sorting.rule.shape.he` | בואו נמיין את הפרחים לפי צורה! | בואי נמיין את הפרחים לפי צורה! | Same address fix. |
| `sorting.rule.size.he` | בואו נמיין את הפרחים לפי גודל — גדולים וקטנים! | בואי נמיין את הפרחים לפי גודל — גדולים וקטנים! | Same address fix. |
| `sorting.rule.two-attr.he` | שימו לב גם לצבע וגם לגודל! | שימי לב גם לצבע וגם לגודל! | Same address fix. Trigger narrowed to size × colour conjunction rounds under the rule-per-round proposal (at L5 only one attribute applies per round, so "both colour and size" would be wrong there). |
| `sorting.switch.size.he` | עכשיו החוק השתנה! ממיינים לפי גודל! | הפתעה! עכשיו שימי לב לגודל! | "החוק" ("the law") is a heavy, abstract word for a 5-year-old. "Surprise! Now look at the size!" is short and natural, and stays correct whether the new rule is one attribute or a conjunction (L8 under the proposal). Trigger marked reserved under the proposal. |
| `sorting.switch.color.he` | עכשיו החוק השתנה! ממיינים לפי צבע! | הפתעה! עכשיו שימי לב לצבע! | Same as above. Trigger marked reserved under the proposal. |
| `sorting.switch.shape.he` | עכשיו החוק השתנה! ממיינים לפי צורה! | הפתעה! עכשיו שימי לב לצורה! | Same as above. This is the L8 switch line under the proposal (colour → shape, size kept). |
| `sorting.correct.he` | יופי! בערוגה הנכונה! | יופי! הפרח בערוגה הנכונה! | The fragment had no subject; with "the flower" it is a complete, clearer sentence for TTS and for a 2-year-old. |
| `sorting.wrong.hint.he` | לא בערוגה הזאת — נסו את הערוגה המסומנת! | כמעט! נסי את הערוגה המסומנת. | Plural → feminine singular. Opens gently with "כמעט!" (as `retry.0`) instead of a negation; the shaking bed already shows "not here" (control of error). |
| `sorting.help.he` | שימו כל פרח בערוגה שמתאימה לו לפי השלט. | שימי כל פרח בערוגה שמתאימה לו. | Plural → feminine singular. "לפי השלט" ("by the sign") is false at L7–L8, where the plaques are blank (`scaffold: 'none'`). Agreement checked: ערוגה (f.) שמתאימה, לו → פרח (m.). |
| `sorting.word.blue.fr` | bleu | bleue | The token names the flower just placed: *la fleur* is feminine, so the adjective agrees (*une fleur bleue*). Same sound; correct spelling matters for the TTS text hash and any on-screen token. |
| `sorting.word.big.fr` | grand | grande | Agreement with *fleur* (feminine); here the pronunciation changes. |
| `sorting.word.small.fr` | petit | petite | Agreement with *fleur* (feminine); the pronunciation changes. |

Checked and unchanged: `sorting.bed-full.he` (הערוגה מלאה ופורחת! כל הכבוד! — ערוגה is feminine, so מלאה and פורחת agree), `sorting.word.{red,yellow,blue,big,small}.en`, and `sorting.word.{red,yellow}.fr` (*rouge* and *jaune* are the same in both genders). Notes: the `big` line ids map to the attribute value `large` (kept as is: "big" is the more natural word for a young child); no masculine noun is spoken next to the French tokens in Pass 1, so if one is ever added (for example *le parterre*), that line would use the masculine forms.

- **World and PWA wiring:**
  - `src/content/worlds.json`: change `number-garden` from `"status": "locked"` to `"status": "open"`, keep `"earnsLeisure": true`, and set `"entryGameId": "sorting-beds"`.
  - `src/pwa/updatePolicy.ts`: add `'sorting'` to `AppScreen` (`'profile' | 'map' | 'restaurant' | 'bubbles' | 'orchestra' | 'sorting' | 'parent' | 'loading'`). `isSafeToApplyUpdate('sorting')` returns `false` so service-worker updates defer while the child is in Sorting Beds.
  - **Gap for the team lead:** Confirm the `AppScreen` union value `'sorting'` (matching short screen ids `'restaurant'`, `'orchestra'`, `'bubbles'`). → resolved 2026-11-13 (see "Decided by the owner (2026-11-13): sorting screen and hooks" in Player journey).
  - **Decided by the owner (2026-11-13):** `src/content/games/sorting-beds.json` holds `world: 'number-garden'`, `id: 'sorting-beds'`, `languages: ['en', 'fr']`, `ageTracks` as in the hints proposal, and the `adaptive` block (tracks `age2 { start: 2, min: 1, max: 8 }`, `age5 { start: 5, min: 1, max: 8 }`, no `rules` override, and the 8 levels from the bed-label proposal table).

### Pass 2 — polish

- Richer bed-full bloom celebration and rule-switch animations (petal/sparkle choreography when a bed fills, enhanced sign-flip and bed-shake feedback).
- Recorded Gemini TTS clips (voice Leda) for every line in the voice table, rendered with `scripts/tts/generate_voice.py` following the existing repo audio tree (`voice-lines-he.json` and `audio-manifest.json` with matching text hashes, verified by `AC-15`); device TTS stays the fallback. Do not add `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.

## Out of scope

- Pass 2 polish items (recorded Leda voice clips, richer bloom particle/animation polish, and age-5 drag-and-drop) during Pass 1. Age 5 uses tap-to-place in Pass 1; drag is Pass 2.
- Extra item types mentioned in `docs/WORLDS.md` or the research doc (leaves, vegetables, fruit) and the mole character ("Now the mole wants them by SIZE!") — Pass 1 strictly scopes items to the composited flowers from PR #20.
- `packIntoSuitcase` in `src/anim/sortPackMotion.ts` (used by Travel Suitcase, not Sorting Beds).
- Response-time scoring / skip-ahead (`useResponseTime` is `false` on both tracks in v1), 14-day skill decay, window-percentage rules, frustration guard, and parent level overrides (`docs/adaptive-engine.md` §1).
- Other Number Garden games (Picnic Train, Garden Scales).
- **Decided by the owner (2026-11-13):** Picnic Train gets its own scene folder later, `public/art/scenes/picnic-train/`, in its own spec. Sorting Beds keeps the PR #20 path `public/art/scenes/number-garden/`; nothing for Picnic Train is added here.
- **Decided by the owner (2026-11-13):** a Number Garden game picker. The owner-approved picker covers the Language House only; a Number Garden picker becomes an open point for the Picnic Train spec once a second game shares the building.
- **Decided by the owner (2026-11-13):** shape words in English and French (`tulip`, `daisy`, …). Pass 1 speaks only the colour and size tokens, as decided. **Team-lead decision (2026-11-13):** this also holds after the L8 switch to size × shape: only the size token is spoken; shape is carried by the example flower in each bed.

## Open decisions for the owner

All open decisions were resolved by the owner on 2026-11-13.

- **Decided by the owner (2026-11-13):** Keep the adaptive engine v1 default rules (`upCleanStreak: 3`, `downMisses: 2` within `downWindow: 3`, drop by 1 level, `useResponseTime: false`). The research sketch alternatives (`upCleanStreak: 4`, consecutive `downMisses: 2` / `downWindow: 2`, resetting straight to 1 attribute on a drop, an age-5 `< 3.5 s` response-time rule) are not adopted. This spec uses the engine v1 defaults and does not enable response-time scoring.
  - This also covers `trialsPerRound`: the owner kept the default of 3, so a round is 3 flowers and, at 4 beds, one bed stays empty per round (see the choreography decision); filling every bed every round would need `trialsPerRound >= choiceCount`, which is not adopted.

### Gaps for the team lead to complete before approval

- **Gap for the team lead:** Confirm the exact tap-to-place choreography (one-tap on a target bed for the active flower vs. tap flower then tap bed) and whether one adaptive trial equals one flower placement or one completed bed. → resolved 2026-11-13 (see Mechanic → "Decided by the owner (2026-11-13): choreography").
- **Gap for the team lead:** Define what `extra.attributes: 2` (L5–L7) and `choiceCount: 4` (4 beds at L6–L8) mean operationally — specifically whether L5–L7 cycle one attribute rule per round (`colour, then size, one rule per round` as in `docs/adaptive-engine.md` §2.2) or define each bed by a two-attribute conjunction (`"small red"` as in `games-per-world.md` §4.2), and how 4 beds are populated when a single attribute has only 2 values (`size`) or 3 values (`color`, `shape`). → resolved 2026-11-13, with a mismatch note (see Difficulty curve → "Decided by the owner (2026-11-13): one sorting rule per round").
- **Gap for the team lead:** Specify how L1 ("picture labels on the beds") vs. L2–L3 (`scaffold: 'outline'`, picture labels + ghost slots) vs. L4–L6 (`scaffold: 'symbol'`) map onto `LevelDescriptorSchema` and the frozen `rule-icon-*` and flower assets. → resolved 2026-11-13, with a mismatch note (see Difficulty curve → "Decided by the owner (2026-11-13): bed labels and scaffolds per level").
- **Gap for the team lead:** Confirm or replace drafted Hebrew and Pass 1 English/French colour and size voice strings and `lineId` keys in the voice table. → resolved 2026-11-13 (see "Voice-string review (team lead, 2026-11-12)").
- **Gap for the team lead:** Confirm the `AppScreen` id `'sorting'` in `src/pwa/updatePolicy.ts` and the exact fields of `getSortingInfo()`. → resolved 2026-11-13 (see Player journey → "Decided by the owner (2026-11-13): sorting screen and hooks").
- **Gap for the team lead:** Whether age 2 should get an idle demonstrate hint (and at what delay, and whether that records `assisted`). Age 5 is decided: no automatic idle hint; hint only after a mistake. Also confirm the one-miss-per-item / debounce rule for wrong-bed taps. → resolved 2026-11-13 (see Mechanic → "Decided by the owner (2026-11-13): hints, one miss per item, and the 400 ms lock").
- **Gap for the team lead:** Picnic Train will need its own scene folder (`public/art/scenes/picnic-train/`) later so it does not collide with `public/art/scenes/number-garden/` frozen here from PR #20. → resolved 2026-11-13 under Out of scope.

## Changelog

- 2026-11-12 — created — substantive
- 2026-11-12 — Owner decisions: 8-level curve approved (age-2 start L2, age-5 start L5); age 5 taps in Pass 1 and drags in Pass 2; EN/FR colour and size words in Pass 1; tap target 64 CSS px; age 5 has no idle hint (hint only after a mistake). Shared e2e handles and `enterWorldByTap` from PR #37 (pending merge). — substantive
- 2026-11-12 — team-lead proposals added (choreography, attribute rule per round, L1 picture labels and scaffold mapping, sorting AppScreen and hooks, age-2 idle hint and one miss per item, Picnic Train scene folder out of scope), voice strings reviewed, AC table completed; engine rules left as the single open owner decision — substantive
- 2026-11-13 — approved by the owner; all open decisions and team-lead proposals resolved (engine v1 rules incl. `trialsPerRound: 3` kept, choreography, one rule per round, combined beds from L6, 2 beds on L5 size rounds, one example flower per bed at L7–L8, flower-basket prop, scaffold/support mapping, sorting AppScreen and hooks, age-2 idle hint and one miss per item, Picnic Train scene folder out of scope, dependency on art PR #20); 0 ACs added — substantive
- 2026-11-13 — **Team-lead decision (2026-11-13)** (minor clarification; status stays approved, no owner re-approval): after the L8 switch to size × shape, Pass 1 speaks only the size token for the remaining flowers (shape is carried by the example flower; shape words stay Pass 2); `extra.vary: 2` (shape varies) applies at L8 as well. AC-09, AC-31, and AC-32 updated to match. — clarifying
- 2026-11-13 — Pass in progress set to 1 in the Pass 1 implementation PR (#44); `npm run check:ac` now enforces every Pass-1 criterion — process

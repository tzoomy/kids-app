# Sorting Beds: scene contract (Pass 1, TDD step 1)

Audience: Gemini (visual and scene code). Source of truth: `docs/specs/sorting-beds.md` (approved 2026-11-13, owned by PR #35). This file only
lists what the tests and the stub already freeze, and where the implementation goes. If this file and the spec disagree, the spec wins; raise it.

Status: the scene is a stub. The AC tests under `tests/` fail on purpose until the real scene and the real pure logic land.

## Where to implement

| Implement here | Notes |
|---|---|
| `src/games/sorting/SortingScene.ts` | `create`, layout, art, taps, idle hint, animations, voice, trial recording, hooks data. Keep the hook signatures below. |
| `src/games/sorting/` (new helpers) | Layout, art keys, motion helpers. Phaser-free logic stays out of the scene. |
| `src/games/sorting/sortingLogic.ts` | Replace the `STUB` bodies with the real algorithms. Keep every exported name and signature. The unit tests import them. |
| `src/anim/sortPackMotion.ts` (new, from PR #20) | `dropIntoBed`, `switchRule`, `settleScale`. Imports Phaser, so unit tests never import it. |

| Do NOT change without a spec change | Why |
|---|---|
| `src/games/sorting/types.ts` | Frozen hook types (`SortingInfo`). |
| `getSortingInfo` / `seedSortingLevel` signatures in `src/game/createGame.ts` | Shared hook registry. |
| `tests/e2e/helpers/journey.ts` (`WORLD_SCENE`, Sorting helpers) | Shared journey helper. Additive changes only. |
| `tests/e2e/sorting-beds*.spec.ts`, `tests/unit/sorting-beds*.test.ts` | The acceptance tests. |
| `src/content/games/sorting-beds.json`, `SortingBedsContentSchema` | Level table is frozen by the spec. |
| `src/games/sorting/seedLevel.ts` | Backs the seed hook; unit-tested. |

## Identifiers

- Scene key: `SortingScene`, file `src/games/sorting/SortingScene.ts`, registered in `src/game/createGame.ts` (`game.scene.add`, stopped in `goToScreen`).
- Started by `MapScene` when the Number Garden's `entryGameId` is `sorting-beds` (iris transition, like the restaurant and the orchestra).
- `AppScreen`: `'sorting'` (`src/pwa/updatePolicy.ts`). `create()` must call `setAppScreen('sorting')`. `isSafeToApplyUpdate('sorting') === false`.
- E2E journey map: `WORLD_SCENE['number-garden'] = 'SortingScene'` in `tests/e2e/helpers/journey.ts`.
- Adaptive skill key per round language: `number-garden.sorting-beds.<lang>`; level changes are recorded through `SkillSession` (`this.context.createSkillSession`).
- World wiring: `src/content/worlds.json` has `number-garden` as `open`, `earnsLeisure: true`, `entryGameId: 'sorting-beds'`.
- Content: `context.content.sorting` (`SortingBedsContent`).

## Hooks (only with `?e2e=1`; seed or read, never act, never navigate)

```ts
seedSortingLevel(level: number): void        // persists level (cleanStreak 0, recent []) for every content language; implemented
getSortingInfo(): SortingInfo | null         // scene.getSortingInfo() while SortingScene is active, else null
```

- `SortingScene.getSortingInfo(): SortingInfo | null` returns `null` when there is no round (stub today).
- `SortingInfo` is defined in `src/games/sorting/types.ts` (re-exported from the scene). All rectangles (`beds[].hit`, `currentItem.hit`) are in
  page CSS px, top-left, converted like `getBuildingHit`: use `gameRectToPageRect` from `src/testing/pageRect.ts` with `game.canvas.getBoundingClientRect()`.
  Tests tap `hit.x + hit.width / 2, hit.y + hit.height / 2` with a real mouse click.
- `ready` is true only when the current flower is in the basket and bed taps are accepted. `currentItem` is null between flowers, during animations and after the round.
- `currentItem.tries` counts bed taps that were not swallowed by the 400 ms lock. `currentItem.hinted` is true after an idle hint fired before the trial was recorded.
- `beds[].count` counts planted flowers of this round (examples excluded). `bloomed` is true exactly when `capacity > 0 && count === capacity`, and stays true for the rest of the round.
- `ruleSwitched` / `rule` flip to `true` / `'size+shape'` after the first placement at L8, and `beds[].accepts` update to size and shape.
- Helpers the tests use (already in `journey.ts`): `getSortingInfo`, `waitForSortingReady`, `seedSortingLevel`, `seedBalanceSec`, `getSpokenLineCount`, `placeCurrentCorrectly`, `tapBed`, `tapRect`, `readStarCount`, `readBalanceSec`, `readStoredSkill`.
- Seeding in tests runs on the map before the building tap: `enterWorldByTap(page, profile, 'number-garden', { beforeEnter })`.

## Test ids (DOM chrome, same as the other games)

`hud-back`, `hud-help`, `prompt-bubble`, `help-card`, `help-card-close`, plus `star-count` and `leisure-balance` from the HUD. Use `RestaurantHud` via
`context.shell.setRestaurantChrome`, `renderPromptBubble` (`context.shell.setPromptBubble`) and `context.shell.showHelp`. Hebrew chrome is RTL; English and French tokens stay LTR (`ltr-isolate`).

## Behaviour the tests pin down (see the spec for the full text)

- **Choreography.** One current flower pops into a central basket below the beds (both orientations). One tap on a bed places it; there is no select step.
  The next flower pops in after the settle. A wrong tap leaves the flower in the basket. Tapping the basket flower wiggles it and repeats the rule line (not a hint).
  A round is 3 placements (`trialsPerRound`); at the end the star count goes up by 1 and the next round starts with empty beds.
- **Wrong tap.** The tapped bed shakes, the matching bed is highlighted, `sorting.wrong.hint.he` is requested, and bed taps are ignored for `WRONG_TAP_LOCK_MS` (400 ms).
  The first wrong tap records the trial's `miss`; later wrong taps and the final correct placement record nothing. Mistakes never change balance or stars.
  Every tap not swallowed by the lock calls `learningSession.reportInteraction()`.
- **Idle hint.** Age 2 only (`hintMode: 'demonstrate'`, `hintDelayMs: 6000`): the flower hops toward its bed and back, the bed pulses, the rule line is requested again,
  `currentItem.hinted` becomes true, and the placement is recorded `assisted`. It waits and retries after another `hintDelayMs` while a line plays or the help card is open. One per trial.
  Age 5 has no idle hint.
- **Rule per round.** `extra.attributes: 1` (L1-L4): one attribute for the whole visit, cycling colour, shape, size across visits; size only at 2-bed levels.
  L5: rounds alternate colour (round 0) and size, `beds = min(choiceCount, values(attribute))` (size rounds show 2 beds). L6-L8: 4 size x colour conjunction beds using 2 of 3 colours.
  L8: after the first placement the colour half becomes shape (size x shape); `switchRule` animation using `ANIM_PROFILE.sorting.ruleSwitch`.
- **Labels and scaffolds.** L1-L3 `label: 'picture'` (rule icon on the plaque and large on the bed); L2-L3 `ghostSlots: true`; L4-L6 `label: 'symbol'` (plaque icon only, two icons at L6);
  L7-L8 `label: 'none'` (blank plaque) with one pre-planted example flower per bed (`example` set, not counted). L8 examples are distinct under both rules.
- **Round composition.** Flowers target at least 2 beds; capacity is the flowers that belong to each bed; non-rule attributes vary per `extra.vary` (at L8, `vary: 2` still means shape varies); items are `<shape>-<color>-<size>`.
- **Tap targets.** Beds and the basket flower are at least 64 CSS px in both orientations; never shrink them (pan or show fewer).
- **Leisure.** Standard learning-session wiring (`reportInteraction`, `reportListening`, `reportCelebrating`, `complete`, `exit`, `tick(1)` each second); `endVisit()` on exit.
- **Motion.** Use `ANIM_PROFILE.sorting` (`drop`, `settle`, `ruleSwitch`) from `src/anim/profiles.ts`. Do not add Phaser imports to that file.

## Voice line ids (device TTS in Pass 1; strings are in the spec voice table)

Hebrew guidance (`lang: 'he'`): `sorting.rule.color.he`, `sorting.rule.shape.he`, `sorting.rule.size.he`, `sorting.rule.two-attr.he` (conjunction rounds),
`sorting.switch.shape.he` (L8 switch), `sorting.correct.he`, `sorting.wrong.hint.he`, `sorting.bed-full.he`, `sorting.help.he`.
Learning tokens in the round language (`en` or `fr`, fixed for the round): `sorting.word.<red|yellow|blue|big|small>.<lang>`; `large` is spoken as `big`.
Colour round: colour word. Size round: size word. Conjunction round (including L8 before the switch): size word, then colour word, as two separate requests. Shape round: no token.
**Team-lead decision (2026-11-13):** after the L8 switch to size × shape, Pass 1 speaks **only** the size token for the remaining flowers. Shape is carried visually by the example flower in each bed; shape words stay in Pass 2. `extra.vary: 2` (shape varies) applies at L8 as well: the three flowers are composed at the start of the round, so shape varies among them.
Round start: the rule line, then (age 2 idle hint) the same rule line again. Do not add `voice-lines-he.json` rows or `audio-manifest.json` entries without a clip and hash (Pass 2).

## Art keys (REFERENCE ONLY: do not merge the art PRs, do not add their SVGs here)

From PR #20 (`origin/feat/art-sorting-suitcase` @ 57c70c5), keys in `src/assets/art/manifest.ts` on that branch:

- Beds: `garden-bed-back`, `garden-bed-front` (520x260). Order: back layer, planted flowers, front layer.
- Rule signs: `rule-sign-post`, `rule-sign-plaque`.
- Rule icons: `rule-icon-color-red`, `rule-icon-color-yellow`, `rule-icon-color-blue`, `rule-icon-shape-tulip`, `rule-icon-shape-daisy`, `rule-icon-shape-round`, `rule-icon-size-small`, `rule-icon-size-large`.
- Flower stems: `flower-stem-small`, `flower-stem-large`.
- Flower blooms: `flower-bloom-{tulip,daisy,round}-{red,yellow,blue}` (9 keys).
- Backgrounds: `number-garden-bg-landscape` (1280x800), `number-garden-bg-portrait` (800x1280).
- Paths as in the spec table (`public/art/props/`, `public/art/flowers/`, `public/art/scenes/number-garden/`).

From PR #42 (`origin/art/sorting-flower-basket`, draft), all three share a 520x400 viewBox:

- `flower-basket` (full single image), `flower-basket-back`, `flower-basket-front`.
- Draw order: back layer, then the flower, then the front layer.
- Paths: `public/art/props/flower-basket.svg`, `flower-basket-back.svg`, `flower-basket-front.svg`.

Until the art lands the scene may draw simple placeholder shapes; the hooks and tests do not depend on the art.

## Not in this step

No gameplay, layout or art loading exists yet. AC-14 (device check) and AC-15 (Pass 2 clips) have no automated tests.

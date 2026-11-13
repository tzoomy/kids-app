# `leisure-colouring` — Colouring Time (`זמן צביעה`)

Status: **approved**
Pass in progress: **1**

**Basic-first rule (applies to this spec).** By default, Pass 1 is a working game with basic animation and device TTS or existing recorded clips only; polish and new recordings come in Pass 2 after the owner approves the finished Pass 1. An explicit owner decision in this spec can override the default for a specific item. (`docs/PROCESS.md` §3, decided by the owner on 2026-11-13.) No item in this spec needs an override.

## Summary

Colouring Time is a **free-time** activity in the Leisure Corner (`leisure-corner`). The child sees a large outlined line-art page (a cute cat, a butterfly, a chef, …), a row of round colour dots along the bottom, and a few tool buttons (undo, clear, previous and next page, back). She taps a colour, then taps inside a closed region of the page, and that region fills with the colour. There is no task, no correct answer, no grading, no stars, and no learning loop. The game **spends** earned leisure time (it never earns), and her picture is saved automatically on the device, so she can come back to it later.

**Decided by the owner (2026-11-13):** the game name is "Colouring Time" / `זמן צביעה`, to stay distinct from the future Art Studio game "Color the World".

It is deliberately different from the future educational Art Studio game "Color the World" (`docs/WORLDS.md`: colour names, optional requests such as "colour the apple red", a local album). That game, its colour-name vocabulary, and its crayon-mixing mechanic are out of scope here.

## Learning goals

This is a play game, so the template's learning goals are play and experience goals. There is no vocabulary lesson, no correct answer, no skill key, and no adaptive level.

- **Age 2:** Calm, immediate cause and effect: touch a place, see it change colour. Large regions only (about 6–10 big body parts per page), a short palette of 8 colours, no way to "fail".
- **Age 5:** The same activity with more to do: fine regions inside the big ones (inner ears, spots, a bow, buttons) and 16 colours, so she can plan a picture. Still no task, no request, and no grading.

## World and why

- **World:** Leisure Corner (`leisure-corner`, `פינת הכיף`).
- **Why this game belongs there:** `docs/WORLDS.md` describes the Leisure Corner as content for free time that spends balance and earns nothing; Bubbles is already there. Colouring Time spends earned leisure, does not earn, and has no lesson. The educational colouring idea (Color the World) stays a separate, later Art Studio game.

## Mechanic

**Round-free play.** There are no rounds. The child chooses a colour, taps regions, and can keep going until she leaves or her leisure time runs out.

- **Colour selection.** One colour is always selected (default `red`). Tapping a swatch selects it. The selected swatch shows a ring and a scale-up (not colour-only) and has `aria-pressed="true"`; all others have `aria-pressed="false"`.
- **Fill.** Tapping inside a closed region of the current page sets that region's colour to the selected colour. If the region already has a colour it is overwritten. If the selected colour already equals the region's colour, nothing changes and no undo step is recorded.
- **No-op taps.** A tap that is not inside a hit-testable region and is more than **20 CSS px** from every hit-testable region is a no-op: no sound, no animation, no undo step, no hint, no message. A tap on an outline, or within 20 CSS px of a hit-testable region, fills the nearest region (see Tap resolution below).
- **No wrong path.** There is no correct answer, no "mistake" feedback, no hint, no stars, and no score. The leisure balance changes only through the timer.
- **Undo.** Reverts the last fill or the last clear. The undo stack lives in memory for the current visit only, cap 50 steps (the oldest step is dropped at 51). A reload keeps fills but not the undo stack. The undo stack belongs to the current page and is emptied on a page change, so undo never changes a page the child cannot see. Undo is disabled (`disabled` attribute) when the stack is empty. **Decided by the owner (2026-11-13):** undo and clear behaviour is as written here (cap 50, visit-only, emptied on a page change; clear is one undoable step with no confirm), the simplest model a 5-year-old can predict, and a toddler cannot lose a picture by accident.
- **Clear.** Resets every region of the current page to paper in one step; it is one undoable step; there is **no confirm dialog**. Clear is a no-op (no undo step) on a page with no fills.
- **Previous / next page.** Steps through the pages in the order in the page table and autosaves the current page. **Decided by the owner (2026-11-13):** previous and next stop at the ends (previous disabled on page 1, next disabled on page 8, no wrap), so a toddler cannot loop by accident.
- **Exit.** `hud-back` autosaves and returns to `MapScene` with the iris transition. After a time-out, see Leisure.
- **Input mode per age:** tap only at both ages. No brush, no drag-to-paint, no bitmap flood fill.
- **HUD chrome:** back (`hud-back`), leisure countdown (`colouring-countdown`), help (`hud-help`), and the tools (`colouring-undo`, `colouring-clear`, `colouring-prev`, `colouring-next`) live in the DOM top bar, like `BubblesHud`. The palette (`colouring-palette`) is a DOM control: a side column in landscape and a bottom bar in portrait (see Layout).

### Fill technique: pre-segmented SVG with a region map (region tint)

Each page is an SVG that is already cut into named, closed regions. A fill sets `fills[regionId] = colorId`; the region is painted with that colour and the outline layer stays on top. It is **not** a canvas flood fill. Reasons:

- **Performance on low-end tablets.** A tap hit-tests a region, not pixels. **Team-lead decision (2026-11-13):** from Gemini's spec review (M1). Hit-test with `Path2D` and `isPointInPath` in viewBox units (at most 20 paths, so O(regions) per tap is trivial). Do **not** sample an anti-aliased canvas id raster: Canvas 2D cannot turn off anti-aliasing for path fills (`imageSmoothingEnabled` only affects scaled images), so edge pixels would blend into ids that do not exist. Unit tests inject a `contains(regionId, x, y)` function. jsdom has no `Path2D` or `getBBox`, so real geometry is covered in the art e2e (AC-33). A flood fill is O(pixels) per tap and risks a frame hitch on an 800×800 page on weak hardware.
- **No leaks and no gaps.** A flood fill from a bitmap stops early or leaks through anti-aliased outline pixels and leaves a pale halo along the line. Closed SVG paths fill exactly; the outlines (stroke 6) are drawn on top and hide the seam.
- **Deterministic tests.** A test taps a known point and asserts `fills['cat-body'] === 'red'`. Flood fill depends on rasterisation and device pixel ratio.
- **Tiny autosave.** The save is a small JSON map `{ regionId: colorId }`, not a PNG. It fits `localStorage`, diffs cleanly, and is isolated per profile.
- **Consistent with the existing convention.** PR #24 (Color the World art) already draws pages as region tints, not flood fills. This game reuses the convention but none of those eight pages and not its crayon mixing.

**Region layering and age tracks.** Each region has `age2: true | false` (coarse or fine) and, for fine regions, a `parent` coarse region.

- A coarse region's path is the **whole** part, including the area under its fine children. Fine regions are drawn on top of their parent (later in the `fills` group). Coarse regions may overlap each other in z-order (for example the lion's head over its mane).
- **Tap resolution** (pure, in `regions.ts`, in viewBox units; 20 CSS px is converted with the current page scale). **Team-lead decision (2026-11-13):** from Gemini's spec review (B1). The region under the finger wins. A tap on an outline or within 20 CSS px of a hit-testable region goes to the nearest region; otherwise nothing happens. In full:
  1. If the point lies inside a hit-testable region path (`Path2D.isPointInPath`, `fill-rule` nonzero), that region wins. If more than one contains the point, the topmost (the last in document / manifest order) wins.
  2. Otherwise, if the point lies on an outline or within **20 CSS px** of a hit-testable region, the nearest such region wins (distance to the path edge). Ties go to the later region in document order.
  3. Otherwise the tap is a no-op.
  Painted paths are never enlarged. `getColouringInfo().regions[].hit` is the painted bounding box in CSS pixels, not an expanded hit box. Only regions hit-testable for the profile's age track are considered.
- **Age 2:** only `age2: true` regions are hit-tested, so a tap on a fine region's area fills its parent coarse region (the owner decision below).
- **Age 5:** all regions are hit-tested; a tap inside a fine region fills the fine region.
- **Decided by the owner (2026-11-13):** age 2 versus age 5 regions use the same SVG for both; age 2 hit-tests only the coarse regions, age 5 can fill the fine ones too.
- **Effective colour of a region** (what is painted) = `fills[region]` if set, else, for a fine region, `fills[parent]` if set, else paper `#FFFDF9`. So colouring the head after an ear is already filled keeps the ear colour, and an untouched fine region shows its parent's colour. The `fills` map stores only explicit fills.
- Eyes, noses, whiskers, and similar details are **outline strokes only** (never regions).

### Autosave

- A separate `localStorage` key per profile: `kids-app-colouring:<profileId>` (the same pattern as `kids-app-adaptive:<profileId>`). **Do not** extend the frozen `ProfileState` or `AppState` in `src/core/storage/schema.ts`, and do not touch `kids-app-state-v2`.
- Schema: `{ v: 1, currentPageId: string, pages: { [pageId]: { [regionId]: colorId } } }`. Only explicit fills are stored; cleared regions are removed from the map.
- Save on every fill, undo, clear, page change, exit (`hud-back`), and time-out. The undo stack is in memory only (cap 50): a reload keeps fills and the current page, not the undo stack.
- Loading is defensive: bad JSON, a wrong `v`, an unknown page id, an unknown region id, or an unknown colour id loads as empty for that part and never throws. The store lives in `src/core/colouring/store.ts` and has no Phaser dependency.
- Isolated per profile: unit tests must prove that writing one profile never changes another's key.
- **Decided by the owner (2026-11-13):** the picture is stored in the separate per-profile key above with `{ regionId: colorId }` maps and no change to `ProfileState`, so the frozen schema stays untouched and each profile's picture is isolated.

### Implementation sketch (for later, not part of this PR)

- `src/games/colouring/ColouringScene.ts`: the Phaser scene (page layout, input, HUD wiring, leisure tick).
- `src/games/colouring/regions.ts`: pure, no Phaser: tap resolution (injected `contains` for unit tests; `Path2D.isPointInPath` at runtime), fill, undo, clear, effective colour, age-track rules.
- `src/core/colouring/store.ts`: autosave, no Phaser.
- `src/content/games/leisure-colouring.json`: pages, region manifest, palettes; a new leisure-game schema in `src/content/schema.ts`.
- `src/ui/picker/…`: the Leisure Corner picker, reusing PR #43's model.
- Tests: `tests/unit/leisure-colouring.*.test.ts` and `tests/e2e/leisure-colouring.spec.ts`.

## Difficulty curve

**Justified exception: there are no levels, no adaptive engine, and no `SkillSession`.** This is a free-time game with no task to scale. Age 2 versus age 5 is a **presentation variant** (palette size and which regions can be filled independently), not a start level. There is no min or max level and no adaptive rules.

- `ColouringScene` and its modules must not import `src/core/adaptive` or `SkillSession`, and no skill key is written to `kids-app-adaptive:<profileId>`.
- **Content schema note.** Today `GameContent` in `src/content/schema.ts` requires an `adaptive` block (levels, rules). Implementation must add a separate **leisure-game content schema** (additively, in `src/content/schema.ts` and `loadContent.ts`) for `src/content/games/leisure-colouring.json` instead of faking levels. The leisure schema holds the page list, the region manifest, the two palettes, and `earnsLeisure: false`, and has no `adaptive` field. The existing learning-game schema and files are not changed. **Decided by the owner (2026-11-13):** add the new leisure-game schema, because faking levels would put false data in a game that has none.

## Leisure

- `earnsLeisure: false`. Colouring never earns leisure time, never awards stars, and never writes `activeSec`, `carry`, or `earnedTodaySec`. There is no `LearningSession`.
- Use `LeisureSession` (`src/core/leisure/leisureSession.ts`) exactly as `BubblesScene` does: a 1 s tick that calls `session.tick(1)` and persists the store, `session.setHidden(document.hidden)` on `visibilitychange` (a hidden tab never spends), and the 5 s grace after the balance reaches 0, then `endedNow`.
- **Low warning** at 30 s remaining (`LOW_BALANCE_WARNING_SEC = 30`, same as Bubbles): the countdown gets the `low` style and the warning line plays once per visit.
- **Entry with `balanceSec === 0`** does not open the game or the picker's game; the map shows the existing `⏳ 0:00` toast, the same as Bubbles today (see Player journey for the picker case).
- **On `endedNow`:** autosave the current page immediately, stop input (taps and tools are ignored), stop audio, play the end line, show the end screen (`colouring-end`) with one Home button. Work is never discarded on time-out. **Decided by the owner (2026-11-13):** a time-out ends with this flow and a single Home button back to the map (no restaurant button; `bubbles.end` is not reused), because the restaurant offer is wrong for a free-time game.
- Balances never mix across profiles (one `ProfileState` per profile, as today). The only thing that spends the balance is the timer; no action in the game, and no mistake (there are none), reduces it.

## Player journey from the map

Profile → tap Leisure Corner on the map → leisure picker → Colouring Time → fill at least one region → `hud-back` → map.

- Map building hit target: `getBuildingHit('leisure-corner')`.
- **Leisure picker (replaces today's direct jump into Bubbles).** **Decided by the owner (2026-11-13):** a two-card picker instead of jumping straight into Bubbles, because the Leisure Corner now holds two games and PR #43 already has the pattern. Modelled on the Language House picker (PR #43): a two-card overlay with `game-picker-bubbles` and `game-picker-leisure-colouring`, and `game-picker-close` (close stays on the map). `leisure-corner` stays `"status": "leisure"`, `"earnsLeisure": false`, and has no `entryGameId`. The picker opens only when `balanceSec > 0`; with 0 balance the map shows the `⏳ 0:00` toast and no picker. After a game, `hud-back` returns to the map, not to the picker.
- **`enterWorldByTap` note.** The shared helper (PR #37) maps `leisure-corner` to `BubblesScene`. Once the picker lands, the helper (or a new `enterLeisureGameByTap`) taps the building and then the card testid. That helper change is a minor change in the implementation PR, and the existing Bubbles tests are updated to tap `game-picker-bubbles`.
- **`AppScreen`:** `'colouring'`. `isSafeToApplyUpdate('colouring')` is `false`.
- **`data-testid`s (frozen at approval):**
  - Shared chrome (PR #37 names): `hud-back`, `hud-help`, `help-card`, `help-card-close`.
  - Picker: `game-picker-bubbles`, `game-picker-leisure-colouring`, `game-picker-close`.
  - Game: `colouring-countdown`, `colouring-page` (a transparent DOM overlay exactly over the fitted square page; it receives the taps and its box is the page box), `colouring-undo`, `colouring-clear`, `colouring-prev`, `colouring-next`, `colouring-palette`, `colouring-swatch-<colorId>` (one per palette colour, `<colorId>` from the palette table).
  - End screen: `colouring-end`, `colouring-end-home`.
  - Disabled tools use the `disabled` attribute, so tests can assert it.
- **Hooks under `?e2e=1`** (seed persisted state or read state only; never a game action, never navigation):
  - Shared (PR #37): `getBuildingHit(worldId)`, `seedBalanceSec(sec)`, `getSpokenLines(since?)`, `getSpokenLineCount()`, plus the helper `enterWorldByTap`.
  - `getColouringInfo()` returns `null` unless `ColouringScene` is active, else this snapshot:

    ```ts
    interface Rect { x: number; y: number; width: number; height: number }
    interface ColouringInfo {
      pageId: string;            // e.g. 'cat'
      pageIndex: number;         // 0-based, display order
      selectedColor: string;     // a colorId, e.g. 'red'
      fills: Record<string, string>; // explicit fills only: regionId -> colorId
      undoCount: number;
      ageTrack: 'age2' | 'age5';
      balanceSec: number;
      inGrace: boolean;
      ended: boolean;            // true after the time-out end screen is shown
      pageRect: Rect;            // the fitted square page, page CSS pixels (same space as getBuildingHit)
      pageSide: number;          // CSS px side of that square; must be >= 680 in both orientations
      regions: Array<{           // only regions hit-testable for this age track
        id: string;
        hit: Rect;               // painted bounding box in CSS pixels, not expanded
        tapPoint: { x: number; y: number }; // a CSS-pixel point guaranteed inside this region's own path
      }>;
    }
    ```

    `tapPoint` exists because the centre of a bounding box can fall inside another region (a fine region over its parent, or a concave shape). Tests click `tapPoint` with a real pointer click, and use `hit` only as the painted bounding box (not a size floor).
  - `seedColouringState({ pageId, fills? })` writes the per-profile autosave key only (`currentPageId`, and the page's `fills`). It does not navigate, change the scene, or touch the balance. Tests call it **before** entering through the map.

## Acceptance criteria

Ids are stable: never renumber or reuse them; strike through a removed one (`~~AC-07~~`). Test titles start with the id, e.g. `test('[AC-04] …', …)`, in `tests/**/leisure-colouring*` files. Wording is adapted to this leisure game: there is no "correct" or "wrong" answer, no level, and no hint.

| ID | Criterion | Pass | Verified by | Orientation | Hooks used |
|---|---|---|---|---|---|
| AC-01 | Full real-tap journey: profile → Leisure Corner building → picker → `game-picker-leisure-colouring` → fill at least one region (`fills` gains the entry) → `hud-back` → map; the game opens only from this world's building | 1 | e2e | both | `getBuildingHit`, `getColouringInfo` |
| AC-02 | Fill: a real tap on a region's `tapPoint` with a colour selected sets `fills[regionId]` to that colour, repaints the region, and plays the fill sound; tapping an already filled region with another colour overwrites it | 1 | e2e | @single-orientation | `getColouringInfo` |
| AC-03 | Far no-op taps never touch the balance: a tap more than 20 CSS px from every hit-testable region changes nothing (no fill, no undo step, no speech, no message), and `balanceSec` only falls by the 1 s timer; a tap on an outline or within 20 CSS px fills the nearest region (AC-29) | 1 | e2e | @single-orientation | `getColouringInfo`, `seedBalanceSec`, `getSpokenLineCount` |
| AC-04 | There is no adaptive engine: the colouring scene and modules do not import `src/core/adaptive` or `SkillSession`, the content JSON has no `adaptive` block and passes the leisure-game schema, and no `kids-app-adaptive:<profileId>` key is written by playing | 1 | unit | @single-orientation | |
| AC-05 | Undo: the last fill and the last clear are each reverted by one undo tap, undo is disabled with an empty stack, the stack caps at 50, and a page change empties it | 1 | e2e | @single-orientation | `getColouringInfo` |
| AC-06 | Palette and age variant (real tap): age 2 shows exactly the 8 age-2 swatches (including `charcoal`, not `white` or `cream`), age 5 the 16 swatches in the palette table (including `grey` and `peach`); tapping a swatch selects it (`aria-pressed`, ring); the default is `red`; every swatch is at least 64 × 64 CSS px | 1 | e2e+seed | @single-orientation | `getColouringInfo` |
| AC-07 | A new age-2 profile gets the age-2 palette, only `age2: true` regions hit-testable, and an age-2 tap on a fine region fills its parent; a new age-5 profile gets the 16-colour palette and all regions hit-testable (pure region logic: hit-test rule, effective colour, parent mapping) | 1 | unit | @single-orientation | |
| AC-08 | Leisure: `earnsLeisure` is false; the colouring session spends only through `LeisureSession` (1 s tick, `setHidden` pauses spending, 5 s grace then `endedNow`); no earning, no stars, no `activeSec` change; one profile's balance and saves never touch another's | 1 | unit | @single-orientation | |
| AC-09 | Content: the 8 pages and their region manifest in `leisure-colouring.json` match the page table in this spec, and each page SVG matches its manifest (same region ids in the `fills` group, same `data-age2` and `data-parent`, closed subpaths, ids unique); palettes match the palette table | 1 | unit | @single-orientation | |
| AC-10 | Voice: the intro line (`colouring.intro.he`) on entry, the help line (`colouring.help.he`) from `hud-help`, `bubbles.lowWarning` once at 30 s remaining, and `colouring.end.he` at time-out each request the right line id and `he` (speech spy); fills and tool taps request no speech | 1 | e2e | @single-orientation | `getSpokenLines`, `getSpokenLineCount`, `seedBalanceSec` |
| AC-11 | Smoke: Colouring Time is playable at `1280x800` and `800x1280`: a fitted square page (side ≥ 680 CSS px), palette, and tools visible without overlap or clipping, a fill works, and a rotation re-layout keeps the fills | 1 | e2e | both | `getBuildingHit`, `getColouringInfo` |
| AC-12 | The game works offline: after the first load, with the network off, the journey opens a page and fills a region | 1 | e2e | @single-orientation | `getBuildingHit`, `getColouringInfo` |
| AC-13 | The parent area stays gated (test runs without `?e2e=1`), and the game itself has no parent controls | 1 | e2e | @single-orientation | |
| AC-14 | Device check on Maor's tablet: touch accuracy on small regions, rotation mid-game, audible device TTS, calm visuals, fill feel | 1 | device | both | |
| AC-15 | Recorded Leda clips exist for every line in the voice table (except the reused `bubbles.lowWarning`, which already has a clip), with matching text hashes | 2 | unit | @single-orientation | |
| AC-16 | Clear: one tap resets every region of the current page to paper as one undoable step, with no confirm dialog; undo restores the previous fills; clear on an empty page records no step | 1 | e2e | @single-orientation | `getColouringInfo` |
| AC-17 | Pages: previous and next move through the 8 pages in the spec order, stop at the ends (the button is disabled; no wrap), and each page shows its own fills; the current page index is autosaved | 1 | e2e+seed | @single-orientation | `getColouringInfo`, `seedColouringState` |
| AC-18 | Autosave (real): after a fill, `hud-back`, and re-entering through the map, the fills and current page are restored; a reload keeps them; undo stack is empty after re-entry; a profile switch shows the other profile's own page and fills | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `getColouringInfo`, `seedColouringState` |
| AC-19 | Autosave (store): the store reads and writes only `kids-app-colouring:<profileId>`, saves `{ v: 1, currentPageId, pages }` on every fill, undo, clear, page change, exit, and time-out; does not modify `ProfileState` or `kids-app-state-v2`; no cross-profile leak; a corrupt or unknown-version value loads as empty without throwing; fills for an unknown region id are dropped | 1 | unit | @single-orientation | |
| AC-20 | Time-out: with `seedBalanceSec` at a few seconds, when the balance reaches 0 and the 5 s grace passes, the page is autosaved, taps are ignored, the end line is requested, and `colouring-end` shows with only `colouring-end-home`; Home returns to the map; the saved fills are still there on re-entry (with new balance) | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedBalanceSec`, `seedColouringState`, `getColouringInfo`, `getSpokenLines` |
| AC-21 | Entry: with a 0 balance the Leisure Corner shows the `⏳ 0:00` toast and opens no picker and no game; with a balance the picker opens, `game-picker-close` closes it and stays on the map; `hud-back` from the game returns to the map, not the picker | 1 | e2e+seed | @single-orientation | `getBuildingHit`, `seedBalanceSec` |
| AC-22 | Tap targets: palette swatches, tool buttons, back, and help are at least 64 × 64 CSS px at both viewports; `getColouringInfo().pageSide` is ≥ 680 CSS px; `regions[].hit` is the painted bounding box and is not expanded; painted paths are never enlarged (region thickness is AC-33) | 1 | e2e | both | `getColouringInfo` |
| AC-23 | Accessibility: the selected swatch has a non-colour indicator; tool buttons have Hebrew `aria-label`s; Hebrew chrome is RTL; with `prefers-reduced-motion: reduce` the fill pulse is skipped and the colour is applied immediately (pure animation values asserted without Phaser) | 1 | unit | @single-orientation | |
| AC-24 | Basic fill animation: the fill pulse is a brightness or alpha flash (about 280 ms, for example opacity 0.7 → 1.0) clipped to the region so colour never goes past the outline; no scale pulse; the knobs are plain numbers, unit-tested without importing Phaser; no particles or splash in Pass 1 | 1 | unit | @single-orientation | |
| AC-25 | Scope guard: no ads, no sharing, no export or print, no cloud album, no purchase, no account, and no outbound network request from the game; the pages, backgrounds, and logic are served locally | 1 | e2e | @single-orientation | `getBuildingHit` |
| AC-26 | Art contract: every **page** SVG meets the page contract (viewBox `0 0 800 800`, `fills` then `outlines` groups, stroke `#3B2A22` width 6, closed fill subpaths, region ids, under 15 KB, no `<text>`, no external references, no rasters). Both **backgrounds** are 1280×800 and 800×1280 scene SVGs: they follow only the general art rules (15 KB cap, no `<text>`, no rasters, no external references) and do not use the page viewBox or the `fills`/`outlines` groups. Region thickness is AC-33. | 1 | unit | @single-orientation | |
| AC-27 | PWA: `'colouring'` is an `AppScreen`, `isSafeToApplyUpdate('colouring')` is false, and a waiting update is deferred while colouring | 1 | unit | @single-orientation | |
| AC-28 | Hooks safety: `getColouringInfo` and `seedColouringState` exist only under `?e2e=1`; the seed hook writes only the autosave key; neither performs a game action or navigates | 1 | unit | @single-orientation | |
| AC-29 | Tap resolution (B1): with an injected `contains(regionId, x, y)`, a point inside a hit-testable path fills that region (topmost if several); a point on an outline or within 20 CSS px of a hit-testable region fills the nearest (ties: later in document order); a point farther away is a no-op; age 2 considers only coarse regions | 1 | unit | @single-orientation | |
| AC-30 | Hit-test implementation (M1): runtime hit-testing uses `Path2D.isPointInPath` in viewBox units and does not sample an anti-aliased canvas id raster; unit tests inject `contains(regionId, x, y)` and never import Phaser; real geometry is covered by AC-33 | 1 | unit | @single-orientation | |
| AC-31 | Layout: at `1280x800` the palette is a vertical side column on the reading-start side (right in RTL; 1 column at age 2, 2 columns of 8 at age 5) and `pageSide` is about 704 CSS px and ≥ 680; at `800x1280` the palette is a bottom bar (1–2 rows) and `pageSide` is ≥ 680; swatches and tools stay ≥ 64 CSS px; a rotation re-layout keeps the fills | 1 | e2e | both | `getBuildingHit`, `getColouringInfo` |
| AC-32 | Art checker, structure (M6 unit): every frozen region id is present in the page SVG as a closed `<path>` in the `fills` group, in manifest order, with the specified `data-age2` / `data-parent`; the root is `viewBox="0 0 800 800"` and its only children are `g#fills` then `g#outlines`; no `transform` on `fills` or above; each `d` closes every subpath; no `<text>`, `<image>`, `<use>`, `<style>`, `<filter>`, gradient, `<pattern>`, `href`, or `url(`; each file is under 15 KB | 1 | unit | @single-orientation | |
| AC-33 | Art checker, geometry (M6 browser, `tests/e2e/leisure-colouring.art.spec.ts`): each page is rendered at 800×800 (1 CSS px = 1 viewBox unit) and checked for (1) an inscribed disc of diameter ≥ 76 units in every coarse region's visible area on the age-2 track, and ≥ 48 units in every region's visible area on the age-5 track; (2) sample-point hit-tests under the AC-29 rule (inside a path, on an outline, within 20 px, and far no-op); (3) no gaps (after painting fills and outlines, a flood fill from the border leaves no unreached pixel that is not fill or outline), seams (a region-id change has an outline pixel within 3 px), fine-inside-parent containment, and matching `nonzero` / `evenodd` pixel counts. Writes an id-map PNG per page and track as a test artifact (not committed) | 1 | e2e | @single-orientation | |
| AC-34 | Lazy load: the 8 colouring pages and 2 backgrounds load when Colouring Time opens, never at boot in `PreloadScene`; the boot art manifest (`ART_MANIFEST` in `src/assets/art/manifest.ts`, queued by `PreloadScene`) excludes the colouring keys (`colouring-page-*`, `leisure-colouring-bg-*`); no request for a colouring page or background is made before the game is entered | 1 | unit, e2e | @single-orientation | |

## Art, animation, and audio

Paths, keys, ids, and line ids below are frozen at approval so Gemini can start immediately (`docs/PROCESS.md` §2). Adding a page, adding or renaming a region, or changing a colour id is a spec change, except where a team-lead decision below already updates them or allows Gemini to merge thin regions that fail the checker and then update the ids in this spec. Style: `docs/ANIMATION.md`.

### Pass 1 — working game

**Asset paths and manifest keys** (British spelling, so nothing collides with PR #24's `public/art/coloring/`):

| Asset | Path | Manifest key (`src/assets/art/colouringManifest.ts`) |
|---|---|---|
| 8 colouring pages | `public/art/colouring/pages/<pageId>.svg` | `colouring-page-<pageId>` |
| Landscape background (1280×800) | `public/art/scenes/leisure-colouring/bg-landscape.svg` | `leisure-colouring-bg-landscape` |
| Portrait background (800×1280) | `public/art/scenes/leisure-colouring/bg-portrait.svg` | `leisure-colouring-bg-portrait` |

**Team-lead decision (2026-11-13):** the colouring pages (the eight 800×800 SVGs plus the two backgrounds) load when Colouring Time opens, never at boot in `PreloadScene`. The keys above are listed in a colouring-only art manifest that `ColouringScene` (or its loader) queues on entry; they must **not** be added to the boot `ART_MANIFEST` in `src/assets/art/manifest.ts`. (The table header names that file only as the existing key registry pattern; the boot list stays free of colouring assets.) Unit: the boot manifest excludes the colouring keys (AC-34). E2E: no colouring page or background request is made before the game is entered (AC-34).

**Team-lead decision (2026-11-13):** from Gemini's spec review (B3). The colouring **page** is a square 800×800 SVG. It is drawn inside the 1280×800 (landscape) and 800×1280 (portrait) **scene** backgrounds. The backgrounds are a simple, calm desk or paper table, original only, with an empty centre where the page sits. They do not use viewBox `0 0 800 800` or the `fills`/`outlines` groups; AC-26 is scoped accordingly. The page itself carries a paper rectangle (`#FFFDF9`) when letterboxed. Palette dots and tool buttons are procedural or DOM in Pass 1 (no crayon SVGs). Crayon art and fill-burst polish are Pass 2.

**SVG contract (pages).**

- Warm paper; dark-brown outline `#3B2A22`; **stroke-width 6** in viewBox units; `stroke-linecap` and `stroke-linejoin` `round`; no heavy gradients or filters, no `<text>`, no external references, no rasters; do not copy characters, art, or audio from inspiration apps.
- Each file under the existing **15 KB** hard cap (`tests/unit/artAssets.test.ts`); aim under 6 KB (`docs/ANIMATION.md`). If a page will not fit, simplify the regions; do not raise the cap.
- **viewBox `0 0 800 800`** (square), so the page letterboxes cleanly in both orientations. These are flat colouring pages: do not use the character-rig 400×480 feet-origin space, do not add pages to `ANIMAL_KINDS` or `CHARACTER_RIGS`, and do not build a puppet rig. **Decided by the owner (2026-11-13):** the square 800×800 viewBox is kept, so each page letterboxes cleanly in both orientations.
- Required structure:

  ```xml
  <svg xmlns="http://www.w3.org/2000/svg" viewBox="0 0 800 800" width="800" height="800">
    <g id="fills" stroke="none">
      <path id="<pageId>-<part>" data-age2="true|false" data-parent="<coarseRegionId, fine regions only>" fill="#FFFDF9" d="…closed path…"/>
    </g>
    <g id="outlines" fill="none" stroke="#3B2A22" stroke-width="6" stroke-linecap="round" stroke-linejoin="round">
      <!-- outline paths, may be open strokes; a tap on an outline snaps to the nearest region (B1) -->
    </g>
  </svg>
  ```

- Region ids are `{pageId}-{part}`, kebab-case, unique in the file, stable. Every `fills` path is a **closed** subpath (ends with `Z`). Coarse regions have `data-age2="true"` and no `data-parent`; fine regions have `data-age2="false"` and a `data-parent` naming a coarse region on the same page. Document order is z-order: parents before their fine children.
- "Left" and "right" in ids are as seen on the page (the viewer's left and right).
- **Minimum region thickness.** **Team-lead decision (2026-11-13):** from Gemini's spec review (B2). Measure an inscribed circle (or an equivalent distance transform) on the *visible* area of the path — the path minus every later region that covers it, and minus the 6-unit outline — not the bounding box (a thin curved tail can still have an 80×80 box). In the 800×800 viewBox:
  - **Age-2 track:** fine regions count as part of their parent. Every coarse region's visible area contains a disc of diameter **≥ 76 units**.
  - **Age-5 track:** every region's visible area, including a coarse rim around its fine children (for example `ear-left` around `ear-inner-left`), contains a disc of diameter **≥ 48 units**.
  - **Layout guarantee:** the fitted page side is **≥ 680 CSS px** at both `1280×800` and `800×1280`, so 76 units ≥ 64 CSS px and 48 units ≥ 40 CSS px. Tap snapping (B1 step 2) covers the rest. Painted paths are never enlarged.
- Region counts: each page has 6–10 coarse regions and 12–20 regions in total.
- Previews show each page blank and with a sample fill. No character rig.

**Frozen page and region manifest.** Display order is the table order. `A2` = coarse (`age2: true`). Fine regions list `(parent)`. This list is the source of truth for `src/content/games/leisure-colouring.json` and for tests; a unit test (AC-09) checks every SVG against it, so nobody scrapes SVGs ad hoc. Region ids below drop the `{pageId}-` prefix to save space; the real id is, e.g., `cat-body`.

| # | pageId | Coarse regions (`age2: true`) | Fine regions (`age2: false`, parent) | Total |
|---|---|---|---|---|
| 1 | `cat` | body, head, ear-left, ear-right, tail, paw-left, paw-right, cushion | ear-inner-left (ear-left), ear-inner-right (ear-right), muzzle (head), belly (body), stripe-back (body), bow (body) | 14 |
| 2 | `dog` | body, head, ear-left, ear-right, tail, paw-left, paw-right, bone | muzzle (head), eye-patch (head), collar (body), belly (body), spot-back (body) | 13 |
| 3 | `rabbit` | body, head, ear-left, ear-right, tail, paw-left, paw-right, carrot | ear-inner-left (ear-left), ear-inner-right (ear-right), muzzle (head), belly (body), carrot-leaves (carrot) | 13 |
| 4 | `bear` | body, head, ear-left, ear-right, arm-left, arm-right, foot-left, foot-right, honey-pot | ear-inner-left (ear-left), ear-inner-right (ear-right), muzzle (head), belly (body), honey-label (honey-pot) | 14 |
| 5 | `panda` | body, head, ear-left, ear-right, arm-left, arm-right, foot-left, foot-right, bamboo | eye-patch-left (head), eye-patch-right (head), muzzle (head), belly (body), bamboo-leaf (bamboo) | 14 |
| 6 | `lion` | mane, head, body, ear-left, ear-right, tail, paw-left, paw-right | muzzle (head), ear-inner-left (ear-left), ear-inner-right (ear-right), tail-tuft (tail), belly (body) | 13 |
| 7 | `butterfly` | body, head, wing-upper-left, wing-upper-right, wing-lower-left, wing-lower-right, flower, leaf | spot-upper-left (wing-upper-left), spot-upper-right (wing-upper-right), spot-lower-left (wing-lower-left), spot-lower-right (wing-lower-right), band-upper-left (wing-upper-left), band-upper-right (wing-upper-right), flower-centre (flower) | 15 |
| 8 | `chef` | hat, head, jacket, arm-left, arm-right, trousers, shoe-left, shoe-right, pot | hat-band (hat), apron (jacket), scarf (jacket), pot-lid (pot) | 13 |

Typings (the JSON must satisfy these; exact names are for the implementer to place in `regions.ts` / the schema):

```ts
interface ColouringRegionDef { id: string; age2: boolean; parent?: string } // parent only when age2 is false
interface ColouringPageDef { id: string; regions: ColouringRegionDef[] }     // order = z-order
// leisure-colouring.json: { id: 'leisure-colouring', earnsLeisure: false,
//   pages: ColouringPageDef[] (8, in the table order),
//   palettes: { age2: string[]; age5: string[] } }
```

**Decided by the owner (2026-11-13):** these 8 original pages ship in Pass 1 in this order, with these frozen region lists (a region added later is a spec change).

**Team-lead decision (2026-11-13):** from Gemini's spec review (M5). Drop the chef's `button-top` and `button-bottom` regions (draw those buttons as outline-only details, like the eyes). The chef page has 13 regions, still within the 12–20 range. Gemini may thicken or merge thin regions wherever the art checker (AC-33) fails, and updates the ids in this spec when it does.

The butterfly is the kiosk reference and also a profile avatar; the chef is a kitchen character the girls already know. Both are drawn fresh as flat line art; no existing asset is reused. The pages are by Gemini and original; none of PR #24's eight object pages (apple, house, fish, flower, car, sun, tree, balloon) is reused.

**Palette (colour ids).** Round dots, procedural. Hex values come from `src/assets/colors.ts` `PALETTE` where one exists; new ids are added additively.

| colorId | Hex | Age 2 | Age 5 | Source |
|---|---|---|---|---|
| `red` | `#E2554F` | yes | yes | `PALETTE.red` |
| `orange` | `#FF9F43` | yes | yes | `PALETTE.orange` |
| `yellow` | `#FFD93D` | yes | yes | `PALETTE.yellow` |
| `green` | `#6BCB77` | yes | yes | `PALETTE.green` |
| `blue` | `#4D96FF` | yes | yes | `PALETTE.blue` |
| `purple` | `#9B5DE5` | yes | yes | `PALETTE.purple` |
| `pink` | `#FF6FB5` | yes | yes | `PALETTE.pink` |
| `charcoal` | `#6B6662` | yes | yes | new (light enough that the `#3B2A22` outline still shows) |
| `brown` | `#A97155` | no | yes | `PALETTE.brown` |
| `red-light` | `#F4908C` | no | yes | new |
| `red-dark` | `#A93A36` | no | yes | new |
| `blue-light` | `#9CC3FF` | no | yes | new |
| `blue-dark` | `#2F67C2` | no | yes | new |
| `green-light` | `#A8E6AE` | no | yes | new |
| `grey` | `#A7A39F` | no | yes | new |
| `peach` | `#F6C59B` | no | yes | new (for faces, for example the chef) |

Swatch order is the table order. Default selected colour: `red`. The counts stay **8** at age 2 and **16** at age 5.

**Decided by the owner (2026-11-13):** palette sizes and colours are 8 dots at age 2 and 16 at age 5, as in the table (the kiosk's "about 20" is a ceiling; 16 keeps 64 px dots in one or two rows).

**Team-lead decision (2026-11-13):** from Gemini's spec review (M3). Replace `white` and `cream` (too close to the paper `#FFFDF9`) with `charcoal` `#6B6662` and `grey` `#A7A39F`, so a panda can be coloured and a tap is visible. The age-2 set of 8 includes `charcoal` (in place of `brown` on that track; `brown` stays in the age-5 16). Add `peach` `#F6C59B` to the age-5 16. To keep the count at 16, `teal` and the paper-like `white` / `cream` are not in the palette.

**Layout (both orientations).** The fitted square page is centred. The tools sit in the top bar. The layout is recomputed on rotation; fills persist.

**Team-lead decision (2026-11-13):** from Gemini's spec review (M4 / layout). In landscape (`1280×800`) the palette is a vertical column on the reading-start side (the right in RTL): 1 column at age 2, 2 columns of 8 at age 5. That leaves a page side of about **704 CSS px**. In portrait (`800×1280`) the palette stays a bottom bar of 1–2 rows. In both orientations the fitted page side is **≥ 680 CSS px**. Swatches never shrink below 64 CSS px.

Tap targets: **Decided by the owner (2026-11-13):** minimum tap-target size is 64 CSS px for swatches and tools (a 112 px palette would not fit 16 colours in two rows on a portrait tablet; the page regions are large at age 2), and a visually larger swatch of at least 72 px where space allows. Never shrink below 64. (`docs/ARCHITECTURE.md` says about 64 px and up; the art reviews proposed 112 CSS px.) Region hit boxes are no longer expanded; thickness and the 680 px page (B2) plus snap-to-nearest (B1) provide the 64 px target instead.

**RTL.** Hebrew chrome (back, countdown, help, end screen, tool labels) is RTL and reuses the shell and HUD pattern of `BubblesHud` (top bar, `hud-back`, countdown) with a dedicated `colouring-countdown`. No English or French tokens appear in Pass 1.

**Chrome strings** (Hebrew, kid-facing; add as a `colouring` block in `src/content/i18n/he.json`):

| Key | Text | Used for |
|---|---|---|
| `colouring.title` | `זמן צביעה` | picker card label, end screen title |
| `colouring.undo` | `ביטול` | `aria-label` of `colouring-undo` |
| `colouring.clear` | `ניקוי` | `aria-label` of `colouring-clear` |
| `colouring.prev` | `הדף הקודם` | `aria-label` of `colouring-prev` |
| `colouring.next` | `הדף הבא` | `aria-label` of `colouring-next` |
| `colouring.endTitle` | `זמן הצביעה נגמר` | end screen title |
| `colouring.endMessage` | `הציור שלך שמור. נתראה בפעם הבאה!` | end screen text |
| `colouring.goHome` | `בית` | `colouring-end-home` |

**Animation (Pass 1).** **Team-lead decision (2026-11-13):** from Gemini's spec review (M2). The fill pulse must not push colour past the outline. Pass 1 uses a brightness or alpha flash on the filled region (basic tween, about 280 ms, for example opacity 0.7 → 1.0), **clipped to the region path**, and does **not** scale the fill (a 1.04 scale would spill about 12 viewBox units past the line and cover neighbours). The profile knobs are plain numbers in a new `ANIM_PROFILE.colouring` key in `src/anim/profiles.ts` (additive), for example `{ fill: { durationMs: 280, flashFrom: 0.7 } }`, with a pure helper for the keyframes, unit-tested without importing Phaser. If `ANIM_PROFILE.color` from PR #24 has merged, reuse only knobs that do not scale past the outline. With `prefers-reduced-motion`, skip the pulse and apply the colour at once (`motion.ts` factor). No fill-burst or splash particles in Pass 1. Painting uses rasterised textures redrawn only when a fill changes, never per frame.

**Audio (Pass 1).** Device TTS through `AudioManager.play({ lineId, lang, text })`, plus existing recorded clips where the text already fits. Existing soft SFX (`sfx.pop()` on a fill; the existing tap or pop sound on tool buttons) is enough. No colour-name teaching lines in Pass 1 (this is not a language game). Feminine singular Hebrew. **Decided by the owner (2026-11-13):** voice in Pass 1 is device TTS for the three new lines, the existing `bubbles.lowWarning` clip for the 30 s warning, no colour-name lines, and recorded Leda clips only in Pass 2.

**Voice table:**

| lineId | lang | Text | Trigger |
|---|---|---|---|
| `colouring.intro.he` | `he` | `זמן צביעה! בחרי צבע ולחצי על הציור.` | Scene entry, once per visit |
| `colouring.help.he` | `he` | `בחרי צבע, ואז לחצי על חלק בציור כדי לצבוע אותו. אפשר לבטל, לנקות ולעבור לדף הבא. הציור נשמר.` | `hud-help` tap |
| `bubbles.lowWarning` (existing, reused as is) | `he` | `עוד קצת זמן!` | Once when 30 s of balance remain |
| `colouring.end.he` | `he` | `זמן הצביעה נגמר. הציור שלך שמור. נתראה בפעם הבאה!` | Time-out (`endedNow`), before the end screen |

Do not reuse `bubbles.end` (its text offers to visit the restaurant, which is wrong here). Do not add rows to `voice-lines-he.json` or `audio-manifest.json` for the new ids without a clip and its text hash (Pass 2); in Pass 1 the new lines are device TTS only.

**World and PWA wiring.**

- `src/content/worlds.json`: `leisure-corner` stays `"status": "leisure"`, `"earnsLeisure": false`, no `entryGameId`.
- `MapScene`: the leisure branch opens the picker (when `balanceSec > 0`) instead of jumping to `BubblesScene`; the picker follows PR #43's pattern and starts `BubblesScene` or `ColouringScene`.
- `src/pwa/updatePolicy.ts`: add `'colouring'` to `AppScreen`; `isSafeToApplyUpdate('colouring')` is `false`.
- Precache: the 8 pages and 2 backgrounds are local assets, so they are precached with the rest of the app and the game works offline.

### Pass 2 — polish

- Richer fill animation: a short burst or splash on a fill, a gentle idle shimmer on the selected swatch, optional crayon art for the palette and tools.
- Recorded Gemini TTS clips (voice Leda) for every line in the voice table (`colouring.intro.he`, `colouring.help.he`, `colouring.end.he`), rendered with `scripts/tts/generate_voice.py`; device TTS stays the fallback. Do not add `voice-lines-he.json` entries or `audio-manifest.json` rows without the clip and its text hash.
- Only after the owner approves the finished Pass 1.

## Out of scope

- Pass 2 polish and any new Leda recordings in Pass 1.
- Color the World, the Art Studio, PR #24's eight pages, and crayon mixing.
- Canvas flood fill, freehand or brush painting, and drag-to-paint.
- The adaptive engine, levels, stars, and any learning loop or colour-name curriculum.
- More than 8 pages, user-made pages, photos, and stickers.
- Sharing, ads, print or export, a cloud album, purchases, and accounts.
- Parent controls inside the game (the parent area stays separate and gated).
- Any install, config, CI, or `ProfileState` change.

## Open decisions for the owner

All open decisions were resolved by the owner on 2026-11-13.

- **Decided by the owner (2026-11-13):** Game name is "Colouring Time" / `זמן צביעה`, to stay distinct from the future Art Studio game "Color the World".
- **Decided by the owner (2026-11-13):** A two-card Leisure Corner picker (Bubbles and Colouring Time) instead of jumping straight into Bubbles, copied from the Language House picker (PR #43), because the Leisure Corner now holds two games and the pattern already exists.
- **Decided by the owner (2026-11-13):** Palette sizes and colours are 8 dots at age 2 and 16 at age 5, from the palette table (the kiosk's "about 20" is a ceiling; 16 keeps 64 px dots in one or two rows).
- **Decided by the owner (2026-11-13):** Minimum tap-target size is 64 CSS px (swatches and tools), because 112 px would not fit the age-5 palette. **Team-lead decision (2026-11-13):** shapes are drawn thick enough (B2) and a tap snaps to the nearest region (B1); there is no hit-box growth.
- **Decided by the owner (2026-11-13):** Which pages ship in Pass 1: 8 original pages in this order: `cat`, `dog`, `rabbit`, `bear`, `panda`, `lion`, `butterfly`, `chef`, with the frozen region lists above.
- **Decided by the owner (2026-11-13):** Previous and next stop at the ends (disabled, no wrap), so a toddler cannot loop by accident.
- **Decided by the owner (2026-11-13):** Undo and clear behaviour: undo covers the last fill or clear, cap 50, in memory for the visit only and emptied on a page change; clear is one undoable step with no confirm dialog.
- **Decided by the owner (2026-11-13):** How a time-out ends: autosave, end line, then an end screen with a single Home button back to the map (no restaurant button; `bubbles.end` is not reused).
- **Decided by the owner (2026-11-13):** Where the picture is stored: a separate per-profile `localStorage` key `kids-app-colouring:<profileId>` with `{ regionId: colorId }` maps, and no change to `ProfileState`.
- **Decided by the owner (2026-11-13):** Age 2 versus age 5 regions: the same SVG; age 2 hit-tests only the coarse regions (a tap on a fine area fills the parent), age 5 can fill the fine regions too.
- **Decided by the owner (2026-11-13):** Voice in Pass 1 is device TTS for the three new lines, reuse the existing `bubbles.lowWarning` clip for the 30 s warning, no colour-name lines, and recorded Leda clips only in Pass 2.
- **Decided by the owner (2026-11-13):** The square 800×800 viewBox is kept (not the 400×480 rig space), so pages letterbox cleanly in both orientations.
- **Decided by the owner (2026-11-13):** A new leisure-game content schema is added, with no dummy `adaptive` block, because faking levels would put false data in a game that has none.

The owner decisions above stand. The team-lead decisions of 2026-11-13 from Gemini's spec review refine layout, hit-testing, thickness, the palette ids, and the chef region list; they are recorded in the body and in the Changelog, and do not need owner re-approval.

## Changelog

- `2026-11-13` — created — substantive
- 2026-11-13 — approved by the owner; all 13 team-lead proposals accepted (game name, leisure picker, palette, 64 CSS px targets, 8 pages, prev/next stop at ends, undo/clear, time-out Home button, per-profile autosave key, age-2/age-5 regions, Pass 1 voice, 800×800 viewBox, leisure-game schema); 0 ACs added — substantive
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (B1). The region under the finger wins; a tap on an outline or within 20 CSS px of a region goes to the nearest region; otherwise nothing happens (AC-29). — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (B2). Thickness is an inscribed circle (visible area) of at least 76 units for coarse regions and at least 48 for fine ones; the page renders at 680 CSS px or more. — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (B3). The page is 800×800 inside the 1280×800 / 800×1280 scenes; AC-26 applies the page contract only to the pages. — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (layout / M4). Landscape uses a side-column palette with a page of about 704 CSS px; portrait keeps the bottom row (AC-31). — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (M1). Hit-test with `Path2D.isPointInPath` on the region paths, not by sampling anti-aliased canvas pixels (AC-30). — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (M2). The fill pulse must not push colour past the outline: a clipped brightness/alpha flash, no scale (AC-24). — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (M3). Replace `white` and `cream` with `charcoal` and `grey`; the age-2 set of 8 includes `charcoal`; add `peach` to the age-5 16. Counts stay 8 and 16 (AC-06). — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (M5). Drop the chef's button regions. Gemini may thicken or merge thin regions wherever the checker fails, and updates the ids in this spec when it does. — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** from Gemini's spec review (M6). An automatic art checker: unit test for ids, closed paths, and structure (AC-32); browser check for inscribed-circle thickness and sample-point hit-tests (AC-33). — non-substantive (status stays **approved**)
- 2026-11-13 — **Team-lead decision (2026-11-13):** the colouring pages (8 at 800×800 plus 2 backgrounds) load when the colouring game opens, never at boot in `PreloadScene` (AC-34). — non-substantive (status stays **approved**)
- 2026-11-13 — Pass in progress set to 1 with the failing Pass 1 unit and real-tap e2e tests (branch test/leisure-colouring-pass1). — non-substantive (status stays **approved**)

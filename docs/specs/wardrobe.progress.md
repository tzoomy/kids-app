# wardrobe — progress

Spec: `docs/specs/wardrobe.md` (draft, **Pass 2 in progress**). Branch `feat/wardrobe-pass2` (from main after Pass 1, #86).

## Pass 2 — RED session (2026-11-14): tests and docs only, no production code

Goal: the bear wears the current profile's outfit on the map (new decorative mascot) and in learning games (Animal Restaurant, Who's Hiding?), through `Character.setAccessories`. Bear only. All defaults are pending Maor decision (spec Open decisions, `docs/PENDING-DECISIONS.md` 2026-11-14 row).

### Tests added (all RED today)

- `tests/unit/wardrobe.dress.test.ts` (AC-17): imports the intended `src/core/wardrobe/dress.ts` (missing, so the file fails to resolve): `wearsOutfit`, `outfitPlacements`, `outfitArtEntries`, `currentOutfitItems`, `dressCharacter`. Uses structural fakes for the scene and character (no Phaser).
- `tests/unit/wardrobe.dressSites.test.ts` (AC-17): source contract. `MapScene`, `RestaurantScene` and `HidingScene` import `core/wardrobe/dress` and call `dressCharacter` and `currentOutfitItems`; `MapScene` spawns a `bear` Character and still opens `WardrobeScene` once (HUD button only); Orchestra, Colouring and Bubbles do not dress; `dress.ts` calls `layoutOutfit` and has no runtime Phaser import.
- `tests/e2e/wardrobe.pass2.spec.ts`: AC-14 (both orientations: seeded outfit on the map bear, no overlap with buildings, tapping the bear does nothing, then Animal Restaurant bear by real taps), AC-15 (@single-orientation: Wardrobe change shows on return), AC-16 (@single-orientation: profile a, b, a).
- `tests/e2e/helpers/journey.ts`: new `seedWardrobeStateForProfile`, `getVisibleBearOutfits`, `seedRestaurantKind`, `waitForBearOutfit`, `VisibleBearOutfit`, `tapBuildingOnMap` (split out of `tapWorldBuilding`, behaviour unchanged), and `JourneyOptions.beforeProfileTap` (runs on the profile-select screen).
- `scripts/affected-e2e.mjs` wardrobe rule: adds `src/worlds/mapBear.ts` and the new spec; `tests/unit/affectedE2e.test.ts` updated (wardrobe sources select both wardrobe specs; a changed wardrobe spec selects itself; `MapScene.ts` and `Character.ts` stay off the wardrobe rule, `MapScene.ts` still selects smoke only).

### WIP note (2026-11-14, Claude Code 5-hour limit)

The GREEN session started and wrote `src/core/wardrobe/dress.ts` (the AC-17 helper, including a `listDressedBears` registry for the future hook). The 12 unit tests in `wardrobe.dress.test.ts` now pass. The session then hit the Claude Code 5-hour limit (resets 16:50 Asia/Jerusalem) and stopped. Still missing: `src/worlds/mapBear.ts`, MapScene / RestaurantScene / HidingScene call sites, and the three `?e2e=1` hooks (`seedWardrobeStateForProfile`, `getVisibleBearOutfits`, `seedRestaurantKind`). `wardrobe.dressSites.test.ts` still has 4 failing contract tests (the four guard tests and the dress.ts Phaser-free test pass). E2E has not been run. Resume GREEN from this list; do not weaken the tests.

### Pending for GREEN (next session)

1. `src/core/wardrobe/dress.ts` with the API above. `dressCharacter(scene, character, kind, items)` for the bear: `layoutOutfit`, build each image like `WardrobeScene.makeImage` (`scene.make.image({ key, x: left + originX, y: top + originY, add: false })`, `setOrigin(pivot)`, `setScale`, `setAngle`, `setFlipX`; never `setInteractive`), skip items whose texture is missing, call `character.setAccessories` (always for the bear, so stale accessories are cleared; not at all for other kinds), return the mounted ids in draw order.
2. `src/worlds/mapBear.ts` and a call in `MapScene`: a decorative bear Character that overlaps no building hit target in both orientations and has no pointer handler. Read the outfit with `currentOutfitItems(window.localStorage, profileId, context.currentAgeTrack())` when the map is created; lazy-load only `outfitArtEntries(...)` (`queueArtManifest` + `load.start`, then re-dress when it completes; guard for a destroyed scene).
3. `RestaurantScene` and `HidingScene`: call the helper right after constructing a Character whose kind is the bear (`wearsOutfit` gates it). Keep the outfit visible during animations.
4. Hooks in `src/game/createGame.ts` (`?e2e=1` only): `seedWardrobeStateForProfile(profileId, seed)`, `getVisibleBearOutfits()` (see gotchas), `seedRestaurantKind(kind)` (one-shot override consumed by `RestaurantScene.pickKind`; it must also reset `lastKind` logic sanely). Add `VisibleBearOutfit` to `src/games/wardrobe/wardrobeTypes.ts` (the helper file currently declares it; move it and re-export).
5. Run `npm run check:ac`, unit tests, then the two wardrobe e2e specs on a private port (4311), both orientations for AC-14.

### Gotchas

- `getVisibleBearOutfits` must read what is **mounted** on the bear Characters (Character-tracked applied ids, or the head/breath containers' accessory images), not `getWardrobeInfo().rendered`: that is computed from the saved state even when nothing is drawn, and would give a false green. A bear with no outfit still needs an entry with `items: []` (AC-15 waits for the undressed map bear first). Include `rect` (page px) for the map bear; AC-14 uses it for the no-overlap and tap-does-nothing checks.
- Seed before the profile tap: `seedWardrobeState` needs the active profile, and `enterMapByTap`'s `beforeEnter` runs after the map exists. AC-14 and AC-16 use `beforeProfileTap` with `seedWardrobeStateForProfile`.
- Switching profile: the map must rebuild or redress for the new profile (AC-16); do not cache the outfit across profiles.
- `seedRestaurantKind('bear')` is called on the map; the next Restaurant round (the first customer after entering) must be the bear. Its `pickKind` currently excludes `lastKind`; a fresh scene has none.
- Art loads lazily: the e2e helper `waitForBearOutfit` polls up to 15 s for the accessories to appear.
- Keep `src/worlds/MapScene.ts` and `src/anim/Character.ts` off the wardrobe affected-e2e rule (unit-pinned); put new map code in `src/worlds/mapBear.ts` (listed).
- "Pass 2" here means the outfit-in-the-world pass; `docs/PROCESS.md` §3 uses Pass 2 for polish. The spec asks Maor to confirm the naming.
- Executor: use the uncommitted local Playwright config on private port 4311; do not edit `playwright.config.ts`.

## Pass 1 (merged, #86)

### Done

RED session (2026-11-14): spec, unit tests (`tests/unit/wardrobe.{model,store,layout,wiring}.test.ts`), e2e (`tests/e2e/wardrobe.journey.spec.ts` plus helpers in `tests/e2e/helpers/journey.ts`), affected-e2e rule, PENDING row.

GREEN session (2026-11-14), implementation:

- `src/core/wardrobe/model.ts`: pure immutable unlock and equip model, `UNLOCK_RULES`.
- `src/core/wardrobe/store.ts`: `kids-app-wardrobe:<profileId>` load, save (sanitised both ways), `recordRoundAndSave`.
- `src/core/wardrobe/layout.ts`: `layoutOutfit`, `slotAnchor`, bands `behindHead` / `head` / `front`.
- `AppContext.recordCompletedRound(worldId, gameId)` (browser localStorage, yay only on a new unlock, unlock toast, `lastWardrobeUnlock`); called next to `session.complete()` in the eight learning games (Restaurant, Orchestra, Letter Monster, Sorting, Balloon, Hiding, Seed to Flower, Potion). Bubbles and Colouring (Leisure Corner) are not hooked.
- `WardrobeScene` (`src/games/wardrobe/`), `wardrobeTypes.ts`, `wardrobeInfo.ts` (pure snapshot and seed helpers), `src/ui/wardrobeChrome.ts` (item buttons, back button, unlock toast), `AppShell.setWardrobeChrome / updateWardrobeChrome / showWardrobeUnlockToast` (the toast has its own `shell-toast-root`, so chrome repaints never remove it).
- `wardrobe-btn` in `renderMapChrome` (`onWardrobe` option, wired in `MapScene` with a fade transition); `'wardrobe'` in `AppScreen` (unsafe for mid-screen updates) plus a case in `tests/unit/pwaUpdatePolicy.test.ts`.
- `Character.setAccessories(...)`: a small hook that mounts accessory images between body and head, in the head group, or in front.
- Hooks under `?e2e=1` in `createGame.ts`: `seedWardrobeState`, `getWardrobeInfo` (works on the map), `recordCompletedRound`.
- Hebrew strings under `wardrobe` in `src/content/i18n/he.json`; CSS under `.wardrobe-*` in `src/styles/shell.css`.

### Out of scope in Pass 1 (as in the spec)

- The outfit is drawn only in the Wardrobe (no outfit on map or game characters): **moved into Pass 2 above.**
- Bear only; no character switch. The layout helper already supports every fitted kind.
- Single-image fallback rig (no head group): head items are not drawn there. Layered bear art is the normal path.
- No spoken item names, no Art Studio.

### Gotchas for the e2e run

- `rendered` and `worn` in `getWardrobeInfo` come from the pure layout of the saved state, not from the Phaser display list, so tests do not depend on the SVG load finishing. The accessory images appear once the lazy art load completes.
- `getWardrobeInfo` returns null only before a profile is picked.
- Item buttons are DOM (`wardrobe-item-<id>`, `data-locked`, `data-worn`), 88 px, wrapping along the bottom edge (max 40% of the height, scrolls beyond that).
- The unlock toast is `wardrobe-unlock-toast` with `data-items`; it removes itself after 3 s.
- Offline (AC-10): `public/art/wardrobe/*.svg` must be in the service-worker precache; check this first if AC-10 fails.
- `hud.ts` still maps to the parent-longpress gate spec plus smoke only (an existing test pins that).
- `hair-bow` and `crown` cannot be earned in real play until Art Studio has a game; tests use the world id `art-studio` through unit tests and seeds only.
- Executor verification (2026-11-14): `tsc --noEmit` clean; `npm run check:ac` 128/128; related unit tests 174 passed; wardrobe e2e on private port 4311: 10 passed, 6 skipped (portrait @single-orientation).

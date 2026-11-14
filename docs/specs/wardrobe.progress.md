# wardrobe — progress

Spec: `docs/specs/wardrobe.md` (draft, Pass 1). Branch `feat/wardrobe`, stacked on PR #72 (art contract).

## Done

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

## Out of scope in Pass 1 (as in the spec)

- The outfit is drawn only in the Wardrobe (no outfit on map or game characters). The `Character.setAccessories` hook makes it cheap later.
- Bear only; no character switch. The layout helper already supports every fitted kind.
- Single-image fallback rig (no head group): head items are not drawn there. Layered bear art is the normal path.
- No spoken item names, no Art Studio.

## Gotchas for the e2e run

- `rendered` and `worn` in `getWardrobeInfo` come from the pure layout of the saved state, not from the Phaser display list, so tests do not depend on the SVG load finishing. The accessory images appear once the lazy art load completes.
- `getWardrobeInfo` returns null only before a profile is picked.
- Item buttons are DOM (`wardrobe-item-<id>`, `data-locked`, `data-worn`), 88 px, wrapping along the bottom edge (max 40% of the height, scrolls beyond that).
- The unlock toast is `wardrobe-unlock-toast` with `data-items`; it removes itself after 3 s.
- Offline (AC-10): `public/art/wardrobe/*.svg` must be in the service-worker precache; check this first if AC-10 fails.
- `hud.ts` still maps to the parent-longpress gate spec plus smoke only (an existing test pins that). The wardrobe spec is selected by wardrobe sources and its own unit tests; add `src/ui/hud.ts` to the wardrobe rule and update that existing test if you want hud changes to run it too.
- `hair-bow` and `crown` cannot be earned in real play until Art Studio has a game; tests use the world id `art-studio` through unit tests and seeds only.
- Executor verification (2026-11-14): `tsc --noEmit` clean; `npm run check:ac` 128/128; related unit tests 174 passed; wardrobe e2e on private port 4311: 10 passed, 6 skipped (portrait @single-orientation).

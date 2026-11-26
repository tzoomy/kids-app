# game-shell — progress

Spec: `docs/specs/game-shell.md` (draft, Pass 1 in progress). Branch `feat/mystery-egg-shell` (not pushed). Asset contract: Gemini's `game-shell/plan.md` section (d), adopted 2026-11-26 as `src/content/gameShellAssets.json` (37 ids, merged with `mysteryEggAssets.json`), listed in `docs/specs/mystery-egg-assets.md` ("Game shell assets"); the media files arrive with Gemini's PR.

## Done (all automated ACs have tests)

- AC-02, AC-04, AC-06, AC-09, AC-12, AC-13, AC-14, AC-15, AC-17 (unit): `worlds.ts`, `walk.ts`, `slides.ts`, `progress.ts`, `assets.ts` (+ `tests/unit/game-shell.*.test.ts`).
- AC-01, AC-03, AC-05, AC-07, AC-08, AC-10, AC-11, AC-16 (e2e): `tests/e2e/game-shell.journey.spec.ts` (landscape only); `tests/e2e/mystery-egg.journey.spec.ts` now enters through `world-workshop` and skips the first-visit slides.
- AC-18: device check by Maor (touch, walk, slides, rotation, audible voice once Gemini's files land, visuals).

## Code map

- `MysteryEggScene.ts` = the world map (phases `hub` (loading or a piece flying), `intro`, `map`, `walking`, `entry`); `slideView.ts` = the slide overlay (skip button is drawn code UI); `slides.ts` also holds `SlideVoice` (clip order, 400 ms gap, cancel); `shellArt.ts` = drawn placeholders; the Workshop game is the unchanged `MysteryEggBuildScene`.
- `progress.ts` = save v2 + v1 migration, levels, hearts, gear fill, pieces; `seedToSave` backs the `seedMysteryEggProgress` hook.
- `assets.ts`: `mysteryEggManifest()` merges `mysteryEggAssets.json` and `gameShellAssets.json` (duplicate id = error). `eggAssetLoader.ts`: the Workshop game loads prototype art only; the map loads `mapArtIds()`; the `shell-*` slide images load on demand.
- Media contract change (2026-11-26): ids renamed to Gemini's (`owl-house` -> `detective`), locked VO / sfx / `pending` flag / `friendsFor` removed, frog on the shared map.

## How to run

- Unit: `npx vitest run tests/unit/game-shell tests/unit/mystery-egg tests/unit/affectedE2e.test.ts`.
- E2E: temp config outside the repo (`/tmp/pw-game-shell.config.ts`, copy from `/workspace/wt-game-shell-notes/pw-game-shell.config.ts`, port 4397); the repo's `node_modules` must be on `NODE_PATH`: `NODE_PATH=<repo>/node_modules npx playwright test -c /tmp/pw-game-shell.config.ts 'e2e/game-shell\.journey' 'e2e/mystery-egg\.journey'`. Kill any leftover `vite preview` on 4397 first.

## Gotchas

- A v1 seed is written raw, so the migration runs on load; the intro and entry slides still show (`introSeen` false): e2e must tap `skipBtn` (`openHubByTap` does).
- `phase: 'hub'` means "not tappable yet" (loading, or a piece flying); wait for `map` before tapping a world, and for `intro` or `map` (not `hub`) right after opening.
- The Workshop scene's read hook used to throw while its assets loaded; the `createGame` hook now returns null until it has drawn.
- Missing `game-shell` files are normal until Gemini's media PR lands: placeholders everywhere; the files guard skips missing ones and checks the rest.
- The gear fill is `completed / min(PIECE_LEVELS, levels)` (pending decision), so the Workshop gear is full after its single level.

## Anchors vs the real art (PR #112, 2026-11-26)

- Verified against #112's `map-bg`, `map-nest-home` and tiles with the files in the working tree (never committed to this PR). Tiles sit on the painted clearings at Gemini's anchors; tile ground baselines are at tile-y + 251 (display px); tap areas are the visible tile art.
- Paths: the painted cobbles start at the nest rim and end on the clearings; `WORLDS[].path` follows them and `approach` routes walkers round the nest (a unit test samples every route and fails if one crosses the egg).
- To re-check when the walk strips and the other idle sprites land: friend homes, `FRIEND_HOMES`, walk speed, robot/capybara/frog sizes.
- How to look: copy `public/art/game-shell` and `public/audio/game-shell` from `pr112` into the working tree (untracked), build, and run `/tmp/shell-shot2.mjs`-style screenshots; delete them again before committing.

## Next step

Gemini's media PR (files at the manifest paths; no code change), then re-check the anchors and the walk strips against the real art. Then Maor's tablet check (AC-18) and the pending decisions in `docs/PENDING-DECISIONS.md` (2026-11-26 rows). Next code work: the other four worlds' games, hatching behind `readyToHatch`.
